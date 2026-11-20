using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

namespace Foldex.Shell;

/// <summary>
/// Links (docs/plans/executed/31-PLAN-elevated-helper-tasks.md 3.2): a symbolic link, a junction, a hard link, and the shortcut
/// (.lnk), which is no link but is looked for beside them. What fits an item, the name one gets in a folder, making one
/// (a symbolic link without developer mode: the elevated helper, as `Make` says), and the link source on the clipboard.
/// </summary>
static class Links
{
    public const string Symlink = "symlink", Junction = "junction", Hardlink = "hardlink", Shortcut = "shortcut";

    /// <summary>The words of a kind for a menu: "symbolic link", "junction", "hard link", "shortcut (.lnk)".</summary>
    public static string Words(string kind) => kind switch
    {
        Symlink => "symbolic link", Junction => "junction", Hardlink => "hard link", Shortcut => "shortcut (.lnk)", _ => kind,
    };

    /// <summary>The kinds that fit an item, in the menu's order: a symbolic link; a junction for a folder on a local
    /// drive; a hard link for a file; a shortcut for every item.</summary>
    public static List<string> KindsFor(string path)
    {
        var folder = Directory.Exists(path);
        var kinds = new List<string> { Symlink };
        if (folder && LocalDrive(path)) kinds.Add(Junction);
        if (!folder) kinds.Add(Hardlink);
        kinds.Add(Shortcut);
        return kinds;
    }

    static bool LocalDrive(string path) =>
        path.Length >= 3 && path[1] == ':' && new DriveInfo(path[..1]).DriveType is DriveType.Fixed or DriveType.Removable;

    /// <summary>The name a link of a kind to `target` gets: the item's own; a shortcut as Windows names one
    /// ("name - Shortcut.lnk").</summary>
    public static string NameFor(string kind, string target)
    {
        var name = Path.GetFileName(target.TrimEnd('\\'));
        if (name.Length == 0) name = target[..1];   // a drive's root: its letter
        return kind == Shortcut ? $"{name} - Shortcut.lnk" : name;
    }

    /// <summary>A name not in `folder` yet: the name, else "name (2)", "name (3)" (before the extension of a file).</summary>
    public static string FreeName(string folder, string name)
    {
        if (!Exists(Path.Combine(folder, name))) return name;
        var ext = Path.GetExtension(name);
        var stem = ext.Length > 0 && ext.Length < name.Length ? name[..^ext.Length] : name;
        if (stem == name) ext = "";
        for (var n = 2; ; n++)
        {
            var next = $"{stem} ({n}){ext}";
            if (!Exists(Path.Combine(folder, next))) return next;
        }
    }

    static bool Exists(string path) => File.Exists(path) || Directory.Exists(path) || new FileInfo(path).LinkTarget is not null;

    /// <summary>Makes a link of a kind at `link` to `target`. Null when made; "elevate" when a symbolic link needs
    /// administrator rights (no developer mode: the caller asks the helper); else why not.</summary>
    public static string? Make(string kind, string target, string link)
    {
        try
        {
            switch (kind)
            {
                case Symlink:
                    if (Directory.Exists(target)) Directory.CreateSymbolicLink(link, target);
                    else File.CreateSymbolicLink(link, target);
                    return null;
                case Junction: return MakeJunction(target, link);
                case Hardlink:
                    if (Path.GetPathRoot(target)?.Equals(Path.GetPathRoot(link), StringComparison.OrdinalIgnoreCase) != true)
                        return "a hard link is on the same drive as its file";
                    return CreateHardLink(link, target, IntPtr.Zero) ? null : new Win32Exception().Message;
                case Shortcut: return MakeShortcut(target, link);
                default: return $"no link of the kind {kind}";
            }
        }
        // A symbolic link without developer mode: the privilege is not held (1314).
        catch (IOException ex) when (kind == Symlink && (ex.HResult & 0xFFFF) == 1314) { return "elevate"; }
        catch (UnauthorizedAccessException) when (kind == Symlink) { return "elevate"; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return ex.Message; }
    }

    // ---------- A junction: a folder with a mount point reparse point ----------

    const uint FsctlSetReparsePoint = 0x000900A4, ReparseTagMountPoint = 0xA0000003;

    static string? MakeJunction(string target, string link)
    {
        if (!Directory.Exists(target)) return "a junction is to a folder";
        var full = Path.GetFullPath(target).TrimEnd('\\') + "\\";
        if (!LocalDrive(full)) return "a junction is to a folder on a local drive";
        Directory.CreateDirectory(link);
        try
        {
            // The mount point's data: the substitute name (\??\C:\target\) and the print name (C:\target\), each
            // followed by a 0.
            var substitute = Encoding.Unicode.GetBytes(@"\??\" + full);
            var print = Encoding.Unicode.GetBytes(full);
            using var data = new MemoryStream();
            using (var w = new BinaryWriter(data, Encoding.Unicode, true))
            {
                w.Write(ReparseTagMountPoint);
                w.Write((ushort)(8 + substitute.Length + 2 + print.Length + 2));   // the data's length after this header
                w.Write((ushort)0);
                w.Write((ushort)0);                            // substitute name offset
                w.Write((ushort)substitute.Length);
                w.Write((ushort)(substitute.Length + 2));      // print name offset
                w.Write((ushort)print.Length);
                w.Write(substitute); w.Write((ushort)0);
                w.Write(print); w.Write((ushort)0);
            }
            using var handle = CreateFile(link, 0x40000000 /* GENERIC_WRITE */, 0, IntPtr.Zero, 3 /* OPEN_EXISTING */,
                0x02000000 | 0x00200000 /* BACKUP_SEMANTICS | OPEN_REPARSE_POINT */, IntPtr.Zero);
            if (handle.IsInvalid) throw new Win32Exception();
            var bytes = data.ToArray();
            if (!DeviceIoControl(handle, FsctlSetReparsePoint, bytes, bytes.Length, IntPtr.Zero, 0, out _, IntPtr.Zero)) throw new Win32Exception();
            return null;
        }
        catch (Win32Exception ex)
        {
            try { Directory.Delete(link); } catch (IOException) { }
            return ex.Message;
        }
    }

    // ---------- A shortcut: Windows' own shell link ----------

    static string? MakeShortcut(string target, string link)
    {
        var shell = (IShellLinkW)new ShellLinkObject();
        try
        {
            shell.SetPath(target);
            if (Path.GetDirectoryName(target.TrimEnd('\\')) is { Length: > 0 } dir) shell.SetWorkingDirectory(dir);
            ((IPersistFile)shell).Save(link, true);
            return null;
        }
        catch (Exception ex) when (ex is COMException or UnauthorizedAccessException) { return ex.Message; }
        finally { Marshal.ReleaseComObject(shell); }
    }

    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    class ShellLinkObject { }

    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, IntPtr pfd, uint fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
        void Resolve(IntPtr hwnd, uint fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }

    // ---------- The link source on the clipboard (3.2) ----------

    /// <summary>The clipboard format Foldex registers for a link source: "kind|path" in UTF-8.</summary>
    public const string ClipboardFormat = "Foldex link source";

    public static byte[] SourceBytes(string kind, string path) => Encoding.UTF8.GetBytes($"{kind}|{path}");

    /// <summary>The kind and path of a link source's bytes; null for anything else.</summary>
    public static (string Kind, string Path)? SourceOf(byte[]? bytes)
    {
        if (bytes is null) return null;
        var text = Encoding.UTF8.GetString(bytes).TrimEnd('\0');
        var bar = text.IndexOf('|');
        if (bar <= 0) return null;
        var kind = text[..bar];
        return kind is Symlink or Junction or Hardlink or Shortcut ? (kind, text[(bar + 1)..]) : null;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CreateHardLink(string lpFileName, string lpExistingFileName, IntPtr lpSecurityAttributes);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern Microsoft.Win32.SafeHandles.SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security,
        uint disposition, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DeviceIoControl(Microsoft.Win32.SafeHandles.SafeFileHandle device, uint code, byte[] inBuffer, int inSize,
        IntPtr outBuffer, int outSize, out int returned, IntPtr overlapped);
}
