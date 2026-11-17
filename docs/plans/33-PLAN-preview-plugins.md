# Plan 33: Preview plugins: real viewers next to Foldex's own

Status: not started; see Status.

- 2026-11-17: draft.

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

Every viewer that can show the file is offered in a drop-down in the preview's bar: Foldex's own, the Windows preview
handler of its type, LexPen, and each Total Commander lister plugin that takes it. The choice is kept per type, and an
action steps to the next viewer. LexPen comes in as a preview handler LexPen registers without taking any type from
other programs: Foldex asks it by name for the types LexPen lists. Lister plugins run in a helper process of Foldex's,
so one that crashes takes only the preview with it. The native viewers are windows the host lays over the pane, under
the bar.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Viewer choice | the bar's drop-down of every viewer for the file, kept per type; the action to step through them; replaces `previewWindowsTypes` | -- | 3.1 |
| Lister plugins | Total Commander lister plugins (WLX) found, offered by their detect strings, run in a helper process, hosted over the pane | Viewer choice | 3.2 |
| LexPen viewer | Foldex offers LexPen's preview handler for the types LexPen lists; the handler itself is built in LexPen | Viewer choice; LexPen's plan | 3.3 |

## 3. Details

### 3.1 Choosing the viewer

- **Which viewers a file has**, in this order:
  - **Foldex**: its own viewer, when it has one (plan 04 3.1).
  - **Windows**: the preview handler registered for the type, when there is one.
  - **LexPen**: when LexPen's handler is installed and lists the type (3.3).
  - **Each lister plugin** whose detect string takes the file (3.2), by the plugin's name.
- **The drop-down** is at the left of the preview's bar and names the viewer shown ("Foldex", "Windows", "LexPen", a
  plugin's name). It is a menu (`menu.js`), so it closes on a second click and closes every other menu. It lists the
  viewers of the file shown, with a check at the one shown; choosing one shows the file in it at once and keeps the
  choice for the type. With only one viewer, the bar shows its name and no drop-down.
- **Keys**: the action `preview.nextViewer` steps to the next viewer of the list and keeps it, as the drop-down does.
  It has no key by default (keys.json can give it one). It is also in F1 and can go on the ribbon.
- **Kept per extension** in the setting `previewViewers` (`{ ".md": "lexpen", ".log": "lister:LogView",
  ".pdf": "windows" }`). A type without an entry, or whose kept viewer is gone (a plugin removed), keeps plan 04's
  order: Foldex's own viewer, else Windows' handler, else LexPen, else a plugin, else text, Windows' picture, hex,
  properties.
- `previewViewers` replaces `previewWindowsTypes`: its extensions become entries with "windows" (`SettingsFile`
  Renamed / Renaming, as other old settings).
- **The native viewers** (Windows, LexPen, a plugin) are native windows over the pane. The bar is the page's, so the
  host lays the native window over the pane's area under the bar, not over all of it, and the bar shows for every
  viewer.
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
    the next file starts a new helper. A plugin that does not answer within a time [not yet decided] counts as hung.
  - One helper serves every pane of the window. It stays while a pane shows a plugin's view, and ends a while after
    the last one [not yet decided how long].
- **Hosting.** As a Windows preview handler is (`PreviewHost`): the plugin's window moves and hides with the pane, and
  is unloaded when the preview moves on (plan 04 3.2), so it does not hold the file open. The helper uses
  `ListLoadNextW` when the plugin has it, so a series of files does not make a window per file.
- **Keys.** The plugin's window has the keyboard when the pane is active and the preview has the focus; Esc and
  Foldex's global keys go back to Foldex [not yet checked how across the processes; Total Commander's Lister handles
  keys around its plugins].

### 3.3 LexPen as a viewer

- **The handler is LexPen's.** LexPen implements a Windows preview handler (`IPreviewHandler`,
  `IInitializeWithFile`, `IObjectWithSite`) in LexPen.exe itself, as a local COM server (`LocalServer32`), so the
  preview runs in LexPen's process. It shows a single pane of LexPen, read-only, with LexPen's colouring, language
  packs and markdown preview. Open in LexPen stays one action away (plan 04 3.4).
- **Registered without taking a type.** LexPen registers its handler's COM class and lists it with Windows' preview
  handlers. It does not bind the handler to `.md`, `.cs` and the others under their `shellex` key, so no other
  program's preview is replaced, in Explorer or Outlook. Under its class it writes the extensions it shows (from its
  language packs).
- **Foldex's part.**
  - It finds LexPen's handler by its class, through its registration (`Applications\LexPen.exe` names the exe; the
    class is LexPen's [its CLSID: set in LexPen's plan]).
  - It reads the extensions listed there and offers "LexPen" for those types.
  - It creates the handler by its class, as `PreviewHost` creates any handler now (`CoCreateInstance`, local server
    first).
- **LexPen's work** has its own plan in LexPen's repository: the handler, a fast start, one LexPen process (one
  WebView2) kept for the next file instead of one per file, and the registration. Binding it to types for Explorer as
  well can be an option there.

### 3.4 How the viewers sit together

| | Lister plugins | LexPen |
|---|---|---|
| Generic | yes: any viewer written for the format | no: only LexPen |
| Built in | Foldex (detecting, the helper, hosting) | LexPen (the handler); Foldex: finding it and its types |
| Runs in | Foldex's plugin helper | LexPen's process |
| Offered for | the files their detect strings take | the types LexPen lists |

For a markdown file the drop-down can offer Foldex, Windows (when a handler is bound to `.md`), LexPen and a markdown
lister plugin; the user picks one once per type, or steps through them with `preview.nextViewer`.

### 3.5 Tests

- **Unit:**
  - the viewers offered for a file (own, Windows, LexPen by its listed types, plugins by detect string);
  - `previewViewers` with the order, and a kept viewer that is gone;
  - `previewWindowsTypes` read as `previewViewers`;
  - parsing detect strings.
- **In the test copy:**
  - the drop-down for a markdown file and `preview.nextViewer`, the choice kept for the type;
  - a lister plugin showing a file, the next file through `ListLoadNextW`, the pane moved, floated and closed;
  - a plugin that crashes: Foldex stays, the preview says so, the next file works;
  - LexPen's handler, once LexPen has it.

## 4. Open questions

None.
