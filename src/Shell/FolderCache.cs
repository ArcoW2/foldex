using System.Diagnostics;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// One read per folder (docs/plans/executed/24-PLAN-folder-cache.md): the folders on disk (and on shares, as the setting says)
/// that any window asked for, for all windows. A folder's bare read (its items as Windows' folder read gives them) is
/// made once and kept; the extras of an item (its entry with icon and own columns, for a tree whether a folder has
/// folders and files in it) are worked out when a request first needs them and kept with it. Every cached folder is
/// watched from before it is read: a change is put in as it is reported, and a folder whose changes were lost is read
/// again. The cache grows up to its budget, the folders used longest ago going first (never one a window shows); read
/// ahead fills only what is free. Shell places are not cached: they are listed as before.
/// </summary>
sealed class FolderCache : IDisposable
{
    sealed class Item(FileSystemInfo info)
    {
        public readonly FileSystemInfo Info = info;
        public JsonObject? Entry;     // the listing's entry (icon, own columns): for a pane showing it
        public JsonNode? Subs;        // for a tree: whether it has folders in it
        public JsonNode? Files;       // and files (asked only when a tree shows files)
        public bool FilesKnown;
        public bool Folder => (Info.Attributes & FileAttributes.Directory) != 0;
    }

    sealed class Folder(string path)
    {
        public readonly string Path = path;
        public Dictionary<string, Item> Items = new(StringComparer.OrdinalIgnoreCase);
        public bool Complete, Stale, Network;
        public string? Target;                       // a link that may not be listed itself: the folder read instead
        public TaskCompletionSource? Reading;        // the bare read under way (others wait for it)
        public FileSystemWatcher? Watcher;
        public readonly List<(WatcherChangeTypes Kind, string Path, string? OldPath)> Pending = [];
        public DateTime LastUsed = DateTime.UtcNow;
        public int Entries;                          // items with their entry worked out (for the memory count)
    }

    // What a cached item takes, measured (plan 24 3.5): the bare read and the entry worked out. Used to keep the cache
    // under its budget; see the plan's As built for how they were measured.
    public static long BareBytes = 600, EntryBytes = 1400;

    readonly Dictionary<string, Folder> folders = new(StringComparer.OrdinalIgnoreCase);
    readonly object gate = new();
    readonly Dictionary<object, HashSet<string>> shownBy = [];
    readonly Action<string> changed;
    int busy;
    long lastRequest;

    /// <summary>Bare reads made so far (the host's log of reads, for the tests and the settings window).</summary>
    public int Reads;

    /// <summary>`changed`: a folder's items changed (reported by its watch, or found by a check of a share shown
    /// again), for the windows to read it again from the cache; told once the folder has been quiet for QuietMs.</summary>
    public FolderCache(Action<string> changed)
    {
        this.changed = changed;
        quiet = new System.Threading.Timer(_ => TellChanged());
    }

    // The windows told of changes once things have been quiet for a moment (a file being written does not make its
    // folder read again and again), as FolderWatch did.
    const int QuietMs = 300;
    readonly System.Threading.Timer quiet;
    readonly HashSet<string> toTell = new(StringComparer.OrdinalIgnoreCase);

    void Tell(string path)
    {
        lock (toTell) toTell.Add(path);
        quiet.Change(QuietMs, Timeout.Infinite);
    }

    void TellChanged()
    {
        List<string> paths;
        lock (toTell) { paths = [.. toTell]; toTell.Clear(); }
        foreach (var p in paths) changed(p);
    }

    /// <summary>The memory the cache may take (folderCacheMB) and whether shares are cached (cacheNetwork).</summary>
    public long BudgetBytes { get; set; } = 256L * 1024 * 1024;
    public bool CacheNetwork { get; set; } = true;

    /// <summary>Whether a request of a window is being answered, or was a moment ago (read-ahead waits).</summary>
    public bool Busy => Volatile.Read(ref busy) > 0 || Stopwatch.GetElapsedTime(Volatile.Read(ref lastRequest)).TotalMilliseconds < 1500;

    public (long Bytes, int Folders) Info()
    {
        lock (gate) return (folders.Values.Sum(SizeOf), folders.Count);
    }

    static long SizeOf(Folder f) => f.Items.Count * BareBytes + f.Entries * EntryBytes;

    /// <summary>Whether a path is cached at all: a folder on disk, or on a share when shares are cached.</summary>
    public bool Caches(string location) =>
        Path.IsPathFullyQualified(location) && !location.StartsWith(@"\\?\") && (CacheNetwork || !NetworkGuard.IsNetwork(location));

    /// <summary>Whether a folder is in the cache, read whole.</summary>
    public bool Has(string location)
    {
        lock (gate) return folders.TryGetValue(Key(location), out var f) && f.Complete && !f.Stale;
    }

    static string Key(string path) => path.Length > 3 ? path.TrimEnd('\\') : path;

    /// <summary>The folders a window shows (its lists, the folders open in its trees): never let go.</summary>
    public void Shown(object window, IEnumerable<string> shown)
    {
        lock (gate) shownBy[window] = shown.Select(Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public void Forget(object window)
    {
        lock (gate) shownBy.Remove(window);
    }

    bool IsShown(string key) => shownBy.Values.Any(s => s.Contains(key));

    /// <summary>A listing as ShellListing.List gives it, from the cache: the bare read made or waited for, then this
    /// request's extras, in batches. `count`: the number of items it will give, as soon as it is known. Not a
    /// cached place, or a folder that cannot be read: listed as before (with its error).</summary>
    public ShellListing.Result List(string location, Action<JsonArray>? batch, CancellationToken cancel, bool foldersOnly, bool tree,
        Action<int, bool>? count = null)
    {
        if (!Caches(location)) return ShellListing.List(location, batch, cancel, foldersOnly, tree);
        Interlocked.Increment(ref busy);
        try
        {
            var clock = Stopwatch.StartNew();
            var (f, fromCache) = Bare(location);
            if (f is null) return ShellListing.List(location, batch, cancel, foldersOnly, tree);
            List<Item> items;
            lock (gate)
            {
                f.LastUsed = DateTime.UtcNow;
                items = f.Items.Values.Where(i => !foldersOnly || i.Folder).ToList();
            }
            count?.Invoke(items.Count, fromCache);
            var batcher = new ShellListing.Batcher(batch);
            var icons = new Stopwatch();
            foreach (var item in items)
            {
                if (cancel.IsCancellationRequested) break;
                batcher.Add(EntryOf(f, item, foldersOnly, tree, icons));
            }
            if (fromCache && f.Network) _ = Task.Run(() => Check(location));   // a share may not report its changes: checked
            return new ShellListing.Result(batcher.Rest, null, false, clock.ElapsedMilliseconds, "disk", icons.ElapsedMilliseconds,
                cancel.IsCancellationRequested, f.Target);
        }
        finally
        {
            Volatile.Write(ref lastRequest, Stopwatch.GetTimestamp());
            Interlocked.Decrement(ref busy);
        }
    }

    /// <summary>What a cached folder holds, without reading anything: for a share that is not reachable now (null when
    /// it is not cached).</summary>
    public ShellListing.Result? Cached(string location, bool foldersOnly, bool tree)
    {
        Folder? f;
        List<Item> items;
        lock (gate)
        {
            if (!folders.TryGetValue(Key(location), out f) || !f.Complete) return null;
            items = f.Items.Values.Where(i => !foldersOnly || i.Folder).ToList();
        }
        // Only what was worked out before: nothing here may touch the share.
        var entries = new JsonArray();
        foreach (var item in items.Where(i => i.Entry is not null))
        {
            var entry = (JsonObject)item.Entry!.DeepClone();
            if (item.Folder && (foldersOnly || tree) && item.Subs is not null) entry["subs"] = item.Subs.DeepClone();
            if (item.Folder && tree && !foldersOnly && item.FilesKnown) entry["files"] = item.Files?.DeepClone();
            entries.Add(entry);
        }
        return new ShellListing.Result(entries, null, false, 0, "disk", 0, false, f.Target);
    }

    // An item's entry for a request: worked out once (icon, own columns), then copied for each request (a JSON node has
    // one parent); a tree's extras worked out when first asked.
    JsonObject EntryOf(Folder f, Item item, bool foldersOnly, bool tree, Stopwatch? icons)
    {
        if (item.Entry is null)
        {
            item.Entry = ShellListing.DiskEntry(item.Info, icons);
            lock (gate) f.Entries++;
        }
        var entry = (JsonObject)item.Entry.DeepClone();
        if (item.Folder && (foldersOnly || tree))
        {
            var files = tree && !foldersOnly;
            if (item.Subs is null || files && !item.FilesKnown) Extras(item, files);
            entry["subs"] = item.Subs?.DeepClone();
            if (files) entry["files"] = item.Files?.DeepClone();
        }
        return entry;
    }

    static void Extras(Item item, bool files)
    {
        var (subs, has) = ShellListing.Contents(item.Info.FullName, files);
        item.Subs = subs;
        if (!files) return;
        item.Files = has;
        item.FilesKnown = true;
    }

    // The bare read of a folder: from the cache, waited for when another request is reading it, or made now (watched
    // from before it is read). Null: it cannot be read (the caller lists it as before, with the error).
    (Folder? Folder, bool FromCache) Bare(string location)
    {
        var key = Key(location);
        Folder f;
        TaskCompletionSource? wait = null;
        lock (gate)
        {
            if (folders.TryGetValue(key, out var known) && known.Complete && !known.Stale) return (known, true);
            f = known ?? (folders[key] = new Folder(location) { Network = NetworkGuard.IsNetwork(location) });
            if (f.Reading is not null) wait = f.Reading;
            else f.Reading = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        }
        if (wait is not null)
        {
            wait.Task.Wait();
            lock (gate) return folders.TryGetValue(key, out var done) && done.Complete ? (done, false) : (null, false);
        }
        try
        {
            f.Watcher ??= Watch(f);
            Interlocked.Increment(ref Reads);
            Dictionary<string, Item> items;
            string? target = null;
            try { items = Read(location); }
            catch (UnauthorizedAccessException) when (ShellListing.LinkTarget(location) is string to)
            {
                target = to;   // a compatibility link that denies its own listing: its target (plan 05 3.1)
                items = Read(to);
            }
            lock (gate)
            {
                f.Items = items;
                f.Target = target;
                f.Entries = 0;
                f.Complete = true;
                f.Stale = f.Watcher is null;   // not watched (Windows refused): read again whenever asked
                foreach (var (kind, path, old) in f.Pending) Apply(f, kind, path, old);
                f.Pending.Clear();
                f.LastUsed = DateTime.UtcNow;
                Trim();
            }
            return (f, false);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or System.Security.SecurityException)
        {
            lock (gate) Drop(f);
            return (null, false);
        }
        finally
        {
            TaskCompletionSource? done;
            lock (gate) { done = f.Reading; f.Reading = null; }
            done?.TrySetResult();
        }
    }

    static readonly EnumerationOptions All = new() { IgnoreInaccessible = false, AttributesToSkip = 0, RecurseSubdirectories = false };

    static Dictionary<string, Item> Read(string path)
    {
        var items = new Dictionary<string, Item>(StringComparer.OrdinalIgnoreCase);
        foreach (var info in new DirectoryInfo(path).EnumerateFileSystemInfos("*", All)) items[info.Name] = new Item(info);
        return items;
    }

    // ---------- Kept current (3.4) ----------

    FileSystemWatcher? Watch(Folder f)
    {
        try
        {
            var w = new FileSystemWatcher(f.Path)
            {
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size
                    | NotifyFilters.Attributes | NotifyFilters.CreationTime,
                InternalBufferSize = 64 * 1024,
            };
            w.Created += (_, e) => Changed(f, WatcherChangeTypes.Created, e.FullPath, null);
            w.Changed += (_, e) => Changed(f, WatcherChangeTypes.Changed, e.FullPath, null);
            w.Deleted += (_, e) => Changed(f, WatcherChangeTypes.Deleted, e.FullPath, null);
            w.Renamed += (_, e) => Changed(f, WatcherChangeTypes.Renamed, e.FullPath, e.OldFullPath);
            w.Error += (_, _) => { lock (gate) f.Stale = true; Tell(f.Path); };   // changes lost: read again
            w.EnableRaisingEvents = true;
            return w;
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException or PlatformNotSupportedException)
        {
            return null;   // not watched (some shares): it is read again when next asked
        }
    }

    void Changed(Folder f, WatcherChangeTypes kind, string path, string? old)
    {
        lock (gate)
        {
            if (!f.Complete) f.Pending.Add((kind, path, old));   // reported during the read: put in after it
            else Apply(f, kind, path, old);
        }
        Tell(f.Path);
    }

    // One change into a folder's items (under the gate). A folder made or gone in it changes what its own folder's tree
    // row shows (whether it has folders): that is worked out again.
    void Apply(Folder f, WatcherChangeTypes kind, string path, string? old)
    {
        if (f.Watcher is null) return;
        var name = Path.GetFileName(path);
        if (old is not null) f.Items.Remove(Path.GetFileName(old));
        if (kind == WatcherChangeTypes.Deleted) f.Items.Remove(name);
        else
        {
            try
            {
                FileSystemInfo info = Directory.Exists(path) ? new DirectoryInfo(path) : new FileInfo(path);
                if (info.Exists) f.Items[name] = new Item(info);
                else f.Items.Remove(name);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { f.Items.Remove(name); }
        }
        if (kind != WatcherChangeTypes.Changed && Path.GetDirectoryName(f.Path.TrimEnd('\\')) is { } parent
            && folders.TryGetValue(Key(parent), out var up) && up.Items.TryGetValue(Path.GetFileName(f.Path.TrimEnd('\\')), out var me))
        {
            me.Subs = null;
            me.FilesKnown = false;
        }
    }

    // A share's folder shown again from the cache (3.7): its bare read made again; the items that changed put in, and
    // the windows told when any did.
    void Check(string location)
    {
        if (!NetworkGuard.Reachable(location).GetAwaiter().GetResult()) return;
        Dictionary<string, Item> fresh;
        try { fresh = Read(location); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return; }
        var differs = false;
        lock (gate)
        {
            if (!folders.TryGetValue(Key(location), out var f) || !f.Complete) return;
            foreach (var (name, item) in fresh)
                if (!f.Items.TryGetValue(name, out var had) || had.Info.LastWriteTimeUtc != item.Info.LastWriteTimeUtc
                    || had.Info.Attributes != item.Info.Attributes || had.Info is FileInfo a && item.Info is FileInfo b && a.Length != b.Length)
                {
                    f.Items[name] = item;
                    differs = true;
                }
            foreach (var name in f.Items.Keys.Where(n => !fresh.ContainsKey(n)).ToList())
            {
                f.Items.Remove(name);
                differs = true;
            }
        }
        if (differs) Tell(location);
    }

    // ---------- Memory (3.5) ----------

    // Over the budget: the folders used longest ago let go (under the gate), never one a window shows or one being read.
    void Trim()
    {
        var total = folders.Values.Sum(SizeOf);
        if (total <= BudgetBytes) return;
        foreach (var f in folders.Values.Where(f => f.Reading is null && !IsShown(Key(f.Path))).OrderBy(f => f.LastUsed).ToList())
        {
            total -= SizeOf(f);
            Drop(f);
            if (total <= BudgetBytes) return;
        }
    }

    /// <summary>The budget changed, or Windows said memory is short (`all`: every folder no window shows let go).</summary>
    public void Trim(bool all)
    {
        lock (gate)
        {
            if (!all) { Trim(); return; }
            foreach (var f in folders.Values.Where(f => f.Reading is null && !IsShown(Key(f.Path))).ToList()) Drop(f);
        }
    }

    void Drop(Folder f)
    {
        f.Watcher?.Dispose();
        f.Watcher = null;
        folders.Remove(Key(f.Path));
    }

    // ---------- Read-ahead (3.6) ----------

    /// <summary>Whether there is room for more without letting anything go.</summary>
    public bool Room(double share = 1)
    {
        lock (gate) return folders.Values.Sum(SizeOf) < BudgetBytes * share;
    }

    /// <summary>Read ahead: a folder's bare read and its folders' tree extras (whether each has folders in it), no icons.
    /// Stops between items when a window asks for something. False when it could not be read.</summary>
    public bool ReadAhead(string location, Func<bool> stop)
    {
        if (!Caches(location) || Has(location)) return Has(location);
        var (f, _) = Bare(location);
        if (f is null) return false;
        List<Item> items;
        lock (gate) items = f.Items.Values.Where(i => i.Folder && i.Subs is null).ToList();
        foreach (var item in items)
        {
            if (stop()) break;
            Extras(item, false);
        }
        return true;
    }

    /// <summary>The folders in a cached folder (for read-ahead a level deeper); empty when it is not cached.</summary>
    public List<string> FoldersIn(string location)
    {
        lock (gate)
            return folders.TryGetValue(Key(location), out var f) && f.Complete
                ? f.Items.Values.Where(i => i.Folder && (i.Info.Attributes & (FileAttributes.Hidden | FileAttributes.System)) == 0)
                    .Select(i => i.Info.FullName).ToList()
                : [];
    }

    /// <summary>For the tests: the managed memory now (after a full collection), then again after letting go of every
    /// folder no window shows; what those folders took, and how many items they had.</summary>
    public (long Before, long After, int Items) Measure()
    {
        int items;
        lock (gate) items = folders.Values.Where(f => !IsShown(Key(f.Path))).Sum(f => f.Items.Count);
        var before = GC.GetTotalMemory(true);
        Trim(true);
        return (before, GC.GetTotalMemory(true), items);
    }

    public void Dispose()
    {
        quiet.Dispose();
        lock (gate)
        {
            foreach (var f in folders.Values) f.Watcher?.Dispose();
            folders.Clear();
        }
    }
}
