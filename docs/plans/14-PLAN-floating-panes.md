# Plan 14: Floating panes, and every window a pane

Status: partly executed; see Status and 6 (As built).

- 2026-11-11: draft, taken out of plan 12 (its open question 1).
- 2026-11-15: partly executed: stage 1 (pane pages, the floating window, Float and Dock, the Log as a page).
- 2026-11-15: partly executed: stage 2 (Manage the bookmarks as a page).
- 2026-11-15: partly executed: stage 3 (modal floating windows: a name asked, Edit a bookmark, Move to folder...,
  About, Find, Rename, More columns; the Size of a bar, not modal).
- 2026-11-15: partly executed: stage 4 (Manage column sets, F1, Settings and Manage projects as pages).
- 2026-11-15: partly executed: stage 5 (Preview and Info as pages, F3).
- 2026-11-15: partly executed: Dock by dragging.

Builds on plan 12 (docking panes) and plan 03 (connected panes). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

A Foldex pane docks in its window (plan 12) but cannot float as a window of its own, for instance on another
monitor. LexPen's panes can (LexPen `docs/plans/executed/PLAN-docking.md` 3.3, 3.5).

Foldex's other windows are each something else: a modal dialog of the page (Manage the bookmarks, Manage column sets,
Find, ...) or a form of the host (Settings, Projects). None can be docked, and the dialogs cannot be moved off the
window. The rule (CLAUDE.md, Windows): every window is a docked pane and/or a floating window, unless the user says
otherwise for that window; a floating one can always be docked and a docked one set floating again; and for every
window it is stated which it can be.

## 2. The solution, in brief

As LexPen: every pane is a page of its own, the same page docked or floating. Docked, it is a frame in the window's
page, from a site of its own, in its place in the docks; floating, it is that page in a window of its own (LexPen's
`PaneForm`). The pane talks to its window's page only, through a channel (LexPen's `panechannel.js` and `pane.js`):
directly as a frame, through the host while floating. The window's page keeps the layout (the connections, the
branches, the colours, the docks) and tells each pane what it shows. Any pane can float, a scrap included, and docks
back from its menu or by dragging. It stays connected exactly as when docked: a floating child still follows its
parent, a floating parent still drives its children, and its colours (head, ring, branch marks, pane theme) are the
ones it would have docked. Moving a pane between docked and floating hands over what it shows, so it comes back as it
was. It is built in stages (3.0), the smallest panes first and the tree and the list last, each stage used at once. F3 opens a preview in a new floating window of its
own, showing the item the active pane focuses, and keeps showing that item. Foldex's other windows become panes of
their own kind as 3.7 lists them, Manage the bookmarks first: each can be docked, floating or both, as its row says,
and moves between the two as any pane does; F1, Settings and Projects are such panes, as LexPen has them. The
dialogs that ask something and wait (Edit a bookmark, Find, Rename, ...) stay modal, but each in a floating window of
its own that can be moved anywhere, off the main window too, so what is under it can be seen. This plan is built
before plan 19 (the ribbon), which needs F1 as a floating pane; the floating scrap needs it too.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Pane pages | the panes' site, `pane.js` and `panechannel.js` from LexPen, a pane's frame in its dock place, kept loaded while the docks change | 3.0; 3.2; 6.1 |
| The floating window | `PaneForm` from LexPen: a pane's page in a window of its own, in the window's theme, its place kept | 3.2; 3.4; 6.1 |
| Float and dock back | Float and Dock in the pane's menu (floating: its page's right-click); its window's own close button closes the pane | 3.1; 6.1 |
| Kinds stated | every pane kind says which it can be (PaneCan); Float and Dock offered only where it can | 3.7; 6.1 |
| Log as a page | the Log, docked or floating | 3.0; 6.1 |
| Manage the bookmarks | a pane page (docked or floating), no longer a modal dialog; first floating, then where it was last | 3.0; 3.7; 6.2 |
| Modal floating windows: the window | `PaneForm` shown modal with a dialog's page (`dialog.html`, `dialogpage.js`), as large as its dialog, its host requests through the window's page | 3.7; 6.3 |
| Modal floating windows: a name asked, Edit a bookmark | askText; Edit a bookmark with Change Icon inside it; Move to folder... (Manage) | 3.7; 6.3 |
| Modal floating windows: Find, Rename, More columns | each in a window of its own; what only the window's page has (the items, the pane's columns) asked of it while open | 3.7; 6.4 |
| Speed before and after stages 1-5 | the start, opening a folder of 5150 items, moving the cursor: main before plan 14 and this branch after stage 5 | 3.0; 6.11 |
| Dock by dragging | a floating pane's window dragged by its title bar over its Foldex window: the place lit as for a head's drag; let go there, it docks there | 3.1; 6.10 |
| Preview and Info as pages | preview.html: Foldex's own preview, its messages and Info drawn by the page; Windows' preview per pane, over the frame docked, over its window floating; both can float | 3.0; 6.9 |
| F3 | a preview of the focused item in a new floating window that keeps it, beside the window, the keyboard staying; side by side; Esc closes it | 3.5; 6.9 |
| Settings and Manage projects | pane pages (docked or floating) in place of the host's own windows; the Projects question in a modal floating window | 3.7; 6.8 |
| F1 | a pane page (docked or floating), not modal; it stays open while actions run, on the active pane | 3.7; 6.7 |
| Manage column sets | a pane page (docked or floating), no longer a dialog; one of it, opened where it was last (shared with Manage the bookmarks) | 3.7; 6.6 |
| The Size of a bar | a floating window of its own, not modal (moved off the bar, the main window still resizable); the marks of a bar after one that fills its line measured from its far end | 3.7; 6.5 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Scrap, list and tree as pages | each a page of its own, docked too (a frame), talking to the host itself; following, executing, back and forward through the window's page | -- | 3.0; 3.3 |
| Colours across windows | head, ring, branch marks and pane theme as when docked, changing with the window's | Scrap, list and tree as pages | 3.3 |
| A floating scrap | drops, its search, its dashed ring; gone after a restart unless pinned (then back empty) | Scrap, list and tree as pages | 3.3 |
| Speed after stage 6 | the three figures of 6.11 again once the tree, the list and the scrap are pages | Scrap, list and tree as pages | 3.0; 6.11 |

## 3. Details

### 3.0 Every pane a page, as LexPen; the stages

- As LexPen (`..\LexPen\docs\plans\executed\PLAN-docking.md` 3.4, 3.5; `src/web/pane.js`, `panechannel.js`,
  `src/PaneForm.cs`): every pane kind is a page of its own (log.html, bookmarks.html, preview.html, list.html,
  tree.html, ...). Docked, its page is a frame (an iframe) in the window's page, in the pane's place in the docks
  (docks.js, as built); the frame comes from the panes' site (a second host name served by WebFiles, as the page's own
  is), so the browser runs it in a process of its own. Floating, the same page is in a `PaneForm`.
- The pane and its window's page talk only through the channel: `postMessage` between the frame and the page;
  floating, through the host (PaneForm passes `fromPane` to its window's page and `toPane` back). What needs the host
  (a listing, the icons, a file operation) the pane asks of its window's page, which asks the host as now and passes
  the answer back. The page keeps what is shared: the layout and its connections, the settings, the key set, the
  bookmarks; a pane gets what it needs from it, and what changes.
- A key the pane does not use goes to its window's page (pane.js), so the window's keys work in every pane. A press in
  a pane makes it the active one. Floating, a menu of the window's page is drawn by the pane (pane.js paneMenu).
- Moving a pane between docked and floating loads its page in the new place; what it shows is kept by the window's
  page and handed over (`state()`), so it comes back as it was.
- The tree, the list and the scrap are pages too, docked as well (a frame each, a process each): they behave as truly
  separate windows, which may share the host as their common server. Their code runs in their own page and asks the
  host itself (WebView2's frame messages docked, PaneForm floating), as the window's page does; the window's page keeps
  the layout and passes what connects them (the focus a child follows, executing, back and forward, the colours).
  Drag and drop between panes goes between pages (the host's shell drag, as from Explorer). The start and memory with a
  frame per pane are measured (6.11) before stage 6 is merged.
- Where Foldex differs from LexPen: LexPen's editor panes stay in its page and only its tool panes are pages; in
  Foldex every pane is one, the tree and the list too, as the user chose. LexPen's scope of a pane (one document, a
  window, LexPen) is not taken: a Foldex pane belongs to its window's layout.
- The stages, each built, tested and used before the next (the Status rows in this order): 1. pane pages, the
  floating window, Float and Dock, the Log as the first page; 2. Manage the bookmarks as a page; 3. the modal floating
  windows; 4. Manage column sets, F1, Settings and Projects; 5. the preview and Info, then F3; 6. the scrap, the list
  and the tree, with their connections and colours across windows.
- Speed comes first, as in LexPen (3.2 there): the start until the first folder shows, opening a folder of many
  items, moving the cursor in a list, measured before stage 1 and after the stages (figures in 6.11); a stage that makes
  one clearly slower is not merged until it is not.

### 3.1 Floating and docking back

- Any pane can float: a tree, a list, a preview, a scrap (docs/plans/executed/06-PLAN-search-and-scrap.md).
- The pane head's menu (plan 12 3.2) gets Float; a floating pane's menu gets Dock, back to the place it came from.
- Dragging a floating pane's window by its title bar onto a place of its Foldex window docks it there (plan 12 3.1).
- Dragging a docked pane's head or tab out of its window and letting go there floats it, its window where it was let
  go (a pane whose kind can float).

### 3.2 The floating window

- LexPen's `PaneForm`: a form of its own with its own WebView2, showing the pane's page from the panes' site, in its
  window's theme (its caption dark in dark mode); not modal, owned by its window, closes with it. Closing it by its
  own close button closes the pane, as a docked pane's Close does (paneClosed); Dock (3.1) is how it goes back.
- A modal floating window (3.7) is the same form shown modal over its window, with a dialog's page.

### 3.3 Connections

- Every pane is a page (3.0): what it gets from the layout (its parent's focused folder, its branch, the colours) the
  window's page sends it through the channel, docked or floating alike.
- Connected as when docked: its parent and children, its branch and pin stay; the Branch menu (detach, attach, branch
  colour) works across windows.
- Coloured as when docked: its head, its ring (a scrap's dashed), its branch marks and its pane theme are what the
  layout gives it, and change when the main window's change (another active pane, another branch, another theme).
- A floating scrap: still a drop target, its search runs and fills it as when docked. After a restart it does not
  come back, as a scrap in the center; a pinned one does, empty, with its name and search (pinning a scrap is built,
  docs/plans/executed/06-PLAN-search-and-scrap.md 3.2).

### 3.4 Kept

- A floating pane's place and size go with the window's layout (plan 12 3.4; plan 15 once projects are built).

### 3.5 F3: a preview in a floating window

- F3 (action preview.float; F3 is free in the shipped keys.json) opens a new preview pane, floating in a window of
  its own (3.2), showing the item the active pane focuses: Windows' preview, else Foldex's own (plan 04, OwnPreview),
  as a docked preview.
- The window opens beside the main window (on the other monitor when there is one, else at the right of it), sized as
  the last floating preview was; its place and size are kept (3.4).
- It is not the global preview (Alt+P) nor a pane's own: those stay as they are. Esc in the floating window closes
  it; Dock in its menu docks it as a preview pane (3.1).
- The keyboard stays in the active pane of the main window.
- It keeps showing the item it was opened on: it does not follow the focus (it is no child of any pane).
- A second F3 opens another floating window, for the item focused then: each window keeps its own item, so two
  items can be compared side by side.

### 3.6 Tests

- In the test copy: a list floated, the tree's focus changed, the floating list follows; docked back, it shows the
  same folder and selection; the layout with a floating pane back after a restart.
- A floating list's head and ring in its branch colour, changing when another branch becomes active in the main
  window; a floating tree driving a docked list; a scrap floated, files dropped on it, a search into it.
- F3 on an image, a video and a file without a preview: the floating window with its preview, the keyboard still in
  the list; another item focused: the window keeps its item; F3 again: a second window with the new item; Esc closes it; its place and size after a restart.
- Every window of 3.7 that can be both: floated, docked, floated again, each time showing what it showed; Float and
  Dock not offered where its row says it cannot. Manage the bookmarks: opened floating, docked, a bookmark edited
  from it while docked, closed and opened again where it was; opened again while shown: the same one, forward.
- F1, Settings and Projects: docked and floating; F1 stays open while an action runs.
- A modal floating window (Find, Edit a bookmark, a name asked): moved off the main window, the panes under it seen;
  the main window takes no key or click while it is open; Esc and Enter as before; its answer reaches the page.

### 3.7 Every window a pane: what each can be

- Each pane kind states which it can be: docked, floating or both (a field of the kind in app.js, beside makeView).
  The pane head's menu offers Float only for a docked pane that can float, and Dock only for a floating one that can
  dock. A new window or pane kind gets its row here, and its plan says the same.
- A window that becomes a pane keeps what it does and its keys; its buttons stay at its bottom. Opened from its menu
  item or action, it shows where it was last (docked or floating, at its place); the first time as its row says.
  Opened again while it is shown: it comes forward and gets the keyboard, never a second one.
- A modal floating window: a window of its own (as Foldex's question window, AskForm, is already), shown over the
  window it came from, which waits for it (no key or click reaches that window meanwhile). It is moved by its title
  bar anywhere, off the main window and onto another monitor too, so what it covers can be seen; it never docks.
  Esc, Enter and its letter keys as now. A page dialog becomes one by being shown in a form of its own with its own
  WebView2 (as the floating window of 3.2), the page code the same; how its answer goes back to the page is through the
  host, as for a floating pane (3.3).
- The windows Foldex has, and what each can be:

| Window | Now | Can be | First opens | Note |
|---|---|---|---|---|
| Tree, list, scrap | docked panes | both | docked | 3.1 |
| Preview, Info, Log | pane pages | both (built) | docked | 3.1 |
| F3's preview | pane page (preview.html) | both (built) | floating, beside the window | 3.5 |
| Manage the bookmarks | modal dialog (bookmarks.js) | both | floating, beside the window | plan 26 3.3: a tab for the bookmarks and one for quick access; its Edit... and New open their dialogs over it |
| Manage column sets | pane page (columnsets.html, colsmanage.js; columns.js openManageSets) | both (built) | floating | its sets above the one chosen in a narrow pane |
| F1, all actions and keys (palette.js, palette.html, palettepane.js) | pane page | both, not modal (built) | floating | as LexPen's F1 (plan 19 3.10): stays open while actions run |
| Settings | pane page (settings.html; PaneHosts.Settings) | both (built) | floating, in the middle of the window | as LexPen's; one per window, every window following a change |
| Projects | pane page (projects.html; PaneHosts.Projects) | both (built) | floating, in the middle of the window | as LexPen's; docked: as Settings |
| More columns (every property, columns.js moreColumns) | modal floating window | modal floating window (built) | | adds columns to the pane it was opened from |
| Find | modal floating window (find.js) | modal floating window (built) | | fills a scrap |
| Rename (several items, renamedialog.js) | modal floating window | modal floating window (built) | | renames the items selected when it opened |
| Edit a bookmark, Change Icon, Move to folder..., a name asked (askText) | modal floating windows | modal floating window (built) | | each asks one thing and waits for the answer |
| The Projects pane's own question (a name, a copy's name) | modal floating window | modal floating window (built) | | asked by the window's page for the pane (askText) |
| The Size of a bar (bars.js) | floating window, not modal | floating window, not modal (built); never docks | | moved off the bar it sizes; the main window stays usable and can be resized meanwhile, the bar's marks following |
| Foldex's question window (AskForm) | a modal window of its own | modal floating window (as now) | | |
| The ribbon's Customize (plan 19 3.9) | (not built) | modal floating window | | |
| About Foldex (View > Foldex, beside Settings; as LexPen's) | modal floating window | modal floating window (built) | | the project, by whom, Buy me a coffee (opens in the browser), the build, what it runs on |

## 4. Open questions

None.

## 6. As built

### 6.1 Stage 1: pane pages, the floating window, the Log

- WebFiles: the panes' site `foldex-panes.example`, the same files as the page's (a debug build: the project's web
  folder, DenyCors so the page may frame it; a release build: the resources, a filter for every source kind, as
  LexPen's). The browser environment maps both names to 127.0.0.1 (no DNS wait).
- `PaneForm.cs` (from LexPen's): the pane's page from the panes' site, its messages to its window's page (`fromPane`)
  and back (`toPane`); its background and dark caption from the window's look (MainForm.Look, again when the look
  changes); not modal, owned by its window, not in the taskbar. Its place and size are told to the page after any
  move or size, once it rests (`paneBounds`); its own close button closes the pane (`paneClosed`); getting the
  focus makes its pane the active one (`paneWindowFocus`). MainForm: the ops `paneFloat` (made, or brought forward),
  `paneSend`, `paneDock`.
- `pane.js` (from LexPen's, Foldex's names): the pane side of the channel; the window's look (its root's style and
  marks); keys it does not use to the window; a press makes its pane active; floating, a right-click asks the window
  for the pane's menu, which the page draws with Foldex's menu.js; ready once its scripts ran (deferred scripts run
  while the page is already "interactive", so it waits for DOMContentLoaded).
- `panechannel.js` (from LexPen's, without its following of the focus between windows, which Foldex has no use for
  yet): the frame, the waiting messages per kind, the state sent whole on ready (the look first), Float, Dock, the menu
  drawn there and a choice run here, a key dispatched here as if pressed here.
- app.js: `PageView` (a pane whose content is a page; extends PreviewView, so nothing follows it and it follows
  nothing, as the Log did); `LogView` is one (log.html, logpane.js, pane.css); `PaneCan` (what each kind can be;
  only the Log floats until its kind is a page); `floatPane` / `dockPane` (where it was docked kept in the layout,
  `floating.place`, and its window's place, `floating.bounds`, then `floatBounds` while docked); a floating pane floats
  again after a restart; Close pane closes its window.
- renderDock moved every pane's element out of the page and back on each change, which loaded a frame's page again:
  now each element is parked in a holder that stays in the page and moved into its place with `moveBefore` (the
  WebView2 here has it); without it, as before.
- Tests in the test copy (CDP, UI Automation): the Log docked in its frame from the panes' site, its lines there;
  Float (its window beside the main window, in the dark theme, a line added while floating shown); its right-click
  menu drawn in its page (Dock, Close pane); Alt+P pressed in it toggling the main window's preview; its window moved,
  the place kept; after a restart floating again at that place; its window's close button docking it back at the
  bottom; Dock from the menu; floated again at its place; Close pane while floating closing its window; the frame not
  loaded again after renderDock, a new pane, and the Log moved to the right area. `dotnet test`: 224 passed.
- Not done in stage 1: docking by dragging the floating window onto its Foldex window (Not yet built, Dock by
  dragging); the speed figures (3.0) were not measured before this stage; 6.11 has them for main before plan 14.

### 6.2 Stage 2: Manage the bookmarks

- What every page that shows the bookmarks needs is in `bookmarktree.js` (out of bookmarks.js): the helpers of the
  tree (bookmarkPlaces, locateIn, putIn, moveBookmarkTo, changeBookmark, copyOfEntry, the folder icon), each page
  with its own `bookmarks`, `saveBookmarks` and the rest.
- The page `bookmarks.html` / `bmmanage.js` holds Manage's screen as it was (tabs, rows, folders, the arrows, the
  handle, To quick access / To bookmarks with Move to and Copy to, New, Move to folder... as a dialog of the page
  itself); a change it makes is saved by the window's page (`save`). What needs the window's page is asked of it:
  Edit, a new folder's name, a new bookmark, removing (the question for a folder that holds something), closing the
  pane; the page selects the entry it gets back (`made`). The window's page sends the bookmarks with their paths,
  whether each is there, and each one's icon as a picture (the system's, Custom, none for Plain), again whenever any
  of it changes.
- app.js `BookmarksView` (a PageView); bookmarks.js `manageBookmarks` opens it: the first time floating beside the
  window; after it was closed, where it was (`bookmarksHome` with the window's layout: docked at its place, or
  floating at its window's place); open already, it comes forward. Its buttons have no letters (they are a pane's,
  not a dialog's); Close closes the pane.
- Until stage 3, what Manage asks of its window (Edit, a new folder's name) opens as before, a dialog of the window's
  page, so over the main window, not over a floating Manage.
- Found while testing: an entry asked at the start, before Windows had its icons ready, came with icon -1 and was kept;
  such entries are asked again (when the list comes, and when Manage opens).
- Tests in the test copy: Manage opened floating (its window beside the main window), its rows with their icons; Space
  on a row (a real key in its page) moving it to Quick access in the window's list, and back; a real drag by the handle
  (Notes out of Projects to the top); Move to folder... in the page (back into Projects); Edit asked of the window (a
  new name, the row selected after); Dock (the same rows in its frame, at the right); closed and opened again where it
  was (docked); floated, its Close button (the pane closed, its window gone), opened again floating; floating again
  after a restart. `dotnet test`: 224 passed.

### 6.3 Stage 3: modal floating windows (first part)

- The host: `PaneForm` with `modal`: no owner set (ShowDialog owns it), fixed, no minimize or maximize, its caption
  the dialog's title; its page's `size` (CSS px, times the screen's scale) makes it that large inside, the first time
  in the middle of its window, kept on its screen; its page's `done` is its answer and closes it. MainForm's op
  `dialogOpen` shows it with ShowDialog over the window (which takes no key or click meanwhile) and answers when it
  closes.
- The page: `dialog.html` loads what the dialogs need (buttons.js, menu.js, pane.js, panes.js, keys.js, actions.js,
  bookmarktree.js, bookmarks.js) and `dialogpage.js`, which stands in for what that code takes from the window's page:
  askHost, post and status through the window's page (its answers back by request), askYes, the icons it was sent, no
  panes. The dialog's own code runs unchanged: its first `showModal` shows it in place, filling the window (the window
  itself is modal); a dialog it opens itself (Change Icon over Edit) is modal inside it, and the window grows to hold
  both. Esc cancels the dialog shown in place.
- The window's page: `dialogWindow(title, args)` (panechannel.js), a channel of its own for the window's time, passing
  the dialog's host requests on. `askText` (projectmenu.js) asks in such a window; `editBookmark` (bookmarks.js) opens
  Edit in one, the dialog itself now `editBookmarkHere`, run there with the bookmarks, keys.json's keys (for the
  clashes) and the bookmark's icon; a new one's place goes as { group, at, quick }.
- Tests in the test copy (CDP into the dialog's page, UI Automation, Win32 IsWindowEnabled): a name asked in its own
  window, the main window disabled while it is open and enabled after; moved to the screen's corner, off the main
  window; a typed name and Enter answered, Esc answered null; Edit a bookmark in its window with its fields and icon,
  Custom opening Change Icon inside it (the window grown), an icon chosen, a new name, OK: the bookmark saved with both;
  Cancel answered nothing. `dotnet test`: 224 passed.
- Move to folder... (bmpick.js, out of the Manage page): the Manage page asks its window's page, which opens it in a
  modal floating window with the bookmarks; the folder chosen goes back to the Manage page (`picked`), which moves the
  entry. Tested: its window with the tab and its folders, the folder the entry is in selected; Projects chosen (Alpha
  moved into it, selected in Manage after); Cancel (nothing moved); the tab's top chosen (back at the top).

### 6.4 Stage 3: Find, Rename, More columns

- What a dialog asks of the window's page itself while it is open (not of the host) goes as `askWindow` (dialogpage.js)
  and is answered by the `calls` given to `dialogWindow` (panechannel.js). A name asked over such a dialog (Find's and
  Rename's Save) is the small dialog inside its window.
- Find: `openFind` (find.js) gathers what the dialog shows (the start, the defaults, the searches kept, the scrap to
  look in, the scraps for Into) and runs the search on OK; the dialog itself is `findHere`, run in the window. A
  search saved there is kept by the window's page (`calls`).
- Rename: the fields are in the window (`renameHere`); the preview (with the companions) and the tokens' examples are
  made in the window's page, where the items and their properties are, asked for on each change (only the last answer
  shown); the first waits for the properties being read. On Rename the window's page makes the preview again from the
  settings it gets back and renames (the question for a changed extension still asked there).
- More columns: the list in the window (`moreColumnsHere`, dialogpage.js); each click adds or takes away the column in
  the pane at once.
- dialog.css: the widths and the lists' heights fixed in the window (not a share of the window's size, which follows
  the dialog).
- Tests in the test copy (CDP into the dialog's page, UI Automation): Find in its window with Look in the list's
  folder, Named f0 and OK: a new scrap "f0" with 9 items, active; Search again: the scrap's search, Into that scrap;
  Cancel: no new scrap. More columns: its window with the properties, 5 for "author", a click adding System.Author to
  the pane's columns while open, a second click taking it away, Close closing it. Rename with 9 items: its window
  (Rename 9 items), the tokens with the first item's examples, x_$B giving "9 of 9 renamed", Rename renaming the 9
  files on disk. The layouts checked: nothing wider than the dialog, Find's own title hidden (the window has it).
  `dotnet test`: 224 passed.

### 6.5 The Size of a bar

- A dialog's window that is not modal: `dialogWindow(..., modal false)`; MainForm's `dialogOpen` with `modal` false
  shows the PaneForm owned by the window (Show, not ShowDialog) and answers when it closes. PaneForm's `dialog` (a
  dialog's page: its size and its answer) is apart from `modal` (how it is shown).
- bars.js `openSizeWindow`: the fields in the window (dialogpage.js `sizeHere`); each change goes back (`calls`) and
  sizes the bar at once, the marks following; Cancel puts the bar back, OK saves; opened again while open: nothing.
  Its Maximum % reads "Maximum % of the window (now X%)": the bar's share of the window, sent by the window's page
  each time it draws the marks (the bar changed, the window resized); `dialogWindow`'s `opened` gives it the channel.
  Tested: 200 of 2564 px "(now 8%)", Normal 600 "(now 23%)", the main window made half as wide "(now 47%)".
- The marks: a bar after one that fills the rest of its line keeps its far end and grows towards its start, so its
  marks are measured back from its right end (its bottom in a column); before, they were measured from its start and
  could fall outside the window.
- Found while testing: `dialogWindow` sent `{ kind: 'args', ...args }`, so an argument called `kind` (the bar's)
  replaced the message's kind and the window stayed empty; the message's kind now comes last.
- Tests in the test copy: the search bar (right of the path bar, which fills) opened: "Size of the search bar" with its
  fields, the main window enabled; moved off the window; its marks at 2444 (min 120) and 2364 (normal 200) for the
  bar at 2364-2564; Normal 300: the bar at 2264-2564, the normal mark at 2264; Cancel: back to 200, the marks gone, the
  window closed; Normal 240 and OK: kept and saved in bars.json. `dotnet test`: 224 passed.

### 6.6 Stage 4: Manage column sets

- Panes there is one of (app.js `openOnePane`, `onePaneClosed`, `paneOfKind`, `OnePanes`): opened again it comes
  forward; after it was closed, where it was last; the first time floating. Where each kind was is kept with the
  window's layout (`homes`, by kind; a layout saved before reads its `bookmarksHome`). Manage the bookmarks uses it
  now in place of its own code (bookmarks.js), so F1, Settings and Projects can too.
- `columnsets.html` / `colsmanage.js`: the screen of the dialog as it was (the sets, Rename..., Duplicate, Delete,
  Reset, the columns with their widths and order, Add a column, the sort, Fit by themselves, the folders using it),
  Close at its bottom. The window's page (columns.js `columnSetsForPage`, `columnSetsPageAsks`; app.js
  `ColumnSetsView`) sends the sets with every column's title and width, again when they change or the properties
  come; it saves what the page changed, and asks a name (a modal floating window) or a Yes (AskForm) for it.
- In a narrow pane (the page is its own document, so a width query is the pane's) the sets go above the one chosen and
  the column rows are tighter.
- Tests in the test copy (CDP into its page, UI Automation): opened floating with the sets, Generic chosen and its
  columns; Duplicate asking "Name of the copy" in its window, "Test set" kept and chosen; a width changed there reaching
  the window's page's set; Delete asking in AskForm, Yes: gone; Dock (right); Close: its place kept; opened again
  docked there; opened again while shown: still one; Manage the bookmarks opening through the same code; after a
  restart docked again, both places kept. The docked pane captured at 280 px wide: nothing cut off after the narrow
  layout. `dotnet test`: 224 passed (the bookmarks keys test stubs `paneOfKind`).

### 6.7 Stage 4: F1

- As LexPen's (commands.html, commands-pane.js): `palette.html` / `palettepane.js` show the rows the window's page sends
  (palette.js `paletteForPage`: every action with its variants, group, title, keys, hint, and whether it works on the
  active pane now), searched in the page; Up / Down / PgUp / PgDn select, a click selects, Enter or a double click runs
  the row there (`run`), Esc clears the search, then closes the pane; the page's focus coming back asks the rows again
  (`refresh`). A pane there is one of (`openOnePane`), first floating; F1 pressed while it is shown brings it forward
  with the keyboard in its search.
- It never becomes the active pane (`PaletteView.passive`, `activate`), so what it runs works on the pane that was
  active, docked or floating alike.
- Where it differs from LexPen's: no section list and no marks on the scrollbar (Foldex's F1 had none); the ribbon's
  parts (Change the ribbon, rows dragged onto it) come with plan 19 3.10. Its close button of the dialog it was is gone:
  docked, the pane's head closes it; floating, its window's close button closes it, as every pane's; Esc closes it.
- Tests in the test copy (CDP into its page): F1 floating with its rows, the version and the keyboard in its search;
  "hidden items" found, Enter: Hidden items toggled on the list, F1 still open, the list still the active pane; Esc
  clearing the search; Dock (right); a press in it docked: the list still active; Esc on an empty search closing it, its
  place kept; F1 again: docked there, the keyboard in its search. `dotnet test`: 224 passed.
### 6.8 Stage 4: Settings and Manage projects

- Their pages (settings.html, projects.html) are pane pages now; the host's windows SettingsForm and ProjectsForm are
  gone. What a page sent its form goes through `hostpane.js` (`paneHost` in place of chrome.webview) to its window's
  page (app.js `HostPageView`), on to MainForm's `paneHost`, which does what the form did (`PaneHosts.Settings`,
  `PaneHosts.Projects`) and answers the same way. What the host told the forms unasked (the settings, the folder
  cache, "the projects changed") every window is told; its page passes it on to its pane.
- Closing (Settings' Esc on an empty search) and going back (Manage projects' Esc) are done by the window's page: the
  pane closes, the keyboard goes back to the active pane. The Projects question (a name, a copy's name) is asked by the
  window's page in a modal floating window (askText); the page's own dialog for it is gone.
- One of each per window (a Foldex window is a project's); a change in Settings reaches every window as before. The
  place of Manage projects is kept with the layout as every pane's (AppState.ProjectsWindow is gone).
- Floating the first time in the middle of the window at a size of its own (`FirstSizes`: Settings, Manage projects,
  Manage column sets, which opened too narrow), through paneFloat's `size` and PaneForm's `first`.
- Tests in the test copy (CDP into the pages): Settings floating at 760x620 with its tabs, 41 rows and the fonts; a
  setting changed there reaching the window's page and the pane's own look; the folder cache row filled by the host;
  Dock (right); Esc on an empty search closing it. Manage projects floating at 900x600 with its project; a sort chosen
  there kept as the setting; New project asking its name in a modal floating window ("Empty: a number"), "Test project"
  made and opened in a window of its own. `dotnet test`: 224 passed.
### 6.9 Stage 5: Preview and Info as pages, F3

- `preview.html` / `previewpane.js`: the page of every preview and Info pane. The window's page decides what it shows
  and sends it (`show`: a message, Foldex's own preview, a still, Info's groups), kept so a page loaded again (floated,
  docked) shows it too; a player that cannot play its file asks for a still. `PreviewView` holds the frame and the
  channel that PageView had (every pane of a page extends it).
- Windows' preview: one per preview pane now (MainForm `previews`, by pane; it was one per window, so two previews
  could not both show Windows' preview). Docked, over the pane's area in the window as before; floating, over its
  whole window (`PaneForm.Preview`), following its size. Floating a preview closes it here and shows it there; docking
  back the other way round (`moved`). The picture shown while a menu of the page lies over a preview covers every
  docked preview it touches.
- A preview and Info pane can float (PaneCan). Closing any pane of a page closes its window and its Windows preview
  (closePane looked only at PageView, so an F3 window stayed open after Esc).
- F3 (`preview.float`, F3 in the shipped keys.json): a preview pane `fixed` on the focused item (it follows nothing, is
  never the global preview, its item kept in the layout), floating; the first time beside the window (on another
  screen when there is one, else at its right; PaneForm `beside`), after that where the last one was; an F3 window
  already there: the new one at its right. Shown without taking the keyboard (`quiet`). Esc in it closes it. They do
  not come back after a restart; their last place does (`homes.f3`). A floating window tells its place once shown, so
  the next F3 knows where the open ones are.
- Tests in the test copy (CDP into the pages, UI Automation, EnumWindows): the global preview docked on note.txt with
  Windows' handler (the text previewer, local server) and on notes.xyz with Foldex's own text; floated: its window,
  its page showing the text, note.txt with Windows' handler in it; docked again with Windows' handler, no window left;
  Info with its groups; F3 on pic.png and F3 on note.txt: two windows side by side on the other screen, each keeping
  its item while the list's focus moved on (the global preview following it), the list still the active pane, neither
  window in front; Esc in the first: its window gone, the second kept. `dotnet test`: 224 passed.
### 6.10 Dock by dragging

- PaneForm sees its window dragged by its title bar (WM_MOVING, then WM_EXITSIZEMOVE) and tells its window's page
  where the mouse is over it, in that page's CSS px (MainForm.PagePoint): `paneDragMove`, `paneDragEnd`. The page
  lights the place as a head's drag does (`dockPlaceAt`, taken out of dragToDock so both use it) and, let go there,
  docks the pane at that place (its window closes, its page in its frame as with Dock).
- Found while testing: while the dragged window has the focus, the main page is inert to the mouse (the setting
  ignoreActivationClick, app.css body[data-inert]), and an inert page finds no element under a point, so only the
  window's edges were found. The page answers again during such a drag and goes back as it was after.
- Tests in the test copy (CDP; the host's messages given to the page, as a real drag of a window would take over the
  mouse of the machine in use): the Log floating; over the list's right quarter the block at the list's right half;
  outside the window no block, let go there: still floating; let go over the list's right quarter: docked at the list's
  right ({ pane: p2, side: right }), its lines in its frame, no block left. The host's side with a real title bar drag:
  [not yet checked].
- The other way: a docked pane's head or tab dragged out of the window and let go there floats it, its window's top left
  near where the mouse was let go, at the size it had floating (dragToDock, floatPane's `at`). Tested with the page's
  own mouse events (CDP, not the machine's mouse): the Log's head pressed, moved and let go past the window's right edge:
  floating, its window at that point.
- A floating window's own close button closes the pane (it docked it back before); Dock and the drag are how it goes
  back. Tested (UI Automation's Close on the window): the Log closed, gone from the layout; Manage column sets closed
  floating, opened again floating.

### 6.11 Speed

- Measured on this machine with `speed.ps1` (the session's scratch folder): each run a fresh data folder; the start
  from the process starting until a list pane shows rows (one connection to the page kept open, asked every few ms);
  opening a folder of 5150 items in the list (timed in the page from goTo until all items are listed and rows drawn);
  200 Down presses in that list, each timed in the page with its layout. Five runs per build, the two builds taking
  turns. Before: main at 3b514d8 (before stage 1, built in a worktree); after: this branch after stage 5 and Dock by
  dragging (428a9f5).
- Not measured after each stage separately (stages 1-5 were built before this was measured): `[not yet calculated]`.

| Figure | Before (median of 5; min - max) | After stages 1-5 (median of 5; min - max) |
|---|---|---|
| Start until the first folder shows | 2242 ms (2106 - 2495) | 2298 ms (2281 - 3381) |
| Opening a folder of 5150 items | 170 ms (167 - 182) | 172 ms (155 - 190) |
| Moving the cursor (Down), per press | 3.0 ms median; mean 3.22 ms; worst 10 ms | 3.1 ms median; mean 3.35 ms; worst 8.9 ms |

- None is clearly slower; the start's medians are 56 ms apart, within the spread of the runs (one run after took
  3381 ms, its first; the others 2281 - 2678 ms).
