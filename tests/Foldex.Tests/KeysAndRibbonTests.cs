using System.Text.Json.Nodes;

namespace Foldex.Tests;

public class KeysAndRibbonTests
{
    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;
    static readonly string Defaults = AppHost.FindProjectFolder(AppContext.BaseDirectory, "defaults")!;

    [Theory]
    [InlineData("shift+ctrl+s", "Ctrl+Shift+S")]
    [InlineData("ctrl+k,k", "Ctrl+K, K")]
    [InlineData("alt+return", "Alt+Enter")]
    [InlineData("Delete", "Del")]
    public void KeysAreSpelledOneWay(string written, string spelled) => Assert.Equal(spelled, KeysFile.Normalize(written));

    [Theory]
    [InlineData("Ctrl+Nope")]
    [InlineData("Win+E")]
    [InlineData("Ctrl+K, K, K")]
    public void NonKeysAreRefused(string written) => Assert.Null(KeysFile.Normalize(written));

    [Fact]
    public void UserKeysOverrideAndNullTakesAKeyAway()
    {
        var merged = KeysFile.Merge("""{ "F5": "refresh", "F6": "pane.next" }""", """{ "f5": null, "Ctrl+R": "refresh", "bad key": "x" }""");
        var keys = merged["keys"]!.AsObject();
        Assert.False(keys.ContainsKey("F5"));
        Assert.Equal("refresh", keys["Ctrl+R"]!.GetValue<string>());
        Assert.Single(merged["problems"]!.AsArray());
    }

    [Fact]
    public void ARibbonItemMustBeADividerOrAnAction()
    {
        var problems = new JsonArray();
        var ribbon = RibbonFile.Parse("""{ "tabs": [ { "name": "Home", "groups": [ { "name": "G", "items": [ "divider", { "action": "refresh" }, 3 ] } ] } ] }""",
            problems, "test");
        Assert.Equal(2, ribbon!["tabs"]![0]!["groups"]![0]!["items"]!.AsArray().Count);
        Assert.Single(problems);
    }

    // Every key in the shipped keys.json and every button of the shipped ribbon names an action actions.js has.
    [Fact]
    public void ShippedKeysAndRibbonNameKnownActions()
    {
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(Web, "actions.js")));
        var known = engine.Evaluate("JSON.stringify([...actions.keys()])").ToString();
        var names = JsonNode.Parse(known)!.AsArray().Select(n => n!.GetValue<string>()).ToHashSet();

        var keys = KeysFile.Merge(File.ReadAllText(Path.Combine(Defaults, "keys.json")), null);
        Assert.Empty(keys["problems"]!.AsArray());
        foreach (var (key, value) in keys["keys"]!.AsObject())
        {
            var name = value is JsonArray list ? list[0]!.GetValue<string>() : value!.GetValue<string>();
            Assert.True(names.Contains(name), $"{key}: {name}");
        }

        var problems = new JsonArray();
        var ribbon = RibbonFile.Parse(File.ReadAllText(Path.Combine(Defaults, "ribbon.json")), problems, "shipped");
        Assert.Empty(problems);
        foreach (var item in ribbon!["tabs"]!.AsArray().SelectMany(t => t!["groups"]!.AsArray()).SelectMany(g => g!["items"]!.AsArray()))
            if (item is JsonObject o) Assert.True(names.Contains(o["action"]!.GetValue<string>()), o["action"]!.GetValue<string>());
    }
}
