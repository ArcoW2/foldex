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

    [Fact]
    public void ProjectFoldersAreFoundFromTheTests()
    {
        var web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web");
        Assert.NotNull(web);
        Assert.True(File.Exists(Path.Combine(web, "index.html")));
    }
}
