using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// One read per folder (docs/plans/executed/24-PLAN-folder-cache.md): the cache, the folder use, the network guard.
public class FolderCacheTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-cache-" + Guid.NewGuid().ToString("N"));

    public FolderCacheTests()
    {
        Directory.CreateDirectory(Path.Combine(dir, "sub", "deeper"));
        Directory.CreateDirectory(Path.Combine(dir, "empty"));
        File.WriteAllText(Path.Combine(dir, "a.txt"), "a");
        File.WriteAllText(Path.Combine(dir, "b.txt"), "bb");
    }

    public void Dispose()
    {
        try { Directory.Delete(dir, true); } catch (IOException) { }
    }

    static List<string> Names(ShellListing.Result r, List<JsonArray>? batches = null) =>
        (batches ?? []).SelectMany(b => b).Concat(r.Entries).Select(e => e!["name"]!.GetValue<string>()).Order().ToList();

    [Fact]
    public void FoldersOnlyThenEverythingReadsTheFolderOnceAndGivesTheTreeItsExtras()
    {
        using var cache = new FolderCache((_, _) => { });
        int? count = null;
        var tree = cache.List(dir, null, default, foldersOnly: true, tree: true, (c, _) => count = c);
        Assert.Equal(["empty", "sub"], Names(tree));
        Assert.Equal(2, count);
        Assert.True(cache.Has(dir));
        var sub = tree.Entries.First(e => e!["name"]!.GetValue<string>() == "sub")!;
        Assert.True(sub["subs"]!.GetValue<bool>());
        Assert.False(tree.Entries.First(e => e!["name"]!.GetValue<string>() == "empty")!["subs"]!.GetValue<bool>());
        var all = cache.List(dir, null, default, foldersOnly: false, tree: false, (c, _) => count = c);
        Assert.Equal(["a.txt", "b.txt", "empty", "sub"], Names(all));
        Assert.Equal(4, count);
        Assert.Null(all.Entries.First(e => e!["name"]!.GetValue<string>() == "a.txt")!["subs"]);
    }

    // A cached folder deleted and made again under its name (git on a checkout): its old watch tells nothing more, so its
    // read is let go when its parent's watch sees it go; read anew, it has what is in it now. A pane showing it is told.
    [Fact]
    public void AFolderDeletedAndMadeAgainIsReadAnew()
    {
        var told = new List<string>();
        using var cache = new FolderCache((path, _) => { lock (told) told.Add(path); });
        var sub = Path.Combine(dir, "empty");
        cache.List(dir, null, default, false, false);
        Assert.Empty(cache.List(sub, null, default, false, false).Entries);
        Directory.Delete(sub);
        Directory.CreateDirectory(sub);
        File.WriteAllText(Path.Combine(sub, "new.txt"), "n");
        List<string> names = [];
        for (var i = 0; i < 50; i++)   // the parent's watcher reports within a moment
        {
            Thread.Sleep(50);
            names = Names(cache.List(sub, null, default, false, false));
            if (names.Count > 0) break;
        }
        Assert.Equal(["new.txt"], names);
        // And watched again: a change after it is in the cache too.
        File.WriteAllText(Path.Combine(sub, "later.txt"), "l");
        for (var i = 0; i < 50; i++)
        {
            Thread.Sleep(50);
            names = Names(cache.List(sub, null, default, false, false));
            if (names.Count > 1) break;
        }
        Assert.Equal(["later.txt", "new.txt"], names);
        for (var i = 0; i < 40 && !told.Contains(sub, StringComparer.OrdinalIgnoreCase); i++) Thread.Sleep(50);
        lock (told) Assert.Contains(sub, told, StringComparer.OrdinalIgnoreCase);
    }

    // A folder read again (F5, its changes lost) while files come in (git on a checkout): what its watch reports during
    // that read goes into the new read, not into the old one the new read then replaces.
    [Fact]
    public void FilesMadeWhileAFolderIsReadAgainAreAllInIt()
    {
        using var cache = new FolderCache((_, _) => { });
        var big = Path.Combine(dir, "big");
        Directory.CreateDirectory(big);
        for (var i = 0; i < 20000; i++) File.WriteAllText(Path.Combine(big, $"a{i}.txt"), "");
        cache.List(big, null, default, false, false);
        var writer = Task.Run(() =>
        {
            // Named to come first: a read under way has passed their place, so only the watch can report them.
            for (var i = 0; i < 6000; i++) File.WriteAllText(Path.Combine(big, $"0{i}.txt"), "");
        });
        while (!writer.IsCompleted)   // read again and again while they come in
        {
            cache.Invalidate(big);
            cache.List(big, null, default, false, false);
        }
        writer.Wait();
        var onDisk = Directory.GetFileSystemEntries(big).Select(Path.GetFileName).ToList();
        var want = onDisk.Count;
        var have = 0;
        // The watch reports within a moment. Looked at without the check made when it is shown from the cache; read
        // again only when its watch lost changes (too many at once: a window is told to read it again).
        for (var i = 0; i < 100 && have != want; i++)
        {
            Thread.Sleep(50);
            if (!cache.Has(big)) cache.List(big, null, default, false, false);
            have = cache.Entries(big, onDisk!, false, false)?.Count ?? -1;
        }
        Assert.Equal(want, have);
    }

    // A folder shown from the cache is checked against the disk behind it: what its watch missed is put in, and the
    // windows are told which items changed.
    [Fact]
    public void AFolderShownFromTheCacheIsCheckedAgainstTheDisk()
    {
        var told = new System.Collections.Concurrent.ConcurrentQueue<IReadOnlyList<string>?>();
        using var cache = new FolderCache((_, names) => told.Enqueue(names));
        cache.List(dir, null, default, false, false);
        cache.Deafen(dir);   // its watch misses what comes now
        File.WriteAllText(Path.Combine(dir, "c.txt"), "c");
        File.Delete(Path.Combine(dir, "a.txt"));
        Thread.Sleep(500);
        Assert.Equal(["a.txt", "b.txt", "empty", "sub"], Names(cache.List(dir, null, default, false, false)));   // as cached; checked behind it
        for (var i = 0; i < 60 && told.IsEmpty; i++) Thread.Sleep(50);
        Assert.True(told.TryDequeue(out var names));
        Assert.Contains("a.txt", names!);
        Assert.Contains("c.txt", names!);   // Windows may report more (a folder made just before, as sub)
        Assert.Equal(["b.txt", "c.txt", "empty", "sub"], Names(cache.List(dir, null, default, false, false)));
    }

    [Fact]
    public void AChangeOnDiskIsInTheCacheWithoutReadingAgain()
    {
        using var cache = new FolderCache((_, _) => { });
        cache.List(dir, null, default, false, false);
        File.WriteAllText(Path.Combine(dir, "c.txt"), "c");
        File.Delete(Path.Combine(dir, "a.txt"));
        File.Move(Path.Combine(dir, "b.txt"), Path.Combine(dir, "bee.txt"));
        List<string> names = [];
        for (var i = 0; i < 50; i++)   // the watcher reports within a moment
        {
            Thread.Sleep(50);
            names = Names(cache.List(dir, null, default, false, false));
            if (names.SequenceEqual(["bee.txt", "c.txt", "empty", "sub"])) break;
        }
        Assert.Equal(["bee.txt", "c.txt", "empty", "sub"], names);
        Assert.True(cache.Has(dir));
    }

    [Fact]
    public void TheWindowsAreToldWhichItemsChangedAndGetOnlyThose()
    {
        var told = new System.Collections.Concurrent.ConcurrentQueue<(string Folder, IReadOnlyList<string>? Names)>();
        using var cache = new FolderCache((folder, names) => told.Enqueue((folder, names)));
        cache.List(dir, null, default, false, false);
        File.WriteAllText(Path.Combine(dir, "c.txt"), "c");
        File.Delete(Path.Combine(dir, "a.txt"));
        for (var i = 0; i < 50 && told.IsEmpty; i++) Thread.Sleep(50);
        Assert.True(told.TryDequeue(out var t));
        Assert.Equal(dir, t.Folder);
        Assert.Contains("a.txt", t.Names!);
        Assert.Contains("c.txt", t.Names!);   // Windows may report more (a folder made just before, as sub)
        var entries = cache.Entries(dir, ["a.txt", "c.txt"], false, false)!;
        Assert.Equal(["c.txt"], entries.Select(e => e!["name"]!.GetValue<string>()));   // a.txt is gone: left out
        Assert.Empty(cache.Entries(dir, ["sub", "c.txt"], true, true)!.Where(e => e!["name"]!.GetValue<string>() == "c.txt"));
        Assert.Null(cache.Entries(Path.Combine(dir, "sub"), ["deeper"], false, false));   // not cached: read whole
    }

    // The same folder as a share (the loopback's admin share, \\localhost\D$\...): through the cache, its changes told
    // item by item; with shares not kept, let go once no window shows it.
    string Unc => $@"\\localhost\{dir[0]}$\{dir[3..]}";

    [Fact]
    public void AShareGoesThroughTheCacheItsChangesToldByNameAndNotKeptWhenNotShown()
    {
        if (!Directory.Exists(Unc)) return;   // no admin share here: nothing to test
        var told = new System.Collections.Concurrent.ConcurrentQueue<IReadOnlyList<string>?>();
        using var cache = new FolderCache((_, names) => told.Enqueue(names)) { CacheNetwork = false };
        var window = new object();
        Assert.True(cache.Caches(Unc));
        Assert.False(cache.Keeps(Unc));
        cache.List(Unc, null, default, false, false);
        cache.Shown(window, [Unc]);
        File.WriteAllText(Path.Combine(dir, "c.txt"), "c");
        // Told by its watch, or else by the check made when it is shown again from the cache.
        for (var i = 0; i < 60 && told.IsEmpty; i++)
        {
            Thread.Sleep(50);
            if (i == 20) cache.List(Unc, null, default, false, false);
        }
        Assert.True(told.TryDequeue(out var names));
        Assert.Contains("c.txt", names!);
        Assert.True(cache.Has(Unc));
        var grace = FolderCache.ShareGrace;
        FolderCache.ShareGrace = TimeSpan.Zero;
        try { cache.Shown(window, []); }
        finally { FolderCache.ShareGrace = grace; }
        Assert.False(cache.Has(Unc));
    }

    [Fact]
    public void TwoRequestsAtOnceShareTheRead()
    {
        using var cache = new FolderCache((_, _) => { });
        var results = new ShellListing.Result[2];
        Parallel.For(0, 2, i => results[i] = cache.List(dir, null, default, false, i == 1));
        Assert.All(results, r => Assert.Equal(["a.txt", "b.txt", "empty", "sub"], Names(r)));
        Assert.Equal(1, cache.Info().Folders);
    }

    [Fact]
    public void OverTheBudgetTheFolderUsedLongestAgoGoesNeverAShownOne()
    {
        using var cache = new FolderCache((_, _) => { });
        var sub = Path.Combine(dir, "sub");
        var deeper = Path.Combine(sub, "deeper");
        cache.Shown("window", [dir]);
        cache.List(dir, null, default, false, false);
        cache.List(sub, null, default, false, false);
        Thread.Sleep(20);
        cache.List(deeper, null, default, false, false);
        cache.BudgetBytes = cache.Info().Bytes - 1;   // one folder too many
        cache.Trim(false);
        Assert.True(cache.Has(dir));       // shown
        Assert.False(cache.Has(sub));      // used longest ago
        Assert.True(cache.Has(deeper));
        cache.Trim(true);                  // Windows short of memory: all but the shown
        Assert.True(cache.Has(dir));
        Assert.False(cache.Has(deeper));
    }

    [Fact]
    public void FolderUseScoresOftenAndLately()
    {
        var file = Path.Combine(dir, "use.json");
        var use = new FolderUse(file);
        use.Opened(@"C:\Often");
        use.Opened(@"C:\Often");
        use.Opened(@"C:\Once");
        Assert.Equal([@"C:\Often", @"C:\Once"], use.Best());
        use.Save();
        Assert.Equal([@"C:\Often", @"C:\Once"], new FolderUse(file).Best());   // kept
    }

    [Fact]
    public void AShareThatDoesNotAnswerIsNotWaitedFor()
    {
        Assert.False(NetworkGuard.IsNetwork(@"C:\Windows"));
        Assert.True(NetworkGuard.IsNetwork(@"\\server\share\folder"));
        Assert.Equal(@"\\server", NetworkGuard.Server(@"\\server\share\folder"));
        Assert.True(NetworkGuard.Reachable(@"C:\Windows").Result);
        var limit = NetworkGuard.LimitMs;
        NetworkGuard.LimitMs = 500;
        try
        {
            var clock = System.Diagnostics.Stopwatch.StartNew();
            Assert.False(NetworkGuard.Reachable(@"\\192.0.2.1\share\folder").Result);   // TEST-NET-1: never answers
            Assert.True(clock.ElapsedMilliseconds < 1500, $"{clock.ElapsedMilliseconds} ms");
            Assert.NotNull(NetworkGuard.DownSince(@"\\192.0.2.1\other"));
            clock.Restart();
            Assert.False(NetworkGuard.Reachable(@"\\192.0.2.1\share").Result);           // marked: answered at once
            Assert.True(clock.ElapsedMilliseconds < 100, $"{clock.ElapsedMilliseconds} ms");
        }
        finally { NetworkGuard.LimitMs = limit; }
    }
}
