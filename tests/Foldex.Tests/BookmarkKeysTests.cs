namespace Foldex.Tests;

// The bookmarks in the page (docs/plans/executed/26-PLAN-bookmarks.md 3.2, 3.6): keys.js, actions.js and bookmarks.js in Jint,
// with what they need of the page stubbed.
public class BookmarkKeysTests
{
    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;

    static Jint.Engine Page()
    {
        var engine = new Jint.Engine();
        engine.Execute("""
            var document = { addEventListener() {} };
            var status = () => {};
            var same = (a, b) => a != null && b != null && a.toLowerCase() === b.toLowerCase();
            """);
        foreach (var f in new[] { "panes.js", "keys.js", "actions.js", "bookmarks.js" }) engine.Execute(File.ReadAllText(Path.Combine(Web, f)));
        // keys.json: Copy, a chord starting with Ctrl+K, and F6 on its own.
        engine.Execute("""
            setKeys({ keys: { 'Ctrl+C': 'item.copy', 'Ctrl+K, K': 'refresh', 'F6': 'pane.next', 'F7': 'file.new' }, order: ['Ctrl+C', 'Ctrl+K, K', 'F6', 'F7'], problems: [] });
            bookmarks = [
              { location: 'C:\\A', quickAccess: true, key: 'Ctrl+B, 1' },
              { location: 'C:\\M', name: 'Mine', keyNew: 'Ctrl+B, 2' },
              { location: 'C:\\B', quickAccess: true },
              { location: 'C:\\N' },
            ];
            buildKeys();
            """);
        return engine;
    }

    static string Eval(Jint.Engine e, string js) => e.Evaluate(js).ToString();

    [Fact]
    public void TheAreaAndTheMenuEachTakeTheirEntriesInListOrder()
    {
        var e = Page();
        Assert.Equal(@"C:\A|C:\B", Eval(e, "quickAccessList().map(b => b.location).join('|')"));
        Assert.Equal(@"C:\M|C:\N", Eval(e, "menuBookmarks().map(b => b.location).join('|')"));
    }

    [Fact]
    public void ABookmarksKeysAreInTheKeySetWithItsLocation()
    {
        var e = Page();
        Assert.Equal(@"bookmarks.open C:\A", Eval(e, "keys.bindings.get('Ctrl+B, 1').join(' ')"));
        Assert.Equal(@"bookmarks.openNew C:\M", Eval(e, "keys.bindings.get('Ctrl+B, 2').join(' ')"));
        Assert.Equal("true", Eval(e, "keys.prefixes.has('Ctrl+B')"));
        Assert.Equal("Ctrl+B, 1", Eval(e, @"keyText('bookmarks.open', 'C:\\A')"));
    }

    [Fact]
    public void TheClashesAreFoundAndNamed()
    {
        var e = Page();
        // A key bound in keys.json.
        Assert.Equal("Ctrl+C is Copy; Copy then has no key.", Eval(e, @"keyClashes('Ctrl+C', 'C:\\N', 'C:\\N').join(' / ')"));
        // A single key that starts a chord.
        Assert.Contains("Ctrl+K starts Ctrl+K, K (Refresh)", Eval(e, @"keyClashes('Ctrl+K', 'C:\\N', 'C:\\N').join(' / ')"));
        // A chord whose first key is bound on its own.
        Assert.Contains("F6 is Next pane on its own", Eval(e, @"keyClashes('F6, 1', 'C:\\N', 'C:\\N').join(' / ')"));
        // Another bookmark's key, by that bookmark's name.
        Assert.Contains("Ctrl+B, 2 is the bookmark Mine", Eval(e, @"keyClashes('Ctrl+B, 2', 'C:\\N', 'C:\\N').join(' / ')"));
        // Its own key is no clash; a free one neither.
        Assert.Equal("", Eval(e, @"keyClashes('Ctrl+B, 1', 'C:\\A', 'C:\\A').join(' / ')"));
        Assert.Equal("", Eval(e, @"keyClashes('Ctrl+B, 9', null, 'C:\\X').join(' / ')"));
    }

    [Fact]
    public void ABookmarksKeyOverAKeysJsonKeyRunsTheBookmark()
    {
        var e = Page();
        e.Execute(@"bookmarks[3].key = 'Ctrl+C'; bookmarks[2].key = 'Ctrl+K'; bookmarks[1].key = 'F7, 1'; buildKeys();");
        Assert.Equal(@"bookmarks.open C:\N", Eval(e, "keys.bindings.get('Ctrl+C').join(' ')"));
        Assert.Equal("", Eval(e, "keyText('item.copy')"));   // F1: Copy has no key
        Assert.Equal("false", Eval(e, "keys.bindings.has('Ctrl+K, K')"));   // the chord Ctrl+K started is gone
        Assert.Equal("false", Eval(e, "keys.prefixes.has('Ctrl+K')"));
        Assert.Equal("false", Eval(e, "keys.bindings.has('F7')"));   // F7 now only starts the bookmark's chord
        Assert.Equal("true", Eval(e, "keys.prefixes.has('F7')"));
    }

    [Fact]
    public void TheOldActionNamesStillRun()
    {
        var e = Page();
        Assert.Equal("bookmarks.menu|bookmarks.add|bookmarks.manage",
            Eval(e, "['favourites.menu', 'favourites.add', 'favourites.manage'].map(n => isAction(n) && actionDef(n).name).join('|')"));
        Assert.Equal("Bookmarks", Eval(e, "actionTitle('favourites.menu')"));
    }

    [Fact]
    public void F1ListsEveryBookmarkWithItsKeys()
    {
        var e = Page();
        Assert.Equal(@"C:\A|C:\M|C:\B|C:\N", Eval(e, "actionDef('bookmarks.open').variants.map(v => v[0]).join('|')"));
        Assert.Equal("Open Mine", Eval(e, @"actionTitle('bookmarks.open', ['C:\\M'])"));
    }
}
