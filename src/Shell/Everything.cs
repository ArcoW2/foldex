using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// Everything (voidtools) as a search index (docs/plans/executed/06-PLAN-search-and-scrap.md 3.4), through its own window
/// messages (the IPC of Everything 1.4, which its SDK wraps): a query goes to its window as WM_COPYDATA, the answer
/// comes back the same way to a message window of this thread. Null when Everything does not run, does not have the
/// folder, or the name cannot be put in its search syntax: the caller then walks the folders itself.
/// </summary>
static class Everything
{
    const string WindowClass = "EVERYTHING_TASKBAR_NOTIFICATION";
    const int CopyDataQueryW = 2;           // EVERYTHING_IPC_COPYDATAQUERYW
    const int ReplyId = 0x46445845;         // Foldex's own number for the answer
    const uint ItemDrive = 2;
    const int WmCopyData = 0x004A;

    public static List<string>? Search(FileSearch.Options o, string root, CancellationToken cancel)
    {
        if (!o.Subfolders) return null;   // one folder: walking it is as quick
        var everything = FindWindow(WindowClass, null);
        if (everything == IntPtr.Zero) return null;
        var dir = root.TrimEnd('\\') + "\\";
        if (dir.Contains('"')) return null;
        // Whether it has the folder: anything below it (an empty folder is walked, which costs nothing).
        if (Query(everything, $"\"{dir}\"", 1, cancel) is not { Count: > 0 }) return null;
        var search = $"\"{dir}\"" + (o.Files && !o.Folders ? " file:" : o.Folders && !o.Files ? " folder:" : "");
        var named = o.Named.Trim();
        if (named.Length > 0)
        {
            if (named.Contains('"')) return null;
            if (o.Regex) search += $" regex:\"{named}\"";
            else search += " <" + string.Join("|", FileSearch.Patterns(named).Select(p => $"\"{p}\"")) + ">";
        }
        return Query(everything, search, uint.MaxValue, cancel);
    }

    static List<string>? Query(IntPtr everything, string search, uint max, CancellationToken cancel)
    {
        using var reply = new ReplyWindow();
        var text = search + "\0";
        var size = 20 + text.Length * 2;
        var data = Marshal.AllocHGlobal(size);
        try
        {
            // EVERYTHING_IPC_QUERYW: reply_hwnd, reply_copydata_message, search_flags, offset, max_results (each 32 bits),
            // then the search text.
            Marshal.WriteInt32(data, 0, (int)reply.Handle);
            Marshal.WriteInt32(data, 4, ReplyId);
            Marshal.WriteInt32(data, 8, 0);
            Marshal.WriteInt32(data, 12, 0);
            Marshal.WriteInt32(data, 16, unchecked((int)max));
            Marshal.Copy(text.ToCharArray(), 0, data + 20, text.Length);
            var cds = new CopyDataStruct { dwData = CopyDataQueryW, cbData = size, lpData = data };
            if (SendMessage(everything, WmCopyData, reply.Handle, ref cds) == IntPtr.Zero) return null;
        }
        finally { Marshal.FreeHGlobal(data); }
        var clock = System.Diagnostics.Stopwatch.StartNew();
        while (reply.Paths is null && !cancel.IsCancellationRequested && clock.ElapsedMilliseconds < 30000)
        {
            Application.DoEvents();
            if (reply.Paths is null) Thread.Sleep(5);
        }
        return reply.Paths;
    }

    // A message-only window that takes Everything's answer.
    sealed class ReplyWindow : NativeWindow, IDisposable
    {
        public List<string>? Paths;

        public ReplyWindow() => CreateHandle(new CreateParams { Parent = new IntPtr(-3) });   // HWND_MESSAGE

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WmCopyData)
            {
                var cds = Marshal.PtrToStructure<CopyDataStruct>(m.LParam);
                if (cds.dwData == ReplyId)
                {
                    Paths = Read(cds.lpData);
                    m.Result = new IntPtr(1);
                    return;
                }
            }
            base.WndProc(ref m);
        }

        // EVERYTHING_IPC_LISTW: seven 32-bit counts (numitems the sixth), then per item flags, filename_offset and
        // path_offset, the offsets from the start of the list.
        static List<string> Read(IntPtr list)
        {
            var count = Marshal.ReadInt32(list, 20);
            var paths = new List<string>(count);
            for (var k = 0; k < count; k++)
            {
                var item = list + 28 + k * 12;
                var flags = (uint)Marshal.ReadInt32(item, 0);
                var name = Marshal.PtrToStringUni(list + Marshal.ReadInt32(item, 4)) ?? "";
                var path = Marshal.PtrToStringUni(list + Marshal.ReadInt32(item, 8)) ?? "";
                if ((flags & ItemDrive) != 0) paths.Add(name.TrimEnd('\\') + "\\");
                else paths.Add(path.Length > 0 ? Path.Combine(path, name) : name);
            }
            return paths;
        }

        public void Dispose() => DestroyHandle();
    }

    [StructLayout(LayoutKind.Sequential)]
    struct CopyDataStruct
    {
        public IntPtr dwData;
        public int cbData;
        public IntPtr lpData;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr FindWindow(string lpClassName, string? lpWindowName);

    [DllImport("user32.dll")]
    static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, ref CopyDataStruct lParam);
}
