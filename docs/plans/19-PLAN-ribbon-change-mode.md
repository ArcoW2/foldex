# Plan 19: The ribbon's change mode, F1 as a pane, drop-down actions

Status: draft 2026-11-12; not started; see Status.

- 2026-11-12: draft, at the user's request: the ribbon gets LexPen's change mode, copied completely, with F1 (all
  actions) and the way actions open lists (a single Drives button with a drop-down of all drives).

Builds on plan 01 (the ribbon, actions, F1) and plan 10 (the bars' change mode, made as LexPen's). The number in the
file name is the priority; rename to reorder.

## 1. What this is about

Foldex's ribbon comes from `ribbon.json` and cannot be changed in the window: a button can only be added, moved or
removed by editing the file by hand, and there is no way back to the shipped ribbon. LexPen's ribbon has a change mode
for exactly that, with F1's list of all actions to drag from, a Customize dialog, and actions whose button opens a list
(a drop-down) instead of running. Foldex's ribbon was copied from LexPen without these parts (`web/ribbon.js` says
so in its header), and its F1 is a modal dialog, which nothing can be dragged from.

## 2. The solution, in brief

The ribbon gets LexPen's change mode as LexPen has it: switched on from the ribbon's right-click menu, F1 or the
action; buttons, dividers, corners, groups and tabs dragged around and off; actions dragged in from F1; a right-click
menu per part (size, stacking, parameter, label, key tip, divider, opens as window or drop-down, corners); New tabs
and groups; Done or Esc ends it, Ctrl+Z takes back; every change written to your `ribbon.json` at once and shown in
every window; Customize... and Reset to the shipped ribbon. F1 becomes a pane in the window's docks, as LexPen's, so
its rows can be dragged onto the ribbon. Actions get LexPen's lists: variants as a list, and `dropDown`
(`dropDownOnly`) for a list made when it opens; the first one is a Drives button listing every drive.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Writing the ribbon | `RibbonFile.Save` / `Reset`, host ops `ribbonSave` / `ribbonReset`, every window told | -- | 3.1 |
| Delegated ribbon events | one set of listeners on the ribbon, parts found by data attributes, as LexPen's | -- | 3.2 |
| Corners | a group's left and right corner buttons drawn and run | -- | 3.2 |
| Change mode | on / off, Done, Esc, Ctrl+Z, buttons not running, the ribbon outlined | -- | 3.3 |
| Dragging | buttons, dividers, corners, groups, tabs moved; dragged off: removed; tab names show their tab while dragging | -- | 3.4 |
| Right-click menus | per part in the change mode; outside it Change the ribbon, Customize..., Reset | -- | 3.5 |
| New tab, new group | "New..." in the tab row and at the end of each tab | -- | 3.4 |
| Customize dialog | the two lists and their buttons, sharing undo and saving with the change mode | -- | 3.6 |
| F1 as a pane | non-modal, docked in the window; rows draggable in the change mode; its Change the ribbon button | -- | 3.7 |
| Lists on buttons | variants as a list, split arrow, list-only buttons, `dropDown` / `dropDownOnly`, "open": "dropDown" | -- | 3.8 |
| Drives button | `drives.list`: a drop-down of all drives | -- | 3.8 |
| ribbon.json header | the format as LexPen's header documents it (corners, open, tip) | -- | 3.9 |
| Tests | see 3.10 | -- | 3.10 |

## 3. Details

The names below are LexPen's (`src/web/ribbon.js`, `palette.js`, `commands-pane.js`, `menus.js`, `RibbonFile.cs`,
`MainForm.cs`). Foldex keeps its own prefixes (`rb-` for the ribbon's classes, `action` for `appAction`) and its own
helpers (`status` for `toast`, `askText` for `askName`, `openMenu` for `openContextMenu`); the behaviour is LexPen's.

### 3.1 Writing the ribbon (host)

- `RibbonFile.Save(dataDir, ribbon)`: writes your `ribbon.json` with a header comment and indented JSON, through a
  `.tmp` file as `BarsFile.Save` does. `RibbonFile.Reset(dataDir)`: removes it.
- Ops: `ribbonSave` (the model) and `ribbonReset`. Foldex's page posts without an answer, so after either the host
  sends every window the event `ribbon` with `RibbonFile.Load` (as `barsSave` sends `bars`); the window that changed it
  ignores it while in the change mode, as LexPen's `events.ribbon` does.
- `Load` reads with LexPen's retry on a file being written.

### 3.2 Drawing and events

- One set of listeners on the ribbon (mousedown, click, contextmenu and the drag events), the part found by
  `data-path`, `data-corner`, `data-grip`, `data-tab`, as LexPen's `rbElements`; the per-button listeners go.
- Corners: the left and right button beside a group's name (`ribbonCorner`, `ribbonCornerOf`, `ribbonItemOf` are in
  `ribbonmodel.js` already). An empty corner is drawn only in the change mode ("drop an action here").
- An unknown action: nothing outside the change mode; in it a "?" button that can be dragged off.
- All tab bodies are drawn and the others hidden, so a tab name hovered while dragging shows its tab.

### 3.3 The change mode

- On and off: the action `ribbon.change` ("Change the ribbon", checked while on), the ribbon's right-click menu, F1's
  button. Turning it on opens F1.
- In it: the ribbon outlined; tabs, buttons, dividers and corners draggable; a grip on each group; "New..." in the
  tab row and as the last group of each tab; a Done button; buttons and corners do not run; the ribbon scrolls instead
  of folding into `>>`; the chosen tab is not saved as the setting.
- Esc: ends it; Ctrl+Z: takes back the last change ("Nothing to take back." when there is none); neither while a
  menu or a dialog is open.
- Every change (`rbChange`): the model before it kept for Ctrl+Z, then written at once (`ribbonSave`) and drawn
  again. Reset in the change mode keeps the model before it, so Ctrl+Z takes the reset back too.
- The bars' change mode (plan 10) stays its own; the two can be on at the same time.

### 3.4 Dragging

- What: a button, a divider, a corner, a group (by its grip), a tab; from F1 an action (with its parameters).
- Where: before or after a button (by the half it is over), under it (the lower part: stacked under it), into a
  corner, onto a tab (the end of its last group; a group made when it has none), onto a group (its end), onto "New..."
  (asks the new group's name), a tab before or after a tab, a group before or after a group. The place is marked while
  dragging; hovering a tab name for a moment shows that tab.
- Off the ribbon: let go outside it and the part is removed (a tab, a group, a button, a divider, a corner).
- Taking a button from the top of a stacked column makes the next one start the column.
- "New..." in the tab row: asks the tab's name; an empty tab.

### 3.5 Right-click menus

- In the change mode, on a button: Large, Small, Stacked under the one above, the parameter (None, or one of its
  variants), Rename..., Key tip... (one or two letters, refused when it clashes on its tab), Divider before it, Opens
  (Window or pane / Drop-down: for actions that have both), Into the left corner, Into the right corner, Remove.
- On a divider: Remove the divider. On a corner: Opens, Make it a button, Remove from the corner. On a group or its
  grip: Rename the group..., Remove the group. On a tab: Rename the tab..., Move left, Move right, Remove the tab.
- Always at the end in the change mode: Customize..., Reset to the shipped ribbon, Done.
- Outside the change mode, on a button with a list: its list; anywhere else: Change the ribbon, Customize..., Reset
  to the shipped ribbon.
- Key tips are stored (`tip`) and checked for clashes; showing them (Alt) is not part of this plan (4, question 1).

### 3.6 Customize...

- A dialog under the ribbon: at the left a search box and every action by group (as F1 lists them), "Add >" in the
  middle, at the right the ribbon as lines (tabs, groups, corners, buttons, dividers); buttons Up, Down, Remove,
  Large / small, Stacked, Drop-down, Divider, Rename..., New tab..., New group..., Reset, Close.
- Keys: Enter or a double click on an action adds it after the chosen line; Del removes; Alt+Up and Alt+Down move;
  Esc closes. The chosen line's tab is shown and its part outlined.
- Every change goes through the same change, undo and save as the change mode.

### 3.7 F1 as a pane

- F1 lists every action with its variants, by group, with its keys and hint, filtered as you type; Enter or a click
  runs one. As LexPen's, it is a pane in the window's docks instead of a modal dialog, so it stays open next to the
  ribbon.
- Its head has a button Change the ribbon (Done changing the ribbon while on).
- In the change mode its rows can be dragged onto the ribbon (an action with its parameters); it is drawn again when
  the mode turns on or off.
- Foldex's docks hold panes of a kind (tree, list, preview); F1 becomes a kind of its own there, docked by default at
  the right [place: as LexPen's default dock for its commands pane, not yet checked]. Floating it in a window of its own
  (LexPen's `PaneForm`) comes with plan 14.

### 3.8 Lists on buttons, and the Drives button

- An action gets LexPen's `dropDown(params)` (a list made when it opens, async) and `dropDownOnly`. `ribbon.json` says
  `"open": "dropDown"` on a button or corner whose action has both a window and a list.
- A button with a list: a split arrow (the arrow, or a right-click, opens the list). A list-only button (a drop-down
  only, or an action whose every variant has parameters and none is given): a click opens the list.
- An action without a drop-down but with variants: its variants are its list.
- Clicking the button again while its list is open closes it (generic, `menu.js`).
- Menu items from a drop-down use Foldex's menu item shape (`label`, `run`, `items`); LexPen's mnemonics (`&`) are
  not part of Foldex's menus.
- `drives.list` ("Drives"): `dropDownOnly`; its list is every drive as the drives bar has them (letter, name, free
  space), a click goes there in the active pane. The ribbon gets a Drives button in the Home tab's Go group.

### 3.9 ribbon.json

- The header of the shipped file documents the format as LexPen's does: tabs, groups, items (`action`, `params`,
  `size`, `stack`, `label` with `\n` for two lines, `tip`, `open`), dividers, and a group's `corners` (`left`,
  `right`: an action name, `[action, ...params]` or an item).
- `RibbonFile.Parse` already keeps corners and every item key.

### 3.10 Tests

- `RibbonFile`: Save then Load gives the same model; Reset gives the shipped one; a corner's action is checked as the
  group items are (the test of the shipped ribbon's actions).
- The model changes as pure functions under Jint where LexPen has them pure (taking a part from its place and putting
  it at a target: before, after, under, a corner, a tab, a new group); the first item of a stacked column.
- Test copy over CDP, real mouse and key events: the mode on and off (Done, Esc), a button dragged within a group, to
  another group and tab, under another, into a corner, off the ribbon; Ctrl+Z after each; an action dragged from F1;
  the right-click menus' items; New tab and New group; Customize's Add, Up, Remove; Reset and Ctrl+Z after it; another
  window following a change; the Drives button's list and a click in it.

## 4. Open questions

1. LexPen's ribbon has more than the change mode: icons, key tips (Alt), folding into `>>`, the height grip, showing
   only when wanted (Ctrl+F1), and a menu bar as the other command bar (`commandBar`: menu, ribbon, both). Foldex has
   none of these. Which belong in this plan? (Some of the change mode's menu refers to them: key tips; the Customize
   dialog forces the ribbon shown.)

## 6. As built

Nothing yet.
