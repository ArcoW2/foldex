using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex.Tests;

// The bars (docs/plans/executed/10-PLAN-bars.md): bars.json read and written (BarsFile), and the size rules of 3.1 (web/bars.js
// under Jint).
public class BarsTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-bars-" + Guid.NewGuid().ToString("N"));

    public BarsTests() => Directory.CreateDirectory(dir);

    public void Dispose() => Directory.Delete(dir, true);

    static string Shipped => Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "defaults")!, BarsFile.Name);

    [Fact]
    public void TheShippedBarsAreDrivesAndAPathAtTheTop()
    {
        var r = BarsFile.Load(dir, Shipped);
        Assert.False(r["user"]!.GetValue<bool>());
        Assert.Empty(r["problems"]!.AsArray());
        var line = r["bars"]!["top"]![0]!.AsArray();
        Assert.Equal(["drives", "path"], line.Select(b => b!["kind"]!.GetValue<string>()));
        Assert.True(line[1]!["fill"]!.GetValue<bool>());
        Assert.Equal(30, line[0]!["maxShare"]!.GetValue<double>());
    }

    [Fact]
    public void YoursReplacesTheShippedOnesWhole()
    {
        File.WriteAllText(Path.Combine(dir, BarsFile.Name), """{ "left": [ [ { "kind": "drives", "normal": 3 } ] ] }""");
        var r = BarsFile.Load(dir, Shipped);
        Assert.True(r["user"]!.GetValue<bool>());
        Assert.Empty(r["bars"]!["top"]!.AsArray());
        Assert.Equal(3, r["bars"]!["left"]![0]![0]!["normal"]!.GetValue<double>());
    }

    [Fact]
    public void WrongEntriesAreReportedAndLeftOut()
    {
        var problems = new JsonArray();
        var bars = BarsFile.Parse("""
            // a comment, and a trailing comma
            { "top": [ [ { "kind": "clock" }, { "kind": "path", "normal": -5, "maxShare": 150, "overflow": "wrap", "fill": true }, ] ],
              "middle": [] }
            """, problems, "yours")!;
        var line = bars["top"]![0]!.AsArray();
        Assert.Single(line);
        Assert.Equal("""{"kind":"path","fill":true}""", line[0]!.ToJsonString());
        Assert.Equal(5, problems.Count);   // the kind, normal, maxShare, overflow, the side "middle"
    }

    [Fact]
    public void WritingKeepsTheFileReadable()
    {
        var bars = JsonNode.Parse("""{ "top": [ [ { "kind": "path", "fill": true, "normal": 300 } ] ], "bottom": [ [ { "kind": "drives", "min": 2 } ] ] }""")!;
        BarsFile.Save(dir, bars);
        var r = BarsFile.Load(dir, Shipped);
        Assert.True(r["user"]!.GetValue<bool>());
        Assert.Empty(r["problems"]!.AsArray());
        Assert.Equal(2, r["bars"]!["bottom"]![0]![0]!["min"]!.GetValue<double>());
        Assert.False(File.Exists(Path.Combine(dir, BarsFile.Name + ".tmp")));
    }

    // ---------- The size rules (bars.js) ----------

    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "bars.js"));

    static JsonElement Run(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        // The drives example of 3.1: buttons of 30 px, 10 px of grip and padding, a >> of 24 px.
        engine.Execute("""
            const drivesBar = { kind: 'drives', min: 2, normal: 4, max: 6, maxShare: 30 };
            const drivesOf = count => ({ ...barPx(drivesBar, { unit: 30, overhead: 10, count, more: 24, buttons: true }), maxShare: 30 });
            """);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void TheDrivesExample()
    {
        // 2 drives: its normal 4 (room kept); 10 drives: its max 6 and the >>; a window of 500 px: 30% (150); one of
        // 100 px: its min, 2 drives and the >>.
        var r = Run("""
            [lineLengths([drivesOf(2)], 2000, 2000).lengths[0], lineLengths([drivesOf(10)], 2000, 2000).lengths[0],
             lineLengths([drivesOf(10)], 500, 500).lengths[0], lineLengths([drivesOf(10)], 100, 100).lengths[0]]
            """);
        Assert.Equal("[130,214,150,94]", r.GetRawText());
    }

    [Fact]
    public void ABarWithoutAMaxAboveItsNormalDoesNotGrow()
    {
        var r = Run("lineLengths([{ normal: 100, content: 400 }, { normal: 100, max: 80, content: 400 }], 2000, 2000).lengths");
        Assert.Equal("[100,100]", r.GetRawText());
    }

    [Fact]
    public void BarsThatFillShareTheRestByTheirNormals()
    {
        var r = Run("lineLengths([{ normal: 200 }, { fill: true, normal: 300 }, { fill: true, normal: 100 }], 1000, 1000).lengths");
        Assert.Equal("[200,600,200]", r.GetRawText());
    }

    [Fact]
    public void AFillingBarStopsAtItsMinimumWhileTheOtherShrinksOn()
    {
        // 300 left for normals 300 and 100: 225 and 75, but the second stops at 120, the first gets the 180 left.
        var r = Run("lineLengths([{ normal: 200 }, { fill: true, normal: 300 }, { fill: true, normal: 100, min: 120 }], 500, 500).lengths");
        Assert.Equal("[200,180,120]", r.GetRawText());
    }

    [Fact]
    public void ALineTooShortTakesFromTheFillingBarsFirstThenTheOthersThenHides()
    {
        var r = Run("""
            [lineLengths([{ normal: 200, min: 100 }, { fill: true, normal: 300, min: 120 }], 260, 260),
             lineLengths([{ normal: 200, min: 100 }, { fill: true, normal: 300, min: 120 }], 200, 200)]
            """);
        // 260: the path at its 120, the other down to 140; 200: both at their min is 220, so the path is hidden.
        Assert.Equal("""[{"lengths":[140,120],"hidden":[]},{"lengths":[100,0],"hidden":[1]}]""", r.GetRawText());
    }

    [Fact]
    public void WhatDoesNotFitGoesBehindTheMoreButton()
    {
        var r = Run("[fitItems(4, 30, 120, 24), fitItems(10, 30, 204, 24), fitItems(10, 30, 20, 24)]");
        Assert.Equal("[4,6,0]", r.GetRawText());
    }
}
