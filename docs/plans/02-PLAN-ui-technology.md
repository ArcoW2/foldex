# Plan 02: UI technology: WebView2, native, or both

Status: draft 2026-11-10, revised 2026-11-10 (option A, shell namespace, Evergreen); spike not started.

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

Done before plans 03 to 05 go into detail on screen behaviour. A throwaway branch on top of plan 01's host, with a
minimal page; each check pass or fail, timings only from what was measured:

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

The outcome goes into this plan (how each risk is solved, with the measured figures) and the spike branch is deleted.

### 3.8 Tests

The spike is its own test. After it: unit tests for the host, and the CDP-driven test copy as in LexPen.

## 4. Open questions

None.
