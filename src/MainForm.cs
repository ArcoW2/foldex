using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Foldex;

/// <summary>
/// A Foldex window: one WebView2 showing the page (web\index.html). The page and the host talk through JSON messages:
/// the page asks ({ op, ... }), the host tells ({ event, ... }). When the page's process fails, the window makes a new
/// page and nothing else stops (docs/plans/02-PLAN-ui-technology.md 3.5).
/// </summary>
sealed class MainForm : Form
{
    readonly AppHost app;
    WebView2 web = null!;
    IReadOnlyList<string> paths;   // the last ones given, for a new page after a failure
    bool pageReady;
    readonly List<string> queue = [];   // told before the page was ready

    public MainForm(AppHost app, IReadOnlyList<string> paths)
    {
        this.app = app;
        this.paths = paths;
        Text = "Foldex";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.Manual;
        var bounds = app.State is { Width: > 0, Height: > 0 } s ? new Rectangle(s.X, s.Y, s.Width, s.Height) : DefaultBounds();
        // A window placed on a screen that is no longer there comes back on the main one.
        Bounds = Screen.AllScreens.Any(sc => sc.WorkingArea.IntersectsWith(bounds)) ? bounds : DefaultBounds();
        if (app.Windows.Count > 0) Location += new Size(32, 32);   // a second window not exactly over the first
        if (app.State?.Maximized == true) WindowState = FormWindowState.Maximized;
        AddBrowser();
    }

    static Rectangle DefaultBounds()
    {
        var area = Screen.PrimaryScreen!.WorkingArea;
        return new Rectangle(area.X + area.Width / 8, area.Y + area.Height / 8, area.Width * 3 / 4, area.Height * 3 / 4);
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

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
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
        WebFiles.Serve(core);
        core.ContextMenuRequested += (_, m) => WebFiles.BrowserMenu(m);
        core.DocumentTitleChanged += (_, _) => Text = core.DocumentTitle is { Length: > 0 } t ? t : "Foldex";
        // Not inside a WebView2 event handler: dialogs and long work must not run there.
        core.WebMessageReceived += (_, m) =>
        {
            var json = m.WebMessageAsJson;
            BeginInvoke(() => OnMessage(json));
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

    void OnMessage(string json)
    {
        if (JsonNode.Parse(json) is not JsonObject msg) return;
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
                    ["paths"] = PathsArray(paths),
                });
                foreach (var queued in queue) web.CoreWebView2.PostWebMessageAsJson(queued);
                queue.Clear();
                break;
        }
    }

    /// <summary>Tells the page; kept until it is ready.</summary>
    public void Post(JsonObject msg)
    {
        var json = msg.ToJsonString();
        if (pageReady && !IsDisposed && web.CoreWebView2 is { } core) core.PostWebMessageAsJson(json);
        else queue.Add(json);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        base.OnFormClosing(e);
        var b = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
        app.SaveState(new AppHost.AppState
        {
            X = b.X, Y = b.Y, Width = b.Width, Height = b.Height,
            Maximized = WindowState == FormWindowState.Maximized,
        });
    }
}
