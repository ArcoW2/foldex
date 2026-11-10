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
    public void TheFirstPaneIsTheRoot()
    {
        var r = Run("const l = new Layout(); const A = l.add({ kind: 'tree' }); const B = l.add({ source: A });",
            "[l.root === A, l.pane(A).source, l.pane(B).source === A]");
        Assert.Equal("[true,null,true]", r.GetRawText());
    }

    [Fact]
    public void ClosingTheRootMakesItsChildrenRoots()
    {
        var r = Run(Example + "l.remove(A);", "[l.root, l.pane(B).source, l.pane(C).source, l.pane(D).source]");
        Assert.Equal("""["p2",null,null,"p2"]""", r.GetRawText());
    }

    [Fact]
    public void TheLastPaneCanBeClosedAndANewOneIsARoot()
    {
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' }); l.remove(A);
            const before = [l.root, l.panes.size]; const N = l.add();
            """, "[before, l.root === N]");
        Assert.Equal("[[null,0],true]", r.GetRawText());
    }

    [Fact]
    public void AFileFocusedInTheParentLeavesAFolderChildAsItIs()
    {
        var r = Run(Example + """
            l.activate(B); l.focus(A, { id: 'C:\\X', folder: true });
            const u = l.focus(A, { id: 'C:\\a.txt', folder: false });
            """, "[u.length, l.state(B).location]");
        Assert.Equal("""[0,"C:\\X"]""", r.GetRawText());
    }

    [Fact]
    public void ACycleIsRefused()
    {
        var r = Run(Example, "[l.connect(B, D), l.connect(A, B), l.connect(D, C), l.pane(D).source === C]");
        Assert.Equal("[false,false,true,true]", r.GetRawText());
    }

    [Fact]
    public void AFirstChildContinuesItsParentsBranch()
    {
        var r = Run(Example + "const E = l.add({ source: C });", "[l.pane(D).colour, l.pane(E).colour]");
        Assert.Equal("""["red","blue"]""", r.GetRawText());
    }

    [Fact]
    public void ANewChildTakesTheSettingsOfTheCurrentChild()
    {
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' });
            const B = l.add({ source: A, content: 'files' }); const P = l.add({ source: B, kind: 'preview' });
            const first = l.childSettings(B);
            """, "[l.childSettings(A), first]");
        // A preview child is not copied: B's new child gets the defaults.
        Assert.Equal("""[{"kind":"list","content":"files"},{"kind":"list","content":"both"}]""", r.GetRawText());
    }

    [Fact]
    public void AFurtherChildStartsANewBranchWithItsOwnState()
    {
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' });
            const B = l.add({ source: A }); l.focus(A, { id: 'C:\\X', folder: true });
            const C = l.add({ source: A }); l.activate(C); l.focus(A, { id: 'C:\\Y', folder: true });
            const first = l.pane(B).colour, second = l.pane(C).colour;
            l.activate(B);
            """, "[first, second, l.state(A).focus, l.state(B).location, l.state(C).location]");
        Assert.Equal("""[0,1,"C:\\X","C:\\X","C:\\Y"]""", r.GetRawText());
    }

    [Fact]
    public void WithEveryBranchTakenANewChildGetsTheOneUsedLeast()
    {
        // Six children of A take branches 0 to 5; a child of p2 continues its branch 0 (used twice now); the next
        // child of A gets branch 1, the first of those used least.
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' });
            for (let i = 0; i < 6; i++) l.add({ source: A });
            l.add({ source: 'p2' }); l.add({ source: A });
            """, "[...l.panes.values()].map(p => p.colour)");
        Assert.Equal("[null,0,1,2,3,4,5,0,1]", r.GetRawText());
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
    public void AListThatBecameARootOpensAFolderInItself()
    {
        var r = Run(Example + "l.remove(A); const x = l.execute(B, { id: 'C:\\\\X', folder: true });", "[x.expand ?? null, x.reveal]");
        Assert.Equal("""[null,{"pane":"p2","item":"C:\\X"}]""", r.GetRawText());
    }

    [Fact]
    public void ADetachedChildBecomesARootKeepingItsChildrenAndTheParentForgetsTheBranch()
    {
        var r = Run(Example + "l.activate(B); l.focus(A, { id: 'C:\\\\X', folder: true }); l.activate(C); l.detach(B);",
            "[l.pane(B).source, l.pane(B).colour, l.pane(D).source === B, Object.keys(l.pane(A).states).filter(k => k), l.state(B).location]");
        Assert.Equal("""[null,null,true,["blue"],"C:\\X"]""", r.GetRawText());
    }

    [Fact]
    public void AParentWhoseLastChildIsDetachedKeepsWhatItShowed()
    {
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' }); const B = l.add({ source: A });
            l.focus(A, { id: 'C:\\X', folder: true }); l.detach(B);
            """, "l.state(A).focus");
        Assert.Equal(@"C:\X", Str(r));
    }

    [Fact]
    public void AttachingRefusesACycleAndTakesANewBranchBesideOtherChildren()
    {
        var r = Run(Example + "const cycle = l.attach(A, D); const ok = l.attach(C, B);",
            "[cycle, ok, l.pane(C).source === B, l.pane(C).colour !== l.pane(D).colour, l.followers(A).length]");
        Assert.Equal("[false,true,true,true,1]", r.GetRawText());
    }

    [Fact]
    public void AnotherColourStartsANewBranchOrJoinsASiblings()
    {
        var r = Run(Example + """
            l.activate(B); l.focus(A, { id: 'C:\\X', folder: true });
            l.activate(C); l.focus(A, { id: 'C:\\Y', folder: true });
            l.setColour(C, 2);
            const own = [l.pane(C).colour, l.state(A).focus, Object.keys(l.pane(A).states).filter(k => k).sort()];
            const u = l.setColour(C, 'red');
            """, "[own, u, l.state(A).focus, Object.keys(l.pane(A).states).filter(k => k)]");
        // C keeps its folder in a branch of its own; joining red, it follows red's folder.
        Assert.Equal("""[[2,"C:\\Y",["2","red"]],[{"pane":"p3","location":"C:\\X"}],"C:\\X",["red"]]""", r.GetRawText());
    }

    [Fact]
    public void ExecutingAFileOpensIt()
    {
        var r = Run(Example, "l.execute(B, { id: 'C:\\\\a.txt', folder: false })");
        Assert.Equal("""{"open":"C:\\a.txt","updates":[]}""", r.GetRawText());
    }

    [Fact]
    public void ClosingAMiddlePaneGivesItsChildrenItsParent()
    {
        var r = Run(Example + "l.remove(B);", "[l.pane(D).source, l.pane(D).colour, l.panes.has(B)]");
        // D keeps its own colour, the red it took over from B.
        Assert.Equal("""["p1","red",false]""", r.GetRawText());
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
