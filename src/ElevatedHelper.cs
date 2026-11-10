using System.ComponentModel;
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex;

/// <summary>
/// The elevated helper (docs/plans/05-PLAN-elevation.md 3.3): Foldex.exe --elevated-helper &lt;pipe&gt; &lt;parent id&gt;,
/// started through UAC. No window, no WebView2, no shell extensions; it serves a fixed set of operations over a pipe
/// only its parent may use, then exits when the parent goes. Spike scope (plan 02 3.7, item 6): listing a folder.
/// </summary>
static class ElevatedHelper
{
    public const string Switch = "--elevated-helper";

    // ---------- In the helper ----------

    public static void Run(string pipeName, int parentId)
    {
        var user = WindowsIdentity.GetCurrent().User!;
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.ReadWrite, AccessControlType.Allow));
        using var server = NamedPipeServerStreamAcl.Create(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
            PipeOptions.None, 0, 0, security);
        var waiting = server.WaitForConnectionAsync();
        if (!waiting.Wait(TimeSpan.FromSeconds(30))) return;
        // Only the parent that started it.
        if (!GetNamedPipeClientProcessId(server.SafePipeHandle.DangerousGetHandle(), out var client) || client != parentId) return;
        using var reader = new StreamReader(server, Encoding.UTF8, leaveOpen: true);
        using var writer = new StreamWriter(server, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
        while (reader.ReadLine() is string line)
            writer.WriteLine(Answer(line).ToJsonString());
    }

    // The fixed set: every request is checked, anything else refused.
    internal static JsonObject Answer(string line)
    {
        JsonNode? msg;
        try { msg = JsonNode.Parse(line); }
        catch (JsonException) { return new JsonObject { ["error"] = "not a request" }; }
        switch (msg?["op"]?.GetValue<string>())
        {
            case "list" when msg["path"]?.GetValue<string>() is { } path && Path.IsPathFullyQualified(path):
                var r = ShellListing.List(path);
                return new JsonObject { ["entries"] = r.Entries, ["error"] = r.Error, ["denied"] = r.Denied, ["ms"] = r.Milliseconds };
            case "list":
                return new JsonObject { ["error"] = "list needs a full path" };
            default:
                return new JsonObject { ["error"] = "not an operation of the helper" };
        }
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out int clientProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out int serverProcessId);

    // ---------- In Foldex ----------

    /// <summary>Lists a folder through a helper started now (UAC asks); the answer, or why there is none.</summary>
    public static async Task<JsonObject> List(string path)
    {
        var pipeName = "Foldex-helper-" + Guid.NewGuid().ToString("N");
        Process helper;
        try
        {
            helper = Process.Start(new ProcessStartInfo(Environment.ProcessPath!, $"{Switch} {pipeName} {Environment.ProcessId}")
            {
                UseShellExecute = true,
                Verb = "runas",
            })!;
        }
        catch (Win32Exception ex) when (ex.NativeErrorCode == 1223) { return new JsonObject { ["error"] = "cancelled at the administrator prompt" }; }
        try
        {
            await using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            await client.ConnectAsync(30_000);
            // Only the helper this Foldex started.
            if (!GetNamedPipeServerProcessId(client.SafePipeHandle.DangerousGetHandle(), out var server) || server != helper.Id)
                return new JsonObject { ["error"] = "the pipe is not the helper's" };
            using var reader = new StreamReader(client, Encoding.UTF8, leaveOpen: true);
            await using var writer = new StreamWriter(client, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
            await writer.WriteLineAsync(new JsonObject { ["op"] = "list", ["path"] = path }.ToJsonString());
            var answer = await reader.ReadLineAsync();
            return answer is null ? new JsonObject { ["error"] = "the helper gave no answer" } : JsonNode.Parse(answer)!.AsObject();
        }
        catch (Exception ex) when (ex is TimeoutException or IOException) { return new JsonObject { ["error"] = ex.Message }; }
    }
}
