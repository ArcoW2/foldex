using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Foldex.Shell;

namespace Foldex;

/// <summary>
/// A Foldex window: one WebView2 showing the page (web\index.html). The page and the host talk through JSON messages:
/// the page asks ({ op, ... }), the host tells ({ event, ... }). When the page's process fails, the window makes a new
/// page and nothing else stops (docs/plans/02-PLAN-ui-technology.md 3.5). It is a window of a project (Key, ProjectStore):
/// its layout is that window's session (docs/plans/15-PLAN-projects.md).
/// </summary>
sealed class MainForm : Form
{
    readonly AppHost app;
    WebView2 web = null!;
    IReadOnlyList<string> paths;   // the last ones given, for a new page after a failure
    bool pageReady;
    readonly List<string> queue = [];   // told before the page was ready

    public MainForm(AppHost app, int key, IReadOnlyList<string> paths)
    {
        this.app = app;
        this.paths = paths;
        Key = key;
        Text = "Foldex";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.Manual;   // AppHost.Place
        AddBrowser();
        preview = new PreviewHost(this);
        // Drives that come or go (plan 10 3.2): Windows' device messages (WndProc) for sticks and cards; a drive mapped
        // or made with subst sends none, so the letters are also looked at every few seconds.
        drivesSoon.Tick += (_, _) =>
        {
            drivesSoon.Stop();
            _ = TellDrives();
        };
        drivesPoll.Tick += (_, _) =>
        {
            if (Drives.Letters() != driveLetters) _ = TellDrives();
        };
        drivesPoll.Start();
        FormClosed += (_, _) =>
        {
            drivesPoll.Dispose();
            drivesSoon.Dispose();
        };
    }

    static JsonArray? propList;   // the properties for columns, read once per run

    readonly System.Windows.Forms.Timer drivesSoon = new() { Interval = 500 }, drivesPoll = new() { Interval = 4000 };
    string driveLetters = "";

    async Task TellDrives()
    {
        driveLetters = Drives.Letters();
        var list = await StaWorker.Once("drives", Drives.List);
        Post(new JsonObject { ["event"] = "drives", ["drives"] = list });
    }

    readonly PreviewHost preview;

    /// <summary>Its window in the projects (ProjectStore.Window.Key).</summary>
    public int Key { get; private set; }

    /// <summary>Opened at start: goes to the virtual desktop it was on. ReopenHere: a new window that becomes the
    /// project closed last on its desktop (AppHost.WindowShown).</summary>
    public bool ToDesktop, ReopenHere;

    /// <summary>Done once it is on its desktop and in its project (AppHost.WindowShown).</summary>
    public TaskCompletionSource Settled { get; } = new();

    /// <summary>Becomes another window of the projects (a closed one opened again in its place).</summary>
    public void Rekey(int key) => Key = key;

    /// <summary>The title: Foldex, its version (docs/plans/executed/10-PLAN-bars.md 3.2: no longer in a strip of the page) and
    /// the window's project.</summary>
    public void ShowProject(string display)
    {
        var name = $"Foldex {AppHost.Version().Version}";
        Text = display.Length > 0 ? $"{name} - {display}" : name;
    }

    void AddBrowser()
    {
        web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
        Controls.Add(web);
    }

    /// <summary>Brought to the front for a later launch, with its paths.</summary>
    public void Show(IReadOnlyList<string> more)
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
        if (more.Count == 0) return;
        paths = more;
        Post(new JsonObject { ["event"] = "open", ["paths"] = PathsArray(more) });
    }

    static JsonArray PathsArray(IEnumerable<string> list) => new(list.Select(p => (JsonNode?)p).ToArray());

    // The browser's data folder can still be held by a closing Foldex for a moment; WebView2 then answers "the
    // requested resource is in use" (0x800700AA). Then wait and try again; still in use after a few seconds: say so
    // and close this window (as LexPen).
    const int ResourceInUse = unchecked((int)0x800700AA);

    async Task<bool> StartBrowser()
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await web.EnsureCoreWebView2Async(await app.WebEnvironment());
                return true;
            }
            catch (COMException ex) when (ex.HResult == ResourceInUse && attempt < 10)
            {
                await Task.Delay(500);
            }
            catch (COMException ex) when (ex.HResult == ResourceInUse)
            {
                MessageBox.Show(this, "Foldex could not start its browser view: the browser data folder is still in use, " +
                    "most likely by a Foldex that is closing. Start Foldex again in a moment.", "Foldex",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
        }
    }

    // The page only once the window is on its desktop and in its project: which layout it gets depends on that.
    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        await app.WindowShown(this);
        if (!await StartPage()) Close();
    }

    async Task<bool> StartPage()
    {
        if (!await StartBrowser()) return false;
        var core = web.CoreWebView2;
        core.Settings.IsStatusBarEnabled = false;
#if !DEBUG
        // The debug build keeps the DevTools: the tests drive the page through the debugging port.
        core.Settings.AreDevToolsEnabled = false;
#endif
        core.Settings.IsZoomControlEnabled = false;
        // The browser's own keys (Ctrl+F find, Ctrl+P print, F5 reload, ...) are not Foldex's: keys.json's go to the page;
        // copy, paste and undo in a text box stay.
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        WebFiles.Serve(core);
        core.ContextMenuRequested += (_, m) => WebFiles.BrowserMenu(m);
        // Not inside a WebView2 event handler: dialogs and long work must not run there.
        // Files dropped from Explorer come along as objects that carry their path (docs/plans/02 3.6).
        core.WebMessageReceived += (_, m) =>
        {
            var json = m.WebMessageAsJson;
            var files = m.AdditionalObjects?.OfType<CoreWebView2File>().Select(f => f.Path).ToArray() ?? [];
            BeginInvoke(() => OnMessage(json, files));
        };
        core.ProcessFailed += OnProcessFailed;
        core.Navigate($"https://{WebFiles.Host}/index.html");
        return true;
    }

    // The page's process stopped responding or exited: a new page in the same browser. The browser process itself
    // exited: a new browser (and environment, shared by every window) and a new page. The host's own work goes on.
    void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        var env = web.CoreWebView2?.Environment;
        BeginInvoke(async () =>
        {
            if (IsDisposed) return;
            pageReady = false;
            if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            {
                web.CoreWebView2?.Reload();
                return;
            }
            if (e.ProcessFailedKind != CoreWebView2ProcessFailedKind.BrowserProcessExited) return;   // a helper process: the browser makes a new one
            if (env is not null) await app.DropEnvironment(env);
            Controls.Remove(web);
            web.Dispose();
            AddBrowser();
            if (!await StartPage()) Close();
        });
    }

    async void OnMessage(string json, string[] files)
    {
        if (JsonNode.Parse(json) is not JsonObject msg) return;
        var ids = msg["ids"]?.AsArray().Select(n => n!.GetValue<string>()).ToList() ?? [];
        switch (msg["op"]?.GetValue<string>())
        {
            case "ready":
                pageReady = true;
                var (version, commit) = AppHost.Version();
                Post(new JsonObject
                {
                    ["event"] = "hello",
                    ["version"] = version,
                    ["commit"] = commit,
                    ["settings"] = SettingsFile.Load(AppHost.DataDir),
                    ["themes"] = ThemeFile.Load(AppHost.DataDir),
                    ["keys"] = KeysFile.Load(AppHost.DataDir),
                    ["ribbon"] = RibbonFile.Load(AppHost.DataDir, Path.Combine(AppHost.DefaultsDir, RibbonFile.Name)),
                    ["bars"] = BarsFile.Load(AppHost.DataDir, Path.Combine(AppHost.DefaultsDir, BarsFile.Name)),
                    ["columnSets"] = AppHost.ColumnSets(),
                    ["paths"] = PathsArray(paths),
                    ["layout"] = freshLayout ? null : pageLayout?.DeepClone() ?? app.LayoutFor(this),
                    ["project"] = app.ProjectInfo(this),
                    ["ops"] = new JsonArray(app.FileOps.All.Select(o => (JsonNode)o.ToJson()).ToArray()),
                    ["searches"] = SearchesFile.Load(AppHost.DataDir),
                    ["run"] = AppHost.RunId,
                });
                foreach (var queued in queue) web.CoreWebView2.PostWebMessageAsJson(queued);
                queue.Clear();
                freshLayout = false;
                break;
            case "list":
                await List(msg["location"]!.GetValue<string>(), msg["req"]?.GetValue<int>() ?? 0,
                    msg["channel"]?.GetValue<string>() ?? "", msg["foldersOnly"]?.GetValue<bool>() == true, msg["tree"]?.GetValue<bool>() == true);
                break;
            case "listElevated":
                await ListElevated(msg["location"]!.GetValue<string>(), msg["req"]?.GetValue<int>() ?? 0,
                    msg["channel"]?.GetValue<string>() ?? "", msg["foldersOnly"]?.GetValue<bool>() == true);
                break;
            case "describe":
            {
                var described = await StaWorker.Once("describe", () => ShellListing.Describe(ids));
                Post(new JsonObject { ["event"] = "described", ["req"] = msg["req"]?.DeepClone(), ["entries"] = described });
                break;
            }
            case "execute":
                // A file opened as a double-click in Explorer opens it (plan 03 3.3).
                if (ShellMenu.ExecuteDefault(this, ids) is string failed)
                    Post(new JsonObject { ["event"] = "executeFailed", ["error"] = failed });
                break;
            case "icons":
                var wanted = msg["indexes"]!.AsArray().Select(n => n!.GetValue<int>()).ToList();
                var size = msg["size"]?.GetValue<int>() is int s && ShellIcons.Sizes.Contains(s) ? s : 16;
                var icons = await app.ShellWork.Run(() =>
                {
                    var o = new JsonObject();
                    foreach (var i in wanted) o[i.ToString()] = ShellIcons.Png(i, size);
                    return o;
                });
                Post(new JsonObject { ["event"] = "icons", ["icons"] = icons, ["size"] = size });
                break;
            case "ownIcons":
            {
                var own = await app.ShellWork.Run(() =>
                {
                    var o = new JsonObject();
                    foreach (var id in ids) o[id] = ShellIcons.OwnOf(id);
                    return o;
                });
                Post(new JsonObject { ["event"] = "ownIcons", ["icons"] = own });
                break;
            }
            case "menu":
                ShowMenu(ids, ToScreen(msg), msg["extended"]?.GetValue<bool>() == true);
                break;
            case "menuTexts":
            {
                var (menu, error) = ShellMenu.Create(ids, false);
                using (menu)
                    Post(new JsonObject
                    {
                        ["event"] = "menuTexts", ["error"] = error,
                        ["texts"] = new JsonArray((menu?.Texts() ?? []).Select(t => (JsonNode?)t).ToArray()),
                    });
                break;
            }
            case "invokeVerb":
            {
                var (menu, error) = ShellMenu.Create(ids, false);
                using (menu)
                {
                    var ok = menu?.InvokeVerb(this, msg["verb"]!.GetValue<string>()) == true;
                    Post(new JsonObject { ["event"] = "verbDone", ["ok"] = ok, ["error"] = error });
                }
                break;
            }
            case "dragOut":
            {
                var (effect, error, source) = ShellDrag.Start(this, ids);
                Post(new JsonObject { ["event"] = "dragDone", ["effect"] = effect, ["error"] = error, ["source"] = source });
                break;
            }
            case "drop" when msg["scrap"]?.GetValue<bool>() == true:
                // Onto a scrap (plan 06 3.2): nothing copied or moved, the items become its entries.
                await Entries(files, msg["req"]);
                break;
            case "drop":
                // Files from Explorer onto a folder of the page: copied there (the spike's rule; plan 03 decides more).
                Post(new JsonObject
                {
                    ["event"] = "dropped", ["count"] = files.Length,
                    ["types"] = msg["types"]?.DeepClone(), ["target"] = msg["target"]?.DeepClone(),
                });
                if (files.Length > 0 && msg["target"]?.GetValue<string>() is { } target)
                    app.FileOps.Start("copy", files, target, Handle, false);
                break;
            case "clipboard":
                // Copy and cut as Explorer puts them on the clipboard: the files, and whether a paste moves them.
                Post(new JsonObject { ["event"] = "clipboardDone", ["error"] = ShellClipboard.Put(ids, msg["kind"]!.GetValue<string>() == "cut") });
                break;
            case "entries":
                await Entries(ids, msg["req"]);
                break;
            case "scrapPaste":
                // Pasted onto a scrap (plan 06 3.5): the files on the clipboard become entries; nothing is copied.
                await Entries(ShellClipboard.Take().Files, msg["req"]);
                break;
            case "search":
                await Search(msg);
                break;
            case "thumbs":
                Thumbs(msg, ids);
                break;
            case "searchStop":
                if (searches.Remove(msg["channel"]?.GetValue<string>() ?? "", out var stopping)) stopping.Cancel();
                break;
            case "searchesSave":
                try { app.SaveSearches(msg["searches"]!); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = $"{SearchesFile.Name}: {ex.Message}" });
                }
                break;
            case "paste":
            {
                var (onClipboard, move) = ShellClipboard.Take();
                if (onClipboard.Count == 0) Post(new JsonObject { ["event"] = "clipboardDone", ["error"] = "no files on the clipboard" });
                else app.FileOps.Start(move ? "move" : "copy", onClipboard, msg["target"]!.GetValue<string>(), Handle, false);
                break;
            }
            case "setSetting":
                try { app.SetSetting(msg["name"]!.GetValue<string>(), msg["value"]?.DeepClone()); }
                catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = ex.Message });
                }
                break;
            case "layout":
                pageLayout = msg["layout"]?.DeepClone() as JsonObject;
                if (pageLayout is not null) app.SaveSession(this, pageLayout);
                break;
            case "layoutReset":
                // View > Projects > Reset layout (plan 15 3.6): the page again, on the default layout, at the folder it showed.
                pageLayout = app.DefaultLayoutOrNull();
                freshLayout = pageLayout is null;
                paths = msg["path"]?.GetValue<string>() is { } at ? [at] : [];
                pageReady = false;
                web.CoreWebView2?.Reload();
                break;
            case "drives":
                await TellDrives();
                break;
            // Columns (docs/plans/executed/11-PLAN-columns.md 3.6): the Git status of a folder's items, the properties Windows
            // has for columns (once per run), their values for items, and the column sets written.
            case "git":
            {
                var folder = msg["folder"]!.GetValue<string>();
                var status = Path.IsPathFullyQualified(folder) && Directory.Exists(folder) ? await Task.Run(() => GitStatus.Of(folder)) : null;
                Post(new JsonObject { ["event"] = "git", ["req"] = msg["req"]?.DeepClone(), ["folder"] = folder, ["status"] = status });
                break;
            }
            case "propList":
                propList ??= await StaWorker.Once("props", ShellProps.List);
                Post(new JsonObject { ["event"] = "propList", ["list"] = propList.DeepClone() });
                break;
            case "props":
            {
                var names = msg["names"]!.AsArray().Select(n => n!.GetValue<string>()).ToList();
                var values = await StaWorker.Once("props", () => ShellProps.Values(ids, names));
                Post(new JsonObject { ["event"] = "props", ["req"] = msg["req"]?.DeepClone(), ["values"] = values });
                break;
            }
            case "columnSetsSave":
            case "folderColumnsSave":
                try { app.SaveColumns(msg["op"]!.GetValue<string>() == "columnSetsSave" ? msg["mine"] : null, msg["folders"]); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "columnsFailed", ["error"] = ex.Message });
                }
                break;
            case "barsSave":
                // A bar changed in the window (plan 10 3.3): your bars.json, and every window draws the bars again.
                try { app.SaveBars(msg["bars"]!); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "barsFailed", ["error"] = ex.Message });
                }
                break;
            case "barsReset":
                try { app.SaveBars(null); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "barsFailed", ["error"] = ex.Message });
                }
                break;
            case "projects":
                Post(new JsonObject { ["event"] = "projectList", ["list"] = app.ProjectList(this) });
                break;
            case "projectCommand":
                app.ProjectCommand(this, msg["kind"]!.GetValue<string>(), msg);
                break;
            case "openProjects":
                app.OpenProjects(this);
                break;
            case "watch":
                app.Folders?.Set(this, msg["folders"]?.AsArray().Select(n => n!.GetValue<string>()) ?? []);
                break;
            case "openSettings":
                app.OpenSettings(this);
                break;
            case "copyText":
                Clipboard.SetText(msg["text"]!.GetValue<string>());
                break;
            case "fileOp":
                app.FileOps.Start(msg["kind"]!.GetValue<string>(), ids, msg["target"]?.GetValue<string>(), Handle,
                    msg["confirmed"]?.GetValue<bool>() == true);
                break;
            case "preview":
            {
                var path = msg["path"]!.GetValue<string>();
                var (handler, error) = preview.Show(path, AreaOf(msg["rect"]!));
                Post(new JsonObject { ["event"] = "previewShown", ["path"] = path, ["handler"] = handler, ["error"] = error });
                break;
            }
            case "previewMove":
                preview.Move(AreaOf(msg["rect"]!));
                break;
            case "previewSnapshot":
                Post(new JsonObject { ["event"] = "previewSnapshot", ["url"] = preview.Snapshot() });
                break;
            case "previewRestore":
                preview.Restore();
                break;
            case "previewClose":
                preview.Unload();
                break;
            case "nativeList":
                Post(await NativeListYardstick(msg["location"]!.GetValue<string>()));
                break;
        }
    }

    // The listing running per channel (a pane, a tree node); a new one on the same channel stops it.
    readonly Dictionary<string, CancellationTokenSource> listings = [];

    // On a thread of its own: a slow location never holds up the next one; what is read so far comes in batches.
    async Task List(string location, int req, string channel, bool foldersOnly, bool tree = false)
    {
        if (listings.Remove(channel, out var before)) before.Cancel();
        var cancel = listings[channel] = new CancellationTokenSource();
        var clock = System.Diagnostics.Stopwatch.StartNew();
        var r = await StaWorker.Once("listing", () => ShellListing.List(location,
            part => BeginInvoke(() => Post(new JsonObject { ["event"] = "listing", ["req"] = req, ["channel"] = channel, ["entries"] = part })),
            cancel.Token, foldersOnly, tree));
        if (listings.GetValueOrDefault(channel) == cancel) listings.Remove(channel);
        if (r.Cancelled) return;
        var name = await StaWorker.Once("name", () => ShellListing.NameOf(location));
        var answer = new JsonObject
        {
            ["event"] = "listed", ["req"] = req, ["channel"] = channel, ["location"] = location, ["name"] = name, ["kind"] = r.Kind,
            ["entries"] = r.Entries, ["error"] = r.Error, ["denied"] = r.Denied, ["enumMs"] = r.Milliseconds, ["iconMs"] = r.IconMs,
            ["target"] = r.Target,
        };
        answer["hostMs"] = clock.ElapsedMilliseconds;
        Post(answer);
    }

    // Entries for items by their parsing names (a scrap, plan 06 3.1), answered to the page's request.
    async Task Entries(IReadOnlyList<string> ids, JsonNode? req)
    {
        var list = ids.ToList();
        var entries = await StaWorker.Once("entries", () => ShellListing.Entries(list));
        Post(new JsonObject { ["event"] = "entries", ["req"] = req?.DeepClone(), ["entries"] = entries });
    }

    // Thumbnails being made per pane (its channel, docs/plans/executed/22-PLAN-thumbnails.md 3.1): in the background, in the
    // order asked (what is in view first); a new request for the pane replaces what is left of the old one. They come
    // to the page in small batches; now and then the cache is trimmed back under its size.
    readonly Dictionary<string, CancellationTokenSource> thumbing = [];
    static int thumbsMade;

    void Thumbs(JsonObject msg, List<string> ids)
    {
        var channel = msg["channel"]?.GetValue<string>() ?? "";
        if (thumbing.Remove(channel, out var before)) before.Cancel();
        if (ids.Count == 0) return;
        var cancel = thumbing[channel] = new CancellationTokenSource();
        var size = msg["size"]?.GetValue<int>() is int s && Shell.Thumbnails.Sizes.Contains(s) ? s : Shell.Thumbnails.Sizes[1];
        var inFolder = msg["place"]?.GetValue<string>() == "folder";
        var limit = (long)Math.Max(1, msg["limitMB"]?.GetValue<double>() ?? 64) * 1024 * 1024;
        _ = StaWorker.Once("thumbnails", () =>
        {
            var batch = new JsonArray();
            var since = System.Diagnostics.Stopwatch.StartNew();
            void Send()
            {
                if (batch.Count == 0) return;
                var part = batch;
                batch = [];
                BeginInvoke(() => Post(new JsonObject { ["event"] = "thumbs", ["channel"] = channel, ["size"] = size, ["items"] = part }));
                since.Restart();
            }
            foreach (var id in ids)
            {
                if (cancel.IsCancellationRequested) break;
                var t = Shell.Thumbnails.Get(id, size, AppHost.DataDir, inFolder);
                batch.Add(new JsonObject { ["id"] = id, ["url"] = t.Url, ["width"] = t.Width, ["height"] = t.Height });
                if (batch.Count >= 8 || since.ElapsedMilliseconds > 150) Send();
                if (Interlocked.Increment(ref thumbsMade) % 200 == 0 && !inFolder) Shell.Thumbnails.Trim(AppHost.DataDir, limit);
            }
            Send();
            return 0;
        });
    }

    // The search running per scrap (its channel); a new one on the same scrap or Stop ends it.
    readonly Dictionary<string, CancellationTokenSource> searches = [];

    // A search for a scrap (plan 06 3.4): what it finds in batches ("found"), then "searched" with the engine used.
    async Task Search(JsonObject msg)
    {
        var channel = msg["channel"]?.GetValue<string>() ?? "";
        if (searches.Remove(channel, out var before)) before.Cancel();
        var cancel = searches[channel] = new CancellationTokenSource();
        var options = FileSearch.Options.From(msg);
        var clock = System.Diagnostics.Stopwatch.StartNew();
        string? error = null;
        var (engine, count) = ("", 0);
        try
        {
            (engine, count) = await StaWorker.Once("search", () => FileSearch.Run(options,
                part => BeginInvoke(() => Post(new JsonObject { ["event"] = "found", ["channel"] = channel, ["entries"] = part })),
                cancel.Token));
        }
        catch (ArgumentException ex) { error = ex.Message; }
        if (searches.GetValueOrDefault(channel) == cancel) searches.Remove(channel);
        BeginInvoke(() => Post(new JsonObject
        {
            ["event"] = "searched", ["channel"] = channel, ["engine"] = engine, ["count"] = count, ["error"] = error,
            ["stopped"] = cancel.IsCancellationRequested, ["ms"] = clock.ElapsedMilliseconds,
        }));
    }

    // A folder the user cannot read, listed by the elevated helper (UAC asks); its icons are this process's own.
    async Task ListElevated(string location, int req, string channel, bool foldersOnly)
    {
        var r = await ElevatedHelper.List(location);
        if (foldersOnly && r["entries"] is JsonArray all)
            r["entries"] = new JsonArray(all.Where(e => e!["folder"]!.GetValue<bool>()).Select(e => e!.DeepClone()).ToArray());
        if (r["entries"] is JsonArray entries)
            await app.ShellWork.Run(() =>
            {
                foreach (var e in entries)
                    e!["icon"] = ShellIcons.Of(e["id"]!.GetValue<string>(), e["folder"]!.GetValue<bool>());
                return 0;
            });
        r["event"] = "listed";
        r["req"] = req;
        r["channel"] = channel;
        r["location"] = location;
        r["name"] = Path.GetFileName(location);
        r["elevated"] = true;
        Post(r);
    }

    void ShowMenu(List<string> ids, Point screen, bool extended)
    {
        var (menu, error) = ShellMenu.Create(ids, extended);
        if (menu is null)
        {
            Post(new JsonObject { ["event"] = "menuDone", ["error"] = error });
            return;
        }
        using (menu)
        {
            var verb = menu.Show(this, screen);
            Post(new JsonObject { ["event"] = "menuDone", ["verb"] = verb });
        }
    }

    // The page gives positions in its own pixels times devicePixelRatio: the browser's client pixels.
    Point ToScreen(JsonObject msg) =>
        web.PointToScreen(new Point((int)msg["x"]!.GetValue<double>(), (int)msg["y"]!.GetValue<double>()));

    Rectangle AreaOf(JsonNode rect) => new(web.Left + (int)rect["x"]!.GetValue<double>(), web.Top + (int)rect["y"]!.GetValue<double>(),
        (int)rect["width"]!.GetValue<double>(), (int)rect["height"]!.GetValue<double>());

    // The yardstick of plan 02 3.7 item 1: the same folder in a native ListView in virtual mode, timed from the start of
    // the listing to the list's first paint.
    async Task<JsonObject> NativeListYardstick(string location)
    {
        var clock = System.Diagnostics.Stopwatch.StartNew();
        var r = await app.ShellWork.Run(() => ShellListing.List(location));
        var listed = clock.ElapsedMilliseconds;
        var painted = new TaskCompletionSource<long>();
        var form = new Form { Text = "Foldex: native list (yardstick)", Width = 900, Height = 700, StartPosition = FormStartPosition.CenterParent };
        var list = new ListView { Dock = DockStyle.Fill, View = View.Details, VirtualMode = true, FullRowSelect = true };
        list.Columns.Add("Name", 400);
        list.Columns.Add("Size", 120);
        var entries = r.Entries;
        list.RetrieveVirtualItem += (_, e) =>
        {
            var x = entries[e.ItemIndex]!;
            e.Item = new ListViewItem([x["name"]!.GetValue<string>(), x["size"]?.ToString() ?? ""]);
        };
        list.VirtualListSize = entries.Count;
        form.Controls.Add(list);
        form.Shown += (_, _) => BeginInvoke(() => painted.TrySetResult(clock.ElapsedMilliseconds));
        form.Show(this);
        var shown = await painted.Task;
        return new JsonObject { ["event"] = "nativeListed", ["count"] = entries.Count, ["listedMs"] = listed, ["shownMs"] = shown };
    }

    protected override void WndProc(ref Message m)
    {
        if (ShellMenu.HandleMessage(ref m)) return;
        const int WmDeviceChange = 0x0219, DbtDeviceArrival = 0x8000, DbtDeviceRemoveComplete = 0x8004;
        if (m.Msg == WmDeviceChange && (int)m.WParam is DbtDeviceArrival or DbtDeviceRemoveComplete)
        {
            drivesSoon.Stop();
            drivesSoon.Start();
        }
        base.WndProc(ref m);
    }

    /// <summary>Tells the page; kept until it is ready.</summary>
    public void Post(JsonObject msg)
    {
        var json = msg.ToJsonString();
        if (pageReady && !IsDisposed && web.CoreWebView2 is { } core) core.PostWebMessageAsJson(json);
        else queue.Add(json);
    }

    // The page's layout as it told it last: its window's session (AppHost.SaveSession), given back to a new page after a
    // failure. freshLayout: the next page starts on the page's own default layout (a reset without defaultLayout).
    JsonObject? pageLayout;
    bool freshLayout;
}
