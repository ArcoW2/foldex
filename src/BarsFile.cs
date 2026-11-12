using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// bars.json (docs/plans/executed/10-PLAN-bars.md 3.3): the bars at each side of the window, as RibbonFile does the ribbon. The
/// one in defaults is shipped; a bars.json in the data folder replaces it whole, and Foldex writes that one when you
/// change a bar in the window. Per side (top, bottom, left, right) a list of lines, a line a list of bars. Reading keeps
/// what makes sense and reports the rest: a bar of a kind Foldex does not have, a side it does not know, a size that is
/// no positive number, is left out (the bar or the value).
/// </summary>
static class BarsFile
{
    public const string Name = "bars.json";
    public static readonly string[] Sides = ["top", "bottom", "left", "right"];
    public static readonly string[] Kinds = ["path", "drives", "search"];

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>{ bars: { top, bottom, left, right }, user: your own file is in use, problems: [...] }. A file of yours
    /// that cannot be read gives the shipped bars and says so.</summary>
    public static JsonObject Load(string dataDir, string shippedPath)
    {
        var problems = new JsonArray();
        var userPath = Path.Combine(dataDir, Name);
        if (File.Exists(userPath))
        {
            var mine = Parse(File.ReadAllText(userPath), problems, "your " + Name);
            if (mine is not null) return new JsonObject { ["bars"] = mine, ["user"] = true, ["problems"] = problems };
        }
        var shipped = File.Exists(shippedPath) ? Parse(File.ReadAllText(shippedPath), problems, "the shipped " + Name) : null;
        return new JsonObject { ["bars"] = shipped ?? Empty(), ["user"] = false, ["problems"] = problems };
    }

    static JsonObject Empty()
    {
        var o = new JsonObject();
        foreach (var side in Sides) o[side] = new JsonArray();
        return o;
    }

    /// <summary>The bars of a text, cleaned; null when it is no JSON object.</summary>
    public static JsonObject? Parse(string text, JsonArray problems, string source)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(text, documentOptions: Options); }
        catch (JsonException ex)
        {
            problems.Add($"{source}: {ex.Message}");
            return null;
        }
        if (root is not JsonObject sides)
        {
            problems.Add($"{source}: it must hold {{ \"top\": [ [ bars ] ], ... }}.");
            return null;
        }
        foreach (var (name, _) in sides)
            if (!Sides.Contains(name)) problems.Add($"{source}: \"{name}\" is no side (top, bottom, left, right).");
        var clean = Empty();
        foreach (var side in Sides)
        {
            if (sides[side] is null) continue;
            if (sides[side] is not JsonArray lines)
            {
                problems.Add($"{source}: {side} must be a list of lines.");
                continue;
            }
            foreach (var line in lines)
            {
                if (line is not JsonArray bars)
                {
                    problems.Add($"{source}: {side}: a line must be a list of bars.");
                    continue;
                }
                var cleanLine = new JsonArray();
                foreach (var bar in bars)
                    if (Bar(bar, problems, $"{source}: {side}") is { } b) cleanLine.Add(b);
                if (cleanLine.Count > 0) ((JsonArray)clean[side]!).Add(cleanLine);
            }
        }
        return clean;
    }

    // One bar, cleaned: its kind, its sizes (positive numbers; maxShare 1 to 100), fill, overflow, freeSpace.
    static JsonObject? Bar(JsonNode? bar, JsonArray problems, string where)
    {
        var kind = bar?["kind"]?.GetValueKind() == JsonValueKind.String ? bar["kind"]!.GetValue<string>() : null;
        if (bar is not JsonObject o || kind is null || !Kinds.Contains(kind))
        {
            problems.Add($"{where}: a bar needs a kind: {string.Join(", ", Kinds)}.");
            return null;
        }
        var clean = new JsonObject { ["kind"] = kind };
        foreach (var size in new[] { "normal", "min", "max", "maxShare" })
        {
            if (o[size] is null) continue;
            if (o[size]!.GetValueKind() == JsonValueKind.Number && o[size]!.GetValue<double>() is var v && v > 0
                && (size != "maxShare" || v <= 100))
                clean[size] = v;
            else problems.Add($"{where}: {kind}: {size} must be a number above 0{(size == "maxShare" ? ", at most 100" : "")}.");
        }
        foreach (var flag in new[] { "fill", "freeSpace" })
            if (o[flag]?.GetValueKind() is JsonValueKind.True or JsonValueKind.False) clean[flag] = o[flag]!.GetValue<bool>();
        if (o["overflow"] is { } overflow)
        {
            var value = overflow.GetValueKind() == JsonValueKind.String ? overflow.GetValue<string>() : "";
            if (value is "more" or "scroll") clean["overflow"] = value;
            else problems.Add($"{where}: {kind}: overflow must be \"more\" or \"scroll\".");
        }
        return clean;
    }

    /// <summary>Your bars.json written (cleaned first), through a temporary file so a crash leaves the old one.</summary>
    public static JsonObject Save(string dataDir, JsonNode bars)
    {
        var problems = new JsonArray();
        var clean = Parse(bars.ToJsonString(), problems, "the bars") ?? Empty();
        var path = Path.Combine(dataDir, Name);
        Directory.CreateDirectory(dataDir);
        var text = "// The bars of Foldex (docs/plans/executed/10-PLAN-bars.md): per side a list of lines, a line a list of bars.\n" +
            "// Written by Foldex when you change a bar in the window; you may edit it by hand too.\n" +
            clean.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n";
        File.WriteAllText(path + ".tmp", text);
        File.Move(path + ".tmp", path, true);
        return clean;
    }
}
