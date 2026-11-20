using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// The macros (docs/plans/executed/34-PLAN-macros.md 3.5): macros\macros.json in the data folder, a folder of their own so it can
/// be copied on its own, apart from the bookmarks. A tree in your order, as the bookmarks (plan 27): a macro
/// { id, name, icon, key, key2, text } or a folder { id, folder, items } holding macros and folders to any depth. A macro
/// is known by its id, never by its name. Where Foldex differs from LexPen (one file per macro, by its name): a tree with
/// folders, ids and keys, so one file.
/// Written by Foldex whole, through a temporary file; a file that cannot be read counts as empty (and is written again
/// only when a macro is changed).
/// </summary>
static class MacrosFile
{
    public const string Folder = "macros", Name = "macros.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    public static string PathOf(string dataDir) => Path.Combine(dataDir, Folder, Name);

    /// <summary>The tree: [macro or folder].</summary>
    public static JsonArray Load(string dataDir)
    {
        JsonNode? root = null;
        try { root = JsonNode.Parse(File.ReadAllText(PathOf(dataDir)), documentOptions: Options); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        return Clean(root?["macros"]);
    }

    /// <summary>The tree as kept: a folder with a name and its items, a macro with a name (else "Macro") and its text;
    /// every id there and once (a new one else), a key as keys.json writes it; anything else left out.</summary>
    internal static JsonArray Clean(JsonNode? list)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        string Id(JsonObject o)
        {
            var id = Text(o, "id");
            if (id is null || !ids.Add(id)) ids.Add(id = Bookmark.NewId());
            return id;
        }
        JsonArray Items(JsonNode? items)
        {
            var kept = new JsonArray();
            foreach (var n in items as JsonArray ?? [])
            {
                if (n is not JsonObject o) continue;
                if (Text(o, "folder") is { } folder)
                {
                    kept.Add(new JsonObject { ["id"] = Id(o), ["folder"] = folder.Trim(), ["items"] = Items(o["items"]) });
                    continue;
                }
                if (o["name"] is null && o["text"] is null) continue;   // neither a folder nor a macro
                var m = new JsonObject { ["id"] = Id(o), ["name"] = Text(o, "name")?.Trim() is { Length: > 0 } name ? name : "Macro" };
                if (Text(o, "icon") is { } icon) m["icon"] = icon;
                foreach (var k in new[] { "key", "key2" })
                    if (Text(o, k) is { } key && KeysFile.Normalize(key) is string normal) m[k] = normal;
                // Administrator rights (docs/plans/executed/39-PLAN-elevated-macros.md 3.1); anything else counts as step.
                if (Text(o, "elevation") is "step" or "start" or "never") m["elevation"] = o["elevation"]!.GetValue<string>();
                m["text"] = o["text"]?.GetValueKind() == JsonValueKind.String ? o["text"]!.GetValue<string>() : "";
                kept.Add(m);
            }
            return kept;
        }
        return Items(list);
    }

    static string? Text(JsonObject o, string key) =>
        o[key]?.GetValueKind() == JsonValueKind.String && o[key]!.GetValue<string>() is { Length: > 0 } s ? s : null;

    /// <summary>The tree written; gives it as kept.</summary>
    public static JsonArray Save(string dataDir, JsonNode? macros)
    {
        var clean = Clean(macros);
        var path = PathOf(dataDir);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path + ".tmp", "// The macros (docs/plans/executed/34-PLAN-macros.md 3.5): a tree of folders and macros. Written by Foldex.\n" +
            // A macro's text as it is (its quotes, & and < not escaped), so the file reads as the macros read.
            new JsonObject { ["macros"] = clean.DeepClone() }.ToJsonString(new JsonSerializerOptions
            {
                WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            }) + "\n");
        File.Move(path + ".tmp", path, true);
        return clean;
    }
}
