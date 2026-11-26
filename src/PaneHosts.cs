using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// What the Settings and Manage projects panes ask of the host (docs/plans/executed/14-PLAN-floating-panes.md 3.7): their pages
/// (settings.html, projects.html) were the host's own windows (SettingsForm, ProjectsForm) and are panes of a Foldex
/// window now, docked or floating; their messages come through that window's page (MainForm's paneHost) and the
/// answers go back the same way (`reply`). What the host tells them unasked (the settings, the folder cache, "the
/// projects changed") every window's page is told and passes on to its pane.
/// </summary>
static class PaneHosts
{
    /// <summary>The settings pane (docs/plans/executed/07-PLAN-themes.md 3.5): a change goes to AppHost.SetSetting at
    /// once, and every window follows.</summary>
    public static async void Settings(AppHost app, MainForm window, JsonObject msg, Action<JsonObject> reply)
    {
        switch (msg["op"]?.GetValue<string>())
        {
            case "ready":
            {
                var look = AppHost.Look();
                look["event"] = "settings";
                reply(look);
                reply(app.CacheInfo());
                break;
            }
            case "setSetting":
                try { app.SetSetting(msg["name"]!.GetValue<string>(), msg["value"]?.DeepClone()); }
                catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
                {
                    AskForm.Tell(app, window, AskForm.Sign.Warning, ex.Message);
                }
                break;
            case "fonts":
            {
                var list = await Task.Run(Fonts.List);
                reply(new JsonObject { ["event"] = "fonts", ["fonts"] = new JsonArray(list.Select(f => (JsonNode?)f).ToArray()) });
                break;
            }
            case "openSettingsFile":
                OpenSettingsFile(app, window);
                break;
            // The lister plugins' row (docs/plans/executed/33-PLAN-preview-plugins.md 3.2): each one's name and detect string, read
            // by the plugin helper the first time; Add... picks a file and adds it to previewListers.
            case "listers":
                reply(new JsonObject { ["event"] = "listers", ["list"] = await app.Listers.Info(Added()) });
                break;
            case "pickLister":
            {
                using var dialog = new OpenFileDialog { Title = "Add a lister plugin", Filter = "Lister plugins (*.wlx64)|*.wlx64|All files|*.*" };
                if (dialog.ShowDialog(window) != DialogResult.OK) break;
                var paths = Added();
                if (!paths.Contains(dialog.FileName, StringComparer.OrdinalIgnoreCase)) paths.Add(dialog.FileName);
                try { app.SetSetting("previewListers", new JsonArray([.. paths.Select(p => (JsonNode)p)])); }
                catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
                {
                    AskForm.Tell(app, window, AskForm.Sign.Warning, ex.Message);
                }
                break;
            }
        }
    }

    // The lister plugins added by path (the setting previewListers).
    static List<string> Added() =>
        SettingsFile.Load(AppHost.DataDir)["values"]?["previewListers"] is JsonArray a ? [.. a.Select(n => n?.GetValue<string>() ?? "").Where(p => p.Length > 0)] : [];

    // Your settings.json in the program Windows has for it (made first when there is none); else Notepad.
    static void OpenSettingsFile(AppHost app, MainForm window)
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
            AskForm.Tell(app, window, AskForm.Sign.Warning, ex.Message);
        }
    }

    static List<int> Ids(JsonNode msg) => msg["projects"]?.AsArray().Select(n => n!.GetValue<int>()).ToList() ?? [];

    /// <summary>The Manage projects pane (docs/plans/executed/15-PLAN-projects.md 3.7): a request of its page ({ id, op, ... }),
    /// answered with { id, result } or { id, error }; the work done through AppHost.</summary>
    public static void Projects(AppHost app, MainForm window, JsonObject msg, Action<JsonObject> reply)
    {
        var answer = new JsonObject { ["id"] = msg["id"]!.GetValue<int>() };
        try { answer["result"] = ProjectsRequest(app, window, msg["op"]?.GetValue<string>() ?? "", msg); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or IOException or UnauthorizedAccessException)
        {
            answer["error"] = ex.Message;
        }
        reply(answer);
    }

    static JsonNode? ProjectsRequest(AppHost app, MainForm window, string op, JsonObject msg)
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
                app.DeleteProjects(Ids(msg));
                return true;
            case "setting":
                AppHost.SetQuietly(msg["name"]!.GetValue<string>(), msg["value"]?.DeepClone());
                return true;
            // A yes / no question of the page (askYes), in Foldex's own window over its window, in the page's look.
            case "confirm":
                return AskForm.Confirm(app, window, msg, msg["look"] as JsonObject);
            default:
                throw new InvalidOperationException($"Unknown request '{op}'.");
        }
    }

    /// <summary>The Manage profiles pane (docs/plans/executed/41-PLAN-profiles.md 3.5): as Manage projects, its requests
    /// answered with { id, result } or { id, error }; the commands are the Profiles menu's (AppHost.ProfileCommand).</summary>
    public static void Profiles(AppHost app, MainForm window, JsonObject msg, Action<JsonObject> reply)
    {
        var answer = new JsonObject { ["id"] = msg["id"]!.GetValue<int>() };
        try
        {
            answer["result"] = (msg["op"]?.GetValue<string>() ?? "") switch
            {
                "init" => new JsonObject { ["look"] = AppHost.Look(), ["list"] = AppHost.ProfileList() },
                "list" => AppHost.ProfileList(),
                // Before a change: the password of a closed profile that has one; always for Copy (3.4).
                "unlock" => app.ProfileUnlock(window, msg["profile"]!.GetValue<int>(), msg["always"]?.GetValue<bool>() == true),
                "command" => Command(),
                "confirm" => AskForm.Confirm(app, window, msg, msg["look"] as JsonObject),
                var op => throw new InvalidOperationException($"Unknown request '{op}'."),
            };
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or IOException or UnauthorizedAccessException)
        {
            answer["error"] = ex.Message;
        }
        reply(answer);

        JsonNode Command()
        {
            app.ProfileCommand(window, msg["kind"]!.GetValue<string>(), msg);
            return true;
        }
    }
}
