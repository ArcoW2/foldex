# Plan 10: Bars

Status: draft 2026-11-10, revised 2026-11-10 (bars dock at any side; overflow a choice per bar; the bar that fills);
not started.

## 1. What this is about

Besides the ribbon, Foldex has one fixed strip at the top: the name, the version and the location box. Other things
an explorer keeps at hand, such as a button per drive, have no place, and what is there cannot be moved, resized or
left out. xplorer2 has toolbars, a drive bar and an address bar, each fixed in its kind of place.

## 2. The solution, in brief

Bars: strips of one kind each (the full path, the drives, later more) that dock at any side of the window, several
side by side in a line. Docked at the top or bottom a bar runs across and its width is what changes; docked left or
right it runs down and its height is. Each bar has a size mode: a size you set, filling what the other bars of its
line leave, or growing with its content (as the drives bar does when a USB stick comes in) between a minimum and a
maximum. Content that does not fit shows behind a `>>` button or scrolls, as you choose per bar. The layout is a file
of its own, `bars.json`, as `ribbon.json`; you change it in the window by dragging and through a bar's right-click
menu, and Foldex writes your copy.

## 3. Details

### 3.1 Terms

- **Bar**: one strip of one kind, with its settings. A kind can be in the layout more than once.
- **Dock side**: top (under the ribbon), bottom (above the status line), left or right of the panes. Bars are dock
  items as panes are (plan 01's docking); where a bar sits has nothing to do with the panes.
- **Line**: bars next to each other at one side: a row at the top or bottom, a column at the left or right. Lines at
  one side stack (rows under each other, columns next to each other); an empty line goes away.
- **Length**: the size along the line: the width in a row, the height in a column. The other size follows the
  content (a row is as high as its bars' text and buttons; a column as wide as its widest button).
- **Size mode**, on the length:
  - `fixed`: the length you set (in px at 100% scaling), by dragging the bar's end or in its menu;
  - `fill`: what the other bars of its line leave. The path bar next to a search bar and a drives bar takes all the
    room they do not need, and gives it back when they grow. More than one `fill` bar in a line share it equally;
  - `content`: as long as its content needs, at least `min` and at most `max`; it grows and shrinks as the content
    changes. When the line is too short, `fill` bars give way first, then `content` bars down to their `min`.
- **The maximum** of a `content` bar: open question 1.
- **Overflow**, per bar: `more` (a `>>` button at the end; the rest in its menu, as toolbars) or `scroll` (the bar's
  content scrolls: the mouse wheel, or arrows at its ends). Default `more`.

### 3.2 The first kinds

- **Path**: the full path of the active pane, editable (what the location box does now: Enter goes there through the
  parent, plan 03 3.3). Default: top, `fill`. In a column (left or right) it shows the path's folders one under the
  other, each a button to go there.
- **Drives**: a button per drive in This PC, by letter (as the tree sorts them): letter, label in the tooltip, an
  optional thin free-space mark. A click: the active pane's parent goes to that drive, as a typed path. Drives that
  come or go (a USB stick, a mapped drive) are added or taken away at once (the host listens to Windows' device
  messages). Default: top, `content`, min one button. Docked left or right it is a column of drives that grows down
  as drives come in, up to its maximum.
- Later kinds, each with its own plan when chosen (`docs/xplorer2-features.md`): bookmarks, a quick filter, user
  commands, the status line.
- The name and version move to the window title and F1's About; the strip they are in now becomes the default first
  row: drives, path.

### 3.3 The file and changing it in the window

- `defaults\bars.json` ships with Foldex; your `bars.json` in the data folder replaces it whole (as `ribbon.json`).
  Per side a list of lines; a line a list of bars; a bar such as
  `{ "kind": "drives", "size": "content", "min": 40, "max": 400, "overflow": "more" }`,
  `{ "kind": "path", "size": "fill" }` or `{ "kind": "path", "size": 300 }`.
- In the window: drag a bar by its grip to another place, line or side (the dock marks of plan 01's docking show
  where it lands); drag its end to make it `fixed` at that length; its right-click menu: size mode, min and max,
  overflow, the side, remove, add a bar of a kind. Every change is written to your `bars.json` (made from the shipped
  one on the first change) and applies in every window.
- A wrong entry in a hand-edited file is reported in the status line and left out, as with keys and the ribbon.

### 3.4 Where it lives

- Bars are the same in every window for now; with projects (plan 01 3.5) a project may get a layout of its own.
- The page draws the bars (`web/bars.js`); the host reads and writes the file (`BarsFile.cs`, as `RibbonFile.cs`)
  and tells of drives that come and go.
- Moving a bar to another side by dragging needs plan 01's docking; until that is built, the side is set in the
  bar's menu and in the file.

### 3.5 Tests

- Unit (`BarsFile`): defaults and yours (yours replaces), a wrong kind, side or size reported and skipped, writing
  keeps the file readable.
- Unit (page code under Jint, as `panes.js`): the size rules of 3.1 in a row and in a column: fixed, fill shared,
  content between min and max, who gives way when the line is too short; which items go behind `>>`.
- In the test copy: the default row (drives, path); a drive mapped with `subst` appears in the drives bar and the bar
  grows while the path bar shrinks; the drives bar moved to the left grows down; dragging the path bar's end makes it
  fixed and writes `bars.json`; a fixed drives bar too short for its drives shows `>>`, and with `scroll` scrolls; a
  drive button takes the tree there.

## 4. Open questions

1. **How the maximum of a growing bar is given.** A growing bar (`content`) gets longer as its content grows: the
   drives bar with each drive that comes in. The maximum stops it somewhere, and from there the overflow (`>>` or
   scroll) takes over. The maximum can be:
   - a length in px (for example 400): simple, but in a narrow window 400 px can be most of the row, and in a wide
     one it may stop early;
   - a share of the line (for example 50%): it keeps its proportion when the window is resized, but on a very wide
     screen half a row is a lot of drive buttons;
   - both, the smaller one winning ("at most 400 px and at most half").
   Px, a share, or both?

## 5. Status

### Built

Nothing yet.

### Not yet built

- Bars at any dock side, in lines (3.1).
- The size modes `fixed`, `fill` and `content` with min and max (3.1).
- Overflow per bar: `more` or `scroll` (3.1).
- The path bar (3.2).
- The drives bar, with drives that come and go (3.2).
- The name and version in the window title and F1's About; the default first row (3.2).
- `bars.json`, and changing the bars in the window: dragging, the bar's menu (3.3).
- `BarsFile.cs` and `web/bars.js` (3.4).
