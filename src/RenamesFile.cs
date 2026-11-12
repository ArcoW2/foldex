using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// renames.json (docs/plans/executed/21-PLAN-multi-rename.md 3.3): the Rename dialog's saved renames by name, for every project.
/// Written by Foldex, whole, through a temporary file; a file that cannot be read counts as empty.
/// </summary>
static class RenamesFile
{
    public const string Name = "renames.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>{ predefined: { name: settings } }.</summary>
    public static JsonObject Load(string dataDir)
    {
        JsonObject? root = null;
        try { root = JsonNode.Parse(File.ReadAllText(Path.Combine(dataDir, Name)), documentOptions: Options) as JsonObject; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        return Clean(root);
    }

    static JsonObject Clean(JsonNode? root) =>
        new() { ["predefined"] = root?["predefined"] is JsonObject p ? p.DeepClone() : new JsonObject() };

    public static JsonObject Save(string dataDir, JsonNode renames)
    {
        var clean = Clean(renames);
        var path = Path.Combine(dataDir, Name);
        Directory.CreateDirectory(dataDir);
        File.WriteAllText(path + ".tmp", "// The Rename dialog's saved renames (docs/plans/executed/21-PLAN-multi-rename.md). Written by Foldex.\n" +
            clean.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        File.Move(path + ".tmp", path, true);
        return clean;
    }
}
