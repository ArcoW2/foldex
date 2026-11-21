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
/// The plugin helper (docs/plans/executed/33-PLAN-preview-plugins.md 3.2): Foldex.exe --lister-helper &lt;pipe&gt; &lt;parent id&gt;,
/// unelevated, no WebView2. It loads Total Commander lister plugins (64-bit WLX DLLs) and makes their viewer windows,
/// each in a window of its own that is a child of the preview's panel in Foldex (across the processes, as a preview
/// handler in prevhost.exe is): a plugin that crashes or hangs takes this process with it, not Foldex. It serves a pipe
/// only its parent may use and exits when the pipe closes (Foldex let it go, or went).
/// </summary>
static class ListerHelper
{
    public const string Switch = "--lister-helper";

    // ---------- In the helper ----------

    public static void Run(string pipeName, int parentId)
    {
        ApplicationConfiguration.Initialize();   // the same DPI awareness as Foldex: its windows are Foldex's children
        var user = WindowsIdentity.GetCurrent().User!;
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.ReadWrite, AccessControlType.Allow));
        // Overlapped: an event (Esc) is written while the next request is being read; on a synchronous pipe the write
        // would wait for that read.
        using var server = NamedPipeServerStreamAcl.Create(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous, 0, 0, security);
        if (!server.WaitForConnectionAsync().Wait(TimeSpan.FromSeconds(30))) return;
        if (!GetNamedPipeClientProcessId(server.SafePipeHandle.DangerousGetHandle(), out var client) || client != parentId) return;
        var reader = new StreamReader(server, Encoding.UTF8, leaveOpen: true);
        var writer = new StreamWriter(server, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
        void Write(JsonObject o) { lock (writer) writer.WriteLine(o.ToJsonString()); }
        // The plugins' windows live on this (the UI) thread; the pipe is read on another and each request run here.
        using var ui = new Control();
        ui.CreateControl();
        var views = new Views(e => Write(e));
        Application.AddMessageFilter(views);
        new Thread(() =>
        {
            try
            {
                while (reader.ReadLine() is string line)
                {
                    var answer = (JsonObject)ui.Invoke(() => views.Answer(line));
                    Write(answer);
                }
            }
            catch (IOException) { }
            ui.BeginInvoke(Application.ExitThread);
        }) { IsBackground = true }.Start();
        Application.Run();
    }

    // A plugin's DLL loaded, with its functions (ListLoadW, else the ANSI ListLoad; the others when it has them).
    sealed class Plugin
    {
        [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Unicode)] public delegate IntPtr LoadW(IntPtr parent, string file, int flags);
        [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Ansi)] public delegate IntPtr LoadA(IntPtr parent, string file, int flags);
        [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Unicode)] public delegate int LoadNextW(IntPtr parent, IntPtr window, string file, int flags);
        [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Ansi)] public delegate int LoadNextA(IntPtr parent, IntPtr window, string file, int flags);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void Close(IntPtr window);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void Detect(IntPtr buffer, int max);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] public delegate void SetDefaults(ref DefaultParams p);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public struct DefaultParams
        {
            public int Size;
            public uint VersionLow, VersionHi;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string IniName;
        }

        public readonly string Path;
        readonly LoadW? loadW;
        readonly LoadA? loadA;
        readonly LoadNextW? nextW;
        readonly LoadNextA? nextA;
        readonly Close? close;
        readonly Detect? detect;

        public Plugin(string path)
        {
            Path = path;
            var module = LoadLibraryEx(path, IntPtr.Zero, 8 /* LOAD_WITH_ALTERED_SEARCH_PATH: its own DLLs beside it */);
            if (module == IntPtr.Zero) throw new IOException($"the plugin did not load ({new System.ComponentModel.Win32Exception().Message})");
            T? Fn<T>(string name) where T : Delegate =>
                GetProcAddress(module, name) is var p && p != IntPtr.Zero ? Marshal.GetDelegateForFunctionPointer<T>(p) : null;
            loadW = Fn<LoadW>("ListLoadW");
            loadA = Fn<LoadA>("ListLoad");
            nextW = Fn<LoadNextW>("ListLoadNextW");
            nextA = Fn<LoadNextA>("ListLoadNext");
            close = Fn<Close>("ListCloseWindow");
            detect = Fn<Detect>("ListGetDetectString");
            if (loadW is null && loadA is null) throw new IOException("this is no lister plugin (it has no ListLoad)");
            // Its settings file, as Total Commander gives one (lsplugin.ini), beside the plugins of Foldex's data folder.
            if (Fn<SetDefaults>("ListSetDefaultParams") is { } set)
            {
                var p = new DefaultParams { Size = Marshal.SizeOf<DefaultParams>(), VersionLow = 0, VersionHi = 2,
                    IniName = System.IO.Path.Combine(AppHost.DataDir, Listers.FolderName, "lsplugin.ini") };
                set(ref p);
            }
        }

        public string DetectString()
        {
            if (detect is null) return "";
            var buffer = Marshal.AllocHGlobal(2048);
            try
            {
                Marshal.WriteByte(buffer, 0);
                detect(buffer, 2047);
                return Marshal.PtrToStringAnsi(buffer) ?? "";
            }
            finally { Marshal.FreeHGlobal(buffer); }
        }

        public IntPtr Load(IntPtr parent, string file, int flags) => loadW is not null ? loadW(parent, file, flags) : loadA!(parent, file, flags);

        public bool HasNext => nextW is not null || nextA is not null;
        public bool LoadNext(IntPtr parent, IntPtr window, string file, int flags) =>
            (nextW is not null ? nextW(parent, window, file, flags) : nextA!(parent, window, file, flags)) == 0;   // LISTPLUGIN_OK

        public void CloseWindow(IntPtr window)
        {
            if (close is not null) close(window);
            else DestroyWindow(window);
        }
    }

    // The window a plugin's window lies in: a child of Foldex's panel; the plugin's window fills it.
    sealed class Holder : NativeWindow
    {
        public IntPtr Child;

        public Holder(IntPtr parent, int width, int height) =>
            CreateHandle(new CreateParams { Parent = parent, Style = WsChild | WsVisible | WsClipChildren, Width = width, Height = height });

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x0005 /* WM_SIZE */ && Child != IntPtr.Zero)
                MoveWindow(Child, 0, 0, (int)(m.LParam & 0xFFFF), (int)((m.LParam >> 16) & 0xFFFF), true);
            else if (m.Msg == 0x0007 /* WM_SETFOCUS */ && Child != IntPtr.Zero) SetFocus(Child);
            base.WndProc(ref m);
        }
    }

    // The flags of ListLoadW: the text wrapped, a picture fitted to the window when larger, centred.
    const int ShowFlags = 1 | 2 | 32 | 64;

    sealed class Views(Action<JsonObject> tell) : IMessageFilter
    {
        readonly Dictionary<string, Plugin> plugins = new(StringComparer.OrdinalIgnoreCase);
        readonly Dictionary<string, (Holder Holder, Plugin Plugin, IntPtr Window)> views = [];

        Plugin PluginOf(string path)
        {
            if (!plugins.TryGetValue(path, out var p)) plugins[path] = p = new Plugin(path);
            return p;
        }

        static bool Full(JsonNode? path) => path?.GetValueKind() == JsonValueKind.String && System.IO.Path.IsPathFullyQualified(path.GetValue<string>());

        public JsonObject Answer(string line)
        {
            JsonObject answer;
            JsonNode? msg = null;
            try
            {
                msg = JsonNode.Parse(line);
                answer = msg?["op"]?.GetValue<string>() switch
                {
                    "detect" when Full(msg["plugin"]) => DetectOf(msg["plugin"]!.GetValue<string>()),
                    "load" when Full(msg["plugin"]) && Full(msg["path"]) && msg["view"] is not null && msg["parent"] is not null => Load(msg),
                    "close" when msg["view"] is not null => Close(msg["view"]!.GetValue<string>()),
                    _ => new JsonObject { ["error"] = "not an operation of the plugin helper" },
                };
            }
            catch (Exception ex) when (ex is JsonException or IOException or InvalidOperationException or FormatException or ArgumentException)
            {
                answer = new JsonObject { ["error"] = ex.Message };
            }
            answer["id"] = msg?["id"]?.DeepClone();
            return answer;
        }

        JsonObject DetectOf(string path) =>
            new() { ["name"] = System.IO.Path.GetFileNameWithoutExtension(path), ["detect"] = PluginOf(path).DetectString() };

        JsonObject Load(JsonNode msg)
        {
            var view = msg["view"]!.GetValue<string>();
            var parent = new IntPtr(msg["parent"]!.GetValue<long>());
            var file = msg["path"]!.GetValue<string>();
            var plugin = PluginOf(msg["plugin"]!.GetValue<string>());
            int w = msg["width"]?.GetValue<int>() ?? 0, h = msg["height"]?.GetValue<int>() ?? 0;
            if (!IsWindow(parent)) return new JsonObject { ["error"] = "the preview's window is gone" };
            // The same plugin in the same place: the next file in its window (ListLoadNextW), when it takes it.
            if (views.TryGetValue(view, out var was) && was.Plugin == plugin && plugin.HasNext && GetParent(was.Holder.Handle) == parent
                && plugin.LoadNext(was.Holder.Handle, was.Window, file, ShowFlags))
                return new JsonObject { ["window"] = (long)was.Holder.Handle, ["next"] = true };
            Close(view);
            var holder = new Holder(parent, w, h);
            var window = plugin.Load(holder.Handle, file, ShowFlags);
            if (window == IntPtr.Zero)
            {
                holder.DestroyHandle();
                return new JsonObject { ["error"] = "the plugin does not show this file" };
            }
            holder.Child = window;
            MoveWindow(window, 0, 0, w, h, true);
            ShowWindow(window, 5 /* SW_SHOW */);
            views[view] = (holder, plugin, window);
            return new JsonObject { ["window"] = (long)holder.Handle };
        }

        JsonObject Close(string view)
        {
            if (views.Remove(view, out var v))
            {
                if (IsWindow(v.Window)) v.Plugin.CloseWindow(v.Window);
                v.Holder.DestroyHandle();
            }
            return [];
        }

        // Esc in a plugin's window goes back to Foldex (the preview's own Esc: F3's window closes).
        public bool PreFilterMessage(ref Message m)
        {
            if (m.Msg != 0x0100 /* WM_KEYDOWN */ || (int)m.WParam != 0x1B /* VK_ESCAPE */) return false;
            foreach (var (view, v) in views)
                if (v.Holder.Handle == m.HWnd || IsChild(v.Holder.Handle, m.HWnd))
                {
                    tell(new JsonObject { ["event"] = "escape", ["view"] = view });
                    return true;
                }
            return false;
        }
    }

    const int WsChild = 0x40000000, WsVisible = 0x10000000, WsClipChildren = 0x02000000;

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Ansi)]
    static extern IntPtr GetProcAddress(IntPtr module, string name);

    [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr hwnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent, IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr hwnd);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out int clientProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out int serverProcessId);

    // ---------- In Foldex ----------

    /// <summary>
    /// The helper as Foldex uses it: started at the first plugin asked for, a request at a time answered by its id,
    /// within AnswerMs (a plugin that does not answer counts as hung: the helper is ended). When it goes (a plugin
    /// crashed, it hung, or it was let go) `stopped` is told; Esc in a plugin's window comes as `escape` with its view.
    /// </summary>
    public sealed class Client(Action stopped, Action<string> escape) : IDisposable
    {
        public const int AnswerMs = 10_000;
        readonly SemaphoreSlim gate = new(1, 1);
        Process? helper;
        NamedPipeClientStream? pipe;
        StreamWriter? writer;
        readonly Dictionary<int, TaskCompletionSource<JsonObject>> waiting = [];
        int nextId;

        public bool Running => pipe?.IsConnected == true && helper is { HasExited: false };

        public async Task<JsonObject> Ask(JsonObject request)
        {
            TaskCompletionSource<JsonObject> answer;
            await gate.WaitAsync();
            try
            {
                if (!Running && await Start() is string why) return new JsonObject { ["error"] = why };
                var id = ++nextId;
                answer = new TaskCompletionSource<JsonObject>(TaskCreationOptions.RunContinuationsAsynchronously);
                lock (waiting) waiting[id] = answer;
                request["id"] = id;
                await writer!.WriteLineAsync(request.ToJsonString());
            }
            catch (Exception ex) when (ex is IOException or ObjectDisposedException)
            {
                Close();
                return new JsonObject { ["error"] = ex.Message };
            }
            finally { gate.Release(); }
            if (await Task.WhenAny(answer.Task, Task.Delay(AnswerMs)) == answer.Task) return answer.Task.Result;
            Close();   // hung: ended, as a crash
            return new JsonObject { ["error"] = "the plugin did not answer in time" };
        }

        async Task<string?> Start()
        {
            Close();
            var pipeName = "Foldex-lister-" + Guid.NewGuid().ToString("N");
            try
            {
                helper = Process.Start(new ProcessStartInfo(Environment.ProcessPath!, $"{Switch} {pipeName} {Environment.ProcessId}")
                    { UseShellExecute = false, CreateNoWindow = true })!;
                pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                await pipe.ConnectAsync(30_000);
                if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out var server) || server != helper.Id)
                {
                    Close();
                    return "the pipe is not the plugin helper's";
                }
                writer = new StreamWriter(pipe, new UTF8Encoding(false), leaveOpen: true) { AutoFlush = true };
                var reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
                var mine = pipe;
                _ = Task.Run(() => Read(reader, mine));
                return null;
            }
            catch (Exception ex) when (ex is TimeoutException or IOException or System.ComponentModel.Win32Exception)
            {
                Close();
                return ex.Message;
            }
        }

        async Task Read(StreamReader reader, NamedPipeClientStream mine)
        {
            try
            {
                while (await reader.ReadLineAsync() is string line)
                {
                    if (JsonNode.Parse(line) is not JsonObject o) continue;
                    if (o["event"]?.GetValue<string>() == "escape") { escape(o["view"]?.GetValue<string>() ?? ""); continue; }
                    TaskCompletionSource<JsonObject>? t = null;
                    if (o["id"]?.GetValue<int>() is int id) lock (waiting) waiting.Remove(id, out t);
                    t?.TrySetResult(o);
                }
            }
            catch (Exception ex) when (ex is IOException or ObjectDisposedException or JsonException) { }
            reader.Dispose();
            if (pipe == mine) Close();
        }

        /// <summary>Let go of (no plugin's view left a while): the pipe closes, so the helper exits.</summary>
        public void End() => Close();

        void Close()
        {
            var was = pipe is not null;
            writer?.Dispose();
            pipe?.Dispose();
            // Its pipe closed, it exits; one that hangs (and still holds its windows) is ended.
            try { if (helper is { HasExited: false } h && !h.WaitForExit(500)) h.Kill(); } catch (InvalidOperationException) { }
            helper?.Dispose();
            writer = null;
            pipe = null;
            helper = null;
            List<TaskCompletionSource<JsonObject>> left;
            lock (waiting) { left = [.. waiting.Values]; waiting.Clear(); }
            foreach (var t in left) t.TrySetResult(new JsonObject { ["error"] = "the plugin helper stopped" });
            if (was) stopped();
        }

        public void Dispose() => Close();
    }
}
