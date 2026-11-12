using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// Which folders you open, how often and how lately (docs/plans/24-PLAN-folder-cache.md 3.6): one score per folder, each
/// opening adding one and old use fading (half of it gone after HalfLifeDays). Kept in State\folderuse.json for all
/// projects and windows; the folders scoring lowest drop out beyond MaxFolders. Read-ahead reads the best first.
/// </summary>
sealed class FolderUse
{
    public const string Name = "folderuse.json";
    public const double HalfLifeDays = 14;
    public const int MaxFolders = 500;

    readonly string path;
    readonly Dictionary<string, (double Score, DateTime Last)> folders = new(StringComparer.OrdinalIgnoreCase);
    readonly object gate = new();
    bool dirty;

    public FolderUse(string path)
    {
        this.path = path;
        try
        {
            if (JsonNode.Parse(File.ReadAllText(path)) is JsonObject root)
                foreach (var (folder, v) in root)
                    if (v?["score"]?.GetValue<double>() is double s && v["last"]?.GetValue<DateTime>() is DateTime last) folders[folder] = (s, last);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException or FormatException) { }
    }

    static double Faded(double score, DateTime last, DateTime now) => score * Math.Pow(0.5, (now - last).TotalDays / HalfLifeDays);

    /// <summary>A folder opened.</summary>
    public void Opened(string folder)
    {
        var now = DateTime.UtcNow;
        lock (gate)
        {
            folders[folder] = (folders.TryGetValue(folder, out var had) ? Faded(had.Score, had.Last, now) + 1 : 1, now);
            if (folders.Count > MaxFolders)
                foreach (var gone in folders.OrderBy(f => Faded(f.Value.Score, f.Value.Last, now)).Take(folders.Count - MaxFolders).Select(f => f.Key).ToList())
                    folders.Remove(gone);
            dirty = true;
        }
    }

    /// <summary>The folders, best first.</summary>
    public List<string> Best()
    {
        var now = DateTime.UtcNow;
        lock (gate) return folders.OrderByDescending(f => Faded(f.Value.Score, f.Value.Last, now)).Select(f => f.Key).ToList();
    }

    /// <summary>Written when changed (through a temporary file).</summary>
    public void Save()
    {
        JsonObject root;
        lock (gate)
        {
            if (!dirty) return;
            dirty = false;
            root = new JsonObject(folders.Select(f => KeyValuePair.Create(f.Key,
                (JsonNode?)new JsonObject { ["score"] = Math.Round(f.Value.Score, 4), ["last"] = f.Value.Last })));
        }
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path + ".tmp", root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            File.Move(path + ".tmp", path, true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}

/// <summary>
/// Read-ahead (plan 24 3.6): on a thread of its own at the lowest priority, one folder at a time while no window is
/// asking for anything: first the folders used most, then, with memory to spare (less than half the budget used), the
/// folders in those, a level deeper each round. Only local drives, and shares when they are cached and answer. It only
/// fills free room; it stops between items as soon as a window asks for a folder.
/// </summary>
sealed class ReadAhead : IDisposable
{
    readonly FolderCache cache;
    readonly FolderUse use;
    readonly Thread thread;
    volatile bool stopping;

    public ReadAhead(FolderCache cache, FolderUse use)
    {
        this.cache = cache;
        this.use = use;
        thread = new Thread(Run) { IsBackground = true, Priority = ThreadPriority.Lowest, Name = "readAhead" };
        thread.SetApartmentState(ApartmentState.STA);
    }

    /// <summary>Started once the windows have shown their folders.</summary>
    public void Start() => thread.Start();

    /// <summary>Folders read ahead so far (for the tests and the settings window).</summary>
    public int Done;

    void Run()
    {
        var tried = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (!stopping)
        {
            Thread.Sleep(1000);
            if (cache.Busy || !cache.Room()) continue;
            var next = Next(tried);
            if (next is null) { tried.Clear(); Thread.Sleep(30_000); continue; }   // all done: look again later
            tried.Add(next);
            if (NetworkGuard.IsNetwork(next) && !NetworkGuard.Reachable(next).GetAwaiter().GetResult()) continue;
            if (!Directory.Exists(next)) continue;
            if (cache.ReadAhead(next, () => stopping || cache.Busy)) Done++;
        }
    }

    // The next folder: the best used not cached yet; with memory to spare, the folders in them, level by level.
    string? Next(HashSet<string> tried)
    {
        var best = use.Best().Where(Allowed).ToList();
        var first = best.FirstOrDefault(f => !tried.Contains(f) && !cache.Has(f));
        if (first is not null) return first;
        if (!cache.Room(0.5)) return null;
        var level = best;
        for (var depth = 0; depth < 4 && level.Count > 0; depth++)
        {
            var deeper = level.SelectMany(cache.FoldersIn).ToList();
            var found = deeper.FirstOrDefault(f => !tried.Contains(f) && !cache.Has(f));
            if (found is not null) return found;
            level = deeper;
        }
        return null;
    }

    bool Allowed(string folder) => cache.Caches(folder) && (!NetworkGuard.IsNetwork(folder) || NetworkGuard.DownSince(folder) is null);

    public void Dispose() => stopping = true;
}
