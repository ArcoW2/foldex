using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// Network and the machines on it (no folders on disk: Windows' shell lists them, and finding what is there can take
/// half a minute). What was found is kept for all windows: a pane asking again gets it at once, and the shell lists it
/// again in the background; what is new, gone or changed is told to the windows by id, as FolderCache tells a folder's
/// changes, so the panes put it in where it belongs. Two requests at once share one listing.
/// </summary>
sealed class PlaceCache(Action<string, IReadOnlyList<string>> changed)
{
    public const string Network = "::{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}";

    sealed class Place
    {
        public readonly Dictionary<string, JsonObject> Entries = new(StringComparer.OrdinalIgnoreCase);
        public bool Complete;
        public string Kind = "shell";
        public TaskCompletionSource? Reading;
        public bool Refreshing;
        public readonly HashSet<string> Found = new(StringComparer.OrdinalIgnoreCase);   // put in by Found: kept
    }

    readonly Dictionary<string, Place> places = new(StringComparer.OrdinalIgnoreCase);
    readonly object gate = new();

    /// <summary>Network, a place in it, or a machine (\\server, no share).</summary>
    public static bool Handles(string location) => location.StartsWith(Network, StringComparison.OrdinalIgnoreCase) || IsServer(location);

    public static bool IsServer(string location) => location.StartsWith(@"\\") && !location.StartsWith(@"\\?\")
        && location.TrimEnd('\\').Length > 2 && !location[2..].TrimEnd('\\').Contains('\\');

    static string Key(string location, bool foldersOnly, bool tree) => $"{location.TrimEnd('\\')}|{foldersOnly}|{tree}";

    /// <summary>A listing as ShellListing.List gives it: what is known at once (`count` says it came from the cache) and
    /// listed again in the background, or listed now when nothing is known yet.</summary>
    public ShellListing.Result List(string location, Action<JsonArray>? batch, CancellationToken cancel, bool foldersOnly, bool tree,
        Action<int, bool>? count = null)
    {
        var key = Key(location, foldersOnly, tree);
        Place p;
        TaskCompletionSource? wait = null;
        lock (gate)
        {
            if (!places.TryGetValue(key, out p!)) places[key] = p = new Place();
            if (!p.Complete && p.Reading is not null) wait = p.Reading;
            else if (!p.Complete) p.Reading = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        }
        if (wait is not null)
        {
            try { wait.Task.Wait(cancel); } catch (OperationCanceledException) { }
            if (cancel.IsCancellationRequested) return new ShellListing.Result([], null, false, 0, "shell", Cancelled: true);
            lock (gate) if (!p.Complete) return ShellListing.List(location, batch, cancel, foldersOnly, tree);
        }
        if (p.Complete)
        {
            JsonArray known;
            lock (gate) known = [.. p.Entries.Values.Select(e => e.DeepClone())];
            count?.Invoke(known.Count, true);
            Refresh(location, p, foldersOnly, tree);
            return new ShellListing.Result(known, null, false, 0, p.Kind);
        }
        try
        {
            var r = ShellListing.List(location, part => { Store(p, part); batch?.Invoke(part); }, cancel, foldersOnly, tree);
            // A machine that shows nothing may want a log-on: then it says so (the pane offers Log on...).
            if (IsServer(location) && r.Entries.Count == 0 && !r.Cancelled && r.Error is null && NetLogon.Denied(location)) r = r with { Denied = true };
            lock (gate)
            {
                if (r.Cancelled || r.Error is not null || r.Denied) places.Remove(key);   // nothing to keep: listed whole next time
                else
                {
                    foreach (var e in r.Entries.OfType<JsonObject>()) p.Entries[e["id"]!.GetValue<string>()] = (JsonObject)e.DeepClone();
                    p.Kind = r.Kind;
                    p.Complete = true;
                }
            }
            return r;
        }
        finally
        {
            TaskCompletionSource? done;
            lock (gate) { done = p.Reading; p.Reading = null; }
            done?.TrySetResult();
        }
    }

    void Store(Place p, JsonArray part)
    {
        lock (gate)
            foreach (var e in part.OfType<JsonObject>()) p.Entries[e["id"]!.GetValue<string>()] = (JsonObject)e.DeepClone();
    }

    // Listed again in the background (one at a time per place): every entry new or different told as it comes; at the
    // end, the ones not found again taken out and told.
    void Refresh(string location, Place p, bool foldersOnly, bool tree)
    {
        lock (gate)
        {
            if (p.Refreshing) return;
            p.Refreshing = true;
        }
        _ = StaWorker.Once("placeRefresh", () =>
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            void Take(JsonArray part)
            {
                List<string> ids = [];
                lock (gate)
                    foreach (var e in part.OfType<JsonObject>())
                    {
                        var id = e["id"]!.GetValue<string>();
                        seen.Add(id);
                        if (p.Entries.TryGetValue(id, out var had) && JsonNode.DeepEquals(had, e)) continue;
                        p.Entries[id] = (JsonObject)e.DeepClone();
                        ids.Add(id);
                    }
                if (ids.Count > 0) changed(location, ids);
            }
            try
            {
                var r = ShellListing.List(location, Take, default, foldersOnly, tree);
                if (r.Error is not null || r.Denied || r.Cancelled) return false;
                Take(r.Entries);
                List<string> gone;
                lock (gate)
                {
                    gone = p.Entries.Keys.Where(id => !seen.Contains(id) && !p.Found.Contains(id)).ToList();
                    foreach (var id in gone) p.Entries.Remove(id);
                }
                if (gone.Count > 0) changed(location, gone);
                return true;
            }
            finally
            {
                lock (gate) p.Refreshing = false;
            }
        });
    }

    /// <summary>A network path that answered (a pane listed it): its machine is on Network and its share on that
    /// machine, whether discovery found them or not. Put in what is known of Network and of the machine (kept there,
    /// also when discovery does not find them again) and told, so every tree shows them. On the shell's thread.</summary>
    public void Found(string path)
    {
        if (!path.StartsWith(@"\\") || path.StartsWith(@"\\?\")) return;
        var parts = path[2..].TrimEnd('\\').Split('\\');
        if (parts[0].Length == 0) return;
        var server = @"\\" + parts[0];
        Add(Network, server);
        if (parts.Length >= 2) Add(server, $@"{server}\{parts[1]}");
    }

    // An item put in every listing of a place known (each kind of request), when it is not there yet.
    void Add(string place, string id)
    {
        List<Place> into;
        lock (gate)
            into = [.. places.Where(kv => kv.Key.StartsWith(place.TrimEnd('\\') + "|", StringComparison.OrdinalIgnoreCase) && kv.Value.Complete)
                .Select(kv => kv.Value).Where(p => !p.Entries.ContainsKey(id))];
        if (into.Count == 0) return;
        if (ShellListing.Entries([id]).OfType<JsonObject>().FirstOrDefault() is not { } entry) return;
        if (entry["folder"]?.GetValue<bool>() == true) entry["subs"] = true;   // a tree draws it with its expander
        lock (gate)
            foreach (var p in into)
            {
                p.Entries[id] = (JsonObject)entry.DeepClone();
                p.Found.Add(id);
            }
        changed(place, [id]);
    }

    /// <summary>The entries of some items of a place, by id (the ones told as changed); an item gone is left out. Null
    /// when the place is not known: then it is listed again whole.</summary>
    public JsonArray? Entries(string location, IReadOnlyList<string> ids, bool foldersOnly, bool tree)
    {
        lock (gate)
        {
            if (!places.TryGetValue(Key(location, foldersOnly, tree), out var p) || !p.Complete) return null;
            return [.. ids.Select(id => p.Entries.GetValueOrDefault(id)).OfType<JsonObject>().Select(e => e.DeepClone())];
        }
    }

    /// <summary>What is known of a place, without listing anything (a machine that does not answer); null when nothing is.</summary>
    public ShellListing.Result? Cached(string location, bool foldersOnly, bool tree)
    {
        lock (gate)
        {
            if (!places.TryGetValue(Key(location, foldersOnly, tree), out var p) || !p.Complete) return null;
            return new ShellListing.Result([.. p.Entries.Values.Select(e => e.DeepClone())], null, false, 0, p.Kind);
        }
    }
}
