using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Column sets (docs/plans/executed/11-PLAN-columns.md 3.3): columnsets.json in defaults ships the sets; yours in the data folder
/// replaces a shipped set by name, adds sets, or takes a shipped one away ({ "name": ..., "deleted": true }). And
/// foldercolumns.json in the data folder: which folders use a set, with their subfolders or not (3.2). Reading keeps
/// what makes sense and reports the rest, as the ribbon does.
/// </summary>
static class ColumnSetsFile
{
    public const string SetsName = "columnsets.json", FoldersName = "foldercolumns.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>{ sets: [set + shipped, mine], mine: [your entries as written], folders: [...], problems }.</summary>
    public static JsonObject Load(string dataDir, string shippedPath)
    {
        var problems = new JsonArray();
        var shipped = File.Exists(shippedPath) ? Sets(Read(shippedPath, problems, "the shipped " + SetsName), problems, "the shipped " + SetsName) : [];
        var minePath = Path.Combine(dataDir, SetsName);
        var mine = File.Exists(minePath) ? Sets(Read(minePath, problems, "your " + SetsName), problems, "your " + SetsName, true) : [];
        var merged = new JsonArray();
        foreach (var set in shipped)
        {
            var name = set["name"]!.GetValue<string>();
            var own = mine.FirstOrDefault(m => Same(m, name));
            if (own?["deleted"]?.GetValue<bool>() == true) continue;
            var s = (JsonObject)(own ?? set).DeepClone();
            s["shipped"] = true;
            s["mine"] = own is not null;
            merged.Add(s);
        }
        foreach (var own in mine)
        {
            if (own["deleted"]?.GetValue<bool>() == true || shipped.Any(s => Same(s, own["name"]!.GetValue<string>()))) continue;
            var s = (JsonObject)own.DeepClone();
            s["shipped"] = false;
            s["mine"] = true;
            merged.Add(s);
        }
        // Your order of the sets (plan 28 3.2): the ones named in it first, in that order; the others after, as they came.
        var order = File.Exists(minePath) ? Order(Read(minePath, new JsonArray(), "")) : [];
        int Place(JsonNode? s) { var k = order.FindIndex(n => Same((JsonObject)s!, n)); return k < 0 ? order.Count : k; }
        merged = new JsonArray(merged.Select((s, k) => (s, k)).OrderBy(x => Place(x.s)).ThenBy(x => x.k).Select(x => x.s!.DeepClone()).ToArray());
        var foldersPath = Path.Combine(dataDir, FoldersName);
        var folders = File.Exists(foldersPath) ? Folders(Read(foldersPath, problems, "your " + FoldersName), problems) : [];
        return new JsonObject
        {
            ["sets"] = merged,
            ["mine"] = new JsonArray(mine.Select(m => (JsonNode)m.DeepClone()).ToArray()),
            ["folders"] = new JsonArray(folders.Select(f => (JsonNode)f).ToArray()),
            ["problems"] = problems,
        };
    }

    static bool Same(JsonObject set, string name) => string.Equals(set["name"]!.GetValue<string>(), name, StringComparison.OrdinalIgnoreCase);

    /// <summary>The order of the sets in your file: their names.</summary>
    static List<string> Order(JsonNode? root) =>
        root?["order"] is JsonArray order ? [.. order.Where(n => n?.GetValueKind() == JsonValueKind.String).Select(n => n!.GetValue<string>())] : [];

    /// <summary>The ways a column fits (plan 28 3.6).</summary>
    public static readonly string[] FitModes = ["never", "manual", "enlarge", "shrink", "both"];

    static JsonNode? Read(string path, JsonArray problems, string source)
    {
        try { return JsonNode.Parse(File.ReadAllText(path), documentOptions: Options); }
        catch (JsonException ex)
        {
            problems.Add($"{source}: {ex.Message}");
            return null;
        }
    }

    /// <summary>The sets of a file, cleaned: a name, columns of { id, width, hidden, fit, min, max } (widths in em), a sort
    /// [{ id, desc }] (plan 28 3.9). Written before: a sort { id, desc } is a list of one, "fit": true makes every column
    /// fit both ways, a column without a fit has none (the page's default).</summary>
    public static List<JsonObject> Sets(JsonNode? root, JsonArray problems, string source, bool mine = false)
    {
        var clean = new List<JsonObject>();
        if (root is null) return clean;
        if (root["sets"] is not JsonArray sets)
        {
            problems.Add($"{source}: it must hold {{ \"sets\": [ ... ] }}.");
            return clean;
        }
        foreach (var set in sets)
        {
            var name = set?["name"]?.GetValueKind() == JsonValueKind.String ? set["name"]!.GetValue<string>().Trim() : "";
            if (name.Length == 0)
            {
                problems.Add($"{source}: a set needs a name.");
                continue;
            }
            if (mine && set!["deleted"]?.GetValueKind() == JsonValueKind.True)
            {
                clean.Add(new JsonObject { ["name"] = name, ["deleted"] = true });
                continue;
            }
            if (set!["columns"] is not JsonArray columns)
            {
                problems.Add($"{source}: set \"{name}\" needs its columns.");
                continue;
            }
            var fitAll = set["fit"]?.GetValueKind() == JsonValueKind.True;
            var cols = new JsonArray();
            foreach (var col in columns)
            {
                if (col?["id"]?.GetValueKind() != JsonValueKind.String)
                {
                    problems.Add($"{source}: set \"{name}\": a column needs an id.");
                    continue;
                }
                var c = new JsonObject { ["id"] = col["id"]!.GetValue<string>() };
                foreach (var size in new[] { "width", "min", "max" })
                    if (col[size]?.GetValueKind() == JsonValueKind.Number && col[size]!.GetValue<double>() > 0) c[size] = col[size]!.GetValue<double>();
                if (col["hidden"]?.GetValueKind() == JsonValueKind.True) c["hidden"] = true;
                // Give way (columns.js fittedWidths): a whole number, 1 first.
                if (col["giveWay"]?.GetValueKind() == JsonValueKind.Number && col["giveWay"]!.GetValue<double>() is var way && way >= 1 && way == Math.Floor(way))
                    c["giveWay"] = (int)way;
                // The first direction a click on its title sorts by (columns.js sortAfterClick): only "desc" is kept.
                if (col["first"]?.GetValueKind() == JsonValueKind.String && col["first"]!.GetValue<string>() == "desc") c["first"] = "desc";
                var fit = col["fit"]?.GetValueKind() == JsonValueKind.String ? col["fit"]!.GetValue<string>() : fitAll ? "both" : null;
                if (fit is not null && FitModes.Contains(fit)) c["fit"] = fit;
                cols.Add(c);
            }
            var s = new JsonObject { ["name"] = name, ["columns"] = cols };
            var sorts = set["sort"] switch { JsonArray list => list.ToArray(), JsonObject one => [one], _ => [] };
            var sort = new JsonArray();
            foreach (var by in sorts)
                if (by?["id"]?.GetValueKind() == JsonValueKind.String)
                    sort.Add(new JsonObject { ["id"] = by["id"]!.GetValue<string>(), ["desc"] = by["desc"]?.GetValueKind() == JsonValueKind.True });
            if (sort.Count > 0) s["sort"] = sort;
            clean.Add(s);
        }
        return clean;
    }

    /// <summary>The folders' choices, cleaned: { path, set, subfolders }.</summary>
    public static List<JsonObject> Folders(JsonNode? root, JsonArray problems)
    {
        var clean = new List<JsonObject>();
        if (root?["folders"] is not JsonArray folders) return clean;
        foreach (var f in folders)
        {
            if (f?["path"]?.GetValueKind() != JsonValueKind.String || f["set"]?.GetValueKind() != JsonValueKind.String)
            {
                problems.Add($"your {FoldersName}: a folder needs a path and a set.");
                continue;
            }
            clean.Add(new JsonObject
            {
                ["path"] = f["path"]!.GetValue<string>(),
                ["set"] = f["set"]!.GetValue<string>(),
                ["subfolders"] = f["subfolders"]?.GetValueKind() == JsonValueKind.True,
            });
        }
        return clean;
    }

    /// <summary>Your sets written (cleaned first): the sets you made or changed, the shipped ones you deleted, and the
    /// order of all sets (plan 28 3.2; null: as it was).</summary>
    public static void SaveSets(string dataDir, JsonNode? mine, JsonNode? order = null)
    {
        var problems = new JsonArray();
        var path = Path.Combine(dataDir, SetsName);
        var before = File.Exists(path) ? Read(path, problems, "") : null;
        var clean = Sets(new JsonObject { ["sets"] = (mine ?? before?["sets"] ?? new JsonArray()).DeepClone() }, problems, "your sets", true);
        var names = order is not null ? Order(new JsonObject { ["order"] = order.DeepClone() }) : Order(before);
        var content = new JsonObject { ["sets"] = new JsonArray(clean.Select(s => (JsonNode)s).ToArray()) };
        if (names.Count > 0) content["order"] = new JsonArray(names.Select(n => (JsonNode)n).ToArray());
        Write(path, "// Your column sets (docs/plans/executed/11-PLAN-columns.md 3.3; docs/plans/executed/28-PLAN-column-sets-window.md 3.9): they replace shipped ones by name; \"order\": the order of all sets.",
            content);
    }

    /// <summary>The folders' choices written.</summary>
    public static void SaveFolders(string dataDir, JsonNode folders)
    {
        var problems = new JsonArray();
        var clean = Folders(new JsonObject { ["folders"] = folders.DeepClone() }, problems);
        Write(Path.Combine(dataDir, FoldersName), "// The folders that use a column set (docs/plans/executed/11-PLAN-columns.md 3.2).",
            new JsonObject { ["folders"] = new JsonArray(clean.Select(f => (JsonNode)f).ToArray()) });
    }

    static void Write(string path, string comment, JsonObject content)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path + ".tmp", comment + "\n" + content.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        File.Move(path + ".tmp", path, true);
    }
}
