namespace Foldex.Tests;

public class WebFilesTests
{
    [Theory]
    [InlineData("index.html")]
    [InlineData("/app.js")]
    [InlineData("app.css")]
    public void PageFilesAreInTheExe(string path)
    {
        using var stream = WebFiles.Resource(path);
        Assert.NotNull(stream);
    }

    [Fact]
    public void MissingFileIsNull()
    {
        Assert.Null(WebFiles.Resource("nope.js"));
    }

    [Theory]
    [InlineData("index.html", "text/html; charset=utf-8")]
    [InlineData("a.JS", "text/javascript; charset=utf-8")]
    [InlineData("a.bin", "application/octet-stream")]
    public void ContentTypeByExtension(string path, string type)
    {
        Assert.Equal(type, WebFiles.ContentType(path));
    }

    // Parsed, not run: a script that does not parse leaves its page empty (a quote in a text once did).
    [Fact]
    public void EveryPageScriptParses()
    {
        var web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;
        foreach (var file in Directory.GetFiles(web, "*.js"))
        {
            var problem = Record.Exception(() => new Acornima.Parser().ParseScript(File.ReadAllText(file)));
            Assert.True(problem is null, $"{Path.GetFileName(file)}: {problem?.Message}");
        }
    }

    // The scripts of a page share one global scope: a name declared at the top of two of them (a const twice makes the
    // second script not run at all; a function twice silently replaces the first) is a mistake.
    [Theory]
    [InlineData("index.html")]
    [InlineData("settings.html")]
    [InlineData("projects.html")]
    public void NoTopLevelNameIsDeclaredTwiceOnAPage(string page)
    {
        var web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;
        var scripts = System.Text.RegularExpressions.Regex.Matches(File.ReadAllText(Path.Combine(web, page)), "<script src=\"([^\"]+)\"")
            .Select(m => m.Groups[1].Value).Where(s => File.Exists(Path.Combine(web, s))).ToList();
        Assert.NotEmpty(scripts);
        var seen = new Dictionary<string, string>();
        var twice = new List<string>();
        foreach (var script in scripts)
            foreach (var statement in new Acornima.Parser().ParseScript(File.ReadAllText(Path.Combine(web, script))).Body)
            {
                IEnumerable<string> names = statement switch
                {
                    Acornima.Ast.VariableDeclaration v => v.Declarations.Select(d => d.Id).OfType<Acornima.Ast.Identifier>().Select(i => i.Name),
                    Acornima.Ast.FunctionDeclaration f when f.Id is not null => [f.Id.Name],
                    Acornima.Ast.ClassDeclaration c when c.Id is not null => [c.Id.Name],
                    _ => [],
                };
                foreach (var name in names)
                    if (seen.TryGetValue(name, out var first)) twice.Add($"{name} ({first}, {script})");
                    else seen[name] = script;
            }
        Assert.Empty(twice);
    }

    [Fact]
    public void ProjectFoldersAreFoundFromTheTests()
    {
        var web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web");
        Assert.NotNull(web);
        Assert.True(File.Exists(Path.Combine(web, "index.html")));
    }
}
