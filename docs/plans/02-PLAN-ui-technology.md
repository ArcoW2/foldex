# Plan 02: UI technology: WebView2, native, or both

Status: draft 2026-11-10, revised 2026-11-10 (option A, shell namespace, Evergreen); spike executed 2026-11-10 except
the checks by hand (6.3); see 5. Status and 6. As built.

## 1. What this is about

LexPen draws its whole UI in one WebView2 page; the native host does what the page cannot. An explorer asks more of the
native side than an editor does: system icons and overlays, Explorer's own right-click menu with every shell
extension, dragging files to and from other programs, the shell's copy and delete dialogs, folders that are not on
disk (This PC, network, Recycle Bin). Before building, it has to be decided whether Foldex uses WebView2 for
everything, for the preview only, or not at all.

## 2. The solution, in brief

Option A, the LexPen shape, with a thicker native host. The page draws everything (ribbon, panes, lists, preview), in
LexPen's themed look with the system's icons, so LexPen's ribbon, actions, themes and docking carry over; the host
does all shell work: icons, Explorer's context menu, starting drags, file operations, watching folders, and Windows'
own preview handlers, all asynchronous to the page. The panes show the whole shell namespace (This PC, Network, Recycle
Bin as well as folders on disk), which the host walks as shell items. WebView2 (the Evergreen runtime) runs in
processes of Foldex's own and is never elevated; elevated work is the host's or the helper's (plan 05). The host
recreates the page when it fails without stopping work in progress. A spike checks the risky parts before plans 03 to
05 go into detail on screen behaviour, and records how each is solved.

## 3. Details

### 3.1 What an explorer needs from its UI

- **Large folders**: lists with very many entries, scrolling and sorting without stalls; virtual lists in any option.
- **System icons, overlays, thumbnails**: from the shell (`SHGetFileInfo`, `IShellItemImageFactory`), including the
  sync overlays of Synology Drive and OneDrive.
- **Explorer's context menu**: `IContextMenu` / `IContextMenu2` / `IContextMenu3` with every installed extension; it is a
  native popup in every option. LexPen's `ExplorerMenu.cs` does the opposite direction (LexPen inside Explorer's menu).
- **Drag and drop both ways**: to and from Explorer, Outlook, LexPen, a browser; shell data objects (`CF_HDROP`,
  `Preferred DropEffect`, virtual files from Outlook via `FileGroupDescriptor` / `FileContents`).
- **Cut, copy, paste** with the shell's clipboard formats, so Explorer can paste what Foldex copied and the reverse.
- **File operations** with Windows' own progress, conflict and permission dialogs (`IFileOperation`; plan 05).
- **Inline rename, type-ahead, keyboard speed**, accessibility (screen readers).
- **The shell namespace**: in scope. Items without a file path (This PC, Network, Recycle Bin, and the like: phones,
  a zip as a folder) are PIDLs, not paths. The host enumerates every location as shell items (`IShellItem`,
  `IEnumShellItems`) and identifies each by its parsing name, which is the full path for items on disk; the page never
  sees a PIDL. `IFileOperation` takes shell items, so file operations work on both kinds alike. Restoring from the Recycle
  Bin goes through its own context menu verb [not yet checked].

### 3.2 The options, and why A

A is chosen: it gives the most control (look, the connected panes and branches of plan 03), it is fast enough when
every exchange between page and host is asynchronous, and LexPen's code carries over. B to D stay here as the record
of what was weighed; D is out entirely.

**A. WebView2 for everything (LexPen's way).**
- For: reuse of LexPen's page code (ribbon, actions, themes, docking, viewers); full control of the look; the
  connected panes of plan 03 and their branch colours are plain HTML; one rendering for panes and preview.
- Against: every list entry crosses the JSON bridge; icons go over as images (cached per icon index, so per type, not
  per file); dragging files out of the page needs the host to start a native `DoDragDrop` when the page reports a drag
  start [not yet checked]; accessibility is own work; Windows preview handlers are native windows over the page
  (3.3).

**B. Native WinForms, WebView2 for the preview only.**
- For: `ListView` in virtual mode with the system image list gives the shell's look and speed; drag and drop, rename,
  accessibility come from Windows.
- Against: ribbon, themes, docking and the actions UI rebuilt natively; dark mode in WinForms is limited (.NET 9 added
  `Application.SetColorMode` as experimental; its state in .NET 10 [not yet checked]); the branch colours owner-drawn.

**C. Another native stack (WPF, WinUI 3, Avalonia).**
- WPF themes fully through styles and has WebView2 too; WinUI 3 looks modern; Avalonia is cross-platform, which
  Foldex does not need. None reuses LexPen, all need the same shell interop as A and B. Only WPF is worth a second look,
  and only if A fails.

**D. Explorer's own view inside Foldex (`IExplorerBrowser`).** Out: the shell's own folder view in a native window
gives the shell's behaviour for free, but leaves no control over the look, cannot show the branch marks of plan 03,
and puts native windows inside the page area (3.3).

### 3.3 Airspace: native windows next to the page

A native window placed over the WebView2 area always covers the page's popups. LexPen met this in its docking plan
(native docking dropped because the menus would be cut off at the panes). With option A it applies to Windows preview
handlers (plan 04). Ways out: keep native windows in a region the page's popups do not reach; hide the native window
(or show a snapshot of it) while a page popup is open; or make the popups native. Which one works is part of the spike.

### 3.4 Elevated

WebView2 never runs elevated. The host is never elevated: work that needs administrator rights goes through
`IFileOperation`'s own prompt or the elevated helper (plan 05), whose results come back to the host and go to the page
as any other. An elevated host would start its WebView2 elevated as well (the browser process is the host's child and
gets its token), with the page and every library in it running as administrator; keeping all work in the host and the
helper avoids that, and with it any question of an elevated and a normal WebView2 side by side. Since no Foldex window
is elevated, Windows' block on dragging from normal programs into elevated windows (UIPI) does not apply.

Protected folders are not a WebView2 matter: the host lists folders and sends the result to the page, so what can be
read is decided by the host process's rights. A preview that lets WebView2 load files itself (virtual host mapping,
`file://`) reads with the same rights; streaming through the host (`WebResourceRequested`) keeps one place that
checks. Checked on this PC (2026-11-10, not elevated): `C:\Windows` lists; `C:\System Volume Information` and
`C:\Program Files\WindowsApps` are denied; `C:\Documents and Settings` (a compatibility junction to `C:\Users`) has
`Everyone:(DENY)(RD)` on the junction itself, so listing it is denied even to administrators. Plan 05, 3.1.

### 3.5 Isolation and recovery

Foldex replaces Explorer for daily work, so a hang elsewhere must not reach it, and a failure of its own page must not
stop its work.

- **Other apps**: WebView2 groups its processes (browser, renderer, GPU) per user data folder. Foldex's own folder in
  the data folder's `State\` (as LexPen's, `AppHost.cs` `WebEnvironment`) gives it processes of its own, not shared with
  Teams, Outlook, Edge or LexPen. The environment option for exclusive access to the user data folder
  (`ExclusiveUserDataFolderAccess`) keeps every other process out of it [not yet checked].
- **Still shared**: the Evergreen runtime's files and its updates, the GPU driver, Windows. Foldex uses the Evergreen
  runtime, as LexPen. A Fixed Version runtime shipped with Foldex would take the runtime out of that list, at the price
  of shipping and updating it ourselves (size [not yet checked]); it is reconsidered only when the spike or daily use
  shows a runtime update breaking Foldex.
- **The page itself**: the host never waits synchronously on the page, so a hung renderer does not freeze the host's
  UI thread. `ProcessFailed` reports a renderer that stopped responding or exited, and a browser process that
  exited; the host then recreates the page and restores it from the project (panes, connections, locations, plan 03
  3.7). LexPen does not handle `ProcessFailed` (a grep of its `src` finds no use); Foldex does from the start.
- **Work lives in the host**: file operations, copy queues, folder watchers and the elevated helper (plan 05) belong to
  the host, not the page, so recreating the page does not stop a running copy; the new page shows its progress again.
- Foldex is not the Windows shell: when Foldex hangs, `explorer.exe` (taskbar, desktop) goes on.

### 3.6 Drag and drop

The page only draws drags; every drag that leaves or enters Foldex, and every file operation, goes through the host.

| Drag | Served by |
|---|---|
| Between Foldex panes | The page (HTML drag); on the drop the page tells the host, which copies or moves (`IFileOperation`) |
| From Foldex to Explorer, Outlook, LexPen | The host: the page reports a drag start with its items, the host starts the native drag (`SHDoDragDrop` with a shell data object, so Explorer's drag image and copy or move rules apply) [not yet checked from inside WebView2] |
| From Explorer into Foldex | WebView2 takes the native drop and gives the page `File` objects; the page hands them to the host with `postMessageWithAdditionalObjects`, as LexPen does; the host does the work |
| Outlook mails and attachments into Foldex | Virtual files (`FileGroupDescriptor` / `FileContents`), not on disk: whether WebView2 passes them to the page at all [not yet checked]; if not, the host needs a drop target of its own, with WebView2's own drop switched off (`AllowExternalDrop`) [not yet checked] |

### 3.7 The spike

Done before plans 03 to 05 go into detail on screen behaviour, on the branch `plan01-foundation` on top of plan 01's
host. Its host code is not thrown away: the listing, icons, Explorer's menu, drag, file operations, preview handlers
and the helper are the host services Foldex keeps (`src/Shell`, `ElevatedHelper.cs`); only the page is a stand-in
until plan 03. Each check pass or fail, timings only from what was measured; the results are in 6.

1. A folder with very many files listed in the page with virtual scrolling and icons from the host: time to show,
   scrolling, sorting. The same folder in a native `ListView` (option B) as the yardstick.
2. Dragging files from the page into Explorer, Outlook, LexPen; from Explorer into the page.
3. Explorer's context menu on a right-click in the page, with extension submenus (for example Synology Drive, 7-Zip).
4. A Windows preview handler (a .docx or .xlsx) beside the page, with a ribbon drop-down opening over it.
5. This PC, Network and the Recycle Bin listed through the host as shell items, with icons; a file deleted to the
   Recycle Bin and restored from it.
6. The elevated helper (plan 05) listing a folder only administrators can read, the host showing it in the page.
7. Explorer's context menu, dragging out and copying for items from different folders (plan 06, 3.4).
8. Recovery (3.5): the renderer killed and the browser process killed during a long copy run by the host; the page
   comes back with its panes and the copy's progress, the copy itself not interrupted.
9. Outlook mails and attachments dragged into the page (3.6); if WebView2 does not pass them, the host's own drop
   target with `AllowExternalDrop` off.

### 3.8 Tests

The spike is its own test (6). Unit tests for the host services (`tests/Foldex.Tests/ShellTests.cs`), and the
CDP-driven test copy as in LexPen.

## 4. Open questions

1. **Closing Foldex while a file operation runs.** Closing the last window ends the process, and with it the copy
   (6.2, item 8). Foldex keeps running without a window until the operations are done (Windows' own progress dialog
   stays), or asks first, or both? Suggestion: ask, with "Keep running until done" as the default answer.

## 5. Status

### Built

- Option A: the page draws everything, the host does the shell work, asynchronously (3.2; 6.1).
- Listing folders and the shell namespace (This PC, Network, Recycle Bin) as shell items, in batches, cancellable; the
  Recycle Bin's items by `pidl:n` ids (3.1; 6.1, 6.2 items 1 and 5).
- System icons by type, own icons per row in view (3.1; 6.1).
- Explorer's context menu for one folder's items (3.1; 6.2 item 3).
- Dragging out through the host's native drag, with a drop source of Foldex's own; dropping in from Explorer (3.6;
  6.2 item 2).
- File operations through `IFileOperation`, kept by the host (3.1, 3.5; 6.1).
- Windows preview handlers in a native panel, with the snapshot swap for page popups (3.3; 6.2 item 4).
- The elevated helper, listing only (3.4; 6.1, plan 05).
- Processes of Foldex's own, the page recreated after a failure, a copy going on meanwhile (3.5; 6.2 item 8).
- Dropping Outlook mails into the page, reporting what came along (3.6; 6.2 item 9).

### Not yet built

- The checks by hand of 6.3: drag out and in, Explorer's menu with the mouse and its submenus, Outlook, listing
  through UAC.
- Explorer's menu for items from different folders: the shell makes none; Foldex's own menu is plan 06 3.4.
- A drop target of the host's own for Outlook's virtual files, if WebView2 does not pass them (3.6; after the check
  by hand).
- Closing Foldex while a file operation runs: open question 1.
- Rename from Explorer's menu; freeing the `pidl:n` tokens (6.4).

## 6. As built (spike, 2026-11-10)

### 6.1 What was built

- `src/Shell/`: `ShellNative.cs` (the shell's COM interfaces and functions), `StaWorker.cs` (an STA thread for shell work;
  a thread of its own per listing), `ShellListing.cs` (folders on disk with .NET, everything else as shell items; in
  batches every 250 ms; cancellable), `ShellIcons.cs` (system image list, icon by type, own icons of exe/lnk/ico/...
  per row in view, PNG per index), `ShellMenu.cs` (Explorer's menu from the items' shell array, IContextMenu3 message
  forwarding, verbs by name), `ShellDrag.cs` (`SHDoDragDrop` with a shell data object), `FileOps.cs` (IFileOperation on
  an STA thread per operation, progress sink, state kept by the host), `PreviewHost.cs` (a preview handler in a native
  panel over the page's area; snapshot by `PrintWindow`).
- `ElevatedHelper.cs`: `Foldex.exe --elevated-helper <pipe> <parent>`, started with `runas`; the pipe's access for the
  user only, the helper accepting only its parent, Foldex accepting only the helper it started; one operation (list).
- Items whose parsing name does not lead back to them (the Recycle Bin's) get an id `pidl:n` for an ID list the host
  keeps (`Native.IdOf`); the page still never sees an ID list.
- The page (`web/`): a stand-in for plan 03 with one list (virtual scrolling), the preview area, the operations, a popup
  to test airspace.
- `Program.cs`: shell names on the command line (`shell:RecycleBinFolder`, `::{...}`) are no longer made into paths.

### 6.2 Results

Measured on this PC with the debug build in a test copy (`FOLDEX_DATA` in the scratchpad, debugging port 9333).

| # | Check | Result |
|---|---|---|
| 1 | 50,000 empty files in 10 types | The page: host listing 285 ms, shown 857 ms (warm; 1320 ms cold); the native `ListView` yardstick: listing 464 ms, first paint 1040 ms. First try took 6880 ms: per-file icons of the 5000 `.exe` files (6935 ms of the host's time) and `localeCompare` sorting (195 ms against 17 ms with `Intl.Collator`); fixed by type icons first and own icons per row in view, and a Collator. Pass |
| 2 | Drag out and in | By hand (2026-11-10, a file from `C:\` dropped in an Explorer folder): the drag looked right, but on release nothing seemed to happen and Foldex could not be closed afterwards; the copy did arrive (created at the time of the drop). Cause: `SHDoDragDrop` with the default drop source reads the button from Foldex's own input state, which never sees the release (the mouse belongs to WebView2's window in the browser process), so the drag loop did not end and took every click. Fixed with a drop source of Foldex's own that reads the real button state (drop on release, Esc cancels) and no drag when the button is already up. Retest by hand, 6.3 |
| 3 | Explorer's menu | One folder's items: Explorer's full menu with every extension (LexPen's entries, 7-Zip, TortoiseGit, PowerRename, Foxit, ...). Showing it with the mouse and owner-drawn submenus: by hand, 6.3. Pass for building it |
| 4 | Preview handler and airspace | Word (.docx), PDF, markdown and HTML handlers ran out of process (local server, initialised with the file) in the native panel over the page's area. A page popup opened over it does not show at all (covered). With the snapshot swap (the panel drawn by `PrintWindow`, hidden, its picture in the area) the popup shows over the document. A first version read the snapshot from the screen and captured whatever window lay on top: never read the screen. Pass |
| 5 | This PC, Network, Recycle Bin | This PC: the drives with their icons. Network: 0 items on this PC [why not yet checked: network discovery]. Recycle Bin: 6871 items in 122577 ms, in batches (4974 shown after 3 s); the shell's own enumerator is the slow part (13321 ms of 15013 ms in a probe), so listings run on a thread each and a new location cancels the old. Delete to the Recycle Bin and Restore (its own verb `undelete` on the bin's item) worked; by path the item gets an ordinary file's menu without Restore, hence the `pidl:n` ids. Pass |
| 6 | Elevated helper | Built; refusal of anything outside the set unit-tested. Listing through UAC: by hand, 6.3 |
| 7 | Items of different folders | No Explorer menu (E_FAIL from the shell array). A try through the desktop folder's `GetUIObjectOf` with full ID lists ended in an access violation in coreclr (my declaration or the shell: not pursued). So such a selection gets Foldex's own menu (plan 06, 3.4). Dragging them out: by hand, 6.3 |
| 8 | Recovery during a copy | Copy of the 50,000 files: renderer killed at 2%, browser process killed at 3%; the page came back each time with the copy's progress (6% after the second), the copy went on (1696, then 2820 files on disk). Closing Foldex during the copy stopped it (25944 files, no change after 3 s): open question 1. Pass |
| 9 | Outlook mails into the page | Built (the drop reports what came along); by hand, 6.3 |

### 6.3 By hand (a real mouse, Outlook, the UAC prompt)

Start the debug build or `C:\win32app\Foldex\Foldex.exe`, then:

1. Drag a file and a selection of files from the list into Explorer, into an Outlook mail, into LexPen; Shift and Ctrl
   while dropping (move, copy). The status line reports a failure.
2. Drag files from Explorer onto the list and onto a folder in it: copied there, progress at the bottom.
3. Drag a mail and an attachment from Outlook onto the list: the status line says what came along when nothing could be
   copied.
4. Right-click a file: Explorer's menu at the mouse; open 7-Zip's and TortoiseGit's submenus (drawn by the extensions);
   Shift+right-click for the extended verbs; Properties, Delete.
5. A folder you cannot read (for example `C:\Program Files\WindowsApps`): the button List as administrator; Yes at the
   prompt lists it, No reports it.

### 6.4 Known limits of the stand-in page

- The selection is kept by position, so a batch arriving after a selection can move it; plan 03's panes keep it by id.
- Tokens (`pidl:n`) are kept for the session and never freed.
- Rename from Explorer's menu does nothing yet (plan 03).
