namespace Foldex.Tests;

// The bookmarks in the page (docs/plans/executed/26-PLAN-bookmarks.md 3.2, 3.6): keys.js, actions.js and bookmarks.js in
// Jint, with what they need of the page stubbed. Every entry stands on its own: its keys are found by its id.
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
            var posted = [];
            var post = m => posted.push(m);
            if (typeof structuredClone === 'undefined') var structuredClone = x => JSON.parse(JSON.stringify(x));
            """);
        foreach (var f in new[] { "panes.js", "keys.js", "actions.js", "bookmarks.js" }) engine.Execute(File.ReadAllText(Path.Combine(Web, f)));
        // keys.json: Copy, a chord starting with Ctrl+K, and F6 on its own. C:\A is both a shortcut and a bookmark.
        engine.Execute("""
            setKeys({ keys: { 'Ctrl+C': 'item.copy', 'Ctrl+K, K': 'refresh', 'F6': 'pane.next', 'F7': 'file.new' }, order: ['Ctrl+C', 'Ctrl+K, K', 'F6', 'F7'], problems: [] });
            bookmarks = [
              { id: 'a', location: 'C:\\A', quickAccess: true, key: 'Ctrl+B, 1' },
              { id: 'm', location: 'C:\\M', name: 'Mine', keyNew: 'Ctrl+B, 2' },
              { id: 'b', location: 'C:\\B', quickAccess: true },
              { id: 'n', location: 'C:\\N' },
              { id: 'a2', location: 'C:\\A', name: 'Again', key: 'Ctrl+B, 3' },
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
        Assert.Equal("a|b", Eval(e, "quickAccessList().map(b => b.id).join('|')"));
        Assert.Equal("m|n|a2", Eval(e, "menuBookmarks().map(b => b.id).join('|')"));
        Assert.Equal("a2", Eval(e, @"bookmarkAt('c:\\a', false).id"));   // the same location, the menu's entry
    }

    [Fact]
    public void AnEntrysKeysAreInTheKeySetWithItsId()
    {
        var e = Page();
        Assert.Equal("bookmarks.open a", Eval(e, "keys.bindings.get('Ctrl+B, 1').join(' ')"));
        Assert.Equal("bookmarks.open a2", Eval(e, "keys.bindings.get('Ctrl+B, 3').join(' ')"));
        Assert.Equal("bookmarks.openNew m", Eval(e, "keys.bindings.get('Ctrl+B, 2').join(' ')"));
        Assert.Equal("true", Eval(e, "keys.prefixes.has('Ctrl+B')"));
        Assert.Equal("Ctrl+B, 1", Eval(e, "keyText('bookmarks.open', 'a')"));
    }

    [Fact]
    public void TheClashesAreFoundAndNamed()
    {
        var e = Page();
        // A key bound in keys.json.
        Assert.Equal("Ctrl+C is Copy; Copy then has no key.", Eval(e, "keyClashes('Ctrl+C', 'n').join(' / ')"));
        // A single key that starts a chord.
        Assert.Contains("Ctrl+K starts Ctrl+K, K (Refresh)", Eval(e, "keyClashes('Ctrl+K', 'n').join(' / ')"));
        // A chord whose first key is bound on its own.
        Assert.Contains("F6 is Next pane on its own", Eval(e, "keyClashes('F6, 1', 'n').join(' / ')"));
        // Another entry's key, by its name; another entry of the same location too.
        Assert.Contains("Ctrl+B, 2 is the bookmark Mine", Eval(e, "keyClashes('Ctrl+B, 2', 'n').join(' / ')"));
        Assert.Contains("Ctrl+B, 1 is the bookmark A", Eval(e, "keyClashes('Ctrl+B, 1', 'a2').join(' / ')"));
        // Its own key is no clash; a free one neither.
        Assert.Equal("", Eval(e, "keyClashes('Ctrl+B, 1', 'a').join(' / ')"));
        Assert.Equal("", Eval(e, "keyClashes('Ctrl+B, 9', null).join(' / ')"));
    }

    [Fact]
    public void ABookmarksKeyOverAKeysJsonKeyRunsTheBookmark()
    {
        var e = Page();
        e.Execute(@"bookmarks[3].key = 'Ctrl+C'; bookmarks[2].key = 'Ctrl+K'; bookmarks[1].key = 'F7, 1'; buildKeys();");
        Assert.Equal("bookmarks.open n", Eval(e, "keys.bindings.get('Ctrl+C').join(' ')"));
        Assert.Equal("", Eval(e, "keyText('item.copy')"));   // F1: Copy has no key
        Assert.Equal("false", Eval(e, "keys.bindings.has('Ctrl+K, K')"));   // the chord Ctrl+K started is gone
        Assert.Equal("false", Eval(e, "keys.prefixes.has('Ctrl+K')"));
        Assert.Equal("false", Eval(e, "keys.bindings.has('F7')"));   // F7 now only starts the bookmark's chord
        Assert.Equal("true", Eval(e, "keys.prefixes.has('F7')"));
    }

    // Folders (docs/plans/executed/27-PLAN-bookmark-folders.md 3.1, 3.4).
    static Jint.Engine WithFolders()
    {
        var e = Page();
        e.Execute("""
            bookmarks = [
              { id: 'p', folder: 'Projects', items: [
                { id: 'l', location: 'C:\\LexPen', key: 'Ctrl+B, 7' },
                { id: 'c', folder: 'Clients', items: [{ id: 'aa', location: 'C:\\ActiveAnts', keyNew: 'Ctrl+B, 8' }] },
              ] },
              { id: 'f', location: 'C:\\Foldex' },
              { id: 'q', location: 'C:\\Q', quickAccess: true },
            ];
            buildKeys();
            """);
        return e;
    }

    static string Tree(Jint.Engine e) => Eval(e, "bookmarkPlaces().map(p => '  '.repeat(p.depth) + p.b.id + (p.quick ? '*' : '')).join('|')");

    [Fact]
    public void TheKeysOfBookmarksInFoldersAtAnyDepthAreInTheKeySet()
    {
        var e = WithFolders();
        Assert.Equal("bookmarks.open l", Eval(e, "keys.bindings.get('Ctrl+B, 7').join(' ')"));
        Assert.Equal("bookmarks.openNew aa", Eval(e, "keys.bindings.get('Ctrl+B, 8').join(' ')"));
        Assert.Equal("l|aa|f|q", Eval(e, "actionDef('bookmarks.open').variants.map(v => v[0]).join('|')"));   // folders are no variants
    }

    [Fact]
    public void AnEntryMovesIntoAFolderBetweenRowsAndAFolderNotIntoItself()
    {
        var e = WithFolders();
        // Into Clients, at its end.
        Assert.Equal("true", Eval(e, "moveBookmarkTo('f', 'c', false, Infinity)"));
        Assert.Equal("p|  l|  c|    aa|    f|q*", Tree(e));
        // Between LexPen and Clients (at 1 in Projects).
        Assert.Equal("true", Eval(e, "moveBookmarkTo('f', 'p', false, 1)"));
        Assert.Equal("p|  l|  f|  c|    aa|q*", Tree(e));
        // Moved down within its folder: counted as the list was.
        Assert.Equal("true", Eval(e, "moveBookmarkTo('l', 'p', false, 2)"));
        Assert.Equal("p|  f|  l|  c|    aa|q*", Tree(e));
        // A folder into itself or into one inside it: refused, nothing changes.
        Assert.Equal("false", Eval(e, "moveBookmarkTo('p', 'c', false, 0)"));
        Assert.Equal("false", Eval(e, "moveBookmarkTo('p', 'p', false, 0)"));
        // Out to the other tab's top: it and what it holds on quick access.
        Assert.Equal("true", Eval(e, "moveBookmarkTo('c', null, true, Infinity)"));
        Assert.Equal("p|  f|  l|q*|c*|  aa*", Tree(e));
        Assert.Equal("bookmarksSet", Eval(e, "posted.at(-1).op"));
    }

    [Fact]
    public void TheTopOfEachTabTakesItsFoldersInListOrder()
    {
        var e = WithFolders();
        Assert.Equal("p|f", Eval(e, "menuBookmarks().map(b => b.id).join('|')"));
        Assert.Equal("q", Eval(e, "quickAccessList().map(b => b.id).join('|')"));
        Assert.Equal("aa", Eval(e, @"bookmarkAt('c:\\activeants', false).id"));
        Assert.Equal("Clients", Eval(e, "bookmarkName(bookmarkById('c'))"));
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
    public void F1ListsEveryEntryWithItsKeys()
    {
        var e = Page();
        Assert.Equal("a|m|b|n|a2", Eval(e, "actionDef('bookmarks.open').variants.map(v => v[0]).join('|')"));
        Assert.Equal("Open Mine", Eval(e, "actionTitle('bookmarks.open', ['m'])"));
        Assert.Equal("Open A (quick access)", Eval(e, "actionTitle('bookmarks.open', ['a'])"));
    }
}
