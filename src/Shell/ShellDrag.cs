using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// Dragging items out of Foldex into Explorer, Outlook, LexPen (docs/plans/02-PLAN-ui-technology.md 3.6): the page
/// reports the drag start, the host starts the shell's own drag with a shell data object, so the drag image and the
/// copy or move rules are Explorer's. On the UI thread, while the mouse button is still down.
/// </summary>
static class ShellDrag
{
    /// <summary>The drop effect the target chose (copy 1, move 2, link 4; 0: none), or an error.</summary>
    public static (uint Effect, string? Error, string Source) Start(IWin32Window owner, IReadOnlyList<string> ids)
    {
        IntPtr[] pidls;
        try { pidls = Native.IdLists(ids); }
        catch (Exception ex) when (ex is COMException or ArgumentException) { return (0, ex.Message, ""); }
        try
        {
            var (data, source) = DataObject(pidls);
            if (data == IntPtr.Zero) return (0, "the shell made no data object for these items", source);
            try
            {
                var hr = Native.SHDoDragDrop(owner.Handle, data, IntPtr.Zero,
                    Native.DropEffectCopy | Native.DropEffectMove | Native.DropEffectLink, out var effect);
                return hr < 0 ? (0, $"the drag failed (0x{hr:X8})", source) : (effect, null, source);
            }
            finally { Marshal.Release(data); }
        }
        finally { Native.FreeIdLists(pidls); }
    }

    // From the items' shell array first; for items of different folders, where that may fail, a data object of the
    // absolute ID lists (docs/plans/06 3.4).
    static (IntPtr Data, string Source) DataObject(IntPtr[] pidls)
    {
        try
        {
            Native.SHCreateShellItemArrayFromIDLists((uint)pidls.Length, pidls, out var array);
            var hr = array.BindToHandler(IntPtr.Zero, Native.BhidDataObject, Native.IidIDataObject, out var ptr);
            Marshal.ReleaseComObject(array);
            if (hr >= 0) return (ptr, "array");
        }
        catch (COMException) { }
        return Native.SHCreateDataObject(IntPtr.Zero, (uint)pidls.Length, pidls, IntPtr.Zero, Native.IidIDataObject, out var data) >= 0
            ? (data, "idlists") : (IntPtr.Zero, "none");
    }
}
