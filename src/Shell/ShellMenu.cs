using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// Explorer's own right-click menu for items, with every installed extension (docs/plans/02-PLAN-ui-technology.md
/// 3.1): built from the items' shell array, shown as a native popup at the mouse, the chosen command run by the shell.
/// The owner window forwards the menu's messages (<see cref="HandleMessage"/>) so extensions that draw their own items
/// (IContextMenu3) work. Built and shown on the UI thread.
/// </summary>
sealed class ShellMenu : IDisposable
{
    const uint FirstId = 1, LastId = 0x7FFF;
    const uint MfByPosition = 0x400;
    const int WmInitMenuPopup = 0x117, WmDrawItem = 0x2B, WmMeasureItem = 0x2C, WmMenuChar = 0x120;

    /// <summary>The menu being shown, for the owner's message forwarding.</summary>
    public static ShellMenu? Current { get; private set; }

    readonly IContextMenu menu;
    readonly IContextMenu3? menu3;
    readonly IntPtr hmenu;

    ShellMenu(IContextMenu menu, IntPtr hmenu)
    {
        this.menu = menu;
        this.hmenu = hmenu;
        menu3 = menu as IContextMenu3;
    }

    /// <summary>The menu for items (parsing names), filled; null and why when the shell cannot make one (for example
    /// items from different folders, docs/plans/06 3.4).</summary>
    public static (ShellMenu? Menu, string? Error) Create(IReadOnlyList<string> ids, bool extended)
    {
        if (ids.Count == 0) return (null, "no items");
        IntPtr[] pidls;
        try { pidls = Native.IdLists(ids); }
        catch (Exception ex) when (ex is COMException or ArgumentException) { return (null, ex.Message); }
        try
        {
            Native.SHCreateShellItemArrayFromIDLists((uint)pidls.Length, pidls, out var array);
            var hr = array.BindToHandler(IntPtr.Zero, Native.BhidSFUIObject, Native.IidIContextMenu, out var ptr);
            Marshal.ReleaseComObject(array);
            // Items of different folders have no common parent and get no menu (E_FAIL). A try with the desktop folder's
            // GetUIObjectOf and their full ID lists ended in an access violation in coreclr (plan 02 3.7, item 7); not
            // pursued: such a selection gets Foldex's own menu (plan 06).
            if (hr < 0) return (null, $"the shell made no menu for these items (0x{hr:X8})");
            var cm = (IContextMenu)Marshal.GetObjectForIUnknown(ptr);
            Marshal.Release(ptr);
            var hmenu = Native.CreatePopupMenu();
            hr = cm.QueryContextMenu(hmenu, 0, FirstId, LastId,
                Native.CmfNormal | Native.CmfCanRename | (extended ? Native.CmfExtendedVerbs : 0));
            if (hr < 0)
            {
                Native.DestroyMenu(hmenu);
                Marshal.ReleaseComObject(cm);
                return (null, $"the menu could not be filled (0x{hr:X8})");
            }
            return (new ShellMenu(cm, hmenu), null);
        }
        catch (COMException ex) { return (null, ex.Message); }
        finally { Native.FreeIdLists(pidls); }
    }

    /// <summary>The menu's top-level texts, as shown ("&amp;Open", "", "Cu&amp;t", ...); "" is a separator.</summary>
    public List<string> Texts()
    {
        var texts = new List<string>();
        var buffer = new char[256];
        for (var i = 0; i < Native.GetMenuItemCount(hmenu); i++)
        {
            var n = Native.GetMenuString(hmenu, (uint)i, buffer, buffer.Length, MfByPosition);
            texts.Add(new string(buffer, 0, Math.Max(n, 0)));
        }
        return texts;
    }

    /// <summary>Shows the menu at a screen point and runs the chosen command; the command's verb ("delete", "properties",
    /// or "" when it has none), or null when nothing was chosen.</summary>
    public string? Show(IWin32Window owner, Point screen)
    {
        Current = this;
        int id;
        try { id = Native.TrackPopupMenuEx(hmenu, Native.TpmReturnCmd | Native.TpmRightButton, screen.X, screen.Y, owner.Handle, IntPtr.Zero); }
        finally { Current = null; }
        if (id <= 0) return null;
        var verb = Verb((uint)id - FirstId);
        Invoke(owner, (IntPtr)(id - (int)FirstId), null, screen);
        return verb;
    }

    /// <summary>Runs a command by its verb ("undelete", "delete", "properties") without showing the menu; false when
    /// the menu has no such verb.</summary>
    public bool InvokeVerb(IWin32Window owner, string verb)
    {
        var ansi = Marshal.StringToHGlobalAnsi(verb);
        try { return Invoke(owner, ansi, verb, Cursor.Position) >= 0; }
        finally { Marshal.FreeHGlobal(ansi); }
    }

    int Invoke(IWin32Window owner, IntPtr verbOrId, string? verbW, Point screen)
    {
        var verbWPtr = verbW is null ? verbOrId : Marshal.StringToHGlobalUni(verbW);
        try
        {
            var info = new CmInvokeCommandInfoEx
            {
                cbSize = Marshal.SizeOf<CmInvokeCommandInfoEx>(),
                fMask = Native.CmicMaskUnicode | Native.CmicMaskPtInvoke
                    | ((Control.ModifierKeys & Keys.Shift) != 0 ? Native.CmicMaskShiftDown : 0)
                    | ((Control.ModifierKeys & Keys.Control) != 0 ? Native.CmicMaskControlDown : 0),
                hwnd = owner.Handle,
                lpVerb = verbOrId,
                lpVerbW = verbWPtr,
                nShow = 1,   // SW_SHOWNORMAL
                ptInvoke = screen,
            };
            return menu.InvokeCommand(ref info);
        }
        finally
        {
            if (verbW is not null) Marshal.FreeHGlobal(verbWPtr);
        }
    }

    string Verb(uint offset)
    {
        var buffer = Marshal.AllocHGlobal(512);
        try
        {
            return menu.GetCommandString((UIntPtr)offset, Native.GcsVerbW, IntPtr.Zero, buffer, 256) >= 0
                ? Marshal.PtrToStringUni(buffer) ?? "" : "";
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    /// <summary>For the owner's WndProc while a menu is shown: true when the menu handled the message.</summary>
    public static bool HandleMessage(ref Message m)
    {
        if (Current?.menu3 is not { } cm3 || m.Msg is not (WmInitMenuPopup or WmDrawItem or WmMeasureItem or WmMenuChar)) return false;
        if (cm3.HandleMenuMsg2((uint)m.Msg, m.WParam, m.LParam, out var result) < 0) return false;
        m.Result = result;
        return true;
    }

    public void Dispose()
    {
        Native.DestroyMenu(hmenu);
        Marshal.ReleaseComObject(menu);
    }
}
