using System.Text.Json;

namespace Foldex.Tests;

// The search bar's matching (web/search.js): the go-to's test for what was typed, and the filter's test.
public class SearchTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "search.js"));

    static JsonElement Run(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        engine.Execute("const names = ['Program Files', 'Program Files (x86)', 'ProgramData', 'Windows', 'Users'];");
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void TypedTextFindsNamesStartingWithIt()
    {
        var r = Run("['prog', 'win', 'x86'].map(t => names.filter(typedTest(t)))");
        Assert.Equal("""[["Program Files","Program Files (x86)","ProgramData"],["Windows"],[]]""", r.GetRawText());
    }

    [Fact]
    public void ALeadingStarFindsNamesContainingTheRest()
    {
        // * alone: no test (the go-to does not move).
        var r = Run("[names.filter(typedTest('*files')), names.filter(typedTest('*X86')), typedTest('*')]");
        Assert.Equal("""[["Program Files","Program Files (x86)"],["Program Files (x86)"],null]""", r.GetRawText());
    }

    [Fact]
    public void TheFilterContainsTheTextALeadingStarChangingNothing()
    {
        var r = Run("""
            [['files'], ['*files'], ['']].map(([t]) => { paneSearch.set('p', t); return names.filter(n => searchTest('p')({ name: n })); })
            """);
        Assert.Equal("""[["Program Files","Program Files (x86)"],["Program Files","Program Files (x86)"],["Program Files","Program Files (x86)","ProgramData","Windows","Users"]]""", r.GetRawText());
    }
}
