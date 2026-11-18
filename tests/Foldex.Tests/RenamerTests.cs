using System.Text.Json;

namespace Foldex.Tests;

// Renaming many at once (docs/plans/executed/21-PLAN-multi-rename.md): web/renamer.js under Jint.
public class RenamerTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "renamer.js"));

    // Items with a date modified of 12 Nov 2026 14:30 and a date taken (by its column title) of 1 Feb 2020 08:05.
    const string Setup = """
        const modified = new Date(2026, 10, 12, 14, 30, 5).getTime(), taken = new Date(2020, 1, 1, 8, 5).getTime();
        const item = (name, extra = {}) => ({ id: 'C:\\Photos\\Holiday\\' + name, name, folder: false, parent: 'Holiday', grandparent: 'Photos',
          value: (col, fmt) => col === 'Date taken' ? (fmt ? formatDate(taken, fmt) : '1-2-2020 08:05') : col === 'Author' ? 'Arco'
            : col === 'modified' && fmt ? formatDate(modified, fmt) : '',
          raw: which => which === 'taken' ? taken : which === 'modified' ? modified : null, ...extra });
        const base = { mode: 'pattern', target: 'name', template: '', match: '', regex: false, matchCase: false, from: 1, length: 1,
          fromEnd: false, dateFrom: 'found', dateFormat: 'yyyy-MM-dd', shiftDays: 0, shiftHours: 0, caseTo: '',
          counter: { start: 1, step: 1, digits: 1 }, syntax: 'dollar' };
        const one = (name, o, i = 0) => renameOne(item(name), i, { ...base, ...o });
        """;

    static JsonElement Run(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.Execute(Setup);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void XplorersTokens()
    {
        var r = Run("""
            [one('IMG_1.jpg', { template: '$P - $B' }), one('IMG_1.jpg', { template: 'pic $003' }, 4), one('IMG_1.jpg', { template: '$[1:3]-$[-1:1]' }),
             one('IMG_1.jpg', { template: '${Date taken:yyyyMMdd} $B' }), one('IMG_1.jpg', { template: '$B by ${Author} $$5' }),
             one('IMG_1.jpg', { template: '$N', target: 'whole' }), one('IMG_1.jpg', { template: '$G_$E', target: 'whole' })]
            """);
        Assert.Equal("""["Holiday - IMG_1.jpg","pic 007.jpg","IMG-1.jpg","20200201 IMG_1.jpg","IMG_1 by Arco $5.jpg","IMG_1.jpg","Photos_jpg"]""", r.GetRawText());
    }

    [Fact]
    public void TotalCommandersTokens()
    {
        var r = Run("""
            [one('IMG_1.jpg', { syntax: 'bracket', template: '[P]_[N]_[C]', counter: { start: 10, step: 5, digits: 3 } }, 2),
             one('IMG_1.jpg', { syntax: 'bracket', template: '[N2-4][[x]' }), one('IMG_1.jpg', { syntax: 'bracket', template: '[Y]-[M]-[D] [h][m]' }),
             one('IMG_1.jpg', { syntax: 'bracket', template: '[=Date taken:yyyy] [N-1,1]' })]
            """);
        Assert.Equal("""["Holiday_IMG_1_020.jpg","MG_[x].jpg","2026-11-12 1430.jpg","2020 1.jpg"]""", r.GetRawText());
    }

    [Fact]
    public void APartOfTheNameOrTheExtensionChanged()
    {
        // abcdefg.hij with cde (from 3, 3 long) made klm: abklmfg.hij; from the end; in the extension.
        var r = Run("""
            [one('abcdefg.hij', { mode: 'part', from: 3, length: 3, template: 'klm' }), one('abcdefg.hij', { mode: 'part', from: 2, length: 2, fromEnd: true, template: 'XY' }),
             one('abcdefg.hij', { mode: 'part', target: 'ext', from: 1, length: 1, template: 'J' }), one('abcdefg.hij', { mode: 'part', from: 1, length: 0, template: '$P ' })]
            """);
        Assert.Equal("""["abklmfg.hij","abcdeXY.hij","abcdefg.Jij","Holiday abcdefg.hij"]""", r.GetRawText());
    }

    [Fact]
    public void FindAndReplaceWithTextOrARegularExpression()
    {
        var r = Run("""
            [one('a-b-c.txt', { mode: 'replace', match: '-', template: '_' }), one('a-b-c.txt', { mode: 'replaceAll', match: '-', template: '_' }),
             one('Report.txt', { mode: 'replace', match: 'report', template: 'Note' }), one('Report.txt', { mode: 'replace', match: 'report', template: 'Note', matchCase: true }),
             one('2026 photo 07.jpg', { mode: 'replace', match: '^(\\d+) (.*) (\\d+)$', regex: true, template: '$3 $2 $1' })]
            """);
        Assert.Equal("""["a_b-c.txt","a_b_c.txt","Note.txt","Report.txt","07 photo 2026.jpg"]""", r.GetRawText());
    }

    [Fact]
    public void TheDateInTheNameRewrittenShiftedOrTakenFromTheFile()
    {
        var r = Run("""
            [one('IMG_20260112_143005.jpg', { mode: 'date', dateFormat: 'yyyy-MM-dd HH.mm' }), one('trip 12-11-2026.jpg', { mode: 'date', dateFormat: 'yyyyMMdd' }),
             one('trip 2026-11-12.jpg', { mode: 'date', shiftDays: 1, dateFormat: 'yyyy-MM-dd' }), one('trip 2026-11-12.jpg', { mode: 'date', dateFrom: 'taken', dateFormat: 'yyyy-MM-dd' }),
             one('no date.jpg', { mode: 'date' }), one('20261399.jpg', { mode: 'date' })]
            """);
        Assert.Equal("""["IMG_2026-01-12 14.30.jpg","trip 20261112.jpg","trip 2026-11-13.jpg","trip 2020-02-01.jpg","no date.jpg","20261399.jpg"]""", r.GetRawText());
    }

    [Fact]
    public void TheCaseAloneOrAfterAnotherChange()
    {
        var r = Run("""
            [one('my holiday photo.JPG', { mode: 'case', caseTo: 'title' }), one('my holiday photo.JPG', { mode: 'case', caseTo: 'upper', target: 'whole' }),
             one('a-b.txt', { mode: 'replaceAll', match: '-', template: ' ', caseTo: 'upper' })]
            """);
        Assert.Equal("""["My Holiday Photo.JPG","MY HOLIDAY PHOTO.JPG","A B.txt"]""", r.GetRawText());
    }

    [Fact]
    public void ThePreviewMarksWhatCannotBe()
    {
        var r = Run("""
            renamePreview([item('a.txt'), item('b.txt'), item('c.txt'), item('d.txt')],
              { ...base, mode: 'replace', match: 'a', template: 'b' }, new Map([['c:\\photos\\holiday', new Set(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'x.txt'])]]))
              .map(r => [r.name, r.to, r.changed, r.problem])
            """);
        // a.txt to b.txt while b.txt stays b.txt: two the same.
        Assert.Equal("""[["a.txt","b.txt",true,"the same name as another"],["b.txt","b.txt",false,null],["c.txt","c.txt",false,null],["d.txt","d.txt",false,null]]""", r.GetRawText());
        var dup = Run("renamePreview([item('a.txt'), item('b.txt')], { ...base, template: 'same' }).map(r => r.problem)");
        Assert.Equal("""["the same name as another","the same name as another"]""", dup.GetRawText());
        var bad = Run("renamePreview([item('a.txt'), item('b.txt')], { ...base, template: '$B?' }).map(r => r.problem)");
        Assert.Equal("""["holds \\ / : * ? \" < > |","holds \\ / : * ? \" < > |"]""", bad.GetRawText());
    }

    [Fact]
    public void ANameRenamedAwayIsFree()
    {
        // x1 to x2 while x2 goes to x3: x2's name is free (the host goes through a name in between where needed).
        var r = Run("""
            renamePreview([item('x1.txt'), item('x2.txt')], { ...base, template: 'x$2' }, new Map([['c:\\photos\\holiday', new Set(['x1.txt', 'x2.txt'])]]))
              .map(r => [r.to, r.problem])
            """);
        Assert.Equal("""[["x2.txt",null],["x3.txt",null]]""", r.GetRawText());
    }
}
