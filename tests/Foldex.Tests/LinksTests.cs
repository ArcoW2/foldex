using System.Security.Principal;
using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// Links and the elevated helper's operations (docs/plans/executed/31-PLAN-elevated-helper-tasks.md 3.1, 3.2): what fits an item,
// the names, each kind made, the clipboard's link source, and what the helper refuses.
public class LinksTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-links-" + Guid.NewGuid().ToString("N"));

    public LinksTests()
    {
        Directory.CreateDirectory(Path.Combine(dir, "folder", "inside"));
        Directory.CreateDirectory(Path.Combine(dir, "to"));
        File.WriteAllText(Path.Combine(dir, "a.txt"), "text");
        File.WriteAllText(Path.Combine(dir, "folder", "inside", "b.txt"), "b");
    }

    public void Dispose()
    {
        // Links first, so deleting the tree never goes through one into what it points to.
        foreach (var link in Directory.EnumerateFileSystemEntries(Path.Combine(dir, "to")))
            if (new FileInfo(link).Attributes.HasFlag(FileAttributes.ReparsePoint)) { if (Directory.Exists(link)) Directory.Delete(link); else File.Delete(link); }
        try { Directory.Delete(dir, true); } catch (IOException) { }
    }

    [Fact]
    public void WhatFitsAnItemAndTheNames()
    {
        Assert.Equal([Links.Symlink, Links.Hardlink, Links.Shortcut], Links.KindsFor(Path.Combine(dir, "a.txt")));
        Assert.Equal([Links.Symlink, Links.Junction, Links.Shortcut], Links.KindsFor(Path.Combine(dir, "folder")));
        Assert.Equal("a.txt", Links.NameFor(Links.Symlink, Path.Combine(dir, "a.txt")));
        Assert.Equal("folder - Shortcut.lnk", Links.NameFor(Links.Shortcut, Path.Combine(dir, "folder") + "\\"));
        Assert.Equal("a (2).txt", Links.FreeName(dir, "a.txt"));
        Assert.Equal("folder (2)", Links.FreeName(dir, "folder"));
        Assert.Equal("new.txt", Links.FreeName(dir, "new.txt"));
        Assert.Equal("shortcut (.lnk)", Links.Words(Links.Shortcut));
    }

    [Fact]
    public void AJunctionAHardLinkAndAShortcutAreMade()
    {
        var to = Path.Combine(dir, "to");
        // A junction: the folder's items seen through it.
        Assert.Null(Links.Make(Links.Junction, Path.Combine(dir, "folder"), Path.Combine(to, "folder")));
        Assert.True(new DirectoryInfo(Path.Combine(to, "folder")).Attributes.HasFlag(FileAttributes.ReparsePoint));
        Assert.True(File.Exists(Path.Combine(to, "folder", "inside", "b.txt")));
        // A hard link: the same file, changed through either name.
        Assert.Null(Links.Make(Links.Hardlink, Path.Combine(dir, "a.txt"), Path.Combine(to, "a.txt")));
        File.WriteAllText(Path.Combine(to, "a.txt"), "changed");
        Assert.Equal("changed", File.ReadAllText(Path.Combine(dir, "a.txt")));
        // A shortcut: a .lnk file of its own.
        Assert.Null(Links.Make(Links.Shortcut, Path.Combine(dir, "a.txt"), Path.Combine(to, "a.txt - Shortcut.lnk")));
        Assert.True(new FileInfo(Path.Combine(to, "a.txt - Shortcut.lnk")).Length > 0);
        // A junction is to a folder; a symbolic link is made, or needs the helper (no developer mode).
        Assert.Equal("a junction is to a folder", Links.Make(Links.Junction, Path.Combine(dir, "a.txt"), Path.Combine(to, "x")));
        var symlink = Links.Make(Links.Symlink, Path.Combine(dir, "a.txt"), Path.Combine(to, "sym.txt"));
        Assert.True(symlink is null or "elevate", symlink);
    }

    [Fact]
    public void AHardLinkToAnotherDriveIsRefused()
    {
        var windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        if (string.Equals(Path.GetPathRoot(windows), Path.GetPathRoot(dir), StringComparison.OrdinalIgnoreCase)) return;   // one drive here
        Assert.Equal("a hard link is on the same drive as its file", Links.Make(Links.Hardlink, Path.Combine(windows, "win.ini"), Path.Combine(dir, "to", "win.ini")));
    }

    [Fact]
    public void TheClipboardsLinkSource()
    {
        var path = Path.Combine(dir, "folder");
        Assert.Equal((Links.Junction, path), Links.SourceOf(Links.SourceBytes(Links.Junction, path)));
        Assert.Null(Links.SourceOf(System.Text.Encoding.UTF8.GetBytes("nothing|" + path)));
        Assert.Null(Links.SourceOf(System.Text.Encoding.UTF8.GetBytes("no bar")));
        Assert.Null(Links.SourceOf(null));
    }

    // The helper's fixed set: anything else refused, paths only full; take ownership: one result per path, done or why
    // not (run here without the helper's rights it may be refused; elevated it is done: checked in the test copy).
    [Fact]
    public void TheHelperRefusesWhatIsNotItsAndTakesOwnership()
    {
        string Error(string line) => ElevatedHelper.Answer(line)["error"]?.GetValue<string>() ?? "";
        Assert.Equal("not an operation of the helper", Error("""{"op":"format","path":"C:\\"}"""));
        Assert.Equal("not a request", Error("not json"));
        Assert.Equal("list needs a full path", Error("""{"op":"list","path":"relative"}"""));
        Assert.Equal("takeOwnership needs full paths and the user", Error("""{"op":"takeOwnership","paths":["C:\\x"]}"""));
        Assert.Equal("takeOwnership needs full paths and the user", Error("""{"op":"takeOwnership","paths":["x"],"sid":"S-1-5-32-544"}"""));
        Assert.Equal("symlink needs a full path for the link and its target", Error("""{"op":"symlink","link":"x","target":"C:\\y"}"""));
        var file = Path.Combine(dir, "a.txt");
        var answer = ElevatedHelper.Answer(new JsonObject { ["op"] = "takeOwnership", ["paths"] = new JsonArray(file),
            ["sid"] = WindowsIdentity.GetCurrent().User!.Value }.ToJsonString());
        var failed = answer["failed"]!.AsArray();
        Assert.Equal(1, answer["done"]!.GetValue<int>() + failed.Count);
        Assert.All(failed, f => Assert.False(string.IsNullOrEmpty(f!["error"]?.GetValue<string>())));
    }
}
