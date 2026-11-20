using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// A pane's filter worked out by the host (docs/plans/executed/36-PLAN-filter-results-in-cache.md 3.4, 3.5, 3.7): per folder and
/// filter key a job tests in the background what the cache has no result for yet, and keeps what it found on the
/// cache's items; a request gets what is known so far and asks again until the job is done. A job goes on when no
/// pane asks any more (the pane went elsewhere), so the folder is filtered when it is shown again. A filter relative
/// by the clock has no key: its job keeps its results itself, for that request only. For a tree a job finds, per
/// folder in a folder, whether something in it or under it passes (`holds`), as deep as needed.
/// </summary>
sealed class FilterJobs
{
    readonly FolderCache cache;

    /// <summary>Folders whose filter answers went (a change in them or under them): the windows ask again (plan 36).</summary>
    public Action<IReadOnlyList<string>>? Stale;

    public FilterJobs(FolderCache cache)
    {
        this.cache = cache;
        // A folder changed: its items' jobs, and the jobs of a tree's look in it and above it, found what is not so
        // any more; a pane asking again gets new ones.
        cache.FilterGone = chain =>
        {
            lock (jobs)
                foreach (var id in jobs.Keys.ToList())
                {
                    var parts = id.Split('|');
                    if (parts[0] == "items" ? Same(parts[1], chain[0]) : chain.Any(c => Same(parts[1], c))) jobs.Remove(id);
                }
            Stale?.Invoke(chain);
        };
    }

    static bool Same(string a, string b) => string.Equals(a.TrimEnd('\\'), b.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);

    /// <summary>What to test with: `Key` (null: keep nothing: relative by the clock), `Filter` (the filter's id),
    /// `Run` (the asking pane's request, for a job without a key), the set, the kind of each field it reads, the
    /// Windows properties and whether the Git status it needs, now (ms since 1970), and how much of the job's answer the
    /// asker has (`From`); a Contents line reads files up to `StartBytes` (plan 20 3.2; 0: whole).</summary>
    public sealed record Request(string Location, string? Key, string Filter, string Run, JsonNode Set, JsonObject Kinds,
        IReadOnlyList<string> Props, bool Git, long Now, int From = 0, long StartBytes = 0);

    sealed class Job
    {
        // What it found, in the order found: an answer sends what came after the asker's last one (`From`).
        public readonly List<(string Name, bool Pass)> Found = [];
        public bool Done;
        public TaskCompletionSource Progress = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public DateTime Used = DateTime.UtcNow;

        public void Tell()
        {
            var was = Progress;
            Progress = new(TaskCreationOptions.RunContinuationsAsynchronously);
            was.TrySetResult();
        }
    }

    readonly Dictionary<string, Job> jobs = new(StringComparer.OrdinalIgnoreCase);
    // Jobs at a time, beside the panes' own reads (chosen, not measured): a folder's items, and apart from them a tree's
    // look under its folders, where the deepest folder waiting goes first (one opened later need not wait for a drive).
    readonly SemaphoreSlim running = new(2);
    readonly Turns looking = new(2);

    sealed class Turns(int count)
    {
        readonly List<(int Depth, TaskCompletionSource Go)> waiting = [];
        int free = count;

        public Task Take(int depth)
        {
            lock (waiting)
            {
                if (free > 0) { free--; return Task.CompletedTask; }
                var go = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                waiting.Add((depth, go));
                return go.Task;
            }
        }

        // Between folders of a long look: the turn handed over when a deeper folder waits, then taken again.
        public async Task Yield(int depth)
        {
            lock (waiting) if (!waiting.Any(w => w.Depth > depth)) return;
            Give();
            await Take(depth);
        }

        public void Give()
        {
            TaskCompletionSource? next = null;
            lock (waiting)
            {
                if (waiting.Count == 0) free++;
                else
                {
                    var at = waiting.IndexOf(waiting.MaxBy(w => w.Depth));
                    next = waiting[at].Go;
                    waiting.RemoveAt(at);
                }
            }
            next?.TrySetResult();
        }
    }
    readonly Dictionary<string, (Request Request, DateTime Used)> inUse = new(StringComparer.Ordinal);

    /// <summary>The items' results found after the request's `From` (by name), waiting at most `wait` when there are
    /// none yet; Done when all are tested; Next: the `From` of the next request.</summary>
    public async Task<(JsonObject Results, bool Done, int Next)> Results(Request r, TimeSpan wait) =>
        await Answer(Start("items", r, job => TestFolder(r, job)), r.From, wait);

    /// <summary>For each folder in the request's folder, whether something in it or under it passes, as far as known
    /// (after `From`, as Results).</summary>
    public async Task<(JsonObject Results, bool Done, int Next)> Holds(Request r, TimeSpan wait) =>
        await Answer(Start("holds", r, job => HoldsIn(r, job)), r.From, wait);

    async Task<(JsonObject, bool, int)> Answer(Job job, int from, TimeSpan wait)
    {
        Task progress;
        bool waitFor;
        lock (jobs)
        {
            progress = job.Progress.Task;
            waitFor = !job.Done && job.Found.Count <= from;
        }
        if (waitFor) await Task.WhenAny(progress, Task.Delay(wait));
        lock (jobs)
        {
            job.Used = DateTime.UtcNow;
            var news = new JsonObject();
            for (var k = Math.Min(from, job.Found.Count); k < job.Found.Count; k++) news[job.Found[k].Name] = job.Found[k].Pass;
            return (news, job.Done, job.Found.Count);
        }
    }

    Job Start(string what, Request r, Func<Job, Task> work)
    {
        var id = $"{what}|{r.Location}|{r.Key ?? r.Filter + "#" + r.Run}";
        lock (jobs)
        {
            if (r.Key is not null) inUse[r.Key] = (r, DateTime.UtcNow);
            foreach (var old in jobs.Where(j => j.Value.Done && DateTime.UtcNow - j.Value.Used > TimeSpan.FromMinutes(2)).Select(j => j.Key).ToList())
                jobs.Remove(old);
            if (jobs.TryGetValue(id, out var known)) return known;
            var job = jobs[id] = new Job();
            _ = Task.Run(async () =>
            {
                try { await work(job); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException or Jint.Runtime.JavaScriptException) { }
                finally
                {
                    lock (jobs) job.Done = true;
                    job.Tell();
                }
            });
            return job;
        }
    }

    // Every item of the folder: what the cache knows, the rest tested in batches, each batch told as it is done.
    async Task TestFolder(Request r, Job job)
    {
        await running.WaitAsync();
        try
        {
            var tested = await Test(r, r.Location, batch =>
            {
                lock (jobs) job.Found.AddRange(batch);
                job.Tell();
            });
            if (tested is null) lock (jobs) job.Found.Clear();   // it cannot be read: nothing
        }
        finally { running.Release(); }
    }

    /// <summary>A folder's items tested with the request's set (the kept results used, the new ones kept when it has a
    /// key); `told` gets each batch. Null when the folder cannot be read.</summary>
    async Task<Dictionary<string, bool>?> Test(Request r, string location, Action<List<(string, bool)>>? told = null)
    {
        var items = cache.ForFilter(location, r.Key);
        if (items is null) return null;
        var all = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        var known = items.Where(i => i.Result is not null).Select(i => (i.Name, i.Result!.Value)).ToList();
        foreach (var (name, pass) in known) all[name] = pass;
        if (known.Count > 0) told?.Invoke(known);
        var needs = new FilterEngine.Needs(r.Props, r.Git, FilterEngine.Contents(r.Set), r.StartBytes);
        foreach (var chunk in items.Where(i => i.Result is null).Chunk(64))
        {
            var entries = chunk.Select(i => (JsonObject)i.Entry.DeepClone()).ToList();
            await FilterEngine.Fill(entries, [.. chunk.Select(i => Path.Combine(location, i.Name))], location, needs,
                (files, names) => StaWorker.Once("props", () => ShellProps.Values(files, names)));
            var results = FilterEngine.Test(r.Set, r.Kinds, r.Now, entries);
            // A value still not there (none should be): shown, as the page shows an item no property can be read of.
            var batch = chunk.Select((i, k) => (i.Name, results[k] ?? true)).ToList();
            foreach (var (name, pass) in batch) all[name] = pass;
            if (r.Key is not null) cache.Store(location, r.Key, r.Filter, batch);
            told?.Invoke(batch);
        }
        return all;
    }

    // For a tree: per folder in the request's folder, whether it holds a pass; each told as it is known.
    async Task HoldsIn(Request r, Job job)
    {
        var items = cache.ForFilter(r.Location, null);
        if (items is null) return;
        // A folder at a time, each in its turn among the jobs: a folder opened later (deeper) need not wait for the
        // whole of a folder above it (a drive) to be looked through.
        var depth = r.Location.TrimEnd('\\').Count(c => c == '\\');
        foreach (var sub in items.Where(i => i.Folder))
        {
            await looking.Take(depth);
            bool holds;
            try { holds = await HoldsUnder(r, Path.Combine(r.Location, sub.Name), 0, depth); }
            finally { looking.Give(); }
            lock (jobs) job.Found.Add((sub.Name, holds));
            job.Tell();
        }
    }

    const int Deepest = 64;   // folders deep a tree's question goes (a loop of links ends there)

    /// <summary>Whether something in `folder`, or in a folder under it, passes (kept with the key; not with none).</summary>
    // `turn`: the depth of the folder the tree asked for, its place among the turns.
    async Task<bool> HoldsUnder(Request r, string folder, int depth, int turn)
    {
        if (r.Key is not null && cache.Holds(folder, r.Key) is bool known) return known;
        // Nothing under it can pass, by its path alone (a Full path line): not looked through.
        if (!FilterEngine.CanHold(r.Set, folder)) return false;
        await looking.Yield(turn);
        var results = await Test(r, folder);
        var holds = results is not null && results.Values.Any(p => p);
        if (!holds && results is not null && depth < Deepest)
            foreach (var sub in cache.ForFilter(folder, null)?.Where(i => i.Folder && (i.Entry["link"]?.GetValue<bool>() != true)) ?? [])
                if (await HoldsUnder(r, Path.Combine(folder, sub.Name), depth + 1, turn)) { holds = true; break; }
        if (r.Key is not null && results is not null) cache.SetHolds(folder, r.Key, holds);
        return holds;
    }

    /// <summary>A filter changed or gone: its kept results let go (plan 36 3.6), its jobs with them.</summary>
    public void Forget(string filter)
    {
        lock (jobs)
        {
            foreach (var key in inUse.Keys.Where(k => k.Split('@')[0] == filter).ToList()) inUse.Remove(key);
            foreach (var id in jobs.Keys.Where(id => id.Split('|')[2].Split('@')[0].Split('#')[0] == filter).ToList()) jobs.Remove(id);
        }
        _ = Task.Run(() => cache.Forget(filter));
    }

    /// <summary>Read ahead (plan 36 3.5): a folder just read tested with the filters panes used lately (with a key),
    /// so it shows filtered at once when opened.</summary>
    public async Task Ahead(string location, Func<bool> stop)
    {
        List<Request> use;
        lock (jobs)
        {
            foreach (var old in inUse.Where(u => DateTime.UtcNow - u.Value.Used > TimeSpan.FromMinutes(30)).Select(u => u.Key).ToList()) inUse.Remove(old);
            use = inUse.Values.Select(u => u.Request).ToList();
        }
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        foreach (var r in use)
        {
            if (stop()) return;
            if (r.Key!.Contains('@') && r.Key.Split('@')[1] != today) continue;   // relative by the date, of another day
            await Test(r with { Location = location, Now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() }, location);
        }
    }
}
