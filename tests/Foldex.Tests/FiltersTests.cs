using System.Text.Json;

namespace Foldex.Tests;

// Filter sets (docs/plans/executed/32-PLAN-filter-sets.md 3.1, 3.2): web/filters.js under Jint. Items as a listing has
// them (name, folder, size, modified, attributes, props); "now" fixed.
public class FiltersTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "filters.js"));

    // Items: a folder, a text file, a photo with GPS and a date taken, a photo without, a hidden temp file, a drive.
    const string Setup = """
        const now = new Date(2026, 10, 17, 12, 0).getTime(), day = 86400e3;
        const kinds = { name: 'text', size: 'size', modified: 'date', attributes: 'attrs', git: 'list', gps: 'flag',
          'System.Photo.DateTaken': 'date', 'System.Image.HorizontalSize': 'number', ext: 'text', total: 'size' };
        const kindOf = id => kinds[id] ?? 'text';
        const items = [
          { name: 'src', folder: true, modified: now - 2 * day, attributes: 'D' },
          { name: 'notes.txt', folder: false, size: 1200, modified: now - 10 * day, attributes: 'A', ext: 'txt', props: {} },
          { name: 'beach.jpg', folder: false, size: 3e6, modified: now - day, attributes: 'A', ext: 'jpg',
            props: { 'System.GPS.LatitudeDecimal': ['52.0', 52.0], 'System.Photo.DateTaken': ['1-3-2025', new Date(2025, 2, 1).getTime()] } },
          { name: 'old.jpg', folder: false, size: 2e6, modified: now - 400 * day, attributes: 'A', ext: 'jpg',
            props: { 'System.GPS.LatitudeDecimal': null, 'System.Photo.DateTaken': null } },
          { name: 'x.tmp', folder: false, size: 10, modified: now - 3 * day, attributes: 'AH', ext: 'tmp', props: {} },
          { name: 'C:', folder: true, total: 5e11, attributes: '' },
        ];
        const L = (o, join = 'and') => ({ ...newFilterLine(join), ...o });
        const shown = set => items.filter(x => filterTestOf(set, kindOf, now)(x) === true).map(x => x.name);
        """;

    static JsonElement Run(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.Execute(Setup);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    static string Shown(string lines) => Run($"shown({{ lines: [{lines}] }})").GetRawText();

    [Fact]
    public void TextByWildcardsRegexContainsAndIs()
    {
        Assert.Equal("""["notes.txt","x.tmp"]""", Shown("L({ folders: false, cond: { op: 'wild', text: '*.txt;*.tmp' } })"));
        Assert.Equal("""["beach.jpg","old.jpg"]""", Shown("L({ folders: false, cond: { op: 'regex', text: '\\\\.JPG$' } })"));
        Assert.Equal("""["beach.jpg"]""", Shown("L({ cond: { op: 'contains', text: 'EAC' } })"));
        Assert.Equal("""["notes.txt"]""", Shown("L({ cond: { op: 'is', text: 'Notes.TXT' } })"));
    }

    // A folder has no size: a line on Size is left out for it (it shows); a drive's Total size is only a drive's.
    [Fact]
    public void NumberRangesAndFieldsThatDoNotApply()
    {
        Assert.Equal("""["src","notes.txt","x.tmp","C:"]""", Shown("L({ field: 'size', cond: { op: 'range', from: null, to: 1e6 } })"));
        Assert.Equal("""["src","notes.txt","beach.jpg","old.jpg","x.tmp","C:"]""", Shown("L({ field: 'total', cond: { op: 'range', from: 1e11, to: null } })"));
        Assert.Equal("""["src","notes.txt","beach.jpg","old.jpg","x.tmp"]""", Shown("L({ field: 'total', cond: { op: 'range', from: 1e12, to: null } })"));
    }

    [Fact]
    public void DatesAbsoluteAndRelativeEitherEndOpen()
    {
        Assert.Equal("""["src","beach.jpg","x.tmp","C:"]""", Shown("L({ field: 'modified', cond: { op: 'range', from: { rel: 7, unit: 'days' }, to: null } })"));
        Assert.Equal("""["old.jpg","C:"]""", Shown("L({ field: 'modified', cond: { op: 'range', from: null, to: { rel: 1, unit: 'years' } } })"));
        Assert.Equal("""["notes.txt","C:"]""", Shown("L({ field: 'modified', cond: { op: 'range', from: { abs: '2026-11-07' }, to: { abs: '2026-11-07' } } })"));
        Assert.Equal("""["src","C:"]""", Shown("L({ field: 'modified', cond: { op: 'range', from: { abs: '2026-11-15T00:00' }, to: { abs: '2026-11-15T23:59' } } })"));
    }

    // Relative to now in the future too (ahead): from 3 days ago to 1 day from now; nothing is modified from tomorrow on.
    [Fact]
    public void DatesFromNow()
    {
        Assert.Equal("""["src","beach.jpg","x.tmp","C:"]""", Shown("L({ field: 'modified', cond: { op: 'range', from: { rel: 3, unit: 'days' }, to: { rel: 1, unit: 'days', ahead: true } } })"));
        Assert.Equal("""["C:"]""", Shown("L({ field: 'modified', cond: { op: 'range', from: { rel: 1, unit: 'days', ahead: true } } })"));
        Assert.Equal("\"Date modified from 2 weeks from now\"", Run("filterLineText(L({ field: 'modified', cond: { op: 'range', from: { rel: 2, unit: 'weeks', ahead: true } } }), id => 'Date modified')").GetRawText());
    }

    // A value of its own: a date on a day (today, a day, n days ago or from now), a number that is one.
    [Fact]
    public void ADateOnADayAndANumberThatIs()
    {
        Assert.Equal("""["beach.jpg","C:"]""", Shown("L({ field: 'modified', cond: { op: 'on', day: { rel: 1 } } })"));
        Assert.Equal("""["C:"]""", Shown("L({ field: 'modified', cond: { op: 'on', day: { rel: 0 } } })"));
        Assert.Equal("""["notes.txt","C:"]""", Shown("L({ field: 'modified', cond: { op: 'on', day: { abs: '2026-11-07' } } })"));
        Assert.Equal("""["src","notes.txt","C:"]""", Shown("L({ field: 'size', cond: { op: 'is', value: 1200 } })"));
        Assert.Equal("""["Date modified is today","Size is 1200","Name is a.txt"]""", Run("""
            [filterLineText(L({ field: 'modified', cond: { op: 'on', day: { rel: 0 } } }), id => id === 'modified' ? 'Date modified' : 'Size'),
             filterLineText(L({ field: 'size', cond: { op: 'is', value: 1200 } }), id => 'Size'),
             filterLineText(L({ cond: { op: 'is', text: 'a.txt' } }), id => 'Name')]
            """).GetRawText());
    }

    // A photo without a date taken: only with "or empty", or "has no value"; GPS: has a value.
    [Fact]
    public void EmptyValuesOrEmptyAndHasAValue()
    {
        Assert.Equal("""["src","beach.jpg"]""", Shown("L({ field: 'System.Photo.DateTaken', cond: { op: 'range', from: { abs: '2025-01-01' } } })").Replace(",\"C:\"", ""));
        Assert.Equal("""["src","beach.jpg","old.jpg","C:"]""", Shown("L({ field: 'System.Photo.DateTaken', cond: { op: 'range', from: { abs: '2025-01-01' } }, orEmpty: true }), L({ field: 'ext', cond: { op: 'wild', text: 'jpg' } })"));
        Assert.Equal("""["src","beach.jpg","C:"]""", Shown("L({ field: 'gps', cond: { op: 'has' } })"));
        Assert.Equal("""["src","old.jpg","C:"]""", Shown("L({ field: 'gps', cond: { op: 'none' } })"));
    }

    [Fact]
    public void AttributesFoldersFilesAndNot()
    {
        Assert.Equal("""["x.tmp"]""", Shown("L({ field: 'attributes', cond: { op: 'attrs', attrs: { H: 'has' } } })"));
        Assert.Equal("""["src","notes.txt","beach.jpg","old.jpg","C:"]""", Shown("L({ not: true, folders: false, field: 'name', cond: { op: 'wild', text: '*.tmp;*.bak' } })"));
        Assert.Equal("""["src","C:"]""", Shown("L({ files: false, cond: { op: 'has' } })"));
    }

    // The plan's examples: images with GPS; every folder, files of this week; And before Or; brackets.
    [Fact]
    public void CombiningAndBeforeOrBracketsAndTheExamples()
    {
        Assert.Equal("""["beach.jpg"]""", Shown("L({ folders: false, field: 'ext', cond: { op: 'wild', text: 'jpg;heic' } }), L({ folders: false, field: 'gps', cond: { op: 'has' } })"));
        Assert.Equal("""["src","beach.jpg","x.tmp","C:"]""", Shown("L({ files: false, cond: { op: 'has' } }), L({ folders: false, field: 'modified', cond: { op: 'range', from: { rel: 7, unit: 'days' } } }, 'or')"));
        // A Or B And C: A Or (B And C).
        const string a = "L({ cond: { op: 'is', text: 'notes.txt' } })";
        const string b = "L({ cond: { op: 'wild', text: '*.jpg' } }, 'or')";
        const string c = "L({ field: 'size', cond: { op: 'range', from: 25e5 } })";
        Assert.Equal("""["notes.txt","beach.jpg"]""", Shown($"{a}, {b}, {c}"));
        Assert.Equal("""["beach.jpg"]""", Shown($"{{ ...{a}, open: 1 }}, {{ ...{b}, close: 1 }}, {c}"));
    }

    [Fact]
    public void ProblemsAndEmptySets()
    {
        var r = Run("""
            [filterProblem({ lines: [L({ close: 1 })] }), filterProblem({ lines: [L({ open: 2 }), L({ close: 1 })] }),
             filterProblem({ lines: [L({ cond: { op: 'regex', text: '(' } })] }) !== null, filterProblem({ lines: [] }),
             shown({ lines: [] }).length, shown({ lines: [L({ cond: { op: 'is', text: 'x' } })], off: true }).length,
             shown({ lines: [L({ close: 1 })] }).length]
            """);
        Assert.Equal("""["Line 1 closes a bracket that was not opened.","1 bracket is not closed.",true,null,6,6,6]""", r.GetRawText());
    }

    // filters.json: the kept sets (one without a name, or a second with the same name, left out), the temporary
    // filter's lines, defaults only of kept sets; the head's text of the temporary filter.
    [Fact]
    public void TheFileKeepsTheSetsTheTemporaryFilterAndTheDefaults()
    {
        var clean = FiltersFile.Clean(System.Text.Json.Nodes.JsonNode.Parse("""
            { "sets": [ { "name": "Exes", "lines": [ { "field": "ext" } ], "key": "ctrl+alt+e" }, { "name": "", "lines": [] },
                        { "name": "exes", "lines": [] } ],
              "temp": { "lines": [ { "field": "name" } ] }, "rootDefault": "Exes", "childDefault": "Gone" }
            """));
        var expected = System.Text.Json.Nodes.JsonNode.Parse("""
            {"sets":[{"name":"Exes","lines":[{"field":"ext"}],"key":"Ctrl+Alt+E"}],"temp":{"lines":[{"field":"name"}]},"rootDefault":"Exes","childDefault":null}
            """);
        Assert.True(System.Text.Json.Nodes.JsonNode.DeepEquals(expected, clean), clean.ToJsonString());
        Assert.Equal("\"temp\"", Run("filterHeadText({ temp: true, lines: [L({})] })").GetRawText());
    }

    // A value not read yet (a property, the Git status): the item waits; a filter of before is Folders Or Files by name.
    [Fact]
    public void WaitingForAValueAndAFilterOfBefore()
    {
        var r = Run("""
            [filterTestOf({ lines: [L({ field: 'System.Photo.DateTaken', cond: { op: 'has' } })] }, kindOf, now)({ name: 'a.jpg', folder: false }),
             filterTestOf({ lines: [L({ field: 'git', cond: { op: 'in', values: ['Modified'] } })] }, kindOf, now)({ name: 'a.cs', folder: false, git: 'M' }),
             shown(filterOfPattern('*.txt')), filterHeadText(filterOfPattern('*.txt')), filterHeadText({ name: 'Sources', lines: [L({})] }),
             filterLineText(L({ not: true, folders: false, cond: { op: 'wild', text: '*.tmp' } }), id => id === 'name' ? 'Name' : id)]
            """);
        Assert.Equal("""["wait",true,["src","notes.txt","C:"],"Filter","Sources","Not Files, Name matches *.tmp"]""", r.GetRawText());
    }
}
