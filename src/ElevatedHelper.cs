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
/// The elevated helper (docs/plans/executed/05-PLAN-elevation.md 3.3; docs/plans/executed/31-PLAN-elevated-helper-tasks.md):
/// Foldex.exe --elevated-helper &lt;pipe&gt; &lt;parent id&gt;, started through UAC. No window, no WebView2, no shell
/// extensions; it serves a fixed set of operations over a pipe only its parent may use, and exits when the pipe closes
/// (its session ends, or Foldex goes). Its operations: listing a folder (with the backup privilege, so a folder only
/// SYSTEM may read is listed too, nothing on it changed), taking ownership for the user, making a symbolic link; for a
/// macro with administrator rights (docs/plans/executed/39-PLAN-elevated-macros.md 3.6) its file operations and programs.
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
        // Its privileges, once: reading any folder (backup), and setting an owner that is not itself (take ownership,
        // restore). An administrator holds them; they are only switched on.
        foreach (var name in new[] { "SeBackupPrivilege", "SeRestorePrivilege", "SeTakeOwnershipPrivilege" }) EnablePrivilege(name);
        using var reader = new StreamReader(server, Encoding.UTF8, leaveOpen: true);
        using var writer = new StreamWriter(server, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
        while (reader.ReadLine() is string line)
            writer.WriteLine(Answer(line).ToJsonString());
    }

    static bool Full(JsonNode? path) => path?.GetValueKind() == JsonValueKind.String && Path.IsPathFullyQualified(path.GetValue<string>());

    // The fixed set: every request is checked, anything else refused.
    internal static JsonObject Answer(string line)
    {
        JsonNode? msg;
        try { msg = JsonNode.Parse(line); }
        catch (JsonException) { return new JsonObject { ["error"] = "not a request" }; }
        switch (msg?["op"]?.GetValue<string>())
        {
            case "list" when Full(msg["path"]):
                var r = ShellListing.List(msg["path"]!.GetValue<string>());
                return new JsonObject { ["entries"] = r.Entries, ["error"] = r.Error, ["denied"] = r.Denied, ["ms"] = r.Milliseconds };
            case "list":
                return new JsonObject { ["error"] = "list needs a full path" };
            case "takeOwnership" when msg["paths"] is JsonArray paths && paths.Count > 0 && paths.All(Full) && msg["sid"]?.GetValueKind() == JsonValueKind.String:
            {
                SecurityIdentifier sid;
                try { sid = new SecurityIdentifier(msg["sid"]!.GetValue<string>()); }
                catch (ArgumentException) { return new JsonObject { ["error"] = "not a user" }; }
                var (done, failed) = TakeOwnership([.. paths.Select(p => p!.GetValue<string>())], msg["recursive"]?.GetValue<bool>() == true, sid);
                return new JsonObject { ["done"] = done, ["failed"] = failed };
            }
            case "takeOwnership":
                return new JsonObject { ["error"] = "takeOwnership needs full paths and the user" };
            case "symlink" when Full(msg["link"]) && Full(msg["target"]):
            {
                var link = msg["link"]!.GetValue<string>();
                var target = msg["target"]!.GetValue<string>();
                try
                {
                    if (Directory.Exists(target)) Directory.CreateSymbolicLink(link, target);
                    else File.CreateSymbolicLink(link, target);
                    return new JsonObject { ["made"] = link };
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
                {
                    return new JsonObject { ["error"] = ex.Message };
                }
            }
            case "symlink":
                return new JsonObject { ["error"] = "symlink needs a full path for the link and its target" };
            // A macro's (docs/plans/executed/39-PLAN-elevated-macros.md 3.6): started, so the macro has the rights; a file operation
            // through IFileOperation, elevated (a rename's target is the new name, a new item's the folder); a program.
            case "hello":
                return [];
            case "fileOp" when msg["kind"]?.GetValue<string>() is "copy" or "move" or "delete" or "deletePermanent" or "rename" or "newFolder" or "newFile"
                && msg["ids"] is JsonArray ids && ids.All(Full) && msg["flags"]?.GetValueKind() == JsonValueKind.Number
                && (msg["kind"]!.GetValue<string>() is "delete" or "deletePermanent" or "rename" || Full(msg["target"])):
            {
                var kind = msg["kind"]!.GetValue<string>();
                (bool Aborted, string? Error) result = (false, null);
                // IFileOperation on a thread of its own (STA), as the host runs it.
                var thread = new Thread(() =>
                {
                    try
                    {
                        result = (Shell.FileOps.Perform(kind, [.. ids.Select(i => i!.GetValue<string>())], msg["target"]?.GetValue<string>(),
                            IntPtr.Zero, msg["flags"]!.GetValue<uint>(), msg["name"]?.GetValue<string>(), null), null);
                    }
                    catch (Exception ex) when (ex is COMException or ArgumentException or IOException or UnauthorizedAccessException)
                    {
                        result = (false, ex.Message);
                    }
                });
                thread.SetApartmentState(ApartmentState.STA);
                thread.Start();
                thread.Join();
                return new JsonObject { ["aborted"] = result.Aborted, ["error"] = result.Error };
            }
            case "fileOp":
                return new JsonObject { ["error"] = "fileOp needs a file operation, full paths and its flags" };
            case "start" when msg["what"]?.GetValueKind() == JsonValueKind.String:
                return Shell.MacroRun.Run(Shell.MacroRun.Request.Of(msg.AsObject()) with { Admin = false, AdminForced = false, Rights = "" })
                    .GetAwaiter().GetResult();
            case "start":
                return new JsonObject { ["error"] = "start needs what it starts" };
            default:
                return new JsonObject { ["error"] = "not an operation of the helper" };
        }
    }

    // The owner of each path set to the user; with `recursive`, of everything under a folder too (not through a link:
    // a link itself gets the owner, what it points to does not). Per path: done, or why not.
    internal static (int Done, JsonArray Failed) TakeOwnership(IReadOnlyList<string> paths, bool recursive, SecurityIdentifier sid)
    {
        var done = 0;
        var failed = new JsonArray();
        var bytes = new byte[sid.BinaryLength];
        sid.GetBinaryForm(bytes, 0);
        void One(string path)
        {
            var err = SetNamedSecurityInfo(path, 1 /* SE_FILE_OBJECT */, 1 /* OWNER_SECURITY_INFORMATION */, bytes, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
            if (err == 0) done++;
            else failed.Add(new JsonObject { ["path"] = path, ["error"] = new Win32Exception(err).Message });
        }
        void Walk(string folder)
        {
            IEnumerable<string> entries;
            try { entries = Directory.EnumerateFileSystemEntries(folder).ToList(); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                failed.Add(new JsonObject { ["path"] = folder, ["error"] = ex.Message });
                return;
            }
            foreach (var entry in entries)
            {
                One(entry);
                FileAttributes attributes;
                try { attributes = File.GetAttributes(entry); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { continue; }
                if ((attributes & FileAttributes.Directory) != 0 && (attributes & FileAttributes.ReparsePoint) == 0) Walk(entry);
            }
        }
        foreach (var path in paths)
        {
            One(path);
            if (recursive && Directory.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) == 0) Walk(path);
        }
        return (done, failed);
    }

    static void EnablePrivilege(string name)
    {
        if (!OpenProcessToken(Process.GetCurrentProcess().Handle, 0x28 /* ADJUST_PRIVILEGES | QUERY */, out var token)) return;
        try
        {
            if (!LookupPrivilegeValue(null, name, out var luid)) return;
            var privileges = new TokenPrivileges { Count = 1, Luid = luid, Attributes = 2 /* SE_PRIVILEGE_ENABLED */ };
            AdjustTokenPrivileges(token, false, ref privileges, 0, IntPtr.Zero, IntPtr.Zero);
        }
        finally { CloseHandle(token); }
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    struct TokenPrivileges { public int Count; public long Luid; public int Attributes; }

    [DllImport("advapi32.dll", SetLastError = true)]
    static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool LookupPrivilegeValue(string? system, string name, out long luid);

    [DllImport("advapi32.dll", SetLastError = true)]
    static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TokenPrivileges state, int length, IntPtr previous, IntPtr returned);

    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
    static extern int SetNamedSecurityInfo(string name, int type, int info, byte[] owner, IntPtr group, IntPtr dacl, IntPtr sacl);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out int clientProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out int serverProcessId);

    // ---------- In Foldex: the session (plan 31 3.3) ----------

    /// <summary>
    /// The helper as Foldex uses it: started through UAC at the first operation, kept for the minutes of the setting
    /// helperMinutes after its last one (0: ended after each), so a series asks UAC once; ended at once by `End` (the
    /// shield on the ribbon) and when Foldex goes (the pipe closes). `changed` tells whether it runs.
    /// </summary>
    public sealed class Session(Func<int> minutes, Action<bool> changed) : IDisposable
    {
        readonly SemaphoreSlim gate = new(1, 1);
        Process? helper;
        NamedPipeClientStream? pipe;
        StreamReader? reader;
        StreamWriter? writer;
        System.Threading.Timer? idle;

        public bool Running => pipe?.IsConnected == true && helper is { HasExited: false };

        /// <summary>One operation: its answer, or { error } (UAC refused, the helper gone).</summary>
        public async Task<JsonObject> Ask(JsonObject request)
        {
            await gate.WaitAsync();
            try
            {
                if (!Running && await Start() is string why) return new JsonObject { ["error"] = why };
                idle?.Dispose();
                idle = null;
                await writer!.WriteLineAsync(request.ToJsonString());
                var answer = await reader!.ReadLineAsync();
                if (answer is null) { Close(); return new JsonObject { ["error"] = "the helper gave no answer" }; }
                Keep();
                return JsonNode.Parse(answer)!.AsObject();
            }
            catch (Exception ex) when (ex is IOException or ObjectDisposedException)
            {
                Close();
                return new JsonObject { ["error"] = ex.Message };
            }
            finally { gate.Release(); }
        }

        // Started now (UAC asks); null when it runs, else why not.
        async Task<string?> Start()
        {
            Close();
            var pipeName = "Foldex-helper-" + Guid.NewGuid().ToString("N");
            try
            {
                helper = Process.Start(new ProcessStartInfo(Environment.ProcessPath!, $"{Switch} {pipeName} {Environment.ProcessId}")
                {
                    UseShellExecute = true,
                    Verb = "runas",
                })!;
            }
            catch (Win32Exception ex) when (ex.NativeErrorCode == 1223) { return "cancelled at the administrator prompt"; }
            try
            {
                pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
                await pipe.ConnectAsync(30_000);
                // Only the helper this Foldex started.
                if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out var server) || server != helper.Id)
                {
                    Close();
                    return "the pipe is not the helper's";
                }
                reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
                writer = new StreamWriter(pipe, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
                changed(true);
                return null;
            }
            catch (Exception ex) when (ex is TimeoutException or IOException)
            {
                Close();
                return ex.Message;
            }
        }

        // After an operation: kept for its minutes, then ended.
        void Keep()
        {
            var ms = Math.Max(0, minutes()) * 60_000;
            if (ms == 0) { Close(); return; }
            idle = new System.Threading.Timer(_ => End(), null, ms, Timeout.Infinite);
        }

        /// <summary>Ended now (the shield clicked; its time over): the pipe closes, so the helper exits.</summary>
        public void End()
        {
            if (!gate.Wait(0)) return;   // an operation runs: its end keeps or ends it
            try { Close(); }
            finally { gate.Release(); }
        }

        void Close()
        {
            var was = pipe is not null;
            idle?.Dispose();
            idle = null;
            reader?.Dispose();
            writer?.Dispose();
            pipe?.Dispose();
            helper?.Dispose();
            reader = null;
            writer = null;
            pipe = null;
            helper = null;
            if (was) changed(false);
        }

        public void Dispose() => Close();
    }
}
