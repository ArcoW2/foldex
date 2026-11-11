using System.Text.Json;

namespace Foldex.Tests;

// web/panes.js run under Jint: the panes of a window, their connections and branches (docs/plans/executed/03-PLAN-connected-panes.md).
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
    public void AParentTakesTheColourOfThePathItServes()
    {
        // T -> B (0) -> C (0) and D (new); with D's branch shown, T and B are in D's colour; back to C, in 0 again.
        var r = Run("""
            const l = new Layout(); const T = l.add({ kind: 'tree' });
            const B = l.add({ source: T }); const C = l.add({ source: B }); const D = l.add({ source: B });
            l.activate(D); const onD = [T, B, C, D].map(id => l.pathColour(id));
            l.activate(C); const onC = [T, B, C, D].map(id => l.pathColour(id));
            """, "[onD, onC]");
        Assert.Equal("[[1,1,0,1],[0,0,0,1]]", r.GetRawText());
    }

    [Fact]
    public void TreeLinesPassJoinAndEnd()
    {
        // Plan 16 3.2: A { B { C }, D { E } }, F. A's line goes past B and C to D; C ends B's; D is A's last child; F a root.
        var r = Run("", "treeGuides([0, 1, 2, 1, 2, 0]).map(g => g.levels.join('/') + (g.down ? ' down' : ''))");
        Assert.Equal("[\" down\",\"mid down\",\"pass/end\",\"end down\",\"/end\",\"\"]", r.GetRawText());
    }

    [Fact]
    public void ARootWithoutChildrenHasTheFirstBranchsColour()
    {
        // Plan 13 3.4: the start of the first branch; a root with children takes the path it serves.
        var r = Run("""
            const l = new Layout(); const T = l.add({ kind: 'tree' }); const R = l.add({});
            const B = l.add({ source: T }); const C = l.add({ source: T });
            l.activate(C);
            """, "[l.pathColour(R), l.pathColour(T)]");
        Assert.Equal("[0,1]", r.GetRawText());
    }

    [Fact]
    public void TheChildrenOfTwoRootsTakeDifferentColours()
    {
        // A's children take branches 0 and 1; the first child of a second root E takes 2, not 0 again.
        var r = Run("""
            const l = new Layout(); const A = l.add({ kind: 'tree' });
            l.add({ source: A }); l.add({ source: A });
            const E = l.add({ kind: 'tree' }); const F = l.add({ source: E });
            """, "[...l.panes.values()].map(p => p.colour)");
        Assert.Equal("[null,0,1,null,2]", r.GetRawText());
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

    // History per pane (docs/plans/executed/17-PLAN-history-per-pane.md): a tree A and its list B; `to` focuses a folder in A
    // (B follows) and records both, as the page does once things rest.
    const string Histories = """
        const l = new Layout();
        const A = l.add({ kind: 'tree', content: 'folders' });
        const B = l.add({ source: A });
        const to = f => { l.focus(A, { id: f, folder: true }); l.record(A); l.record(B); };
        const places = id => l.history(id).steps.map(s => s.focus ?? s.location).join(',') + '@' + l.history(id).at;
        """;

    [Fact]
    public void AStepOnAFolderChangeNotOnASelection()
    {
        var r = Run(Histories + """
            to('a'); to('b');
            l.state(B).selection = ['b/x']; l.record(B);
            """, "[places(A), places(B), l.history(B).steps[1].selection]");
        Assert.Equal("""["a,b@1","a,b@1",["b/x"]]""", r.GetRawText());
    }

    [Fact]
    public void BackInAChildIsBackInItsParent()
    {
        var r = Run(Histories + """
            to('a'); to('b'); to('c');
            const went = l.go(B, -1);
            """, "[went, l.historyPane(B), l.state(A).focus, places(A), l.canGo(B, 1), l.canGo(B, -1)]");
        Assert.Equal("""["p1","p1","b","a,b,c@1",true,true]""", r.GetRawText());
    }

    [Fact]
    public void ANewFolderAfterBackDropsTheStepsAhead()
    {
        var r = Run(Histories + """
            to('a'); to('b'); to('c');
            l.go(A, -1); l.go(A, -1); l.record(A);
            to('d');
            """, "[places(A), l.canGo(A, 1)]");
        Assert.Equal("""["a,d@1",false]""", r.GetRawText());
    }

    [Fact]
    public void AHistoryKeepsAtMostAHundredSteps()
    {
        var r = Run(Histories + "for (let i = 0; i < 120; i++) to('f' + i);",
            "[l.history(A).steps.length, l.history(A).steps[0].focus, l.history(A).at]");
        Assert.Equal("""[100,"f20",99]""", r.GetRawText());
    }

    [Fact]
    public void APinnedChildGoesBackInItsOwnHistoryWithWhatItShowedBeforeThePin()
    {
        var r = Run(Histories + """
            to('a'); to('b');
            l.pane(B).pinned = true;
            const pinned = l.historyPane(B), went = l.go(B, -1), shows = l.state(B).location, tree = l.state(A).focus;
            l.pane(B).pinned = false;
            """, "[pinned, went, shows, tree, l.historyPane(B)]");
        Assert.Equal("""["p2","p2","a","b","p1"]""", r.GetRawText());
    }

    [Fact]
    public void AfterBackAChildGetsBackWhatItHadSelectedThere()
    {
        var r = Run(Histories + """
            to('a'); l.state(B).selection = ['a/x']; l.state(B).focus = 'a/x'; l.record(B);
            to('b');
            l.go(A, -1);
            const u = l.focus(A, { id: 'a', folder: true });
            const recalled = [u[0].recalled, l.state(B).selection, l.state(B).focus];
            const later = l.focus(A, { id: "b", folder: true });
            """, "[recalled, later[0].recalled ?? null, l.state(B).selection]");
        Assert.Equal("""[[true,["a/x"],"a/x"],null,[]]""", r.GetRawText());
    }

    [Fact]
    public void AChildOfAChildGoesBackInTheRoot()
    {
        var r = Run(Histories + "const C = l.add({ source: B });", "l.historyPane(C)");
        Assert.Equal("\"p1\"", r.GetRawText());
    }

    [Fact]
    public void AParentKeepsAHistoryPerBranch()
    {
        var r = Run(Histories + """
            const C = l.add({ source: A, colour: 3 });
            l.activate(B); to('red');
            l.activate(C); l.focus(A, { id: 'blue', folder: true }); l.record(A);
            const blue = places(A);
            l.activate(B);
            """, "[blue, places(A)]");
        Assert.Equal("""["blue@0","red@0"]""", r.GetRawText());
    }

    [Fact]
    public void HistoriesComeBackWithTheLayout()
    {
        var r = Run(Histories + """
            to('a'); to('b'); l.go(A, -1);
            const again = Layout.fromJSON(JSON.parse(JSON.stringify(l)));
            const went = again.go(A, 1);
            """, "[went, again.state(A).focus, again.history(A).at]");
        Assert.Equal("""["p1","b",1]""", r.GetRawText());
    }
}
