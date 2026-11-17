using System.Runtime.InteropServices;

namespace Foldex;

/// <summary>
/// Windows' virtual desktops, through the documented IVirtualDesktopManager (from LexPen; docs/plans/executed/15-PLAN-projects.md
/// 3.5): which desktop a window is on, whether it is on the one shown now, and moving one of our windows to a desktop.
/// Every call fails quietly (null, true, false): without desktops (an error, an older Windows) a window simply stays
/// where it opens.
/// </summary>
static class VirtualDesktop
{
    [ComImport, Guid("a5cd92ff-29be-454c-8d04-d82879fb3f1b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IVirtualDesktopManager
    {
        [PreserveSig] int IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow, [MarshalAs(UnmanagedType.Bool)] out bool onCurrentDesktop);
        [PreserveSig] int GetWindowDesktopId(IntPtr topLevelWindow, out Guid desktopId);
        [PreserveSig] int MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
    }

    [ComImport, Guid("aa509086-5ca9-4c25-8f95-589d3c07b48a")]
    class VirtualDesktopManagerClass;

    static IVirtualDesktopManager? manager;
    static bool failed;

    static IVirtualDesktopManager? Manager
    {
        get
        {
            if (manager is null && !failed)
                try { manager = (IVirtualDesktopManager)new VirtualDesktopManagerClass(); }
                catch (Exception ex) when (ex is COMException or InvalidCastException) { failed = true; }
            return manager;
        }
    }

    /// <summary>Whether Windows has virtual desktops for us (the interface could be made).</summary>
    public static bool Available => Manager is not null;

    /// <summary>The id of the desktop the window is on; null when unknown (also for a window Windows does not know
    /// yet: just shown, its first messages not handled).</summary>
    public static string? DesktopOf(IntPtr window)
    {
        try
        {
            return Manager?.GetWindowDesktopId(window, out var id) == 0 && id != Guid.Empty ? id.ToString() : null;
        }
        catch (COMException) { return null; }
    }

    /// <summary>Whether the window is on the desktop shown now (true when that cannot be told).</summary>
    public static bool OnCurrentDesktop(IntPtr window)
    {
        try { return Manager?.IsWindowOnCurrentVirtualDesktop(window, out var on) != 0 || on; }
        catch (COMException) { return true; }
    }

    /// <summary>Moves one of our windows to a desktop; false when it could not (the desktop is gone, no desktops).</summary>
    public static bool MoveTo(IntPtr window, string? desktop)
    {
        if (desktop is null || !Guid.TryParse(desktop, out var id) || Manager is not { } m) return false;
        try { return m.MoveWindowToDesktop(window, ref id) == 0; }
        catch (COMException) { return false; }
    }
}
