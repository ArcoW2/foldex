# Plan 12: Docking panes, tabs, and the pane header's menu

Status: executed; see 6. As built.

- 2026-11-10: draft.
- 2026-11-10: revised: a new child at the right of or below its parent; a tab is New tab.
- 2026-11-10: executed, except floating panes (open question 1) and the layout in the project.
- 2026-11-11: floating panes moved to plan 14, the layout in the project to plan 15; executed.
- 2026-11-11: the head menu: Move to removed (dragging docks a pane); Detach, Attach to and Branch colour in a
  submenu Branch.

Takes the docking row of plan 01 3.3 into a plan of its own, for Foldex's panes; changes plan 03 (a pane can now be
detached and attached).

## 1. What this is about

Foldex's panes stand in one row, each new one at the right of the active pane; they cannot be put under each other,
grouped as tabs, or moved. A pane's connection is fixed when it is made: a child cannot be detached from its parent
or attached to another pane (plan 03 3.1), and new children are made only from the ribbon. xplorer2 has tabs per
pane and panes that dock; Foldex has neither.

## 2. The solution, in brief

Panes dock as LexPen's panes do: at the left, right, top or bottom of the window or in its center, alone, as tabs in
a group, or next to or under another pane, resized with splitters; you move a pane by dragging its header onto the
dock marks. The pane header's right-click menu makes a new child, detaches a child from its parent, attaches a pane
to another one, and makes a new tab: a copy of the pane as a tab in the same group, as a new branch of the same
parent, so each tab keeps its own folder and switching tabs switches branches. Tabs for files come with that, with
no tab mechanism of their own.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Detach | a child becomes a root on the folder it shows and keeps its children | 3.2 |
| Attach | dragging the connector in the header onto another pane, or the menu's Attach to; a cycle refused | 3.2 |
| Branch colour | as an action and in the menu | 3.2 |
| List without a parent | opens a double-clicked folder in itself | 3.3 |
| Docking | the five areas, groups as tabs, splits with splitters, the side areas' sizes | 3.1 |
| Moving panes | dragging a head or tab onto a window edge, beside a group, into a group as a tab, or into an empty center | 3.1 |
| Tabs | in their branch colour; a click shows the tab and switches to its branch | 3.1, 3.2 |
| Pane head menu | also on tabs: New child pane (right, below), New tab, Branch (Detach, Attach to, Branch colour), Pin, Close pane | 3.2 |
| New tab | Ctrl+T: same parent, a branch of its own, same folder; a root's tab is a new root | 3.2 |
| Last layout | of the last closed window, in `State\state.json`, brought back at the next start | 3.4 |

### Not yet built

Moved out: floating panes to plan 14, the layout in the project to plan 15.

## 3. Details

### 3.1 Docks, groups, tabs

- **Dock areas**: left, right, top, bottom and center. The center takes what the sides leave; a side takes the size
  you drag its splitter to.
- **Group**: one or more panes in one place, shown as tabs when more than one (a tab per pane, in the pane's branch
  colour, its folder name as title). A group with one pane shows only its header.
- **Next to each other**: in an area, groups split side by side or above each other, with a splitter between them,
  as deep as wanted (a tree of splits, as LexPen's `docks.js`).
- **Moving**: drag a pane's header (or its tab); marks show the places: a side of the window, the center, a side of
  another group (next to it, above, under), or the group's middle (as a tab in it). An empty group or area goes away.
- Where a pane docks has nothing to do with its connections (plan 03 3.4).
- The default layout (plan 03 3.5): the root tree in the left area, its child in the center.
- Bars (plan 10) dock at the same sides, as lines outside the panes' areas.
- Floating panes (a window of their own): plan 14.

### 3.2 The pane header's menu

A right-click on a pane's header (or its tab):

- **New child pane**: directly at the right of this pane, or below it; it follows this pane (plan 03), in a new
  branch when this pane already has children, with the settings of its current child. Not as a tab: a tab is New tab.
- **New tab** (Ctrl+T, View > Panes): a copy of this pane as a tab in its own group: the same kind and settings, the same location, the same
  parent, in a new branch. Because it is another branch, each tab keeps its own folder; activating a tab makes the
  parent show its state for that branch (plan 03 3.1), as switching branches does. A tab of a pane without a parent
  (a root) is a new root on the same folder.
- **Detach from parent** (a child only): the pane stops following and becomes a root, on the folder it shows; its own
  children stay its children. A root list opens a folder in itself on a double-click (3.3).
- **Attach to**: a submenu of the other panes (by title and colour, the ones that would make a cycle left out); the
  pane becomes that pane's child, in a new branch when that one already has children, else in its branch. Also by
  dragging the connector in the header onto another pane (plan 03 3.4).
- **Branch colour**: another free colour for this pane's branch, or the colour of a sibling's branch (then both show
  the same folder, plan 03 3.2).
- **Close pane** (plan 03 3.4), and the docking: move to the left, right, top, bottom, center.

### 3.3 What changes in plan 03

- A pane can be detached and attached (3.2 above); plan 03 3.1 "a pane cannot be disconnected (for now)" goes.
- Executing a folder in a pane without a parent: a tree expands it in place (as now); a list opens it in itself (a
  detached list navigates on its own, as a pane in Explorer).
- New child pane at the right of or below its parent; New tab.

### 3.4 Kept

- The layout of each window (areas, groups, splits, sizes, tabs, which tab is shown) with the panes and their
  connections: the layout of the last closed window in `State\state.json`, so a restart brings it back. In the
  project: plan 15.

### 3.5 Tests

- Unit (page code under Jint): the dock tree: adding a pane as a tab, beside and under a group, removing the last
  pane of a group (the group and an empty area go), moving a pane between groups; detaching (becomes a root, keeps
  its children), attaching (cycle refused, branch colour as 3.2), New tab (same parent, new branch, a copy of the
  parent's state, so both tabs start on the same folder and then go their own way).
- In the test copy: the default layout; a list made a tab twice, each tab sent to another folder through the tree,
  switching tabs brings the tree back to each tab's folder; a pane dragged to the bottom and as a tab into another
  group; Detach on the list, then a double-click on a folder opens it in the list itself; Attach back to the tree;
  the layout back after a restart.

## 4. Open questions

None.

## 6. As built

### 6.1 Built (2026-11-10, branch `plan01-foundation`)

- With plan 03's code: detach, attach by the connector, branch colour, a list without a parent opening folders in
  itself (see plan 03 6.2).
- `web/docks.js`: the dock model without DOM: areas, groups (panes as tabs, one shown), splits with shares; add (to an
  area, beside a group, as a tab), remove (a group left empty goes, a split of one is replaced by it), show, JSON.
- `app.js`: `renderDock` draws the areas (top; left, center, right; bottom), splits and groups, moving the panes'
  own elements (their scroll positions put back); splitters for the side areas and between nodes; `drawTabs`;
  `dragToDock` with a mark showing where a pane lands; `paneMenu` and `newTab`; the layout told to the host
  (`tellLayout`, 800 ms after a change) and `restoreLayout` at the start. The default layout: the tree in the left
  area, its child in the center; a new root goes to the left area.
- `web/menu.js`: a menu of the page's own (check marks, colour swatches, submenus; Up, Down, Right, Left, Enter,
  Esc; a submenu opens with the mouse on hover, with the keys only on Right or Enter).
- A preview in a tab not shown closes Windows' preview window, and opens it again when shown.
- Host: `AppState.Layout`; the window keeps the layout its page told last and saves it with its place when it
  closes; the first window of a run gets it back (`TakeSavedLayout`), a page made again after a failure its own.
- Decided during the build: a dock split's CSS classes are not `row` / `column` (a list row's class is `row`); a drop
  onto the pane's own group when it is alone there does nothing; Ctrl+T for New tab.
- Changed after use: New child pane as a tab dropped (that is New tab); a new child goes directly at the right of its
  parent, also in a side area (it went to the center first); tabs coloured whole, not only underlined; dropping beside
  a group: the nearest edge wins (left and right were tried first, so low near a group's right side gave right, not
  below; checked over CDP: a drop there now lands below).
- Found on the way and fixed: no browser text selection over the panes (a mouse let go during the Delete confirmation
  left one); a tree read a watched folder's subfolders again whenever a subfolder's date changed (SynologyDrive and
  the browser's own files on D: do that all the time), and collapsed and jumped while doing so; now the names are
  compared and the focused row stays in place.

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 89 (`DocksTests`: the default layout, a tab, beside and under a group, removing the
  last pane of a group and of an area, removing the shown tab, moving between groups and areas, a split of one
  replaced, JSON back).
- A test copy over CDP: placements (a child below, a second child at the right, a pane as a tab); two lists as tabs
  of one group, each a branch of the tree: clicking a tab brought the tree to that tab's folder (`one`, `two`); the
  preview at the right of the list; dragging heads: to the bottom edge, into the tree's group as a tab, beside a group
  at its right; a click on a head moved nothing; the head menu's items, New tab, Move to > Bottom, the keys in the
  menu; a layout with a tree at the right, two tabs (one pinned) back the same after closing and starting again, the
  lists showing their folders; `PrintWindow` pictures of the docks, the menu with the branch colour submenu, and the
  coloured tabs.
