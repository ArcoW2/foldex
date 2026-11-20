using System.Text.Json;
using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// Filter results in the folder cache (docs/plans/executed/36-PLAN-filter-results-in-cache.md): the host's engine (filters.js run
// by Jint) as the page's; results kept per item and key, gone with a change on disk and with F5, let go for a changed
// filter; a tree's "holds a pass"; the filter's id and key in the page (filters.js filterKey).
public class FilterResultsTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-filter-" + Guid.NewGuid().ToString("N"));

    public FilterResultsTests()
    {
        Directory.CreateDirectory(Path.Combine(dir, "logs", "old"));
        Directory.CreateDirectory(Path.Combine(dir, "docs", "deep", "deeper"));
        Directory.CreateDirectory(Path.Combine(dir, "empty"));
        File.WriteAllText(Path.Combine(dir, "a.txt"), "a");
        File.WriteAllText(Path.Combine(dir, "b.log"), "bb");
        File.WriteAllText(Path.Combine(dir, "logs", "old", "c.log"), "c");
        File.WriteAllText(Path.Combine(dir, "docs", "deep", "deeper", "d.log"), "d");
        File.WriteAllText(Path.Combine(dir, "docs", "e.txt"), "e");
    }

    public void Dispose()
    {
        try { Directory.Delete(dir, true); } catch (IOException) { }
    }

    // Files named *.log; a filter of one line.
    static readonly JsonNode Logs = JsonNode.Parse("""
        { "lines": [ { "join": "and", "open": 0, "close": 0, "not": false, "folders": false, "files": true, "field": "name",
          "cond": { "op": "wild", "text": "*.log" }, "orEmpty": false } ] }
        """)!;
    static readonly JsonObject Kinds = new() { ["name"] = "text" };

    static FilterJobs.Request Ask(string location, string? key = "k1", string filter = "k1") =>
        new(location, key, filter, "run", Logs, Kinds, [], false, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

    static async Task<Dictionary<string, bool>> All(Func<TimeSpan, Task<(JsonObject Results, bool Done, int Next)>> ask)
    {
        for (var i = 0; i < 200; i++)
        {
            var (results, done, _) = await ask(TimeSpan.FromMilliseconds(200));
            if (done) return results.ToDictionary(p => p.Key, p => p.Value!.GetValue<bool>());
            await Task.Delay(50);   // asked from the start each time: an answer with something comes at once
        }
        throw new TimeoutException();
    }

    [Fact]
    public void TheHostsEngineTestsAsThePagesDoes()
    {
        var items = new[] { "a.txt", "b.log", "c.LOG" }.Select(n => new JsonObject { ["name"] = n, ["folder"] = false }).ToList();
        items.Add(new JsonObject { ["name"] = "x.log", ["folder"] = true });
        Assert.Equal([false, true, true, false], FilterEngine.Test(Logs, Kinds, 0, items).Select(r => r!.Value));
    }

    [Fact]
    public async Task ResultsAreKeptAndGoWithAChangeOnDisk()
    {
        using var cache = new FolderCache((_, _) => { });
        var jobs = new FilterJobs(cache);
        var first = await All(w => jobs.Results(Ask(dir), w));
        Assert.Equal(["b.log"], first.Where(p => p.Value).Select(p => p.Key));
        Assert.False(first["logs"]);   // a folder: the line is for files
        // Kept: the cache answers without testing again.
        Assert.All(cache.ForFilter(dir, "k1")!, i => Assert.NotNull(i.Result));
        // A file changed: its result goes with it (another item); the others stay.
        File.WriteAllText(Path.Combine(dir, "b.log"), "changed");
        for (var i = 0; i < 50 && cache.ForFilter(dir, "k1")!.First(x => x.Name == "b.log").Result is not null; i++) await Task.Delay(100);
        var now = cache.ForFilter(dir, "k1")!;
        Assert.Null(now.First(x => x.Name == "b.log").Result);
        Assert.NotNull(now.First(x => x.Name == "a.txt").Result);
        // F5: read anew, every result gone.
        cache.Invalidate(dir);
        Assert.All(cache.ForFilter(dir, "k1")!, i => Assert.Null(i.Result));
    }

    [Fact]
    public async Task AChangedFiltersResultsAreLetGoAndADatesKeyReplacesTheDayBefore()
    {
        using var cache = new FolderCache((_, _) => { });
        var jobs = new FilterJobs(cache);
        await All(w => jobs.Results(Ask(dir, "old@2026-11-18", "old"), w));
        await All(w => jobs.Results(Ask(dir, "old@2026-11-19", "old"), w));
        // The same filter of another day: only the new day's kept.
        Assert.All(cache.ForFilter(dir, "old@2026-11-18")!, i => Assert.Null(i.Result));
        Assert.All(cache.ForFilter(dir, "old@2026-11-19")!, i => Assert.NotNull(i.Result));
        jobs.Forget("old");
        for (var i = 0; i < 50 && cache.ForFilter(dir, "old@2026-11-19")!.Any(x => x.Result is not null); i++) await Task.Delay(50);
        Assert.All(cache.ForFilter(dir, "old@2026-11-19")!, i => Assert.Null(i.Result));
    }

    [Fact]
    public async Task ATreesFolderHoldsAPassWhenSomethingUnderItPasses()
    {
        using var cache = new FolderCache((_, _) => { });
        var jobs = new FilterJobs(cache);
        var holds = await All(w => jobs.Holds(Ask(dir), w));
        Assert.True(holds["logs"]);     // logs\old\c.log
        Assert.True(holds["docs"]);     // docs\deep\deeper\d.log, three down
        Assert.False(holds["empty"]);
        // The log under docs deleted: the jobs for docs and the folders above it go (the watch tells), and asked again
        // docs holds nothing; logs still does.
        File.Delete(Path.Combine(dir, "docs", "deep", "deeper", "d.log"));
        Dictionary<string, bool> again = [];
        for (var i = 0; i < 50; i++)
        {
            again = await All(w => jobs.Holds(Ask(dir), w));
            if (!again["docs"]) break;
            await Task.Delay(100);
        }
        Assert.False(again["docs"]);
        Assert.True(again["logs"]);
    }

    [Fact]
    public async Task AFolderReadTheFirstTimeLetsGoOfNothingAndOneReadAgainDoes()
    {
        using var cache = new FolderCache((_, _) => { });
        var jobs = new FilterJobs(cache);
        var stale = new List<IReadOnlyList<string>>();
        jobs.Stale = chain => { lock (stale) stale.Add(chain); };
        // The tree's look reads every folder under dir for the first time (as read-ahead does; Windows reports a folder
        // read as changed): no answers go, so the trees showing the filter are not drawn again for it.
        await All(w => jobs.Holds(Ask(dir), w));
        await Task.Delay(500);
        lock (stale) Assert.Empty(stale);
        // F5 on a folder: read again, its answers and the ones above it go.
        var deep = Path.Combine(dir, "docs", "deep");
        cache.Invalidate(deep);
        cache.ForFilter(deep, null);
        for (var i = 0; i < 50 && stale.Count == 0; i++) await Task.Delay(50);
        lock (stale) Assert.Contains(stale, c => c[0].Equals(deep, StringComparison.OrdinalIgnoreCase) && c.Contains(dir, StringComparer.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task AFilterWithoutAKeyKeepsNothing()
    {
        using var cache = new FolderCache((_, _) => { });
        var jobs = new FilterJobs(cache);
        var r = await All(w => jobs.Results(Ask(dir, null, "clock"), w));
        Assert.True(r["b.log"]);
        Assert.All(cache.ForFilter(dir, "clock")!, i => Assert.Null(i.Result));
    }

    // ---------- Contents (plan 20 3.2) ----------

    // Files holding a text: contains (verbatim), wildcards, a regex; Not; a folder left out of the line.
    static JsonNode Contents(string op, string text, bool not = false, string encoding = "") => JsonNode.Parse($$"""
        { "lines": [ { "join": "and", "open": 0, "close": 0, "not": {{(not ? "true" : "false")}}, "folders": true, "files": true,
          "field": "contents", "cond": { "op": "{{op}}", "text": {{JsonSerializer.Serialize(text)}}, "encoding": "{{encoding}}", "allFiles": false }, "orEmpty": false } ] }
        """)!;

    async Task<List<string>> Passing(FilterJobs jobs, JsonNode set, string run) =>
        [.. (await All(w => jobs.Results(new FilterJobs.Request(dir, null, run, run, set, new JsonObject { ["contents"] = "contents" }, [], false,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()), w))).Where(p => p.Value).Select(p => p.Key).Order()];

    [Fact]
    public async Task AContentsLineTestsWhatAFileHolds()
    {
        File.WriteAllText(Path.Combine(dir, "a.txt"), "a TODO here");
        File.WriteAllText(Path.Combine(dir, "b.log"), "FIXME: later");
        File.WriteAllBytes(Path.Combine(dir, "old.ini"), System.Text.Encoding.Latin1.GetBytes("café"));
        using var cache = new FolderCache((_, _) => { });
        var jobs = new FilterJobs(cache);
        // A folder: the line left out for it (plan 32), so it passes.
        Assert.Equal(["a.txt", "b.log", "docs", "empty", "logs"], await Passing(jobs, Contents("wild", "TODO;FIX?E"), "2"));
        Assert.Equal(["b.log", "docs", "empty", "logs"], await Passing(jobs, Contents("regex", "^FIXME:"), "3"));
        // Not: the files without it, and the folders (the line left out for them: they pass).
        Assert.Equal(["b.log", "docs", "empty", "logs", "old.ini"], await Passing(jobs, Contents("contains", "todo", not: true), "4"));
        // An encoding chosen: the Latin-1 file read as UTF-8 does not hold the word, as windows-1252 it does.
        Assert.DoesNotContain("old.ini", await Passing(jobs, Contents("contains", "café", encoding: "utf-8"), "5"));
        Assert.Contains("old.ini", await Passing(jobs, Contents("contains", "café", encoding: "windows-1252"), "6"));
    }

    [Fact]
    public async Task ASearchTestsItsRulesBeforeItsText()
    {
        var found = new List<string>();
        var rules = JsonNode.Parse("""
            { "name": "logs", "lines": [ { "join": "and", "open": 0, "close": 0, "not": false, "folders": false, "files": true,
              "field": "name", "cond": { "op": "wild", "text": "*.log" }, "orEmpty": false } ] }
            """)!;
        var o = new FileSearch.Options(dir, null, true, true, false, true, true, false, 100, "", Rules: rules,
            RulesKinds: new JsonObject { ["name"] = "text" });
        await StaWorker.Once("t", () => FileSearch.Run(o, part => found.AddRange(part.Select(e => e!["name"]!.GetValue<string>())), default));
        Assert.Equal(["b.log", "c.log", "d.log"], found.Order());
        // With a text too: only the logs that hold it.
        found.Clear();
        File.WriteAllText(Path.Combine(dir, "logs", "old", "c.log"), "has the needle");
        await StaWorker.Once("t", () => FileSearch.Run(o with { TextPattern = "(?:needle)" }, part => found.AddRange(part.Select(e => e!["name"]!.GetValue<string>())), default));
        Assert.Equal(["c.log"], found);
    }

    // ---------- The page: the filter's id and key ----------

    static JsonElement Js(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "filters.js")));
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void AFiltersKeyFollowsItsLinesAndHowItIsRelativeToNow()
    {
        var r = Js("""
            (() => {
              const line = (cond, field = 'modified') => ({ join: 'and', field, folders: true, files: true, cond });
              const name = { lines: [line({ op: 'wild', text: '*.log' }, 'name')] };
              const other = { lines: [line({ op: 'wild', text: '*.txt' }, 'name')] };
              const days = { lines: [line({ op: 'range', from: { rel: 7, unit: 'days' } })] };
              const today = { lines: [line({ op: 'on', day: { rel: 0 } })] };
              const hours = { lines: [line({ op: 'range', from: { rel: 2, unit: 'hours' } }), line({ op: 'range', from: { rel: 7, unit: 'days' } })] };
              const at = new Date(2026, 10, 19, 15, 0).getTime();
              const k = s => filterKey(s, at);
              return { same: k(name).filter === k(JSON.parse(JSON.stringify(name))).filter, differ: k(name).filter !== k(other).filter,
                plain: k(name).key === k(name).filter, days: k(days).key.split('@')[1], today: k(today).key.split('@')[1], hours: k(hours).key };
            })()
            """);
        Assert.Equal("""{"same":true,"differ":true,"plain":true,"days":"2026-11-19","today":"2026-11-19","hours":null}""", r.GetRawText());
    }
}
