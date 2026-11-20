using System.Text;
using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// The preview's viewers (docs/plans/33-PLAN-preview-plugins.md 3.1-3.3): which a file has, which is shown, the old
// setting previewWindowsTypes as previewViewers, and lister plugins' detect strings.
public class ViewersTests
{
    static readonly Guid Office = Guid.Parse("84f66100-ff7c-4fb4-b0c0-02cd7fb668fe"), LexPenClsid = Guid.Parse("11111111-2222-3333-4444-555555555555");
    static readonly LexPenHandler LexPen = new(LexPenClsid, LexPenHandler.Parse(".md; cs,*.json"));

    static string[] Ids(List<Viewers.Viewer> list) => [.. list.Select(v => v.Id)];

    // In this order: Foldex's own, Windows', LexPen's for the types it lists, each plugin whose detect string takes it.
    [Fact]
    public void AFileHasItsViewersInOrder()
    {
        var listers = new[] { new Lister(@"C:\p\md.wlx64", "MdView", "EXT=\"MD\""), new Lister(@"C:\p\log.wlx64", "LogView", "EXT=\"LOG\"") };
        Assert.Equal(["foldex", "windows", "lexpen", "lister:MdView"], Ids(Viewers.For(@"C:\x\a.md", Office, LexPen, listers)));
        Assert.Equal(["foldex", "lister:LogView"], Ids(Viewers.For(@"C:\x\a.LOG", null, LexPen, listers)));
        Assert.Equal(["windows"], Ids(Viewers.For(@"C:\x\a.docx", Office, LexPen, listers)));
        Assert.Equal(["foldex"], Ids(Viewers.For(@"C:\x\a.md", null, null, [])));
        // LexPen's handler bound to the type for Explorer as well: once, as LexPen.
        Assert.Equal(["foldex", "lexpen"], Ids(Viewers.For(@"C:\x\a.cs", LexPenClsid, LexPen, [])));
    }

    // The one asked for, else the one kept for the extension, else the first; a kept viewer that is gone (a plugin
    // removed) falls back to the order.
    [Fact]
    public void TheViewerShownIsAskedKeptOrFirst()
    {
        List<Viewers.Viewer> list = [new("foldex", "Foldex"), new("windows", "Windows"), new("lister:MdView", "MdView")];
        var kept = new JsonObject { [".md"] = "lister:MdView", [".pdf"] = "windows", [".txt"] = "lister:Gone" };
        Assert.Equal("windows", Viewers.Pick(list, "windows", kept, @"C:\x\a.md"));
        Assert.Equal("lister:MdView", Viewers.Pick(list, null, kept, @"C:\x\a.MD"));
        Assert.Equal("lister:MdView", Viewers.Pick(list, "lexpen", kept, @"C:\x\a.md"));   // asked for one it has not
        Assert.Equal("foldex", Viewers.Pick(list, null, kept, @"C:\x\a.txt"));
        Assert.Equal("foldex", Viewers.Pick(list, null, null, @"C:\x\a.md"));
        Assert.Null(Viewers.Pick([], null, kept, @"C:\x\a.md"));
    }

    // previewWindowsTypes (".pdf; .svg") read as previewViewers: each extension Windows'; written back under the new name.
    [Fact]
    public void TheOldSettingBecomesTheViewersKept()
    {
        var shipped = File.ReadAllText(SettingsFile.DefaultsPath);
        var merged = SettingsFile.Merge(shipped, """{ "previewWindowsTypes": ".PDF; svg,*.docx" }""");
        Assert.Empty(merged["problems"]!.AsArray());
        var viewers = merged["values"]!["previewViewers"]!.AsObject();
        Assert.Equal("windows", viewers[".pdf"]!.GetValue<string>());
        Assert.Equal("windows", viewers[".svg"]!.GetValue<string>());
        Assert.Equal("windows", viewers[".docx"]!.GetValue<string>());
        var own = JsonNode.Parse(SettingsFile.Set(shipped, """{ "previewWindowsTypes": ".pdf" }""", "theme", JsonValue.Create("dark")))!.AsObject();
        Assert.False(own.ContainsKey("previewWindowsTypes"));
        Assert.Equal("windows", own["previewViewers"]![".pdf"]!.GetValue<string>());
        // Empty: nothing kept, nothing written.
        own = JsonNode.Parse(SettingsFile.Set(shipped, """{ "previewWindowsTypes": "" }""", "theme", JsonValue.Create("dark")))!.AsObject();
        Assert.False(own.ContainsKey("previewViewers"));
    }

    static bool Takes(string detect, string name, string text = "", long? size = null)
    {
        var bytes = Encoding.Latin1.GetBytes(text);
        return ListerDetect.Matches(detect, name, () => size ?? bytes.Length, () => bytes);
    }

    // Detect strings as Total Commander's plugins give them.
    [Fact]
    public void DetectStringsTakeTheirFiles()
    {
        Assert.True(Takes("EXT=\"TXT\" | EXT=\"LOG\"", @"C:\a.log"));
        Assert.False(Takes("EXT=\"TXT\" | EXT=\"LOG\"", @"C:\a.md"));
        Assert.True(Takes("(EXT=\"INI\" | EXT=\"CFG\") & SIZE<100000", @"C:\a.ini", size: 500));
        Assert.False(Takes("(EXT=\"INI\" | EXT=\"CFG\") & SIZE<100000", @"C:\a.ini", size: 200000));
        Assert.True(Takes("[0]=77 & [1]=90", @"C:\a.bin", "MZ.."));   // an exe's start
        Assert.True(Takes("[0]=\"M\"", @"C:\a.bin", "MZ"));
        Assert.False(Takes("[5]=0", @"C:\a.bin", "MZ"));   // past the end
        Assert.True(Takes("FIND(\"<?xml\")", @"C:\a.dat", "<?xml version=\"1.0\"?>"));
        Assert.False(Takes("FIND(\"<?XML\")", @"C:\a.dat", "<?xml"));
        Assert.True(Takes("FINDI(\"<?XML\")", @"C:\a.dat", "<?xml"));
        Assert.True(Takes("!(EXT=\"EXE\")", @"C:\a.txt"));
        Assert.True(Takes("EXT=\"md\" OR EXT=\"markdown\"", @"C:\a.markdown"));
        Assert.True(Takes("NOT EXT=\"EXE\" AND SIZE>=0", @"C:\a.txt"));
        Assert.True(Takes("EXT!=\"EXE\"", @"C:\a.txt"));
        Assert.True(Takes("", @"C:\a.any"));   // no detect string: every file
        Assert.False(Takes("MULTIMEDIA", @"C:\a.mp4"));
        Assert.False(Takes("MULTIMEDIA | FORCE", @"C:\a.mp4"));
        Assert.True(Takes("MULTIMEDIA | EXT=\"MP4\"", @"C:\a.mp4"));
        Assert.False(Takes("EXT=\"TXT", @"C:\a.txt"));   // not understood: nothing
        Assert.False(Takes("EXT=\"TXT\" )", @"C:\a.txt"));
        Assert.False(Takes("SOMETHING(1)", @"C:\a.txt"));
    }
}
