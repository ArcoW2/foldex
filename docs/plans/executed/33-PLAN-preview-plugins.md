# Plan 33: Preview plugins: real viewers next to Foldex's own

Status: executed; see Status.

- 2026-11-17: draft.
- 2026-11-21: partly executed: the viewer choice, lister plugins, and Foldex's side of LexPen's viewer.
- 2026-11-21: executed.

Builds on plan 04 (executed): the preview shows a file in Foldex's own viewer (LexPen's libraries, in the page) or
in the Windows preview handler registered for its type (a native window the host lays over the pane, `PreviewHost`).
The setting `previewWindowsTypes` names the types for which Windows' handler comes first.

## 1. What this is about

Foldex's own viewers are small: code is coloured by highlight.js, not by LexPen's language packs; CSV is a plain table;
there is no viewer at all for many types. Copying LexPen's editor and packs into Foldex is too much, and every other
viewer would need the same. Real viewers should be usable in the preview instead: LexPen itself, and viewers that
already exist as plugins. And it should be easy to switch between Foldex's view of a file and the native one, as
xplorer2 has a native and an own view.

## 2. The solution, in brief

Every viewer that can show the file is offered in a drop-down in the preview's bar: LexPen, Foldex's own, the Windows
preview handler of its type, and each Total Commander lister plugin that takes it. The choice is kept per type, and an
action steps to the next viewer. LexPen comes in as the Windows preview handler it registers for its types, the
standard way: when a type's handler is LexPen's, Foldex names it LexPen and offers it first. Lister plugins run in a
helper process of Foldex's,
so one that crashes takes only the preview with it. The native viewers are windows the host lays over the pane, under
the bar.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Viewer choice | the bar's drop-down of every viewer for the file, kept per type; the action to step through them; replaces `previewWindowsTypes` | 3.1; 6.1 |
| Lister plugins | Total Commander lister plugins (WLX) found, offered by their detect strings, run in a helper process, hosted over the pane | 3.2; 6.2 |
| LexPen viewer | a type whose Windows preview handler is LexPen's offers it as LexPen, first; shown in the preview | 3.3; 6.3 |

### Not yet built

## 3. Details

### 3.1 Choosing the viewer

- **Which viewers a file has**, in this order:
  - **LexPen**: when the type's Windows preview handler is LexPen's (3.3).
  - **Foldex**: its own viewer, when it has one (plan 04 3.1).
  - **Windows**: the preview handler registered for the type, when there is one and it is not LexPen's.
  - **Each lister plugin** whose detect string takes the file (3.2), by the plugin's name.
- **The drop-down** is at the left of the preview's bar and names the viewer shown ("Foldex", "Windows", "LexPen", a
  plugin's name). It is a menu (`menu.js`), so it closes on a second click and closes every other menu. It lists the
  viewers of the file shown, with a check at the one shown; choosing one shows the file in it at once and keeps the
  choice for the type. With only one viewer, the bar shows its name and no drop-down.
- **Keys**: the action `preview.nextViewer` steps to the next viewer of the list and keeps it, as the drop-down does.
  It has no key by default (keys.json can give it one). It is also in F1 and can go on the ribbon.
- **Kept per extension** in the setting `previewViewers` (`{ ".md": "lexpen", ".log": "lister:LogView",
  ".pdf": "windows" }`). A type without an entry, or whose kept viewer is gone (a plugin removed), keeps plan 04's
  order: LexPen, else Foldex's own viewer, else Windows' handler, else a plugin, else text, Windows' picture, hex,
  properties.
- `previewViewers` replaces `previewWindowsTypes`: its extensions become entries with "windows" (`SettingsFile`
  Renamed / Renaming, as other old settings).
- **The native viewers** (Windows, LexPen, a plugin) are native windows over the pane. The bar is the page's, so the
  host lays the native window over the pane's area under the bar, not over all of it, and the bar shows for every
  viewer.
- **Esc in a preview handler** (Windows', LexPen's): the handler has the keys first; Foldex catches none of them. An
  Esc the handler does not use itself it hands to its site (Foldex's `IPreviewHandlerFrame`, whose accelerator table
  holds only Esc), and Foldex takes the keyboard back and closes the preview, docked or floating. Esc in Foldex's
  own viewer closes it too, after an open menu or find bar has had it.
- **Handlers that never hand Esc on**: those built on WebView2 (Edge's PDF handler, PowerToys' previews) keep their
  keys in WebView2's process, out of reach of the site. For every handler but LexPen's, Foldex watches Esc while the
  keyboard is in the handler's window (`EscWatch`, a low-level keyboard hook that only looks, set only while such a
  handler is shown): the handler still gets the key, and the preview closes too. Such a handler cannot keep Esc for
  itself (an open find box in it closes with the preview).
  prevhost.exe does this for the handlers it runs; LexPen does it itself.
- **Settings window**: the preview group lists the kept choices, each removable (back to the order), and the lister
  plugins (3.2).

### 3.2 Total Commander lister plugins (WLX)

- **The format.** A lister plugin is a DLL (`.wlx64` for 64-bit) that makes a viewer window for a file:
  - `ListLoadW(parent, file, flags)` returns its window as a child of `parent`;
  - `ListLoadNextW` shows another file in the same window;
  - `ListCloseWindow` closes it;
  - `ListGetDetectString` says which files it takes (`EXT="TXT" | EXT="LOG"`, also by content and size).

  Others are optional: search, print, copy, a picture for thumbnails (`ListGetPreviewBitmap`) [not yet checked: the
  exact set in the current plugin interface].
- **Only 64-bit plugins**: Foldex is 64-bit. Many plugins exist [not yet checked which are still kept up and 64-bit].
- **Where they come from.** Found in a folder of Foldex's data (`plugins\wlx\`), or added by path in Settings, as in
  Total Commander's own list. Each one's name and detect string are read once, in the helper, when it is added, and
  kept, so offering viewers for a file loads no DLL.
- **The helper process.** The plugins run in a helper process: the same exe started in a plugin mode, unelevated,
  talking to its window over a private pipe, as plan 05's elevated helper does.
  - The window asks the helper to show a file in a plugin. The helper loads the DLL and calls `ListLoadW` with a
    parent window of its own.
  - That window becomes a child of the native panel over the pane, across the processes (preview handlers in
    `prevhost.exe` do the same).
  - A plugin that crashes or hangs takes the helper with it, not Foldex: the preview then says the plugin stopped, and
    the next file starts a new helper. A plugin that does not answer within 10 seconds counts as hung: the helper is
    ended.
  - One helper serves every pane of every Foldex window. It stays while a pane shows a plugin's view, and ends a
    minute after the last one.
- **Hosting.** As a Windows preview handler is (`PreviewHost`): the plugin's window moves and hides with the pane, and
  is unloaded when the preview moves on (plan 04 3.2), so it does not hold the file open. The helper uses
  `ListLoadNextW` when the plugin has it, so a series of files does not make a window per file.
- **Keys.** The plugin's window has the keyboard once clicked. Esc in it goes back to Foldex: the helper sees it
  before the plugin does and tells Foldex, which takes the keyboard back and treats it as Esc in the preview (F3's
  window closes). Other keys stay the plugin's.

### 3.3 LexPen as a viewer

- **The handler is LexPen's.** LexPen implements a Windows preview handler (`IPreviewHandler` and the stream
  initializer) in LexPen.exe itself, as a local COM server (`LocalServer32`), so the preview runs in LexPen's process.
  It shows a pane of LexPen, read-only, with LexPen's colouring, language packs and markdown preview. Open in LexPen
  stays one action away (plan 04 3.4). LexPen's own plan (in its repository) covers the handler and its registration.
- **Registered the standard way.** LexPen binds its handler to each type it shows under the type's `shellex` key
  (`{8895b1c6-b41f-4c1c-a562-0d564250836f}`) and lists it under `PreviewHandlers`, as every preview handler does; the
  same handler then shows in Explorer's preview pane too.
- **Foldex's part.**
  - The type's Windows preview handler is found as before (`PreviewHost.HandlerFor`). When the program of its class
    (`HKCR\CLSID\{clsid}\LocalServer32`) is `LexPen.exe`, it is LexPen's: the drop-down names it "LexPen" instead of
    "Windows", and offers it first, before Foldex's own viewer.
  - It creates the handler as `PreviewHost` creates any handler (`CoCreateInstance`, local server first).

### 3.4 How the viewers sit together

| | Lister plugins | LexPen |
|---|---|---|
| Generic | yes: any viewer written for the format | no: only LexPen |
| Built in | Foldex (detecting, the helper, hosting) | LexPen (the handler); Foldex: knowing it is LexPen's |
| Runs in | Foldex's plugin helper | LexPen's process |
| Offered for | the files their detect strings take | the types LexPen binds its handler to |

For a markdown file the drop-down can offer LexPen (or Windows, when another handler is bound to `.md`), Foldex and a
markdown lister plugin; the user picks one once per type, or steps through them with `preview.nextViewer`.

### 3.5 Tests

- **Unit:**
  - the viewers offered for a file (LexPen when the type's handler is LexPen's, own, Windows, plugins by detect
    string); LexPen's handler known by its program;
  - `previewViewers` with the order, and a kept viewer that is gone;
  - `previewWindowsTypes` read as `previewViewers`;
  - parsing detect strings.
- **In the test copy:**
  - the drop-down for a markdown file and `preview.nextViewer`, the choice kept for the type;
  - a lister plugin showing a file, the next file through `ListLoadNextW`, the pane moved, floated and closed;
  - a plugin that crashes: Foldex stays, the preview says so, the next file works;
  - a markdown file in LexPen's handler, offered first.

## 4. Open questions

None.

## 6. As built

### 6.1 Viewer choice

- `Shell/Viewers.cs`: `Viewers.For` (the viewers of a file, in the order of 3.1), `Viewers.Pick` (asked, else kept,
  else the first), `Viewers.FromWindowsTypes`. The host's `preview` op (MainForm) builds the list, picks, and shows
  the file in that viewer; `previewShown` carries `viewers` and `viewer`. An earlier request of the same pane that
  answers late is dropped (`previewAsks`), as the native viewers are shown by the host itself.
- Without any viewer, or when Windows' handler fails, the fallback of plan 04 stays (text, Windows' picture, hex,
  properties). When LexPen's handler or a plugin fails, the preview says why under the bar instead, so another viewer
  is one click away and nothing pretends to be the plugin's view.
- The bar (`previewpane.js`) has a fixed height (`--pv-bar-h`, app.css); the page sends it as `top` and the host lays
  a native viewer under it (`PreviewArea`), docked and floating. Native viewers now get the bar too: the viewer's
  name, or the drop-down with more than one, and Open. The cover picture of a native viewer starts under the bar.
- The drop-down lies over the native viewer's area, inside the pane's own page: a picture of the native viewer (as
  for the window's dialogs) would lie over the pane's frame and so over the menu. The native window is hidden while
  the drop-down is open instead (`menuOver`, op `previewHide`), docked and floating.
- `preview.nextViewer` (F1, ribbon; no key) works on the active pane when it is a preview, else the active pane's
  own preview, else the global one.
- Settings: `previewViewers` (an object) replaces `previewWindowsTypes`; `SettingsFile.Converted` turns the old
  value into the new one (an empty one into nothing). The Preview group's rows: Viewer per type (each kept choice with
  Remove) and Lister plugins (6.2).

### 6.2 Lister plugins

- `ListerHelper.cs`: the helper (`Foldex.exe --lister-helper <pipe> <parent id>`, unelevated, the same DPI awareness
  as Foldex) and its client. The helper loads a plugin (`LoadLibraryEx` with its own folder for its DLLs), calls
  `ListSetDefaultParams` when the plugin has it (interface version 2.0, `lsplugin.ini` in `plugins\wlx\`), and makes
  each view a holder window that is a child of the preview's panel in Foldex; the plugin's window fills it.
  `ListLoadNextW` (or `ListLoadNext`) is used for the next file in the same view; `ListLoadW`, else the ANSI
  `ListLoad`. Show flags: wrap text, fit larger pictures, centred.
- The pipe is overlapped in the helper: a synchronous one held the Esc event's write behind the pending read (found in
  the test copy).
- `Shell/Listers.cs`: the plugins of `plugins\wlx\` (`*.wlx64`) and of the setting `previewListers`; name and detect
  string kept in `State\listers.json` per file and its time stamp. A plugin's name is its file's name.
- Detect strings (`ListerDetect`): EXT, SIZE, `[n]`, FIND, FINDI, `= != < > <= >=`, `& | !`, AND / OR / NOT,
  brackets; empty takes every file; MULTIMEDIA and FORCE are never true; a string not understood takes no file.
- Settings: Lister plugins lists each one with what it takes or why it cannot be used; Add... (a file dialog in the
  host) adds to `previewListers`, Remove takes an added one away; the folder's are removed by removing the file.
- Test plugin: `tests/wlx-test/testlister.c` (takes `.fxt`; a name with "crash" crashes it, with "hang" hangs it).

### 6.3 LexPen viewer

- `LexPenHandler.Is` (`Shell/Viewers.cs`): the class's `LocalServer32` command names `LexPen.exe` (quoted or not,
  with arguments or not). The `preview` op asks it for the type's handler; `Viewers.For` then offers "lexpen" first
  and no "windows". `PreviewHost.Show` creates it as any type's handler.
- A `.md` kept as "windows" from before is no longer offered under that id, so it falls back to the order: LexPen.
- The site (`PreviewFrame` in `Shell/PreviewHost.cs`): set on every handler before its window, and taken away
  (`SetSite(null)`) when the preview moves on, which is when LexPen closes its previewer. Tested in the test copy: Esc
  in the PDF handler (prevhost.exe) came back as Esc in the preview, the keyboard back in Foldex; with LexPen, one
  previewer window in the panel after each of several `.md` files; Esc in LexPen, handed on, closed the docked preview.
  Edge's PDF handler and PowerToys' text handler (the keyboard in their WebView2 process): Esc closed the preview
  through `EscWatch`; LexPen's closed it once, through the site only.

### 6.4 Tests

- Unit (`ViewersTests`): the viewers of a file in order (LexPen first, instead of Windows, when the type's handler is
  LexPen's), LexPen's handler known by its program, the pick, a kept viewer that is gone, `previewWindowsTypes` read
  and written back as `previewViewers`, detect strings.
- In the test copy (a data folder of its own, the test plugin in its `plugins\wlx\`):
  - a `.fxt` shown by the plugin under the bar; the next one in the same helper (ListLoadNextW);
  - `.md`: Foldex and Windows offered; Windows chosen through the drop-down (a real click), kept in settings.json,
    shown under the bar; Next viewer back to Foldex; the open drop-down visible over the native area;
  - floating: the plugin's view in the floating window under its bar;
  - a crash: Foldex stays, the preview says the helper stopped, the next file starts a new helper;
  - a hang: after 10 seconds the helper is ended and the preview says so; Foldex's window answered throughout
    (`SendMessageTimeout`, every second); the next file works;
  - `.md` with LexPen's handler registered: LexPen and Foldex offered, LexPen shown under the bar (its own ribbon
    and markdown preview); Foldex chosen and kept, LexPen chosen again;
  - Esc in the plugin's window of an F3 preview closes that window;
  - the helper ends a minute after the last view closed.
