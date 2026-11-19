using System.Text.Json.Nodes;
using Jint;

namespace Foldex.Shell;

/// <summary>
/// The filter engine in the host (docs/plans/executed/36-PLAN-filter-results-in-cache.md 3.3): the page's own `filters.js`, run
/// by Jint (it needs no page; its tests run it the same way), so a line means the same here as in the page. Items are
/// the listing's entries with the values the set needs (Windows' properties as `props`, the Git status as `git`), read
/// before they are tested, so nothing waits.
/// </summary>
static class FilterEngine
{
    static readonly Lock gate = new();
    static Jint.Engine? engine;

    // Jint runs one script at a time: one engine, its calls in turn.
    static Jint.Engine Engine()
    {
        if (engine is not null) return engine;
        using var source = WebFiles.Open("filters.js") ?? throw new InvalidOperationException("filters.js is not there");
        var e = new Jint.Engine(o => o.TimeoutInterval(TimeSpan.FromSeconds(10)));
        e.Execute(new StreamReader(source).ReadToEnd());
        // The set's test of each item: true, false, or null for one that still waits for a value (none should).
        e.Execute("""
            function filterAll(set, kinds, now, items) {
              const test = filterTestOf(set, id => kinds[id] ?? 'text', now);
              return items.map(x => { const r = test(x); return r === 'wait' ? null : r; });
            }
            """);
        return engine = e;
    }

    /// <summary>A Contents line (plan 20 3.2): the key of its answer, its expression, the encoding ("" found by itself),
    /// all files or the known ones.</summary>
    public sealed record ContentsLine(string Key, string Pattern, string Encoding, bool AllFiles);

    /// <summary>The Contents lines of a set, as filters.js reads them (filterContentsLines).</summary>
    public static List<ContentsLine> Contents(JsonNode set)
    {
        var json = set.ToJsonString();
        lock (gate)
        {
            if (contentsOf.TryGetValue(json, out var known)) return known;
            var result = Engine().Evaluate($"JSON.stringify(filterContentsLines({json}))").ToString();
            var lines = JsonNode.Parse(result)!.AsArray().Select(l => new ContentsLine(l!["key"]!.GetValue<string>(), l["pattern"]?.GetValue<string>() ?? "",
                l["encoding"]?.GetValue<string>() ?? "", l["allFiles"]?.GetValue<bool>() == true)).Where(l => l.Pattern.Length > 0).ToList();
            if (contentsOf.Count > 64) contentsOf.Clear();   // a few sets are in use at a time (chosen, not measured)
            return contentsOf[json] = lines;
        }
    }

    // Per set (its JSON) its Contents lines: asked once, not for every folder a tree's look goes through.
    static readonly Dictionary<string, List<ContentsLine>> contentsOf = [];

    /// <summary>What a set reads besides the listing: Windows' properties, the Git status, files' contents (read up to
    /// `StartBytes`; 0: whole).</summary>
    public sealed record Needs(IReadOnlyList<string> Props, bool Git, IReadOnlyList<ContentsLine> Contents, long StartBytes);

    /// <summary>The values a set needs put on entries of one folder (`paths` the entries' full paths): `props` (files
    /// only), `git`, `contents` (files only, per Contents line whether the file holds its text). Off the window's
    /// thread; Windows' properties on an STA thread (`props` gives them).</summary>
    public static async Task Fill(IReadOnlyList<JsonObject> entries, IReadOnlyList<string> paths, string folder, Needs needs,
        Func<List<string>, IReadOnlyList<string>, Task<JsonObject>> props, CancellationToken cancel = default)
    {
        var files = Enumerable.Range(0, entries.Count).Where(k => entries[k]["folder"]?.GetValue<bool>() != true).ToList();
        if (needs.Props.Count > 0 && files.Count > 0)
        {
            var values = await props([.. files.Select(k => paths[k])], needs.Props);
            foreach (var k in files)
            {
                var mine = values[paths[k]] as JsonObject;
                entries[k]["props"] = new JsonObject(needs.Props.Select(n => KeyValuePair.Create(n, mine?[n]?.DeepClone())));
            }
        }
        if (needs.Git)
        {
            var git = GitStatus.Of(folder);
            foreach (var e in entries) e["git"] = git?[e["name"]!.GetValue<string>()]?.DeepClone();
        }
        if (needs.Contents.Count > 0)
        {
            var lines = needs.Contents.Select(l => (l, Re: TextSearch.Make(l.Pattern, false)!)).ToList();
            foreach (var k in files)
            {
                if (cancel.IsCancellationRequested) return;
                entries[k]["contents"] = new JsonObject(lines.Select(x => KeyValuePair.Create(x.l.Key,
                    (JsonNode?)JsonValue.Create(TextSearch.Holds(paths[k], x.Re, x.l.AllFiles, needs.StartBytes, cancel, x.l.Encoding)))));
            }
        }
    }

    /// <summary>Each item tested with `set` (`kinds`: the filter kind of each field it reads; `now`: ms since 1970, for
    /// dates relative to now): true, false, or null when a value it needs is not in the item.</summary>
    public static bool?[] Test(JsonNode set, JsonObject kinds, long now, IReadOnlyList<JsonObject> items)
    {
        if (items.Count == 0) return [];
        var call = $"JSON.stringify(filterAll({set.ToJsonString()}, {kinds.ToJsonString()}, {now}, {new JsonArray(items.Select(i => (JsonNode)i.DeepClone()).ToArray()).ToJsonString()}))";
        string result;
        lock (gate) result = Engine().Evaluate(call).ToString();
        return JsonNode.Parse(result)!.AsArray().Select(r => r is null ? (bool?)null : r.GetValue<bool>()).ToArray();
    }
}
