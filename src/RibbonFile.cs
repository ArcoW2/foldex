using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// ribbon.json (as LexPen's): the ribbon's tabs, groups and buttons. The one in defaults is the shipped ribbon; a
/// ribbon.json in the data folder replaces it whole. Comments and trailing commas are allowed. Reading keeps what makes
/// sense and reports the rest: a tab without a name or groups, a group without items, an item that is not "divider" or
/// { action, ... } is left out; an action Foldex does not know is the page's to skip (the host does not know the
/// actions).
/// </summary>
static class RibbonFile
{
    public const string Name = "ribbon.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>{ ribbon: { tabs }, user: the user's own file is in use, problems: [...] }. A user file that cannot be
    /// read gives the shipped ribbon and says so.</summary>
    public static JsonObject Load(string dataDir, string shippedPath)
    {
        var problems = new JsonArray();
        var userPath = Path.Combine(dataDir, Name);
        if (File.Exists(userPath))
        {
            var mine = Parse(File.ReadAllText(userPath), problems, "your " + Name);
            if (mine is not null) return new JsonObject { ["ribbon"] = mine, ["user"] = true, ["problems"] = problems };
        }
        var shipped = File.Exists(shippedPath) ? Parse(File.ReadAllText(shippedPath), problems, "the shipped " + Name) : null;
        return new JsonObject { ["ribbon"] = shipped ?? new JsonObject { ["tabs"] = new JsonArray() }, ["user"] = false, ["problems"] = problems };
    }

    /// <summary>The ribbon of a text, cleaned; null when it is no JSON object with tabs.</summary>
    public static JsonObject? Parse(string text, JsonArray problems, string source)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(text, documentOptions: Options); }
        catch (JsonException ex)
        {
            problems.Add($"{source}: {ex.Message}");
            return null;
        }
        if (root?["tabs"] is not JsonArray tabs)
        {
            problems.Add($"{source}: it must hold {{ \"tabs\": [ ... ] }}.");
            return null;
        }
        var clean = new JsonArray();
        foreach (var tab in tabs)
        {
            var name = tab?["name"]?.GetValueKind() == JsonValueKind.String ? tab["name"]!.GetValue<string>().Trim() : "";
            if (name.Length == 0 || tab!["groups"] is not JsonArray groups)
            {
                problems.Add($"{source}: a tab needs a name and its groups.");
                continue;
            }
            var cleanGroups = new JsonArray();
            foreach (var group in groups)
            {
                if (group?["items"] is not JsonArray items || group["name"]?.GetValueKind() != JsonValueKind.String)
                {
                    problems.Add($"{source}: tab \"{name}\": a group needs a name and its items.");
                    continue;
                }
                var cleanItems = new JsonArray();
                foreach (var item in items)
                {
                    if (item?.GetValueKind() == JsonValueKind.String && item.GetValue<string>() == "divider") cleanItems.Add("divider");
                    else if (item is JsonObject o && o["action"]?.GetValueKind() == JsonValueKind.String) cleanItems.Add(o.DeepClone());
                    else problems.Add($"{source}: group \"{group["name"]}\": an item must be \"divider\" or {{ \"action\": ... }}.");
                }
                var g = new JsonObject { ["name"] = group["name"]!.GetValue<string>(), ["items"] = cleanItems };
                if (group["corners"] is JsonObject corners) g["corners"] = corners.DeepClone();
                cleanGroups.Add(g);
            }
            clean.Add(new JsonObject { ["name"] = name, ["groups"] = cleanGroups });
        }
        return new JsonObject { ["tabs"] = clean };
    }
}
