# Plan 25: A name for a pane or a tab

Status: not started.

- 2026-11-13: draft, at the user's request.

LexPen has no names for its tabs (a tab there is a file); the model in Foldex itself is a scrap's name (Rename
scrap..., plan 06 3.1), which this plan makes one thing for every pane.

## 1. What this is about

A pane or a tab is often kept for one task. While that task wanders through folders, its head and its tab show only
the folder of the moment, so which pane was for what is hard to remember.

## 2. The solution, in brief

Rename pane... on the pane menu (the head's and the tab's right-click) gives a pane a name; an empty name takes it
away. The name is kept with the layout, so it stays over a restart and goes with the project. A child's head shows the
name, a hyphen and the folder it shows; a root pane's head shows the name only. A tab shows two lines: the name above,
the folder below. Once any tab of a group has a name, every tab of that group is two lines high, and a tab without a
name shows its folder on the lower line, its upper line empty; without names the tabs stay one line high, as now.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The name | kept on the pane in the layout, one thing with a scrap's name | -- | 3.1 |
| Rename pane... | the pane menu's item and its dialog | -- | 3.2 |
| Heads | name - folder in a child, the name only in a root pane | -- | 3.3 |
| Tabs | two lines when a tab of the group has a name, the unnamed ones on the lower line | -- | 3.4 |
| Elsewhere | the name where a pane is named in a menu | -- | 3.5 |
| Tests | unit and in the app | -- | 3.6 |

## 3. Details

### 3.1 The name

- Kept as `name` on the pane in the layout (panes.js), as a scrap's name already is (ScrapView.tabTitle reads
  `layout.pane(id).name`). So a scrap's name becomes this name; Rename scrap... becomes Rename pane... on a scrap too.
- Kept with the layout (the window's layout, the project, Save layout as default). A pane hidden with Ctrl+O keeps it.
- Spaces around it are dropped; an empty name is no name. No length limit; a long name is cut with an ellipsis where
  it does not fit, its whole text as the tooltip.

### 3.2 Rename pane...

- On the pane menu, which a right-click on the head and on a tab both open (app.js paneMenu), near New tab.
- The same small dialog as Rename scrap... (projectmenu.js askText): the name now in it, selected; OK sets it, Cancel
  keeps it; empty takes it away.
- An action of its own (`pane.rename`, group Panes) for the active pane, so it can have a key and a ribbon button
  (open question 1).

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
- A scrap's tab: its name above; below it "Scrap" (it has no folder) (open question 2).
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

1. A key for Rename pane... and a ribbon button? Proposed: a button in View > Panes, no key (F2 renames the focused
   item); a double-click on a tab could rename it too.
2. A scrap's tab: its name above and "Scrap" below, or one line with its name, as now?
