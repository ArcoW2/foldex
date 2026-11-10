using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Foldex;

/// <summary>
/// Themes (docs/plans/07-PLAN-themes.md, as LexPen's ThemeFile): defaults\themes\*.json ships with Foldex, your own go
/// in themes\ in the data folder (a file with the same name replaces a shipped one). A theme has a name, a description,
/// optionally a base (any other theme: its colours, through its own base and so on), only the colours that differ
/// from its base, and optionally the six branch colours (else its base's). Light and Dark set everything: the roots.
/// A colour nothing in the chain sets comes from the mode's block in app.css. The colour names are the CSS variables
/// of the first block of app.css without the dashes (--bg-side is bgSide). A wrong name or value is reported and
/// skipped.
/// </summary>
static partial class ThemeFile
{
    public const string FolderName = "themes";
    public const int BranchCount = 6;

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>The colour names a theme may set, each with its CSS variable: from the first :root block of app.css,
    /// without the branch colours (those are the list "branches").</summary>
    public static Dictionary<string, string> Names(string css)
    {
        var names = new Dictionary<string, string>(StringComparer.Ordinal);
        var start = css.IndexOf(":root {", StringComparison.Ordinal);
        var end = start < 0 ? -1 : css.IndexOf('}', start);
        if (end < 0) return names;
        foreach (Match m in CssVar().Matches(css[start..end]))
            if (!m.Groups[1].Value.StartsWith("branch-", StringComparison.Ordinal))
                names[KeyOf(m.Groups[1].Value)] = "--" + m.Groups[1].Value;
        return names;
    }

    // "bg-side" -> "bgSide".
    static string KeyOf(string var)
    {
        var parts = var.Split('-');
        return parts[0] + string.Concat(parts.Skip(1).Select(p => char.ToUpperInvariant(p[0]) + p[1..]));
    }

    [GeneratedRegex(@"--([a-z0-9-]+)\s*:")]
    private static partial Regex CssVar();

    [GeneratedRegex(@"^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\))$", RegexOptions.IgnoreCase)]
    private static partial Regex Colour();

    sealed record Parsed(string Name, string? Description, string? Base, Dictionary<string, string> Colours, string[]? Branches, bool Mine);

    /// <summary>Every theme resolved: { themes: { id: { name, description, mine, vars: { "--bg": ..., "--branch-0": ... } } },
    /// problems: [...] }. Files: id -> (text, yours).</summary>
    public static JsonObject Resolve(IReadOnlyDictionary<string, (string Text, bool Mine)> files, Dictionary<string, string> names)
    {
        var problems = new JsonArray();
        var parsed = new Dictionary<string, Parsed>(StringComparer.OrdinalIgnoreCase);
        foreach (var (id, (text, mine)) in files)
            if (Parse(id, text, mine, names, problems) is { } p) parsed[id] = p;

        var themes = new JsonObject();
        foreach (var (id, theme) in parsed.OrderBy(t => t.Value.Name, StringComparer.CurrentCultureIgnoreCase))
        {
            var vars = new JsonObject();
            string[]? branches = null;
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var cur = id; cur is not null;)
            {
                if (!seen.Add(cur))
                {
                    problems.Add($"Theme {id}: its bases go round in a circle ({cur}).");
                    break;
                }
                if (!parsed.TryGetValue(cur, out var t))
                {
                    problems.Add($"Theme {id}: there is no theme \"{cur}\" to build on.");
                    break;
                }
                foreach (var (name, value) in t.Colours)
                    if (!vars.ContainsKey(names[name])) vars[names[name]] = value;
                branches ??= t.Branches;
                cur = t.Base;
            }
            for (var i = 0; i < (branches?.Length ?? 0); i++) vars[$"--branch-{i}"] = branches![i];
            themes[id] = new JsonObject
            {
                ["name"] = theme.Name, ["description"] = theme.Description, ["mine"] = theme.Mine, ["vars"] = vars,
            };
        }
        return new JsonObject { ["themes"] = themes, ["problems"] = problems };
    }

    static Parsed? Parse(string id, string text, bool mine, Dictionary<string, string> names, JsonArray problems)
    {
        var source = mine ? $"Your theme {id}.json" : $"Theme {id}.json";
        JsonObject o;
        try
        {
            if (JsonNode.Parse(text, documentOptions: Options) is not JsonObject obj)
            {
                problems.Add($"{source}: the file must hold one {{ ... }}.");
                return null;
            }
            o = obj;
        }
        catch (JsonException ex)
        {
            problems.Add($"{source}: {ex.Message}");
            return null;
        }
        string? Text(string key) => o[key] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

        var colours = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (name, value) in o["colors"] as JsonObject ?? [])
        {
            var colour = value is JsonValue v && v.TryGetValue<string>(out var s) ? s.Trim() : null;
            if (!names.ContainsKey(name)) problems.Add($"{source}: \"{name}\" is not a theme colour.");
            else if (colour is null || !Colour().IsMatch(colour)) problems.Add($"{source}: \"{name}\" needs a colour such as \"#1e1f22\".");
            else colours[name] = colour;
        }

        string[]? branches = null;
        if (o["branches"] is JsonArray list)
        {
            var given = list.Select(n => n is JsonValue v && v.TryGetValue<string>(out var s) ? s.Trim() : null).ToList();
            if (given.Count != BranchCount || given.Any(c => c is null || !Colour().IsMatch(c)))
                problems.Add($"{source}: \"branches\" needs {BranchCount} colours; its base's are used.");
            else branches = given.ToArray()!;
        }
        else if (o["branches"] is not null) problems.Add($"{source}: \"branches\" needs a list of {BranchCount} colours.");

        return new Parsed(Text("name") ?? id, Text("description"), Text("base"), colours, branches, mine);
    }

    /// <summary>The themes for this installation: the shipped ones, then yours in the data folder.</summary>
    public static JsonObject Load(string dataDir)
    {
        var files = new Dictionary<string, (string, bool)>(StringComparer.OrdinalIgnoreCase);
        var problems = new List<string>();
        foreach (var (folder, mine) in new[] { (Path.Combine(AppHost.DefaultsDir, FolderName), false), (Path.Combine(dataDir, FolderName), true) })
        {
            if (!Directory.Exists(folder)) continue;
            foreach (var file in Directory.EnumerateFiles(folder, "*.json"))
                try { files[Path.GetFileNameWithoutExtension(file)] = (File.ReadAllText(file), mine); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { problems.Add($"{file}: {ex.Message}"); }
        }
        using var css = WebFiles.Open("app.css");
        var result = Resolve(files, Names(css is null ? "" : new StreamReader(css).ReadToEnd()));
        foreach (var p in problems) result["problems"]!.AsArray().Add(p);
        return result;
    }
}
