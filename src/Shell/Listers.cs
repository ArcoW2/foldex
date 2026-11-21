using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// The lister plugins (docs/plans/executed/33-PLAN-preview-plugins.md 3.2) for every window: the 64-bit ones (.wlx64) in
/// plugins\wlx\ of Foldex's data folder and the ones added by path (the setting previewListers). Each one's name and
/// detect string are read once, by the plugin helper, and kept (State\listers.json) until its file changes, so offering
/// viewers for a file loads no DLL. Their views: each preview's plugin window, made by the helper as a child of the
/// preview's panel; the helper is let go IdleMs after the last view closed. On the UI thread.
/// </summary>
sealed class Listers : IDisposable
{
    public const string FolderName = @"plugins\wlx", StateName = "listers.json";
    public const int IdleMs = 60_000;

    record Entry(long Stamp, string Name, string Detect, string? Error);

    readonly string dataDir;
    readonly SynchronizationContext ui;
    readonly ListerHelper.Client client;
    readonly Dictionary<string, Entry> known = new(StringComparer.OrdinalIgnoreCase);
    readonly Dictionary<string, (Action Stopped, Action Escape)> views = [];
    readonly System.Windows.Forms.Timer idle = new() { Interval = IdleMs };

    public Listers(string dataDir)
    {
        this.dataDir = dataDir;
        ui = SynchronizationContext.Current ?? new SynchronizationContext();
        client = new ListerHelper.Client(() => ui.Post(_ => Stopped(), null), view => ui.Post(_ => { if (views.TryGetValue(view, out var v)) v.Escape(); }, null));
        idle.Tick += (_, _) => { idle.Stop(); if (views.Count == 0) client.End(); };
        try
        {
            if (JsonNode.Parse(File.ReadAllText(DataFolder.StatePath(dataDir, StateName))) is JsonObject o)
                foreach (var (path, e) in o)
                    if (e is JsonObject x)
                        known[path] = new(x["stamp"]?.GetValue<long>() ?? 0, x["name"]?.GetValue<string>() ?? "", x["detect"]?.GetValue<string>() ?? "",
                            x["error"]?.GetValue<string>());
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException) { }
    }

    public string Folder => Path.Combine(dataDir, FolderName);

    // The plugins: the folder's, then the ones added by path.
    IEnumerable<(string Path, bool InFolder)> Paths(IEnumerable<string> added)
    {
        var inFolder = new List<string>();
        try { if (Directory.Exists(Folder)) inFolder.AddRange(Directory.EnumerateFiles(Folder, "*.wlx64", SearchOption.AllDirectories)); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        var seen = new HashSet<string>(inFolder, StringComparer.OrdinalIgnoreCase);
        return inFolder.Select(p => (p, true)).Concat(added.Where(p => Path.IsPathFullyQualified(p) && seen.Add(p)).Select(p => (p, false)));
    }

    // Each plugin's name and detect string, read again when its file changed.
    async Task Refresh(IEnumerable<string> paths)
    {
        var changed = false;
        foreach (var path in paths)
        {
            long stamp;
            try { stamp = File.Exists(path) ? File.GetLastWriteTimeUtc(path).Ticks : -1; }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { stamp = -1; }
            if (known.TryGetValue(path, out var was) && was.Stamp == stamp) continue;
            Entry entry;
            if (stamp < 0) entry = new(stamp, Path.GetFileNameWithoutExtension(path), "", "the file is not there");
            else
            {
                var a = await client.Ask(new JsonObject { ["op"] = "detect", ["plugin"] = path });
                entry = new(stamp, a["name"]?.GetValue<string>() ?? Path.GetFileNameWithoutExtension(path), a["detect"]?.GetValue<string>() ?? "",
                    a["error"]?.GetValue<string>());
                if (views.Count == 0) idle.Start();
            }
            known[path] = entry;
            changed = true;
        }
        if (!changed) return;
        var o = new JsonObject();
        foreach (var (path, e) in known)
            o[path] = new JsonObject { ["stamp"] = e.Stamp, ["name"] = e.Name, ["detect"] = e.Detect, ["error"] = e.Error };
        try
        {
            Directory.CreateDirectory(DataFolder.StateDir(dataDir));
            File.WriteAllText(DataFolder.StatePath(dataDir, StateName), o.ToJsonString());
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }

    /// <summary>The plugins that can be offered (read, no error), the folder's first.</summary>
    public async Task<List<Lister>> Known(IEnumerable<string> added)
    {
        var paths = Paths(added).Select(p => p.Path).ToList();
        await Refresh(paths);
        return [.. paths.Where(p => known.TryGetValue(p, out var e) && e.Error is null).Select(p => new Lister(p, known[p].Name, known[p].Detect))];
    }

    /// <summary>Every plugin as the settings window lists it: its path, name, detect string, error, and whether it is in
    /// the plugins folder (removed there by removing its file).</summary>
    public async Task<JsonArray> Info(IEnumerable<string> added)
    {
        var paths = Paths(added).ToList();
        await Refresh(paths.Select(p => p.Path));
        return new JsonArray([.. paths.Select(p =>
        {
            var e = known[p.Path];
            return (JsonNode)new JsonObject { ["path"] = p.Path, ["name"] = e.Name, ["detect"] = e.Detect, ["error"] = e.Error, ["inFolder"] = p.InFolder };
        })]);
    }

    /// <summary>A file in a plugin, in `view` (a preview's own key) as a child of `parent` (its panel), `size` large:
    /// the plugin's window (its holder in the helper) or why not. `stopped`: the helper went while it showed;
    /// `escape`: Esc in the plugin's window.</summary>
    public async Task<(IntPtr Window, string? Error)> Show(string view, IntPtr parent, Size size, Lister plugin, string path, Action stopped, Action escape)
    {
        idle.Stop();
        views[view] = (stopped, escape);
        var a = await client.Ask(new JsonObject { ["op"] = "load", ["view"] = view, ["parent"] = (long)parent, ["plugin"] = plugin.Path,
            ["path"] = path, ["width"] = size.Width, ["height"] = size.Height });
        if (a["error"]?.GetValue<string>() is string error)
        {
            Closed(view);
            return (IntPtr.Zero, error);
        }
        return (new IntPtr(a["window"]!.GetValue<long>()), null);
    }

    /// <summary>The view closed: its plugin window too (the helper not waited for).</summary>
    public void Close(string view)
    {
        if (!views.ContainsKey(view)) return;
        Closed(view);
        if (client.Running) _ = client.Ask(new JsonObject { ["op"] = "close", ["view"] = view });
    }

    void Closed(string view)
    {
        views.Remove(view);
        if (views.Count == 0) { idle.Stop(); idle.Start(); }
    }

    // The helper went (a plugin crashed or hung): every view it showed says so.
    void Stopped()
    {
        var left = views.Values.ToList();
        views.Clear();
        foreach (var v in left) v.Stopped();
    }

    public void Dispose()
    {
        idle.Dispose();
        client.Dispose();
    }
}
