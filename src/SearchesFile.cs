using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// searches.json (docs/plans/executed/06-PLAN-search-and-scrap.md 3.3): what the Find dialog keeps for every project: the saved
/// searches by name (Predefined) and the folders and names used before (its lists). Written by Foldex, whole, through
/// a temporary file; a file that cannot be read counts as empty.
/// </summary>
static class SearchesFile
{
    public const string Name = "searches.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>{ predefined: { name: options }, lookIn: [...], named: [...], text: [...], last: options }; `last` the options of the
    /// last search run (without its folder), where the next Find starts; only once there was one.</summary>
    public static JsonObject Load(string dataDir)
    {
        JsonObject? root = null;
        try { root = JsonNode.Parse(File.ReadAllText(Path.Combine(dataDir, Name)), documentOptions: Options) as JsonObject; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        return Clean(root);
    }

    static JsonObject Clean(JsonNode? root)
    {
        var clean = new JsonObject
        {
            ["predefined"] = root?["predefined"] is JsonObject p ? p.DeepClone() : new JsonObject(),
            ["lookIn"] = Texts(root?["lookIn"]),
            ["named"] = Texts(root?["named"]),
            ["text"] = Texts(root?["text"]),   // the Containing texts used before (plan 20 3.1)
        };
        if (root?["last"] is JsonObject last) clean["last"] = last.DeepClone();
        return clean;
    }

    static JsonArray Texts(JsonNode? list) => new((list as JsonArray ?? [])
        .Where(n => n?.GetValueKind() == JsonValueKind.String).Select(n => (JsonNode?)n!.GetValue<string>()).ToArray());

    public static JsonObject Save(string dataDir, JsonNode searches)
    {
        var clean = Clean(searches);
        var path = Path.Combine(dataDir, Name);
        Directory.CreateDirectory(dataDir);
        File.WriteAllText(path + ".tmp", "// The Find dialog's saved searches and lists (docs/plans/executed/06-PLAN-search-and-scrap.md). Written by Foldex.\n" +
            clean.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        File.Move(path + ".tmp", path, true);
        return clean;
    }
}
