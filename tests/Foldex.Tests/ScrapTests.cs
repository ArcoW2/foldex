using System.Text.Json;
using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// Search and scrap (docs/plans/executed/06-PLAN-search-and-scrap.md): the host's search and entries, and web/scraps.js and
// web/panes.js under Jint.
public class ScrapTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-scrap-" + Guid.NewGuid().ToString("N"));

    public ScrapTests()
    {
        foreach (var f in new[] { @"a\one.txt", @"a\two.md", @"b\three.txt", @"b\sub\bru.txt", @"b\sub\brunch.log", @"c\brown.txt" })
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.Combine(dir, f))!);
            File.WriteAllText(Path.Combine(dir, f), "x");
        }
    }

    public void Dispose() => Directory.Delete(dir, true);

    static FileSearch.Options Opts(string named, string? lookIn = null, bool regex = false, int fuzzy = 100, bool files = true,
        bool folders = true, bool subfolders = true, bool depthFirst = true, IReadOnlyList<string>? within = null) =>
        new(lookIn, within, subfolders, depthFirst, false, files, folders, regex, fuzzy, named);

    static string[] Pass(FileSearch.Options o, params string[] names) => names.Where(FileSearch.NameTest(o)).ToArray();

    [Fact]
    public void ANameWithoutWildcardsIsFoundInsideOneWithThemIsTheWholeName()
    {
        Assert.Equal(["bru.txt", "Brunch.log"], Pass(Opts("bru"), "bru.txt", "Brunch.log", "brown.txt"));
        Assert.Equal(["bru.txt", "brown.txt"], Pass(Opts("*.txt"), "bru.txt", "Brunch.log", "brown.txt"));
        Assert.Equal(["bru.txt", "Brunch.log"], Pass(Opts("*.txt; *.log"), "bru.txt", "Brunch.log", "two.md").Take(2).ToArray());
        Assert.Equal(["a", "b"], Pass(Opts(""), "a", "b"));
    }

    [Fact]
    public void ARegularExpressionIsFoundAnywhereInTheName()
    {
        Assert.Equal(["bru.txt", "brown.txt"], Pass(Opts(@"^b.*\.txt$", regex: true), "bru.txt", "Brunch.log", "brown.txt", "abc.txt"));
        Assert.Throws<ArgumentException>(() => FileSearch.NameTest(Opts("(", regex: true)));
    }

    [Fact]
    public void FuzzyIsHowCloseThePatternIsFoundInTheName()
    {
        Assert.Equal(100, FileSearch.Similarity("bru", "Brunch.log"));
        Assert.Equal(66, FileSearch.Similarity("bru", "brown.txt"));   // one letter of three changed: 100 - 34
        Assert.Equal(0, FileSearch.Similarity("bru", "zzz"));
        Assert.Equal(["bru.txt", "brown.txt"], Pass(Opts("bru", fuzzy: 60), "bru.txt", "brown.txt", "zzz.md"));
        Assert.Equal(["bru.txt"], Pass(Opts("bru", fuzzy: 90), "bru.txt", "brown.txt", "zzz.md"));
    }

    [Fact]
    public void TheWalkGoesDepthOrBreadthFirst()
    {
        var depth = new List<string>();
        FileSearch.Walk(dir, true, true, i => depth.Add(i.Name), default);
        Assert.True(depth.IndexOf("bru.txt") < depth.IndexOf("brown.txt"));     // into b's sub before c's files
        var breadth = new List<string>();
        FileSearch.Walk(dir, true, false, i => breadth.Add(i.Name), default);
        Assert.True(breadth.IndexOf("brown.txt") < breadth.IndexOf("bru.txt"));  // c's files before b\sub's
    }

    [Fact]
    public async Task ASearchFindsFilesAndFoldersAsAskedAndOnlyInTheScrapWhenGivenOne()
    {
        async Task<string> Names(FileSearch.Options o)
        {
            var found = new List<string>();
            var (engine, count) = await StaWorker.Once("t", () => FileSearch.Run(o, part => found.AddRange(part.Select(e => e!["name"]!.GetValue<string>())), default));
            Assert.Equal(count, found.Count);
            return engine + ":" + string.Join(",", found.Order());
        }
        Assert.Equal("walk:bru.txt,brunch.log", await Names(Opts("bru", dir)));
        Assert.Equal("walk:b,sub", await Names(Opts("", dir, regex: true, files: false) with { Named = "^(b|sub)$" }));
        Assert.Equal("walk:", await Names(Opts("bru", dir, subfolders: false)));
        // In a scrap: its own items only, a folder not looked into.
        Assert.Equal("scrap:bru.txt", await Names(Opts("bru", within: [Path.Combine(dir, @"b\sub\bru.txt"), Path.Combine(dir, "b"), Path.Combine(dir, @"a\one.txt")])));
        await Assert.ThrowsAsync<ArgumentException>(() => Names(Opts("x", Path.Combine(dir, "nothere"))));
    }

    [Fact]
    public async Task EntriesAreGivenForItemsThereAndLeftOutForItemsGone()
    {
        var entries = await StaWorker.Once("t", () => ShellListing.Entries([Path.Combine(dir, @"a\one.txt"), Path.Combine(dir, "b"), Path.Combine(dir, "gone.txt")]));
        Assert.Equal(["one.txt", "b"], entries.Select(e => e!["name"]!.GetValue<string>()));
        Assert.Equal(Path.Combine(dir, "a"), entries[0]!["path"]!.GetValue<string>());
        Assert.True(entries[1]!["folder"]!.GetValue<bool>());
    }

    [Fact]
    public void SearchesFileKeepsWhatItKnowsAndSurvivesABrokenFile()
    {
        Assert.Equal("{\"predefined\":{},\"lookIn\":[],\"named\":[]}", SearchesFile.Load(dir).ToJsonString());
        SearchesFile.Save(dir, JsonNode.Parse("""{ "predefined": { "logs": { "named": "*.log" } }, "lookIn": ["C:\\x", 3], "other": 1 }""")!);
        Assert.Equal("{\"predefined\":{\"logs\":{\"named\":\"*.log\"}},\"lookIn\":[\"C:\\\\x\"],\"named\":[]}", SearchesFile.Load(dir).ToJsonString());
        SearchesFile.Save(dir, JsonNode.Parse("""{ "named": ["*.txt"], "last": { "named": "*.txt", "regex": true }, "other": 1 }""")!);
        Assert.Equal("{\"predefined\":{},\"lookIn\":[],\"named\":[\"*.txt\"],\"last\":{\"named\":\"*.txt\",\"regex\":true}}", SearchesFile.Load(dir).ToJsonString());
        File.WriteAllText(Path.Combine(dir, SearchesFile.Name), "{ broken");
        Assert.Equal("{\"predefined\":{},\"lookIn\":[],\"named\":[]}", SearchesFile.Load(dir).ToJsonString());
    }

    // ---------- web/scraps.js, web/panes.js, web/docks.js ----------

    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;

    static JsonElement Js(string expr)
    {
        var engine = new Jint.Engine();
        foreach (var f in new[] { "panes.js", "docks.js", "scraps.js" }) engine.Execute(File.ReadAllText(Path.Combine(Web, f)));
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void ItemsAreAddedOnceInTheScrapsOrder()
    {
        var r = Js("""
            scrapMerge([{ id: 'C:\\b.txt' }], [{ id: 'C:\\A.txt' }, { id: 'c:\\B.TXT' }, { id: 'C:\\c.txt' }, { id: 'C:\\a.txt' }],
              (x, y) => x.id.toLowerCase() < y.id.toLowerCase() ? -1 : 1).map(x => x.id)
            """);
        Assert.Equal("""["C:\\A.txt","C:\\b.txt","C:\\c.txt"]""", r.GetRawText());
    }

    [Fact]
    public void EntriesFollowAMoveOfThemselvesOrOfAFolderAboveThem()
    {
        var r = Js("""scrapFollow(['C:\\x\\a.txt', 'C:\\x\\sub\\b.txt', 'C:\\y\\c.txt'], [['C:\\x\\a.txt', 'D:\\a.txt'], ['c:\\X\\sub', 'D:\\moved']])""");
        Assert.Equal("""["D:\\a.txt","D:\\moved\\b.txt","C:\\y\\c.txt"]""", r.GetRawText());
    }

    [Fact]
    public void NamesAreUniqueAndANewScrapTakesTheFirstFreeNumber()
    {
        var r = Js("[scrapName('bru', ['Bru', 'bru (2)']), scrapName('x', ['bru']), newScrapName(['Scrap 1', 'scrap 3'])]");
        Assert.Equal("""["bru (3)","x","Scrap 2"]""", r.GetRawText());
    }

    [Fact]
    public void ItemsOfOneFolderGetExplorersMenu()
    {
        var r = Js("""[oneFolder(['C:\\x\\a', 'c:\\X\\b']), oneFolder(['C:\\x\\a', 'C:\\y\\b']), oneFolder([]), folderOf('C:\\a.txt'), folderOf('C:\\x\\')]""");
        Assert.Equal("""[true,false,false,"C:\\","C:\\"]""", r.GetRawText());
    }

    [Fact]
    public void AfterARestartAScrapInThePanesGoesADockedOrPinnedOneStays()
    {
        var r = Js("""
            (() => {
              const l = new Layout(), d = new Docks();
              const tree = l.add({ kind: 'tree' }), mini = l.add({ kind: 'scrap' }), found = l.add({ kind: 'scrap' }), kept = l.add({ kind: 'scrap' });
              l.pane(kept).pinned = true;
              d.add(tree, { area: 'left' }); d.add(mini, { area: 'right' }); d.add(found, { area: 'center' }); d.add(kept, { area: 'center' });
              return scrapsAfterRestart([...l.panes.values()], id => d.areaOf(id));
            })()
            """);
        Assert.Equal("""{"remove":["p3"],"empty":["p2","p4"]}""", r.GetRawText());
    }

    [Fact]
    public void AScrapIsAParentButNeverAChildAndItsChildGoesItsOwnWay()
    {
        var r = Js("""
            (() => {
              const l = new Layout();
              const s = l.add({ kind: 'scrap' }), list = l.add({ kind: 'list' }), child = l.add({ source: s });
              const shown = l.focus(s, { id: 'C:\\x', folder: true });
              return [l.connect(s, list), l.pane(s).source, shown, l.ownWay(child), l.historyPane(child) === child,
                l.execute(child, { id: 'C:\\x\\y', folder: true }).reveal];
            })()
            """);
        Assert.Equal("""[false,null,[{"pane":"p3","location":"C:\\x"}],true,true,{"pane":"p3","item":"C:\\x\\y"}]""", r.GetRawText());
    }
}
