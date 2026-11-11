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

    static JsonNode? Read(string path, JsonArray problems, string source)
    {
        try { return JsonNode.Parse(File.ReadAllText(path), documentOptions: Options); }
        catch (JsonException ex)
        {
            problems.Add($"{source}: {ex.Message}");
            return null;
        }
    }

    /// <summary>The sets of a file, cleaned: a name, columns of { id, width (em) }, a sort { id, desc }, fit.</summary>
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
            var cols = new JsonArray();
            foreach (var col in columns)
            {
                if (col?["id"]?.GetValueKind() != JsonValueKind.String)
                {
                    problems.Add($"{source}: set \"{name}\": a column needs an id.");
                    continue;
                }
                var c = new JsonObject { ["id"] = col["id"]!.GetValue<string>() };
                if (col["width"]?.GetValueKind() == JsonValueKind.Number && col["width"]!.GetValue<double>() > 0) c["width"] = col["width"]!.GetValue<double>();
                cols.Add(c);
            }
            var s = new JsonObject { ["name"] = name, ["columns"] = cols };
            if (set["sort"] is JsonObject sort && sort["id"]?.GetValueKind() == JsonValueKind.String)
                s["sort"] = new JsonObject { ["id"] = sort["id"]!.GetValue<string>(), ["desc"] = sort["desc"]?.GetValueKind() == JsonValueKind.True };
            if (set["fit"]?.GetValueKind() == JsonValueKind.True) s["fit"] = true;
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

    /// <summary>Your sets written (cleaned first): the sets you made or changed, and the shipped ones you deleted.</summary>
    public static void SaveSets(string dataDir, JsonNode mine)
    {
        var problems = new JsonArray();
        var clean = Sets(new JsonObject { ["sets"] = mine.DeepClone() }, problems, "your sets", true);
        Write(Path.Combine(dataDir, SetsName), "// Your column sets (docs/plans/executed/11-PLAN-columns.md 3.3): they replace shipped ones by name.",
            new JsonObject { ["sets"] = new JsonArray(clean.Select(s => (JsonNode)s).ToArray()) });
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
