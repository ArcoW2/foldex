using System.Text.Json;
using System.Text.Json.Nodes;
using System.Xml.Linq;

namespace Foldex.Tests;

// The ribbon (docs/plans/executed/19-PLAN-ribbon-change-mode.md 3.16): your ribbon.json written, read back and reset
// (RibbonFile), the icons of the shipped buttons, and its model under Jint (ribbonmodel.js): the change mode's changes,
// the columns, the key tips, the sizes at a height.
public class RibbonTests
{
    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;
    static readonly string Defaults = AppHost.FindProjectFolder(AppContext.BaseDirectory, "defaults")!;
    static readonly string Shipped = Path.Combine(Defaults, RibbonFile.Name);

    static string TempDir()
    {
        var dir = Path.Combine(Path.GetTempPath(), "foldex-ribbon-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    static JsonElement Model(string setup, string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(Web, "ribbonmodel.js")));
        engine.Execute(setup);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void YourRibbonWrittenAndReadBackAndResetGivesTheShippedOne()
    {
        var dir = TempDir();
        try
        {
            var mine = JsonNode.Parse("""
                { "tabs": [ { "name": "Mine", "groups": [ { "name": "G", "corners": { "left": "refresh", "right": { "action": "bookmarks.menu", "open": "dropDown" } },
                  "items": [ { "action": "item.copy", "size": "large", "label": "Copy\nit", "tip": "C" }, "divider", { "action": "refresh", "open": "dropDown", "stack": true } ] } ] } ] }
                """)!;
            RibbonFile.Save(dir, mine);
            var read = RibbonFile.Load(dir, Shipped);
            Assert.True(read["user"]!.GetValue<bool>());
            Assert.Empty(read["problems"]!.AsArray());
            Assert.True(JsonNode.DeepEquals(mine, read["ribbon"]), read["ribbon"]!.ToJsonString());
            Assert.False(File.Exists(Path.Combine(dir, RibbonFile.Name + ".tmp")));

            RibbonFile.Reset(dir);
            var reset = RibbonFile.Load(dir, Shipped);
            Assert.False(reset["user"]!.GetValue<bool>());
            Assert.Equal("Home", reset["ribbon"]!["tabs"]![0]!["name"]!.GetValue<string>());
        }
        finally { Directory.Delete(dir, true); }
    }

    // Every button of the shipped ribbon has a drawing of its own (no letter box), and each is well-formed SVG.
    [Fact]
    public void EveryShippedButtonHasAnIconThatIsValidSvg()
    {
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(Web, "ribbonicons.js")));
        var problems = new JsonArray();
        var ribbon = RibbonFile.Parse(File.ReadAllText(Shipped), problems, "shipped")!;
        var calls = ribbon["tabs"]!.AsArray().SelectMany(t => t!["groups"]!.AsArray()).SelectMany(g => g!["items"]!.AsArray())
            .OfType<JsonObject>().Select(o => new JsonArray(new JsonNode[] { o["action"]!.DeepClone() }.Concat((o["params"] as JsonArray ?? []).Select(p => p!.DeepClone())).ToArray()))
            .ToList();
        Assert.NotEmpty(calls);
        foreach (var call in calls)
            foreach (var size in new[] { "large", "small" })
            {
                var svg = engine.Evaluate($"ribbonIcon({call.ToJsonString()}, '{size}') ?? ''").ToString();
                Assert.True(svg.Length > 0, $"{call.ToJsonString()} has no drawing");
                var doc = XDocument.Parse(svg);
                Assert.Equal("svg", doc.Root!.Name.LocalName);
            }
        // Every drawing, also those of actions not on the shipped ribbon.
        var all = JsonNode.Parse(engine.Evaluate("JSON.stringify(Object.keys(RIBBON_ICONS.buttons).map(k => ribbonIcon(k.split(' '), 'large')).concat(Object.keys(RIBBON_PANEL_ACTIONS).map(k => ribbonIcon([k], 'small'))))").ToString())!.AsArray();
        foreach (var svg in all) XDocument.Parse(svg!.GetValue<string>());
    }

    const string TwoTabs = """
        const m = { tabs: [
          { name: 'A', groups: [ { name: 'G1', items: [ { action: 'a' }, { action: 'b', stack: true }, { action: 'c', stack: true }, 'divider', { action: 'd', size: 'large' } ] },
                                 { name: 'G2', items: [ { action: 'e' } ] } ] },
          { name: 'B', groups: [] } ] };
        const names = g => g.items.map(i => i === 'divider' ? '|' : i.action + (i.stack ? '+' : '') + (i.size === 'large' ? '!' : ''));
        """;

    [Fact]
    public void AButtonMovedBeforeAfterAndUnderAnother()
    {
        var r = Model(TwoTabs + """
            rbPlaceIn(m, { kind: 'item', path: [0, 0, 0] }, { kind: 'item', path: [0, 0, 4], how: 'after' });
            const after = names(m.tabs[0].groups[0]);
            rbPlaceIn(m, { kind: 'item', path: [0, 1, 0] }, { kind: 'item', path: [0, 0, 0], how: 'under' });
            const under = names(m.tabs[0].groups[0]);
            rbPlaceIn(m, { kind: 'item', path: [0, 0, 1] }, { kind: 'item', path: [0, 0, 0], how: 'before' });
            """, "[after, under, names(m.tabs[0].groups[0]), m.tabs[0].groups[1].items.length]");
        // a taken from the top of its column: b starts it; e under b; e before b again, a column of its own.
        Assert.Equal("""[["b","c+","|","d!","a"],["b","e+","c+","|","d!","a"],["e","b","c+","|","d!","a"],0]""", r.GetRawText());
    }

    [Fact]
    public void ACornerATabANewGroupAndRemoved()
    {
        var r = Model(TwoTabs + """
            rbPlaceIn(m, { kind: 'item', path: [0, 0, 4] }, { kind: 'corner', path: [0, 1, 'right'] });
            const corner = JSON.parse(JSON.stringify(m.tabs[0].groups[1].corners));
            rbPlaceIn(m, { kind: 'corner', path: [0, 1, 'right'] }, { kind: 'tab', path: [1] });
            const tab = m.tabs[1].groups.map(g => [g.name, names(g)]);
            rbPlaceIn(m, { kind: 'call', call: ['bars.add', 'drives'] }, { kind: 'group', path: [0, 1] });
            const call = m.tabs[0].groups[1].items.at(-1);
            const divider = rbRemoveIn(m, { kind: 'divider', path: [0, 0, 3] });
            rbRemoveIn(m, { kind: 'group', path: [1, 0] });
            const tabMoved = rbPlaceIn(m, { kind: 'tab', path: [1] }, { kind: 'tab', path: [0] });
            """, "[corner, tab, call, divider ?? null, names(m.tabs[1].groups[0]), m.tabs.map(t => t.name), m.tabs[0].groups.length, tabMoved ?? null]");
        Assert.Equal("""[{"right":"d"},[["B",["d"]]],{"action":"bars.add","params":["drives"],"stack":false},null,["a","b+","c+"],["B","A"],0,null]""", r.GetRawText());
    }

    [Fact]
    public void AGroupMovedAndADividerKeptAsItIs()
    {
        var r = Model(TwoTabs + """
            rbPlaceIn(m, { kind: 'group', path: [0, 1] }, { kind: 'group', path: [0, 0] });
            const order = m.tabs[0].groups.map(g => g.name);
            const refused = rbPlaceIn(m, { kind: 'divider', path: [0, 1, 3] }, { kind: 'corner', path: [0, 0, 'left'] });
            """, "[order, refused, names(m.tabs[0].groups[1])]");
        Assert.Equal("""[["G2","G1"],false,["a","b+","c+","|","d!"]]""", r.GetRawText());
    }

    [Fact]
    public void ColumnsKeyTipsAndSizes()
    {
        var r = Model(TwoTabs, """
            [ribbonColumns(m.tabs[0].groups[0].items).map(c => c.kind + c.items?.length),
             ribbonTips(['Home', 'View', 'Help']), ribbonTips(['Paste', 'Copy', 'Cut', 'Copy path'], ['', '', 'X', '']),
             [30, 22, 50 / 3].map(h => { const s = ribbonSizes(h); return [s.sp, s.f, s.largeIcon]; })]
            """);
        Assert.Equal("small3", r[0][0].GetString());
        Assert.StartsWith("divider", r[0][1].GetString());
        Assert.Equal("large1", r[0][2].GetString());
        Assert.Equal("""["H","V","E"]""", r[1].GetRawText());
        Assert.Equal("""["P","C","X","O"]""", r[2].GetRawText());
        // Full: spacing and text whole, the icon 32; at 22 the spacing gone; at the lowest the text at 3/4.
        Assert.Equal(1, r[3][0][0].GetDouble());
        Assert.Equal(32, r[3][0][2].GetInt32());
        Assert.Equal(0, r[3][1][0].GetDouble());
        Assert.Equal(1, r[3][1][1].GetDouble());
        Assert.Equal(0.75, r[3][2][1].GetDouble());
    }
}
