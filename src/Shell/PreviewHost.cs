using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// A Windows preview handler (Office and the like, docs/plans/executed/04-PLAN-preview.md 3.2) in a native window of its own,
/// laid over the page where the page says its preview area is. A native window covers the page's popups
/// (docs/plans/02-PLAN-ui-technology.md 3.3): while one is open, the page asks for a snapshot, shows that in the
/// area, and the native window is hidden until the popup closes. A lister plugin's window (docs/plans/33-PLAN-preview-plugins.md
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

    public PreviewHost(Control parent)
    {
        panel = new Panel { Visible = false, BackColor = SystemColors.Window };
        parent.Controls.Add(panel);
        panel.BringToFront();
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

    /// <summary>Shows a file in its preview handler over `bounds` (in the parent's client pixels); `given`: that handler
    /// (LexPen's, plan 33 3.3) instead of the type's. The handler and how it was started, or an error.</summary>
    public (string? Handler, string? Error) Show(string path, Rectangle bounds, Guid? given = null)
    {
        Unload();
        if ((given ?? HandlerFor(path)) is not Guid clsid) return (null, "no preview handler for this type");
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
            panel.Bounds = bounds;
            panel.Visible = true;
            panel.BringToFront();
            var rect = new Rect(new Rectangle(Point.Empty, bounds.Size));
            h.SetWindow(panel.Handle, ref rect);
            h.DoPreview();
            handler = h;
            shownPath = path;
            return ($"{clsid:B} ({how})", null);
        }
        catch (Exception ex) when (ex is COMException or InvalidCastException or IOException)
        {
            panel.Visible = false;
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
        if (handler is not null)
        {
            try { handler.Unload(); }
            catch (COMException) { }
            Marshal.ReleaseComObject(handler);
            handler = null;
        }
        shownPath = null;
        panel.Visible = false;
    }

    public void Dispose()
    {
        Unload();
        panel.Dispose();
    }
}
