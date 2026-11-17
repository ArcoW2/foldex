# Plan 19: The ribbon as LexPen's: icons, change mode, lists, key tips, height

Status: executed; see Status and 6.

- 2026-11-12: draft.
- 2026-11-17: executed.

Builds on plan 01 (the ribbon, actions, F1), plan 10 (the bars' change mode, made as LexPen's) and plan 14 (every
window a docked pane and/or a floating window), which is built first: F1 as a pane needs its floating window. The
model is LexPen's ribbon as built:
`..\LexPen\docs\plans\executed\PLAN-ribbon.md`, `PLAN-ribbon-drop-down-lists.md` and
`PLAN-ribbon-height-and-collapse.md` (all three executed). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

Foldex's ribbon is the basic part of LexPen's only: tabs, groups, large and small buttons, greyed out and lit. Its
buttons are text without icons, it cannot be changed in the window (a button is added, moved or removed by editing
`ribbon.json` by hand, and there is no way back to the shipped ribbon), no button opens a list, there are no key
tips, it does not fold into `>>` when the window is narrow, and it always takes its full height. LexPen's ribbon has
all of that. Foldex's F1 is a modal dialog, so nothing can be dragged from it onto the ribbon.

## 2. The solution, in brief

Foldex takes LexPen's ribbon over whole, as LexPen has it: its code, its look, its structure and its editing. Every
button gets an icon made as LexPen makes them: a drawing per action in code, on a 16-unit grid, stroked in the text
colour so every theme colours it, in one file of drawings, with a framed small window for actions that open a pane or
window and a letter box for an action without a drawing. The ribbon gets LexPen's change mode (drag, right-click,
New, Done, Ctrl+Z, saved at once), its Customize dialog and Reset, F1 as a pane to drag actions from, split buttons
and drop-down lists (a Drives button among them), group corners, key tips on Alt, overflow into `>>`, the height grip
and only when wanted (Ctrl+F1). Foldex differs only where it has no menu bar and where its actions are its own.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Ribbon code from LexPen | LexPen's `ribbon.js` over Foldex's, renamed to Foldex's names; delegated events; all tab bodies drawn | 3.1; 3.2; 3.4; 6 |
| Look | LexPen's ribbon CSS over Foldex's `rb-` rules; the size variables | 3.1; 3.4; 6 |
| Icon proposal | a drawing per shipped button, with its sheets in the dark and the light theme | 3.3; 6 |
| Icons | `web/ribbonicons.js`; buttons drawn with them; the letter box; the parameter mark | 3.3; 6 |
| Corners | a group's left and right corner buttons drawn and run | 3.4 |
| Group names and labels | `ribbonGroupNames`, `ribbonLabelWidth`; long labels cut off | 3.4; 3.14 |
| Overflow | groups that do not fit into `>>` | 3.4; 6 |
| Writing the ribbon | `RibbonFile.Save` / `Reset`, the read retry, host ops `ribbonSave` / `ribbonReset`, every window told | 3.5; 6 |
| Change mode | on / off, Done, Esc, Ctrl+Z, buttons not running, the ribbon outlined | 3.6; 6 |
| Dragging | buttons, dividers, corners, groups, tabs moved; dragged off: removed; New tab, New group | 3.7; 6 |
| Right-click menus | per part in the change mode; outside it Change the ribbon, Customize..., Reset | 3.8; 6 |
| Customize dialog | the two lists and their buttons, sharing undo and saving with the change mode | 3.9; 6 |
| F1 as a pane | not modal, a pane of its own, docked or floating; rows draggable in the change mode; its Change the ribbon button | 3.10; 6 |
| Lists on buttons | variants as a list, split arrow, list-only buttons, `dropDown` / `dropDownOnly`, `"open": "dropDown"`; Foldex's menu actions as drop-downs | 3.11; 6 |
| Drives button | `drives.list`: a drop-down of all drives | 3.11; 6 |
| Key tips | Alt shows a letter per tab, then per button and corner | 3.12; 6 |
| Height and only when wanted | the grip, `ribbonRow`, `ribbonShow`, `ribbon.onDemand` on Ctrl+F1, sliding over the panes | 3.13; 6 |
| Settings and actions | the settings in `settings.json` and the Settings window; the ribbon's actions | 3.14; 6 |
| ribbon.json | the shipped file's header and content as LexPen's (corners, open, tip) | 3.15; 6 |
| Tests | see 3.16 and 6 | 3.16; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

LexPen's paths below are under `..\LexPen`. Its ribbon is `src/web/ribbon.js`, `src/web/ribbonicons.js`,
`src/web/ribbonmodel.js`, the ribbon section of `src/web/app.css` (the `mm-rb-` and `mm-rbc-` rules),
`src/defaults/ribbon.json`, `src/RibbonFile.cs`, F1's pane (`src/web/palette.js`, `src/web/commands-pane.js`,
`src/web/commands.html`), its tests in `tests/LexPen.Tests/RibbonTests.cs`, and its plans named above.

### 3.1 What Foldex takes from LexPen

| LexPen | Foldex | How |
|---|---|---|
| `src/web/ribbon.js` | `src/web/ribbon.js` | replaces it; renamed (below); the parts 3.2 lists left out |
| `src/web/ribbonicons.js` | `src/web/ribbonicons.js` (new) | the same file and functions; the drawings keyed by Foldex's actions (3.3) |
| `src/web/ribbonmodel.js` | `src/web/ribbonmodel.js` | the same already (columns, corners, key tips, sizes); stays |
| `src/web/app.css`, ribbon section | `src/web/app.css` | replaces Foldex's `rb-` rules; colours as Foldex's theme variables (`--fg`, `--fg-dim`, `--bg`, `--border`, `--accent`, `--hover`) |
| `src/RibbonFile.cs` | `src/RibbonFile.cs` | `Save`, `Reset` and the read retry added (3.5) |
| `src/defaults/ribbon.json` header | `src/defaults/ribbon.json` | the header documents the format as LexPen's; the content stays Foldex's (3.15) |
| `src/web/palette.js`, `commands-pane.js`, `commands.html` | `src/web/palette.js` and a pane page | F1 as a pane (3.10) |
| the ribbon's actions in `ribbon.js` | `src/web/ribbon.js` | `ribbon.change`, `ribbon.customize`, `ribbon.reset`, `ribbon.onDemand` (3.14) |
| settings `ribbonGroupNames`, `ribbonLabelWidth`, `ribbonTab`, `ribbonRow`, `ribbonShow` | `src/defaults/settings.json`, Settings window | 3.14 |
| `tests/LexPen.Tests/RibbonTests.cs` | Foldex's tests (`KeysAndRibbonTests` and new ones) | 3.16 |

- **Names.** Foldex keeps its own prefixes and helpers; the behaviour is LexPen's. The classes `mm-rb-...` become
  `rb-...` (`mm-rbc-...`: `rbc-...`), `mm-on` becomes `on`; `appAction` is `action`, `toast` is `status`, `askName` is
  `askText`, `openContextMenu` is `openMenu`, `actionAvailable` is `actionEnabled`. LexPen's `loadRibbon` asks the
  host (`host('ribbon')`); Foldex's host sends the ribbon (`setRibbon({ ribbon, problems })`), which stays.
- **Where it sits.** Foldex's `<nav id="ribbon">` at the top of the page holds LexPen's ribbon element: its tab row
  (LexPen's `rb-tabs-row`), the bodies, the grip under them.

### 3.2 Where Foldex differs from LexPen, and why

- **No menu bar.** Foldex has no menus at the top, so LexPen's setting `commandBar` (menu, ribbon, both), the actions
  `ribbon.toggle` and `commandBar.set`, the setting `altOpens`, the menus shown in the tab names' place
  (`rbShowMenus`) and "change mode with `menu` sets `both`" are not taken. The ribbon is always Foldex's command bar:
  its tab names in a row of their own above its buttons, as LexPen's `both` draws them, since Foldex has no top bar
  to put them in. To put it away there is only when wanted (3.13).
- **Alt alone** shows the key tips always, as LexPen with `commandBar` `ribbon` and `altOpens` `tips`: there are no
  menus for Alt to open (3.12).
- **Alt+letter.** In LexPen, Alt+a letter that is a tab's tip opens that tab at once. Foldex's `keys.json` binds
  Alt+letter keys (Alt+P, Alt+I); a key bound in `keys.json` runs its action, and Alt+letter goes to a tab's tip only
  when no key is bound to it, so a key of yours never changes meaning because a tab got that letter.
- **The actions are Foldex's**, so the drawings are keyed by Foldex's action names, and LexPen's drawings are reused
  where an action means the same (3.3).
- **Panels.** LexPen's framed icons are for its panels (`panel <kind>`, `RIBBON_PANEL_ACTIONS`). Foldex has no
  `panel` action: its framed icons are for the actions that show a pane or open a window (plan 14 3.7), listed in
  `RIBBON_PANEL_ACTIONS` with Foldex's names (3.3). LexPen polls its panels' windows for their checks
  (`refreshPanelsOpen`); Foldex's panes are in its page, so its actions' `checked` is enough and the poll is not taken.
- **No numbered clipboards.** LexPen's clipboard badge on Paste and its lists of clipboards (Paste, Copy, Cut,
  `RB_LISTS` for bookmarks) belong to LexPen's actions; Foldex has none of these, so they are not taken. The
  parameter mark (a variant's parameter in a small corner of its icon) is taken.
- **Per window** settings (`ribbonTab`, `ribbonRow`, `ribbonShow`): LexPen keeps them in a window's Layout
  settings; Foldex keeps them with the window's layout in its project (plan 15), where its other per-window state is.
- **Menu items** from a list use Foldex's menu item shape (`label`, `run`, `items`); LexPen's mnemonics (`&`) are not
  part of Foldex's menus.
- **F1** first opens floating, as LexPen's, in plan 14's floating window (plan 14 is built before this plan).

### 3.3 Icons

Made exactly as LexPen's (`..\LexPen\docs\plans\executed\PLAN-ribbon.md` 3.4 and 5; `..\LexPen\src\web\ribbonicons.js`):

- **A drawing per action, in code.** `RIBBON_ICONS` holds per action its name (for the overview) and its SVG body,
  built from small helpers (a page, a folder, a magnifier `mag`, a clipboard, `p` for a path, `t` for text in Segoe
  UI, `dim` for a faint line, `dot`, `gear`). No image files, no icon font, no sprite.
- **One grid, two sizes.** One drawing on a 16-unit grid (`viewBox="0 0 16 16"`): small at 16 px with lines of 1.4,
  large at 32 px with lines of 1.0; `fill="none"`, round caps and joins (`ribbonIconSvg`).
- **One set for light and dark.** Stroked in `currentColor`: the text colour of the theme. A colour, where one is
  wanted later, comes from the theme's own colours (`--accent`, `--warning`), not from a second set.
- **The key** is the action's name, or the action and its parameter after a space where the parameter makes another
  drawing (LexPen's `"bookmarkNext -1"`; in Foldex `"layout.preset dual"`, `"bars.add drives"`). `ribbonIcon(call,
  size)` looks up the call with its parameters first, then the action alone.
- **Panes and windows**: a small window (a frame with a title bar) with the drawing inside, so the button reads as "a
  window opens". At 32 px the large drawing at 0.66 inside the frame; at 16 px a simpler drawing made for that size.
  `RIBBON_PANEL_ACTIONS` maps the actions that show a pane or open a window to their drawing: in Foldex
  `preview.toggle`, `info.toggle`, `log.toggle`, `palette` (F1, drawn as LexPen's "F1"), `settings.open`,
  `projects.manage`, `columns.manage`, `bookmarks.manage`.
- **Related actions share a drawing**, as LexPen's: Copy path is Copy with a path line, New file and New folder a page
  and a folder with a plus, Delete from disk and Delete permanently Delete with a mark.
- **LexPen's drawings reused** where the action means the same: Copy, Cut, Paste, Find (the magnifier), Select all,
  Refresh (Sort again's circular arrow), a bookmark, Settings (the cog), F1, Projects, Columns. The others are drawn
  new in the same style.
- **No drawing** (an action added through the change mode or Customize that has none yet): a box with its label's
  first letter (`rb-letter`).
- **A variant without a drawing of its own** gets the action's icon with its parameter in a small mark at its corner
  (`rb-mark`); one with its own drawing (`rbOwnDrawing`) shows no mark.
- **Sizes follow the height** (3.13): the CSS variables `--rb-f`, `--rb-li`, `--rb-li2` from `ribbonSizes`.
- **How it is made, as LexPen did**: first a proposal, a drawing for every button of the shipped ribbon, in
  `19-PLAN-ribbon-change-mode.md.images/ribbon-icons.js` beside this plan, with sheets of all of them, large and
  small, in the dark and the light theme (`ribbon-icons-dark.png`, `ribbon-icons-light.png`) and a picture of each
  tab, linked from this section. Then `src/web/ribbonicons.js` is made from it, keyed by Foldex's actions, and loaded
  before `ribbon.js` in `index.html`.
- Foldex's own few SVGs elsewhere (the pane head's filter mark, the scrap's close and bin) are not ribbon icons and
  stay as they are.

### 3.4 Drawing and events

As LexPen's `ribbon.js` (Drawing; State of the buttons; Overflow; Clicks):

- One set of listeners on the ribbon (mousedown, click, contextmenu, the drag events), the part found by
  `data-path`, `data-corner`, `data-grip`, `data-tab`, as LexPen's `rbElements`; Foldex's per-button listeners go.
- A button: its icon (3.3), its label (`\n` a line break on a large button, a space on a small one), its arrow when it
  has a list, its tooltip the title and key with the hint on a line under it ("(drop-down)" when it opens one).
- Columns from `ribbonColumns` (stacks of up to three small ones, a large one sharing its column with one small one).
- Corners: the left and right button beside a group's name (`ribbonCorner`, `ribbonCornerOf`, `ribbonItemOf`), drawn
  as LexPen's launcher mark, an arrow down for a drop-down corner. An empty corner only in the change mode ("drop an
  action here").
- An unknown action: nothing outside the change mode; in it a "?" button that can be dragged off.
- All tab bodies are drawn and the others hidden, so a tab name hovered while dragging shows its tab.
- Lit, greyed out, refreshed as LexPen's `rbRefresh` (soon after focus, mouse up and key up, and after an action).
- Group names: under each group (`ribbonGroupNames` on), or dividers only with the name as their tooltip.
- Long labels cut off with "..." at `ribbonLabelWidth` characters (a large button's after two lines of half that).
- Overflow: whole groups that do not fit go into `>>` from the right end, each a submenu; none in the change mode
  (the ribbon scrolls sideways there).

### 3.5 Writing the ribbon (host)

- `RibbonFile.Save(dataDir, ribbon)`: writes your `ribbon.json` with a header comment and indented JSON, through a
  `.tmp` file as `BarsFile.Save` does. `RibbonFile.Reset(dataDir)`: removes it. `Load` reads with LexPen's retry on
  a file being written (`ReadText`).
- Ops: `ribbonSave` (the model) and `ribbonReset`. Foldex's page posts without an answer, so after either the host
  sends every window the event `ribbon` with `RibbonFile.Load` (as `barsSave` sends `bars`); the window that changed it
  ignores it while in the change mode, as LexPen's `events.ribbon` does.

### 3.6 The change mode

- On and off: the action `ribbon.change` ("Change the ribbon", checked while on), the ribbon's right-click menu, F1's
  button. Turning it on opens F1.
- In it: the ribbon outlined; tabs, buttons, dividers and corners draggable; a grip on each group; "New..." in the
  tab row and as the last group of each tab; a Done button; buttons and corners do not run; no overflow; the chosen
  tab is not saved as the setting; only when wanted is off while it lasts (the ribbon shown).
- Esc: ends it; Ctrl+Z: takes back the last change ("Nothing to take back." when there is none); neither while a
  menu or a dialog is open.
- Every change (`rbChange`): the model before it kept for Ctrl+Z, then written at once (`ribbonSave`) and drawn
  again. Reset in the change mode keeps the model before it, so Ctrl+Z takes the reset back too.
- The bars' change mode (plan 10) stays its own; the two can be on at the same time.

### 3.7 Dragging

- What: a button, a divider, a corner, a group (by its grip), a tab; from F1 an action (with its parameters).
- Where: before or after a button (by the half it is over), under it (the lower part: stacked under it), into a
  corner (one there already goes), onto a tab (the end of its last group; a group made when it has none), onto a group
  (its end), onto "New..." (asks the new group's name), a tab before or after a tab, a group before or after a group.
  The place is marked while dragging; hovering a tab name for a moment shows that tab.
- Off the ribbon: let go outside it and the part is removed (a tab, a group, a button, a divider, a corner).
- Taking a button from the top of a stacked column makes the next one start the column.
- "New..." in the tab row: asks the tab's name; an empty tab.
- From F1: the action itself is a button with its arrow and all its variants; one variant is a button for that one
  choice, its label the variant's title, its icon with the parameter mark (3.3), no arrow.

### 3.8 Right-click menus

- In the change mode, on a button: Large, Small, Stacked under the one above, the parameter (None, or one of its
  variants), Rename... (Shift+Enter a line break), Key tip... (one or two letters, refused when it clashes on its
  tab), Divider before it, Opens (Window or pane / Drop-down: for actions that have both), Into the left corner, Into
  the right corner, Remove.
- On a divider: Remove the divider. On a corner: Opens, Make it a button, Remove from the corner. On a group or its
  grip: Rename the group..., Remove the group. On a tab: Rename the tab..., Move left, Move right, Remove the tab.
- Always at the end in the change mode: Customize..., Reset to the shipped ribbon, Done.
- Outside the change mode, on a button with a list: its list; anywhere else: Change the ribbon, Customize..., Reset
  to the shipped ribbon, Ribbon only when wanted.

### 3.9 Customize...

- A dialog under the ribbon (LexPen's `rbCustomize`): at the left a search box and every action by group (as F1
  lists them), "Add >" in the middle, at the right the ribbon as lines (tabs, groups, corners, buttons, dividers);
  buttons Up, Down, Remove, Large / small, Stacked, Drop-down, Divider, Rename..., New tab..., New group..., Reset,
  Close.
- Keys: Enter or a double click on an action adds it after the chosen line; Del removes; Alt+Up and Alt+Down move;
  Esc closes. The chosen line's tab is shown and its part outlined; the ribbon is shown while it is open (only when
  wanted is off).
- Every change goes through the same change, undo and save as the change mode.
- What it can be (plan 14 3.7): modal, as LexPen's, in a modal floating window: never docked, but moved anywhere, so
  the ribbon it works on can be seen.

### 3.10 F1 as a pane

- F1 lists every action with its variants, by group, with its keys and hint, filtered as you type; Enter or a click
  runs one. As LexPen's (`palette.js`, `commands-pane.js`, `commands.html`), it is a pane of its own and not modal:
  it stays open after an action, which runs on the active pane.
- Its head has a button Change the ribbon (Done changing the ribbon while on).
- In the change mode its rows can be dragged onto the ribbon (an action with its parameters); it is drawn again when
  the mode turns on or off.
- What it can be (plan 14 3.7): both docked and floating; it first opens floating, as LexPen's ("floating the first
  time, dockable as the other panes"). In Foldex's docks it is a pane kind of its own beside tree, list and preview.

### 3.11 Lists on buttons, and the Drives button

As LexPen's (`..\LexPen\docs\plans\executed\PLAN-ribbon-drop-down-lists.md` 3.1, 3.2; `PLAN-ribbon.md` 3.2 and 5):

- An action gets LexPen's `dropDown(params)` (a list made when it opens, async) and `dropDownOnly`. `ribbon.json` says
  `"open": "dropDown"` on a button or corner whose action has both a window and a list; the list then ends with a
  divider and the action itself.
- A button with a list: a split arrow (the arrow, or a right-click, opens the list). A list-only button (a drop-down
  only, or an action whose every variant has parameters and none is given): a click opens the list.
- An action without a drop-down but with variants: its variants are its list.
- Clicking the button again while its list is open closes it (generic, `menu.js`).
- Foldex's actions that open a menu now (`bookmarks.menu`, `view.menu`, `projects.menu`) become `dropDownOnly` with
  their items as `dropDown()`, as LexPen's `recent.list` and `favourites.list`: a list under the button on the
  ribbon, at the cursor from F1 or a key.
- `drives.list` ("Drives"): `dropDownOnly`; its list is every drive as the drives bar has them (letter, name, free
  space), a click goes there in the active pane. The ribbon gets a Drives button in the Home tab's Go group.

### 3.12 Key tips

As LexPen's (`PLAN-ribbon.md` 3.2, Key tips; `ribbon.js` Key tips; `ribbonTips` in `ribbonmodel.js`):

- Alt pressed and let go alone: a letter on each tab name; its letter opens that tab and shows a letter on each of
  its buttons and corners; a button's letter runs it (a list button opens its list). Esc goes a level back; a click
  elsewhere or another key ends them.
- The letters come from the names (the first letter no other one at that level has, two when one is not enough), a
  button's own `tip` first.
- Alt+letter: see 3.2.

### 3.13 The height, and only when wanted

As LexPen's (`..\LexPen\docs\plans\executed\PLAN-ribbon-height-and-collapse.md` 3.1, 3.2 and 5):

- The grip under the group names: dragged, the ribbon lower or higher (the spacing first, then the text and icons
  down to 3/4); a double click: the full height; dragged past the lowest: only when wanted. The row height is
  `ribbonRow`; `ribbonSizes` (already in `ribbonmodel.js`) gives the CSS variables.
- Only when wanted (`ribbonShow` `onDemand`): the tab names stay, the buttons hidden; a click on a tab name, a drag
  down from the tab names or Alt slides the ribbon down over the panes (which do not move); it slides away after a
  button runs, on Esc, a click elsewhere or a key typed in a pane. A button at the ribbon's right end and Ctrl+F1
  (`ribbon.onDemand`) switch. Ctrl+F1 is free in Foldex's `keys.json` (checked).

### 3.14 Settings and actions

- `settings.json`: `ribbonGroupNames` (true) and `ribbonLabelWidth` (24, LexPen's default) with the other settings;
  `ribbonTab`, `ribbonRow`, `ribbonShow` per window (3.2). The Settings window gets them as rows, `ribbonShow` as
  "Show the ribbon" (Always / Only when wanted).
- Actions (group `view`): `ribbon.change`, `ribbon.customize`, `ribbon.reset`, `ribbon.onDemand`, with LexPen's titles
  and hints (Foldex for LexPen).
- `keys.json`: `"Ctrl+F1": "ribbon.onDemand"`.

### 3.15 ribbon.json

- The header of the shipped file documents the format as LexPen's does: tabs, groups, items (`action`, `params`,
  `size`, `stack`, `label` with `\n` for two lines, `tip`, `open`), dividers, and a group's `corners` (`left`,
  `right`: an action name, `[action, ...params]` or an item with `open`).
- The content stays Foldex's tabs and groups, with the Drives button (3.11). The shipped groups have no corners:
  LexPen's corners hold an action with both a window and a list (the window left, the drop-down right), and no Foldex
  action has both; the change mode and Customize can put any action in a corner.
- `RibbonFile.Parse` already keeps corners and every item key.

### 3.16 Tests

- `RibbonFile`: Save then Load gives the same model; Reset gives the shipped one; a corner's action is checked as the
  group items are (the test of the shipped ribbon's actions); `open` read and written back on a button and a corner.
- Icons: every button of the shipped ribbon has a drawing (no letter box); each drawing is valid SVG.
- Under Jint, as LexPen's `RibbonTests`: the model changes where LexPen has them pure (a part taken from its place and
  put at a target: before, after, under, a corner, a tab, a new group); the first item of a stacked column; the key
  tips of a tab and its buttons; the sizes at the full, a middle and the lowest height.
- Test copy over CDP, real mouse and key events: the icons in the dark and the light theme, large and small (a
  screenshot); the mode on and off (Done, Esc); a button dragged within a group, to another group and tab, under
  another, into a corner, off the ribbon; Ctrl+Z after each; an action and a variant dragged from F1; the right-click
  menus' items; New tab and New group; Customize's Add, Up, Remove; Reset and Ctrl+Z after it; another window
  following a change; a split button's list; the Drives button's list and a click in it; key tips (a tab, a button);
  Alt+P still toggling the preview; `>>` at a narrow window; the grip (lower, double click, past the lowest), only
  when wanted (a tab click slides it down, a button slides it up, Ctrl+F1).

## 4. Open questions

None.

## 6. As built

Pictures beside this plan (`19-PLAN-ribbon-change-mode.md.images/`): the icon sheets
[dark](19-PLAN-ribbon-change-mode.md.images/ribbon-icons-dark.png) and
[light](19-PLAN-ribbon-change-mode.md.images/ribbon-icons-light.png), every drawing large and small; the tabs
[Home](19-PLAN-ribbon-change-mode.md.images/ribbon-home.png),
[Home, light](19-PLAN-ribbon-change-mode.md.images/ribbon-home-light.png) and
[View](19-PLAN-ribbon-change-mode.md.images/ribbon-view.png).

What differs from the plan, and what was decided while building:

- **Icons without a separate proposal file.** The drawings were made in `src/web/ribbonicons.js` itself, and the
  sheets above made from it in the test copy; there is no `ribbon-icons.js` copy beside the plan. They are open for
  your remarks: a drawing changes in that one file.
- **The model's changes are in `ribbonmodel.js`** (`rbTake`, `rbPlaceIn`, `rbRemoveIn`), pure, so the tests run them
  under Jint; `ribbon.js` runs them through `rbChange`. Found by the tests and fixed there: a divider dropped on a
  corner was taken out before the drop was refused (LexPen has the same order).
- **The ribbon's actions** (`ribbon.change`, `ribbon.customize`, `ribbon.reset`, `ribbon.onDemand`) are in
  `actions.js` with the others, not in `ribbon.js`, so the test of the shipped keys and ribbon knows them.
- **Per window** (`ribbonTab`, `ribbonRow`, `ribbonShow`): kept as `ribbon` in the window's layout (`app.js`
  windowLayout, restored in `start` by `rbWindow`). They are not rows of the Settings window, which writes
  settings.json for every window; only when wanted is switched by Ctrl+F1, the button at the ribbon's right end, its
  right-click menu and the grip. The Settings window's App tab has a group Ribbon with Group names and Label width.
- **Reset** posts `ribbonReset` and takes the ribbon the host sends back (`rb.resetting`), also in the change mode,
  which otherwise keeps its own model over the events of other windows.
- **Customize** is a floating window that is not modal (`dialog.html`, `dialogpage.js customizeHere`), so the ribbon
  stays usable while it is open (another tab clicked, the change mode beside it); LexPen's is modal. Each change it makes is the
  window's page's (`rbcDo`), which answers with the lines; a name it needs (New tab, New group, Rename) it asks in its
  own window. Ctrl+Z there takes back the last change too.
- **A label's line break**: the small text dialog has one line, so `\n` typed in a label is a line break (shown so
  when renamed again), not Shift+Enter.
- **Key tips from a pane**: a tree's, list's or scrap's page (a frame) and the other pane pages (`pane.js`) tell the
  window an Alt alone, or Alt+a letter no key of keys.json has (`ribbonAlt`); the keyboard goes to the window's page
  while the tips show and back to the active pane after. A dialog's window keeps its Alt.
- **Lists**: Bookmarks, Views, Projects and Drives are `dropDownOnly`; Projects asks the host for its list
  (`projectListItems`). Menus have no `&` mnemonics (Foldex's menus have none).
- **Foldex's own windows and the first click**: a floating window of Foldex (Customize, a floating pane) tells the
  window when it gets and loses the focus (`pane.js`, `app.js ownWindowFocus`), so the first click back in the window
  acts instead of being taken as the click that brings Foldex back from another program.
- **F1 docked**: the rows it is sent each time it gets the focus only set their marks when the actions are the same
  (`palettepane.js`); redrawn, the row a click pressed was gone before its release, so no click came (no row
  selected, its Change the ribbon button not working). The button in the theme's colours.
- **Not taken from LexPen**: the clipboard badge and its lists, the "auto" mark (no Foldex action has one), the
  panels' poll.
- **The shipped ribbon**: the Drives button in Home > Go; All actions (F1) and Log in View > Foldex; Rename pane and
  Hidden items stacked, With preview a column of its own; the header documents the format.

Tested:

- Unit: `RibbonTests` (your ribbon.json written with corners, `open`, `tip` and a line break, read back the same, no
  `.tmp` left, Reset gives the shipped one; every shipped button has a drawing, large and small, and every drawing is
  well-formed SVG; a button moved after, under and before another, the one under a taken button starting its column;
  a corner, a tab, a call into a group, a divider and a group removed, a tab moved; a group moved and a divider on a
  corner refused with nothing changed; columns, key tips, sizes at the full, a middle and the lowest height) and the
  shipped keys and ribbon test (corners' actions too). `dotnet test`: 238 passed, 0 failed.
- In the test copy (CDP; drags as the ribbon's own drag events with a DataTransfer, clicks as mouse events): the
  icons in the dark and the light theme; Drives' list (the drives with their free space), closed by a click again;
  Bookmarks' list; the change mode on (outline, Done, grips, F1 opened floating, its button "Done changing the
  ribbon", its rows draggable), a button dragged after another, under another (into another group), into a corner,
  off the ribbon; your ribbon.json written; Ctrl+Z four times back to the start, a fifth "Nothing to take back.";
  an action from F1 floating (the browser's drop) and docked (the pointer drag as the window sees it, the place
  marked); Esc ending the mode; Reset (the file removed, "The shipped ribbon (Ctrl+Z takes it back).") and Ctrl+Z
  after it (the file back); key tips (Alt: H, V; V: the View tab and its buttons' tips; Esc twice: gone); Alt+P still
  the preview, no tips; `>>` at a narrow ribbon with the groups left out as its menu; the height lower (row 20); only
  when wanted (the buttons hidden, a tab click slides them down without moving the panes, a button run slides them
  up), Ctrl+F1 back to always; Customize (an action found by its search and added after the chosen line, Up, Remove,
  the chosen line outlined on the ribbon, closed); the right-click menus of the ribbon, a button, a tab and a group's
  grip.
- Not checked: dragging with the real mouse (the browser's drag from F1 floating to the window, a group by its grip,
  a tab), the grip dragged and double-clicked, Alt pressed in a pane's frame, another window following a change,
  New tab and New group, Customize's keys, the Views list's right-click.
