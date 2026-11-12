using System.IO.Pipes;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace Foldex;

/// <summary>
/// The one Foldex process: its windows, the pipe later launches hand their arguments over, the browser environment all
/// windows share, the projects with every window's session (State\projects.json, docs/plans/15-PLAN-projects.md) and
/// what Foldex remembers by itself besides (State\state.json).
/// </summary>
sealed class AppHost : ApplicationContext
{
    // FOLDEX_DATA points a test run somewhere else, away from the real state.
    public static readonly string DataDir = DataFolder.Resolve(System.Environment.GetEnvironmentVariable("FOLDEX_DATA"),
        System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData));
    static string StatePath => DataFolder.StatePath(DataDir, "state.json");

    public const string DefaultsFolder = "defaults";

#if DEBUG
    static readonly string? ProjectDefaults = FindProjectFolder(AppContext.BaseDirectory, DefaultsFolder);
#else
    static readonly string? ProjectDefaults = null;   // readonly, not const: a const null makes every test of it a warning
#endif

    /// <summary>The defaults: next to the exe; a debug build reads the project's own, so an edit needs no build.</summary>
    public static string DefaultsDir => ProjectDefaults ?? Path.Combine(AppContext.BaseDirectory, DefaultsFolder);

    /// <summary>A folder of the project the exe was built from (defaults, web): up from `from` to the folder with
    /// Foldex.csproj, or to the top folder with src\Foldex.csproj (from the tests, which are beside src).</summary>
    internal static string? FindProjectFolder(string from, string folder)
    {
        for (var dir = new DirectoryInfo(from); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Foldex.csproj"))) return Path.Combine(dir.FullName, folder);
            if (File.Exists(Path.Combine(dir.FullName, "src", "Foldex.csproj"))) return Path.Combine(dir.FullName, "src", folder);
        }
        return null;
    }

    /// <summary>The version (1.0.commits, Foldex.csproj) and the short commit hash, when built from git.</summary>
    public static (string Version, string? Commit) Version()
    {
        var asm = typeof(AppHost).Assembly;
        var version = asm.GetName().Version is { } v ? $"{v.Major}.{v.Minor}.{v.Build}" : "0.0.0";
        var commit = asm.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == "Commit")?.Value;
        return (version, commit);
    }

    /// <summary>What Foldex remembers by itself: the place of the window closed last (for a window without one of its
    /// own) and of the Manage projects window. Layout: the last closed window's panes and docks from before projects
    /// (plan 12 3.4), read once to become project 1 (plan 15 3.8).</summary>
    public sealed class AppState
    {
        public JsonObject? Layout { get; set; }
        public int[]? ProjectsWindow { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public bool Maximized { get; set; }
    }

    static readonly JsonSerializerOptions Indented = new() { WriteIndented = true };

    public AppState? State { get; private set; } = ReadState();

    static AppState? ReadState()
    {
        try { return File.Exists(StatePath) ? JsonSerializer.Deserialize<AppState>(File.ReadAllText(StatePath)) : null; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { return null; }
    }

    public void SaveState(AppState state)
    {
        State = state;
        try
        {
            Directory.CreateDirectory(DataFolder.StateDir(DataDir));
            File.WriteAllText(StatePath, JsonSerializer.Serialize(state, Indented));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }

    readonly List<MainForm> windows = [];   // opening order
    readonly List<MainForm> recent = [];    // most recently active first
    Task<CoreWebView2Environment>? environment;

    public IReadOnlyList<MainForm> Windows => windows;

    /// <summary>Shell work off the UI thread (listing, icons).</summary>
    public Shell.StaWorker ShellWork { get; } = new("shell");

    /// <summary>The file operations of every window; each window is told of every change.</summary>
    public Shell.FileOps FileOps { get; }

    public AppHost()
    {
        FileOps = new Shell.FileOps(op =>
        {
            foreach (var w in windows) w.Post(new JsonObject { ["event"] = "fileOp", ["op"] = op.ToJson() });
        });
    }

    /// <summary>The browser environment every window shares: its own data folder in State\ (so its processes are
    /// Foldex's own, not shared with other apps' WebView2), no other process allowed in (docs/plans/02, 3.5).</summary>
    public Task<CoreWebView2Environment> WebEnvironment()
    {
        // The page is answered locally, but without this rule the browser first waits for a real DNS lookup of the
        // made-up name to fail, on every start (as LexPen).
        var options = new CoreWebView2EnvironmentOptions($"--host-resolver-rules=\"MAP {WebFiles.Host} 127.0.0.1\"")
        {
            ExclusiveUserDataFolderAccess = true,
        };
        return environment ??= CoreWebView2Environment.CreateAsync(null, DataFolder.StateDir(DataDir), options);
    }

    /// <summary>The browser process of `failed` has gone: the next window or page starts a new environment.</summary>
    public async Task DropEnvironment(CoreWebView2Environment failed)
    {
        if (environment is { } current && await current == failed) environment = null;
    }

    // ---------- Launch (plan 15 3.4, 3.5) ----------

    bool restored;

    /// <summary>Paths from the command line or a later launch. The first launch opens the windows that were open first
    /// (Windows closing Foldex, a crash), each on its own virtual desktop; then Route.</summary>
    public void Launch(IReadOnlyList<string> paths, bool shift)
    {
        if (!restored)
        {
            restored = true;
            foreach (var (_, entry) in projects.StartWindows()) Open([], entry.Key, toDesktop: true);
            SaveProjects();
            // Only once they are on their own desktops does "a window on this desktop" mean anything.
            if (windows.Count > 0)
            {
                RouteWhenSettled(paths, shift);
                return;
            }
        }
        Route(paths, shift);
    }

    async void RouteWhenSettled(IReadOnlyList<string> paths, bool shift)
    {
        await Task.WhenAny(Task.WhenAll(windows.Select(w => w.Settled.Task)), Task.Delay(5000));
        Route(paths, shift);
    }

    // To the window used last on this desktop; with none here (or Shift) a new window, which on a desktop whose last
    // window was closed by hand becomes that project's (WindowShown).
    void Route(IReadOnlyList<string> paths, bool shift)
    {
        if (!shift && recent.FirstOrDefault(w => !w.IsDisposed && VirtualDesktop.OnCurrentDesktop(w.Handle)) is { } target)
        {
            target.Show(paths);
            BringToFront(target);
            return;
        }
        BringToFront(Open(paths, reopenHere: !shift));
    }

    public static void BringToFront(Form w)
    {
        if (w.WindowState == FormWindowState.Minimized) w.WindowState = FormWindowState.Normal;
        w.Activate();
        SetForegroundWindow(w.Handle);
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hwnd);

    /// <summary>What the pages need to look and behave as set: { settings, themes } (SettingsFile, ThemeFile).</summary>
    public static JsonObject Look() => new() { ["settings"] = SettingsFile.Load(DataDir), ["themes"] = ThemeFile.Load(DataDir) };

    /// <summary>One setting into your settings.json; every window, the settings window too, gets the new settings.
    /// Throws (ArgumentException, IOException, ...) when it cannot be written.</summary>
    public void SetSetting(string name, JsonNode? value)
    {
        SettingsFile.Write(DataDir, name, value);
        Broadcast();
    }

    /// <summary>Your bars.json written from a window's bars (docs/plans/executed/10-PLAN-bars.md 3.3), or removed (null: the
    /// shipped bars again); every window draws them again.</summary>
    public void SaveBars(JsonNode? bars)
    {
        if (bars is null) File.Delete(Path.Combine(DataDir, BarsFile.Name));
        else BarsFile.Save(DataDir, bars);
        var message = new JsonObject { ["event"] = "bars", ["bars"] = BarsFile.Load(DataDir, Path.Combine(DefaultsDir, BarsFile.Name)) };
        foreach (var w in windows) w.Post((JsonObject)message.DeepClone());
    }

    /// <summary>The column sets and the folders' choices (docs/plans/executed/11-PLAN-columns.md 3.3), shipped and yours.</summary>
    public static JsonObject ColumnSets() => ColumnSetsFile.Load(DataDir, Path.Combine(DefaultsDir, ColumnSetsFile.SetsName));

    /// <summary>Your column sets and/or the folders' choices written; every window gets them again.</summary>
    public void SaveColumns(JsonNode? mine, JsonNode? folders)
    {
        if (mine is not null) ColumnSetsFile.SaveSets(DataDir, mine);
        if (folders is not null) ColumnSetsFile.SaveFolders(DataDir, folders);
        var message = new JsonObject { ["event"] = "columnSets", ["columnSets"] = ColumnSets() };
        foreach (var w in windows) w.Post((JsonObject)message.DeepClone());
    }

    /// <summary>Tells every page the settings and themes as they are now.</summary>
    public void Broadcast()
    {
        var message = Look();
        message["event"] = "settings";
        foreach (var w in windows) w.Post((JsonObject)message.DeepClone());
        settingsForm?.Post((JsonObject)message.DeepClone());
        projectsForm?.Post((JsonObject)message.DeepClone());
    }

    // Your settings.json or a theme of yours edited by hand (or copied in): every page follows, once the writing rests.
    readonly List<FileSystemWatcher> watchers = [];
    System.Windows.Forms.Timer? settle;

    void Watch()
    {
        if (settle is not null) return;
        settle = new System.Windows.Forms.Timer { Interval = 300 };
        settle.Tick += (_, _) =>
        {
            settle.Stop();
            Broadcast();
        };
        var ui = SynchronizationContext.Current!;
        var themes = Path.Combine(DataDir, ThemeFile.FolderName);
        try { Directory.CreateDirectory(themes); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return; }
        foreach (var (folder, filter) in new[] { (DataDir, SettingsFile.Name), (themes, "*.json") })
        {
            var w = new FileSystemWatcher(folder, filter) { NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite };
            FileSystemEventHandler changed = (_, _) => ui.Post(_ => { settle.Stop(); settle.Start(); }, null);
            w.Changed += changed;
            w.Created += changed;
            w.Deleted += changed;
            w.Renamed += (s, e) => changed(s, e);
            w.EnableRaisingEvents = true;
            watchers.Add(w);
        }
    }

    // The settings window (docs/plans/executed/07-PLAN-themes.md 3.5): one for Foldex.
    SettingsForm? settingsForm;

    public void OpenSettings(MainForm from)
    {
        if (settingsForm is null || settingsForm.IsDisposed)
        {
            settingsForm = new SettingsForm(this, from);
            settingsForm.FormClosed += (_, _) => settingsForm = null;
            settingsForm.Show();
        }
        else
        {
            if (settingsForm.WindowState == FormWindowState.Minimized) settingsForm.WindowState = FormWindowState.Normal;
            settingsForm.Activate();
        }
    }

    /// <summary>The folders the windows show, watched (plan 03 3.8); made with the first window, on the UI thread.</summary>
    public Shell.FolderWatch? Folders { get; private set; }

    /// <summary>
    /// A window. <paramref name="key"/>: the window of a project to open again (its session, place and, with toDesktop,
    /// its desktop); 0: a new window, the one of <paramref name="project"/> or of a new project (plan 15 3.2).
    /// reopenHere: a new window that becomes the project closed last on its desktop, when there is one (WindowShown).
    /// </summary>
    MainForm Open(IReadOnlyList<string> paths, int key = 0, ProjectStore.Project? project = null, bool toDesktop = false, bool reopenHere = false)
    {
        var entry = key != 0 ? projects.WindowOf(key) : null;
        entry ??= projects.AddWindow(project ?? projects.NewProject(""));
        var w = new MainForm(this, entry.Key, paths) { ToDesktop = toDesktop, ReopenHere = reopenHere };
        Place(w, entry);
        Watch();
        Folders ??= new Shell.FolderWatch((folder, shown) =>
        {
            foreach (var window in shown.OfType<MainForm>()) window.Post(new JsonObject { ["event"] = "folderChanged", ["folder"] = folder });
        });
        windows.Add(w);
        recent.Add(w);
        w.Activated += (_, _) =>
        {
            recent.Remove(w);
            recent.Insert(0, w);
            projects.Touch(w.Key);
            WindowPlaceChanged(w);
        };
        w.Move += (_, _) => WindowPlaceChanged(w);
        w.Resize += (_, _) => WindowPlaceChanged(w);
        w.FormClosed += (_, e) => Closed(w, e.CloseReason);
        entry.Open = true;
        projects.Touch(entry.Key);
        w.Show();
        ProjectsChanged();
        return w;
    }

    // Its own place when that is on a screen; the first window of a run: the place of the window closed last; else a
    // step down and right from the window used last.
    void Place(MainForm w, ProjectStore.Window entry)
    {
        Rectangle? saved = entry.Bounds is [var x, var y, var width, var height] ? new Rectangle(x, y, width, height)
            : windows.Count == 0 && State is { Width: > 0, Height: > 0 } s ? new Rectangle(s.X, s.Y, s.Width, s.Height) : null;
        var maximized = entry.Bounds is not null ? entry.Maximized : windows.Count == 0 && State?.Maximized == true;
        if (saved is { } b && Screen.AllScreens.Any(sc => sc.WorkingArea.IntersectsWith(b)))
            w.Bounds = b;
        else if (recent.FirstOrDefault() is { } from)
        {
            var r = from.WindowState == FormWindowState.Normal ? from.Bounds : from.RestoreBounds;
            r.Offset(32, 32);
            w.Bounds = r;
        }
        else w.Bounds = DefaultBounds();
        if (maximized) w.WindowState = FormWindowState.Maximized;
    }

    static Rectangle DefaultBounds()
    {
        var area = Screen.PrimaryScreen!.WorkingArea;
        return new Rectangle(area.X + area.Width / 8, area.Y + area.Height / 8, area.Width * 3 / 4, area.Height * 3 / 4);
    }

    /// <summary>
    /// A window is shown: now Windows knows it, so it can go to its own desktop (a window opened at start) and tell
    /// which desktop it is on; tried for up to about 3 seconds. A new window on a desktop whose last Foldex window was
    /// closed by hand becomes the window of that project, at its place (plan 15 3.5). The page loads after this.
    /// </summary>
    public async Task WindowShown(MainForm w)
    {
        WatchDesktops();
        string? desktop = null;
        var target = w.ToDesktop ? projects.WindowOf(w.Key)?.Desktop : null;
        if (VirtualDesktop.Available && (target is not null || w.ReopenHere))
            for (var i = 0; i < 30; i++)
            {
                var moved = target is null || VirtualDesktop.MoveTo(w.Handle, target);
                desktop = VirtualDesktop.DesktopOf(w.Handle);
                // Known to Windows and moved; or known but the desktop is gone (removed, another PC): it stays here.
                if (desktop is not null && (moved || i >= 3)) break;
                await Task.Delay(100);
            }
        if (w.ReopenHere && desktop is not null && projects.LastClosedOn(desktop) is { } closed
            && closed.Windows.Where(o => o.Desktop == desktop).MaxBy(o => o.Used) is { } reuse)
        {
            projects.Forget(w.Key);
            w.Rekey(reuse.Key);
            reuse.Open = true;
            if (reuse.Bounds is [var x, var y, var width, var height]
                && Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(new Rectangle(x, y, width, height))))
            {
                w.Bounds = new Rectangle(x, y, width, height);
                if (reuse.Maximized) w.WindowState = FormWindowState.Maximized;
            }
        }
        projects.Touch(w.Key);
        WindowPlaceChanged(w);
        ProjectsChanged();
        w.Settled.TrySetResult();
    }

    void Closed(MainForm w, CloseReason reason)
    {
        Folders?.Forget(w);
        windows.Remove(w);
        recent.Remove(w);
        // Closed by hand, the last window too: its project closes (ProjectStore.CloseByHand) and comes back when Foldex
        // starts on that desktop (LastClosedOn). Windows closing it (log-off, shutdown, Task Manager): the windows stay
        // open in their projects and all come back at the next start, each on its desktop.
        if (reason is not (CloseReason.WindowsShutDown or CloseReason.TaskManagerClosing)) projects.CloseByHand(w.Key);
        // The place for a window without one of its own (plan 15 3.8).
        var b = w.WindowState == FormWindowState.Normal ? w.Bounds : w.RestoreBounds;
        SaveState(new AppState
        {
            X = b.X, Y = b.Y, Width = b.Width, Height = b.Height, Maximized = w.WindowState == FormWindowState.Maximized,
            ProjectsWindow = State?.ProjectsWindow,
        });
        SaveProjects();
        ProjectsChanged();
        if (windows.Count == 0)
        {
            projectsForm?.Close();
            ExitThread();
        }
    }

    // ---------- Projects (ProjectStore; docs/plans/15-PLAN-projects.md) ----------

    static string ProjectsPath => DataFolder.StatePath(DataDir, ProjectStore.FileName);
    readonly ProjectStore projects = LoadProjects();

    // The first start with projects: the layout state.json kept (the last closed window's) becomes project 1.
    static ProjectStore LoadProjects()
    {
        if (File.Exists(ProjectsPath)) return ProjectStore.Load(ProjectsPath);
        var old = ReadState();
        return ProjectStore.Load(ProjectsPath, old?.Layout, old is { Width: > 0, Height: > 0 } ? [old.X, old.Y, old.Width, old.Height] : null,
            old?.Maximized == true);
    }

    // Saved shortly after a change: changes close together (a window moved, several sessions) are one write.
    readonly System.Windows.Forms.Timer projectsTimer = new() { Interval = 1000 };
    bool projectsTimerHooked;

    void SaveProjectsSoon()
    {
        if (!projectsTimerHooked)
        {
            projectsTimerHooked = true;
            projectsTimer.Tick += (_, _) => SaveProjects();
        }
        projectsTimer.Stop();
        projectsTimer.Start();
    }

    void SaveProjects()
    {
        projectsTimer.Stop();
        try { projects.Save(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }   // the next change tries again
    }

    /// <summary>A window's session from the page (its layout, 800 ms after a change): saved a second later.</summary>
    public void SaveSession(MainForm w, JsonNode layout)
    {
        if (projects.WindowOf(w.Key) is not { } entry) return;
        entry.Session = layout.DeepClone();
        SaveProjectsSoon();
    }

    /// <summary>What a window's page starts with (plan 15 3.2): its own layout, else that of its project's last used
    /// window, else the default layout of the settings (defaultLayout; {}: the page's own default).</summary>
    public JsonObject? LayoutFor(MainForm w) =>
        projects.LayoutOf(w.Key) as JsonObject ?? DefaultLayout();

    public JsonObject? DefaultLayoutOrNull() => DefaultLayout();

    static JsonObject? DefaultLayout() =>
        SettingsFile.Load(DataDir)["values"]?["defaultLayout"] is JsonObject { Count: > 0 } d ? (JsonObject)d.DeepClone() : null;

    /// <summary>The window moved, changed size or desktop: kept with its session.</summary>
    public void WindowPlaceChanged(MainForm w)
    {
        if (projects.WindowOf(w.Key) is not { } entry || w.WindowState == FormWindowState.Minimized || !w.IsHandleCreated) return;
        var b = w.WindowState == FormWindowState.Normal ? w.Bounds : w.RestoreBounds;
        int[] bounds = [b.X, b.Y, b.Width, b.Height];
        var maximized = w.WindowState == FormWindowState.Maximized;
        var desktop = VirtualDesktop.DesktopOf(w.Handle) ?? entry.Desktop;
        if (entry.Bounds is not null && entry.Bounds.SequenceEqual(bounds) && entry.Maximized == maximized && entry.Desktop == desktop) return;
        (entry.Bounds, entry.Maximized, entry.Desktop) = (bounds, maximized, desktop);
        SaveProjectsSoon();
    }

    // A window moved to another desktop by hand (Win+Tab) gives no event: looked at now and then.
    readonly System.Windows.Forms.Timer desktopTimer = new() { Interval = 5000 };
    bool desktopTimerOn;

    void WatchDesktops()
    {
        if (desktopTimerOn) return;
        desktopTimerOn = true;
        desktopTimer.Tick += (_, _) => { foreach (var w in windows) WindowPlaceChanged(w); };
        desktopTimer.Start();
    }

    /// <summary>The window's project as the page and the title show it.</summary>
    public JsonObject ProjectInfo(MainForm w)
    {
        var p = projects.ProjectOf(w.Key);
        return new JsonObject { ["id"] = p?.Id, ["name"] = p?.Name ?? "", ["display"] = p is null ? "" : ProjectStore.Display(p) };
    }

    // A project made, renamed or deleted, a window opened or closed: titles, bottom bars and the Manage list follow.
    void ProjectsChanged()
    {
        foreach (var w in windows)
        {
            var info = ProjectInfo(w);
            w.ShowProject(info["display"]!.GetValue<string>());
            w.Post(new JsonObject { ["event"] = "project", ["project"] = info });
        }
        projectsForm?.Post(new JsonObject { ["event"] = "projects" });
        SaveProjectsSoon();
    }

    // A shell place without a path (This PC, "::{...}") by its name.
    static string? Shown(string? folder) =>
        folder is not null && (folder.StartsWith("::") || folder.StartsWith("shell:")) ? Shell.ShellListing.NameOf(folder) : folder;

    /// <summary>The Projects menu and the Manage projects list: every project (this window's first, then the newest
    /// used), whether it is open, and its window's panes as a tree (ProjectStore.PaneTree: depth and name). With
    /// details (Manage): also the folders of those panes.</summary>
    public JsonArray ProjectList(MainForm? from, bool details = false)
    {
        var mine = from is null ? null : projects.ProjectOf(from.Key);
        var open = windows.Select(w => w.Key).ToHashSet();
        return new JsonArray(projects.Projects.OrderByDescending(p => p == mine).ThenByDescending(p => p.Used).Select(p =>
        {
            var panes = ProjectStore.PaneTree(p.Windows.FirstOrDefault()?.Session)
                .Select(t => (t.Depth, t.Id, Name: Shown(t.Name)!, Folder: Shown(t.Folder))).ToList();   // a name from a path: This PC
            var o = new JsonObject
            {
                ["id"] = p.Id, ["name"] = p.Name, ["display"] = ProjectStore.Display(p), ["mine"] = p == mine,
                ["open"] = p.Windows.Any(w => open.Contains(w.Key)),
                ["used"] = p.Used == DateTime.MinValue ? null : p.Used.ToString("o"),
                ["created"] = p.Created?.ToString("o"),
                ["panes"] = new JsonArray(panes.Select(t => (JsonNode?)new JsonObject
                {
                    ["depth"] = t.Depth, ["id"] = t.Id, ["name"] = t.Name,
                }).ToArray()),
            };
            if (details)
                o["folders"] = new JsonArray(panes.Select(t => t.Folder).OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase)
                    .Select(f => (JsonNode?)f).ToArray());
            return (JsonNode?)o;
        }).ToArray());
    }

    /// <summary>The Projects menu's commands (from: its window; null: the Manage projects window). A window opened from
    /// it comes on the desktop you are on.</summary>
    public void ProjectCommand(MainForm? from, string kind, JsonNode? msg)
    {
        int Id() => msg!["project"]!.GetValue<int>();
        string Name() => msg?["name"]?.GetValue<string>() ?? "";
        switch (kind)
        {
            case "open":   // its window: opened when closed, else to the front; with a pane, the focus on it
                if (projects.Get(Id()) is not { } p) return;
                var shown = p.Windows.FirstOrDefault() is { } entry
                    ? windows.FirstOrDefault(w => w.Key == entry.Key) ?? Open([], entry.Key)
                    : Open([], project: p);   // a named project without a window
                BringToFront(shown);
                if (msg?["pane"]?.GetValue<string>() is { } pane) shown.Post(new JsonObject { ["event"] = "focusPane", ["pane"] = pane });
                break;
            case "new":
                BringToFront(Open([], project: projects.NewProject(Name())));
                break;
            case "rename":
                if (msg?["project"] is not null) { if (projects.Get(Id()) is { } named) projects.Rename(named, Name()); }
                else if (from is not null && projects.ProjectOf(from.Key) is { } mine) projects.Rename(mine, Name());
                break;
            case "delete":
                if (projects.Get(Id()) is { } gone) projects.Delete(gone);
                break;
            case "clone":   // a copy of its windows, closed
                if (projects.Get(Id()) is { } source) projects.Clone(source, Name());
                break;
        }
        ProjectsChanged();
    }

    // ---------- Manage projects (ProjectsForm; plan 15 3.7) ----------

    ProjectsForm? projectsForm;

    /// <summary>The Manage projects window: one for Foldex; opened again, brought to the front.</summary>
    public void OpenProjects(MainForm from)
    {
        if (projectsForm is { IsDisposed: false }) { BringToFront(projectsForm); return; }
        projectsForm = new ProjectsForm(this, from);
        projectsForm.FormClosed += (_, _) => projectsForm = null;
        projectsForm.Show();
    }

    public void SaveProjectsWindow(int[] bounds)
    {
        var s = State ?? new AppState();
        s.ProjectsWindow = bounds;
        SaveState(s);
    }

    /// <summary>The window worked in last: where the Manage window's questions and Esc go.</summary>
    public MainForm? LastActive => recent.FirstOrDefault(w => !w.IsDisposed);

    /// <summary>Closes the projects' windows, as closing them by hand does. Nothing is unsaved in Foldex.</summary>
    public void CloseProjects(List<int> ids)
    {
        foreach (var p in ids.Select(projects.Get).OfType<ProjectStore.Project>().ToList())
            foreach (var w in windows.Where(o => projects.ProjectOf(o.Key) == p).ToList())
                w.Close();
    }

    /// <summary>Deletes the projects after asking; their open windows close first.</summary>
    public void DeleteProjects(IWin32Window owner, List<int> ids)
    {
        var list = ids.Select(projects.Get).OfType<ProjectStore.Project>().ToList();
        if (list.Count == 0) return;
        var what = list.Count == 1 ? $"'{ProjectStore.Display(list[0])}'" : $"{list.Count} projects";
        var names = list.Count == 1 ? "" : string.Join(Environment.NewLine, list.Select(p => "    " + ProjectStore.Display(p)))
            + Environment.NewLine + Environment.NewLine;
        if (MessageBox.Show(owner, names + "An open one closes; folders and files are not touched.", $"Delete {what}?",
                MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK)
            return;
        CloseProjects(ids);
        foreach (var p in list)
            if (projects.Get(p.Id) is { } still) projects.Delete(still);
        ProjectsChanged();
    }

    /// <summary>One setting for the Manage window (projectsSort), without telling every page.</summary>
    public static void SetQuietly(string name, JsonNode? value) => SettingsFile.Write(DataDir, name, value);

    // Later launches hand their arguments over this pipe (Program.Send).
    public async void Listen(string pipeName)
    {
        while (true)
        {
            try
            {
                await using var server = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1,
                    PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                await server.WaitForConnectionAsync();
                using var reader = new StreamReader(server, leaveOpen: true);
                var msg = JsonNode.Parse(await reader.ReadLineAsync() ?? "{}")!;
                await using var writer = new StreamWriter(server, leaveOpen: true) { AutoFlush = true };
                await writer.WriteLineAsync("ok");
                var paths = msg["paths"]?.AsArray().Select(p => p!.GetValue<string>()).ToList() ?? [];
                Launch(paths, msg["shift"]?.GetValue<bool>() == true);
            }
            catch (Exception ex) when (ex is IOException or JsonException) { }
        }
    }
}
