using System.Text;
using System.Text.RegularExpressions;
using Foldex.Shell;

namespace Foldex.Tests;

// Find's Containing text (docs/plans/20-PLAN-extended-search.md 3.1): the expression the page builds (scraps.js
// searchExpression), read the same way by JavaScript and .NET; the host's text check (TextSearch): the encodings,
// Known files and All files, only the start; a search with a text.
public class TextSearchTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-text-" + Guid.NewGuid().ToString("N"));

    public TextSearchTests() => Directory.CreateDirectory(dir);

    public void Dispose() => Directory.Delete(dir, true);

    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;

    static Jint.Engine Page()
    {
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(Web, "scraps.js")));
        return engine;
    }

    // The expression for a text, and whether JavaScript and .NET each find it in every line of `lines`.
    static (string? Pattern, string Js, string Net) Matches(string text, string mode, bool word, params string[] lines)
    {
        var engine = Page();
        engine.SetValue("lines", lines);
        var pattern = engine.Evaluate($"searchExpression({System.Text.Json.JsonSerializer.Serialize(text)}, '{mode}', {(word ? "true" : "false")})");
        if (pattern.Type == Jint.Runtime.Types.Null) return (null, "", "");
        var js = engine.Evaluate($"lines.map(l => new RegExp(searchExpression({System.Text.Json.JsonSerializer.Serialize(text)}, '{mode}', {(word ? "true" : "false")}), 'i').test(l) ? 1 : 0).join('')").ToString();
        var re = TextSearch.Make(pattern.ToString(), false)!;
        var net = string.Concat(lines.Select(l => re.IsMatch(l) ? '1' : '0'));
        return (pattern.ToString(), js, net);
    }

    [Fact]
    public void NormalIsTheFiltersWildcardsWithinALine()
    {
        var (_, js, net) = Matches("to*do;FIX?E", "normal", false, "a TODO here", "to be done", "to\ndo", "fixme", "fix.me", "fixe", "plain");
        Assert.Equal("1101000", js);   // FIX?E: one character between X and E, so not "fixe"
        Assert.Equal(js, net);
        // Nothing to look for: no expression.
        Assert.Null(Matches("", "normal", false).Pattern);
        Assert.Null(Matches(";;", "normal", false).Pattern);
    }

    [Fact]
    public void VerbatimHasNoSpecialCharactersAndRegexIsTakenAsItIs()
    {
        var (_, js, net) = Matches("a*b (c)", "verbatim", false, "x a*b (c) y", "aXb (c)", "ab c");
        Assert.Equal("100", js);
        Assert.Equal(js, net);
        (_, js, net) = Matches(@"^\d{3}-\w+$", "regex", false, "123-abc", "12-abc", "x123-abc");
        Assert.Equal("100", js);
        Assert.Equal(js, net);
    }

    [Fact]
    public void WholeWordsOnlyMatchAWordOfItsOwn()
    {
        var (_, js, net) = Matches("cat", "normal", true, "a cat sat", "concatenate", "cat.", "Cats");
        Assert.Equal("1010", js);
        Assert.Equal(js, net);
    }

    string Make(string name, byte[] bytes)
    {
        var path = Path.Combine(dir, name);
        File.WriteAllBytes(path, bytes);
        return path;
    }

    [Fact]
    public void TextIsReadInItsEncoding()
    {
        var re = TextSearch.Make("(?:café)", false)!;
        var bom = Make("bom.txt", [0xEF, 0xBB, 0xBF, .. Encoding.UTF8.GetBytes("le café")]);
        var utf16 = Make("wide.txt", [0xFF, 0xFE, .. Encoding.Unicode.GetBytes("le café")]);
        var utf8 = Make("plain.log", Encoding.UTF8.GetBytes("le café"));
        var latin = Make("old.ini", Encoding.Latin1.GetBytes("le café"));
        foreach (var f in new[] { bom, utf16, utf8, latin }) Assert.True(TextSearch.Holds(f, re, false, 0), Path.GetFileName(f));
        Assert.False(TextSearch.Holds(utf8, TextSearch.Make("(?:CAFÉ)", true)!, false, 0));   // case sensitive
        Assert.True(TextSearch.Holds(utf8, TextSearch.Make("(?:CAFÉ)", false)!, false, 0));
    }

    [Fact]
    public void KnownFilesSkipABinaryAllFilesReadsIt()
    {
        var re = TextSearch.Make("(?:TODO)", false)!;
        var binary = Make("data.bin", [0, 1, 2, 0, .. Encoding.ASCII.GetBytes(" TODO "), 0, 0]);
        Assert.False(TextSearch.Holds(binary, re, false, 0));
        Assert.True(TextSearch.Holds(binary, re, true, 0));
    }

    [Fact]
    public void OnlyTheStartIsSearchedWhenAsked()
    {
        var re = TextSearch.Make("(?:needle)", false)!;
        var path = Make("long.txt", Encoding.ASCII.GetBytes(new string('x', 5000) + " needle"));
        Assert.True(TextSearch.Holds(path, re, false, 0));
        Assert.False(TextSearch.Holds(path, re, false, 4096));
        Assert.True(TextSearch.Holds(path, re, false, 8192));
    }

    [Fact]
    public void WindowsFiltersGiveAFilesText()
    {
        // The plain text filter Windows has for .txt: the interop works (a .docx or .pdf filter is not on every PC).
        var path = Make("filtered.txt", Encoding.ASCII.GetBytes("first line\r\nsecond needle line"));
        var text = TextSearch.Filtered(path, 0);
        Assert.NotNull(text);
        Assert.Contains("needle", text);
    }

    [Fact]
    public async Task ASearchWithATextFindsOnlyFilesHoldingIt()
    {
        Make("a.txt", Encoding.ASCII.GetBytes("nothing here"));
        Make("b.txt", Encoding.ASCII.GetBytes("a TODO to do"));
        Directory.CreateDirectory(Path.Combine(dir, "TODO folder"));
        var found = new List<string>();
        var o = new FileSearch.Options(dir, null, true, true, false, true, true, false, 100, "", TextPattern: "(?:todo)");
        await StaWorker.Once("t", () => FileSearch.Run(o, part => found.AddRange(part.Select(e => e!["name"]!.GetValue<string>())), default));
        Assert.Equal(["b.txt"], found);
        // A text that is no regular expression: refused, as a name that is none.
        Assert.Throws<RegexParseException>(() => TextSearch.Make("(", false));
    }
}
