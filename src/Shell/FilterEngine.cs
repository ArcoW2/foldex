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
