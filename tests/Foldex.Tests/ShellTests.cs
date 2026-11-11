using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

public class ShellTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-tests-" + Guid.NewGuid().ToString("N"));

    public ShellTests()
    {
        Directory.CreateDirectory(Path.Combine(dir, "sub"));
        File.WriteAllText(Path.Combine(dir, "a.txt"), "abc");
        File.WriteAllText(Path.Combine(dir, "b.exe"), "");
    }

    public void Dispose()
    {
        // Junctions first, one by one: a recursive delete stumbles over them.
        foreach (var link in new DirectoryInfo(dir).EnumerateDirectories().Where(d => d.LinkTarget is not null)) link.Delete();
        Directory.Delete(dir, true);
    }

    [Fact]
    public async Task FolderOnDiskIsListedWithSizesAndOwnIconMarks()
    {
        var r = await StaWorker.Once("t", () => ShellListing.List(dir));
        Assert.Equal("disk", r.Kind);
        Assert.Null(r.Error);
        var byName = r.Entries.ToDictionary(e => e!["name"]!.GetValue<string>(), e => e!);
        Assert.True(byName["sub"]["folder"]!.GetValue<bool>());
        Assert.Equal(3, byName["a.txt"]["size"]!.GetValue<long>());
        Assert.Equal(Path.Combine(dir, "a.txt"), byName["a.txt"]["id"]!.GetValue<string>());
        Assert.False(byName["a.txt"]["own"]!.GetValue<bool>());
        Assert.True(byName["b.exe"]["own"]!.GetValue<bool>());
    }

    [Fact]
    public async Task ATreeListingSaysWhichFoldersHaveSubfolders()
    {
        Directory.CreateDirectory(Path.Combine(dir, "deep", "inner"));
        var secret = Directory.CreateDirectory(Path.Combine(dir, "veiled", "secret"));
        secret.Attributes |= FileAttributes.Hidden;
        var r = await StaWorker.Once("t", () => ShellListing.List(dir, null, default, true));
        var byName = r.Entries.ToDictionary(e => e!["name"]!.GetValue<string>(), e => e!);
        Assert.False(byName["sub"]["subs"]!.GetValue<bool>());
        Assert.True(byName["deep"]["subs"]!.GetValue<bool>());
        Assert.Equal("hidden", byName["veiled"]["subs"]!.GetValue<string>());
    }

    [Fact]
    public async Task ATreeWithFilesSaysWhichFoldersHaveFiles()
    {
        Directory.CreateDirectory(Path.Combine(dir, "deep", "inner"));
        File.WriteAllText(Path.Combine(dir, "sub", "f.txt"), "x");
        var veiled = Path.Combine(dir, "deep", "v.txt");
        File.WriteAllText(veiled, "x");
        File.SetAttributes(veiled, FileAttributes.Hidden);
        var r = await StaWorker.Once("t", () => ShellListing.List(dir, null, default, false, true));
        var byName = r.Entries.ToDictionary(e => e!["name"]!.GetValue<string>(), e => e!);
        Assert.False(byName["sub"]["subs"]!.GetValue<bool>());
        Assert.True(byName["sub"]["files"]!.GetValue<bool>());
        Assert.True(byName["deep"]["subs"]!.GetValue<bool>());
        Assert.Equal("hidden", byName["deep"]["files"]!.GetValue<string>());
        Assert.Null(byName["a.txt"]["files"]);   // a file has neither
    }

    [Fact]
    public async Task ALinkHasSubfoldersWhenItsTargetHas()
    {
        Directory.CreateDirectory(Path.Combine(dir, "deep", "inner"));
        Junction("toDeep", "deep");
        Junction("toSub", "sub");
        // As C:\Documents and Settings: a junction that refuses its own listing.
        Junction("veiledSub", "sub");
        Run("icacls", $"\"{Path.Combine(dir, "veiledSub")}\" /deny \"{Environment.UserName}:(RD)\"");
        Assert.Throws<UnauthorizedAccessException>(() => Directory.GetDirectories(Path.Combine(dir, "veiledSub")));
        var r = await StaWorker.Once("t", () => ShellListing.List(dir, null, default, true));
        var byName = r.Entries.ToDictionary(e => e!["name"]!.GetValue<string>(), e => e!);
        Assert.True(byName["toDeep"]["subs"]!.GetValue<bool>());
        Assert.False(byName["toSub"]["subs"]!.GetValue<bool>());
        Assert.False(byName["veiledSub"]["subs"]!.GetValue<bool>());
        Run("icacls", $"\"{Path.Combine(dir, "veiledSub")}\" /remove:d \"{Environment.UserName}\"");
    }

    void Junction(string name, string target) =>
        Run("cmd", $"/c mklink /J \"{Path.Combine(dir, name)}\" \"{Path.Combine(dir, target)}\"");

    static void Run(string file, string args)
    {
        using var p = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(file, args)
            { CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true })!;
        p.StandardOutput.ReadToEnd();
        p.WaitForExit();
        Assert.Equal(0, p.ExitCode);
    }

    [Fact]
    public async Task BatchesAndRestHoldEveryEntry()
    {
        var parts = new List<JsonArray>();
        var r = await StaWorker.Once("t", () => ShellListing.List(dir, parts.Add));
        Assert.Equal(3, parts.Sum(p => p.Count) + r.Entries.Count);
    }

    [Fact]
    public async Task CancelledListingSaysSo()
    {
        using var cancel = new CancellationTokenSource();
        cancel.Cancel();
        var r = await StaWorker.Once("t", () => ShellListing.List(dir, null, cancel.Token));
        Assert.True(r.Cancelled);
        Assert.Empty(r.Entries);
    }

    [Fact]
    public async Task ThisPCIsAShellFolderOfDrives()
    {
        var r = await StaWorker.Once("t", () => ShellListing.List("::{20D04FE0-3AEA-1069-A2D8-08002B30309D}"));
        Assert.Equal("shell", r.Kind);
        Assert.Null(r.Error);
        Assert.Contains(r.Entries, e => e!["id"]!.GetValue<string>().Equals(@"C:\", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ACompatibilityLinkThatDeniesListingShowsItsTarget()
    {
        // C:\Documents and Settings: a junction to C:\Users with Everyone:(DENY)(RD) on itself.
        var r = await StaWorker.Once("t", () => ShellListing.List(@"C:\Documents and Settings"));
        Assert.Null(r.Error);
        Assert.Equal(@"C:\Users", r.Target);
        Assert.Contains(r.Entries, e => e!["id"]!.GetValue<string>().StartsWith(@"C:\Users\", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void AFolderThatIsNoLinkHasNoTarget()
    {
        Assert.Null(ShellListing.LinkTarget(dir));
    }

    [Fact]
    public async Task MissingFolderIsAnErrorNotAnException()
    {
        var r = await StaWorker.Once("t", () => ShellListing.List(Path.Combine(dir, "nope")));
        Assert.NotNull(r.Error);
    }

    [Fact]
    public async Task ItemsOfTwoFoldersGetNoExplorerMenu()
    {
        Directory.CreateDirectory(Path.Combine(dir, "other"));
        File.WriteAllText(Path.Combine(dir, "other", "c.txt"), "");
        var error = await StaWorker.Once("t", () =>
        {
            var (menu, error) = ShellMenu.Create([Path.Combine(dir, "a.txt"), Path.Combine(dir, "other", "c.txt")], false);
            menu?.Dispose();
            return error;
        });
        Assert.NotNull(error);
    }

    [Fact]
    public async Task ItemsOfOneFolderGetExplorersMenuWithDelete()
    {
        var texts = await StaWorker.Once("t", () =>
        {
            var (menu, error) = ShellMenu.Create([Path.Combine(dir, "a.txt")], false);
            Assert.Null(error);
            using (menu) return menu!.Texts();
        });
        Assert.Contains(texts, t => t.Replace("&", "") == "Delete");
    }
}

public class ElevatedHelperTests
{
    [Theory]
    [InlineData("not json")]
    [InlineData("""{ "op": "run", "path": "C:\\" }""")]
    [InlineData("""{ "op": "list", "path": "relative" }""")]
    [InlineData("""{ "op": "list" }""")]
    public void AnythingOutsideTheSetIsRefused(string line)
    {
        Assert.NotNull(ElevatedHelper.Answer(line)["error"]);
        Assert.Null(ElevatedHelper.Answer(line)["entries"]);
    }

    [Fact]
    public void ListingAFullPathAnswersEntries()
    {
        var answer = ElevatedHelper.Answer(new JsonObject { ["op"] = "list", ["path"] = Path.GetTempPath() }.ToJsonString());
        Assert.NotNull(answer["entries"]);
    }
}
