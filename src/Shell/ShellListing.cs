using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// What a location holds (docs/plans/02-PLAN-ui-technology.md 3.1). A location is a parsing name: a folder on disk
/// (its path) or a shell folder ("::{20D04FE0-3AEA-1069-A2D8-08002B30309D}" for This PC, "shell:RecycleBinFolder").
/// Folders on disk are read with .NET (fast, with size and dates); everything else as shell items. Each entry is
/// { id: its parsing name, name, folder, size, modified (ms since 1970), icon, hidden, own }; the page never sees a PIDL.
/// A slow location (a large Recycle Bin: the shell's own enumerator is the slow part, plan 02 3.7) is handed over in
/// batches while it is read, and stops when it is cancelled.
/// </summary>
static class ShellListing
{
    public sealed record Result(JsonArray Entries, string? Error, bool Denied, long Milliseconds, string Kind, long IconMs = 0,
        bool Cancelled = false);

    /// <summary>Lists a location. `batch` gets the entries read so far every few hundred milliseconds (on this thread);
    /// the result holds the rest.</summary>
    public static Result List(string location, Action<JsonArray>? batch = null, CancellationToken cancel = default)
    {
        var clock = Stopwatch.StartNew();
        var batcher = new Batcher(batch);
        try
        {
            if (Path.IsPathFullyQualified(location) && Directory.Exists(location))
            {
                var icons = new Stopwatch();
                ListFolder(location, icons, batcher, cancel);
                return new Result(batcher.Rest, null, false, clock.ElapsedMilliseconds, "disk", icons.ElapsedMilliseconds, cancel.IsCancellationRequested);
            }
            ListShell(location, batcher, cancel);
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

    static readonly EnumerationOptions All = new()
    {
        IgnoreInaccessible = false, AttributesToSkip = 0, RecurseSubdirectories = false, ReturnSpecialDirectories = false,
    };

    static void ListFolder(string path, Stopwatch icons, Batcher batcher, CancellationToken cancel)
    {
        foreach (var info in new DirectoryInfo(path).EnumerateFileSystemInfos("*", All))
        {
            if (cancel.IsCancellationRequested) return;
            var folder = (info.Attributes & FileAttributes.Directory) != 0;
            icons.Start();
            var icon = ShellIcons.Of(info.FullName, folder);
            icons.Stop();
            batcher.Add(new JsonObject
            {
                ["id"] = info.FullName,
                ["name"] = info.Name,
                ["folder"] = folder,
                ["size"] = folder ? null : ((FileInfo)info).Length,
                ["modified"] = new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds(),
                ["icon"] = icon,
                ["hidden"] = (info.Attributes & FileAttributes.Hidden) != 0,
                ["own"] = !folder && ShellIcons.HasOwn(info.FullName),
            });
        }
    }

    static void ListShell(string location, Batcher batcher, CancellationToken cancel)
    {
        var parent = Native.Item(location);
        var hr = parent.BindToHandler(IntPtr.Zero, Native.BhidEnumItems, Native.IidIEnumShellItems, out var ptr);
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
        var items = (IEnumShellItems)Marshal.GetObjectForIUnknown(ptr);
        Marshal.Release(ptr);
        while (!cancel.IsCancellationRequested && items.Next(1, out var item, out var fetched) == 0 && fetched == 1)
        {
            item.GetAttributes(Native.SfgaoFolder | Native.SfgaoFileSystem | Native.SfgaoStream | Native.SfgaoHidden, out var attrs);
            // A zip file is a folder and a stream to the shell: Foldex shows it as a file.
            var folder = (attrs & Native.SfgaoFolder) != 0 && (attrs & Native.SfgaoStream) == 0;
            long? size = null;
            long? modified = null;
            if ((attrs & Native.SfgaoFileSystem) != 0)
                try
                {
                    var fsPath = Native.DisplayName(item, Sigdn.FileSysPath);
                    var info = folder ? (FileSystemInfo)new DirectoryInfo(fsPath) : new FileInfo(fsPath);
                    if (info.Exists)
                    {
                        if (info is FileInfo f) size = f.Length;
                        modified = new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds();
                    }
                }
                catch (Exception ex) when (ex is COMException or IOException or UnauthorizedAccessException or ArgumentException) { }
            batcher.Add(new JsonObject
            {
                ["id"] = Native.IdOf(item),
                ["name"] = Native.DisplayName(item, Sigdn.NormalDisplay),
                ["folder"] = folder,
                ["size"] = size,
                ["modified"] = modified,
                ["icon"] = ShellIcons.Of(item),
                ["hidden"] = (attrs & Native.SfgaoHidden) != 0,
            });
            Marshal.ReleaseComObject(item);
        }
        Marshal.ReleaseComObject(items);
        Marshal.ReleaseComObject(parent);
    }

    /// <summary>The name a location is shown by ("This PC", "Recycle Bin", or the folder's own name).</summary>
    public static string NameOf(string location)
    {
        try { return Native.DisplayName(Native.Item(location), Sigdn.NormalDisplay); }
        catch (Exception ex) when (ex is COMException or ArgumentException) { return location; }
    }
}
