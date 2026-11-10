# Plan 02: UI technology: WebView2, native, or both

Status: draft 2026-11-10, revised 2026-11-10; not started. An investigation: its outcome is a decision and a spike, not a feature.

## 1. What this is about

LexPen draws its whole UI in one WebView2 page; the native host does what the page cannot. An explorer asks more of the
native side than an editor does: system icons and overlays, Explorer's own right-click menu with every shell
extension, dragging files to and from other programs, the shell's copy and delete dialogs, folders that are not on
disk (This PC, network, Recycle Bin). Before building, it has to be decided whether Foldex uses WebView2 for
everything, for the preview only, or not at all.

## 2. The solution, in brief

Suggestion: the LexPen shape, with a thicker native host. The page draws everything (ribbon, panes, lists, preview), so
LexPen's ribbon, actions, themes and docking carry over; the host does all shell work: icons, Explorer's context menu,
starting drags, file operations, watching folders, and Windows' own preview handlers. This is decided only after a
spike proves the risky parts: dragging files out of the page, very large folders, and a native preview window next to
the page's menus. If the spike fails, the fallback is native lists (option B or D below) with WebView2 for the preview.

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
- **The shell namespace**: items without a file path (This PC, Network, Recycle Bin, phones, a zip as a folder) are
  PIDLs, not paths. Whether that is in scope is open question 1; it weighs on the choice.

### 3.2 The options

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

**D. Explorer's own view inside Foldex (`IExplorerBrowser`).**
- The shell's own folder view hosted in a native window: icons, thumbnails, columns, context menu, drag and drop,
  rename and every shell namespace for free. `ICommDlgBrowser::IncludeObject` lets the host leave items out, which is
  exactly "folders, files or both" of plan 03.
- Against: little control over the look (how it follows a dark theme [not yet checked]); branch marks of plan 03 cannot
  be drawn inside it; native windows inside the page area (3.3).

### 3.3 Airspace: native windows next to the page

A native window placed over the WebView2 area always covers the page's popups. LexPen met this in its docking plan
(native docking dropped because the menus would be cut off at the panes). It applies to option D and to Windows preview
handlers in option A. Ways out: keep native windows in a region the page's popups do not reach; hide the native window
(or show a snapshot of it) while a page popup is open; or make the popups native. Which one works is part of the spike.

### 3.4 Elevated

WebView2 in an elevated process, and an elevated and a normal instance side by side (user data folder, browser
process) [not yet checked]; see plan 05. Dragging from a normal Explorer into an elevated window is blocked by Windows
(UIPI) whatever the UI technology, so elevation does not favour any option.

Protected folders are not a WebView2 matter: the host lists folders and sends the result to the page, so what can be
read is decided by the host process's rights. A preview that lets WebView2 load files itself (virtual host mapping,
`file://`) reads with the same rights; streaming through the host (`WebResourceRequested`) keeps one place that
checks. Checked on this PC (2026-11-10, not elevated): `C:\Windows` lists; `C:\System Volume Information` and
`C:\Program Files\WindowsApps` are denied; `C:\Documents and Settings` (a compatibility junction to `C:\Users`) has
`Everyone:(DENY)(RD)` on the junction itself, so listing it is denied even to administrators. Plan 05, 3.1.

### 3.5 The spike

A throwaway branch with a minimal host and page, each check pass or fail, timings only from what was measured:

1. A folder with very many files listed in the page with virtual scrolling and icons from the host: time to show,
   scrolling, sorting. The same folder in a native `ListView` (option B) as the yardstick.
2. Dragging files from the page into Explorer, Outlook, LexPen; from Explorer into the page.
3. Explorer's context menu on a right-click in the page, with extension submenus (for example Synology Drive, 7-Zip).
4. A Windows preview handler (a .docx or .xlsx) beside the page, with a ribbon drop-down opening over it.
5. `IExplorerBrowser` hosted next to the page, filtered to folders only, for comparison.
6. The same host run elevated once (plan 05).
7. Explorer's context menu, dragging out and copying for items from different folders (plan 06, 3.4).

The outcome goes into this plan (the brief solution changes to the decision) and the spike branch is deleted.

### 3.6 Tests

The spike is its own test. After the decision: whatever unit tests the chosen host gets; the CDP-driven test copy as in
LexPen if the page stays.

## 4. Open questions

1. **The shell namespace.** Only the file system (drives, UNC paths), or also This PC, Network, Recycle Bin, phones,
   zip files as folders? The second weighs toward D or toward PIDL handling in the host.
2. **The look.** Should the panes look like Explorer (system list, system icons) or like LexPen (themed, own colours)?
   The first favours D or B, the second A.
3. **Spike first?** Suggestion: yes, before plans 03 to 05 go into detail on screen behaviour.
