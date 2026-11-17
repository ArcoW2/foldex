using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// filters.json (docs/plans/executed/32-PLAN-filter-sets.md 3.4): the kept filter sets, in the order Manage filters gives
/// them, each { name, lines, key }; and the defaults for a new root pane and a new child pane (a set's name, or null).
/// Written by Foldex, whole, through a temporary file; a file that cannot be read counts as empty. The lines are the
/// page's (web/filters.js): kept as they come, only a set without a name or lines left out.
/// </summary>
static class FiltersFile
{
    public const string Name = "filters.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>{ sets: [{ name, lines, key }], rootDefault, childDefault }.</summary>
    public static JsonObject Load(string dataDir)
    {
        JsonObject? root = null;
        try { root = JsonNode.Parse(File.ReadAllText(Path.Combine(dataDir, Name)), documentOptions: Options) as JsonObject; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        return Clean(root);
    }

    internal static JsonObject Clean(JsonNode? root)
    {
        var sets = new JsonArray();
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in root?["sets"] as JsonArray ?? [])
        {
            var name = s?["name"]?.GetValueKind() == JsonValueKind.String ? s["name"]!.GetValue<string>().Trim() : "";
            if (name.Length == 0 || s!["lines"] is not JsonArray lines || !names.Add(name)) continue;
            var set = new JsonObject { ["name"] = name, ["lines"] = lines.DeepClone() };
            if (s["key"]?.GetValueKind() == JsonValueKind.String && KeysFile.Normalize(s["key"]!.GetValue<string>()) is string key) set["key"] = key;
            sets.Add(set);
        }
        string? Default(string field) => root?[field]?.GetValueKind() == JsonValueKind.String && names.Contains(root[field]!.GetValue<string>())
            ? root[field]!.GetValue<string>() : null;
        return new JsonObject { ["sets"] = sets, ["rootDefault"] = Default("rootDefault"), ["childDefault"] = Default("childDefault") };
    }

    public static JsonObject Save(string dataDir, JsonNode filters)
    {
        var clean = Clean(filters);
        var path = Path.Combine(dataDir, Name);
        Directory.CreateDirectory(dataDir);
        File.WriteAllText(path + ".tmp", "// The kept filter sets and the defaults for new panes (docs/plans/executed/32-PLAN-filter-sets.md). Written by Foldex.\n" +
            clean.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        File.Move(path + ".tmp", path, true);
        return clean;
    }
}
