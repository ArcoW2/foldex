using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// keys.json (as LexPen's): which key runs which action. The one in defaults is the default set; a keys.json in the
/// data folder overrides it key by key (null takes a key away). Keys are written as "Ctrl+Shift+S", a chord as
/// "Ctrl+K, K"; an action is its name, or a list of its name and parameters: ["pane.newChild", "right"].
/// Comments (//) and trailing commas are allowed. The page gets the merged set with the keys in one spelling (see
/// Normalize), the same spelling it makes of a key press (strokeOf in keys.js).
/// </summary>
static class KeysFile
{
    public const string Name = "keys.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    // Key names as Foldex spells them; the aliases on the right are accepted too.
    static readonly Dictionary<string, string> Names = BuildNames();

    static Dictionary<string, string> BuildNames()
    {
        var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        // No comma: it separates the keys of a chord.
        foreach (var c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`-=[]\\;'./") names[c.ToString()] = c.ToString().ToUpperInvariant();
        for (var i = 1; i <= 12; i++) names["F" + i] = "F" + i;
        for (var i = 0; i <= 9; i++) names["Num" + i] = "Num" + i;
        foreach (var n in new[] { "Comma", "NumPlus", "NumMinus", "Tab", "Enter", "Esc", "Space", "Backspace", "Ins", "Del", "Home", "End", "PgUp", "PgDn", "Left", "Right", "Up", "Down" })
            names[n] = n;
        foreach (var (alias, name) in new[] { ("Escape", "Esc"), ("Insert", "Ins"), ("Delete", "Del"), ("PageUp", "PgUp"), ("PageDown", "PgDn"),
            ("ArrowLeft", "Left"), ("ArrowRight", "Right"), ("ArrowUp", "Up"), ("ArrowDown", "Down"), ("Return", "Enter") })
            names[alias] = name;
        return names;
    }

    /// <summary>"shift+ctrl+s" -> "Ctrl+Shift+S", "ctrl+k,k" -> "Ctrl+K, K". Null when it is not a key.</summary>
    public static string? Normalize(string keys)
    {
        var strokes = new List<string>();
        foreach (var part in keys.Split(','))
        {
            var bits = part.Trim().Split('+', StringSplitOptions.TrimEntries);
            if (bits.Length == 0 || bits[^1].Length == 0) return null;
            var mods = bits[..^1].Select(m => m.ToLowerInvariant()).ToList();
            if (mods.Any(m => m is not ("ctrl" or "alt" or "shift")) || mods.Distinct().Count() != mods.Count) return null;
            if (!Names.TryGetValue(bits[^1], out var name)) return null;
            strokes.Add((mods.Contains("ctrl") ? "Ctrl+" : "") + (mods.Contains("alt") ? "Alt+" : "") + (mods.Contains("shift") ? "Shift+" : "") + name);
        }
        return strokes.Count is 1 or 2 ? string.Join(", ", strokes) : null;
    }

    /// <summary>The default set with the user's keys on top: { keys: { "F5": "refresh", ... }, problems: [...],
    /// user: [the keys the user set], defaults: the default set alone }. A user file that cannot be read leaves
    /// the defaults in place and says so.</summary>
    public static JsonObject Merge(string defaults, string? user, string userName = Name)
    {
        var keys = new JsonObject();
        var problems = new JsonArray();
        var mine = new JsonArray();
        Add(keys, defaults, problems, "the default " + Name, null);
        var defaultKeys = keys.DeepClone();
        if (user is not null) Add(keys, user, problems, userName, mine);
        return new JsonObject { ["keys"] = keys, ["problems"] = problems, ["user"] = mine, ["defaults"] = defaultKeys };
    }

    static void Add(JsonObject keys, string text, JsonArray problems, string source, JsonArray? mine)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(text, documentOptions: Options); }
        catch (JsonException ex)
        {
            problems.Add($"{source}: {ex.Message}");
            return;
        }
        if (root is not JsonObject entries)
        {
            problems.Add($"{source}: the file must hold one {{ ... }} of keys.");
            return;
        }
        foreach (var (raw, value) in entries)
        {
            var key = Normalize(raw);
            if (key is null)
            {
                problems.Add($"{source}: \"{raw}\" is not a key.");
                continue;
            }
            if (value is null)
            {
                keys.Remove(key);   // the user takes the key away
                continue;
            }
            var valid = value is JsonValue v && v.GetValueKind() == JsonValueKind.String
                || value is JsonArray { Count: > 0 } list && list[0] is JsonValue first && first.GetValueKind() == JsonValueKind.String;
            if (!valid)
            {
                problems.Add($"{source}: \"{raw}\" needs an action name, or a list of a name and its parameters.");
                continue;
            }
            keys[key] = value.DeepClone();
            mine?.Add(key);
        }
    }

    /// <summary>The merged set for this installation: defaults\keys.json and the user's file in the data folder.</summary>
    public static JsonObject Load(string dataDir)
    {
        var defaults = File.ReadAllText(Path.Combine(AppHost.DefaultsDir, Name));
        var userPath = Path.Combine(dataDir, Name);
        string? user = null;
        try { if (File.Exists(userPath)) user = File.ReadAllText(userPath); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        var merged = Merge(defaults, user, userPath);
        merged["userFile"] = userPath;
        // The order of the files, which the message to the page does not keep for an object: the first key of an
        // action is the one the ribbon's tooltips and F1 show.
        merged["order"] = new JsonArray(merged["keys"]!.AsObject().Select(k => (JsonNode?)k.Key).ToArray());
        return merged;
    }
}
