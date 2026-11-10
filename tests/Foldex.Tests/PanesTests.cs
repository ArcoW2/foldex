using System.Text.Json;

namespace Foldex.Tests;

// web/panes.js run under Jint: the panes of a window, their connections and branches (docs/plans/03-PLAN-connected-panes.md).
public class PanesTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "panes.js"));

    // The example of plan 03 3.2: A (tree) drives B (red) and C (blue); B drives D (preview).
    const string Example = """
        const l = new Layout();
        const A = l.add({ kind: 'tree', content: 'folders' });
        const B = l.add({ source: A, colour: 'red' });
        const C = l.add({ source: A, colour: 'blue' });
        const D = l.add({ source: B, kind: 'preview' });
        """;

    static JsonElement Run(string setup, string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.Execute(setup);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    static string Str(JsonElement e) => e.ValueKind == JsonValueKind.Null ? "null" : e.ToString();

    [Fact]
    public void TheFirstPaneIsTheRootAndCannotBeClosed()
    {
        var r = Run("const l = new Layout(); const A = l.add({ kind: 'tree' }); const B = l.add({ source: A });",
            "[l.root === A, l.closable(A), l.closable(B), l.remove(A), l.panes.size]");
        Assert.Equal("[true,false,true,false,2]", r.GetRawText());
    }

    [Fact]
    public void ACycleIsRefused()
    {
        var r = Run(Example, "[l.connect(B, D), l.connect(A, B), l.connect(D, C), l.pane(D).source === C]");
        Assert.Equal("[false,false,true,true]", r.GetRawText());
    }

    [Fact]
    public void ANewFollowerJoinsTheActiveBranch()
    {
        var r = Run(Example + "l.activate(C); const E = l.add({ source: A });", "l.pane(E).colour");
        Assert.Equal("blue", Str(r));
    }

    [Fact]
    public void AFolderFocusedInTheSourceIsShownByTheFollowersOfTheActiveBranchOnly()
    {
        var r = Run(Example + "l.activate(B); const u = l.focus(A, { id: 'C:\\\\Projects', folder: true });",
            "[u, l.state(B).location, l.state(C).location]");
        // B's preview D empties: nothing is focused in B's new folder yet.
        Assert.Equal("""[[{"pane":"p2","location":"C:\\Projects"},{"pane":"p4","show":null}],"C:\\Projects",null]""", r.GetRawText());
    }

    [Fact]
    public void ActivatingAnotherBranchRestoresTheSourcesStateForIt()
    {
        var r = Run(Example + """
            l.activate(B); l.focus(A, { id: 'C:\\Projects', folder: true });
            const changed = l.activate(C); l.focus(A, { id: 'C:\\Temp', folder: true });
            const blueFocus = l.state(A).focus;
            const back = l.activate(D);
            """, "[changed, blueFocus, back, l.state(A).focus, l.state(B).location, l.state(C).location]");
        Assert.Equal("""[["p1"],"C:\\Temp",["p1"],"C:\\Projects","C:\\Projects","C:\\Temp"]""", r.GetRawText());
    }

    [Fact]
    public void ANewBranchStartsFromACopyOfTheSourcesState()
    {
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' });
            const B = l.add({ source: A, colour: 'red' }); l.focus(A, { id: 'D:\\', folder: true });
            const C = l.add({ source: A, colour: 'blue' }); l.activate(C);
            """, "l.state(A).focus");
        Assert.Equal(@"D:\", Str(r));
    }

    [Fact]
    public void AFileFocusedGoesToThePreviewNotToAFolderFollower()
    {
        var r = Run(Example + "l.activate(D); const u = l.focus(B, { id: 'C:\\\\a.docx', folder: false });",
            "[u, l.state(B).focus]");
        Assert.Equal("""[[{"pane":"p4","show":"C:\\a.docx"}],"C:\\a.docx"]""", r.GetRawText());
    }

    [Fact]
    public void APinnedFollowerDoesNotFollow()
    {
        var r = Run(Example + "l.activate(B); l.pane(B).pinned = true; const u = l.focus(A, { id: 'C:\\\\X', folder: true });",
            "[u.length, l.state(B).location]");
        Assert.Equal("[0,null]", r.GetRawText());
    }

    [Fact]
    public void ExecutingAFolderInAFollowerLetsItsSourceOpenIt()
    {
        var r = Run(Example + "l.activate(B); const x = l.execute(B, { id: 'C:\\\\Projects\\\\Foldex', folder: true });",
            "[x.reveal, x.updates, l.state(A).focus]");
        Assert.Equal("""[{"pane":"p1","item":"C:\\Projects\\Foldex"},[{"pane":"p2","location":"C:\\Projects\\Foldex"},{"pane":"p4","show":null}],"C:\\Projects\\Foldex"]""",
            r.GetRawText());
    }

    [Fact]
    public void ExecutingAFolderInAPaneWithoutASourceExpandsItThere()
    {
        var r = Run(Example + "l.activate(B); const x = l.execute(A, { id: 'D:\\\\', folder: true });",
            "[x.expand, x.reveal ?? null, l.state(B).location]");
        Assert.Equal("""[{"pane":"p1","item":"D:\\"},null,"D:\\"]""", r.GetRawText());
    }

    [Fact]
    public void ADisconnectedListExpandsAFolderInPlaceToo()
    {
        var r = Run(Example + "l.disconnect(B); const x = l.execute(B, { id: 'C:\\\\X', folder: true });", "[x.expand, l.state(A).focus]");
        Assert.Equal("""[{"pane":"p2","item":"C:\\X"},null]""", r.GetRawText());
    }

    [Fact]
    public void ExecutingAFileOpensIt()
    {
        var r = Run(Example, "l.execute(B, { id: 'C:\\\\a.txt', folder: false })");
        Assert.Equal("""{"open":"C:\\a.txt","updates":[]}""", r.GetRawText());
    }

    [Fact]
    public void RemovingAMiddlePaneConnectsItsFollowersToItsSource()
    {
        var r = Run(Example + "l.remove(B);", "[l.pane(D).source, l.panes.has(B)]");
        Assert.Equal("""["p1",false]""", r.GetRawText());
    }

    [Fact]
    public void ADisconnectedPaneMayBeClosed()
    {
        var r = Run(Example + "l.disconnect(C);", "[l.pane(C).source, l.closable(C), l.remove(C)]");
        Assert.Equal("[null,true,true]", r.GetRawText());
    }

    [Fact]
    public void TheLayoutComesBackFromItsJson()
    {
        var r = Run(Example + """
            l.activate(C); l.focus(A, { id: 'C:\\Temp', folder: true });
            const again = Layout.fromJSON(JSON.parse(JSON.stringify(l)));
            """, "[again.root, again.panes.size, again.state(A).focus, again.pane(D).source]");
        Assert.Equal("""["p1",4,"C:\\Temp","p2"]""", r.GetRawText());
    }
}
