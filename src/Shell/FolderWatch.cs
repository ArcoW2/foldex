namespace Foldex.Shell;

/// <summary>
/// Folders shown are watched (docs/plans/executed/03-PLAN-connected-panes.md 3.8): each window says which folders on disk it
/// shows (its lists, the folders open in its trees); one watcher per folder, shared by the windows that show it. A
/// change is told to those windows once things have been quiet for a moment, so a file being written does not make
/// its folder read again and again. Shell folders (This PC, the Recycle Bin) are not watched.
/// </summary>
sealed class FolderWatch(Action<string, IEnumerable<object>> changed) : IDisposable
{
    sealed class Watched
    {
        public required FileSystemWatcher Watcher;
        public readonly HashSet<object> Windows = [];
    }

    readonly Dictionary<string, Watched> folders = new(StringComparer.OrdinalIgnoreCase);
    readonly HashSet<string> pending = new(StringComparer.OrdinalIgnoreCase);
    readonly SynchronizationContext ui = SynchronizationContext.Current ?? new SynchronizationContext();
    System.Windows.Forms.Timer? quiet;

    /// <summary>The folders a window shows now (replacing what it showed before).</summary>
    public void Set(object window, IEnumerable<string> shown)
    {
        var wanted = shown.Where(IsDiskFolder).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var (path, w) in folders.ToList())
            if (!wanted.Contains(path) && w.Windows.Remove(window) && w.Windows.Count == 0) Drop(path);
        foreach (var path in wanted)
        {
            if (!folders.TryGetValue(path, out var w))
            {
                if (Start(path) is not { } watcher) continue;
                folders[path] = w = new Watched { Watcher = watcher };
            }
            w.Windows.Add(window);
        }
    }

    /// <summary>A window gone: its folders no longer watched for it.</summary>
    public void Forget(object window) => Set(window, []);

    static bool IsDiskFolder(string path) => (path.Length >= 3 && path[1] == ':' && path[2] == '\\' || path.StartsWith(@"\\")) && !path.StartsWith(@"\\?\");

    FileSystemWatcher? Start(string path)
    {
        try
        {
            var watcher = new FileSystemWatcher(path)
            {
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.Attributes,
            };
            FileSystemEventHandler on = (_, _) => Changed(path);
            watcher.Changed += on;
            watcher.Created += on;
            watcher.Deleted += on;
            watcher.Renamed += (_, _) => Changed(path);
            watcher.Error += (_, _) => Changed(path);   // its buffer ran over: read the folder again to be sure
            watcher.EnableRaisingEvents = true;
            return watcher;
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException or PlatformNotSupportedException)
        {
            return null;   // a folder that cannot be watched (gone, no access, some network shares) is shown as read
        }
    }

    void Drop(string path)
    {
        folders[path].Watcher.Dispose();
        folders.Remove(path);
    }

    // From the watcher's thread: noted, and told once the folder has been quiet for 300 ms.
    void Changed(string path) => ui.Post(_ =>
    {
        pending.Add(path);
        quiet ??= MakeTimer();
        quiet.Stop();
        quiet.Start();
    }, null);

    System.Windows.Forms.Timer MakeTimer()
    {
        var timer = new System.Windows.Forms.Timer { Interval = 300 };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            foreach (var path in pending)
                if (folders.TryGetValue(path, out var w)) changed(path, w.Windows.ToList());
            pending.Clear();
        };
        return timer;
    }

    public void Dispose()
    {
        foreach (var w in folders.Values) w.Watcher.Dispose();
        folders.Clear();
        quiet?.Dispose();
    }
}
