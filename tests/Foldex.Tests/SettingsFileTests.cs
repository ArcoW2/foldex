using System.Text.Json.Nodes;

namespace Foldex.Tests;

public class SettingsFileTests
{
    const string Defaults = """
        // comment
        {
          "followWindows": true,
          "theme": "light",
          "view.*": "list",
        }
        """;

    [Fact]
    public void UserValuesOverrideDefaults()
    {
        var merged = SettingsFile.Merge(Defaults, """{ "theme": "dark" }""");
        Assert.Equal("dark", merged["values"]!["theme"]!.GetValue<string>());
        Assert.True(merged["values"]!["followWindows"]!.GetValue<bool>());
        Assert.Equal(["theme"], merged["user"]!.AsArray().Select(n => n!.GetValue<string>()));
        Assert.Empty(merged["problems"]!.AsArray());
    }

    [Fact]
    public void UnknownNamesAndWrongKindsAreReportedAndSkipped()
    {
        var merged = SettingsFile.Merge(Defaults, """{ "nope": 1, "theme": 2 }""");
        Assert.Equal("light", merged["values"]!["theme"]!.GetValue<string>());
        Assert.Null(merged["values"]!["nope"]);
        Assert.Equal(2, merged["problems"]!.AsArray().Count);
    }

    [Fact]
    public void FamilyMembersAreSettings()
    {
        var merged = SettingsFile.Merge(Defaults, """{ "view.details": "icons" }""");
        Assert.Equal("icons", merged["values"]!["view.details"]!.GetValue<string>());
        Assert.Empty(merged["problems"]!.AsArray());
    }

    [Fact]
    public void UnreadableUserFileLeavesDefaults()
    {
        var merged = SettingsFile.Merge(Defaults, "{ not json");
        Assert.Equal("light", merged["values"]!["theme"]!.GetValue<string>());
        Assert.Single(merged["problems"]!.AsArray());
    }

    [Fact]
    public void SetToTheDefaultRemovesTheValue()
    {
        var text = SettingsFile.Set(Defaults, """{ "theme": "dark" }""", "theme", JsonValue.Create("light"));
        Assert.Empty(JsonNode.Parse(text)!.AsObject());
    }

    [Fact]
    public void SetRefusesUnknownNames()
    {
        Assert.Throws<ArgumentException>(() => SettingsFile.Set(Defaults, null, "nope", JsonValue.Create(1)));
    }

    // ignorePaneActivationClick split into one for a root pane and one for a child: the old name's value is both new
    // ones' (a new one set in the file wins), no problem reported; written back, the file has the new names.
    [Fact]
    public void ARenamedSettingGivesItsValueToItsNewNames()
    {
        var shipped = File.ReadAllText(SettingsFile.DefaultsPath);
        var merged = SettingsFile.Merge(shipped, """{ "ignorePaneActivationClick": true, "ignoreChildPaneActivationClick": false }""");
        Assert.Empty(merged["problems"]!.AsArray());
        Assert.True(merged["values"]!["ignoreRootPaneActivationClick"]!.GetValue<bool>());
        Assert.False(merged["values"]!["ignoreChildPaneActivationClick"]!.GetValue<bool>());
        var text = SettingsFile.Set(shipped, """{ "ignorePaneActivationClick": true }""", "theme", JsonValue.Create("dark"));
        var own = JsonNode.Parse(text)!.AsObject();
        Assert.False(own.ContainsKey("ignorePaneActivationClick"));
        Assert.True(own["ignoreRootPaneActivationClick"]!.GetValue<bool>());
        Assert.True(own["ignoreChildPaneActivationClick"]!.GetValue<bool>());
    }

    [Fact]
    public void ShippedDefaultsParse()
    {
        var merged = SettingsFile.Merge(File.ReadAllText(SettingsFile.DefaultsPath), null);
        Assert.Empty(merged["problems"]!.AsArray());
    }
}
