using System.Text.Json.Nodes;

namespace Foldex.Tests;

// Themes (docs/plans/07-PLAN-themes.md): ThemeFile, the shipped themes, the settings window's rows.
public class ThemeFileTests
{
    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;
    static readonly string Defaults = AppHost.FindProjectFolder(AppContext.BaseDirectory, "defaults")!;
    static readonly Dictionary<string, string> Names = ThemeFile.Names(File.ReadAllText(Path.Combine(Web, "app.css")));

    const string Branches = """["#000001", "#000002", "#000003", "#000004", "#000005", "#000006"]""";

    static JsonObject Resolve(params (string Id, string Text)[] files) =>
        ThemeFile.Resolve(files.ToDictionary(f => f.Id, f => (f.Text, false)), Names);

    static string Var(JsonObject r, string id, string name) => r["themes"]![id]!["vars"]![name]!.GetValue<string>();

    [Fact]
    public void TheNamesComeFromTheFirstBlockOfAppCss()
    {
        Assert.Equal("--bg-side", Names["bgSide"]);
        Assert.Contains("fgDim", Names.Keys);
        Assert.DoesNotContain(Names.Keys, n => n.StartsWith("branch"));
    }

    [Fact]
    public void OwnColoursWinThenTheBasesAndTheBranchesComeFromTheBase()
    {
        var r = Resolve(("root", $$"""{ "name": "Root", "colors": { "bg": "#111111", "fg": "#222222" }, "branches": {{Branches}} }"""),
            ("mine", """{ "name": "Mine", "base": "root", "colors": { "bg": "#333333" } }"""));
        Assert.Equal("#333333", Var(r, "mine", "--bg"));
        Assert.Equal("#222222", Var(r, "mine", "--fg"));
        Assert.Equal("#000006", Var(r, "mine", "--branch-5"));
        Assert.Empty(r["problems"]!.AsArray());
    }

    [Fact]
    public void AMissingOrCircularBaseIsReported()
    {
        var r = Resolve(("a", """{ "base": "b", "colors": { "bg": "#111111" } }"""), ("b", """{ "base": "a" }"""),
            ("c", """{ "base": "nothing", "colors": { "fg": "#222222" } }"""));
        Assert.Equal("#111111", Var(r, "a", "--bg"));
        Assert.Equal("#222222", Var(r, "c", "--fg"));
        var problems = r["problems"]!.AsArray().Select(p => p!.GetValue<string>()).ToList();
        Assert.Contains(problems, p => p.Contains("circle"));
        Assert.Contains(problems, p => p.Contains("\"nothing\""));
    }

    [Fact]
    public void AWrongNameValueOrBranchListIsReportedAndSkipped()
    {
        var r = Resolve(("root", $$"""{ "colors": { "bg": "#111111" }, "branches": {{Branches}} }"""),
            ("t", """{ "base": "root", "colors": { "nope": "#000000", "fg": "red; x", "bg": "rgba(0, 0, 0, .5)" }, "branches": ["#ffffff"] }"""));
        Assert.Equal("rgba(0, 0, 0, .5)", Var(r, "t", "--bg"));
        Assert.Null(r["themes"]!["t"]!["vars"]!["--fg"]);
        Assert.Equal("#000001", Var(r, "t", "--branch-0"));
        Assert.Equal(3, r["problems"]!.AsArray().Count);
    }

    [Fact]
    public void ABranchIsAColourOrAPaneThemeWithItsOwnColours()
    {
        // Plan 13 3.1: "base" is the branch colour, the others go to --branch-N-<name>.
        var r = Resolve(("t", """
            { "branches": ["#000001", { "base": "#000002", "bg": "#f3f8ff", "bgSide": "#eeeeee", "select": "#b6d7ff" },
              "#000003", "#000004", "#000005", "#000006"] }
            """));
        Assert.Empty(r["problems"]!.AsArray());
        Assert.Equal("#000001", Var(r, "t", "--branch-0"));
        Assert.Equal("#000002", Var(r, "t", "--branch-1"));
        Assert.Equal("#f3f8ff", Var(r, "t", "--branch-1-bg"));
        Assert.Equal("#eeeeee", Var(r, "t", "--branch-1-bg-side"));
        Assert.Equal("#b6d7ff", Var(r, "t", "--branch-1-select"));
        Assert.Null(r["themes"]!["t"]!["vars"]!["--branch-1-hover"]);
    }

    [Theory]
    [InlineData("""{ "bg": "#ffffff" }""")]                        // no base
    [InlineData("""{ "base": "#000002", "fg": "#ffffff" }""")]     // not a pane colour
    [InlineData("""{ "base": "#000002", "bg": "white; x" }""")]    // not a colour
    public void AWrongPaneThemeIsReportedAndTheBasesBranchesUsed(string entry)
    {
        var r = Resolve(("root", $$"""{ "branches": {{Branches}} }"""),
            ("t", $$"""{ "base": "root", "branches": ["#0000aa", {{entry}}, "#0000aa", "#0000aa", "#0000aa", "#0000aa"] }"""));
        Assert.Single(r["problems"]!.AsArray());
        Assert.Equal("#000001", Var(r, "t", "--branch-0"));
    }

    [Fact]
    public void YourThemeReplacesAShippedOneOfTheSameName()
    {
        var data = Path.Combine(Path.GetTempPath(), "foldex-themes-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(data, ThemeFile.FolderName));
        try
        {
            File.WriteAllText(Path.Combine(data, ThemeFile.FolderName, "dark.json"), """{ "name": "My dark", "colors": { "bg": "#010203" } }""");
            var r = ThemeFile.Load(data);
            Assert.Equal("My dark", r["themes"]!["dark"]!["name"]!.GetValue<string>());
            Assert.True(r["themes"]!["dark"]!["mine"]!.GetValue<bool>());
            Assert.Equal("#010203", Var(r, "dark", "--bg"));
        }
        finally { Directory.Delete(data, true); }
    }

    [Fact]
    public void EveryShippedThemeLoadsAndTheRootsSetEverything()
    {
        var r = ThemeFile.Load(Path.Combine(Path.GetTempPath(), "foldex-no-data-" + Guid.NewGuid().ToString("N")));
        Assert.Empty(r["problems"]!.AsArray());
        var themes = r["themes"]!.AsObject();
        Assert.Equal(Directory.GetFiles(Path.Combine(Defaults, ThemeFile.FolderName), "*.json").Length, themes.Count);
        foreach (var root in new[] { "light", "dark" })
        {
            var vars = themes[root]!["vars"]!.AsObject();
            foreach (var v in Names.Values) Assert.True(vars.ContainsKey(v), $"{root} misses {v}");
            for (var i = 0; i < ThemeFile.BranchCount; i++) Assert.True(vars.ContainsKey($"--branch-{i}"), $"{root} misses branch {i}");
        }
        foreach (var (id, t) in themes) Assert.True(t!["vars"]!.AsObject().ContainsKey("--branch-0"), $"{id} has no branch colours");
    }

    [Fact]
    public void AppCssStartsWithTheColoursOfLightAndDark()
    {
        var css = File.ReadAllText(Path.Combine(Web, "app.css"));
        var r = ThemeFile.Load(Path.Combine(Path.GetTempPath(), "foldex-no-data-" + Guid.NewGuid().ToString("N")));
        var dark = css.IndexOf(":root[data-theme=\"dark\"]", StringComparison.Ordinal);
        foreach (var (root, block) in new[] { ("light", css[..dark]), ("dark", css[dark..css.IndexOf('}', dark)]) })
            foreach (var (name, value) in r["themes"]![root]!["vars"]!.AsObject())
                Assert.Contains($"{name}: {value};", block);
    }

    [Fact]
    public void EverySettingsRowNamesASetting()
    {
        // Run, not read: a script that does not parse leaves the settings window empty.
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(Web, "settingrows.js")));
        var defaults = SettingsFile.Merge(File.ReadAllText(Path.Combine(Defaults, SettingsFile.Name)), null)["defaults"]!.AsObject();
        var names = engine.Evaluate("SETTING_ROWS.map(r => r.name).join('\\n')").ToString().Split('\n').ToList();
        Assert.NotEmpty(names);
        foreach (var name in names) Assert.True(defaults.ContainsKey(name), $"settingrows.js: {name} is not a setting");
    }
}

// The installed fonts for the font settings (docs/plans/08-PLAN-fonts.md 3.1).
public class FontsTests
{
    [Fact]
    public void TheFontsAreInstalledFamiliesWithoutVerticalVariants()
    {
        var list = Fonts.List();
        Assert.Contains("Segoe UI", list);
        Assert.DoesNotContain(list, f => f.StartsWith('@'));
    }
}
