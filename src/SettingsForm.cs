using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.WinForms;

namespace Foldex;

/// <summary>
/// The settings window (docs/plans/executed/07-PLAN-themes.md 3.5, as LexPen's cut down): one for Foldex, not modal. Its page
/// (web\settings.html) shows every setting as a row; a change goes to AppHost.SetSetting at once, and every window
/// follows. Opened over the window it was asked from.
/// </summary>
sealed class SettingsForm : Form
{
    readonly AppHost app;
    readonly WebView2 web = new() { Dock = DockStyle.Fill };
    bool pageReady;

    public SettingsForm(AppHost app, Form from)
    {
        this.app = app;
        Text = "Settings - Foldex";
        Icon = from.Icon;
        MinimumSize = new Size(480, 360);
        StartPosition = FormStartPosition.Manual;
        var size = new Size(Math.Min(760, from.Width), Math.Min(620, from.Height));
        var at = from.WindowState == FormWindowState.Normal ? from.Bounds : from.RestoreBounds;
        Bounds = new Rectangle(at.X + (at.Width - size.Width) / 2, at.Y + (at.Height - size.Height) / 2, size.Width, size.Height);
        Controls.Add(web);
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
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        WebFiles.Serve(core);
        core.ContextMenuRequested += (_, m) => WebFiles.BrowserMenu(m);
        core.WebMessageReceived += (_, m) =>
        {
            var json = m.WebMessageAsJson;
            BeginInvoke(() => OnMessage(json));
        };
        core.Navigate($"https://{WebFiles.Host}/settings.html");
    }

    /// <summary>Tells the page (only once it is ready: it asks for the settings itself first).</summary>
    public void Post(JsonObject message)
    {
        if (pageReady && !IsDisposed) web.CoreWebView2.PostWebMessageAsJson(message.ToJsonString());
    }

    async void OnMessage(string json)
    {
        if (IsDisposed || JsonNode.Parse(json) is not JsonObject msg) return;
        switch (msg["op"]?.GetValue<string>())
        {
            case "ready":
            {
                pageReady = true;
                var look = AppHost.Look();
                look["event"] = "settings";
                Post(look);
                break;
            }
            case "setSetting":
                try { app.SetSetting(msg["name"]!.GetValue<string>(), msg["value"]?.DeepClone()); }
                catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
                {
                    MessageBox.Show(this, ex.Message, "Settings - Foldex", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
                break;
            case "fonts":
            {
                var list = await Task.Run(Fonts.List);
                Post(new JsonObject { ["event"] = "fonts", ["fonts"] = new JsonArray(list.Select(f => (JsonNode?)f).ToArray()) });
                break;
            }
            case "openSettingsFile":
                OpenSettingsFile();
                break;
            case "close":
                Close();
                break;
        }
    }

    // Your settings.json in the program Windows has for it (made first when there is none); else Notepad.
    void OpenSettingsFile()
    {
        var path = Path.Combine(AppHost.DataDir, SettingsFile.Name);
        try
        {
            if (!File.Exists(path))
            {
                Directory.CreateDirectory(AppHost.DataDir);
                File.WriteAllText(path, "{\n}\n");
            }
            try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
            catch (Win32Exception) { Process.Start("notepad.exe", $"\"{path}\""); }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or Win32Exception)
        {
            MessageBox.Show(this, ex.Message, "Settings - Foldex", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}
