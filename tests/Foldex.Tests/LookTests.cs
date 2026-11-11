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
    public void AtTheDefaultsTheInsideIsTheWindowsColourWithAShareOfTheBranchColour()
    {
        var v = Vars("{}");
        Assert.Equal("#0969da", v["--branch-0"]);
        Assert.Equal("1", v["--head-mix"]);
        Assert.Equal("color-mix(in srgb, var(--branch-0) 8%, var(--bg))", v["--branch-0-bg"]);
        Assert.Equal("color-mix(in srgb, var(--branch-0) 8%, var(--bg-side))", v["--branch-0-bg-side"]);
        Assert.Equal("color-mix(in srgb, var(--branch-0) 34.1%, var(--select))", v["--branch-0-select"]);
        Assert.Equal("color-mix(in srgb, var(--branch-0) 15.4%, var(--hover))", v["--branch-0-hover"]);
        Assert.Equal("var(--branch-0)", v["--branch-0-accent"]);
    }

    [Fact]
    public void MixZeroIsTheWindowsOwnAndHundredTheBranchColourAtItsIntensity()
    {
        var none = Vars("{ paneThemeMix: 0 }");
        Assert.Equal("var(--bg)", none["--branch-0-bg"]);
        Assert.Equal("var(--select)", none["--branch-1-select"]);   // also a colour the pane theme sets
        Assert.Equal("var(--accent)", none["--branch-0-accent"]);
        Assert.Equal("var(--branch-0)", Vars("{ paneThemeMix: 100 }")["--branch-0-bg"]);
        Assert.Equal("color-mix(in srgb, var(--branch-0) 50%, var(--bg))", Vars("{ paneThemeMix: 50 }")["--branch-0-bg"]);
    }

    [Fact]
    public void TheHeadMixIsAFactorForAppCss()
    {
        Assert.Equal("0", Vars("{ paneHeadMix: 0 }")["--head-mix"]);
        Assert.Equal("0.5", Vars("{ paneHeadMix: 50 }")["--head-mix"]);
    }

    [Fact]
    public void IntensityGoesFromTheBackgroundToTheTextColour()
    {
        Assert.Equal("var(--bg)", Vars("{ paneThemeIntensity: 0 }")["--branch-0"]);
        Assert.Equal("color-mix(in srgb, #0969da 50%, var(--bg))", Vars("{ paneThemeIntensity: 50 }")["--branch-0"]);
        Assert.Equal("var(--fg)", Vars("{ paneThemeIntensity: 200 }")["--branch-0"]);
    }

    [Fact]
    public void AColourThePaneThemeSetsIsUsedAsItIs()
    {
        Assert.Equal("#ffcccc", Vars("{}")["--branch-1-select"]);
        Assert.Equal("#ffcccc", Vars("{ paneThemeMix: 100 }")["--branch-1-select"]);
    }
}
