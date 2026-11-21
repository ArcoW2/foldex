using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// A Windows preview handler (Office and the like, docs/plans/executed/04-PLAN-preview.md 3.2) in a native window of its own,
/// laid over the page where the page says its preview area is. A native window covers the page's popups
/// (docs/plans/02-PLAN-ui-technology.md 3.3): while one is open, the page asks for a snapshot, shows that in the
/// area, and the native window is hidden until the popup closes. A lister plugin's window (docs/plans/executed/33-PLAN-preview-plugins.md
/// 3.2) lies in the same panel, made by the plugin helper in its own process. On the UI thread.
/// </summary>
sealed class PreviewHost : IDisposable
{
    readonly Panel panel;
    IPreviewHandler? handler;
    string? shownPath;
    // A lister plugin's view: the helper's window in the panel, the plugin, and this preview's key with the helper.
    readonly string key = Guid.NewGuid().ToString("N");
    Listers? listers;
    Lister? lister;
    IntPtr listerWindow;
    int shows;   // each show and unload: a plugin's answer for an earlier one is not shown
    readonly PreviewFrame frame;
    Action? escape;

    public PreviewHost(Control parent)
    {
        panel = new Panel { Visible = false, BackColor = SystemColors.Window };
        parent.Controls.Add(panel);
        panel.BringToFront();
        frame = new PreviewFrame(panel, () => escape?.Invoke());
    }

    public bool Visible => panel.Visible;

    /// <summary>The preview handler registered for a file's type, or null.</summary>
    public static Guid? HandlerFor(string path)
    {
        var ext = Path.GetExtension(path);
        if (string.IsNullOrEmpty(ext)) return null;
        uint size = 64;
        var buffer = new char[size];
        // ASSOCSTR_SHELLEXTENSION (16): the handler's CLSID for the shellex key of the preview handler.
        if (Native.AssocQueryString(0, 16, ext, Native.PreviewHandlerKey, buffer, ref size) < 0) return null;
        return Guid.TryParse(new string(buffer, 0, (int)size - 1), out var clsid) ? clsid : null;
    }

    /// <summary>Shows a file in its preview handler over `bounds` (in the parent's client pixels). The handler and how
    /// it was started, or an error. `escape`: Esc in the handler's window that the handler did not use (it hands it to
    /// its site, PreviewFrame).</summary>
    public (string? Handler, string? Error) Show(string path, Rectangle bounds, Action escape)
    {
        Unload();
        this.escape = escape;
        if (HandlerFor(path) is not Guid clsid) return (null, "no preview handler for this type");
        // Out of process first (most handlers run in the shell's surrogate, prevhost.exe), else in process.
        var hr = Native.CoCreateInstance(clsid, IntPtr.Zero, Native.ClsctxLocalServer, typeof(IPreviewHandler).GUID, out var ptr);
        var how = "local server";
        if (hr < 0)
        {
            hr = Native.CoCreateInstance(clsid, IntPtr.Zero, Native.ClsctxInprocServer, typeof(IPreviewHandler).GUID, out ptr);
            how = "in process";
        }
        if (hr < 0) return (clsid.ToString("B"), $"the handler did not start (0x{hr:X8})");
        var h = (IPreviewHandler)Marshal.GetObjectForIUnknown(ptr);
        Marshal.Release(ptr);
        try
        {
            how += ", " + Initialize(h, path);
            if (h is IObjectWithSite withSite) withSite.SetSite(frame);
            panel.Bounds = bounds;
            panel.Visible = true;
            panel.BringToFront();
            var rect = new Rect(new Rectangle(Point.Empty, bounds.Size));
            h.SetWindow(panel.Handle, ref rect);
            h.DoPreview();
            handler = h;
            shownPath = path;
            // A handler that may keep its keys in a process of its own (WebView2's: Edge's PDF, PowerToys'): its Esc
            // watched, not taken. LexPen's hands Esc on itself when it does not use it.
            if (!LexPenHandler.Is(clsid)) EscWatch.Add(this);
            return ($"{clsid:B} ({how})", null);
        }
        catch (Exception ex) when (ex is COMException or InvalidCastException or IOException)
        {
            panel.Visible = false;
            LetGo(h);
            Marshal.ReleaseComObject(h);
            return (clsid.ToString("B"), ex.Message);
        }
    }

    // A handler takes a stream, a file or a shell item; the stream first (the one every out-of-process handler takes).
    static string Initialize(IPreviewHandler h, string path)
    {
        const uint mode = Native.StgmRead | Native.StgmShareDenyNone;
        if (h is IInitializeWithStream withStream)
        {
            Native.SHCreateStreamOnFileEx(path, mode, 0, false, IntPtr.Zero, out var stream);
            withStream.Initialize(stream, Native.StgmRead);
            return "stream";
        }
        if (h is IInitializeWithFile withFile)
        {
            withFile.Initialize(path, Native.StgmRead);
            return "file";
        }
        if (h is IInitializeWithItem withItem)
        {
            withItem.Initialize(Native.Item(path), Native.StgmRead);
            return "item";
        }
        throw new InvalidCastException("the handler takes no stream, file or item");
    }

    /// <summary>Shows a file in a lister plugin over `bounds`: the plugin's window, made by the helper in this panel (the
    /// same plugin again: the next file in its window, ListLoadNextW). The plugin, or an error. `stopped`: the helper
    /// went while it showed (the panel is hidden then); `escape`: Esc in the plugin's window.</summary>
    public async Task<(string? Handler, string? Error)> ShowLister(Listers with, Lister plugin, string path, Rectangle bounds, Action stopped, Action escape)
    {
        var same = listers == with && lister?.Path == plugin.Path && listerWindow != IntPtr.Zero;
        if (same) UnloadHandler();
        else Unload();
        var show = ++shows;
        listers = with;
        lister = plugin;
        panel.Bounds = bounds;
        panel.Visible = true;
        panel.BringToFront();
        var (window, error) = await with.Show(key, panel.Handle, bounds.Size, plugin, path, () =>
        {
            if (lister is null) return;
            listerWindow = IntPtr.Zero;
            lister = null;
            shownPath = null;
            panel.Visible = false;
            stopped();
        }, escape);
        if (show != shows) return (plugin.Name, "another file was asked for");
        if (error is not null)
        {
            lister = null;
            listerWindow = IntPtr.Zero;
            panel.Visible = false;
            return (plugin.Name, error);
        }
        listerWindow = window;
        shownPath = path;
        return ($"{plugin.Name} (lister plugin)", null);
    }

    public void Move(Rectangle bounds)
    {
        panel.Bounds = bounds;
        if (listerWindow != IntPtr.Zero)
            SetWindowPos(listerWindow, IntPtr.Zero, 0, 0, bounds.Width, bounds.Height, 0x4014 /* SWP_ASYNCWINDOWPOS | SWP_NOACTIVATE | SWP_NOZORDER */);
        if (handler is null) return;
        var rect = new Rect(new Rectangle(Point.Empty, bounds.Size));
        handler.SetRect(ref rect);
    }

    /// <summary>What the handler shows now, as a PNG data URL, and the window hidden; for the page to show while one of
    /// its popups is open over the area. Drawn by the window itself (PrintWindow), not read from the screen: a copy of
    /// the screen takes whatever lies on top when Foldex is not in front (plan 02 3.7, item 4).</summary>
    public string? Snapshot()
    {
        if (!panel.Visible || panel.Width == 0 || panel.Height == 0) return null;
        using var bitmap = new Bitmap(panel.Width, panel.Height);
        using (var g = Graphics.FromImage(bitmap))
        {
            var hdc = g.GetHdc();
            try { PrintWindow(panel.Handle, hdc, 2); }   // PW_RENDERFULLCONTENT: the handler's child windows too
            finally { g.ReleaseHdc(hdc); }
        }
        panel.Visible = false;
        using var stream = new MemoryStream();
        bitmap.Save(stream, ImageFormat.Png);
        return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
    }

    // For EscWatch: the window with the keyboard lies in this preview, and its escape (posted, not run in the hook).
    internal bool Holds(IntPtr window) => panel.Visible && IsChild(panel.Handle, window);
    internal void Escaped() { if (escape is { } e) panel.BeginInvoke(e); }

    [DllImport("user32.dll")]
    static extern bool IsChild(IntPtr parent, IntPtr window);

    /// <summary>The native window hidden while a menu of the preview's own page lies over it (plan 33 3.1).</summary>
    public void Hide() => panel.Visible = false;

    /// <summary>The native window shown again after a snapshot.</summary>
    public void Restore()
    {
        if (handler is null && listerWindow == IntPtr.Zero) return;
        panel.Visible = true;
        panel.BringToFront();
    }

    public string? ShownPath => shownPath;

    [DllImport("user32.dll")]
    static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);

    public void Unload()
    {
        shows++;
        if (lister is not null)
        {
            listers!.Close(key);
            lister = null;
            listerWindow = IntPtr.Zero;
        }
        UnloadHandler();
    }

    void UnloadHandler()
    {
        EscWatch.Remove(this);
        if (handler is not null)
        {
            try { handler.Unload(); }
            catch (COMException) { }
            LetGo(handler);
            Marshal.ReleaseComObject(handler);
            handler = null;
        }
        shownPath = null;
        panel.Visible = false;
    }

    // The handler's site taken away: the host is done with it (a handler may keep its window until then, as LexPen's).
    static void LetGo(IPreviewHandler h)
    {
        try { if (h is IObjectWithSite withSite) withSite.SetSite(null); }
        catch (COMException) { }
    }

    public void Dispose()
    {
        Unload();
        panel.Dispose();
    }
}

/// <summary>
/// Esc pressed while the keyboard is in a watched handler's window (any process, under its preview's panel): the key
/// goes on to the handler as always (a low-level keyboard hook that only looks), and the preview gets its escape too.
/// For handlers whose keys never come back through the site. The hook is there only while such a handler is shown.
/// </summary>
static class EscWatch
{
    static readonly HashSet<PreviewHost> hosts = [];
    static IntPtr hook;
    static readonly HookProc Proc = Look;   // kept alive while the hook is set

    public static void Add(PreviewHost host)
    {
        hosts.Add(host);
        if (hook == IntPtr.Zero) hook = SetWindowsHookEx(13 /* WH_KEYBOARD_LL */, Proc, GetModuleHandle(null), 0);
    }

    public static void Remove(PreviewHost host)
    {
        if (!hosts.Remove(host) || hosts.Count > 0 || hook == IntPtr.Zero) return;
        UnhookWindowsHookEx(hook);
        hook = IntPtr.Zero;
    }

    static IntPtr Look(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0 && message == 0x100 /* WM_KEYDOWN */ && Marshal.ReadInt32(data) == 0x1B /* VK_ESCAPE */)
        {
            var info = new GuiThreadInfo { Size = Marshal.SizeOf<GuiThreadInfo>() };
            if (GetGUIThreadInfo(0, ref info) && info.Focus != IntPtr.Zero)
                hosts.FirstOrDefault(h => h.Holds(info.Focus))?.Escaped();
        }
        return CallNextHookEx(hook, code, message, data);
    }

    delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);

    [StructLayout(LayoutKind.Sequential)]
    struct GuiThreadInfo { public int Size, Flags; public IntPtr Active, Focus, Capture, MenuOwner, MoveSize, Caret; public int L, T, R, B; }

    [DllImport("user32.dll")]
    static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);

    [DllImport("user32.dll")]
    static extern bool UnhookWindowsHookEx(IntPtr hook);

    [DllImport("user32.dll")]
    static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);

    [DllImport("user32.dll")]
    static extern bool GetGUIThreadInfo(uint thread, ref GuiThreadInfo info);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr GetModuleHandle(string? name);
}

/// <summary>
/// The site Foldex gives a preview handler (IPreviewHandlerFrame): Esc is the one key Foldex wants from it. A handler
/// hands on a key of the table that it does not use itself (prevhost.exe does so for the handlers it runs; a handler
/// of its own process, as LexPen's, does so itself), and Foldex treats it as Esc in the preview. Called by COM on the
/// window's thread; the escape is posted, not run inside the call.
/// </summary>
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
sealed class PreviewFrame(Control owner, Action escape) : IPreviewHandlerFrame
{
    const uint WmKeyDown = 0x100, VkEscape = 0x1B;
    static readonly IntPtr Keys = CreateAcceleratorTable([new Accel { Virt = 1 /* FVIRTKEY */, Key = (ushort)VkEscape, Cmd = 1 }], 1);

    public int GetWindowContext(IntPtr info)
    {
        Marshal.WriteIntPtr(info, Keys);
        Marshal.WriteInt32(info, IntPtr.Size, 1);
        return 0;
    }

    public int TranslateAccelerator(IntPtr pmsg)
    {
        var m = Marshal.PtrToStructure<Msg>(pmsg);
        if (m.Message != WmKeyDown || (uint)m.WParam != VkEscape) return 1;   // S_FALSE: not Foldex's
        owner.BeginInvoke(escape);
        return 0;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct Accel { public byte Virt; public ushort Key; public ushort Cmd; }

    [StructLayout(LayoutKind.Sequential)]
    struct Msg { public IntPtr Hwnd; public uint Message; public IntPtr WParam, LParam; public uint Time; public int X, Y; }

    [DllImport("user32.dll")]
    static extern IntPtr CreateAcceleratorTable(Accel[] accels, int count);
}
