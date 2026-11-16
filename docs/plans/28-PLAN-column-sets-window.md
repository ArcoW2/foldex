# Plan 28: Manage column sets: a clear window, sorting on several columns, Fit per column

Status: not started; see Status.

- 2026-11-15: draft.

Builds on plan 11 (columns and column sets, executed) and plan 14 (Manage column sets as a pane page, stage 4). The
number in the file name is the priority; rename to reorder.

## 1. What this is about

Manage column sets (a pane page since plan 14 stage 4) is hard to use. Its buttons are the browser's own, not the
theme's. The sets are a row of buttons, not a list, and cannot be put in another order. What belongs to the set
chosen is not marked as such: no label, no line between the sets and their settings. Each column has Up, Down and
Remove buttons on its own line, which takes room and is not how other Foldex lists (Manage the bookmarks) move
entries. A set sorts on one column only. "Fit by themselves" is one switch for the whole set, and its meaning is not
clear: it fits every column after every listing. There is no way to say per column whether and how it fits, nor how
narrow or wide it may become. A set has no columns kept ready but not shown. Floating, the window opens too narrow
for what it shows.

## 2. The solution, in brief

### 2.1 The column sets window

The window gets two parts side by side, split by a line that can be dragged. At the left, the sets as a list in the
look of Manage the bookmarks: a row per set, a grip per row to drag it to another place, a narrow strip with an arrow
up and an arrow down at the left of the list, and the buttons (New, Rename, Duplicate, Delete, Reset) under it. The
order of the sets is kept and used in every list of sets. At the right, under a label naming the set chosen,
everything of that set: its columns as a list in the same look (strip with arrows, a grip per row, Remove and Add a
column under it), each column on two lines. The first line has its title, whether it is shown, its width and its sort
cell; a set sorts on several columns in order. The second line has its Fit mode (never, manual, auto-enlarge,
auto-shrink, auto-both) with a minimum and an optional maximum width in em, which also hold when the column is
resized by hand. All buttons are the theme's. Floating, the window opens wide enough to show both parts without
scrolling sideways; where they do not fit side by side, the sets' part comes first and the set chosen under it.

### 2.2 Sorting and columns from a pane's header

In a list's header a sorted column shows its arrow, and its number when more than one column sorts. A click on a
title sorts by it or turns it the other way, without undoing a sort of several columns; Ctrl+click adds it to the
sort; the Sort window shows the whole order to drag, turn and remove. The header's right-click menu, as xplorer2's,
holds Select columns..., where a column of the set that is not shown can be shown in the pane with the set's settings
for it, the fits and the sets. Ctrl+R fits the columns whose Fit says so, Ctrl+Shift+R every column.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Theme buttons | every button of the page in the theme's look | -- | 3.1 |
| Two parts | sets left, the set chosen right, a draggable line between, a label naming the set; wide enough when floating; stacked (sets first) when narrow | -- | 3.1 |
| The sets' list | rows, grip, arrow strip, buttons under it; the order kept and used in every list of sets | -- | 3.2 |
| The columns' list | two lines per column (shown or not), grip, arrow strip, Remove and Add under it | -- | 3.3 |
| Sort on several columns | the sort cells in the editor; the lists sort that way | -- | 3.4 |
| The header's sort | numbers beside the arrows; click, Ctrl+click; the Sort window | Open questions 1, 2 | 3.4; 3.5 |
| Fit per column | never, manual, auto-enlarge, auto-shrink, auto-both; minimum and maximum, also when resizing by hand; Ctrl+R and Ctrl+Shift+R | -- | 3.6 |
| Columns not shown | a set's columns kept but not shown; shown in a pane from the header's menu | Open questions 4 | 3.7 |
| The header's menu | Select columns..., the fits, the sets, Columns... for a pane's own columns | Open questions 1, 3 | 3.8 |
| Host | columnsets.json: the sets' order, a sort of several columns, per column shown, Fit and its limits; older files read | -- | 3.9 |

## 3. Details

### 3.1 The window

- Its page is `columnsets.html` / `colsmanage.js` (plan 14 6.6); docked or floating as now.
- Buttons in the theme's look, as Manage the bookmarks' (the `ask-buttons` look and the `bm-arrows` strip of
  app.css); now they are the browser's because the page's buttons sit outside the classes that style them.
- Two parts side by side: the sets' list at the left, the set chosen at the right. Between them a line that can be
  dragged to give one part more room; where it is, is kept with the pane (as the bookmarks' column widths are). Above
  the right part a label: "Set: <name>" (with "(changed)" or "(yours)" as the list shows it).
- Floating, it opens wide enough for both parts and the columns' two lines without scrolling sideways (the first time;
  after that as its window was).
- Where the two parts do not fit side by side (a narrow docked pane, a floating window made narrow), they are stacked:
  first the whole sets' part (the list and its buttons), under it the whole part of the set chosen (its label, its
  columns and their buttons). The line between them is then not shown; it comes back once both fit side by side.
- LexPen has no window like this one; the list look (rows, grip, arrow strip) is Foldex's own, from Manage the
  bookmarks (plan 26 3.3, plan 27 3.4).

### 3.2 The sets' list

- A row per set: its name, "(changed)" for a shipped set you changed, "(yours)" for one of yours. The chosen row is
  selected, as in the bookmarks' list; Up and Down move the selection; a click selects.
- A grip per row: dragged, the set goes between two other rows. The strip at the left of the list holds an arrow up
  and an arrow down: they move the selected set one place.
- Under the list: New... (an empty set with the Name column, its name asked), Rename..., Duplicate..., Delete...,
  Reset (a changed shipped set back as shipped). Duplicate asks the name of the copy, as now.
- The order is kept (3.9) and is the order of every list of sets: the header's menu, More columns' and Manage's
  lists. It decides nothing else (not which set is offered first when a pane's columns are saved as a set).

### 3.3 The columns' list

- A row per column, two lines:
  - first line: the grip, the title (its id as a tip), Shown (a check: off keeps the column in the set without
    showing it, 3.7), its width, its sort cell (3.4);
  - second line: Fit (3.6), its minimum and its maximum width (the maximum may be empty).
- Widths, minimum and maximum are in em of the pane font, so they follow the font size. That is said where they are
  entered: each box has `em` after it, and its tip says "em: the width of the pane font's letter M; the column grows
  and shrinks with the font size".
- The strip at the left holds an arrow up and an arrow down: they move the selected column one place. The grip drags
  a column to another place. The Name column stays first: it cannot be moved, hidden or removed (as now).
- Under the list: Remove (the selected column) and Add a column... (Foldex's own columns and Windows' properties, as
  now).

### 3.4 Sorting on several columns

- A sort is a list of columns, each ascending or descending. A list sorts by the first, then by the second where the
  first is equal, and so on; by name last. Folders stay first, empty values last, as now (plan 11 3.4).
- In the editor, the sort cell of a column, clicked: none, then ascending, then descending, then none again. A sorted
  column shows its place in the sort (1, 2, 3, ...) beside its direction. A column turned on becomes the last of the
  sort; one turned off leaves, and the ones after it move up.
- In a list's header, a sorted column shows its arrow; beside it its place in the sort (1, 2, ...), only when more
  than one column sorts.
- A click on a title:
  - the sort is of one column (or none): sort by this column alone; when it is that column already, the other way
    (as now);
  - the sort is of several columns and this one is in it: only this column turns the other way; the order stays;
  - the sort is of several columns and this one is not in it: the Sort window opens (3.5) with this column added at
    the bottom, so a click does not undo a sort of several columns.
- Ctrl+click on a title: the column is added at the end of the sort, ascending, when it is not in it yet. On a column
  already in the sort: Open questions 2.
- The sort is kept as a list in the set and in a pane's own columns (3.9); a sort of one column as written before is
  read as a list of one.

### 3.5 The Sort window

- The whole order of a pane's sort, a line per column in its order: a grip to drag the line to another place, one
  icon button that shows the direction (ascending or descending) and turns it on a click, and a Remove button. The
  column the window was opened from is added at the bottom when it is not in the sort yet.
- When the last line is removed, a line "Name, ascending" takes its place: a list always sorts on something.
- What is changed applies to the pane at once (as More columns does).
- Opened from a click on a title (3.4) or from the header's right-click (Open questions 1). What it can be: a modal
  floating window, as More columns (plan 14 3.7); it opens under the title it came from.

### 3.6 Fit per column

- Each column has a Fit mode:
  - never: its width changes only when you resize it;
  - manual: fitted to its values when you ask (Ctrl+R);
  - auto-enlarge: made wider as soon as a value shown is wider than the column;
  - auto-shrink: made narrower when every value is narrower than the column;
  - auto-both: both.
- Each column has a minimum width and an optional maximum width. Fitting never goes outside them, and neither does
  resizing it by hand in the header.
- Ctrl+R (Fit columns) fits every column whose Fit is manual or auto-*; when every column is never, it fits the Name
  column. Ctrl+Shift+R (Fit all columns) fits every column, whatever its Fit, each within its minimum and maximum.
- What "fitted" measures is as now (plan 11 3.4): the title and the values of the items listed; values of Windows'
  properties count once they are read (they are read for the rows in view), so an auto column can widen as they come.
- Defaults: a new column, and a column of a set or pane written before, is never, the Name column manual. The set's
  "Fit by themselves" (every column fitted after every listing) goes; a set or pane that had it on gets auto-both for
  all its columns.

### 3.7 Columns not shown

- A column of a set can be kept in it but not shown (Shown off, 3.3): it has its width, Fit, limits and place in the
  set, but a pane using the set does not show it.
- The header's right-click menu has Select columns...: a list of the set's columns, the shown ones checked; checking
  one that is not shown shows it in that pane, at its place in the set and with the set's settings for it (width, Fit,
  limits); unchecking hides it again. More columns... (every property Windows has) stays for columns the set does not
  have.
- What can be: a modal floating window, as More columns (plan 14 3.7).
- Whether showing such a column changes the set or only that pane: Open questions 4.

### 3.8 The header's right-click menu

- As xplorer2's (its menu has Select columns, Autosize columns, Fit columns, Details from filter, Programmable...,
  Column sets with Add current, Organize and the sets): Select columns... (3.7), More columns..., Fit columns
  (Ctrl+R), Fit all columns (Ctrl+Shift+R), Column sets (Save as new set..., Update set, Manage sets..., and the sets
  in their order, the one used checked), Columns... (this editor's right part for a pane's own columns, when the pane
  uses no set), and the folder's set as now (Use for this folder, Back to generic).
- Where Foldex differs from xplorer2: Details from filter and Programmable... are not in the menu (Open questions 3).
- Where the Sort window is opened from the right-click: Open questions 1.

### 3.9 The host

- `ColumnSetsFile.cs` keeps, besides what it keeps now: the order of the sets (shipped and yours together), a sort of
  several columns ([{ id, desc }, ...]), and per column whether it is shown, its fit mode, minimum and maximum. A file
  written before is read as it was meant: one sort column as a list of one, every column shown, `fit: true` as 3.6
  says, the sets in their old order.
- A pane's own columns (kept with the layout) get the same per column fields and the sort list.

### 3.10 Tests

- Unit: ColumnSetsFile reads an old file (one sort, fit true) into the new form; writes and reads the order, the sort
  list and the per column fields (shown among them). The comparer sorts by two columns (equal first values ordered by
  the second), folders first, empty last. Fitting keeps a column inside its minimum and maximum; auto-enlarge only
  widens, auto-shrink only narrows; Ctrl+R with every column never fits Name only.
- In the test copy: the page's buttons in the theme; the sets' list moved by grip and by the arrows, the order seen in
  the header's menu after; a set chosen and its label; a column moved, removed, added and hidden; two sort columns set
  (1 and 2) and a list in a folder sorted that way, the header showing 1 and 2; a click on a sorted title turning only
  that column; a click on another title opening the Sort window with it at the bottom; Ctrl+click adding a column;
  the Sort window's grip, direction button and Remove, the last line removed giving "Name, ascending"; a hidden column
  shown from Select columns... with the set's width; a column with auto-enlarge widening when a wider name is listed;
  a minimum holding when the column is dragged narrower; floating at its first width with nothing scrolling sideways;
  made narrow (docked and floating): the sets' part whole above the set chosen, no splitter;
  the splitter dragged and kept after a restart.

## 4. Open questions

1. The right-click on a title: your answer to the sort asks for the Sort window there, your list of clicks for the
   columns' menu (Select columns, sets, show and hide). Both? Recommended: the right-click opens the menu (3.8), its
   first item Sort... opening the Sort window with that column added at the bottom; a plain click on a title not in a
   sort of several columns opens the Sort window too (3.4).
2. Ctrl+click on a title already in the sort: turn it the other way (as a plain click does then), or take it out of
   the sort? Recommended: take it out, so Ctrl+click adds and removes and a plain click turns.
3. xplorer2's Details from filter and Programmable... in the header's menu: Foldex has neither feature (programmable
   columns are not built, xplorer2-features "Programmable columns"). Leave them out until those features exist?
   Recommended: yes.
4. A column of a set shown from the header (3.7): only in that pane, the set unchanged until Update set (as other
   changes to a pane's columns now), or in the set, so every pane using it shows it? Recommended: only in that pane.
