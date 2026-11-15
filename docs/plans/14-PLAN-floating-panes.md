# Plan 14: Floating panes, and every window a pane

Status: partly executed; see Status and 6 (As built).

- 2026-11-11: draft, taken out of plan 12 (its open question 1).
- 2026-11-15: partly executed: stage 1 (pane pages, the floating window, Float and Dock, the Log as a page).
- 2026-11-15: partly executed: stage 2 (Manage the bookmarks as a page).
- 2026-11-15: partly executed: stage 3, most of it (modal floating windows: a name asked, Edit a bookmark, Move to
  folder..., About, Find, Rename, More columns).

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
| Float and dock back | Float and Dock in the pane's menu (floating: its page's right-click); its window's own close button docks it back | 3.1; 6.1 |
| Kinds stated | every pane kind says which it can be (PaneCan); Float and Dock offered only where it can | 3.7; 6.1 |
| Log as a page | the Log, docked or floating | 3.0; 6.1 |
| Manage the bookmarks | a pane page (docked or floating), no longer a modal dialog; first floating, then where it was last | 3.0; 3.7; 6.2 |
| Modal floating windows: the window | `PaneForm` shown modal with a dialog's page (`dialog.html`, `dialogpage.js`), as large as its dialog, its host requests through the window's page | 3.7; 6.3 |
| Modal floating windows: a name asked, Edit a bookmark | askText; Edit a bookmark with Change Icon inside it; Move to folder... (Manage) | 3.7; 6.3 |
| Modal floating windows: Find, Rename, More columns | each in a window of its own; what only the window's page has (the items, the pane's columns) asked of it while open | 3.7; 6.4 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Dock by dragging | a floating pane's window dragged onto its Foldex window docks it there, the places lit as for a docked pane | -- | 3.1 |
| Modal floating windows: the others | the Size of a bar, the Projects window's question | Open questions 1, 2 | 3.7 |
| Panes of their own | Manage column sets, F1, Settings, Projects as pane pages, docked or floating | The floating window | 3.0; 3.7 |
| Preview and Info as pages | Windows' preview over a frame and over a floating window; Foldex's own preview; Info | The floating window | 3.0 |
| F3 | a preview in a new floating window | Preview and Info as pages | 3.5 |
| Scrap, list and tree as pages | the panes of the layout as pages; following, executing, back and forward through the window's page | Preview and Info as pages | 3.0; 3.3 |
| Colours across windows | head, ring, branch marks and pane theme as when docked, changing with the window's | Scrap, list and tree as pages | 3.3 |
| A floating scrap | drops, its search, its dashed ring; gone after a restart unless pinned (then back empty) | Scrap, list and tree as pages | 3.3 |
| Speed | measured before stage 1 and after each stage | -- | 3.0 |

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
- Where Foldex differs from LexPen: LexPen's editor panes stay in its page and only its tool panes are pages; in
  Foldex every pane is one, the tree and the list too, as the user chose. LexPen's scope of a pane (one document, a
  window, LexPen) is not taken: a Foldex pane belongs to its window's layout.
- The stages, each built, tested and used before the next (the Status rows in this order): 1. pane pages, the
  floating window, Float and Dock, the Log as the first page; 2. Manage the bookmarks as a page; 3. the modal floating
  windows; 4. Manage column sets, F1, Settings and Projects; 5. the preview and Info, then F3; 6. the scrap, the list
  and the tree, with their connections and colours across windows.
- Speed comes first, as in LexPen (3.2 there): the start until the first folder shows, opening a folder of many
  items, moving the cursor in a list, measured before stage 1 and after each stage (figures in 6, As built:
  `[not yet calculated]`); a stage that makes one clearly slower is not merged until it is not.

### 3.1 Floating and docking back

- Any pane can float: a tree, a list, a preview, a scrap (docs/plans/executed/06-PLAN-search-and-scrap.md).
- The pane head's menu (plan 12 3.2) gets Float; a floating pane's menu gets Dock, back to the place it came from.
- Dragging a floating pane's head onto a dock mark of its window docks it there (plan 12 3.1).

### 3.2 The floating window

- LexPen's `PaneForm`: a form of its own with its own WebView2, showing the pane's page from the panes' site, in its
  window's theme (its caption dark in dark mode); not modal, owned by its window, closes with it. Closing it docks the
  pane back where it was (paneClosed).
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
| Tree, list, scrap, preview, Info, Log | docked panes | both | docked | 3.1 |
| F3's preview | (not built) | both | floating | 3.5 |
| Manage the bookmarks | modal dialog (bookmarks.js) | both | floating, beside the window | plan 26 3.3: a tab for the bookmarks and one for quick access; its Edit... and New open their dialogs over it |
| Manage column sets | modal dialog (columns.js openManageSets) | both | floating | |
| F1, all actions and keys (palette.js) | modal dialog | both, not modal | floating | as LexPen's F1 (plan 19 3.10): stays open while actions run |
| Settings | a form of the host with its own page (SettingsForm, settings.html) | both | floating | as LexPen's; docked: its page as a pane of the main page |
| Projects | a form of the host with its own page (ProjectsForm, projects.html) | both | floating | as LexPen's; docked: as Settings |
| More columns (every property, columns.js moreColumns) | modal floating window | modal floating window (built) | | adds columns to the pane it was opened from |
| Find | modal floating window (find.js) | modal floating window (built) | | fills a scrap |
| Rename (several items, renamedialog.js) | modal floating window | modal floating window (built) | | renames the items selected when it opened |
| Edit a bookmark, Change Icon, Move to folder..., the Size of a bar, a name asked (askText), the Projects window's own question | modal dialogs of the page | modal floating window | | each asks one thing and waits for the answer |
| Foldex's question window (AskForm) | a modal window of its own | modal floating window (as now) | | |
| The ribbon's Customize (plan 19 3.9) | (not built) | modal floating window | | |
| About Foldex (View > Foldex, beside Settings; as LexPen's) | modal floating window | modal floating window (built) | | the project, by whom, Buy me a coffee (opens in the browser), the build, what it runs on |

## 4. Open questions

1. The Size of a bar (bars.js openSizeWindow) is not modal now, on purpose: the main window can be resized while it
   is open, and the bar's limit marks follow, so a maximum % of the window can be tried out. A modal floating window
   (3.7) blocks the main window, so it could no longer be resized meanwhile. Options: (a) a floating window of its
   own that is not modal (moved anywhere, the main window still usable; it never docks); (b) modal as 3.7 says, the
   resizing lost; (c) left as it is, a dialog of the page. Recommended: (a).
2. The Projects window's question (projects.js ask: a name, a copy's name) belongs to the Projects window, a form of
   the host with its own page, not to the main window's page, which is where modal floating windows are opened from
   now. In stage 4 Projects becomes a pane of the main window's page, and its question then goes the same way as
   the others with nothing of its own. Options: (a) done with stage 4; (b) now, the Projects form opening such a
   window itself. Recommended: (a).

## 6. As built

### 6.1 Stage 1: pane pages, the floating window, the Log

- WebFiles: the panes' site `foldex-panes.example`, the same files as the page's (a debug build: the project's web
  folder, DenyCors so the page may frame it; a release build: the resources, a filter for every source kind, as
  LexPen's). The browser environment maps both names to 127.0.0.1 (no DNS wait).
- `PaneForm.cs` (from LexPen's): the pane's page from the panes' site, its messages to its window's page (`fromPane`)
  and back (`toPane`); its background and dark caption from the window's look (MainForm.Look, again when the look
  changes); not modal, owned by its window, not in the taskbar. Its place and size are told to the page after any
  move or size, once it rests (`paneBounds`); its own close button docks the pane back (`paneClosed`); getting the
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
  dragging); the speed figures (3.0) were not measured before this stage: `[not yet calculated]`.

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
