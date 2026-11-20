using System.Text.Json;
using Jint;

namespace Foldex.Tests;

// The macro language (docs/plans/executed/34-PLAN-macros.md 3.1 to 3.4): web/macrolang.js run under Jint against an environment
// made here. LexPen's tests of its language (a statement on more lines) kept, with an action in the place of LexPen's
// `type`; then what Foldex has of its own: text with a backslash, items and their fields, lists, the functions, run,
// for each, LexPen's editor statements refused.
public class MacroLangTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "macrolang.js"));

    // An environment: the focused item, three selected, actions and runs written to `log`; a run's exit code 3.
    const string Env = """
        const item = (p, o = {}) => ({ pathNameExt: p, ...macroPathParts(p), ...o });
        const focused = item('D:\\abc\\def\\ghi.jkl', { size: '4831', modified: '20-11-2026 14:05' });
        const selected = [item('D:\\abc\\a.txt', { size: '10' }), item('D:\\abc\\b c.txt', { size: '2048' }), item('D:\\abc\\sub', { size: '', ext: '', name: 'sub' })];
        const log = [];
        const env = {
          sys: n => ({ location: 'D:\\abc', focused, selected, count: selected.length, pane: 'Left' })[n],
          action: (name, args) => { log.push(name + ' ' + args.join('|')); },
          files: pattern => selected.filter(x => x.ext === pattern.replace('*.', '')),
          prop: (path, name) => name === 'System.Photo.DateTaken' ? '1-3-2025' : '',
          run: o => { log.push('run ' + JSON.stringify(o)); return { exitCode: 3 }; },
          loadMacro: () => null,
          // Administrator rights (plan 39): `rights` 'refuse' refuses the question, 'never' the setting; asked once.
          elevate: () => {
            if (rights === 'never') return { error: 'elevate: this macro may not have administrator rights (Manage macros: Administrator rights)' };
            if (elevated) return {};
            log.push('asked');
            if (rights === 'refuse') return { error: 'Administrator rights refused' };
            elevated = true;
            return {};
          },
          fileCopy: o => { log.push('fileCopy ' + JSON.stringify(o)); return {}; },
        };
        let rights = '', elevated = false;
        """;

    // The macro's problems as "line:col message" and its steps as "op@line".
    static (string[] Problems, string[] Steps) Program(string text)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.SetValue("text", text);
        var json = engine.Evaluate("JSON.stringify((p => ({ problems: p.problems, steps: p.main.code }))(macroProgram(text, {})))").ToString();
        var root = JsonDocument.Parse(json).RootElement;
        return (
            root.GetProperty("problems").EnumerateArray().Select(p => $"{p.GetProperty("line")}:{p.GetProperty("col")} {p.GetProperty("message").GetString()}").ToArray(),
            root.GetProperty("steps").EnumerateArray().Select(s => $"{s.GetProperty("op").GetString()}@{s.GetProperty("line")}").ToArray());
    }

    // Runs a macro; what it did (the log), its variables, and an error.
    static (string[] Log, Dictionary<string, string> Vars, string? Error) Run(string text, string rights = "")
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.Execute(Env);
        engine.Execute($"rights = '{rights}';");
        engine.SetValue("text", text);
        var json = engine.Evaluate("""
            runMacro(macroProgram(text, {}), env).then(r => JSON.stringify({ log,
              vars: Object.fromEntries([...(r.vars ?? new Map())].filter(([k]) => !k.startsWith('#')).map(([k, v]) => [k, v.s])),
              error: r.error ? r.error.line + ': ' + r.error.message : null }))
            """).UnwrapIfPromise().ToString();
        var root = JsonDocument.Parse(json).RootElement;
        return (root.GetProperty("log").EnumerateArray().Select(x => x.GetString()!).ToArray(),
            root.GetProperty("vars").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString()!),
            root.GetProperty("error").ValueKind == JsonValueKind.Null ? null : root.GetProperty("error").GetString());
    }

    // ---------- LexPen's (a statement on more lines) ----------

    [Fact]
    public void ABackslashAtTheEndJoinsTheNextLineIntoOneStatementAtItsFirstLine()
    {
        var joined = Program("set $a = 1 + \\\n   2 + \\\r\n   3\nlog $a");
        var plain = Program("set $a = 1 + 2 + 3\nlog $a");
        Assert.Empty(joined.Problems);
        Assert.Equal(plain.Steps.Select(s => s.Split('@')[0]), joined.Steps.Select(s => s.Split('@')[0]));
        Assert.Equal("1", joined.Steps[0].Split('@')[1]);
        Assert.Equal("4", joined.Steps[^1].Split('@')[1]);
    }

    [Fact]
    public void AMistakeOnAContinuedLineIsReportedAtThatLineAndColumn()
    {
        var (problems, _) = Program("set $a = 1 + \\\n 2 + \\\n 3 ~");
        Assert.Equal("3:3 \"~\" is not part of the macro language", Assert.Single(problems));
    }

    [Fact]
    public void ABackslashInTextOrACommentDoesNotContinue()
    {
        Assert.Empty(Program("# a note \\\nlog \"b\"").Problems);
        Assert.Contains(Program("log \"a\\\nlog \"b\"").Problems, p => p.StartsWith("1:"));
        Assert.Empty(Program("set $a = \"x\\\\\" \\\n & \"y\"").Problems);
    }

    [Fact]
    public void ABackslashOnTheLastLineIsAMistake()
    {
        var (problems, _) = Program("log \"x\" \\");
        Assert.Equal("1:8 this line goes on (\\ at its end), but no line follows", Assert.Single(problems));
    }

    // ---------- Foldex's ----------

    // A backslash in text is a backslash; a double quote is written twice; $$newline, $$tab.
    [Fact]
    public void TextKeepsItsBackslashesAndADoubledQuoteIsOne()
    {
        var r = Run("set $p = \"C:\\Tools\\new\\x.exe\"\nset $q = \"say \"\"hi\"\"\"\nset $n = len(\"a\" & $$newline & $$tab)");
        Assert.Null(r.Error);
        Assert.Equal("C:\\Tools\\new\\x.exe", r.Vars["p"]);
        Assert.Equal("say \"hi\"", r.Vars["q"]);
        Assert.Equal("4", r.Vars["n"]);
    }

    // An item: its text its path, name and extension; its fields; a text's fields from its path; a list from 1.
    [Fact]
    public void AnItemsFieldsAndAListsIndex()
    {
        var r = Run("""
            set $a = $$focused
            set $b = $$focused.path & "|" & $$focused.nameExt & "|" & $$focused.name & "|" & $$focused.ext & "|" & $$focused.size
            set $c = $$selected[2].nameExt & "|" & $$selected[3].path & "|" & $$selected[4] & "|" & count($$selected)
            set $d = "x\y\z.tar.gz"
            set $e = $d.path & "|" & $d.name & "|" & $d.ext & "|" & $d.pathNameExt
            set $f = $$focused
            set $g = $f.modified
            """);
        Assert.Null(r.Error);
        Assert.Equal("D:\\abc\\def\\ghi.jkl", r.Vars["a"]);
        Assert.Equal("D:\\abc\\def|ghi.jkl|ghi|jkl|4831", r.Vars["b"]);
        Assert.Equal("b c.txt|D:\\abc||3", r.Vars["c"]);
        Assert.Equal("x\\y|z.tar|gz|x\\y\\z.tar.gz", r.Vars["e"]);
        Assert.Equal("20-11-2026 14:05", r.Vars["g"]);
    }

    [Fact]
    public void FunctionsOnPathsNumbersAndTexts()
    {
        var r = Run(""""
            set $a = path("D:\abc\def\ghi.jkl") & "|" & path(path("D:\abc\def\ghi.jkl")) & "|" & path("D:\abc") & "|" & path("D:\") & "|" & path("ghi.jkl")
            set $b = nameExt("..\up\r.md") & "|" & name(".gitignore") & "|" & ext(".gitignore") & "|" & path("\\nas\share\x")
            set $c = quoted("D:\a b\c.txt") & "|" & quoted("D:\ab\c.txt") & "|" & unquoted("""D:\a b""") & "|" & quoted($$selected)
            set $d = round($$focused.size / 1024, 3) & " kb|" & round($$focused.size / 1048576, 0) & "|" & round(2.5, 0)
            set $e = "[" & padleft("7", 3) & "][" & padright("ab", 4) & "][" & padleft("long", 2) & "]"
            set $f = prop($$focused, "System.Photo.DateTaken")
            """");
        Assert.Null(r.Error);
        Assert.Equal("D:\\abc\\def|D:\\abc|D:\\||", r.Vars["a"]);
        Assert.Equal("r.md|.gitignore||\\\\nas\\share", r.Vars["b"]);
        Assert.Equal("\"D:\\a b\\c.txt\"|D:\\ab\\c.txt|D:\\a b|D:\\abc\\a.txt \"D:\\abc\\b c.txt\" D:\\abc\\sub", r.Vars["c"]);
        Assert.Equal("4.718 kb|0|3", r.Vars["d"]);
        Assert.Equal("[  7][ab  ][long]", r.Vars["e"]);
        Assert.Equal("1-3-2025", r.Vars["f"]);
    }

    // run: its options before, after and between, on lines of their own; for each over the selected items, over files
    // matching and over a list made with append; the exit code of a run that waited.
    [Fact]
    public void RunWithItsOptionsAndForEach()
    {
        var r = Run("""
            run \
              in path($$focused.path) \
              "dotnet" "build -c Release" \
              wait minimized
            set $x = $$exitCode
            for each $f in $$selected
              run admin "conv.exe" quoted($f) & " " & $f.size in $f.path
            next
            for each $t in files "*.txt"
              append $names $t.name "+"
            next
            append $l $$selected[3]
            append $l "plain"
            for each $i in $l
              log $i.nameExt
            next
            """);
        Assert.Null(r.Error);
        Assert.Equal("""run {"what":"dotnet","params":"build -c Release","folder":"D:\\abc","window":"minimized","admin":false,"adminForced":false,"wait":true}""", r.Log[0]);
        Assert.Equal("3", r.Vars["x"]);
        Assert.Equal("""run {"what":"conv.exe","params":"\"D:\\abc\\b c.txt\" 2048","folder":"D:\\abc","window":"normal","admin":true,"adminForced":false,"wait":false}""", r.Log[2]);
        Assert.Equal(4, r.Log.Count(l => l.StartsWith("run")));
        Assert.Equal("a+b c", r.Vars["names"]);
        Assert.Equal(["log sub", "log plain"], r.Log[^2..]);
    }

    // Administrator rights (docs/plans/executed/39-PLAN-elevated-macros.md 3.2, 3.3): elevate asks once; refused, the error at its
    // line, with onerror continue $$error and a later elevate asks again; admin_forced, with admin an error.
    [Fact]
    public void ElevateAndAdminForced()
    {
        var r = Run("""
            elevate
            elevate
            run admin_forced "x.exe"
            """);
        Assert.Null(r.Error);
        Assert.Equal("asked", r.Log[0]);
        Assert.Equal(1, r.Log.Count(l => l == "asked"));
        Assert.Contains("\"adminForced\":true", r.Log[1]);
        Assert.Equal("2: Administrator rights refused", Run("log 1\nelevate\nlog 2", "refuse").Error);
        var go = Run("onerror continue\nelevate\nset $e = $$error\nelevate", "refuse");
        Assert.Null(go.Error);
        Assert.Equal("true", go.Vars["e"]);
        Assert.Equal(2, go.Log.Count(l => l == "asked"));
        Assert.Equal("1: elevate: this macro may not have administrator rights (Manage macros: Administrator rights)", Run("elevate", "never").Error);
        Assert.Equal(["1:10 run takes admin or admin_forced, not both"], Program("run admin admin_forced \"x.exe\"").Problems);
    }

    // copy and move <items> to <folder> (3.4): a list, an item, a text; replace or noreplace, not both; LexPen's copy
    // $var refused.
    [Fact]
    public void CopyAndMove()
    {
        var r = Run("""
            copy $$selected to "E:\backup" replace
            move $$focused to $$location & "\old"
            copy "D:\x.txt" to "E:\" noreplace
            """);
        Assert.Null(r.Error);
        Assert.Equal("""fileCopy {"move":false,"items":["D:\\abc\\a.txt","D:\\abc\\b c.txt","D:\\abc\\sub"],"folder":"E:\\backup","conflict":"replace"}""", r.Log[0]);
        Assert.Equal("""fileCopy {"move":true,"items":["D:\\abc\\def\\ghi.jkl"],"folder":"D:\\abc\\old","conflict":null}""", r.Log[1]);
        Assert.Equal("""fileCopy {"move":false,"items":["D:\\x.txt"],"folder":"E:\\","conflict":"noreplace"}""", r.Log[2]);
        Assert.Single(Program("copy $a to \"E:\\\" replace noreplace").Problems);
        Assert.Contains("not both", Program("copy $a to \"E:\\\" replace noreplace").Problems[0]);
        Assert.Contains("to is missing", Program("move $a \"E:\\\"").Problems[0]);
        Assert.Contains("LexPen's", Program("copy $var").Problems[0]);
    }

    // The guide (src/defaults/macros/README.md, plan 34 3.9): every example in it reads without a mistake (a syntax line
    // with <...> in it is no example).
    [Fact]
    public void EveryExampleInTheGuideReads()
    {
        var guide = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "defaults")!, "macros", "README.md"));
        var blocks = System.Text.RegularExpressions.Regex.Matches(guide, "```\\r?\\n(.*?)```", System.Text.RegularExpressions.RegexOptions.Singleline)
            .Select(m => m.Groups[1].Value).Where(b => !b.Contains('<')).ToList();
        Assert.True(blocks.Count >= 10, $"only {blocks.Count} examples found");
        var engine = new Jint.Engine();
        engine.Execute(Source);
        foreach (var block in blocks)
        {
            engine.SetValue("text", block);
            var errors = engine.Evaluate("""
                JSON.stringify(macroProgram(text, { isAction: n => n.includes('.') || ['go', 'select', 'focus', 'pane'].includes(n.toLowerCase()),
                  systemVars: new Set(['location', 'focused', 'selected', 'count', 'other', 'pane', 'project', 'date', 'time', 'error',
                    'errortext', 'exitcode', 'newline', 'tab']) }).problems.filter(p => p.severity === 'error'))
                """).ToString();
            Assert.True(errors == "[]", $"{block}\n{errors}");
        }
    }

    [Fact]
    public void WhatIsWrongIsToldWhenTheMacroIsRead()
    {
        string P(string text) => string.Join(" / ", Program(text).Problems.Where(p => !p.Contains("before anything gives it")));
        Assert.Equal("1:0 moveto is LexPen's (its editor and documents): Foldex has no moveto", P("moveto 1, 1"));
        Assert.StartsWith("1:19 \"size_kb\" is not a field of an item", P("set $a = $$focused.size_kb"));
        Assert.Equal("1:22 run takes what it runs and its parameters (join texts with &); this is a third value", P("run \"a.exe\" \"-x\" wait \"y\""));
        Assert.Equal("1:0 run needs what it runs: a program, a document or a URL", P("run wait"));
        Assert.Equal("1:0 this for each has no next", P("for each $f in $$selected\nlog $f"));
        Assert.Equal("2:0 next inside the if of line 1 (endif first)", P("if 1 then\nnext\nendif"));
        Assert.Equal("1:9 round takes 2 values, not 1", P("set $a = round(1)"));
        Assert.Empty(Program("set $a = replace(\"abc\", \"b\", \"x\")").Problems);
    }
}
