using System.Text.Json;

namespace Foldex.Tests;

// web/look.js run under Jint: the pane themes' colours (docs/plans/executed/13-PLAN-pane-themes.md 3.2, 3.3).
public class LookTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "look.js"));

    // A theme's branch variables: branch 0 a colour only, branch 1 with its own selection.
    const string Theme = """{ "--branch-0": "#0969da", "--branch-1": "#cf222e", "--branch-1-select": "#ffcccc" }""";

    static Dictionary<string, string> Vars(string settings)
    {
        var engine = new Jint.Engine();
        engine.Execute("var window = { matchMedia: () => ({ matches: false }) };");
        engine.Execute(Source);
        var json = engine.Evaluate($"JSON.stringify(paneThemeVars({settings}, {Theme}))").ToString();
        return JsonSerializer.Deserialize<Dictionary<string, string>>(json)!;
    }

    [Fact]
    public void AtTheDefaultsTheInsideIsTheWindowsColourWithAShareOfTheBase()
    {
        var v = Vars("{}");
        Assert.Equal("#0969da", v["--branch-0"]);
        Assert.Equal("color-mix(in srgb, #0969da 8%, var(--bg))", v["--branch-0-bg"]);
        Assert.Equal("color-mix(in srgb, #0969da 8%, var(--bg-side))", v["--branch-0-bg-side"]);
        Assert.Equal("color-mix(in srgb, #0969da 35%, var(--select))", v["--branch-0-select"]);
        Assert.Equal("color-mix(in srgb, #0969da 14%, var(--hover))", v["--branch-0-hover"]);
        Assert.Equal("var(--branch-0)", v["--branch-0-accent"]);
    }

    [Fact]
    public void MixMinus100IsTheWindowsOwnAndPlus100MoreOfTheBase()
    {
        Assert.Equal("var(--bg)", Vars("{ paneThemeMix: -100 }")["--branch-0-bg"]);
        Assert.Equal("color-mix(in srgb, #0969da 54%, var(--bg))", Vars("{ paneThemeMix: 100 }")["--branch-0-bg"]);
    }

    [Fact]
    public void IntensityGoesFromTheBackgroundToTheTextColour()
    {
        Assert.Equal("var(--bg)", Vars("{ paneThemeIntensity: 0 }")["--branch-0"]);
        Assert.Equal("color-mix(in srgb, #0969da 50%, var(--bg))", Vars("{ paneThemeIntensity: 50 }")["--branch-0"]);
        Assert.Equal("var(--fg)", Vars("{ paneThemeIntensity: 200 }")["--branch-0"]);
    }

    [Fact]
    public void AColourThePaneThemeSetsIsUsedAsItIsAndNotMixed()
    {
        Assert.Equal("#ffcccc", Vars("{}")["--branch-1-select"]);
        Assert.Equal("#ffcccc", Vars("{ paneThemeMix: -100 }")["--branch-1-select"]);
    }

    [Fact]
    public void NotFollowingTheBranchGivesTheWindowsColoursInside()
    {
        var v = Vars("{ paneThemeFollowsBranch: false }");
        Assert.Equal("var(--bg)", v["--branch-1-bg"]);
        Assert.Equal("var(--select)", v["--branch-1-select"]);
        Assert.Equal("var(--accent)", v["--branch-1-accent"]);
        Assert.Equal("#cf222e", v["--branch-1"]);
    }
}
