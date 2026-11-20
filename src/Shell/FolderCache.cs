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
        // Filter results (plan 36 3.2): per key (a filter's id, with the date for one relative by the date) whether it
        // passes. A change on disk makes a new Item, so they go with the old one.
        public Dictionary<string, bool>? Results;
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
        public int Results;                          // filter results kept on its items (for the memory count)
        // Per filter key: whether something in it or under it passes (plan 36 3.7, a tree); dropped when anything in it
        // changes, and up the chain.
        public Dictionary<string, bool> Holds = new(StringComparer.Ordinal);
    }

    // What a cached item takes, measured (plan 24 3.5): the bare read and the entry worked out. Used to keep the cache
    // under its budget; see the plan's As built for how they were measured.
    public static long BareBytes = 600, EntryBytes = 1400, ResultBytes = 120;

    readonly Dictionary<string, Folder> folders = new(StringComparer.OrdinalIgnoreCase);
    readonly object gate = new();
    readonly Dictionary<object, HashSet<string>> shownBy = [];
    readonly Action<string, IReadOnlyList<string>?> changed;
    int busy;
    long lastRequest;

    /// <summary>Bare reads made so far (the host's log of reads, for the tests and the settings window).</summary>
    public int Reads;

    // Reading from disk or a share now, and whether a read was made since the host last asked (TakeReading).
    int reading, readSeen;

    T ReadingDisk<T>(Func<T> read)
    {
        Interlocked.Increment(ref reading);
        Volatile.Write(ref readSeen, 1);
        try { return read(); }
        finally { Interlocked.Decrement(ref reading); }
    }

    /// <summary>Whether the cache reads from disk or a share now, or did since the last time this was asked (so a short
    /// read is seen too): the status line's disk icon (AppHost).</summary>
    public bool TakeReading() => (Interlocked.Exchange(ref readSeen, 0) == 1) | Volatile.Read(ref reading) > 0;

    /// <summary>`changed`: a folder's items changed (reported by its watch, or found by a check of a share shown
    /// again), told once the folder has been quiet for QuietMs: with the names of the items that changed, for the
    /// windows to ask for those only (Entries) and put them in where they are; without (null: changes lost, a share
    /// checked, more than MaxNames), for them to read it again whole from the cache.</summary>
    public FolderCache(Action<string, IReadOnlyList<string>?> changed)
    {
        this.changed = changed;
        quiet = new System.Threading.Timer(_ => TellChanged());
    }

    // The windows told of changes once things have been quiet for a moment (a file being written does not make its
    // folder read again and again), as FolderWatch did.
    const int QuietMs = 300;
    // More names changed at once than this: the windows read the folder again whole (cheaper than asking item by item).
    public const int MaxNames = 500;
    readonly System.Threading.Timer quiet;
    readonly Dictionary<string, HashSet<string>?> toTell = new(StringComparer.OrdinalIgnoreCase);

    // `names`: the items that changed; null: the folder as a whole.
    void Tell(string path, IEnumerable<string>? names)
    {
        lock (toTell)
        {
            if (names is null) toTell[path] = null;
            else if (!toTell.TryGetValue(path, out var had)) toTell[path] = new HashSet<string>(names, StringComparer.OrdinalIgnoreCase);
            else if (had is not null)
            {
                had.UnionWith(names);
                if (had.Count > MaxNames) toTell[path] = null;
            }
        }
        quiet.Change(QuietMs, Timeout.Infinite);
    }

    void TellChanged()
    {
        List<KeyValuePair<string, HashSet<string>?>> told;
        lock (toTell) { told = [.. toTell]; toTell.Clear(); }
        foreach (var (path, names) in told) changed(path, names?.ToList());
    }

    /// <summary>The entries of some items of a cached folder, by name, as List gives them (the extras of the request
    /// too): for the names that changed (the constructor's `changed`). An item gone (or not a folder, with foldersOnly)
    /// is left out. Null when the folder is not in the cache read whole: then it is read again whole.</summary>
    public JsonArray? Entries(string location, IReadOnlyList<string> names, bool foldersOnly, bool tree)
    {
        Folder? f;
        List<Item> items;
        lock (gate)
        {
            if (!folders.TryGetValue(Key(location), out f) || !f.Complete || f.Stale) return null;
            f.LastUsed = DateTime.UtcNow;
            items = names.Select(n => f.Items.GetValueOrDefault(n)).OfType<Item>().Where(i => !foldersOnly || i.Folder).ToList();
        }
        var entries = new JsonArray();
        foreach (var item in items) entries.Add(EntryOf(f, item, foldersOnly, tree, null));
        return entries;
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

    static long SizeOf(Folder f) => f.Items.Count * BareBytes + f.Entries * EntryBytes + f.Results * ResultBytes;

    /// <summary>Whether a path goes through the cache: a folder on disk or on a share (so a window gets the changes of
    /// either item by item).</summary>
    public bool Caches(string location) => Path.IsPathFullyQualified(location) && !location.StartsWith(@"\\?\");

    /// <summary>Whether a folder is kept once no window shows it (and may be read ahead): on disk always, on a share
    /// when shares are cached (cacheNetwork). A share's folder not kept is let go as soon as no window shows it, so it
    /// is read anew when opened again.</summary>
    public bool Keeps(string location) => CacheNetwork || !NetworkGuard.IsNetwork(location);

    /// <summary>How long a share's folder not kept stays after it was last asked for, while no window says it shows it.</summary>
    public static TimeSpan ShareGrace = TimeSpan.FromSeconds(10);

    /// <summary>Whether a folder is in the cache, read whole.</summary>
    public bool Has(string location)
    {
        lock (gate) return folders.TryGetValue(Key(location), out var f) && f.Complete && !f.Stale;
    }

    static string Key(string path) => path.Length > 3 ? path.TrimEnd('\\') : path;

    /// <summary>The folders a window shows (its lists, the folders open in its trees): never let go.</summary>
    /// <summary>F5: a folder read from disk again when next asked (its items, entries and extras anew).</summary>
    public void Invalidate(string location)
    {
        lock (gate) if (folders.TryGetValue(Key(location), out var f) && f.Complete) f.Stale = true;
    }

    public void Shown(object window, IEnumerable<string> shown)
    {
        lock (gate)
        {
            shownBy[window] = shown.Select(Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
            // A share's folder not kept: let go once no window shows it (not one just read: its window says so a moment later).
            foreach (var f in folders.Values.Where(f => f.Network && !Keeps(f.Path) && f.Reading is null && !IsShown(Key(f.Path))
                && DateTime.UtcNow - f.LastUsed > ShareGrace).ToList()) Drop(f);
        }
    }

    public void Forget(object window)
    {
        lock (gate) shownBy.Remove(window);
    }

    bool IsShown(string key) => shownBy.Values.Any(s => s.Contains(key));

    /// <summary>The folders the windows show now (plan 37 3.5: the sizes of the folders in them are not let go).</summary>
    public HashSet<string> ShownLocations()
    {
        lock (gate) return shownBy.Values.SelectMany(s => s).ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

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
            if (fromCache) _ = Task.Run(() => Check(location));   // shown from the cache: checked against the disk behind it
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

    void Extras(Item item, bool files)
    {
        var (subs, has) = ReadingDisk(() => ShellListing.Contents(item.Info.FullName, files));
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
            else
            {
                f.Reading = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                f.Complete = false;   // read again: a change reported meanwhile waits for the new read (Changed), not lost with the old
            }
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
            try { items = ReadingDisk(() => Read(location)); }
            catch (UnauthorizedAccessException) when (ShellListing.LinkTarget(location) is string to)
            {
                target = to;   // a compatibility link that denies its own listing: its target (plan 05 3.1)
                items = ReadingDisk(() => Read(to));
            }
            if (target is null && ReadWhole is { } whole)
            {
                var infos = items.Values.Select(i => i.Info).ToList();
                ThreadPool.QueueUserWorkItem(_ => whole(location, infos));
            }
            lock (gate)
            {
                f.Items = items;
                f.Target = target;
                f.Entries = 0;
                f.Results = 0;          // read anew (F5 too): its filter results go with the old items (plan 36 3.2)
                DropHolds(f.Path);
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
            // Changes lost, or the watch broke (its folder gone): read again, under a new watch (Bare).
            w.Error += (_, _) =>
            {
                lock (gate)
                {
                    f.Stale = true;
                    if (f.Watcher == w) f.Watcher = null;
                }
                ThreadPool.QueueUserWorkItem(_ => w.Dispose());   // not from its own event
                Tell(f.Path, null);
            };
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
        Tell(f.Path, old is null ? [Path.GetFileName(path)] : [Path.GetFileName(path), Path.GetFileName(old)]);
    }

    // One change into a folder's items (under the gate). A folder made or gone in it changes what its own folder's tree
    // row shows (whether it has folders): that is worked out again.
    void Apply(Folder f, WatcherChangeTypes kind, string path, string? old)
    {
        if (f.Watcher is null) return;
        DropHolds(f.Path);   // an item of it changed: whether something under it passes is not known any more (plan 36)
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
        // A folder in it gone (deleted, renamed or moved away) or made (again): its own read and the reads under it are
        // let go, as their watches went with the folder they watched (a watch on a folder deleted and made again under
        // that name tells nothing more: git does that on a checkout). Read anew when next asked; a pane showing one
        // is told to read it again.
        if (kind != WatcherChangeTypes.Changed)
        {
            DropUnder(path);
            if (old is not null) DropUnder(old);
        }
        if (kind != WatcherChangeTypes.Changed && Path.GetDirectoryName(f.Path.TrimEnd('\\')) is { } parent
            && folders.TryGetValue(Key(parent), out var up) && up.Items.TryGetValue(Path.GetFileName(f.Path.TrimEnd('\\')), out var me))
        {
            me.Subs = null;
            me.FilesKnown = false;
        }
    }

    // A folder shown from the cache (3.7; a share's, and one on disk too, should its watch have missed something): its
    // bare read made again; the items that differ looked at once more (a change its watch put in meanwhile is newer than
    // this read) and put in, and the windows told when any did.
    void Check(string location)
    {
        if (!NetworkGuard.Reachable(location).GetAwaiter().GetResult()) return;
        Dictionary<string, Item> fresh;
        try { fresh = ReadingDisk(() => Read(location)); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return; }
        List<string> differs;
        lock (gate)
        {
            if (!folders.TryGetValue(Key(location), out var f) || !f.Complete) return;
            differs = fresh.Where(p => !f.Items.TryGetValue(p.Key, out var had) || Differs(had.Info, p.Value.Info)).Select(p => p.Key)
                .Concat(f.Items.Keys.Where(n => !fresh.ContainsKey(n))).ToList();
        }
        if (differs.Count == 0) return;
        var now = differs.ToDictionary(n => n, n => Look(Path.Combine(location, n)), StringComparer.OrdinalIgnoreCase);
        List<string> told = [];
        lock (gate)
        {
            if (!folders.TryGetValue(Key(location), out var f) || !f.Complete) return;
            foreach (var (name, info) in now)
            {
                var had = f.Items.GetValueOrDefault(name);
                if (info is null) { if (f.Items.Remove(name)) told.Add(name); }
                else if (had is null || Differs(had.Info, info))
                {
                    f.Items[name] = new Item(info);
                    told.Add(name);
                }
            }
        }
        if (told.Count > 0) Tell(location, told.Count > MaxNames ? null : told);   // the items that changed, as a watch tells them
    }

    static bool Differs(FileSystemInfo had, FileSystemInfo now) => had.LastWriteTimeUtc != now.LastWriteTimeUtc
        || had.Attributes != now.Attributes || had is FileInfo a && now is FileInfo b && a.Length != b.Length;

    // An item as it is on disk now; null when it is not there.
    static FileSystemInfo? Look(string path)
    {
        try
        {
            FileSystemInfo info = Directory.Exists(path) ? new DirectoryInfo(path) : new FileInfo(path);
            return info.Exists ? info : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }

    // ---------- Memory (3.5) ----------

    /// <summary>What else counts toward the budget: the folder sizes' records (plan 37 3.5).</summary>
    public Func<long>? ExtraBytes;

    /// <summary>A folder read from disk whole, with what is in it (plan 37: its size from it, FolderSizes.Listed); told
    /// on the thread pool, not in the listing's way.</summary>
    public Action<string, IReadOnlyList<FileSystemInfo>>? ReadWhole;

    // Over the budget: the folders used longest ago let go (under the gate), never one a window shows or one being read.
    void Trim()
    {
        var total = folders.Values.Sum(SizeOf) + (ExtraBytes?.Invoke() ?? 0);
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

    // A folder's read and the reads of the folders under it let go (under the gate), each told as changed as a whole.
    void DropUnder(string path)
    {
        var key = Key(path);
        foreach (var f in folders.Values.Where(f => Key(f.Path).Equals(key, StringComparison.OrdinalIgnoreCase)
            || Key(f.Path).StartsWith(key + "\\", StringComparison.OrdinalIgnoreCase)).ToList())
        {
            if (f.Reading is not null) continue;   // being read now: that read is the new one
            Drop(f);
            Tell(f.Path, null);
        }
    }

    // ---------- Read-ahead (3.6) ----------

    /// <summary>Whether there is room for more without letting anything go.</summary>
    public bool Room(double share = 1)
    {
        lock (gate) return folders.Values.Sum(SizeOf) + (ExtraBytes?.Invoke() ?? 0) < BudgetBytes * share;
    }

    /// <summary>Read ahead: a folder's bare read and its folders' tree extras (whether each has folders in it), no icons.
    /// Stops between items when a window asks for something. False when it could not be read.</summary>
    public bool ReadAhead(string location, Func<bool> stop)
    {
        if (!Caches(location) || !Keeps(location) || Has(location)) return Has(location);
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

    // ---------- Filter results (docs/plans/executed/36-PLAN-filter-results-in-cache.md 3.2, 3.7) ----------

    /// <summary>A folder's items for a filter (read when it is not cached; null when it cannot be read): name, whether a
    /// folder, the entry to test (the listing's when worked out, else one without its icon) and the result kept for
    /// `key` (null: not tested yet, or no key).</summary>
    public List<(string Name, bool Folder, JsonObject Entry, bool? Result)>? ForFilter(string location, string? key)
    {
        if (!Caches(location)) return null;
        var (f, _) = Bare(location);
        if (f is null) return null;
        List<Item> items;
        lock (gate)
        {
            f.LastUsed = DateTime.UtcNow;
            items = [.. f.Items.Values];
        }
        var list = new List<(string, bool, JsonObject, bool?)>(items.Count);
        foreach (var item in items)
        {
            bool? result = null;
            lock (gate) if (key is not null && item.Results is { } r && r.TryGetValue(key, out var v)) result = v;
            list.Add((item.Info.Name, item.Folder, item.Entry ?? ShellListing.FilterEntry(item.Info), result));
        }
        return list;
    }

    /// <summary>Results of `key` kept on a folder's items, by name; an item since changed (another Item now) or gone
    /// is left as it is. Another key of the same filter (`filter`, its id: the date changed) is let go on them.</summary>
    public void Store(string location, string key, string filter, IEnumerable<(string Name, bool Pass)> results)
    {
        lock (gate)
        {
            if (!folders.TryGetValue(Key(location), out var f) || !f.Complete) return;
            foreach (var (name, pass) in results)
            {
                if (!f.Items.TryGetValue(name, out var item)) continue;
                item.Results ??= new(StringComparer.Ordinal);
                foreach (var old in item.Results.Keys.Where(k => k != key && KeyOf(k) == filter).ToList()) item.Results.Remove(old);
                item.Results[key] = pass;
            }
            f.Results = f.Items.Values.Sum(i => i.Results?.Count ?? 0);
        }
    }

    // A result's filter id: its key without the date ("id" or "id@2026-11-19").
    static string KeyOf(string key) => key.Split('@')[0];

    /// <summary>Whether something in a folder or under it passes for `key`, when known (plan 36 3.7).</summary>
    public bool? Holds(string location, string key)
    {
        lock (gate) return folders.TryGetValue(Key(location), out var f) && f.Complete && f.Holds.TryGetValue(key, out var h) ? h : null;
    }

    public void SetHolds(string location, string key, bool holds)
    {
        lock (gate) if (folders.TryGetValue(Key(location), out var f) && f.Complete) f.Holds[key] = holds;
    }

    /// <summary>A folder's items changed or were read again: it and the folders above it (whose "something under it
    /// passes" may change), for the filter jobs (plan 36) to let go of what they found there. Told off the cache's lock.</summary>
    public Action<IReadOnlyList<string>>? FilterGone;

    // Something changed in a folder: what is known of passes in it and above it is not known any more.
    void DropHolds(string path)
    {
        var chain = new List<string>();
        for (var at = path; !string.IsNullOrEmpty(at); at = Path.GetDirectoryName(at.TrimEnd('\\')))
        {
            if (folders.TryGetValue(Key(at), out var f)) f.Holds.Clear();
            chain.Add(Key(at));
            if (Path.GetDirectoryName(at.TrimEnd('\\')) == at) break;
        }
        if (FilterGone is { } gone) ThreadPool.QueueUserWorkItem(_ => gone(chain));
    }

    /// <summary>A filter changed or gone (plan 36 3.6): its results let go on every cached item, its marks too.</summary>
    public void Forget(string filter)
    {
        lock (gate)
            foreach (var f in folders.Values)
            {
                foreach (var item in f.Items.Values)
                    if (item.Results is { } r) foreach (var k in r.Keys.Where(k => KeyOf(k) == filter).ToList()) r.Remove(k);
                foreach (var k in f.Holds.Keys.Where(k => KeyOf(k) == filter).ToList()) f.Holds.Remove(k);
                f.Results = f.Items.Values.Sum(i => i.Results?.Count ?? 0);
            }
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

    /// <summary>For the tests: a folder's watch stopped without its read being let go, as a watch that missed changes.</summary>
    internal void Deafen(string location)
    {
        lock (gate) if (folders.TryGetValue(Key(location), out var f)) f.Watcher!.EnableRaisingEvents = false;
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
