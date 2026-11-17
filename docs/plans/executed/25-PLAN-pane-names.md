# Plan 25: A name for a pane or a tab

Status: executed; see 6 for what was built and how it was tested.

- 2026-11-13: draft, at the user's request.
- 2026-11-17: executed.

LexPen has no names for its tabs (a tab there is a file); the model in Foldex itself is a scrap's name (Rename
scrap..., plan 06 3.1), which this plan makes one thing for every pane.

## 1. What this is about

A pane or a tab is often kept for one task. While that task wanders through folders, its head and its tab show only
the folder of the moment, so which pane was for what is hard to remember.

## 2. The solution, in brief

Rename pane... on the pane menu (the head's and the tab's right-click) and a button in View > Panes give a pane a
name; an empty name takes it away. The name is kept with the layout, so it stays over a restart and goes with the project. A child's head shows the
name, a hyphen and the folder it shows; a root pane's head shows the name only. A tab shows two lines: the name above,
the folder below. Once any tab of a group has a name, every tab of that group is two lines high, and a tab without a
name shows its folder on the lower line, its upper line empty; without names the tabs stay one line high, as now. A
scrap has no folder: its name is shown in the folder's place, as now.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| The name | kept on the pane in the layout, one thing with a scrap's name | 3.1; 6 |
| Rename pane... | the pane menu's item, the action and its ribbon button, its dialog | 3.2; 6 |
| Heads | name - folder in a child, the name only in a root pane | 3.3; 6 |
| Tabs | two lines when a tab of the group has a name, the unnamed ones on the lower line | 3.4; 6 |
| Elsewhere | the name where a pane is named in a menu | 3.5; 6 |
| Tests | unit and in the app | 3.6; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 The name

- Kept as `name` on the pane in the layout (panes.js), as a scrap's name already is (ScrapView.tabTitle reads
  `layout.pane(id).name`). So Rename scrap... becomes Rename pane... on a scrap too; there the name stands in the
  folder's place (3.4).
- Kept with the layout (the window's layout, the project, Save layout as default). A pane hidden with Ctrl+O keeps it.
- Spaces around it are dropped; an empty name is no name. No length limit; a long name is cut with an ellipsis where
  it does not fit, its whole text as the tooltip.

### 3.2 Rename pane...

- On the pane menu, which a right-click on the head and on a tab both open (app.js paneMenu), near New tab.
- The same small dialog as Rename scrap... (projectmenu.js askText): the name now in it, selected; OK sets it, Cancel
  keeps it; empty takes it away.
- An action of its own (`pane.rename`, group Panes) for the active pane, without a key (one can be given in
  keys.json); a button in the ribbon's View > Panes group.

### 3.3 Heads

- A child (a pane with a parent): `name - folder`, the folder as the head shows it now (a list's location, a tree's
  root). The hyphen is a plain `-` with a space on each side.
- A root pane (no parent): the name only. Its folder stays in the path bar, as now.
- Without a name: as now.
- The preview: no name (it shows a file, not a task); Rename pane... is not on its menu.

### 3.4 Tabs

- A tab with a name: two lines, the name above, the folder below (as the tab shows it now: the folder's own name).
- A group with at least one named tab: all its tabs two lines high; a tab without a name has its folder on the lower
  line, the upper one empty, so all folders are on one line across the strip.
- A group without names: one line, as now. Each group decides for itself; another group's tabs are not changed.
- A scrap: its name is its folder's alternative, not a task name above it: it is shown where a folder would be (one
  line, or the lower line in a group of two lines), never with "Scrap". Its head shows the name, as now.
- The colours and the active and shown marks as now (app.css .dock-tab); the strip's height follows the tabs.

### 3.5 Elsewhere

Where a pane's title is used to name it (tabTitle: Attach to on the pane menu, Hidden panes, the names the Projects
menu shows), the name goes first when there is one: `name - folder`, as on a child's head.

### 3.6 Tests

- Unit (Jint): the name kept and taken away in the layout, over toJSON and fromJSON; the head text for a child and a
  root, with and without a name.
- In the test copy (CDP): Rename pane... sets the name; the head of a child and of a root; a group of tabs with one
  named tab: all two lines, an unnamed one with its folder below; the name taken away: one line again; the name still
  there after a restart.

## 4. Open questions

None.

## 6. As built

- The name: `name` on the pane, as the plan says. It is now one of the fields the window's page decides
  (pagedviews.js WindowFields), so a pane's own page gets it with the layout and never sends an old one back. Layout
  (panes.js) answers what is shown of it: `paneName` (a tree's or a list's only; a scrap's name is its title, a
  preview has none), `headName` (`name - ` in a child, the name in a root) and `paneTitle` (`name - folder`).
- Rename pane... (app.js renamePane) replaces Rename scrap... on the pane menu, after New tab, and not on a preview's
  menu. The action `scrap.rename` is replaced by `pane.rename` (group Panes, no key); the ribbon's View > Panes has a
  Rename pane button after New tab. On a scrap, an empty name gives it a new name as a new scrap gets (Scrap and a
  number), so it never goes without one; the name is kept apart from the other scraps' as before (scrapName).
- Heads (app.js drawHead, so the window's page and a floating pane's own page draw it alike): a span `.pane-name`
  before the title. In a child it takes at most half the head, the path's parts (plan 29) the rest; in a root the
  title is hidden and the name takes the head.
- Tabs (app.js drawTabs): the views' `folderTitle` is the folder the tab showed before; `tabTitle` is
  `paneTitle(folderTitle)`, so Attach to, Hidden panes, a hidden pane's kept title and the Projects menu's names have
  the name first. A strip with a named tab gets the class `two`: each tab a name line and a folder line.
- Tested: unit test PanesTests.APanesNameIsKeptAndShownOnItsHead (the name over toJSON/fromJSON, the head texts of
  a root, a child and an unnamed one, no name for a preview or a scrap, the name taken away); dotnet test 232/232. In
  the test copy (CDP, the dialog's answer given in place of askText): the menu has Rename pane...; a child list named
  (spaces dropped) shows `Invoices - ` before its path, its own page has the name; the root tree named shows only
  `Work`; a new tab beside the named list: the strip two lines (42 px high, against 24 px with one line), the unnamed
  tab with an empty name line; the name taken away: one line again; Cancel keeps the name; after a restart both names
  and the two-line strip are back; a scrap renamed and emptied (Scrap 1 again); the ribbon's View tab has Rename pane,
  enabled.
- Not checked: a floating pane's own head with a name; a long name's ellipsis by eye.
