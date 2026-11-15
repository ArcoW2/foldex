using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// The bookmarks, quick access among them (docs/plans/executed/26-PLAN-bookmarks.md 3.1, 3.5): Bookmarks, ShellIcons.FromFile.
public class BookmarksTests
{
    static Bookmark B(string location, bool quick = false, string id = "") => new() { Id = id, Location = location, QuickAccess = quick };

    static string TempDir() => Path.Combine(Path.GetTempPath(), "foldex-bookmarks-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void ALocationCanComeMoreThanOnceEachEntryWithAnIdOfItsOwn()
    {
        var list = Bookmarks.Clean([B(@"C:\A", id: "a1"), B(@"c:\a\", true), B(@"C:\A"), B(""), B(@"D:\B", id: "a1")]);
        Assert.Equal([@"C:\A", @"c:\a\", @"C:\A", @"D:\B"], list.Select(b => b.Location));   // only the empty one out
        Assert.Equal("a1", list[0].Id);
        Assert.Equal(4, list.Select(b => b.Id).Distinct().Count());   // none, or one that came before: a new id
        Assert.All(list, b => Assert.False(string.IsNullOrEmpty(b.Id)));
    }

    [Fact]
    public void AKnownFolderIsTheSameByItsShellNameAndItsPath()
    {
        var downloads = Bookmarks.Resolve("shell:Downloads");
        Assert.NotEqual("shell:Downloads", downloads);   // Windows knows where it is
        Assert.True(Bookmarks.Same("shell:Downloads", downloads));
        Assert.Equal("shell:Downloads", Bookmarks.Known(downloads));
    }

    [Fact]
    public void AnEntryIsKeptWithAllItHasAndReadBack()
    {
        var dir = TempDir();
        try
        {
            Bookmarks.Save(dir, [
                new Bookmark { Id = "x1", Location = @"C:\A\b.txt", Item = true, QuickAccess = true, Name = "Notes", Icon = @"%SystemRoot%\System32\SHELL32.dll,4", Key = "Ctrl+B, 1", KeyNew = "Ctrl+B, Shift+1", Root = true },
                new Bookmark { Location = @"D:\C", Key = "Ctrl+Alt+1" },
            ]);
            var back = Bookmarks.Load(dir)!;
            Assert.Equal(2, back.Count);
            var a = back[0];
            Assert.Equal(("x1", @"C:\A\b.txt", true, true, "Notes", @"%SystemRoot%\System32\SHELL32.dll,4", "Ctrl+B, 1", "Ctrl+B, Shift+1", true),
                (a.Id, a.Location, a.Item, a.QuickAccess, a.Name, a.Icon, a.Key, a.KeyNew, a.Root));
            var c = back[1];
            Assert.Equal((false, false, null, null, "Ctrl+Alt+1", null, false), (c.Item, c.QuickAccess, c.Name, c.Icon, c.Key, c.KeyNew, c.Root));
            // Only what is set is written (an id given when it had none).
            var written = JsonNode.Parse(File.ReadAllText(Path.Combine(dir, Bookmarks.FileName)), documentOptions: new() { CommentHandling = System.Text.Json.JsonCommentHandling.Skip })!;
            Assert.Equal(["id", "location", "key"], written["bookmarks"]![1]!.AsObject().Select(p => p.Key));
            Assert.Equal(c.Id, written["bookmarks"]![1]!["id"]!.GetValue<string>());
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void AnEmptyNameAndTheLocationsOwnNameAreNotKept()
    {
        var list = Bookmarks.Clean([new Bookmark { Location = @"C:\Work\Docs", Name = "Docs" }, new Bookmark { Location = @"C:\X", Name = " " },
            new Bookmark { Location = @"C:\Y", Name = "Mine" }]);
        Assert.Equal([null, null, "Mine"], list.Select(b => b.Name));
    }

    [Fact]
    public void AFileThatCannotBeReadIsEmptyAndNoFileIsNull()
    {
        var dir = TempDir();
        try
        {
            Assert.Null(Bookmarks.Load(dir));
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, Bookmarks.FileName), "{ broken");
            Assert.Equal([], Bookmarks.Load(dir));
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void ThePlan23ListsAreTakenOverOnce()
    {
        var dir = TempDir();
        try
        {
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, "quickaccess.json"), """{ "folders": ["C:\\A", "C:\\B"] }""");
            File.WriteAllText(Path.Combine(dir, "favourite-folders.json"), """{ "folders": ["C:\\b", "D:\\F"] }""");
            var asked = false;
            var list = Bookmarks.Start(dir, () => { asked = true; return []; });
            Assert.False(asked);   // Explorer is asked only without both
            // A folder in both: on both tabs.
            Assert.Equal([(@"C:\A", true), (@"C:\B", true), (@"C:\b", false), (@"D:\F", false)], list.Select(b => (b.Location, b.QuickAccess)));
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void WithoutAnyListExplorersPinnedFoldersAreQuickAccess()
    {
        var dir = TempDir();
        var list = Bookmarks.Start(dir, () => [@"C:\P", @"C:\Q"]);
        Assert.Equal([(@"C:\P", true), (@"C:\Q", true)], list.Select(b => (b.Location, b.QuickAccess)));
        Assert.False(Directory.Exists(dir));   // not written here
    }

    [Fact]
    public void ToQuickAccessPutsItAmongTheShortcutsAndKeepsTheMenusPlaces()
    {
        List<Bookmark> list = [B(@"C:\A", true, "a"), B(@"C:\M", false, "m"), B(@"C:\B", true, "b"), B(@"C:\C", true, "c")];
        string Order(List<Bookmark> l) => string.Join(" ", l.Select(b => (b.QuickAccess ? "q" : "m") + b.Location[3..]));
        Assert.Equal(@"qX qA mM qB qC", Order(Bookmarks.ToQuickAccess(list, @"C:\X", false, 0)));
        Assert.Equal(@"qA mM qB qC qX", Order(Bookmarks.ToQuickAccess(list, @"C:\X", false, int.MaxValue)));
        // A dragged within the area (dropped before C): B, A, C; the menu's M stays where it is.
        Assert.Equal(@"mM qB qA qC", Order(Bookmarks.ToQuickAccess(list, @"C:\A", false, 2, "a")));
        // A folder dropped from elsewhere, one there already or a bookmark of the menu: another shortcut.
        var again = Bookmarks.ToQuickAccess(list, @"C:\M", false, 1);
        Assert.Equal(@"qA mM qM qB qC", Order(again));
        Assert.Equal("m", again[1].Id);
        Assert.NotEqual("m", again[2].Id);
    }

    [Fact]
    public void AddingMakesAnotherEntryAndRemoveFromTakesOneTabsOnly()
    {
        List<Bookmark> list = [new Bookmark { Id = "a", Location = @"C:\A", Name = "Mine", Key = "Ctrl+B, 1" }, B(@"C:\B", true, "b")];
        var added = Bookmarks.Add(list, @"c:\a", false, true);
        Assert.Equal(3, added.Count);
        Assert.Equal((@"c:\a", true, null, null), (added[2].Location, added[2].QuickAccess, added[2].Name, added[2].Key));
        Assert.NotEqual("a", added[2].Id);
        Assert.Equal((@"C:\F.txt", true), (Bookmarks.Add(list, @"C:\F.txt", true, false)[^1].Location, Bookmarks.Add(list, @"C:\F.txt", true, false)[^1].Item));
        // Remove from quick access: its shortcuts of C:\A go, the bookmark of the menu stays.
        Assert.Equal(["a", "b"], Bookmarks.RemoveFrom(added, @"C:\A", true).Select(b => b.Id));
        Assert.Equal([added[1].Id, added[2].Id], Bookmarks.RemoveFrom(added, @"C:\A", false).Select(b => b.Id));
    }

    [Fact]
    public void AnEntryFromThePageTakesAPlainLocationToo()
    {
        Assert.Equal(@"C:\A", Bookmark.From(JsonValue.Create(@"C:\A"))!.Location);
        Assert.Null(Bookmark.From(new JsonObject { ["name"] = "no location" }));
        var b = Bookmark.From(new JsonObject { ["id"] = "k9", ["location"] = @"C:\A", ["key"] = "Ctrl+B, 2", ["root"] = true })!;
        Assert.Equal(("k9", "Ctrl+B, 2", (string?)null, true), (b.Id, b.Key, b.KeyNew, b.Root));
    }

    [Fact]
    public void TheIconsOfShell32AreReadAndAFileWithoutIconsHasNone()
    {
        var icons = ShellIcons.AllFromFile(@"%SystemRoot%\System32\SHELL32.dll");
        Assert.NotEmpty(icons);
        Assert.All(icons.Take(5), url => Assert.StartsWith("data:image/png;base64,", url));
        Assert.Equal(icons[3], ShellIcons.FromFile(@"%SystemRoot%\System32\SHELL32.dll", 3));
        var text = Path.GetTempFileName();
        try { Assert.Empty(ShellIcons.AllFromFile(text)); }
        finally { File.Delete(text); }
        Assert.Empty(ShellIcons.AllFromFile(@"C:\not\there.dll"));
    }
}
