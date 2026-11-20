using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// Folder sizes (docs/plans/executed/37-PLAN-folder-sizes.md): what a folder holds at any depth, worked out in the host, in the
/// background, a folder at a time (the latest asked first), at low priority. A walk reads the disk itself, not through
/// the folder cache, and keeps a record for every folder in the tree it walks (its size, its own files' size, its files
/// and folders), so a folder's subfolders have theirs at once. Kept current by a watch with its subfolders on the
/// folder the walked folder is in: a change adds the difference to the folder it is in and to every folder above it
/// with a record, so a drive that changes all the time is not walked again and again. The records count toward the
/// folder cache's budget; over it, the deepest records no window shows go first. Only while Foldex runs.
/// </summary>
sealed class FolderSizes : IDisposable
{
    sealed class Rec
    {
        public long Size, Own;            // all its files at any depth; its own files
        public int Files, Folders, OwnFiles;
        public bool Partial;              // a record of a folder in it went (memory): a change there cannot be added up
        public DateTime Used = DateTime.UtcNow;
    }

    /// <summary>What a record takes in memory (3.5): 327 bytes measured by FolderSizesTests.WhatARecordTakes (2001
    /// records, paths of 94 characters).</summary>
    public static long RecordBytes = 327;

    readonly FolderCache cache;
    readonly Action<JsonObject> tell;
    readonly object gate = new();
    readonly Dictionary<string, Rec> recs = new(StringComparer.OrdinalIgnoreCase);
    readonly Dictionary<string, FileSystemWatcher> watches = new(StringComparer.OrdinalIgnoreCase);
    readonly LinkedList<string> queue = new();
    // The queue's folders, for finding one in it at once (a folder holding tens of thousands of folders asked
    // about: not a search through the queue per folder).
    readonly Dictionary<string, LinkedListNode<string>> queued = new(StringComparer.OrdinalIgnoreCase);
    // A folder read whole whose folders are not all counted yet (Listed): how many items it had, its folders, and how
    // many of them in a row have a record.
    readonly Dictionary<string, (int Items, List<string> Subs, int At)> waitingFolders = new(StringComparer.OrdinalIgnoreCase);
    readonly HashSet<string> walking = new(StringComparer.OrdinalIgnoreCase);
    readonly List<(WatcherChangeTypes Kind, string Path, string? Old)> pending = [];
    readonly AutoResetEvent wake = new(false);
    readonly System.Threading.Timer quiet;
    readonly Thread worker;
    int count;
    volatile bool disposed;

    /// <summary>`tell`: an event for every window ("folderSizes": the sizes now known or gone).</summary>
    public FolderSizes(FolderCache cache, Action<JsonObject> tell)
    {
        this.cache = cache;
        this.tell = tell;
        cache.ExtraBytes = () => Bytes;
        cache.ReadWhole = Listed;
        quiet = new System.Threading.Timer(_ => Process());
        worker = new Thread(Work) { IsBackground = true, Name = "folder sizes", Priority = ThreadPriority.BelowNormal };
        worker.Start();
    }

    /// <summary>The memory the records take (for the cache's budget).</summary>
    public long Bytes => Volatile.Read(ref count) * RecordBytes;

    static string Key(string path) => path.Length > 3 ? path.TrimEnd('\\') : path;
    static string? Parent(string path) => Path.GetDirectoryName(Key(path)) is { Length: > 0 } p ? Key(p) : null;
    static bool Under(string path, string top) => path.Equals(top, StringComparison.OrdinalIgnoreCase)
        || path.StartsWith(top.EndsWith('\\') ? top : top + "\\", StringComparison.OrdinalIgnoreCase);

    static JsonObject Json(Rec r) => new() { ["size"] = r.Size, ["files"] = r.Files, ["folders"] = r.Folders };

    // ---------- Asked (3.1, 3.2) ----------

    /// <summary>Folders to count, in the order given, before what was asked earlier; one with a record is told at once.
    /// `auto` (the setting): a share only when shares are cached.</summary>
    public void Count(IEnumerable<string> folders, bool auto)
    {
        var known = new JsonObject();
        var skipped = new JsonArray();
        lock (gate)
        {
            foreach (var folder in folders.Select(Key).Reverse())
            {
                if (!Path.IsPathFullyQualified(folder) || folder.StartsWith(@"\\?\")) continue;
                if (recs.TryGetValue(folder, out var r)) { known[folder] = Json(r); continue; }
                if (auto && !cache.Keeps(folder)) { skipped.Add(folder); continue; }
                if (queued.Remove(folder, out var there)) queue.Remove(there);
                queued[folder] = queue.AddFirst(folder);
            }
        }
        if (known.Count > 0 || skipped.Count > 0) tell(new JsonObject { ["sizes"] = known, ["skipped"] = skipped });
        wake.Set();
    }

    /// <summary>The records known of these folders (a list or tree shown), and which of them are waiting to be counted.</summary>
    public (JsonObject Sizes, JsonArray Counting) Known(IEnumerable<string> folders)
    {
        var sizes = new JsonObject();
        var counting = new JsonArray();
        lock (gate)
            foreach (var folder in folders.Select(Key).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (recs.TryGetValue(folder, out var r))
                {
                    r.Used = DateTime.UtcNow;
                    sizes[folder] = Json(r);
                }
                else if (queued.ContainsKey(folder) || walking.Contains(folder)) counting.Add(folder);
            }
        return (sizes, counting);
    }

    /// <summary>A folder's record as known now (the tests).</summary>
    public (long Size, int Files, int Folders)? Of(string folder)
    {
        lock (gate) return recs.TryGetValue(Key(folder), out var r) ? (r.Size, r.Files, r.Folders) : null;
    }

    /// <summary>Whether nothing waits to be counted or put in (the tests).</summary>
    public bool Idle
    {
        get { lock (gate) return queue.Count == 0 && walking.Count == 0 && pending.Count == 0; }
    }

    /// <summary>F5 (3.6): the records of a folder and of the folders in it let go.</summary>
    public void Forget(string location)
    {
        var top = Key(location);
        lock (gate)
        {
            foreach (var k in recs.Keys.Where(k => Under(k, top)).ToList()) recs.Remove(k);
            if (Parent(top) is { } up && recs.TryGetValue(up, out var p)) p.Partial = true;
            Unwatch();
            count = recs.Count;
        }
        tell(new JsonObject { ["gone"] = new JsonArray(top) });
    }

    // ---------- Counting (3.3) ----------

    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentThread();
    [DllImport("kernel32.dll")] static extern bool SetThreadPriority(IntPtr thread, int priority);
    const int BackgroundBegin = 0x00010000;   // THREAD_MODE_BACKGROUND_BEGIN: its disk reads at low priority too

    void Work()
    {
        SetThreadPriority(GetCurrentThread(), BackgroundBegin);
        while (!disposed)
        {
            string? next = null;
            lock (gate)
                if (queue.First is { } first)
                {
                    next = first.Value;
                    queue.RemoveFirst();
                    queued.Remove(next);
                    walking.Add(next);
                }
            if (next is null) { wake.WaitOne(1000); continue; }
            // A pane's read or a filter goes first (the lowest of the host's background work).
            while (cache.Busy && !disposed) Thread.Sleep(100);
            try { CountOne(next); }
            finally { lock (gate) walking.Remove(next); }
            quiet.Change(0, Timeout.Infinite);   // changes that came while it was walked put in now
        }
    }

    void CountOne(string folder)
    {
        lock (gate)
            if (recs.TryGetValue(folder, out var had))
            {
                tell(new JsonObject { ["sizes"] = new JsonObject { [folder] = Json(had) } });
                return;
            }
        if (!NetworkGuard.Reachable(folder).GetAwaiter().GetResult() || !Directory.Exists(folder))
        {
            tell(new JsonObject { ["skipped"] = new JsonArray(folder) });
            return;
        }
        var watched = Watch(Parent(folder) ?? folder);
        var found = new Dictionary<string, Rec>(StringComparer.OrdinalIgnoreCase);
        var rec = Walk(folder, found, true, 0);
        if (rec is null || !watched)
        {
            // Not kept current without a watch: told, not kept.
            tell(rec is null ? new JsonObject { ["skipped"] = new JsonArray(folder) } : new JsonObject { ["sizes"] = new JsonObject { [folder] = Json(rec) } });
            lock (gate) Unwatch();
            return;
        }
        lock (gate)
        {
            foreach (var (k, r) in found) recs[k] = r;
            count = recs.Count;
        }
        tell(new JsonObject { ["sizes"] = new JsonObject { [folder] = Json(rec) } });
        Trim();
        if (Parent(folder) is { } up && cache.ItemsOf(up) is { } above) Listed(up, above);
    }

    /// <summary>A folder the cache listed whole (a pane opened it): its size known from what it holds, without a walk,
    /// when every folder in it has a record (none in it: its files are all). Kept current as a counted one. Then the
    /// folder above it the same way when the cache holds that one whole, and so on up.</summary>
    public void Listed(string location, IReadOnlyList<FileSystemInfo> items)
    {
        var folder = Key(location);
        if (disposed || !Path.IsPathFullyQualified(folder) || folder.StartsWith(@"\\?\")) return;
        // Asked again after each of its folders is counted: its folders and how far the check came are kept, so a folder
        // of tens of thousands of folders is not gone through again for each (records only come meanwhile; the full check
        // below, before it is added up, is made once).
        List<string>? subs = null;
        var at = 0;
        lock (gate)
        {
            if (recs.ContainsKey(folder) || walking.Contains(folder)) return;
            if (waitingFolders.TryGetValue(folder, out var w) && w.Items == items.Count) (subs, at) = (w.Subs, w.At);
        }
        subs ??= items.OfType<DirectoryInfo>().Where(d => (d.Attributes & FileAttributes.ReparsePoint) == 0).Select(d => Key(d.FullName)).ToList();
        lock (gate)
        {
            while (at < subs.Count && recs.ContainsKey(subs[at])) at++;
            if (at < subs.Count)
            {
                waitingFolders[folder] = (items.Count, subs, at);
                return;
            }
            waitingFolders.Remove(folder);
        }
        if (!Watch(Parent(folder) ?? folder)) return;
        var files = items.OfType<FileInfo>().ToList();
        long own;
        try { own = files.Sum(i => i.Length); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return; }
        Rec rec;
        lock (gate)
        {
            if (recs.ContainsKey(folder)) return;
            // A record gone meanwhile (F5, a change): checked from the start the next time.
            if (subs.Any(s => !recs.ContainsKey(s))) { waitingFolders[folder] = (items.Count, subs, 0); return; }
            rec = new Rec { Own = own, OwnFiles = files.Count, Size = own, Files = files.Count, Folders = subs.Count };
            foreach (var s in subs.Select(s => recs[s]))
            {
                rec.Size += s.Size;
                rec.Files += s.Files;
                rec.Folders += s.Folders;
            }
            recs[folder] = rec;
            count = recs.Count;
            if (queued.Remove(folder, out var waiting)) queue.Remove(waiting);
        }
        tell(new JsonObject { ["sizes"] = new JsonObject { [folder] = Json(rec) } });
        Trim();
        if (Parent(folder) is { } up && cache.ItemsOf(up) is { } above) Listed(up, above);
    }

    const int Deepest = 256;   // folders deep a walk goes
    static readonly EnumerationOptions Shallow = new() { IgnoreInaccessible = true, AttributesToSkip = 0, RecurseSubdirectories = false };

    // A folder's own files and its folders (links and junctions not followed: a loop, or a size counted twice).
    static (long Own, int Files, List<string> Subs)? Read(string folder)
    {
        try
        {
            long own = 0;
            var files = 0;
            var subs = new List<string>();
            foreach (var info in new DirectoryInfo(folder).EnumerateFileSystemInfos("*", Shallow))
                if (info is DirectoryInfo d) { if ((d.Attributes & FileAttributes.ReparsePoint) == 0) subs.Add(d.FullName); }
                else
                {
                    own += ((FileInfo)info).Length;
                    files++;
                }
            return (own, files, subs);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { return null; }
    }

    // A folder's record, its tree's records into `found`; `reuse`: a folder in it with a record (kept current) taken as
    // it is. Null when the folder cannot be read; a folder in it that cannot be read counts as empty.
    Rec? Walk(string folder, Dictionary<string, Rec> found, bool reuse, int depth)
    {
        if (disposed) return null;
        if (reuse && depth > 0) lock (gate) if (recs.TryGetValue(folder, out var known)) return known;
        var read = Read(folder);
        if (read is null) return depth == 0 ? null : found[Key(folder)] = new Rec();
        var (own, files, subs) = read.Value;
        var rec = new Rec { Own = own, OwnFiles = files, Size = own, Files = files, Folders = subs.Count };
        if (depth < Deepest)
            foreach (var sub in subs)
                if (Walk(sub, found, reuse, depth + 1) is { } s)
                {
                    rec.Size += s.Size;
                    rec.Files += s.Files;
                    rec.Folders += s.Folders;
                }
        return found[Key(folder)] = rec;
    }

    // ---------- Changes (3.6) ----------

    // A watch with its subfolders on the folder a counted folder is in, unless one above it watches it already; the
    // ones under it then go (this one sees what they did).
    bool Watch(string folder)
    {
        lock (gate)
            if (watches.Keys.Any(w => Under(folder, w))) return true;
        FileSystemWatcher w;
        try
        {
            w = new FileSystemWatcher(folder)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.Size,
                InternalBufferSize = 64 * 1024,
            };
            w.Created += (_, e) => Changed(WatcherChangeTypes.Created, e.FullPath, null);
            w.Changed += (_, e) => Changed(WatcherChangeTypes.Changed, e.FullPath, null);
            w.Deleted += (_, e) => Changed(WatcherChangeTypes.Deleted, e.FullPath, null);
            w.Renamed += (_, e) => Changed(WatcherChangeTypes.Renamed, e.FullPath, e.OldFullPath);
            w.Error += (_, _) => Lost(folder, w);
            w.EnableRaisingEvents = true;
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException or PlatformNotSupportedException)
        {
            return false;
        }
        lock (gate)
        {
            foreach (var inner in watches.Where(p => Under(p.Key, folder)).ToList())
            {
                inner.Value.Dispose();
                watches.Remove(inner.Key);
            }
            watches[folder] = w;
        }
        return true;
    }

    // Changes lost (the watch's buffer ran over) or the watch broke: the folders counted under it counted again.
    void Lost(string folder, FileSystemWatcher w)
    {
        List<string> again;
        lock (gate)
        {
            if (!watches.TryGetValue(folder, out var now) || now != w) return;
            watches.Remove(folder);
            var under = recs.Keys.Where(k => Under(k, folder)).ToList();
            // The ones at the top of what was counted (their folder has no record): those were asked for.
            again = under.Where(k => Parent(k) is not { } p || !recs.ContainsKey(p) || !Under(p, folder)).ToList();
            foreach (var k in under) recs.Remove(k);
            count = recs.Count;
            pending.RemoveAll(c => Under(c.Path, folder));
        }
        ThreadPool.QueueUserWorkItem(_ => w.Dispose());   // not from its own event
        tell(new JsonObject { ["gone"] = new JsonArray(folder) });
        Count(again, false);
    }

    const int QuietMs = 300;

    void Changed(WatcherChangeTypes kind, string path, string? old)
    {
        lock (gate) pending.Add((kind, path, old));
        quiet.Change(QuietMs, Timeout.Infinite);
    }

    // The changes since the last time, put in: those under a folder being walked wait for its walk (it may or may not
    // have seen them; each is put in so that seeing it twice does no harm).
    void Process()
    {
        List<(WatcherChangeTypes Kind, string Path, string? Old)> now;
        lock (gate)
        {
            now = pending.Where(c => !walking.Any(w => Under(c.Path, w) || c.Old is { } o && Under(o, w))).ToList();
            pending.RemoveAll(now.Contains);
        }
        if (now.Count == 0) return;
        var told = new JsonObject();
        var gone = new JsonArray();
        var own = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (kind, path, old) in now)
        {
            if (old is not null) Gone(old, own, told, gone);
            if (kind == WatcherChangeTypes.Deleted) Gone(path, own, told, gone);
            else if (kind != WatcherChangeTypes.Changed && Directory.Exists(path)) Made(path, told);
            else if (!Directory.Exists(path) && Parent(path) is { } p) own.Add(p);   // a file: its folder's own files
        }
        foreach (var folder in own) OwnAgain(folder, told);
        if (told.Count > 0 || gone.Count > 0) tell(new JsonObject { ["sizes"] = told, ["gone"] = gone });
    }

    // Something gone: a folder with a record taken off the folders above it; anything else is a file (its folder's own
    // files read again), unless it may have been a folder whose record went (memory).
    void Gone(string path, HashSet<string> own, JsonObject told, JsonArray gone)
    {
        var key = Key(path);
        lock (gate)
        {
            if (recs.TryGetValue(key, out var r))
            {
                foreach (var k in recs.Keys.Where(k => Under(k, key)).ToList()) recs.Remove(k);
                count = recs.Count;
                gone.Add(key);
                AddUp(Parent(key), -r.Size, -r.Files, -(r.Folders + 1), told);
                return;
            }
            if (Parent(key) is { } p && recs.TryGetValue(p, out var up) && up.Partial)
            {
                LetGoFrom(p, told);
                return;
            }
        }
        if (Parent(key) is { } folder) own.Add(folder);
    }

    // A folder made, moved in or renamed to: counted (seen before: what changed), added up.
    void Made(string path, JsonObject told)
    {
        var key = Key(path);
        var parent = Parent(key);
        lock (gate)
            if (parent is null || !recs.ContainsKey(parent))
            {
                if (parent is not null) LetGoFrom(parent, told);
                return;
            }
        var found = new Dictionary<string, Rec>(StringComparer.OrdinalIgnoreCase);
        if (Walk(key, found, false, 0) is not { } rec) return;
        lock (gate)
        {
            var had = recs.GetValueOrDefault(key);
            foreach (var k in recs.Keys.Where(k => Under(k, key)).ToList()) recs.Remove(k);
            foreach (var (k, r) in found) recs[k] = r;
            count = recs.Count;
            told[key] = Json(rec);
            AddUp(parent, rec.Size - (had?.Size ?? 0), rec.Files - (had?.Files ?? 0), rec.Folders - (had?.Folders ?? -1), told);
        }
    }

    // A folder's own files read again; the difference added to it and above it.
    void OwnAgain(string folder, JsonObject told)
    {
        if (!Directory.Exists(folder)) return;   // gone itself: its own change takes it off (Gone)
        lock (gate)
            if (!recs.ContainsKey(folder))
            {
                LetGoFrom(folder, told);
                return;
            }
        var read = Read(folder);
        lock (gate)
        {
            if (!recs.TryGetValue(folder, out var r)) return;
            if (read is null)
            {
                LetGoFrom(folder, told);
                return;
            }
            var (own, files, _) = read.Value;
            long dSize = own - r.Own;
            int dFiles = files - r.OwnFiles;
            r.Own = own;
            r.OwnFiles = files;
            if (dSize != 0 || dFiles != 0) AddUp(folder, dSize, dFiles, 0, told);
        }
    }

    // The difference added to a folder and every folder above it with a record (under the gate); none for the first:
    // the folders above let go (what they hold is not known any more).
    void AddUp(string? folder, long dSize, int dFiles, int dFolders, JsonObject told)
    {
        if (folder is null) return;
        if (!recs.ContainsKey(folder)) { LetGoFrom(folder, told); return; }
        for (var at = folder; at is not null && recs.TryGetValue(at, out var r); at = Parent(at))
        {
            r.Size += dSize;
            r.Files += dFiles;
            r.Folders += dFolders;
            told[at] = Json(r);
        }
    }

    // A change where nothing is known (a record that went for memory): the nearest folder above with a record and every
    // one above it let go (under the gate); the records under them stay (still right).
    void LetGoFrom(string folder, JsonObject told)
    {
        var at = folder;
        while (at is not null && !recs.ContainsKey(at)) at = Parent(at);
        if (at is null) return;
        for (; at is not null && recs.Remove(at); at = Parent(at)) told[at] = null;
        count = recs.Count;
        Unwatch();
    }

    // Watches with no record under them any more go (under the gate).
    void Unwatch()
    {
        foreach (var (folder, w) in watches.Where(p => !recs.Keys.Any(k => Under(k, p.Key))).ToList())
        {
            w.Dispose();
            watches.Remove(folder);
        }
    }

    // ---------- Memory (3.5) ----------

    /// <summary>Over the cache's budget once the cache let go of what it could: the records no window shows go, the
    /// deepest and the ones used longest ago first; only a record with none under it, so what is above stays right.</summary>
    public void Trim()
    {
        if (cache.Room()) return;
        cache.Trim(false);   // the cache's folders first: one is read again sooner than a tree is walked again
        var room = cache.BudgetBytes - cache.Info().Bytes;
        var shown = cache.ShownLocations();
        var gone = new JsonArray();
        lock (gate)
        {
            while (recs.Count * RecordBytes > room)
            {
                var parents = recs.Keys.Select(Parent).OfType<string>().ToHashSet(StringComparer.OrdinalIgnoreCase);
                var leaves = recs.Where(p => !parents.Contains(p.Key) && !(Parent(p.Key) is { } up && shown.Contains(up)))
                    .OrderByDescending(p => p.Key.Count(c => c == '\\')).ThenBy(p => p.Value.Used).Select(p => p.Key).ToList();
                if (leaves.Count == 0) break;
                foreach (var k in leaves)
                {
                    recs.Remove(k);
                    gone.Add(k);
                    if (Parent(k) is { } p && recs.TryGetValue(p, out var up)) up.Partial = true;
                    if (recs.Count * RecordBytes <= room) break;
                }
            }
            count = recs.Count;
            Unwatch();
        }
        if (gone.Count > 0) tell(new JsonObject { ["gone"] = gone });
    }

    public void Dispose()
    {
        disposed = true;
        wake.Set();
        quiet.Dispose();
        lock (gate)
        {
            foreach (var w in watches.Values) w.Dispose();
            watches.Clear();
            recs.Clear();
        }
    }
}
