# Plan 30: The ribbon's tabs: Home for the everyday work, then View, Customize and Tools

Status: executed; see Status and 6.

- 2026-11-17: draft, at the user's request.
- 2026-11-17: executed.

Builds on plan 19 (the ribbon as LexPen's, executed). Where Foldex differs from LexPen: LexPen's tabs follow an
editor's work (File, Home, Arrange, Review, View, Tools); an explorer changes little and mostly views, finds,
filters and previews, so Foldex's Home holds that and the other tabs what is done now and then.

## 1. What this is about

The shipped ribbon has two tabs. View holds seven groups (Panes, Show, Projects, Presets, Columns, Bars, Foldex), so it
is wider than most windows: part of it goes into `>>`, and what an action is near is hard to see. Home misses actions
of the everyday work (the views, the preview, filtering), and View mixes those with settings and the editing of sets.

## 2. The solution, in brief

Four tabs. Home holds every action of the everyday explorer work: the clipboard, organizing, opening, finding and
filtering, going, and how the panes show their items (views, preview, info, hidden items). View holds the panes,
their arrangement and the projects. Customize holds the editing of what Foldex keeps: column sets, bookmarks, the
bars, the ribbon, the default layout. Tools holds Settings, All actions, the Log and About. Only the shipped ribbon.json changes; a
ribbon.json of your own stays as it is until Reset.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Tabs | the shipped ribbon.json with the four tabs and their groups | 3.1; 6 |
| Tests | the shipped ribbon's actions and icons (the existing tests); each tab drawn in the test copy | 3.3; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 The tabs

| Tab | Group | Buttons | From |
|---|---|---|---|
| Home | Clipboard | Paste (large), Copy, Cut, Copy path | Home |
| | Organize | Delete (large), New folder (large), Delete from disk, Rename | Home (Delete from disk from Find; Rename new) |
| | Open | Open (large), Properties, Select all | Home |
| | Find | Find (large), Filter..., Search bar, New scrap, Add to scrap | Home (Filter and Search bar new) |
| | Go | Back, Forward, Up, Refresh, Drives, Bookmarks | Home (Bookmarks from Open) |
| | Show | Views (large), Preview (large), Info (large), Hidden items | View |
| View | Panes | New child pane (large), New tab, New pane, Close pane, Show/hide pane, Hidden panes, Rename pane, Next pane, Detach, Pin | View |
| | Pane preview | Pane preview, Pane info | View's Show |
| | Layout | the four presets | View's Presets |
| | Projects | Projects (large: the list), Manage, New, Rename | View |
| | Columns | Fit columns, Fit all columns | View (Fit columns new) |
| Customize | Column sets | Manage sets | View's Columns |
| | Bookmarks | Add the current folder, Manage the bookmarks | new on the ribbon |
| | Bars | Change bars, Reset bars, Add path bar, Add drives bar, Add search bar | View |
| | Ribbon | Change the ribbon, Customize the ribbon..., Reset the ribbon | new on the ribbon |
| | Layout | Save layout as default, Reset layout | View's Projects |
| Tools | Foldex | Settings (large), All actions, Log, About | View's Foldex |

- The buttons keep their size and labels where they are now; a group's large buttons first, small ones stacked by
  three.
- Home is the tab the ribbon shows at the start, and has what a day's work with folders needs, so most people seldom
  open another tab. Whether it fits a normal window is checked in the test copy (3.3); what does not fit goes into
  `>>` from the right, Show last.

### 3.2 Your own ribbon

A ribbon.json of your own (written by the change mode or Customize) replaces the shipped one whole, so it does not
get the new tabs. Reset to the shipped ribbon (right-click the ribbon) takes the new one. No merging: the change mode
and Customize can move a group to another tab.

### 3.3 Tests

- The existing unit tests cover the shipped ribbon: every button names an action Foldex has, and has its icon (the
  new buttons on it, Filter..., Search bar, Rename, Fit columns, Add the current folder, Manage the bookmarks and the
  ribbon's own, have one).
- In the test copy: each tab drawn and pictured; Home's width against the window's [not yet checked].

## 4. Open questions

None.

## 6. As built

The shipped `src/defaults/ribbon.json` as 3.1 has it: Home, View, Customize, Tools. Pictures of each tab beside this
plan (`30-PLAN-ribbon-tabs.md.images/`): [Home](30-PLAN-ribbon-tabs.md.images/ribbon-home.png),
[View](30-PLAN-ribbon-tabs.md.images/ribbon-view.png), [Customize](30-PLAN-ribbon-tabs.md.images/ribbon-customize.png),
[Tools](30-PLAN-ribbon-tabs.md.images/ribbon-tools.png).

- In Customize, Column sets' Manage sets and the bookmarks' Manage are large buttons (a group of one or two needs
  them to be found); Add the current folder is small beside it.
- Measured in the test copy (the groups' widths added, CSS px): Home 1278, View 1010, Customize 918, Tools 165. On a
  ribbon 1000 px wide Home puts Go and Show into `>>` (whole groups from the right, as plan 19 has it).
- Tested: `dotnet test` 238 passed (the shipped ribbon's actions known, every button with its icon); in the test copy
  each tab drawn, no letter boxes, the four tab names, `>>` at 1000 px.
- Not checked: a ribbon.json of your own kept as it was (3.2: the code reads yours whole, as before).
