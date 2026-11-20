using System.Collections.Specialized;
using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// Copy, cut and paste of files through the Windows clipboard, as Explorer does it (docs/plans/02-PLAN-ui-technology.md
/// 3.1): the file list, and "Preferred DropEffect" saying whether a paste copies (1) or moves (2), so Explorer pastes
/// what Foldex copied and the reverse. On the UI thread (the clipboard wants an STA thread).
/// </summary>
static class ShellClipboard
{
    const string DropEffect = "Preferred DropEffect";

    /// <summary>The items on the clipboard; null, or why not (an item without a path, such as one in the Recycle Bin).</summary>
    public static string? Put(IReadOnlyList<string> ids, bool cut)
    {
        if (ids.Count == 0) return "nothing selected";
        if (ids.Any(id => !Path.IsPathFullyQualified(id))) return "only files and folders on disk can go on the clipboard";
        var files = new StringCollection();
        files.AddRange([.. ids]);
        var data = new DataObject();
        data.SetFileDropList(files);
        data.SetData(DropEffect, new MemoryStream(BitConverter.GetBytes(cut ? 2 : 1)));
        Clipboard.SetDataObject(data, true);
        return null;
    }

    /// <summary>A link source (docs/plans/executed/31-PLAN-elevated-helper-tasks.md 3.2): the item as a copy is (so Paste pastes a
    /// copy, in Foldex and in Explorer) and Foldex's own format with the kind and the path. Null, or why not.</summary>
    public static string? PutLinkSource(string path, string kind)
    {
        if (!Path.IsPathFullyQualified(path)) return "only a file or folder on disk can be linked to";
        var data = new DataObject();
        data.SetFileDropList(new StringCollection { path });
        data.SetData(DropEffect, new MemoryStream(BitConverter.GetBytes(1)));
        data.SetData(Links.ClipboardFormat, new MemoryStream(Links.SourceBytes(kind, path)));
        Clipboard.SetDataObject(data, true);
        return null;
    }

    /// <summary>The link source on the clipboard: its kind and path, when Foldex's format is there and its path is the
    /// file on the clipboard; else null.</summary>
    public static (string Kind, string Path)? LinkSource()
    {
        try
        {
            if (Clipboard.GetDataObject() is not { } data || !data.GetDataPresent(Links.ClipboardFormat)) return null;
            var source = Links.SourceOf((data.GetData(Links.ClipboardFormat) as MemoryStream)?.ToArray());
            var files = Clipboard.ContainsFileDropList() ? Clipboard.GetFileDropList().Cast<string>().ToList() : [];
            return source is { } s && files.Count == 1 && string.Equals(files[0], s.Path, StringComparison.OrdinalIgnoreCase) ? s : null;
        }
        catch (ExternalException) { return null; }   // the clipboard held by another program a moment
    }

    /// <summary>The files on the clipboard, and whether they were cut.</summary>
    public static (List<string> Files, bool Move) Take()
    {
        if (!Clipboard.ContainsFileDropList()) return ([], false);
        var files = Clipboard.GetFileDropList().Cast<string>().ToList();
        var move = Clipboard.GetDataObject()?.GetData(DropEffect) is MemoryStream effect && effect.Length >= 4
            && (BitConverter.ToInt32(effect.ToArray(), 0) & 2) != 0;
        return (files, move);
    }
}
