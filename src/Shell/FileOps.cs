using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// Copy, move and delete through Windows' IFileOperation (docs/plans/05-PLAN-elevation.md 3.1): Windows' own progress,
/// conflict and permission dialogs, and its administrator prompt per operation. Each operation runs on an STA thread of
/// its own, so the windows stay responsive and a new page after a failure does not stop it
/// (docs/plans/02-PLAN-ui-technology.md 3.5); the host keeps every operation's state for the page to show.
/// </summary>
sealed class FileOps
{
    public sealed class Operation
    {
        public int Id { get; init; }
        public string Kind { get; init; } = "";
        public int Items { get; init; }
        public uint Total { get; set; }
        public uint Done { get; set; }
        public bool Finished { get; set; }
        public bool Aborted { get; set; }
        public string? Error { get; set; }

        public JsonObject ToJson() => new()
        {
            ["id"] = Id, ["kind"] = Kind, ["items"] = Items, ["total"] = Total, ["done"] = Done,
            ["finished"] = Finished, ["aborted"] = Aborted, ["error"] = Error,
        };
    }

    readonly List<Operation> operations = [];
    readonly Action<Operation> changed;   // on the UI thread
    readonly SynchronizationContext ui;
    int lastId;

    /// <summary>`changed` runs on the creating (UI) thread whenever an operation starts, progresses or ends.</summary>
    public FileOps(Action<Operation> changed)
    {
        this.changed = changed;
        ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
    }

    public IReadOnlyList<Operation> All => operations;

    /// <summary>Starts a copy or move of items (parsing names) into a folder, or a delete (to the Recycle Bin; `confirmed`:
    /// Foldex asked already, Windows does not ask again). Returns at once.</summary>
    public Operation Start(string kind, IReadOnlyList<string> ids, string? target, IntPtr owner, bool confirmed)
    {
        var op = new Operation { Id = ++lastId, Kind = kind, Items = ids.Count };
        operations.Add(op);
        changed(op);
        var thread = new Thread(() => Run(op, ids, target, owner, confirmed)) { IsBackground = true, Name = $"file operation {op.Id}" };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        return op;
    }

    void Run(Operation op, IReadOnlyList<string> ids, string? target, IntPtr owner, bool confirmed)
    {
        try
        {
            var hr = Native.CoCreateInstance(Native.ClsidFileOperation, IntPtr.Zero, Native.ClsctxInprocServer,
                typeof(IFileOperation).GUID, out var ptr);
            if (hr < 0) Marshal.ThrowExceptionForHR(hr);
            var fo = (IFileOperation)Marshal.GetObjectForIUnknown(ptr);
            Marshal.Release(ptr);
            var flags = Native.FofNoConfirmMkDir | Native.FofAllowUndo;
            if (op.Kind == "delete") flags |= Native.FofxRecycleOnDelete | (confirmed ? Native.FofNoConfirmation : 0);
            fo.SetOperationFlags(flags);
            if (owner != IntPtr.Zero) fo.SetOwnerWindow(owner);
            var sink = new Sink(this, op);
            fo.Advise(sink, out var cookie);
            var dest = target is null ? null : Native.Item(target);
            foreach (var id in ids)
            {
                var item = Native.Item(id);
                switch (op.Kind)
                {
                    case "copy": fo.CopyItem(item, dest!, null, IntPtr.Zero); break;
                    case "move": fo.MoveItem(item, dest!, null, IntPtr.Zero); break;
                    case "delete": fo.DeleteItem(item, IntPtr.Zero); break;
                    default: throw new ArgumentException($"no file operation {op.Kind}");
                }
            }
            try { fo.PerformOperations(); }
            catch (COMException ex) when (ex.HResult == unchecked((int)0x80270000)) { }   // COPYENGINE_E_USER_CANCELLED
            fo.GetAnyOperationsAborted(out var aborted);
            fo.Unadvise(cookie);
            Marshal.ReleaseComObject(fo);
            op.Aborted = aborted;
        }
        catch (Exception ex) when (ex is COMException or ArgumentException or IOException or UnauthorizedAccessException)
        {
            op.Error = ex.Message;
        }
        op.Finished = true;
        Report(op);
    }

    void Report(Operation op) => ui.Post(_ => changed(op), null);

    // Windows' progress, passed on to the page.
    [ComVisible(true)]
    sealed class Sink(FileOps owner, Operation op) : IFileOperationProgressSink
    {
        DateTime last;

        public void UpdateProgress(uint iWorkTotal, uint iWorkSoFar)
        {
            op.Total = iWorkTotal;
            op.Done = iWorkSoFar;
            if ((DateTime.UtcNow - last).TotalMilliseconds < 200) return;   // the page needs no more than a few a second
            last = DateTime.UtcNow;
            owner.Report(op);
        }

        public void StartOperations() { }
        public void FinishOperations(int hrResult) { }
        public void PreRenameItem(uint dwFlags, IShellItem psiItem, string pszNewName) { }
        public void PostRenameItem(uint dwFlags, IShellItem psiItem, string pszNewName, int hrRename, IShellItem psiNewlyCreated) { }
        public void PreMoveItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName) { }
        public void PostMoveItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName, int hrMove, IShellItem psiNewlyCreated) { }
        public void PreCopyItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName) { }
        public void PostCopyItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName, int hrCopy, IShellItem psiNewlyCreated) { }
        public void PreDeleteItem(uint dwFlags, IShellItem psiItem) { }
        public void PostDeleteItem(uint dwFlags, IShellItem psiItem, int hrDelete, IShellItem psiNewlyCreated) { }
        public void PreNewItem(uint dwFlags, IShellItem psiDestinationFolder, string pszNewName) { }
        public void PostNewItem(uint dwFlags, IShellItem psiDestinationFolder, string pszNewName, string pszTemplateName, uint dwFileAttributes, int hrNew, IShellItem psiNewItem) { }
        public void ResetTimer() { }
        public void PauseTimer() { }
        public void ResumeTimer() { }
    }
}
