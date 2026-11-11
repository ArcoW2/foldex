using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// What a location holds (docs/plans/02-PLAN-ui-technology.md 3.1). A location is a parsing name: a folder on disk
/// (its path) or a shell folder ("::{20D04FE0-3AEA-1069-A2D8-08002B30309D}" for This PC, "shell:RecycleBinFolder").
/// Folders on disk are read with .NET (fast, with size and dates); everything else as shell items. Each entry is
/// { id: its parsing name, name, folder, size, modified (ms since 1970), icon, hidden, own, link }; the page never sees a
/// PIDL. `foldersOnly` (a folder pane, plan 03 3.5) leaves files out; a junction or symbolic link to a folder is a folder,
/// marked as a link.
/// A slow location (a large Recycle Bin: the shell's own enumerator is the slow part, plan 02 3.7) is handed over in
/// batches while it is read, and stops when it is cancelled.
/// </summary>
static class ShellListing
{
    /// <summary>`Target`: the folder listed instead of the location, when the location is a link that may not be
    /// listed itself.</summary>
    public sealed record Result(JsonArray Entries, string? Error, bool Denied, long Milliseconds, string Kind, long IconMs = 0,
        bool Cancelled = false, string? Target = null);

    /// <summary>Lists a location. `batch` gets the entries read so far every few hundred milliseconds (on this thread);
    /// the result holds the rest.</summary>
    public static Result List(string location, Action<JsonArray>? batch = null, CancellationToken cancel = default,
        bool foldersOnly = false, bool tree = false)
    {
        var clock = Stopwatch.StartNew();
        var batcher = new Batcher(batch);
        try
        {
            if (Path.IsPathFullyQualified(location) && Directory.Exists(location))
            {
                var icons = new Stopwatch();
                string? target = null;
                try { ListFolder(location, icons, batcher, cancel, foldersOnly, tree); }
                catch (UnauthorizedAccessException) when (LinkTarget(location) is string to)
                {
                    // A compatibility link such as C:\Documents and Settings denies listing to everyone, administrators
                    // included; its target is the folder meant (docs/plans/05-PLAN-elevation.md 3.1).
                    target = to;
                    ListFolder(to, icons, batcher, cancel, foldersOnly, tree);
                }
                return new Result(batcher.Rest, null, false, clock.ElapsedMilliseconds, "disk", icons.ElapsedMilliseconds,
                    cancel.IsCancellationRequested, target);
            }
            ListShell(location, batcher, cancel, foldersOnly, tree);
            return new Result(batcher.Rest, null, false, clock.ElapsedMilliseconds, "shell", 0, cancel.IsCancellationRequested);
        }
        catch (UnauthorizedAccessException ex) { return new Result(batcher.Rest, ex.Message, true, clock.ElapsedMilliseconds, "disk"); }
        catch (Exception ex) when (ex is IOException or COMException or ArgumentException)
        {
            return new Result(batcher.Rest, ex.Message, ex.HResult == unchecked((int)0x80070005), clock.ElapsedMilliseconds, "shell");
        }
    }

    // Collects entries and hands them over in batches, by time, so a fast folder goes in one piece and a slow one
    // shows as it comes.
    sealed class Batcher(Action<JsonArray>? batch)
    {
        const int EveryMs = 250;
        readonly Stopwatch since = Stopwatch.StartNew();

        public JsonArray Rest { get; private set; } = [];

        public void Add(JsonObject entry)
        {
            Rest.Add(entry);
            if (batch is null || since.ElapsedMilliseconds < EveryMs) return;
            batch(Rest);
            Rest = [];
            since.Restart();
        }
    }

    /// <summary>The folder a junction or symbolic link finally points to, or null when the path is no link.</summary>
    internal static string? LinkTarget(string path)
    {
        try
        {
            var dir = new DirectoryInfo(path);
            if ((dir.Attributes & FileAttributes.ReparsePoint) == 0) return null;
            return dir.ResolveLinkTarget(returnFinalTarget: true)?.FullName;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return null; }
    }

    static readonly EnumerationOptions All = new()
    {
        IgnoreInaccessible = false, AttributesToSkip = 0, RecurseSubdirectories = false, ReturnSpecialDirectories = false,
    };

    // `tree`: a tree's listing (plan 18), whose folders say whether they have subfolders and, with files shown, files
    // (for their expanders); a list of folders only says so too, as before.
    static void ListFolder(string path, Stopwatch icons, Batcher batcher, CancellationToken cancel, bool foldersOnly, bool tree)
    {
        var dir = new DirectoryInfo(path);
        foreach (var info in foldersOnly ? dir.EnumerateDirectories("*", All) : dir.EnumerateFileSystemInfos("*", All))
        {
            if (cancel.IsCancellationRequested) return;
            var folder = (info.Attributes & FileAttributes.Directory) != 0;
            icons.Start();
            var icon = ShellIcons.Of(info.FullName, folder);
            icons.Stop();
            var entry = new JsonObject
            {
                ["id"] = info.FullName,
                ["name"] = info.Name,
                ["folder"] = folder,
                ["size"] = folder ? null : ((FileInfo)info).Length,
                ["modified"] = new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds(),
                ["icon"] = icon,
                ["hidden"] = (info.Attributes & FileAttributes.Hidden) != 0,
                ["own"] = !folder && ShellIcons.HasOwn(info.FullName),
                ["link"] = (info.Attributes & FileAttributes.ReparsePoint) != 0,
            };
            if (folder && (foldersOnly || tree))
            {
                var (subs, files) = Contents(info.FullName, tree && !foldersOnly);
                entry["subs"] = subs;
                if (tree && !foldersOnly) entry["files"] = files;
            }
            OwnColumns(entry, info, folder);
            batcher.Add(entry);
        }
    }

    /// <summary>The own columns of plan 11 3.1 that the listing reads anyway: created, accessed, the attributes as
    /// letters, the extension, the shell's type name, a link's target, and the folder it is in.</summary>
    static void OwnColumns(JsonObject entry, FileSystemInfo info, bool folder)
    {
        entry["created"] = new DateTimeOffset(info.CreationTimeUtc).ToUnixTimeMilliseconds();
        entry["accessed"] = new DateTimeOffset(info.LastAccessTimeUtc).ToUnixTimeMilliseconds();
        entry["attributes"] = Attributes(info.Attributes);
        entry["ext"] = folder ? "" : info.Extension.TrimStart('.');
        entry["type"] = TypeName(folder ? null : info.Extension);
        entry["path"] = Path.GetDirectoryName(info.FullName.TrimEnd('\\'));
        if ((info.Attributes & FileAttributes.ReparsePoint) != 0)
            try { entry["target"] = info.LinkTarget; }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }

    /// <summary>Attributes as letters, as Explorer's column: R H S A, then C (compressed), E (encrypted), L (a link),
    /// O (offline).</summary>
    public static string Attributes(FileAttributes a) => string.Concat(
        (a & FileAttributes.ReadOnly) != 0 ? "R" : "", (a & FileAttributes.Hidden) != 0 ? "H" : "",
        (a & FileAttributes.System) != 0 ? "S" : "", (a & FileAttributes.Archive) != 0 ? "A" : "",
        (a & FileAttributes.Compressed) != 0 ? "C" : "", (a & FileAttributes.Encrypted) != 0 ? "E" : "",
        (a & FileAttributes.ReparsePoint) != 0 ? "L" : "", (a & FileAttributes.Offline) != 0 ? "O" : "");

    static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> typeNames = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>The shell's type name of an extension ("Text Document"); null: a folder ("File folder"). Asked once per
    /// extension.</summary>
    public static string TypeName(string? extension) => typeNames.GetOrAdd(extension ?? "\\", ext =>
    {
        var info = new ShFileInfo();
        var folder = ext == "\\";
        Native.SHGetFileInfo(folder ? "folder" : "x" + ext, folder ? Native.FileAttributeDirectory : Native.FileAttributeNormal,
            ref info, (uint)Marshal.SizeOf<ShFileInfo>(), Native.ShgfiTypeName | Native.ShgfiUseFileAttributes);
        return info.szTypeName ?? "";
    });

    /// <summary>For a tree's expander: whether a folder has subfolders and (`files`) files, each true, "hidden" (only
    /// hidden ones) or false, read in one pass that stops once both are settled. A link that refuses its own listing
    /// (C:\Documents and Settings) answers for the folder it opens (its target); otherwise unknown (no access) counts as
    /// true, so the folder can still be opened and show why not.</summary>
    static (JsonNode Subs, JsonNode? Files) Contents(string path, bool files)
    {
        try
        {
            bool subVisible = false, subHidden = false, fileVisible = false, fileHidden = false;
            var dir = new DirectoryInfo(path);
            foreach (var item in files ? dir.EnumerateFileSystemInfos("*", All) : dir.EnumerateDirectories("*", All))
            {
                var hidden = (item.Attributes & FileAttributes.Hidden) != 0;
                if ((item.Attributes & FileAttributes.Directory) != 0)
                {
                    if (hidden) subHidden = true;
                    else subVisible = true;
                }
                else if (hidden) fileHidden = true;
                else fileVisible = true;
                if (subVisible && (fileVisible || !files)) break;
            }
            JsonNode Mark(bool visible, bool hiddenOnly) => visible ? true : hiddenOnly ? "hidden" : false;
            return (Mark(subVisible, subHidden), files ? Mark(fileVisible, fileHidden) : null);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException)
        {
            return LinkTarget(path) is { } target && !target.Equals(path, StringComparison.OrdinalIgnoreCase)
                ? Contents(target, files) : (true, files ? true : null);
        }
    }

    static void ListShell(string location, Batcher batcher, CancellationToken cancel, bool foldersOnly, bool tree)
    {
        var parent = Native.Item(location);
        var hr = parent.BindToHandler(IntPtr.Zero, Native.BhidEnumItems, Native.IidIEnumShellItems, out var ptr);
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
        var items = (IEnumShellItems)Marshal.GetObjectForIUnknown(ptr);
        Marshal.Release(ptr);
        while (!cancel.IsCancellationRequested && items.Next(1, out var item, out var fetched) == 0 && fetched == 1)
        {
            item.GetAttributes(Native.SfgaoFolder | Native.SfgaoFileSystem | Native.SfgaoStream | Native.SfgaoHidden | Native.SfgaoLink
                | (foldersOnly || tree ? Native.SfgaoHasSubfolder : 0), out var attrs);
            // A zip file is a folder and a stream to the shell: Foldex shows it as a file.
            var folder = (attrs & Native.SfgaoFolder) != 0 && (attrs & Native.SfgaoStream) == 0;
            if (foldersOnly && !folder)
            {
                Marshal.ReleaseComObject(item);
                continue;
            }
            long? size = null;
            long? modified = null;
            FileSystemInfo? fsInfo = null;
            if ((attrs & Native.SfgaoFileSystem) != 0)
                try
                {
                    var fsPath = Native.DisplayName(item, Sigdn.FileSysPath);
                    var info = folder ? (FileSystemInfo)new DirectoryInfo(fsPath) : new FileInfo(fsPath);
                    if (info.Exists)
                    {
                        if (info is FileInfo f) size = f.Length;
                        modified = new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds();
                        fsInfo = info;
                    }
                }
                catch (Exception ex) when (ex is COMException or IOException or UnauthorizedAccessException or ArgumentException) { }
            var entry = new JsonObject
            {
                ["id"] = Native.IdOf(item),
                ["name"] = Native.DisplayName(item, Sigdn.NormalDisplay),
                ["folder"] = folder,
                ["size"] = size,
                ["modified"] = modified,
                ["icon"] = ShellIcons.Of(item),
                ["hidden"] = (attrs & Native.SfgaoHidden) != 0,
                ["link"] = (attrs & Native.SfgaoLink) != 0,
                ["subs"] = folder && (foldersOnly || tree) ? (attrs & Native.SfgaoHasSubfolder) != 0 : null,
                // Whether a shell folder has files is not known without listing it: it may, so it gets an expander.
                ["files"] = folder && tree && !foldersOnly ? true : null,
            };
            // A drive in This PC: its total and free size (plan 11 3.1); a file system item: the own columns.
            var id = entry["id"]!.GetValue<string>();
            if (id.Length == 3 && id[1] == ':' && id[2] == '\\')
                try
                {
                    var drive = new DriveInfo(id);
                    if (drive.IsReady)
                    {
                        entry["total"] = drive.TotalSize;
                        entry["free"] = drive.AvailableFreeSpace;
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { }
            else if (fsInfo is not null) OwnColumns(entry, fsInfo, folder);
            batcher.Add(entry);
            Marshal.ReleaseComObject(item);
        }
        Marshal.ReleaseComObject(items);
        Marshal.ReleaseComObject(parent);
    }

    /// <summary>Entries for single items (the top of a folder pane's tree: This PC, the user's folder, Network, the
    /// Recycle Bin), as a listing gives them.</summary>
    public static JsonArray Describe(IEnumerable<string> ids)
    {
        var entries = new JsonArray();
        foreach (var id in ids)
            try
            {
                var item = Native.Item(id);
                item.GetAttributes(Native.SfgaoFolder | Native.SfgaoStream, out var attrs);
                entries.Add(new JsonObject
                {
                    ["id"] = id,
                    ["name"] = Native.DisplayName(item, Sigdn.NormalDisplay),
                    ["folder"] = (attrs & Native.SfgaoFolder) != 0 && (attrs & Native.SfgaoStream) == 0,
                    ["icon"] = ShellIcons.Of(item),
                });
                Marshal.ReleaseComObject(item);
            }
            catch (Exception ex) when (ex is COMException or ArgumentException) { }   // not on this PC
        return entries;
    }

    /// <summary>The name a location is shown by ("This PC", "Recycle Bin", or the folder's own name).</summary>
    public static string NameOf(string location)
    {
        try { return Native.DisplayName(Native.Item(location), Sigdn.NormalDisplay); }
        catch (Exception ex) when (ex is COMException or ArgumentException) { return location; }
    }
}
