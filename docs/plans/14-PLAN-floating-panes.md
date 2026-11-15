# Plan 14: Floating panes, and every window a pane

Status: not started; see Status.

- 2026-11-11: draft, taken out of plan 12 (its open question 1).

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

Any pane can float, a scrap included: it is shown in a window of its own, a form with its own WebView2, and docks back
from its menu or by dragging. It stays connected exactly as when docked: a floating child still follows its parent, a
floating parent still drives its children, and its colours (head, ring, branch marks, pane theme) are the ones it
would have docked; the messages go through the host, as LexPen's floating panes do. Moving a pane between docked and
floating hands over what it shows, so it comes back as it was. F3 opens a preview in a new floating window of its
own, showing the item the active pane focuses, and keeps showing that item. Foldex's other windows become panes of
their own kind as 3.7 lists them, Manage the bookmarks first: each can be docked, floating or both, as its row says,
and moves between the two as any pane does.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Float and dock back | Float in the pane head's menu, for any pane (a scrap too); back by the menu or by dragging onto the window | -- | 3.1 |
| The floating window | a form with its own WebView2 showing one pane, in the window's theme | -- | 3.2 |
| Connections across windows | following, executing, back and forward through the host | -- | 3.3 |
| Colours across windows | head, ring, branch marks and pane theme as when docked, changing with the window's | Connections across windows | 3.3 |
| A floating scrap | drops, its search, its dashed ring; gone after a restart unless pinned (then back empty) | -- | 3.3 |
| Kept | a floating pane's place and size with the window's layout | -- | 3.4 |
| F3 | a preview in a new floating window | The floating window | 3.5 |
| Kinds stated | every pane kind says which it can be (docked, floating, both); Float and Dock offered only where it can | -- | 3.7 |
| Manage the bookmarks | a pane (docked or floating), no longer a modal dialog | The floating window | 3.7; plan 26 3.3 |
| The other windows | each as its row in 3.7 says | Open questions 1-4 | 3.7 |

## 3. Details

### 3.1 Floating and docking back

- Any pane can float: a tree, a list, a preview, a scrap (docs/plans/executed/06-PLAN-search-and-scrap.md).
- The pane head's menu (plan 12 3.2) gets Float; a floating pane's menu gets Dock, back to the place it came from.
- Dragging a floating pane's head onto a dock mark of its window docks it there (plan 12 3.1).

### 3.2 The floating window

- A form of its own with its own WebView2, as LexPen's `PaneForm`; it shows one pane, drawn by the same page code.
- It belongs to the window it came from, and closes with it.

### 3.3 Connections

- Foldex's panes are drawn in one page (plan 02 option A), so a floating pane is in another page: what a docked pane
  gets from the layout in the page (its parent's focused folder, its branch, the colours) it gets by messages through
  the host.
- Whether that needs a channel of the pane's own, as LexPen's: `[not yet checked]`.
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

### 3.7 Every window a pane: what each can be

- Each pane kind states which it can be: docked, floating or both (a field of the kind in app.js, beside makeView).
  The pane head's menu offers Float only for a docked pane that can float, and Dock only for a floating one that can
  dock. A new window or pane kind gets its row here, and its plan says the same.
- A window that becomes a pane keeps what it does and its keys; its buttons stay at its bottom. Opened from its menu
  item or action, it shows where it was last (docked or floating, at its place); the first time as its row says.
  Opened again while it is shown: it comes forward and gets the keyboard, never a second one.
- The windows Foldex has, and what each can be:

| Window | Now | Can be | First opens | Note |
|---|---|---|---|---|
| Tree, list, scrap, preview, Info, Log | docked panes | both | docked | 3.1 |
| F3's preview | (not built) | both | floating | 3.5 |
| Manage the bookmarks | modal dialog (bookmarks.js) | both | floating, beside the window | plan 26 3.3: a tab for the bookmarks and one for quick access; its Edit... and Add... open Edit over it |
| Manage column sets | modal dialog (columns.js openManageSets) | both | floating | |
| More columns (every property, columns.js moreColumns) | modal dialog | both, or not: question 3 | floating | adds columns to the pane it was opened from |
| Find | modal dialog (find.js) | both, or not: question 3 | floating | fills a scrap |
| Rename (several items, renamedialog.js) | modal dialog | both, or not: question 3 | floating | renames the items selected when it opened |
| F1, all actions and keys (palette.js) | modal dialog | question 2 | | closes when an action runs |
| Settings | a form of the host with its own page (SettingsForm, settings.html) | both, or not: question 4 | floating | docked: its page as a pane of the main page |
| Projects | a form of the host with its own page (ProjectsForm, projects.html) | both, or not: question 4 | floating | docked: as Settings |
| Edit a bookmark, Change Icon, the Size of a bar, a name asked (askText), the Projects window's own question, Foldex's question window (AskForm) | modal dialogs | neither: question 1 | | each asks one thing and waits for the answer |

## 4. Open questions

1. The dialogs that ask one thing and wait for the answer (Edit a bookmark, Change Icon, the Size of a bar, a name
   asked, the Projects window's question, Foldex's question window): exceptions, staying modal dialogs that are
   neither docked nor floating?
2. F1 (all actions and keys) closes when an action runs: an exception (a modal dialog), or a pane that stays open?
3. More columns, Find and Rename act on the pane or items they were opened from: panes (both) as well, or modal
   dialogs as now?
4. Settings and Projects are windows of their own now (floating only). Docked, their page becomes a pane of the main
   page: wanted for both, or do they stay floating windows only?
