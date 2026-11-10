using System.Collections.Specialized;

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
