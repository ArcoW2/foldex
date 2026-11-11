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

    [Fact]
    public void ProjectFoldersAreFoundFromTheTests()
    {
        var web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web");
        Assert.NotNull(web);
        Assert.True(File.Exists(Path.Combine(web, "index.html")));
    }
}
