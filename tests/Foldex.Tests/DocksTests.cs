using System.Text.Json;

namespace Foldex.Tests;

// web/docks.js run under Jint: where the panes of a window are (docs/plans/executed/12-PLAN-docking-and-pane-menu.md 3.1).
public class DocksTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "docks.js"));

    static string Run(string setup, string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.Execute("const d = new Docks();" + setup);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement.GetRawText();
    }

    // A node written short: a group as its panes joined by "|" with the shown one in brackets, a split as dir(...).
    const string Shape = """
        const shape = n => !n ? null : n.type === 'group'
          ? n.panes.map(p => p === n.shown && n.panes.length > 1 ? `[${p}]` : p).join('|')
          : `${n.dir}(${n.children.map(shape).join(', ')})`;
        """;

    [Fact]
    public void TheDefaultLayoutIsATreeLeftAndAListInTheCenter()
    {
        var r = Run(Shape + "d.add('p1', { area: 'left' }); d.add('p2', { area: 'center' });",
            "[shape(d.areas.left), shape(d.areas.center), d.areaOf('p2')]");
        Assert.Equal("""["p1","p2","center"]""", r);
    }

    [Fact]
    public void APaneAsATabBesideAndUnderAGroup()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'center' });
            d.add('p2', { pane: 'p1', side: 'tab' });
            d.add('p3', { pane: 'p1', side: 'right' });
            d.add('p4', { pane: 'p3', side: 'bottom' });
            d.add('p5', { pane: 'p4', side: 'bottom' });
            """, "[shape(d.areas.center), d.visible('p1'), d.visible('p2')]");
        Assert.Equal("""["row(p1|[p2], column(p3, p4, p5))",false,true]""", r);
    }

    [Fact]
    public void TheLastPaneOfAGroupGoneTakesTheGroupAndAnEmptyAreaAway()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'left' }); d.add('p2', { area: 'center' }); d.add('p3', { pane: 'p2', side: 'right' });
            d.remove('p3'); d.remove('p1');
            """, "[shape(d.areas.left), shape(d.areas.center)]");
        Assert.Equal("""[null,"p2"]""", r);
    }

    [Fact]
    public void RemovingTheShownTabShowsTheNextOne()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'center' }); d.add('p2', { pane: 'p1', side: 'tab' }); d.add('p3', { pane: 'p2', side: 'tab' });
            d.show('p2'); d.remove('p2');
            """, "shape(d.areas.center)");
        Assert.Equal("\"p1|[p3]\"", r);
    }

    // A tab dropped between two tabs (`at`, among the tabs without it): moved within its own group, or from elsewhere.
    [Fact]
    public void ATabDroppedBetweenTabs()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'center' }); d.add('p2', { pane: 'p1', side: 'tab' }); d.add('p3', { pane: 'p2', side: 'tab' });
            d.add('p3', { pane: 'p1', side: 'tab', at: 0 });
            const own = shape(d.areas.center);
            d.add('p1', { pane: 'p2', side: 'tab', at: 2 });
            const last = shape(d.areas.center);
            d.add('p4', { area: 'left' });
            d.add('p4', { pane: 'p3', side: 'tab', at: 1 });
            """, "[own, last, shape(d.areas.center), shape(d.areas.left)]");
        Assert.Equal("""["[p3]|p1|p2","p3|p2|[p1]","p3|[p4]|p2|p1",null]""", r);
    }

    [Fact]
    public void MovingAPaneBetweenGroupsAndAreas()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'left' }); d.add('p2', { area: 'center' }); d.add('p3', { pane: 'p2', side: 'right' });
            d.add('p3', { pane: 'p1', side: 'tab' });
            d.add('p2', { area: 'bottom' });
            """, "[shape(d.areas.left), shape(d.areas.center), shape(d.areas.bottom)]");
        Assert.Equal("""["p1|[p3]",null,"p2"]""", r);
    }

    [Fact]
    public void ASplitLeftWithOneNodeIsReplacedByIt()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'center' }); d.add('p2', { pane: 'p1', side: 'right' }); d.add('p3', { pane: 'p2', side: 'bottom' });
            d.remove('p2');
            """, "shape(d.areas.center)");
        Assert.Equal("\"row(p1, p3)\"", r);
    }

    [Fact]
    public void ALayoutReadBackIsTheSame()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'left' }); d.add('p2', { area: 'center' }); d.add('p3', { pane: 'p2', side: 'tab' });
            d.sizes.left = 333;
            const back = Docks.fromJSON(JSON.parse(JSON.stringify(d)));
            """, "[shape(back.areas.left), shape(back.areas.center), back.sizes.left]");
        Assert.Equal("""["p1","p2|[p3]",333]""", r);
    }

    [Fact]
    public void APaneHiddenComesBackWhereItWas()
    {
        var r = Run(Shape + """
            d.add('p1', { area: 'left' }); d.add('p2', { area: 'center' }); d.add('p3', { pane: 'p2', side: 'bottom' });
            d.add('p4', { pane: 'p3', side: 'tab' });
            const places = ['p1', 'p2', 'p3', 'p4'].map(p => d.placeOf(p));
            const back = id => { const at = d.placeOf(id); d.remove(id); d.add(id, at); return shape(d.areas.center); };
            """, "[places, back('p2'), back('p4'), back('p1') && shape(d.areas.left)]");
        Assert.Equal("""[[{"area":"left"},{"pane":"p3","side":"top","area":"center"},{"pane":"p4","side":"tab","area":"center"},{"pane":"p3","side":"tab","area":"center"}],"column(p2, p3|[p4])","column(p2, p3|[p4])","p1"]""", r);
    }

    [Fact]
    public void CtrlAltArrowsGoToThePaneAtThatSide()
    {
        // A tree at the left (0-200), at its right list A above list B (200-800, A 0-300, B 300-600).
        var r = Run("""
            const T = { id: 'T', left: 0, top: 0, right: 198, bottom: 600 };
            const A = { id: 'A', left: 202, top: 0, right: 800, bottom: 298 };
            const B = { id: 'B', left: 202, top: 302, right: 800, bottom: 600 };
            const all = [T, A, B];
            """, "[paneOnSide(T, all, 'right'), paneOnSide(A, all, 'down'), paneOnSide(B, all, 'up'), paneOnSide(B, all, 'left'), paneOnSide(T, all, 'left'), paneOnSide(A, all, 'up')]");
        Assert.Equal("""["A","B","A","T",null,null]""", r);
    }
}
