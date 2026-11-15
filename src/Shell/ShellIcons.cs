using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// The system's icons: an item gets the index of its icon in the system image list; the page asks for each index once
/// and gets it as a PNG (docs/plans/02-PLAN-ui-technology.md 3.2 A). By extension where every file of the type has the
/// same icon (fast: no file is touched); a file with an icon of its own (exe, lnk, ico, ...) first gets its type's, and its own
/// only when its row comes in view (reading it is slow: plan 02 3.7, item 1).
/// </summary>
static class ShellIcons
{
    // Types whose files carry their own icon.
    static readonly HashSet<string> OwnIcon = new(StringComparer.OrdinalIgnoreCase)
        { ".exe", ".lnk", ".ico", ".url", ".cpl", ".scr", ".msc", ".appref-ms" };

    static readonly Dictionary<string, int> ByExtension = new(StringComparer.OrdinalIgnoreCase);
    static readonly Dictionary<int, string> Pngs = [];
    static readonly object Gate = new();
    static IntPtr smallList;
    static int folderIcon = -1;

    /// <summary>True for a file whose icon is its own (exe, lnk, ...): <see cref="Of"/> gives its type's icon, and
    /// <see cref="OwnOf"/> the file's, read from the file (slow: only for the rows in view).</summary>
    public static bool HasOwn(string path) => OwnIcon.Contains(Path.GetExtension(path));

    /// <summary>The file's own icon index (see <see cref="HasOwn"/>).</summary>
    public static int OwnOf(string path) => Index(path, 0, 0);

    /// <summary>The icon index of a file system entry by its type, without touching the file.</summary>
    public static int Of(string path, bool folder)
    {
        if (folder)
        {
            if (folderIcon < 0) folderIcon = Index(path, Native.FileAttributeDirectory, Native.ShgfiUseFileAttributes);
            return folderIcon;
        }
        var ext = Path.GetExtension(path);
        lock (Gate)
            if (ByExtension.TryGetValue(ext, out var known)) return known;
        var index = Index(string.IsNullOrEmpty(ext) ? "file" : "file" + ext, Native.FileAttributeNormal, Native.ShgfiUseFileAttributes);
        lock (Gate) ByExtension[ext] = index;
        return index;
    }

    /// <summary>The icon index of a shell item (This PC, a drive, an item in the Recycle Bin).</summary>
    public static int Of(IShellItem item)
    {
        Native.SHGetIDListFromObject(item, out var pidl);
        try
        {
            var info = new ShFileInfo();
            var list = Native.SHGetFileInfo(pidl, 0, ref info, (uint)Marshal.SizeOf<ShFileInfo>(),
                Native.ShgfiPidl | Native.ShgfiSysIconIndex | Native.ShgfiSmallIcon);
            Remember(list);
            return list == IntPtr.Zero ? -1 : info.iIcon;
        }
        finally { Native.CoTaskMemFree(pidl); }
    }

    static int Index(string path, uint attributes, uint flags)
    {
        var info = new ShFileInfo();
        var list = Native.SHGetFileInfo(path, attributes, ref info, (uint)Marshal.SizeOf<ShFileInfo>(),
            Native.ShgfiSysIconIndex | Native.ShgfiSmallIcon | flags);
        Remember(list);
        return list == IntPtr.Zero ? -1 : info.iIcon;
    }

    static void Remember(IntPtr list)
    {
        if (list != IntPtr.Zero) smallList = list;
    }

    // The larger lists (docs/plans/executed/08-PLAN-fonts.md 3.4): the same indexes as the small one, asked once.
    static readonly Dictionary<int, IntPtr> Lists = [];

    static IntPtr ListOf(int size)
    {
        if (size <= 16) return smallList;
        var shil = size <= 32 ? Native.ShilLarge : Native.ShilExtraLarge;
        lock (Gate)
        {
            if (Lists.TryGetValue(shil, out var known)) return known;
            var iid = Native.IidIImageList;
            var list = Native.SHGetImageList(shil, ref iid, out var ppv) == 0 ? ppv : IntPtr.Zero;
            Lists[shil] = list;
            return list;
        }
    }

    /// <summary>The icons the page can ask for: 16, 32 and 48 px (the system's small, large and extra large).</summary>
    public static readonly int[] Sizes = [16, 32, 48];

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern uint ExtractIconEx(string file, int index, IntPtr[]? large, IntPtr[]? small, uint count);

    static readonly Dictionary<string, string?> FilePngs = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Every icon in a file (a dll, exe, ico; docs/plans/executed/26-PLAN-bookmarks.md 3.5), in its order, each a 32 px PNG
    /// data URL; none for a file without icons or that is not there. %SystemRoot% and the like expanded.</summary>
    public static List<string?> AllFromFile(string file)
    {
        var path = Environment.ExpandEnvironmentVariables(file);
        if (!File.Exists(path)) return [];
        var count = (int)ExtractIconEx(path, -1, null, null, 0);
        return Enumerable.Range(0, Math.Max(0, count)).Select(k => FromFile(file, k)).ToList();
    }

    /// <summary>One icon of a file, as Windows writes an icon place ("file,index"; a negative index a resource id), as a
    /// 32 px PNG data URL, kept once made; null when it has none.</summary>
    public static string? FromFile(string file, int index)
    {
        var key = $"{file},{index}";
        lock (Gate)
            if (FilePngs.TryGetValue(key, out var known)) return known;
        var large = new IntPtr[1];
        string? url = null;
        if (ExtractIconEx(Environment.ExpandEnvironmentVariables(file), index, large, null, 1) > 0 && large[0] != IntPtr.Zero)
            try
            {
                using var icon = Icon.FromHandle(large[0]);
                using var bitmap = icon.ToBitmap();
                using var stream = new MemoryStream();
                bitmap.Save(stream, ImageFormat.Png);
                url = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            }
            finally { Native.DestroyIcon(large[0]); }
        lock (Gate) FilePngs[key] = url;
        return url;
    }

    /// <summary>The icon of an index at a size of <see cref="Sizes"/> as a PNG data URL; null when there is none.</summary>
    public static string? Png(int index, int size = 16)
    {
        var key = index * 100 + size;
        lock (Gate)
            if (Pngs.TryGetValue(key, out var known)) return known;
        var list = ListOf(size);
        if (list == IntPtr.Zero || index < 0) return null;
        var handle = Native.ImageList_GetIcon(list, index, 1);   // ILD_TRANSPARENT
        if (handle == IntPtr.Zero) return null;
        try
        {
            using var icon = Icon.FromHandle(handle);
            using var bitmap = icon.ToBitmap();
            using var stream = new MemoryStream();
            bitmap.Save(stream, ImageFormat.Png);
            var url = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            lock (Gate) Pngs[key] = url;
            return url;
        }
        finally { Native.DestroyIcon(handle); }
    }
}
