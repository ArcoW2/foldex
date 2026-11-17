# Plan 30: The ribbon's tabs: View split

Status: not started; see Status.

- 2026-11-17: draft, at the user's request.

Builds on plan 19 (the ribbon as LexPen's, executed). LexPen is the model for the order of tabs: its ribbon has File,
Home, Arrange, Review, View and Tools (`..\LexPen\src\defaults\ribbon.json`), each tab a few groups.

## 1. What this is about

The shipped ribbon has two tabs. View holds seven groups (Panes, Show, Projects, Presets, Columns, Bars, Foldex), so it
is wider than most windows: on a normal window part of it goes into `>>`, and what an action is near is hard to see.

## 2. The solution, in brief

View is split. The Show group moves to a tab of its own, Edit, after Home. View keeps what arranges the panes (Panes,
Presets, Columns). Projects, Bars and Foldex (with the ribbon's own Change and Customize) go to a last tab. Only the
shipped ribbon.json changes; a ribbon.json of your own stays as it is until Reset.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Tabs | the shipped ribbon.json with the new tabs and groups | Open questions 1, 2 | 3.1 |
| Tests | the shipped ribbon's actions and icons (the existing tests); each tab fits a window [not yet checked] wide | Tabs | 3.3 |

## 3. Details

### 3.1 The tabs

| Tab | Groups | From |
|---|---|---|
| Home | Clipboard, Organize, Open, Find, Go | as now |
| Edit | Show: Views, Preview, Info, Pane preview, Pane info, Hidden items | View |
| View | Panes, Presets, Columns | as now, without Show, Projects, Bars, Foldex |
| (last tab; open question 2) | Projects, Bars, Foldex (Settings, All actions, Log, About), Ribbon (Change the ribbon, Customize..., Reset) | View; the Ribbon group new |

- The groups keep their buttons and order; only the tab they are on changes.
- The Ribbon group puts the ribbon's own actions where they can be found without its right-click menu.

### 3.2 Your own ribbon

A ribbon.json of your own (written by the change mode or Customize) replaces the shipped one whole, so it does not
get the new tabs. Reset to the shipped ribbon (right-click the ribbon) takes the new one. No merging: the change mode
and Customize can move a group to another tab.

### 3.3 Tests

- The existing unit tests cover the shipped ribbon: every button names an action Foldex has, and has its icon.
- In the test copy: each tab drawn, how wide it is against a window of [not yet checked] px, and whether `>>`
  appears there.

## 4. Open questions

1. **Edit.** The Show group (how the panes show their items: Views, Preview, Info, Hidden items) moves to a tab named
   Edit, as asked. In LexPen and in Windows, Edit is where items are changed (copy, rename, delete), which is Home's
   Organize here. Is Edit the name you want for this tab, and does anything else go on it (Rename, New folder, Delete
   from Home)?
2. **The last tab.** Its name: Tools (as LexPen), Foldex, or Window?
