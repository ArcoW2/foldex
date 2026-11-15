using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// The bookmarks, quick access among them (docs/plans/executed/26-PLAN-bookmarks.md 3.1, 3.5): Bookmarks, ShellIcons.FromFile.
public class BookmarksTests
{
    static Bookmark B(string location, bool quick = false) => new() { Location = location, QuickAccess = quick };

    static string TempDir() => Path.Combine(Path.GetTempPath(), "foldex-bookmarks-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void ALocationIsKeptOnceInAnyCase()
    {
        Assert.Equal([@"C:\A", @"D:\B"], Bookmarks.Unique([B(@"C:\A"), B(@"c:\a\"), B(@"D:\B"), B(""), B(@"C:\A")]).Select(b => b.Location));
    }

    [Fact]
    public void AKnownFolderIsTheSameByItsShellNameAndItsPath()
    {
        var downloads = Bookmarks.Resolve("shell:Downloads");
        Assert.NotEqual("shell:Downloads", downloads);   // Windows knows where it is
        Assert.True(Bookmarks.Same("shell:Downloads", downloads));
        Assert.Equal("shell:Downloads", Bookmarks.Known(downloads));
        Assert.Single(Bookmarks.Unique([B("shell:Downloads"), B(downloads)]));
    }

    [Fact]
    public void AnEntryIsKeptWithAllItHasAndReadBack()
    {
        var dir = TempDir();
        try
        {
            Bookmarks.Save(dir, [
                new Bookmark { Location = @"C:\A\b.txt", Item = true, QuickAccess = true, Name = "Notes", Icon = @"%SystemRoot%\System32\SHELL32.dll,4", Key = "Ctrl+B, 1", KeyNew = "Ctrl+B, Shift+1", Root = true },
                new Bookmark { Location = @"D:\C", Key = "Ctrl+Alt+1" },
            ]);
            var back = Bookmarks.Load(dir)!;
            Assert.Equal(2, back.Count);
            var a = back[0];
            Assert.Equal((@"C:\A\b.txt", true, true, "Notes", @"%SystemRoot%\System32\SHELL32.dll,4", "Ctrl+B, 1", "Ctrl+B, Shift+1", true),
                (a.Location, a.Item, a.QuickAccess, a.Name, a.Icon, a.Key, a.KeyNew, a.Root));
            var c = back[1];
            Assert.Equal((false, false, null, null, "Ctrl+Alt+1", null, false), (c.Item, c.QuickAccess, c.Name, c.Icon, c.Key, c.KeyNew, c.Root));
            // Only what is set is written.
            var written = JsonNode.Parse(File.ReadAllText(Path.Combine(dir, Bookmarks.FileName)), documentOptions: new() { CommentHandling = System.Text.Json.JsonCommentHandling.Skip })!;
            Assert.Equal(["location", "key"], written["bookmarks"]![1]!.AsObject().Select(p => p.Key));
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void AnEmptyNameAndTheLocationsOwnNameAreNotKept()
    {
        var list = Bookmarks.Unique([new Bookmark { Location = @"C:\Work\Docs", Name = "Docs" }, new Bookmark { Location = @"C:\X", Name = " " },
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
            Assert.Equal([(@"C:\A", true), (@"C:\B", true), (@"D:\F", false)], list.Select(b => (b.Location, b.QuickAccess)));
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
        List<Bookmark> list = [B(@"C:\A", true), B(@"C:\M"), B(@"C:\B", true), B(@"C:\C", true)];
        string Order(List<Bookmark> l) => string.Join(" ", l.Select(b => (b.QuickAccess ? "q" : "m") + b.Location[3..]));
        Assert.Equal(@"qX qA mM qB qC", Order(Bookmarks.ToQuickAccess(list, @"C:\X", false, 0)));
        Assert.Equal(@"qA mM qB qC qX", Order(Bookmarks.ToQuickAccess(list, @"C:\X", false, int.MaxValue)));
        // A moved down (dropped before C): B, A, C; the menu's M stays where it is.
        Assert.Equal(@"mM qB qA qC", Order(Bookmarks.ToQuickAccess(list, @"C:\A", false, 2)));
        // A bookmark of the menu dropped on the area: gets the flag, keeps the rest.
        list[1].Name = "Mine";
        var flagged = Bookmarks.ToQuickAccess(list, @"C:\M", false, 1);
        Assert.Equal(@"qA qM qB qC", Order(flagged));
        Assert.Equal("Mine", flagged[1].Name);
    }

    [Fact]
    public void AddingKeepsOneThereAndOnlyGivesItTheFlag()
    {
        List<Bookmark> list = [new Bookmark { Location = @"C:\A", Name = "Mine", Key = "Ctrl+B, 1" }, B(@"C:\B")];
        Assert.Same(list, Bookmarks.Add(list, @"c:\a", false, false));
        var flagged = Bookmarks.Add(list, @"C:\A", false, true);
        Assert.Equal((true, "Mine", "Ctrl+B, 1"), (flagged[0].QuickAccess, flagged[0].Name, flagged[0].Key));
        Assert.Equal(0, flagged.FindIndex(b => b.Location == @"C:\A"));   // its place kept
        var added = Bookmarks.Add(list, @"C:\F.txt", true, false);
        Assert.Equal((@"C:\F.txt", true, false), (added[^1].Location, added[^1].Item, added[^1].QuickAccess));
    }

    [Fact]
    public void AnEntryFromThePageTakesAPlainLocationToo()
    {
        Assert.Equal(@"C:\A", Bookmark.From(JsonValue.Create(@"C:\A"))!.Location);
        Assert.Null(Bookmark.From(new JsonObject { ["name"] = "no location" }));
        var b = Bookmark.From(new JsonObject { ["location"] = @"C:\A", ["key"] = "Ctrl+B, 2", ["root"] = true })!;
        Assert.Equal(("Ctrl+B, 2", (string?)null, true), (b.Key, b.KeyNew, b.Root));
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
