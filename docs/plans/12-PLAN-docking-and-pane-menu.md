# Plan 12: Docking panes, tabs, and the pane header's menu

Status: draft 2026-11-10; not started. Takes the docking row of plan 01 3.3 into a plan of its own, for Foldex's
panes; changes plan 03 (a pane can now be detached and attached).

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
- Floating panes (a window of their own): open question 1.

### 3.2 The pane header's menu

A right-click on a pane's header (or its tab):

- **New child pane**: at the right, under it, or as a tab in its group; it follows this pane (plan 03), in a new
  branch when this pane already has children, with the settings of its current child.
- **New tab**: a copy of this pane as a tab in its own group: the same kind and settings, the same location, the same
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
- New child pane at the right, below or as a tab; New tab.

### 3.4 Kept

- The layout of each window (areas, groups, splits, sizes, tabs, which tab is shown) with the panes and their
  connections: in the project (plan 01 3.5). Until projects are built, the layout of the last closed window in
  `State\state.json`, so a restart brings it back.

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

1. **Floating panes.** LexPen's panes can also float as a window of their own (for another monitor). Wanted for
   Foldex's panes too, later, or not?

## 5. As built

Not built yet.
