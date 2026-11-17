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

The preview gets a switch in its bar: Foldex's own viewer, or the native one for the file, and the choice is kept per
type. The native one is a Windows preview handler, as now, or a plugin. Which plugins is the choice of this plan:
Total Commander lister plugins (a generic format with many existing viewers), a LexPen preview handler (LexPen
registering itself as a Windows preview handler: its real view, but only LexPen), or both. A plugin's window is
hosted by the host over the pane, as a Windows preview handler is.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Viewer switch | the bar's choice between Foldex's view and the native one, kept per type; replaces `previewWindowsTypes` | -- | 3.1 |
| Lister plugins | Total Commander lister plugins (WLX) found, chosen per file, hosted over the pane | open question 1, 2 | 3.2 |
| LexPen preview handler | LexPen registers a Windows preview handler (a local COM server); built in LexPen, Foldex hosts it as any handler | open question 1 | 3.3 |

## 3. Details

### 3.1 The viewer switch

- The bar above the preview gets a choice of the viewers there are for the file shown: **Foldex** (its own viewer,
  when it has one), **Windows** (the preview handler registered for the type, when there is one), and each plugin
  that takes the file (3.2). Only viewers that exist for the file are offered; with one, there is no choice to show.
- The choice is kept per extension in the setting `previewViewers` (`{ ".md": "windows", ".log": "lister:LogView" }`).
  A type without an entry keeps plan 04's order: Foldex's own viewer, else Windows' handler, else a plugin, else text,
  Windows' picture, hex, properties.
- `previewViewers` replaces `previewWindowsTypes`: its extensions become entries with "windows" (`SettingsFile`
  Renamed / Renaming, as other old settings).
- A native viewer (Windows' handler or a plugin) is a native window over the pane. Plan 04's bar is the page's, so it
  stays above that window: the host lays the native window over the pane's area under the bar, not over all of it
  [not yet checked: the area under the bar is what `PreviewArea` gets now].
- Settings window: the preview group lists the kept choices, each removable (back to the order).

### 3.2 Total Commander lister plugins (WLX)

- A lister plugin is a DLL (`.wlx64` for 64-bit) that makes a viewer window for a file: `ListLoadW(parent, file,
  flags)` returns its window as a child of `parent`; `ListLoadNextW` shows another file in the same window;
  `ListCloseWindow` closes it; `ListGetDetectString` says which files it takes (`EXT="TXT" | EXT="LOG"`, also by
  content and size). Others are optional: search, print, copy, a picture for thumbnails (`ListGetPreviewBitmap`)
  [not yet checked: the exact set in the current plugin interface].
- Only 64-bit plugins: Foldex is 64-bit. Many plugins exist [not yet checked which are still kept up and 64-bit].
- Found in a folder of Foldex's data (`plugins\wlx\`), or added by path in Settings (as Total Commander's own list).
  Each one's detect string is read when it is added and kept, so choosing a viewer does not load every DLL.
- Hosted as a Windows preview handler is (`PreviewHost`): the plugin's window is a child of the native panel over the
  pane; it moves and hides with the pane; unloaded when the preview moves on (plan 04 3.2), so it does not hold the
  file open. `ListLoadNextW` when the plugin has it, so a series of files does not make a window per file.
- Keys: the plugin's window has the keyboard when the pane is active and the preview has the focus; Esc and Foldex's
  global keys go back to Foldex [not yet checked how; Total Commander's Lister handles keys around its plugins].
- **Risk: a plugin runs in the process that loads it.** A plugin that crashes or hangs takes that process with it.
  In Foldex's process that is the whole window. In a helper process (the same exe started for plugins, as plan 05's
  elevated helper is started for listing) only the preview goes; the plugin's window is then a child across
  processes, which works (preview handlers in `prevhost.exe` do the same) but needs care with focus and input
  (open question 2).

### 3.3 A LexPen preview handler

- LexPen implements a Windows preview handler (`IPreviewHandler`, `IInitializeWithFile`, `IObjectWithSite`) in
  LexPen.exe itself, registered as a **local server** (`LocalServer32`): the preview runs in LexPen's process, which
  Foldex's `PreviewHost` already tries first. Foldex needs nothing new for it; it is a Windows handler like Office's.
- What it shows: a single pane of LexPen, read-only, with LexPen's colouring, language packs and markdown preview;
  Open in LexPen is one action away (plan 04 3.4).
- What it costs, in LexPen: the handler interface; a fast start, and one LexPen process (one WebView2) kept for the
  next file instead of one per file; registration per extension under `shellex\{8895b1c6-...}`.
- **Trade-off: a Windows handler is registered per type for every program.** Registering LexPen for `.md` or `.cs`
  replaces the handler another program registered for that type, in Explorer and Outlook too. LexPen's installer
  should therefore register only types without a handler, or ask. In return, the preview also works in Explorer and
  Outlook.
- This plan's part in Foldex is only the switch (3.1). The LexPen work is a plan in LexPen's repository, written when
  this choice is made.

### 3.4 The choice: lister plugins, LexPen, or both

| | Lister plugins | LexPen preview handler |
|---|---|---|
| Generic | yes: any viewer written for the format | no: only LexPen |
| Built in | Foldex (loading, detecting, hosting) | LexPen (the handler); Foldex: nothing |
| Viewers | existing ones, of varying quality and upkeep | LexPen's own view, kept up with LexPen |
| Elsewhere | Total Commander, Double Commander and others | Explorer, Outlook |
| Risk | a native DLL in a process of Foldex's (3.2) | in LexPen's process; a per-type registration (3.3) |

Both together give LexPen's view for its types and plugins for the rest; the switch (3.1) offers each that takes the
file.

### 3.5 Tests

- Unit: the viewers offered for a file (own, Windows, plugins by detect string); `previewViewers` with the order;
  `previewWindowsTypes` read as `previewViewers`; parsing detect strings.
- In the test copy: the switch for a markdown file (Foldex, Windows when a handler is registered); a lister plugin
  showing a file, the next file through `ListLoadNextW`, the pane moved, floated and closed; a plugin that crashes
  (with the helper process: Foldex stays); the LexPen handler, once LexPen has it.

## 4. Open questions

1. **Which plugins:** Total Commander lister plugins, a LexPen preview handler, or both? Lister plugins are generic
   and built in Foldex; the LexPen handler is LexPen only and built in LexPen, and also works in Explorer (3.4).
2. **Lister plugins in Foldex's process or a helper process?** In Foldex's process is simpler; a crashing plugin then
   takes the window. A helper process keeps Foldex up, at the cost of a window across processes (3.2). Suggestion: a
   helper process.
