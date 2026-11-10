using System.IO.Pipes;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace Foldex;

/// <summary>
/// The one Foldex process: its windows, the pipe later launches hand their arguments over, the browser environment all
/// windows share, and what Foldex remembers by itself (State\state.json).
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

    /// <summary>What Foldex remembers by itself: the last window's position and size.</summary>
    public sealed class AppState
    {
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

    /// <summary>Paths from the command line or a later launch: a new window with Shift (or -n) or when there is none,
    /// else the window used last, brought to the front.</summary>
    public void Launch(IReadOnlyList<string> paths, bool shift)
    {
        if (shift || recent.FirstOrDefault(w => !w.IsDisposed) is not MainForm target)
        {
            Open(paths);
            return;
        }
        target.Show(paths);
    }

    /// <summary>What the pages need to look and behave as set: { settings, themes } (SettingsFile, ThemeFile).</summary>
    public static JsonObject Look() => new() { ["settings"] = SettingsFile.Load(DataDir), ["themes"] = ThemeFile.Load(DataDir) };

    /// <summary>One setting into your settings.json; every window, the settings window too, gets the new settings.
    /// Throws (ArgumentException, IOException, ...) when it cannot be written.</summary>
    public void SetSetting(string name, JsonNode? value)
    {
        SettingsFile.Write(DataDir, name, value);
        Broadcast();
    }

    /// <summary>Tells every page the settings and themes as they are now.</summary>
    public void Broadcast()
    {
        var message = Look();
        message["event"] = "settings";
        foreach (var w in windows) w.Post((JsonObject)message.DeepClone());
        settingsForm?.Post((JsonObject)message.DeepClone());
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

    // The settings window (docs/plans/07-PLAN-themes.md 3.5): one for Foldex.
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

    void Open(IReadOnlyList<string> paths)
    {
        var w = new MainForm(this, paths);
        Watch();
        Folders ??= new Shell.FolderWatch((folder, shown) =>
        {
            foreach (var window in shown.OfType<MainForm>()) window.Post(new JsonObject { ["event"] = "folderChanged", ["folder"] = folder });
        });
        windows.Add(w);
        recent.Insert(0, w);
        w.Activated += (_, _) =>
        {
            recent.Remove(w);
            recent.Insert(0, w);
        };
        w.FormClosed += (_, _) =>
        {
            Folders?.Forget(w);
            windows.Remove(w);
            recent.Remove(w);
            if (windows.Count == 0) ExitThread();
        };
        w.Show();
    }

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
