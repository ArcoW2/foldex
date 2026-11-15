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
narrow or wide it may become. Floating, the window opens too narrow for what it shows.

## 2. The solution, in brief

The window gets two parts side by side, split by a line that can be dragged. At the left, the sets as a list in the
look of Manage the bookmarks: a row per set, a grip per row to drag it to another place, a narrow strip with an arrow
up and an arrow down at the left of the list, and the buttons (New, Rename, Duplicate, Delete, Reset) under it. The
order of the sets is kept and used wherever sets are offered. At the right, under a label naming the set chosen,
everything of that set: its columns as a list in the same look (strip with arrows, a grip per row, Remove and Add a
column under it), each column on two lines. The first line has its title, its width and its sort cell; a click on the
sort cell goes none, ascending, descending, and a sorted column shows its number, so several columns sort in order.
The second line has its Fit mode (never, manual, auto-enlarge, auto-shrink, auto-both) with a minimum and an optional
maximum width, which also hold when the column is resized by hand. The set's "Fit by themselves" goes; per column Fit
takes its place. All buttons are the theme's. Floating, the window opens wide enough to show both parts without
scrolling sideways.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Theme buttons | every button of the page in the theme's look | -- | 3.1 |
| Two parts | sets left, the set chosen right, a draggable line between, a label naming the set; wide enough when floating | -- | 3.1 |
| The sets' list | rows, grip, arrow strip, buttons under it; the order kept and used | Open questions 6 | 3.2 |
| The columns' list | two lines per column, grip, arrow strip, Remove and Add under it | -- | 3.3 |
| Sort on several columns | the sort cell per column (none, ascending, descending, its number); the lists sort that way | Open questions 1 | 3.4 |
| Fit per column | never, manual, auto-enlarge, auto-shrink, auto-both; minimum and maximum, also when resizing by hand | Open questions 2, 3, 4 | 3.5 |
| Host | columnsets.json: the sets' order, a sort of several columns, Fit and its limits per column; older files read | -- | 3.6 |

## 3. Details

### 3.1 The window

- Its page is `columnsets.html` / `colsmanage.js` (plan 14 6.6); docked or floating as now.
- Buttons in the theme's look, as Manage the bookmarks' (the `ask-buttons` look and the `bm-arrows` strip of
  app.css); now they are the browser's because the page's buttons sit outside the classes that style them.
- Two parts side by side: the sets' list at the left, the set chosen at the right. Between them a line that can be
  dragged to give one part more room; where it is, is kept with the pane (as the bookmarks' column widths are). Above
  the right part a label: "Set: <name>" (with "(changed)" or "(yours)" as the list shows it).
- Floating, it opens wide enough for both parts and the columns' two lines without scrolling sideways (the first time;
  after that as its window was). A narrow docked pane keeps the stacked layout (sets above the set chosen) it has now.
- LexPen has no window like this one; the list look (rows, grip, arrow strip) is Foldex's own, from Manage the
  bookmarks (plan 26 3.3, plan 27 3.4).

### 3.2 The sets' list

- A row per set: its name, "(changed)" for a shipped set you changed, "(yours)" for one of yours. The chosen row is
  selected, as in the bookmarks' list; Up and Down move the selection; a click selects.
- A grip per row: dragged, the set goes between two other rows. The strip at the left of the list holds an arrow up
  and an arrow down: they move the selected set one place.
- Under the list: New... (an empty set with the Name column, its name asked), Rename..., Duplicate..., Delete...,
  Reset (a changed shipped set back as shipped). Duplicate asks the name of the copy, as now.
- The order is kept (3.6) and used wherever sets are offered: the header's menu (Use set), More columns' and Manage's
  lists.

### 3.3 The columns' list

- A row per column, two lines:
  - first line: the grip, the title (its id as a tip), its width (em of the pane font), its sort cell (3.4);
  - second line: Fit (3.5), its minimum and its maximum width (em; the maximum may be empty).
- The strip at the left holds an arrow up and an arrow down: they move the selected column one place. The grip drags
  a column to another place. The Name column stays first: it cannot be moved or removed (as now).
- Under the list: Remove (the selected column) and Add a column... (Foldex's own columns and Windows' properties, as
  now).

### 3.4 Sorting on several columns

- The sort cell of a column, clicked: none, then ascending, then descending, then none again. A sorted column shows
  its place in the sort (1, 2, 3, ...) beside its direction. A column turned on becomes the last of the sort; one
  turned off leaves, and the ones after it move up.
- A list sorts by the first sorted column, then by the second where the first is equal, and so on; by name last.
  Folders stay first, empty values last, as now (plan 11 3.4).
- The header of a list: a click on a title sorts by that column alone, again the other way (as now). Adding a column
  to the sort from the header: Open questions 1.
- The sort is kept as a list in the set and in a pane's own columns (3.6); a sort of one column as written before is
  read as a list of one.

### 3.5 Fit per column

- Each column has a Fit mode:
  - never: its width changes only when you resize it;
  - manual: fitted to its values when you ask (Ctrl+R, Open questions 2);
  - auto-enlarge: made wider as soon as a value shown is wider than the column;
  - auto-shrink: made narrower when every value is narrower than the column;
  - auto-both: both.
- Each column has a minimum width and an optional maximum width. Fitting never goes outside them, and neither does
  resizing it by hand in the header.
- What "fitted" measures is as now (plan 11 3.4): the title and the values of the items listed; values of Windows'
  properties count once they are read (they are read for the rows in view), so an auto column can widen as they come.
- The set's "Fit by themselves" (every column fitted after every listing) goes; a set or pane that had it on gets
  auto-both for its columns (Open questions 3).

### 3.6 The host

- `ColumnSetsFile.cs` keeps, besides what it keeps now: the order of the sets (shipped and yours together), a sort of
  several columns ([{ id, desc }, ...]), and per column its fit mode, minimum and maximum. A file written before is
  read as it was meant: one sort column as a list of one, `fit: true` as 3.5 says, the sets in their old order.
- A pane's own columns (kept with the layout) get the same per column fields and the sort list.

### 3.7 Tests

- Unit: ColumnSetsFile reads an old file (one sort, fit true) into the new form; writes and reads the order, the sort
  list and the per column fields. The comparer sorts by two columns (equal first values ordered by the second), folders
  first, empty last. Fitting keeps a column inside its minimum and maximum; auto-enlarge only widens, auto-shrink only
  narrows.
- In the test copy: the page's buttons in the theme; the sets' list moved by grip and by the arrows, the order seen in
  the header's menu after; a set chosen and its label; a column moved, removed and added; two sort columns set (1 and
  2) and a list in a folder sorted that way; a column with auto-enlarge widening when a wider name is listed; a
  minimum holding when the column is dragged narrower; floating at its first width with nothing scrolling sideways;
  the splitter dragged and kept after a restart.

## 4. Open questions

1. Sorting from a list's header: a click sorts by that column alone (as now). Should Ctrl+click add the column to the
   sort as the next one (and Ctrl+click again turn it the other way, then off)? Recommended: yes, as Explorer-like
   tools do with a modifier; the number shows in the header too.
2. Ctrl+R fits the Name column now, Ctrl+Shift+R every column. With Fit per column, what should they do?
   Recommended: Ctrl+R fits every column whose Fit is manual or auto-*; Ctrl+Shift+R fits every column, whatever its
   Fit (within its minimum and maximum).
3. The defaults: a new column, and the columns of a set or pane written before. Recommended: Name manual, the other
   columns never; a set or pane that had "Fit by themselves" on: auto-both for all its columns.
4. A pane's own columns (not a set) get the same Fit, minimum, maximum and sort per column. Where are they changed?
   Recommended: the header's menu gets "Columns..." that opens this editor for the pane's own columns (the right part
   only), besides More columns.
5. Are the minimum and maximum in em of the pane font (as the widths are now) or in pixels? Recommended: em, so they
   follow the font size as the widths do.
6. The order of the sets: should it also decide which set is offered first when you save a pane's columns as a set,
   or only the order of the lists? Recommended: only the order of the lists.

## 6. As built

(nothing built yet)
