using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

namespace Foldex.Shell;

// The Windows shell's COM interfaces and functions Foldex uses (docs/plans/02-PLAN-ui-technology.md 3.1). Interfaces
// are declared with their methods in vtable order; a derived interface repeats its base's methods.

[ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem
{
    [PreserveSig] int BindToHandler(IntPtr pbc, in Guid bhid, in Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(Sigdn sigdnName, out IntPtr ppszName);
    void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
    void Compare(IShellItem psi, uint hint, out int piOrder);
}

[ComImport, Guid("70629033-e363-4a28-a567-0db78006e6d7"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IEnumShellItems
{
    [PreserveSig] int Next(uint celt, out IShellItem rgelt, out uint pceltFetched);
    void Skip(uint celt);
    void Reset();
    void Clone(out IEnumShellItems ppenum);
}

[ComImport, Guid("b63ea76d-1f85-456f-a19c-48159efa858b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItemArray
{
    [PreserveSig] int BindToHandler(IntPtr pbc, in Guid bhid, in Guid riid, out IntPtr ppvOut);
    void GetPropertyStore(int flags, in Guid riid, out IntPtr ppv);
    void GetPropertyDescriptionList(IntPtr keyType, in Guid riid, out IntPtr ppv);
    void GetAttributes(int attribFlags, uint sfgaoMask, out uint psfgaoAttribs);
    void GetCount(out uint pdwNumItems);
    void GetItemAt(uint dwIndex, out IShellItem ppsi);
    void EnumItems(out IEnumShellItems ppenumShellItems);
}

[ComImport, Guid("000214e4-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IContextMenu
{
    [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint indexMenu, uint idCmdFirst, uint idCmdLast, uint uFlags);
    [PreserveSig] int InvokeCommand(ref CmInvokeCommandInfoEx pici);
    [PreserveSig] int GetCommandString(UIntPtr idCmd, uint uType, IntPtr pReserved, IntPtr pszName, uint cchMax);
}

[ComImport, Guid("bcfce0a0-ec17-11d0-8d10-00a0c90f2719"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IContextMenu3
{
    [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint indexMenu, uint idCmdFirst, uint idCmdLast, uint uFlags);
    [PreserveSig] int InvokeCommand(ref CmInvokeCommandInfoEx pici);
    [PreserveSig] int GetCommandString(UIntPtr idCmd, uint uType, IntPtr pReserved, IntPtr pszName, uint cchMax);
    [PreserveSig] int HandleMenuMsg(uint uMsg, IntPtr wParam, IntPtr lParam);
    [PreserveSig] int HandleMenuMsg2(uint uMsg, IntPtr wParam, IntPtr lParam, out IntPtr plResult);
}

[ComImport, Guid("947aab5f-0a5c-4c13-b4d6-4bf7836fc9f8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileOperation
{
    void Advise(IFileOperationProgressSink pfops, out uint pdwCookie);
    void Unadvise(uint dwCookie);
    void SetOperationFlags(uint dwOperationFlags);
    void SetProgressMessage([MarshalAs(UnmanagedType.LPWStr)] string pszMessage);
    void SetProgressDialog(IntPtr popd);
    void SetProperties(IntPtr pproparray);
    void SetOwnerWindow(IntPtr hwndOwner);
    void ApplyPropertiesToItem(IShellItem psiItem);
    void ApplyPropertiesToItems([MarshalAs(UnmanagedType.IUnknown)] object punkItems);
    void RenameItem(IShellItem psiItem, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName, IntPtr pfopsItem);
    void RenameItems([MarshalAs(UnmanagedType.IUnknown)] object pUnkItems, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName);
    void MoveItem(IShellItem psiItem, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string? pszNewName, IntPtr pfopsItem);
    void MoveItems([MarshalAs(UnmanagedType.IUnknown)] object punkItems, IShellItem psiDestinationFolder);
    void CopyItem(IShellItem psiItem, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string? pszCopyName, IntPtr pfopsItem);
    void CopyItems([MarshalAs(UnmanagedType.IUnknown)] object punkItems, IShellItem psiDestinationFolder);
    void DeleteItem(IShellItem psiItem, IntPtr pfopsItem);
    void DeleteItems([MarshalAs(UnmanagedType.IUnknown)] object punkItems);
    void NewItem(IShellItem psiDestinationFolder, uint dwFileAttributes, [MarshalAs(UnmanagedType.LPWStr)] string pszName,
        [MarshalAs(UnmanagedType.LPWStr)] string? pszTemplateName, IntPtr pfopsItem);
    void PerformOperations();
    void GetAnyOperationsAborted([MarshalAs(UnmanagedType.Bool)] out bool pfAnyOperationsAborted);
}

[ComImport, Guid("04b0f1a7-9490-44bc-96e1-4296a31252e2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileOperationProgressSink
{
    void StartOperations();
    void FinishOperations(int hrResult);
    void PreRenameItem(uint dwFlags, IShellItem psiItem, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName);
    void PostRenameItem(uint dwFlags, IShellItem psiItem, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName, int hrRename, IShellItem psiNewlyCreated);
    void PreMoveItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName);
    void PostMoveItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName, int hrMove, IShellItem psiNewlyCreated);
    void PreCopyItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName);
    void PostCopyItem(uint dwFlags, IShellItem psiItem, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName, int hrCopy, IShellItem psiNewlyCreated);
    void PreDeleteItem(uint dwFlags, IShellItem psiItem);
    void PostDeleteItem(uint dwFlags, IShellItem psiItem, int hrDelete, IShellItem psiNewlyCreated);
    void PreNewItem(uint dwFlags, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName);
    void PostNewItem(uint dwFlags, IShellItem psiDestinationFolder, [MarshalAs(UnmanagedType.LPWStr)] string pszNewName,
        [MarshalAs(UnmanagedType.LPWStr)] string pszTemplateName, uint dwFileAttributes, int hrNew, IShellItem psiNewItem);
    void UpdateProgress(uint iWorkTotal, uint iWorkSoFar);
    void ResetTimer();
    void PauseTimer();
    void ResumeTimer();
}

[ComImport, Guid("8895b1c6-b41f-4c1c-a562-0d564250836f"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPreviewHandler
{
    void SetWindow(IntPtr hwnd, ref Rect prc);
    void SetRect(ref Rect prc);
    void DoPreview();
    void Unload();
    void SetFocus();
    void QueryFocus(out IntPtr phwnd);
    [PreserveSig] int TranslateAccelerator(IntPtr pmsg);
}

[ComImport, Guid("b7d14566-0509-4cce-a71f-0a554233bd9b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IInitializeWithFile
{
    void Initialize([MarshalAs(UnmanagedType.LPWStr)] string pszFilePath, uint grfMode);
}

[ComImport, Guid("b824b49d-22ac-4161-ac8a-9916e8fa3f7f"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IInitializeWithStream
{
    void Initialize(IStream pstream, uint grfMode);
}

[ComImport, Guid("7f73be3f-fb79-493c-a6c7-7ee14e245841"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IInitializeWithItem
{
    void Initialize(IShellItem psi, uint grfMode);
}

enum Sigdn : uint
{
    NormalDisplay = 0,
    DesktopAbsoluteParsing = 0x80028000,
    FileSysPath = 0x80058000,
}

[StructLayout(LayoutKind.Sequential)]
struct Rect
{
    public int Left, Top, Right, Bottom;
    public Rect(Rectangle r) { Left = r.Left; Top = r.Top; Right = r.Right; Bottom = r.Bottom; }
}

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
struct ShFileInfo
{
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName;
}

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
struct CmInvokeCommandInfoEx
{
    public int cbSize;
    public uint fMask;
    public IntPtr hwnd;
    public IntPtr lpVerb;
    [MarshalAs(UnmanagedType.LPStr)] public string? lpParameters;
    [MarshalAs(UnmanagedType.LPStr)] public string? lpDirectory;
    public int nShow;
    public uint dwHotKey;
    public IntPtr hIcon;
    [MarshalAs(UnmanagedType.LPStr)] public string? lpTitle;
    public IntPtr lpVerbW;
    [MarshalAs(UnmanagedType.LPWStr)] public string? lpParametersW;
    [MarshalAs(UnmanagedType.LPWStr)] public string? lpDirectoryW;
    [MarshalAs(UnmanagedType.LPWStr)] public string? lpTitleW;
    public Point ptInvoke;
}

static class Native
{
    public static readonly Guid BhidEnumItems = new("94f60519-2850-4924-aa5a-d15e84868039");
    public static readonly Guid BhidSFUIObject = new("3981e225-f559-11d3-8e3a-00c04f6837d5");
    public static readonly Guid BhidDataObject = new("b8c0bd9f-ed24-455c-83e6-d5390c4fe8c4");
    public static readonly Guid IidIEnumShellItems = typeof(IEnumShellItems).GUID;
    public static readonly Guid IidIContextMenu = typeof(IContextMenu).GUID;
    public static readonly Guid IidIDataObject = new("0000010e-0000-0000-c000-000000000046");
    public static readonly Guid IidIShellItem = typeof(IShellItem).GUID;
    public static readonly Guid ClsidFileOperation = new("3ad05575-8857-4850-9277-11b85bdb8e09");
    public const string PreviewHandlerKey = "{8895b1c6-b41f-4c1c-a562-0d564250836f}";

    public const uint SfgaoFolder = 0x20000000, SfgaoFileSystem = 0x40000000, SfgaoStream = 0x00400000, SfgaoHidden = 0x00080000,
        SfgaoLink = 0x00010000;

    public const uint ShgfiIcon = 0x100, ShgfiSysIconIndex = 0x4000, ShgfiSmallIcon = 0x1, ShgfiUseFileAttributes = 0x10,
        ShgfiPidl = 0x8;
    public const uint FileAttributeDirectory = 0x10, FileAttributeNormal = 0x80;

    public const uint FofRenameOnCollision = 0x8, FofAllowUndo = 0x40, FofNoConfirmation = 0x10, FofNoConfirmMkDir = 0x200, FofxRecycleOnDelete = 0x00080000;

    public const uint CmfDefaultOnly = 0x1, CmfNormal = 0, CmfExtendedVerbs = 0x100, CmfExplore = 0x4, CmfCanRename = 0x10;
    public const uint CmicMaskUnicode = 0x4000, CmicMaskPtInvoke = 0x20000000, CmicMaskShiftDown = 0x10000000,
        CmicMaskControlDown = 0x40000000;
    public const uint TpmReturnCmd = 0x100, TpmRightButton = 0x2;
    public const uint GcsVerbW = 4;

    public const uint StgmRead = 0, StgmShareDenyNone = 0x40;
    public const uint ClsctxInprocServer = 1, ClsctxLocalServer = 4;
    public const uint DropEffectCopy = 1, DropEffectMove = 2, DropEffectLink = 4;

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    public static extern void SHCreateItemFromParsingName(string pszPath, IntPtr pbc, in Guid riid, out IShellItem ppv);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern int SHParseDisplayName(string pszName, IntPtr pbc, out IntPtr ppidl, uint sfgaoIn, out uint psfgaoOut);

    [DllImport("shell32.dll", PreserveSig = false)]
    public static extern void SHGetIDListFromObject([MarshalAs(UnmanagedType.IUnknown)] object punk, out IntPtr ppidl);

    [DllImport("shell32.dll", PreserveSig = false)]
    public static extern void SHCreateShellItemArrayFromIDLists(uint cidl, IntPtr[] rgpidl, out IShellItemArray ppsiItemArray);

    [DllImport("shell32.dll")]
    public static extern int SHCreateDataObject(IntPtr pidlFolder, uint cidl, IntPtr[] apidl, IntPtr pdtInner, in Guid riid, out IntPtr ppv);

    [DllImport("shell32.dll")]
    public static extern int SHDoDragDrop(IntPtr hwnd, IntPtr pdtobj, IntPtr pdsrc, uint dwEffect, out uint pdwEffect);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref ShFileInfo psfi, uint cbFileInfo, uint uFlags);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, EntryPoint = "SHGetFileInfoW")]
    public static extern IntPtr SHGetFileInfo(IntPtr pidl, uint dwFileAttributes, ref ShFileInfo psfi, uint cbFileInfo, uint uFlags);

    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
    public static extern int AssocQueryString(uint flags, int str, string pszAssoc, string? pszExtra, char[]? pszOut, ref uint pcchOut);

    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    public static extern void SHCreateStreamOnFileEx(string pszFile, uint grfMode, uint dwAttributes, bool fCreate, IntPtr pstmTemplate, out IStream ppstm);

    [DllImport("ole32.dll")]
    public static extern int CoCreateInstance(in Guid rclsid, IntPtr pUnkOuter, uint dwClsContext, in Guid riid, out IntPtr ppv);

    [DllImport("ole32.dll")]
    public static extern void CoTaskMemFree(IntPtr pv);

    [DllImport("comctl32.dll")]
    public static extern IntPtr ImageList_GetIcon(IntPtr himl, int i, uint flags);

    // The system image list of a size (SHIL_SMALL 16, SHIL_LARGE 32, SHIL_EXTRALARGE 48): the same indexes in each. The
    // IImageList it gives is a HIMAGELIST as well.
    public const int ShilLarge = 0, ShilSmall = 1, ShilExtraLarge = 2;
    public static readonly Guid IidIImageList = new("46EB5926-582E-4017-9FDF-E8998DAA0950");

    [DllImport("shell32.dll")]
    public static extern int SHGetImageList(int iImageList, ref Guid riid, out IntPtr ppv);

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);

    [DllImport("user32.dll")]
    public static extern IntPtr CreatePopupMenu();

    [DllImport("user32.dll")]
    public static extern bool DestroyMenu(IntPtr hMenu);

    [DllImport("user32.dll")]
    public static extern int GetMenuItemCount(IntPtr hMenu);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetMenuString(IntPtr hMenu, uint uIDItem, char[] lpString, int cchMax, uint flags);

    [DllImport("user32.dll")]
    public static extern int TrackPopupMenuEx(IntPtr hmenu, uint fuFlags, int x, int y, IntPtr hwnd, IntPtr lptpm);

    /// <summary>A string the shell allocated, read and freed.</summary>
    public static string TakeString(IntPtr p)
    {
        try { return Marshal.PtrToStringUni(p) ?? ""; }
        finally { CoTaskMemFree(p); }
    }

    public static string DisplayName(IShellItem item, Sigdn kind)
    {
        item.GetDisplayName(kind, out var p);
        return TakeString(p);
    }

    // Items whose parsing name does not lead back to them (an item in the Recycle Bin: its name is the file's path in
    // $Recycle.Bin, which gives that file, not the bin's item with Restore; plan 02 3.7, item 5) get a token instead,
    // "pidl:n", standing for the item's ID list kept here. The page never sees an ID list itself.
    const string TokenPrefix = "pidl:";
    static readonly System.Collections.Concurrent.ConcurrentDictionary<string, IntPtr> Tokens = new();
    static int lastToken;

    /// <summary>The id the page gets for a shell item: its parsing name when that leads back to the same item, else
    /// a token.</summary>
    public static string IdOf(IShellItem item)
    {
        var name = DisplayName(item, Sigdn.DesktopAbsoluteParsing);
        SHGetIDListFromObject(item, out var pidl);
        if (SHParseDisplayName(name, IntPtr.Zero, out var parsed, 0, out _) >= 0)
        {
            var same = ILIsEqual(pidl, parsed);
            CoTaskMemFree(parsed);
            if (same)
            {
                CoTaskMemFree(pidl);
                return name;
            }
        }
        var token = TokenPrefix + Interlocked.Increment(ref lastToken);
        Tokens[token] = pidl;   // kept for the session (spike: never freed)
        return token;
    }

    /// <summary>The shell item of an id: a parsing name (a path, "::{guid}", "shell:RecycleBinFolder") or a token.</summary>
    public static IShellItem Item(string id)
    {
        if (Tokens.TryGetValue(id, out var pidl))
        {
            SHCreateItemFromIDList(pidl, IidIShellItem, out var fromList);
            return fromList;
        }
        SHCreateItemFromParsingName(id, IntPtr.Zero, IidIShellItem, out var item);
        return item;
    }

    /// <summary>The absolute ID lists of ids; free them with <see cref="FreeIdLists"/>.</summary>
    public static IntPtr[] IdLists(IEnumerable<string> ids)
    {
        var pidls = new List<IntPtr>();
        try
        {
            foreach (var id in ids)
            {
                if (Tokens.TryGetValue(id, out var kept))
                {
                    pidls.Add(ILClone(kept));
                    continue;
                }
                var hr = SHParseDisplayName(id, IntPtr.Zero, out var pidl, 0, out _);
                if (hr < 0) Marshal.ThrowExceptionForHR(hr);
                pidls.Add(pidl);
            }
            return [.. pidls];
        }
        catch
        {
            FreeIdLists([.. pidls]);
            throw;
        }
    }

    [DllImport("shell32.dll", PreserveSig = false)]
    static extern void SHCreateItemFromIDList(IntPtr pidl, in Guid riid, out IShellItem ppv);

    [DllImport("shell32.dll")]
    static extern bool ILIsEqual(IntPtr pidl1, IntPtr pidl2);

    [DllImport("shell32.dll")]
    static extern IntPtr ILClone(IntPtr pidl);

    public static void FreeIdLists(IntPtr[] pidls)
    {
        foreach (var p in pidls) CoTaskMemFree(p);
    }
}
