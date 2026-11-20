using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// A macro's `run` (docs/plans/executed/34-PLAN-macros.md 3.3): a program, a document or a URL started as Windows' Run starts
/// it (ShellExecute), with its parameters, in a folder, in a window as asked, as administrator (Windows asks, as for any
/// program), and waited for when asked. The page asks with what the macro's line worked out; the host starts it.
/// The macro's rights (docs/plans/executed/39-PLAN-elevated-macros.md 3.3): with them the elevated helper starts it; under
/// "never" it starts with __COMPAT_LAYER=RunAsInvoker, so a program that asks for administrator starts as the user.
/// </summary>
static class MacroRun
{
    /// <summary>What a run asks: the page's message (what, params, folder, window, admin, adminForced, wait, rights:
    /// "elevated", "never" or "").</summary>
    public sealed record Request(string What, string Params, string Folder, string Window, bool Admin, bool Wait,
        bool AdminForced = false, string Rights = "")
    {
        public static Request Of(JsonObject m) => new(m["what"]?.GetValue<string>() ?? "", m["params"]?.GetValue<string>() ?? "",
            m["folder"]?.GetValue<string>() ?? "", m["window"]?.GetValue<string>() ?? "normal", m["admin"]?.GetValue<bool>() == true,
            m["wait"]?.GetValue<bool>() == true, m["adminForced"]?.GetValue<bool>() == true, m["rights"]?.GetValue<string>() ?? "");
    }

    /// <summary>The variable that makes a program asking for administrator start as the user (checked, plan 39 3.3).</summary>
    public const string CompatLayer = "__COMPAT_LAYER", RunAsInvoker = "RunAsInvoker";

    /// <summary>The start a request makes, or why it cannot: the folder with `..` worked out (and there), the window,
    /// `runas` for admin.</summary>
    public static (ProcessStartInfo? Start, string? Error) StartOf(Request r)
    {
        if (string.IsNullOrWhiteSpace(r.What)) return (null, "run: nothing to run");
        var start = new ProcessStartInfo(r.What.Trim())
        {
            Arguments = r.Params,
            UseShellExecute = true,
            WindowStyle = r.Window switch
            {
                "minimized" => ProcessWindowStyle.Minimized,
                "maximized" => ProcessWindowStyle.Maximized,
                "hidden" => ProcessWindowStyle.Hidden,
                _ => ProcessWindowStyle.Normal,
            },
        };
        if (r.Admin || r.AdminForced) start.Verb = "runas";
        if (r.Rights == "never" && !r.AdminForced)
        {
            // Set on what is started, never on Foldex: a program directly (its exit code as always); anything else
            // (a document, a URL) through cmd's start, which gives no exit code of what it opened.
            if (!ThroughCmd(r))
                start.UseShellExecute = false;
            else
            {
                start.Arguments = $"/c start \"\" {(r.Wait ? "/wait " : "")}{Quoted(r.What.Trim())} {r.Params}".TrimEnd();
                start.FileName = "cmd.exe";
                start.UseShellExecute = false;
                start.CreateNoWindow = true;
            }
            start.Environment[CompatLayer] = RunAsInvoker;
        }
        if (r.Folder.Length > 0)
        {
            string folder;
            try { folder = Path.GetFullPath(r.Folder.Trim()); }
            catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException) { return (null, $"run: \"{r.Folder}\" is no folder"); }
            if (!Directory.Exists(folder)) return (null, $"run: the folder \"{folder}\" is not there");
            start.WorkingDirectory = folder;
        }
        return (start, null);
    }

    /// <summary>Starts it: { exitCode } once it ended when it waits (none when Windows gave no process: a document
    /// opened in a program already running), {} when it does not, { error } when it cannot start.</summary>
    public static async Task<JsonObject> Run(Request r, Func<JsonObject, Task<JsonObject>>? helper = null)
    {
        // With the macro's rights (or admin_forced in a macro that has them): the helper starts it (3.6).
        if (r.Rights == "elevated" && helper is not null)
            return await helper(new JsonObject
            {
                ["op"] = "start", ["what"] = r.What, ["params"] = r.Params, ["folder"] = r.Folder, ["window"] = r.Window, ["wait"] = r.Wait,
            });
        var (start, error) = StartOf(r);
        if (start is null) return new JsonObject { ["error"] = error };
        Process? process;
        try { process = Process.Start(start); }
        catch (Win32Exception ex) when (ex.NativeErrorCode == 1223) { return new JsonObject { ["error"] = $"run: {r.What}: cancelled (not as administrator)" }; }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException or FileNotFoundException)
        {
            return new JsonObject { ["error"] = $"run: {r.What}: {ex.Message}" };
        }
        if (!r.Wait || process is null) { process?.Dispose(); return new JsonObject(); }
        // A document under "never" went through cmd's start /wait: what it opened gives no exit code (3.3).
        if (ThroughCmd(r)) { using (process) await process.WaitForExitAsync(); return new JsonObject(); }
        using (process)
        {
            await process.WaitForExitAsync();
            return new JsonObject { ["exitCode"] = process.ExitCode };
        }
    }

    // Under never, what is no program (a document, a URL) goes through cmd's start (3.3).
    static bool ThroughCmd(Request r) => r.Rights == "never" && !r.AdminForced
        && Path.GetExtension(r.What.Trim()).ToLowerInvariant() is not (".exe" or ".com" or "");

    static string Quoted(string s) => s.Contains(' ') && !s.StartsWith('"') ? $"\"{s}\"" : s;
}
