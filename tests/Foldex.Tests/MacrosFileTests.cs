using System.Text.Json.Nodes;

namespace Foldex.Tests;

// macros\macros.json (docs/plans/34-PLAN-macros.md 3.5): the tree read, written and read back; what is kept of an entry;
// a file that cannot be read counts as empty and stays as it is.
public class MacrosFileTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-macros-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        try { Directory.Delete(dir, true); } catch (IOException) { }
    }

    [Fact]
    public void TheTreeIsWrittenAndReadBackInItsOrder()
    {
        Assert.Empty(MacrosFile.Load(dir));   // not there yet
        var tree = JsonNode.Parse("""
            [ { "id": "a1", "name": "Notepad", "icon": "C:\\x.ico,2", "key": "ctrl+alt+n", "text": "run \"notepad.exe\" $$focused" },
              { "id": "f1", "folder": "Tools", "items": [
                  { "id": "f2", "folder": "Deeper", "items": [ { "id": "a2", "name": "Two deep", "text": "log 1" } ] },
                  { "id": "a1", "name": "  ", "key2": "nonsense key", "text": 5 } ] },
              "a plain string", { "neither": true } ]
            """);
        var saved = MacrosFile.Save(dir, tree);
        Assert.True(File.Exists(Path.Combine(dir, "macros", "macros.json")));
        var read = MacrosFile.Load(dir);
        Assert.Equal(saved.ToJsonString(), read.ToJsonString());
        Assert.Equal(2, read.Count);
        Assert.Equal("Notepad", read[0]!["name"]!.GetValue<string>());
        Assert.Equal("Ctrl+Alt+N", read[0]!["key"]!.GetValue<string>());
        Assert.Equal("run \"notepad.exe\" $$focused", read[0]!["text"]!.GetValue<string>());
        Assert.Equal("Two deep", read[1]!["items"]![0]!["items"]![0]!["name"]!.GetValue<string>());
        // The second "a1": a new id; no name: "Macro"; a key that is none and a text that is no text: left out, empty.
        var second = read[1]!["items"]![1]!;
        Assert.NotEqual("a1", second["id"]!.GetValue<string>());
        Assert.Equal("Macro", second["name"]!.GetValue<string>());
        Assert.Null(second["key2"]);
        Assert.Equal("", second["text"]!.GetValue<string>());
    }

    [Fact]
    public void AFileThatCannotBeReadCountsAsEmptyAndStaysAsItIs()
    {
        Directory.CreateDirectory(Path.Combine(dir, "macros"));
        var path = Path.Combine(dir, "macros", "macros.json");
        File.WriteAllText(path, "{ this is not json");
        Assert.Empty(MacrosFile.Load(dir));
        Assert.Equal("{ this is not json", File.ReadAllText(path));
    }
}
