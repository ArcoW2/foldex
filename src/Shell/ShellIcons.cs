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

    /// <summary>The icon of an index as a PNG data URL; null when there is none.</summary>
    public static string? Png(int index)
    {
        lock (Gate)
            if (Pngs.TryGetValue(index, out var known)) return known;
        if (smallList == IntPtr.Zero || index < 0) return null;
        var handle = Native.ImageList_GetIcon(smallList, index, 1);   // ILD_TRANSPARENT
        if (handle == IntPtr.Zero) return null;
        try
        {
            using var icon = Icon.FromHandle(handle);
            using var bitmap = icon.ToBitmap();
            using var stream = new MemoryStream();
            bitmap.Save(stream, ImageFormat.Png);
            var url = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            lock (Gate) Pngs[index] = url;
            return url;
        }
        finally { Native.DestroyIcon(handle); }
    }
}
