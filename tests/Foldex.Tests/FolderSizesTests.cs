using System.Diagnostics;
using System.Text.Json.Nodes;
using Foldex.Shell;
using Xunit.Abstractions;

namespace Foldex.Tests;

// Folder sizes (docs/plans/executed/37-PLAN-folder-sizes.md): a folder's tree counted in the background, a record per folder in
// it, links not followed, the cache's reads untouched; a change added up by its difference; a folder deleted taken
// off; F5 lets go; over the budget the deepest records go first; what a record takes.
public class FolderSizesTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-sizes-" + Guid.NewGuid().ToString("N"));
    readonly ITestOutputHelper output;
    readonly List<JsonObject> told = [];

    public FolderSizesTests(ITestOutputHelper output)
    {
        this.output = output;
        Directory.CreateDirectory(Path.Combine(dir, "top", "a", "deep", "deeper"));
        Directory.CreateDirectory(Path.Combine(dir, "top", "b"));
        Directory.CreateDirectory(Path.Combine(dir, "other"));
        File.WriteAllBytes(Path.Combine(dir, "top", "one.bin"), new byte[100]);
        File.WriteAllBytes(Path.Combine(dir, "top", "a", "two.bin"), new byte[20]);
        File.WriteAllBytes(Path.Combine(dir, "top", "a", "deep", "deeper", "three.bin"), new byte[3]);
        File.WriteAllBytes(Path.Combine(dir, "top", "b", "four.bin"), new byte[4000]);
    }

    public void Dispose()
    {
        try { Directory.Delete(dir, true); } catch (IOException) { }
    }

    FolderSizes Sizes(FolderCache cache) => new(cache, m => { lock (told) told.Add(m); });

    static async Task Until(Func<bool> done)
    {
        var clock = Stopwatch.StartNew();
        while (!done())
        {
            if (clock.Elapsed > TimeSpan.FromSeconds(15)) throw new TimeoutException();
            await Task.Delay(50);
        }
    }

    string P(params string[] parts) => Path.Combine([dir, .. parts]);

    [Fact]
    public async Task AFoldersTreeIsCountedWithARecordPerFolderAndTheCachesReadsUntouched()
    {
        using var cache = new FolderCache((_, _) => { });
        using var sizes = Sizes(cache);
        sizes.Count([P("top")], false);
        await Until(() => sizes.Of(P("top")) is not null);
        Assert.Equal((4123L, 4, 4), sizes.Of(P("top")));
        // Every folder under it has its own, at once.
        Assert.Equal((23L, 2, 2), sizes.Of(P("top", "a")));
        Assert.Equal((3L, 1, 0), sizes.Of(P("top", "a", "deep", "deeper")));
        Assert.Equal(0, cache.Reads);
        Assert.Contains(told, m => m["sizes"]?[P("top")]?["size"]?.GetValue<long>() == 4123);
        // Known: what a window asks for when it shows the folder's folders.
        var (known, _) = sizes.Known([P("top", "a"), P("top", "b"), P("other")]);
        Assert.Equal(["a", "b"], known.Select(p => Path.GetFileName(p.Key)).Order());
    }

    // A folder listed whole by the cache (a pane opened it): its size from that when every folder in it has one, so
    // going up from a folder with none in it finds its size there; a folder with one not known stays without; a size
    // made passes up through the folders the cache holds whole.
    [Fact]
    public async Task AFolderReadWholeGetsItsSizeWhenEveryFolderInItHasOne()
    {
        using var cache = new FolderCache((_, _) => { });
        using var sizes = Sizes(cache);
        cache.List(P("top", "a"), null, CancellationToken.None, false, false);
        await Task.Delay(300);
        Assert.Null(sizes.Of(P("top", "a")));
        cache.List(P("top", "a", "deep", "deeper"), null, CancellationToken.None, false, false);
        await Until(() => sizes.Of(P("top", "a", "deep", "deeper")) is not null);
        Assert.Equal((3L, 1, 0), sizes.Of(P("top", "a", "deep", "deeper")));
        // Read last of the ones under top\a: top\a (in the cache, read before) gets its size too, and on up; top (in the
        // cache too) not: b in it has none.
        cache.List(P("top"), null, CancellationToken.None, false, false);
        cache.List(P("top", "a", "deep"), null, CancellationToken.None, false, false);
        await Until(() => sizes.Of(P("top", "a")) is not null);
        Assert.Equal((3L, 1, 1), sizes.Of(P("top", "a", "deep")));
        Assert.Equal((23L, 2, 2), sizes.Of(P("top", "a")));
        Assert.Null(sizes.Of(P("top")));
        // b read: top has its size, from the cache, without being read again.
        var reads = cache.Reads;
        cache.List(P("top", "b"), null, CancellationToken.None, false, false);
        await Until(() => sizes.Of(P("top")) is not null);
        Assert.Equal((4123L, 4, 4), sizes.Of(P("top")));
        Assert.Equal(reads + 1, cache.Reads);
        Assert.Equal(5, sizes.Bytes / FolderSizes.RecordBytes);   // only the ones listed, nothing walked
        // Kept current as a counted one.
        File.WriteAllBytes(P("top", "a", "deep", "deeper", "three.bin"), new byte[10]);
        await Until(() => sizes.Of(P("top", "a"))?.Size == 30);
        await Until(() => sizes.Of(P("top"))?.Size == 4130);
    }

    [Fact]
    public async Task ALinkIsNotFollowed()
    {
        var link = P("top", "link");
        var made = Process.Start(new ProcessStartInfo("cmd.exe", $"/c mklink /J \"{link}\" \"{P("other")}\"") { CreateNoWindow = true, UseShellExecute = false })!;
        made.WaitForExit();
        File.WriteAllBytes(P("other", "big.bin"), new byte[50000]);
        using var cache = new FolderCache((_, _) => { });
        using var sizes = Sizes(cache);
        sizes.Count([P("top")], false);
        await Until(() => sizes.Of(P("top")) is not null);
        Assert.True(Directory.Exists(link));
        Assert.Equal((4123L, 4, 4), sizes.Of(P("top")));
        Directory.Delete(link);
    }

    [Fact]
    public async Task AChangeIsAddedUpByItsDifferenceAndADeletedFolderTakenOff()
    {
        using var cache = new FolderCache((_, _) => { });
        using var sizes = Sizes(cache);
        sizes.Count([P("top")], false);
        await Until(() => sizes.Of(P("top")) is not null);
        // A file grown three folders down: there and every folder above it, without counting again.
        File.WriteAllBytes(P("top", "a", "deep", "deeper", "three.bin"), new byte[1003]);
        await Until(() => sizes.Of(P("top"))?.Size == 5123);
        Assert.Equal((1003L, 1, 0), sizes.Of(P("top", "a", "deep", "deeper")));
        Assert.Equal(1023L, sizes.Of(P("top", "a"))!.Value.Size);
        // A file made: one file more.
        File.WriteAllBytes(P("top", "a", "new.bin"), new byte[7]);
        await Until(() => sizes.Of(P("top"))?.Files == 5);
        Assert.Equal(5130L, sizes.Of(P("top"))!.Value.Size);
        // A folder deleted: its size, files and itself taken off.
        Directory.Delete(P("top", "b"), true);
        await Until(() => sizes.Of(P("top"))?.Size == 1130);
        Assert.Equal((1130L, 4, 3), sizes.Of(P("top")));
        Assert.Null(sizes.Of(P("top", "b")));
        // A folder made with something in it: counted and added.
        Directory.CreateDirectory(P("top", "c", "d"));
        File.WriteAllBytes(P("top", "c", "d", "five.bin"), new byte[5]);
        await Until(() => sizes.Of(P("top"))?.Size == 1135 && sizes.Idle);
        Assert.Equal((1135L, 5, 5), sizes.Of(P("top")));
    }

    [Fact]
    public async Task RefreshLetsGoOfTheFolderAndTheFoldersInIt()
    {
        using var cache = new FolderCache((_, _) => { });
        using var sizes = Sizes(cache);
        sizes.Count([P("top"), P("other")], false);
        await Until(() => sizes.Of(P("top")) is not null && sizes.Of(P("other")) is not null);
        sizes.Forget(P("top"));
        Assert.Null(sizes.Of(P("top")));
        Assert.Null(sizes.Of(P("top", "a", "deep")));
        Assert.NotNull(sizes.Of(P("other")));
        Assert.Contains(told, m => m["gone"]?.AsArray().Any(g => g!.GetValue<string>() == P("top")) == true);
    }

    [Fact]
    public async Task OverTheBudgetTheDeepestRecordsGoFirstAndAChangeUnderOneThatWentLetsGoAbove()
    {
        using var cache = new FolderCache((_, _) => { });
        using var sizes = Sizes(cache);
        sizes.Count([P("top")], false);
        await Until(() => sizes.Of(P("top")) is not null);
        // Room for two records (and nothing for the cache's folders).
        cache.BudgetBytes = 2 * FolderSizes.RecordBytes;
        sizes.Trim();
        Assert.NotNull(sizes.Of(P("top")));
        Assert.Null(sizes.Of(P("top", "a", "deep", "deeper")));
        Assert.Null(sizes.Of(P("top", "a", "deep")));
        Assert.Null(sizes.Of(P("top", "b")));
        Assert.NotNull(sizes.Of(P("top", "a")));
        // A change down where the records went: the folders above it with a record let go, not a wrong size.
        File.WriteAllBytes(P("top", "a", "deep", "deeper", "three.bin"), new byte[9]);
        await Until(() => sizes.Of(P("top")) is null);
        Assert.Null(sizes.Of(P("top", "a")));
    }

    [Fact]
    public async Task WhatARecordTakes()
    {
        // Folders with names as long as usual: a record each, measured as the records the walk keeps.
        var many = P("many");
        for (var i = 0; i < 2000; i++) Directory.CreateDirectory(Path.Combine(many, $"folder number {i:0000} of the measuring"));
        using var cache = new FolderCache((_, _) => { });
        var sizes = Sizes(cache);
        GC.Collect();
        GC.WaitForPendingFinalizers();
        var before = GC.GetTotalMemory(true);
        sizes.Count([many], false);
        await Until(() => sizes.Of(many) is not null && sizes.Idle);
        var after = GC.GetTotalMemory(true);
        var each = (after - before) / 2001;
        output.WriteLine($"{each} bytes a record ({2001} records, path {Path.Combine(many, "folder number 0000 of the measuring").Length} characters)");
        Assert.InRange(each, 50, 1000);
        sizes.Dispose();
    }
}
