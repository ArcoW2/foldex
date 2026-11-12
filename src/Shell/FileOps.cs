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
        /// <summary>The items it was given; told once it is finished, so a scrap can check them (plan 06 3.1).</summary>
        public IReadOnlyList<string> Ids { get; init; } = [];
        /// <summary>The items moved or renamed: [old, new] parsing names, so the entries of a scrap follow them.</summary>
        public List<string[]> Moved { get; } = [];
        /// <summary>A new folder or file: its parsing name, so the page can rename it at once.</summary>
        public string? Created { get; set; }

        public JsonObject ToJson() => new()
        {
            ["id"] = Id, ["kind"] = Kind, ["items"] = Items, ["total"] = Total, ["done"] = Done,
            ["finished"] = Finished, ["aborted"] = Aborted, ["error"] = Error,
            ["ids"] = Finished ? new JsonArray(Ids.Select(i => (JsonNode?)i).ToArray()) : null,
            ["moved"] = Finished ? new JsonArray(Moved.Select(m => (JsonNode?)new JsonArray(m[0], m[1])).ToArray()) : null,
            ["created"] = Finished ? Created : null,
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

    /// <summary>Starts a copy or move of items (parsing names) into a folder, a delete (to the Recycle Bin; `confirmed`:
    /// Foldex asked already, Windows does not ask again), a permanent delete (deletePermanent), a rename of one item (rename: `target` is its new name), or a
    /// new folder or file in `target` ("New folder", "New file.txt"; numbered by Windows when the name is taken). Returns at once.</summary>
    public Operation Start(string kind, IReadOnlyList<string> ids, string? target, IntPtr owner, bool confirmed)
    {
        var op = new Operation { Id = ++lastId, Kind = kind, Items = ids.Count, Ids = [.. ids] };
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
            if (op.Kind == "deletePermanent") flags = (flags & ~Native.FofAllowUndo) | (confirmed ? Native.FofNoConfirmation : 0);
            if (op.Kind is "newFolder" or "newFile") flags |= Native.FofRenameOnCollision;
            fo.SetOperationFlags(flags);
            if (owner != IntPtr.Zero) fo.SetOwnerWindow(owner);
            var sink = new Sink(this, op);
            fo.Advise(sink, out var cookie);
            var dest = target is null || op.Kind == "rename" ? null : Native.Item(target);
            if (op.Kind == "newFolder") fo.NewItem(dest!, Native.FileAttributeDirectory, "New folder", null, IntPtr.Zero);
            if (op.Kind == "newFile") fo.NewItem(dest!, Native.FileAttributeNormal, "New file.txt", null, IntPtr.Zero);
            foreach (var id in ids)
            {
                var item = Native.Item(id);
                switch (op.Kind)
                {
                    case "copy": fo.CopyItem(item, dest!, null, IntPtr.Zero); break;
                    case "move": fo.MoveItem(item, dest!, null, IntPtr.Zero); break;
                    case "delete" or "deletePermanent": fo.DeleteItem(item, IntPtr.Zero); break;
                    case "rename": fo.RenameItem(item, target!, IntPtr.Zero); break;
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
        // A moved or renamed item's path, taken before: afterwards the old item no longer has one.
        string? before;

        public void PreRenameItem(uint dwFlags, IShellItem psiItem, string pszNewName) => Before(psiItem);
        public void PostRenameItem(uint dwFlags, IShellItem psiItem, string pszNewName, int hrRename, IShellItem psiNewlyCreated) =>
            Moved(hrRename, psiNewlyCreated);
        public void PreMoveItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName) => Before(psiItem);
        public void PostMoveItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName, int hrMove, IShellItem psiNewlyCreated) =>
            Moved(hrMove, psiNewlyCreated);

        void Before(IShellItem item)
        {
            try { before = Native.IdOf(item); }
            catch (COMException) { before = null; }
        }

        void Moved(int hr, IShellItem? to)
        {
            if (hr < 0 || to is null || before is null) return;
            try { op.Moved.Add([before, Native.IdOf(to)]); }
            catch (COMException) { }
        }
        public void PreCopyItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName) { }
        public void PostCopyItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, string pszNewName, int hrCopy, IShellItem psiNewlyCreated) { }
        public void PreDeleteItem(uint dwFlags, IShellItem psiItem) { }
        public void PostDeleteItem(uint dwFlags, IShellItem psiItem, int hrDelete, IShellItem psiNewlyCreated) { }
        public void PreNewItem(uint dwFlags, IShellItem psiDestinationFolder, string pszNewName) { }
        public void PostNewItem(uint dwFlags, IShellItem psiDestinationFolder, string pszNewName, string pszTemplateName, uint dwFileAttributes, int hrNew, IShellItem psiNewItem)
        {
            if (hrNew < 0 || psiNewItem is null) return;
            try { op.Created = Native.IdOf(psiNewItem); }
            catch (COMException) { }
        }
        public void ResetTimer() { }
        public void PauseTimer() { }
        public void ResumeTimer() { }
    }
}
