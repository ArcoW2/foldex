using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.WinForms;

namespace Foldex;

/// <summary>
/// A pane floating in a window of its own (docs/plans/executed/14-PLAN-floating-panes.md 3.0, 3.2; LexPen's PaneForm): the same
/// page as in its window's frame (log.html, ...), from the panes' site. Its messages go to that window's page (the event
/// fromPane) and come from it (Send). Owned by its Foldex window, not modal; where it is and how large is told to that
/// page (paneBounds), which keeps it with the window's layout. Closed by its own close button, the pane closes: the page
/// is told (paneClosed); closed by the page (Dock, Close), nothing is told.
/// </summary>
sealed class PaneForm : Form
{
    const string PaneUrl = "https://" + WebFiles.PaneHost + "/";

    readonly AppHost app;
    readonly MainForm owner;
    readonly WebView2 web = new() { Dock = DockStyle.Fill };
    readonly string page;
    readonly List<string> queue = [];
    bool loaded, byPage, sized;
    readonly bool dialog;

    /// <summary>The pane, by its id in its window's layout.</summary>
    public string Id { get; }

    /// <summary>Windows' preview of a floating preview pane (plan 14 3.5): over the whole window, following its size;
    /// made when first asked for, unloaded when the window closes.</summary>
    public Shell.PreviewHost Preview => preview ??= MakePreview();
    Shell.PreviewHost? preview;
    Shell.PreviewHost MakePreview()
    {
        var host = new Shell.PreviewHost(this);
        Resize += (_, _) => { if (host.Visible) host.Move(ClientRectangle); };
        FormClosed += (_, _) => host.Dispose();
        return host;
    }

    /// <summary>Where its page's messages go: its window's page, or the pane's page that opened this dialog (plan 14 stage 6).</summary>
    public Action<JsonObject>? TellPage;

    /// <summary>A dialog's window's answer (its page's `done`; null: cancelled or closed).</summary>
    public JsonNode? Result { get; private set; }

    /// <param name="bounds">Where it was last (kept with the layout); null or off every screen: beside its window's right edge.</param>
    /// <param name="dialog">A dialog's window (plan 14 3.7): a dialog's page, as large as its page says (`size`), in the
    /// middle of its window; its page's `done` is its answer.</param>
    /// <param name="modal">A dialog's window shown with ShowDialog over its window (a modal floating window); false: owned
    /// by its window, which stays usable (the Size of a bar).</param>
    /// <param name="first">Its size the first time (no <paramref name="bounds"/>), in px at 96 dpi: in the middle of its
    /// window (Settings, Manage projects, Manage column sets); null: narrow, beside its window's right edge.</param>
    /// <param name="beside">The first time (no <paramref name="bounds"/>) outside its window: on another screen when
    /// there is one, else at its window's right (F3's preview, plan 14 3.5).</param>
    public PaneForm(AppHost app, MainForm owner, string id, string page, string title, Rectangle? bounds, bool dialog = false, bool modal = true,
        Size? first = null, bool beside = false)
    {
        (this.app, this.owner, Id, this.page, this.dialog) = (app, owner, id, page, dialog);
        Text = dialog ? title : $"{title} - Foldex";
        Icon = owner.Icon;
        if (!dialog || !modal) Owner = owner;   // a modal one is owned by ShowDialog
        ShowInTaskbar = false;
        MinimumSize = dialog ? new Size(160, 80) : new Size(200, 140);
        StartPosition = FormStartPosition.Manual;
        if (dialog)
        {
            MinimizeBox = MaximizeBox = false;
            FormBorderStyle = FormBorderStyle.FixedDialog;
        }
        var at = owner.WindowState == FormWindowState.Normal ? owner.Bounds : owner.RestoreBounds;
        var scale = owner.DeviceDpi / 96.0;
        var wanted = first is { } f ? new Size(Math.Min((int)(f.Width * scale), at.Width), Math.Min((int)(f.Height * scale), at.Height)) : Size.Empty;
        var fallback = dialog ? new Rectangle(at.X + (at.Width - 420) / 2, at.Y + (at.Height - 240) / 2, 420, 240)
            : first is not null ? new Rectangle(at.X + (at.Width - wanted.Width) / 2, at.Y + (at.Height - wanted.Height) / 2, wanted.Width, wanted.Height)
            : beside ? Beside(at, scale)
            : new Rectangle(at.Right - 420, at.Y + 80, 400, Math.Min(500, Math.Max(200, at.Height - 160)));
        Bounds = bounds is { } b && Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(b)) ? b : fallback;
        Controls.Add(web);
        // Moved or sized in any way (dragged, snapped, by the keyboard): told once it rests.
        var rest = new System.Windows.Forms.Timer { Interval = 400 };
        rest.Tick += (_, _) => { rest.Stop(); TellBounds(); };
        Move += (_, _) => { rest.Stop(); rest.Start(); };
        Resize += (_, _) => { rest.Stop(); rest.Start(); };
        FormClosed += (_, _) => rest.Dispose();
        ResizeEnd += (_, _) => TellBounds();
        Shown += (_, _) => TellBounds();   // where it opened, before any move (F3 opens the next one beside it)
        FormClosing += (_, _) => TellBounds();
        FormClosed += (_, _) =>
        {
            if (!byPage && !dialog && !owner.IsDisposed) owner.Tell(new JsonObject { ["event"] = "paneClosed", ["pane"] = Id });
        };
    }

    // Beside its window `at`: in the middle of another screen when there is one, else at its window's right on its
    // screen (inside it when there is no room); a size for a preview (chosen, not measured).
    static Rectangle Beside(Rectangle at, double scale)
    {
        var size = new Size((int)(640 * scale), (int)(520 * scale));
        var mine = Screen.FromRectangle(at);
        if (Screen.AllScreens.FirstOrDefault(s => !s.Equals(mine)) is { } other)
        {
            var area = other.WorkingArea;
            return new Rectangle(area.X + (area.Width - size.Width) / 2, area.Y + (area.Height - size.Height) / 2, size.Width, size.Height);
        }
        var work = mine.WorkingArea;
        var x = Math.Min(at.Right, work.Right - size.Width);
        return new Rectangle(Math.Max(work.X, x), Math.Max(work.Y, at.Y + 80), size.Width, Math.Min(size.Height, work.Height));
    }

    // Its place and size to its window's page, for the layout.
    void TellBounds()
    {
        if (dialog || WindowState != FormWindowState.Normal || owner.IsDisposed) return;
        owner.Tell(new JsonObject
        {
            ["event"] = "paneBounds", ["pane"] = Id,
            ["bounds"] = new JsonArray(Bounds.X, Bounds.Y, Bounds.Width, Bounds.Height),
        });
    }

    /// <summary>Closed because its window's page says so (docked back, or the pane closed): nothing told back.</summary>
    public void CloseByPage()
    {
        byPage = true;
        Close();
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        ApplyTheme();
        await web.EnsureCoreWebView2Async(await app.WebEnvironment());
        var core = web.CoreWebView2;
        core.Settings.IsStatusBarEnabled = false;
#if !DEBUG
        core.Settings.AreDevToolsEnabled = false;
#endif
        core.Settings.IsZoomControlEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        WebFiles.Serve(core);
        Shell.OwnPreview.Serve(core);   // the files of Foldex's own preview (a PDF, an image, a video), as the window's
        core.ContextMenuRequested += (_, m) => WebFiles.BrowserMenu(m);
        core.PermissionRequested += (_, p) => WebFiles.ClipboardRead(p);
        // What the pane says goes to its window's page, as a frame's message would; what it asks of the host itself (an
        // `op`, plan 14 stage 6) its window's host answers here.
        core.WebMessageReceived += (_, m) =>
        {
            var json = m.WebMessageAsJson;
            var files = m.AdditionalObjects?.OfType<Microsoft.Web.WebView2.Core.CoreWebView2File>().Select(x => x.Path).ToArray() ?? [];
            BeginInvoke(() =>
            {
                if (IsDisposed || owner.IsDisposed) return;
                if (JsonNode.Parse(json) is JsonObject { } asked && asked.ContainsKey("op"))
                {
                    owner.FromPanePage(json, files, answer =>
                    {
                        if (IsDisposed) return;
                        if (loaded) web.CoreWebView2.PostWebMessageAsJson(answer);
                        else queue.Add(answer);   // asked before its page finished loading
                    });
                    return;
                }
                if (JsonNode.Parse(json)?["fromPane"] is not JsonNode msg) return;
                if (dialog && Dialog(msg)) return;
                (TellPage ?? owner.Tell)(new JsonObject { ["event"] = "fromPane", ["pane"] = Id, ["msg"] = msg.DeepClone() });
            });
        };
        core.NavigationStarting += (_, n) => { if (!n.Uri.StartsWith(PaneUrl)) n.Cancel = true; };
        // A link to the web (About's Buy me a coffee) opens in the browser, as LexPen's; nothing opens a window here.
        core.NewWindowRequested += (_, n) =>
        {
            n.Handled = true;
            if (Uri.TryCreate(n.Uri, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.Host != WebFiles.PaneHost && uri.Host != WebFiles.Host)
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        };
        core.NavigationCompleted += (_, _) =>
        {
            loaded = true;
            foreach (var json in queue) core.PostWebMessageAsJson(json);
            queue.Clear();
            // Opened in front (F3's preview): the keyboard into its page at once, so Page Down, Esc and Ctrl+F4 work
            // without a click first.
            if (ActiveForm == this) web.Focus();
        };
        core.Navigate(PaneUrl + page);
    }

    // A dialog's window's own messages: its answer (`done`, it closes) and its page's size (`size`, in CSS px: the
    // window made that large inside, the first time in the middle of its window, kept on its screen).
    bool Dialog(JsonNode msg)
    {
        switch (msg["kind"]?.GetValue<string>())
        {
            case "done":
                Result = msg["value"]?.DeepClone();
                CloseByPage();
                return true;
            case "size":
                // A dialog you can resize (Select columns, docs/plans/executed/28-PLAN-column-sets-window.md 3.7): its
                // first size the page's, then a sizable window that the page fills.
                if (FormBorderStyle == FormBorderStyle.Sizable) return true;
                if (msg["resizable"]?.GetValue<bool>() == true)
                {
                    FormBorderStyle = FormBorderStyle.Sizable;
                    MaximizeBox = true;
                }
                var scale = DeviceDpi / 96.0;
                var size = new Size((int)Math.Ceiling(msg["w"]!.GetValue<double>() * scale), (int)Math.Ceiling(msg["h"]!.GetValue<double>() * scale));
                if (size == ClientSize) return true;
                ClientSize = size;
                if (!sized)
                {
                    sized = true;
                    var at = owner.WindowState == FormWindowState.Normal ? owner.Bounds : owner.RestoreBounds;
                    Location = new Point(at.X + (at.Width - Width) / 2, at.Y + Math.Max(40, (at.Height - Height) / 3));
                }
                var area = Screen.FromControl(this).WorkingArea;
                Location = new Point(Math.Max(area.X, Math.Min(Left, area.Right - Width)), Math.Max(area.Y, Math.Min(Top, area.Bottom - Height)));
                return true;
        }
        return false;
    }

    /// <summary>A message of its window's page for the pane.</summary>
    public void Send(JsonNode msg)
    {
        var json = new JsonObject { ["toPane"] = msg.DeepClone() }.ToJsonString();
        if (loaded && !IsDisposed) web.CoreWebView2.PostWebMessageAsJson(json);
        else queue.Add(json);
    }

    /// <summary>The window's look: its background, and the caption dark in dark mode (as AskForm's).</summary>
    public void ApplyTheme()
    {
        var look = owner.Look;
        if (look?["colours"]?["--bg"] is JsonArray { Count: 3 } c)
            BackColor = web.DefaultBackgroundColor = Color.FromArgb(c[0]!.GetValue<int>(), c[1]!.GetValue<int>(), c[2]!.GetValue<int>());
        var on = look?["dark"]?.GetValue<bool>() == true ? 1 : 0;
        DwmSetWindowAttribute(Handle, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, ref on, sizeof(int));
    }

    /// <summary>Getting or losing the focus is told to its window's page, so its pane is the active one there. Dragged
    /// by its title bar (plan 14 3.1): where the mouse is over its Foldex window, as that page's point, while it moves
    /// (`paneDragMove`) and where it was let go (`paneDragEnd`), so the page lights the place and docks it there.</summary>
    protected override void WndProc(ref Message m)
    {
        const int WM_ACTIVATE = 0x0006, WM_MOVING = 0x0216, WM_EXITSIZEMOVE = 0x0232;
        if (m.Msg == WM_ACTIVATE && !owner.IsDisposed)
            owner.Tell(new JsonObject { ["event"] = "paneWindowFocus", ["pane"] = Id, ["active"] = (m.WParam.ToInt64() & 0xFFFF) != 0 });
        if (!dialog && !owner.IsDisposed && (m.Msg == WM_MOVING || (m.Msg == WM_EXITSIZEMOVE && dragging)))
        {
            var end = m.Msg == WM_EXITSIZEMOVE;
            dragging = !end;
            var (x, y) = owner.PagePoint(Cursor.Position);
            // Shift held: moved over its window without docking there (the page lights no place).
            owner.Tell(new JsonObject { ["event"] = end ? "paneDragEnd" : "paneDragMove", ["pane"] = Id, ["x"] = x, ["y"] = y,
                ["shift"] = (ModifierKeys & Keys.Shift) != 0 });
        }
        base.WndProc(ref m);
    }
    bool dragging;

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
