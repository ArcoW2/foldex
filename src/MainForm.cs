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
/// its layout is that window's session (docs/plans/executed/15-PLAN-projects.md).
/// </summary>
sealed class MainForm : Form
{
    readonly AppHost app;
    WebView2 web = null!;
    IReadOnlyList<string> paths;   // the last ones given, for a new page after a failure
    bool pageReady;
    readonly List<string> queue = [];   // told before the page was ready

    /// <summary>The page's look (look.js hostLook: colours as RGB, dark, the window font), told whenever its theme is
    /// applied; Foldex's own windows asking over this one (AskForm) take it.</summary>
    public JsonObject? Look { get; private set; }

    // Its panes floating in windows of their own (plan 14 3.2), by pane id.
    readonly Dictionary<string, PaneForm> floating = [];

    public MainForm(AppHost app, int key, IReadOnlyList<string> paths)
    {
        this.app = app;
        this.paths = paths;
        Key = key;
        Text = "Foldex";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.Manual;   // AppHost.Place
        AddBrowser();
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

    const int PictureSize = 1600;   // px, the longer side of Windows' picture of a file in the preview (chosen, not measured)

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
                AskForm.Tell(app, this, AskForm.Sign.Warning, "Foldex could not start its browser view: the browser data folder is " +
                    "still in use, most likely by a Foldex that is closing. Start Foldex again in a moment.");
                return false;
            }
        }
    }

    // The window in front (started, Alt+Tab, clicked): the keyboard to its page when the control does not have it yet,
    // so the page knows it is in front (its document focused) and the first click in it acts; without it the page took
    // the window for one in the background and stopped that click (web/app.js, the setting ignoreActivationClick).
    protected override void OnActivated(EventArgs e)
    {
        base.OnActivated(e);
        if (!web.ContainsFocus) web.Focus();
    }

    // Closed (the X, Alt+F4, the taskbar): first the page's layout as it is now, which the page sends only a moment after
    // a change (the active pane chosen just before Alt+F4 was lost); the window closes when it comes, or after half a
    // second at the most.
    bool layoutAsked, closeWhenLaidOut;
    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!layoutAsked && pageReady && e.CloseReason == CloseReason.UserClosing)
        {
            layoutAsked = closeWhenLaidOut = true;
            e.Cancel = true;
            Tell(new JsonObject { ["event"] = "flushLayout" });
            var wait = new System.Windows.Forms.Timer { Interval = 500 };
            wait.Tick += (_, _) => { wait.Dispose(); if (!IsDisposed) Close(); };
            wait.Start();
            return;
        }
        base.OnFormClosing(e);
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
        Shell.OwnPreview.Serve(core);   // the files of Foldex's own preview (before the page is loaded)
        core.ContextMenuRequested += (_, m) => WebFiles.BrowserMenu(m);
        core.PermissionRequested += (_, p) => WebFiles.ClipboardRead(p);
        // Not inside a WebView2 event handler: dialogs and long work must not run there.
        // Files dropped from Explorer come along as objects that carry their path (docs/plans/02 3.6).
        core.WebMessageReceived += (_, m) =>
        {
            var json = m.WebMessageAsJson;
            var files = m.AdditionalObjects?.OfType<CoreWebView2File>().Select(f => f.Path).ToArray() ?? [];
            BeginInvoke(() => OnMessage(json, files));
        };
        // A pane's page in a frame of the page (plan 14 3.0, stage 6): it asks the host itself, as the page does, and is
        // answered in that frame alone; the frame is known by its name, its pane's id.
        core.FrameCreated += (_, f) =>
        {
            var frame = f.Frame;
            var name = frame.Name;
            var gone = false;
            frames[name] = frame;
            frame.Destroyed += (_, _) => { gone = true; if (frames.GetValueOrDefault(name) == frame) frames.Remove(name); };
            void Reply(string answer) { if (!gone) frame.PostWebMessageAsJson(answer); }
            frame.WebMessageReceived += (_, m) =>
            {
                var json = m.WebMessageAsJson;
                var files = m.AdditionalObjects?.OfType<CoreWebView2File>().Select(x => x.Path).ToArray() ?? [];
                BeginInvoke(() => OnMessage(json, files, Reply));
            };
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

    async void OnMessage(string json, string[] files, Action<string>? reply = null)
    {
        replyTo.Value = reply;
        if (JsonNode.Parse(json) is not JsonObject msg) return;
        var ids = msg["ids"]?.AsArray().Select(n => n!.GetValue<string>()).ToList() ?? [];
        switch (msg["op"]?.GetValue<string>())
        {
            // The page's look, for Foldex's own windows over this one (AskForm).
            case "look":
                Look = msg["look"] as JsonObject is { } look ? (JsonObject)look.DeepClone() : null;
                foreach (var pane in floating.Values) pane.ApplyTheme();   // its floating panes' windows follow
                break;
            // A yes / no question of the page (askYes), in Foldex's own window, as LexPen's: never behind Windows' preview.
            case "confirm":
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["yes"] = AskForm.Confirm(app, this, msg) });
                break;
            // A pane floating in a window of its own (plan 14 3.0, 3.2): made or brought forward; a message for it; closed
            // because the page docked it back or closed it.
            case "paneFloat":
            {
                var id = msg["pane"]!.GetValue<string>();
                var state = "shown";
                if (!floating.TryGetValue(id, out var form))
                {
                    Rectangle? bounds = msg["bounds"] is JsonArray { Count: 4 } b
                        ? new Rectangle(b[0]!.GetValue<int>(), b[1]!.GetValue<int>(), b[2]!.GetValue<int>(), b[3]!.GetValue<int>()) : null;
                    Size? first = msg["size"] is JsonArray { Count: 2 } wh ? new Size(wh[0]!.GetValue<int>(), wh[1]!.GetValue<int>()) : null;
                    form = new PaneForm(app, this, id, msg["page"]!.GetValue<string>(), msg["title"]?.GetValue<string>() ?? "Pane", bounds, first: first,
                        beside: msg["beside"]?.GetValue<bool>() == true);
                    floating[id] = form;
                    form.FormClosed += (_, _) => { if (floating.GetValueOrDefault(id) == form) floating.Remove(id); };
                    form.Show(this);
                    state = "created";
                }
                else form.Activate();
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["state"] = state });
                break;
            }
            // A modal floating window (plan 14 3.7): a dialog's page in a window of its own over this one, which waits
            // for it; its answer (the page's `done`) when it closes. Its page talks to this one's meanwhile (fromPane).
            case "dialogOpen":
            {
                // A dialog's window (plan 14 3.7): modal (ShowDialog, this window waits), or not (`modal` false: owned
                // by this window, which stays usable); answered when it closes.
                var id = msg["pane"]!.GetValue<string>();
                var modal = msg["modal"]?.GetValue<bool>() != false;
                var form = new PaneForm(app, this, id, msg["page"]!.GetValue<string>(), msg["title"]?.GetValue<string>() ?? "Foldex", null, dialog: true, modal: modal);
                floating[id] = form;
                var req = msg["req"]?.DeepClone();
                // Opened by a pane's page (plan 14 stage 6): its messages and its answer go there.
                var asker = replyTo.Value;
                if (asker is not null) form.TellPage = m => asker(m.ToJsonString());
                void Answer()
                {
                    floating.Remove(id);
                    var answer = new JsonObject { ["event"] = "answer", ["req"] = req, ["value"] = form.Result?.DeepClone() };
                    if (IsDisposed) return;
                    if (asker is not null) asker(answer.ToJsonString());
                    else Tell(answer);
                }
                if (modal)
                {
                    form.ShowDialog(this);
                    Answer();
                    form.Dispose();
                }
                else
                {
                    form.FormClosed += (_, _) => Answer();
                    form.Show();
                }
                break;
            }
            case "about":
            {
                // What the About window shows (as LexPen's): this build and what it runs on.
                var (aboutVersion, aboutCommit) = AppHost.Version();
                var os = Environment.OSVersion.Version;
                Post(new JsonObject
                {
                    ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(),
                    ["version"] = aboutVersion, ["commit"] = aboutCommit,
                    ["built"] = System.Reflection.CustomAttributeExtensions.GetCustomAttributes<System.Reflection.AssemblyMetadataAttribute>(typeof(MainForm).Assembly).FirstOrDefault(a => a.Key == "BuildTime")?.Value,
                    ["os"] = $"Windows {(os.Build >= 22000 ? 11 : 10)} (build {os.Build}), {System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture}",
                    ["dotnet"] = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                    ["webView2"] = web.CoreWebView2.Environment.BrowserVersionString,
                    ["webView2Sdk"] = typeof(Microsoft.Web.WebView2.Core.CoreWebView2).Assembly.GetName().Version!.ToString(),
                });
                break;
            }
            case "paneSend":
                if (floating.TryGetValue(msg["pane"]!.GetValue<string>(), out var toPane)) toPane.Send(msg["msg"]!);
                break;
            case "paneDock":
                if (floating.Remove(msg["pane"]!.GetValue<string>(), out var docked)) docked.CloseByPage();
                break;
            case "choose":
                // A question with the page's own buttons (docs/plans/executed/27-PLAN-bookmark-folders.md 3.6): the value of the
                // one chosen, null for Cancel.
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["choice"] = AskForm.Choose(app, this, msg) });
                break;
            case "ready":
                pageReady = true;
                var hello = Hello();
                hello["paths"] = PathsArray(paths);
                hello["layout"] = freshLayout ? null : pageLayout?.DeepClone() ?? app.LayoutFor(this);
                Post(hello);
                // In front already (the start): the keyboard to the page now that it is there, which gives it to the
                // pane that was active (web/app.js); given when the window came to the front, the page was not ready.
                if (InFront() && !web.ContainsFocus) web.Focus();
                foreach (var queued in queue) web.CoreWebView2.PostWebMessageAsJson(queued);
                queue.Clear();
                freshLayout = false;
                break;
            case "list":
                // F5: from disk again, not from the cache; a share found down is tried again at once.
                if (msg["fresh"]?.GetValue<bool>() == true)
                {
                    app.Cache.Invalidate(msg["location"]!.GetValue<string>());
                    Shell.NetworkGuard.Forget(msg["location"]!.GetValue<string>());
                    app.Sizes.Forget(msg["location"]!.GetValue<string>());   // its folder sizes too (plan 37 3.6)
                }
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
                // A file opened as a double-click in Explorer opens it (plan 03 3.3); a share checked first (plan 24 3.8).
                if (!await NetworkGuard.Reachable(ids))
                {
                    Post(new JsonObject { ["event"] = "executeFailed", ["error"] = "the network location is not reachable" });
                    break;
                }
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
                // Windows' menu is made on this thread: a share checked first (plan 24 3.8).
                if (!await NetworkGuard.Reachable(ids))
                {
                    Post(new JsonObject { ["event"] = "menuDone", ["error"] = "the network location is not reachable" });
                    break;
                }
                ShowMenu(ids, ToScreen(msg), msg["extended"]?.GetValue<bool>() == true, msg["own"]?.GetValue<bool>() == true, msg["item"]?.GetValue<bool>() == true,
                    msg["bookmark"]?.GetValue<string>());
                break;
            case "menuTexts":
            {
                var (menu, error) = ShellMenu.Create(ids, false);
                if (menu is not null && msg["own"]?.GetValue<bool>() == true && ids.Count == 1) menu.AddOwn(OwnMenu(ids[0], msg["item"]?.GetValue<bool>() == true, msg["bookmark"]?.GetValue<string>()).Select(o => o.Text).ToList());
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
            case "drop" when msg["quickAccessAt"] is not null:
            {
                // Onto the Quick access area (plan 23 3.5; plan 26 3.2): the folders dropped put in where they were
                // dropped, in their order (a bookmark of the menu gets the flag); files left out. Whether each is a
                // folder is asked off this thread (a share may not answer).
                var place = msg["quickAccessAt"]!.GetValue<int>();
                var folders = await Task.Run(() => files.Where(f => Directory.Exists(f)).ToList());
                // Into a quick access folder (plan 27 3.3): among what it holds.
                var group = msg["quickAccessIn"]?.GetValue<string>();
                foreach (var f in folders) app.AddToQuickAccess(f, false, place++, group);
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
            case "renameMany":
                // The Rename dialog (plan 21 3.4): every item to its new name, as one operation.
                app.FileOps.StartRenames(msg["renames"]!.AsArray().Select(r => (r![0]!.GetValue<string>(), r[1]!.GetValue<string>())).ToList(), Handle);
                break;
            // The bookmarks, quick access among them (plan 26 3.1): added, taken off, set whole (Manage, Edit, a flag
            // switched); whether each is there (asked off this thread, each with a time limit: a share that does not
            // answer counts as there); one checked before it opens (3.12); the folder and file pickers; a file's icons.
            case "bookmarkAdd":
                app.AddBookmark(msg["location"]!.GetValue<string>(), msg["item"]?.GetValue<bool>() == true, msg["quickAccess"]?.GetValue<bool>() == true);
                break;
            case "bookmarkRemove":
                app.RemoveBookmark(msg["id"]!.GetValue<string>());
                break;
            case "bookmarksSet":
                app.SetBookmarks(msg["bookmarks"]!.AsArray().Select(Bookmark.From).OfType<Bookmark>());
                break;
            case "bookmarkCheck":
            {
                var location = Bookmarks.Resolve(msg["location"]!.GetValue<string>());
                var item = msg["item"]?.GetValue<bool>() == true;
                var answer = new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["state"] = "there" };
                if (IsDiskPath(location))
                {
                    var folder = item ? Path.GetDirectoryName(location.TrimEnd('\\')) ?? location : location;
                    if (!await NetworkGuard.Reachable(folder)) answer["state"] = "unreachable";
                    else
                    {
                        var (folderThere, itemThere, isFile) = await Task.Run(() => (Directory.Exists(folder), !item || File.Exists(location) || Directory.Exists(location), File.Exists(location)));
                        answer["state"] = folderThere || isFile ? "there" : "gone";
                        answer["itemThere"] = itemThere;
                        answer["isFile"] = isFile;
                    }
                    answer["server"] = NetworkGuard.IsNetwork(folder) ? NetworkGuard.Server(folder) : null;
                }
                Post(answer);
                break;
            }
            case "pickFile":
            {
                using var d = new OpenFileDialog { Filter = msg["filter"]?.GetValue<string>() ?? "All files|*.*", CheckFileExists = true };
                if (msg["at"]?.GetValue<string>() is { Length: > 0 } start && Environment.ExpandEnvironmentVariables(start) is var full && File.Exists(full))
                {
                    d.InitialDirectory = Path.GetDirectoryName(full);
                    d.FileName = Path.GetFileName(full);
                }
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["file"] = d.ShowDialog(this) == DialogResult.OK ? d.FileName : null });
                break;
            }
            case "iconFile":
            {
                // Change Icon (3.5): every icon of a file; or (index given) one, for a bookmark drawn with it.
                var file = msg["file"]!.GetValue<string>();
                var one = msg["index"]?.GetValue<int>();
                var pictures = await Task.Run(() => one is int k ? [ShellIcons.FromFile(file, k)] : ShellIcons.AllFromFile(file));
                Post(new JsonObject
                {
                    ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(),
                    ["icons"] = new JsonArray(pictures.Select(p => (JsonNode?)p).ToArray()),
                });
                break;
            }
            case "cacheInfo":   // what the folder cache holds (plan 24; the tests ask)
            {
                var info = app.CacheInfo();
                if (msg["measure"]?.GetValue<bool>() == true)
                {
                    var (before, after, items) = await Task.Run(app.Cache.Measure);
                    info["measured"] = new JsonObject { ["before"] = before, ["after"] = after, ["items"] = items };
                }
                info["event"] = "answer";
                info["req"] = msg["req"]?.DeepClone();
                Post(info);
                break;
            }
            case "bookmarksExist":
            {
                var all = Bookmarks.All(app.BookmarkList).Where(b => !b.IsGroup).ToList();
                var exists = new JsonObject();
                await Task.WhenAll(all.Select(async b =>
                {
                    var path = Bookmarks.Resolve(b.Location);
                    var check = Task.Run(() => !IsDiskPath(path) || (b.Item ? File.Exists(path) || Directory.Exists(path) : Directory.Exists(path)));
                    exists[b.Location] = await Task.WhenAny(check, Task.Delay(1500)) == check ? check.Result : true;
                }));
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["exists"] = exists });
                break;
            }
            case "pickFolder":
            {
                using var d = new FolderBrowserDialog();
                if (msg["at"]?.GetValue<string>() is { Length: > 0 } start) d.SelectedPath = Bookmarks.Resolve(start);
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["folder"] = d.ShowDialog(this) == DialogResult.OK ? d.SelectedPath : null });
                break;
            }
            case "renamesSave":
                try { app.SaveRenames(msg["renames"]!); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = $"{RenamesFile.Name}: {ex.Message}" });
                }
                break;
            case "searchesSave":
                try { app.SaveSearches(msg["searches"]!); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = $"{SearchesFile.Name}: {ex.Message}" });
                }
                break;
            case "filtersSave":
                // The kept filter sets changed (plan 32 3.4): filters.json, and every window gets them again.
                try { app.SaveFilters(msg["filters"]!); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = $"{FiltersFile.Name}: {ex.Message}" });
                }
                break;
            case "macroHelp":
            {
                // The guide to the macro language (plan 34 3.9): shipped with the defaults, opened as Windows opens a .md.
                var guide = Path.Combine(AppHost.DefaultsDir, MacrosFile.Folder, "README.md");
                try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(guide) { UseShellExecute = true }); }
                catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or FileNotFoundException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = $"The macros' guide ({guide}): {ex.Message}" });
                }
                break;
            }
            case "macrosSave":
                // The macros changed (plan 34 3.5): macros\macros.json, and every window gets them again.
                try { app.SaveMacros(msg["macros"]); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "settingFailed", ["error"] = $"{MacrosFile.Name}: {ex.Message}" });
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
                if (closeWhenLaidOut && msg["flushed"]?.GetValue<bool>() == true) { closeWhenLaidOut = false; BeginInvoke(Close); }
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
            case "freeSpace":
            {
                // The status line's free space (the drive or share of the active pane's folder); a share that is down: none.
                var folder = msg["folder"]?.GetValue<string>() ?? "";
                var space = Path.IsPathFullyQualified(folder) && await NetworkGuard.Reachable(folder)
                    ? await Task.Run(() => Drives.Space(folder)) : null;
                Post(new JsonObject
                {
                    ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(),
                    ["value"] = space is { } got ? new JsonObject { ["free"] = got.Free, ["total"] = got.Total } : null,
                });
                break;
            }
            // Columns (docs/plans/executed/11-PLAN-columns.md 3.6): the Git status of a folder's items, the properties Windows
            // has for columns (once per run), their values for items, and the column sets written.
            case "netLogon":
            {
                // Windows' log-on prompt for a machine or share that refused you (Shell/NetLogon.cs), off this thread.
                var path = msg["path"]!.GetValue<string>();
                var owner = Handle;
                var ok = await Task.Run(() => NetLogon.LogOn(owner, path));
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["ok"] = ok });
                break;
            }
            case "macroRun":
            {
                // A macro's run (plan 34 3.3): started here; the answer once it ended when it waits.
                var answer = await MacroRun.Run(MacroRun.Request.Of(msg));
                answer["event"] = "answer";
                answer["req"] = msg["req"]?.DeepClone();
                Post(answer);
                break;
            }
            case "changedEntries":
            {
                // The items of a cached folder that changed (FolderCache.Entries), for a pane to put in where they are.
                var location = msg["location"]!.GetValue<string>();
                var told = msg["ids"]!.AsArray().Select(n => n!.GetValue<string>()).ToList();
                bool foldersOnly = msg["foldersOnly"]?.GetValue<bool>() == true, tree = msg["tree"]?.GetValue<bool>() == true;
                var entries = await StaWorker.Once("listing", () => Shell.PlaceCache.Handles(location)
                    ? app.Places.Entries(location, told, foldersOnly, tree)
                    : app.Cache.Entries(location, [.. told.Select(Path.GetFileName).OfType<string>()], foldersOnly, tree));
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["whole"] = entries is null, ["entries"] = entries });
                break;
            }
            case "filterResults":
            case "filterHolds":
            {
                // A pane's filter worked out here (plan 36 3.4, 3.7): what is known now, waited for a moment when it is
                // not done; the page asks again until it is. A share that is down: nothing (it is not touched).
                var r = new Shell.FilterJobs.Request(msg["location"]!.GetValue<string>(), msg["key"]?.GetValue<string>(),
                    msg["filter"]!.GetValue<string>(), msg["run"]?.GetValue<string>() ?? "", msg["set"]!.DeepClone(),
                    msg["kinds"] as JsonObject is { } kinds ? (JsonObject)kinds.DeepClone() : [],
                    msg["props"] is JsonArray props ? [.. props.Select(p => p!.GetValue<string>())] : [],
                    msg["git"]?.GetValue<bool>() == true, msg["now"]?.GetValue<long>() ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    msg["from"]?.GetValue<int>() ?? 0, (msg["startKB"]?.GetValue<long>() ?? 0) * 1024);
                var reachable = Path.IsPathFullyQualified(r.Location) && await NetworkGuard.Reachable(r.Location);
                var (results, done, next) = !reachable ? ([], true, 0)
                    : msg["op"]!.GetValue<string>() == "filterHolds" ? await app.Filters.Holds(r, TimeSpan.FromMilliseconds(400))
                    : await app.Filters.Results(r, TimeSpan.FromMilliseconds(400));
                Post(new JsonObject { ["event"] = msg["op"]!.GetValue<string>(), ["req"] = msg["req"]?.DeepClone(), ["location"] = r.Location, ["results"] = results, ["done"] = done, ["next"] = next });
                break;
            }
            case "filterForget":
                app.Filters.Forget(msg["filter"]!.GetValue<string>());
                break;
            // Folder sizes (docs/plans/executed/37-PLAN-folder-sizes.md): folders to count (Ctrl+D, or the setting: `auto`), told as
            // each is done (AppHost); the sizes known of folders shown, and which of them wait to be counted.
            case "sizeFolders":
                app.Sizes.Count(msg["folders"]!.AsArray().Select(n => n!.GetValue<string>()).ToList(), msg["auto"]?.GetValue<bool>() == true);
                break;
            case "folderSizes":
            {
                var (sizes, counting) = app.Sizes.Known(msg["folders"]!.AsArray().Select(n => n!.GetValue<string>()).ToList());
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["sizes"] = sizes, ["counting"] = counting });
                break;
            }
            case "git":
            {
                var folder = msg["folder"]!.GetValue<string>();
                // Off this thread, a share checked first (plan 24 3.8).
                var status = Path.IsPathFullyQualified(folder) && await NetworkGuard.Reachable(folder)
                    ? await Task.Run(() => Directory.Exists(folder) ? GitStatus.Of(folder) : null) : null;
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
                try { app.SaveColumns(msg["op"]!.GetValue<string>() == "columnSetsSave" ? msg["mine"] : null, msg["folders"], msg["order"]); }
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
            case "ribbonSave":
            case "ribbonReset":
                // The ribbon changed in the window (plan 19 3.5): your ribbon.json, and every window gets it again.
                try { app.SaveRibbon(msg["op"]!.GetValue<string>() == "ribbonSave" ? msg["ribbon"] : null); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    Post(new JsonObject { ["event"] = "ribbonFailed", ["error"] = ex.Message });
                }
                break;
            case "projects":
                Post(new JsonObject { ["event"] = "projectList", ["list"] = app.ProjectList(this) });
                break;
            case "projectCommand":
                app.ProjectCommand(this, msg["kind"]!.GetValue<string>(), msg);
                break;
            // What a Settings or Manage projects pane of this window asks of the host (PaneHosts; plan 14 3.7): the
            // answers back to that pane through this window's page.
            case "paneHost":
            {
                var pane = msg["pane"]!.GetValue<string>();
                void Reply(JsonObject answer) { if (!IsDisposed) Post(new JsonObject { ["event"] = "paneHost", ["pane"] = pane, ["msg"] = answer }); }
                var asked = (JsonObject)msg["msg"]!.DeepClone();
                if (msg["page"]?.GetValue<string>() == "settings") PaneHosts.Settings(app, this, asked, Reply);
                else PaneHosts.Projects(app, this, asked, Reply);
                break;
            }
            case "watch":
                var shown = msg["folders"]?.AsArray().Select(n => n!.GetValue<string>()).ToList() ?? [];
                // The cache watches the folders on disk and on shares and tells of their changes itself (plan 24 3.4);
                // the others (shell places that are no path) are watched here as before.
                app.Folders?.Set(this, shown.Where(f => !app.Cache.Caches(f)));
                app.Cache.Shown(this, shown);   // never let go of while shown (plan 24 3.5)
                break;
            case "copyText":
                Clipboard.SetText(msg["text"]!.GetValue<string>());
                break;
            case "fileOp":
                app.FileOps.Start(msg["kind"]!.GetValue<string>(), ids, msg["target"]?.GetValue<string>(), Handle,
                    msg["confirmed"]?.GetValue<bool>() == true, msg["name"]?.GetValue<string>());
                break;
            case "preview":
            {
                var path = msg["path"]!.GetValue<string>();
                var pane = msg["pane"]?.GetValue<string>() ?? "";
                // The order (docs/plans/executed/04-PLAN-preview.md 3.1): Foldex's own viewer for a type it knows (unless
                // previewWindowsTypes names it and Windows has a handler), else Windows' preview handler, else text when
                // the file looks like text, the picture Windows makes of it (its thumbnail handler: a PSD, ...), hex,
                // and the properties last. A folder: its summary. `all`: Show all (the whole text); `download`: a cloud
                // placeholder read all the same.
                var textBytes = msg["all"]?.GetValue<bool>() == true ? Shell.OwnPreview.AllBytes
                    : Math.Max(1, msg["textKB"]?.GetValue<int>() ?? Shell.OwnPreview.TextBytes / 1024) * 1024;
                var download = msg["download"]?.GetValue<bool>() == true;
                var types = msg["windowsTypes"]?.GetValue<string>();
                string? handler = null, error = "no preview";
                JsonObject? own = null;
                static JsonObject? Safely(Func<JsonObject?> read)
                {
                    try { return read(); }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
                }
                var reachable = await NetworkGuard.Reachable(path);
                if (Directory.Exists(path))
                {
                    PreviewOf(pane).Unload();
                    if (reachable) own = await Task.Run(() => Shell.OwnPreview.Folder(path));
                }
                else if (Shell.OwnPreview.KindOf(path) is not null
                    && !(Shell.OwnPreview.WindowsFirst(path, types) && Shell.PreviewHost.HandlerFor(path) is not null))
                {
                    PreviewOf(pane).Unload();
                    if (reachable) own = await Task.Run(() => Safely(() => Shell.OwnPreview.Read(path, textBytes, download)));
                }
                else
                {
                    (handler, error) = PreviewOf(pane).Show(path, PreviewArea(pane, msg["rect"]));
                    if (error is not null && reachable && File.Exists(path))
                    {
                        own = await Task.Run(() => Safely(() => Shell.OwnPreview.Read(path, textBytes, download, hex: false)));
                        if (own is null && !Shell.OwnPreview.Placeholder(path)
                            && await StaWorker.Once("previewPicture", () => Shell.Thumbnails.Picture(path, PictureSize)) is string picture)
                            own = new JsonObject { ["kind"] = "image", ["url"] = picture };
                        own ??= await Task.Run(() => Safely(() => Shell.OwnPreview.Read(path, textBytes, download)));
                    }
                }
                if (own is null && error is not null && reachable && File.Exists(path)) own = await Task.Run(() => Safely(() => Shell.OwnPreview.Properties(path)));
                if (own is not null) own["lexPen"] = LexPenExe() is not null;   // the bar's Open in LexPen only when it is installed
                Post(new JsonObject { ["event"] = "previewShown", ["pane"] = pane, ["path"] = path, ["handler"] = handler, ["error"] = error, ["own"] = own });
                break;
            }
            case "previewPicture":
            {
                // A video the page cannot play: Windows' picture of it, for the preview (off this thread).
                var path = msg["path"]!.GetValue<string>();
                var url = await NetworkGuard.Reachable(path) ? await StaWorker.Once("previewPicture", () => Shell.Thumbnails.Picture(path, PictureSize)) : null;
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["url"] = url });
                break;
            }
            case "fileInfo":
            {
                // Everything Windows knows of an item, for the Info pane (Shell/FileDetails.cs), off this thread.
                var path = msg["path"]!.GetValue<string>();
                var counted = app.Sizes.Of(path);   // a folder's size when counted (plan 37)
                var groups = await NetworkGuard.Reachable(path) ? await StaWorker.Once("fileInfo", () => Shell.FileDetails.Groups(path, counted)) : null;
                Post(new JsonObject { ["event"] = "answer", ["req"] = msg["req"]?.DeepClone(), ["groups"] = groups,
                    ["error"] = groups is null ? $"{NetworkGuard.Server(path)} is not reachable" : null });
                break;
            }
            case "previewMove":
            {
                var pane = msg["pane"]?.GetValue<string>() ?? "";
                PreviewOf(pane).Move(PreviewArea(pane, msg["rect"]));
                break;
            }
            // The docked previews of this window as pictures while a dialog or menu of the page lies over them, and
            // back after (the page's previewCoverCheck).
            case "previewSnapshot":
                foreach (var (pane, host) in previews)
                    if (host.Visible) Post(new JsonObject { ["event"] = "previewSnapshot", ["pane"] = pane, ["url"] = host.Snapshot() });
                break;
            case "previewRestore":
                foreach (var host in previews.Values) host.Restore();
                break;
            // The preview's Open in LexPen (plan 04 3.4): LexPen started with the file, as a later launch of it would
            // (LexPen hands it to its running window); found by its registration (Applications\LexPen.exe).
            case "openLexPen":
            {
                var path = msg["path"]!.GetValue<string>();
                if (LexPenExe() is not string exe)
                {
                    Post(new JsonObject { ["event"] = "executeFailed", ["error"] = "LexPen is not installed (no Applications\\LexPen.exe in the registry)" });
                    break;
                }
                try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(exe) { ArgumentList = { path }, UseShellExecute = false }); }
                catch (System.ComponentModel.Win32Exception ex) { Post(new JsonObject { ["event"] = "executeFailed", ["error"] = ex.Message }); }
                break;
            }
            case "previewClose":
            {
                var pane = msg["pane"]?.GetValue<string>() ?? "";
                if (floating.TryGetValue(pane, out var f)) f.Preview.Unload();
                else if (previews.TryGetValue(pane, out var host)) host.Unload();
                break;
            }
            case "nativeList":
                Post(await NativeListYardstick(msg["location"]!.GetValue<string>()));
                break;
        }
    }

    // The listing running per channel (a pane, a tree node); a new one on the same channel stops it.
    readonly Dictionary<string, CancellationTokenSource> listings = [];

    // On a thread of its own: a slow location never holds up the next one; what is read so far comes in batches.
    // A listing from the folder cache or the place cache (Network and its machines), alike.
    delegate ShellListing.Result ListFn(string location, Action<JsonArray>? batch, CancellationToken cancel, bool foldersOnly, bool tree,
        Action<int, bool>? count);

    async Task List(string location, int req, string channel, bool foldersOnly, bool tree = false)
    {
        if (listings.Remove(channel, out var before)) before.Cancel();
        var cancel = listings[channel] = new CancellationTokenSource();
        var clock = System.Diagnostics.Stopwatch.StartNew();
        // The count of what is read, for the page's progress bar (the cache's bare read has it: one per folder).
        void Count(int count, bool cached)
        {
            if (!cancel.IsCancellationRequested)
                BeginInvoke(() => Post(new JsonObject { ["event"] = "listCount", ["req"] = req, ["channel"] = channel, ["count"] = count, ["cached"] = cached }));
        }
        // A share is checked first, off this thread with a time limit (plan 24 3.8); when it does not answer, what the
        // cache has of the folder, marked as not current, or at once that it is not reachable.
        if (NetworkGuard.IsNetwork(location) && !await NetworkGuard.Reachable(location))
        {
            if (listings.GetValueOrDefault(channel) == cancel) listings.Remove(channel);
            if (cancel.IsCancellationRequested) return;
            var since = NetworkGuard.DownSince(location)?.ToLocalTime().ToString("HH:mm:ss");
            var cached = Shell.PlaceCache.Handles(location) ? app.Places.Cached(location, foldersOnly, tree) : app.Cache.Cached(location, foldersOnly, tree);
            Post(new JsonObject
            {
                ["event"] = "listed", ["req"] = req, ["channel"] = channel, ["location"] = location,
                ["name"] = Path.GetFileName(location.TrimEnd('\\')) is { Length: > 0 } last ? last : location, ["kind"] = "disk",
                ["entries"] = cached?.Entries ?? [], ["offline"] = $"{NetworkGuard.Server(location)} is not reachable (since {since})",
                ["error"] = cached is null ? $"{NetworkGuard.Server(location)} is not reachable (since {since}); nothing of it is cached" : null,
            });
            return;
        }
        // A folder opened in a pane: noted for read-ahead (plan 24 3.6).
        if (!tree && Path.IsPathFullyQualified(location)) app.Use.Opened(location);
        // Not cached (a share, when shares are not cached): counted beside the listing, names only.
        if (Path.IsPathFullyQualified(location) && !app.Cache.Caches(location))
            _ = Task.Run(() =>
            {
                try
                {
                    var options = new EnumerationOptions { IgnoreInaccessible = true, AttributesToSkip = 0 };
                    Count(foldersOnly ? Directory.EnumerateDirectories(location, "*", options).Count()
                        : Directory.EnumerateFileSystemEntries(location, "*", options).Count(), false);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { }
            });
        var r = await StaWorker.Once("listing", () => (Shell.PlaceCache.Handles(location) ? (ListFn)app.Places.List : app.Cache.List)(location,
            part => BeginInvoke(() => Post(new JsonObject { ["event"] = "listing", ["req"] = req, ["channel"] = channel, ["entries"] = part })),
            cancel.Token, foldersOnly, tree, Count));
        if (listings.GetValueOrDefault(channel) == cancel) listings.Remove(channel);
        app.StartReadAhead();
        if (r.Cancelled) return;
        // A network path that answered: its machine and share are known on Network from now on (every tree shows them).
        if (r.Error is null && !r.Denied && NetworkGuard.IsNetwork(location) && location.StartsWith(@"\\"))
            _ = StaWorker.Once("found", () => { app.Places.Found(location); return true; });
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

    void ShowMenu(List<string> ids, Point screen, bool extended, bool own, bool item, string? bookmark)
    {
        var (menu, error) = ShellMenu.Create(ids, extended);
        if (menu is null)
        {
            Post(new JsonObject { ["event"] = "menuDone", ["error"] = error });
            return;
        }
        using (menu)
        {
            // One folder or file: Foldex's own items at the top (plan 23 3.2; plan 26 3.0), quick access and bookmarks.
            var mine = own && ids.Count == 1 ? OwnMenu(ids[0], item, bookmark) : [];
            if (mine.Count > 0) menu.AddOwn(mine.Select(o => o.Text).ToList());
            var verb = menu.Show(this, screen, out var chosen);
            if (chosen is { } k) mine[k].Run();
            Post(new JsonObject { ["event"] = "menuDone", ["verb"] = verb });
        }
    }

    // Foldex's own items in Windows' menu for one folder or file (plan 26 3.0, 3.8), per tab: Add to quick access, or
    // Remove from quick access when it is there; the same for the bookmarks. On a quick access shortcut (`bookmark`,
    // its entry's id): its Remove takes off only that one, and Edit... edits it.
    List<(string Text, Action Run)> OwnMenu(string location, bool item, string? bookmark)
    {
        var shortcut = bookmark is null ? null : Bookmarks.All(app.BookmarkList).FirstOrDefault(b => b.Id == bookmark && !b.IsGroup);
        (string, Action) Tab(bool quick)
        {
            var name = quick ? "quick access" : "bookmarks";
            if (shortcut is not null && shortcut.QuickAccess == quick) return ($"Remove from {name}", () => app.RemoveBookmark(shortcut.Id));
            return Bookmarks.All(app.BookmarkList).Any(b => !b.IsGroup && b.QuickAccess == quick && Bookmarks.Same(b.Location, location))
                ? ($"Remove from {name}", () => app.RemoveBookmarks(location, quick))
                : ($"Add to {name}", () => app.AddBookmark(location, item, quick));
        }
        List<(string, Action)> items = [Tab(true), Tab(false)];
        if (shortcut is not null) items.Add(("Edit...", () => Post(new JsonObject { ["event"] = "bookmarkEdit", ["id"] = shortcut.Id })));
        return items;
    }

    // A path on disk or a share (not a shell place).
    static bool IsDiskPath(string path) => path.Length >= 3 && (path[1] == ':' && path[2] == '\\' || path.StartsWith(@"\\"));

    // What a page gets first: the settings, the keys, the bars, ... (the window's page also its paths and layout).
    JsonObject Hello()
    {
        var (version, commit) = AppHost.Version();
        return new JsonObject
        {
            ["event"] = "hello",
            ["version"] = version,
            ["commit"] = commit,
            ["doubleClickTime"] = SystemInformation.DoubleClickTime,
            ["inFront"] = InFront(),
            ["settings"] = SettingsFile.Load(AppHost.DataDir),
            ["themes"] = ThemeFile.Load(AppHost.DataDir),
            ["keys"] = KeysFile.Load(AppHost.DataDir),
            ["ribbon"] = RibbonFile.Load(AppHost.DataDir, Path.Combine(AppHost.DefaultsDir, RibbonFile.Name)),
            ["bars"] = BarsFile.Load(AppHost.DataDir, Path.Combine(AppHost.DefaultsDir, BarsFile.Name)),
            ["columnSets"] = AppHost.ColumnSets(),
            ["project"] = app.ProjectInfo(this),
            ["ops"] = new JsonArray(app.FileOps.All.Select(o => (JsonNode)o.ToJson()).ToArray()),
            ["searches"] = SearchesFile.Load(AppHost.DataDir),
            ["filters"] = FiltersFile.Load(AppHost.DataDir),
            ["macros"] = MacrosFile.Load(AppHost.DataDir),
            ["renames"] = RenamesFile.Load(AppHost.DataDir),
            ["bookmarks"] = app.BookmarksJson(),
            ["run"] = AppHost.RunId,
        };
    }

    // The page gives positions in its own pixels times devicePixelRatio: the browser's client pixels; a pane's page
    // (plan 14 stage 6) gives them on the screen (`screen`), as it does not know where its frame or window is.
    Point ToScreen(JsonObject msg)
    {
        var at = new Point((int)msg["x"]!.GetValue<double>(), (int)msg["y"]!.GetValue<double>());
        return msg["screen"]?.GetValue<bool>() == true ? at : web.PointToScreen(at);
    }

    // Windows' preview of a preview pane (plan 04; plan 14 3.5): docked, a native window of its own over the pane's area
    // in this window; floating, its window's (PaneForm.Preview), over the whole window.
    readonly Dictionary<string, PreviewHost> previews = [];
    readonly Dictionary<string, CoreWebView2Frame> frames = [];   // the panes' frames by pane id (FrameCreated)
    // LexPen.exe as its registration names it (Applications\LexPen.exe), or null when it is not installed.
    static string? LexPenExe()
    {
        var command = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey(@"Applications\LexPen.exe\shell\open\command")?.GetValue("") as string;
        var exe = command is null ? null : command.StartsWith('"') ? command[1..Math.Max(1, command.IndexOf('"', 1))] : command.Split(' ')[0];
        return exe is not null && File.Exists(exe) ? exe : null;
    }

    PreviewHost PreviewOf(string pane)
    {
        if (floating.TryGetValue(pane, out var f)) return f.Preview;
        if (!previews.TryGetValue(pane, out var host)) previews[pane] = host = new PreviewHost(this);
        return host;
    }
    Rectangle PreviewArea(string pane, JsonNode? rect) =>
        floating.TryGetValue(pane, out var f) ? f.ClientRectangle : rect is null ? Rectangle.Empty : AreaOf(rect);

    /// <summary>A point of the screen as a point of this window's page (CSS px; outside it when outside the page).</summary>
    public (double X, double Y) PagePoint(Point screen)
    {
        var at = web.PointToClient(screen);
        var scale = DeviceDpi / 96.0;
        return (Math.Round(at.X / scale, 1), Math.Round(at.Y / scale, 1));
    }

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
        // In front or not (WM_ACTIVATE), told to the page, which decides by it whether a press only brings the window back
        // (web/app.js, the setting ignoreActivationClick): how (a click, or the keys / the start), and whether the window
        // it went to or came from is one of Foldex's own (a floating pane, a dialog's window): then it was not away.
        const int WmActivate = 0x0006;
        if (m.Msg == WmActivate)
        {
            var state = m.WParam.ToInt64() & 0xFFFF;
            Tell(new JsonObject { ["event"] = "windowActive", ["active"] = state != 0, ["click"] = state == 2, ["own"] = OwnWindow(m.LParam) });
        }
        const int WmDeviceChange = 0x0219, DbtDeviceArrival = 0x8000, DbtDeviceRemoveComplete = 0x8004;
        if (m.Msg == WmDeviceChange && (int)m.WParam is DbtDeviceArrival or DbtDeviceRemoveComplete)
        {
            drivesSoon.Stop();
            drivesSoon.Start();
        }
        base.WndProc(ref m);
    }

    /// <summary>Whether a window is one of Foldex's own (this process: another Foldex window, a floating pane, a
    /// dialog's window); none (zero): not.</summary>
    static bool OwnWindow(IntPtr hwnd) =>
        hwnd != IntPtr.Zero && GetWindowThreadProcessId(hwnd, out var pid) != 0 && pid == (uint)Environment.ProcessId;

    /// <summary>Whether this window is the one in front now (its page's start: not away).</summary>
    bool InFront() => GetForegroundWindow() == Handle;

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    /// <summary>Tells the page; kept until it is ready.</summary>
    public void Tell(JsonObject msg)
    {
        var json = msg.ToJsonString();
        if (pageReady && !IsDisposed && web.CoreWebView2 is { } core) core.PostWebMessageAsJson(json);
        else queue.Add(json);
    }

    // An answer, or what streams from a request (a listing, its icons): to the page that asked (replyTo), else this
    // window's page. What is told to every window (AppHost) goes through Tell, to the window's page.
    void Post(JsonObject msg)
    {
        if (replyTo.Value is { } reply) reply(msg.ToJsonString());
        else Tell(msg);
    }

    // The page whose message is being answered (plan 14 3.0, stage 6): a pane's frame or a floating pane's window; null:
    // this window's page. It flows with the work of that message, through its awaits.
    readonly AsyncLocal<Action<string>?> replyTo = new();

    /// <summary>A request to the host of a floating pane's page (PaneForm), answered there (plan 14 3.0, stage 6).</summary>
    public void FromPanePage(string json, string[] files, Action<string> reply) => OnMessage(json, files, reply);

    // The page's layout as it told it last: its window's session (AppHost.SaveSession), given back to a new page after a
    // failure. freshLayout: the next page starts on the page's own default layout (a reset without defaultLayout).
    JsonObject? pageLayout;
    bool freshLayout;
}
