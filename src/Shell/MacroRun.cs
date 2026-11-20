using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// A macro's `run` (docs/plans/34-PLAN-macros.md 3.3): a program, a document or a URL started as Windows' Run starts
/// it (ShellExecute), with its parameters, in a folder, in a window as asked, as administrator (Windows asks, as for any
/// program), and waited for when asked. The page asks with what the macro's line worked out; the host starts it.
/// </summary>
static class MacroRun
{
    /// <summary>What a run asks: the page's message (what, params, folder, window, admin, wait).</summary>
    public sealed record Request(string What, string Params, string Folder, string Window, bool Admin, bool Wait)
    {
        public static Request Of(JsonObject m) => new(m["what"]?.GetValue<string>() ?? "", m["params"]?.GetValue<string>() ?? "",
            m["folder"]?.GetValue<string>() ?? "", m["window"]?.GetValue<string>() ?? "normal", m["admin"]?.GetValue<bool>() == true,
            m["wait"]?.GetValue<bool>() == true);
    }

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
        if (r.Admin) start.Verb = "runas";
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
    public static async Task<JsonObject> Run(Request r)
    {
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
        using (process)
        {
            await process.WaitForExitAsync();
            return new JsonObject { ["exitCode"] = process.ExitCode };
        }
    }
}
