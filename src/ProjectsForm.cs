using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.WinForms;

namespace Foldex;

/// <summary>
/// The Manage projects window (docs/plans/15-PLAN-projects.md 3.7, as LexPen's): one for Foldex, not modal, its place
/// kept (AppState.ProjectsWindow). Its page (web\projects.html, projects.js) lists every project with checkboxes, a
/// search, sorting and details; its menus and buttons act on the checked projects through AppHost (open, close, rename,
/// delete, new). The list follows every change of the projects (AppHost.ProjectsChanged).
/// </summary>
sealed class ProjectsForm : Form
{
    readonly AppHost app;
    readonly WebView2 web = new() { Dock = DockStyle.Fill };
    bool pageReady;
    readonly List<string> queue = [];

    public ProjectsForm(AppHost app, MainForm from)
    {
        this.app = app;
        Text = "Manage projects - Foldex";
        Icon = from.Icon;
        MinimumSize = new Size(480, 320);
        StartPosition = FormStartPosition.Manual;
        // The place it was left at, when that is still on a screen; else in the middle of its window.
        var kept = app.State?.ProjectsWindow;
        var at = from.WindowState == FormWindowState.Normal ? from.Bounds : from.RestoreBounds;
        var size = new Size(Math.Min(900, at.Width), Math.Min(620, at.Height));
        Bounds = kept is [var x, var y, var w, var h] && Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(new Rectangle(x, y, w, h)))
            ? new Rectangle(x, y, w, h)
            : new Rectangle(at.X + (at.Width - size.Width) / 2, at.Y + (at.Height - size.Height) / 2, size.Width, size.Height);
        Controls.Add(web);
        ResizeEnd += (_, _) => KeepBounds();
        FormClosing += (_, _) => KeepBounds();
    }

    void KeepBounds()
    {
        if (WindowState == FormWindowState.Normal) app.SaveProjectsWindow([Bounds.X, Bounds.Y, Bounds.Width, Bounds.Height]);
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        await web.EnsureCoreWebView2Async(await app.WebEnvironment());
        var core = web.CoreWebView2;
        core.Settings.IsStatusBarEnabled = false;
#if !DEBUG
        core.Settings.AreDevToolsEnabled = false;
#endif
        core.Settings.IsZoomControlEnabled = false;
        WebFiles.Serve(core);
        core.ContextMenuRequested += (_, m) => WebFiles.BrowserMenu(m);
        core.WebMessageReceived += (_, m) =>
        {
            var json = m.WebMessageAsJson;
            BeginInvoke(() => OnMessage(json));
        };
        core.Navigate($"https://{WebFiles.Host}/projects.html");
    }

    /// <summary>Tells the page (the settings, "the projects changed"); kept until it is ready.</summary>
    public void Post(JsonObject message)
    {
        var json = message.ToJsonString();
        if (pageReady && !IsDisposed) web.CoreWebView2.PostWebMessageAsJson(json);
        else queue.Add(json);
    }

    static List<int> Ids(JsonNode msg) => msg["projects"]?.AsArray().Select(n => n!.GetValue<int>()).ToList() ?? [];

    // A request of the page ({ id, op, ... }), answered with { id, result } or { id, error }.
    void OnMessage(string json)
    {
        if (IsDisposed || JsonNode.Parse(json) is not JsonObject msg) return;
        var reply = new JsonObject { ["id"] = msg["id"]!.GetValue<int>() };
        var op = msg["op"]?.GetValue<string>() ?? "";
        try { reply["result"] = Request(op, msg); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or IOException or UnauthorizedAccessException)
        {
            reply["error"] = ex.Message;
        }
        if (IsDisposed) return;
        web.CoreWebView2.PostWebMessageAsJson(reply.ToJsonString());
        if (op == "init")
        {
            pageReady = true;
            foreach (var queued in queue) web.CoreWebView2.PostWebMessageAsJson(queued);
            queue.Clear();
        }
    }

    JsonNode? Request(string op, JsonObject msg)
    {
        switch (op)
        {
            case "init":
                return new JsonObject { ["look"] = AppHost.Look(), ["list"] = app.ProjectList(null, true) };
            case "list":
                return app.ProjectList(null, true);
            case "open":
                foreach (var id in Ids(msg)) app.ProjectCommand(null, "open", new JsonObject { ["project"] = id });
                return true;
            case "new":
                app.ProjectCommand(null, "new", new JsonObject { ["name"] = msg["name"]?.GetValue<string>() ?? "" });
                return true;
            case "rename":
                app.ProjectCommand(null, "rename", new JsonObject { ["project"] = msg["project"]!.GetValue<int>(), ["name"] = msg["name"]?.GetValue<string>() ?? "" });
                return true;
            case "clone":
                app.ProjectCommand(null, "clone", new JsonObject { ["project"] = msg["project"]!.GetValue<int>(), ["name"] = msg["name"]?.GetValue<string>() ?? "" });
                return true;
            case "close":
                app.CloseProjects(Ids(msg));
                return true;
            case "delete":
                app.DeleteProjects(this, Ids(msg));
                return true;
            case "setting":
                AppHost.SetQuietly(msg["name"]!.GetValue<string>(), msg["value"]?.DeepClone());
                return true;
            case "back":
                if (app.LastActive is { } last) AppHost.BringToFront(last);
                return true;
            default:
                throw new InvalidOperationException($"Unknown request '{op}'.");
        }
    }
}
