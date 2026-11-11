# Plan 10: Bars

Status: not started.

- 2026-11-10: draft.
- 2026-11-10: revised: bars dock at any side; overflow a choice per bar; the bar that fills.
- 2026-11-11: revised: a bar's length from a minimum, a normal size, a maximum and a maximum share of the window;
  bars that fill share the rest by their normal sizes; the Size window with coloured marks.
- 2026-11-11: revised: no checkboxes in the Size window; a bar of buttons sized in buttons.
- 2026-11-11: revised: no minimum share of the window.

## 1. What this is about

Besides the ribbon, Foldex has one fixed strip at the top: the name, the version and the location box. Other things
an explorer keeps at hand, such as a button per drive, have no place, and what is there cannot be moved, resized or
left out. xplorer2 has toolbars, a drive bar and an address bar, each fixed in its kind of place.

## 2. The solution, in brief

Bars: strips of one kind each (the full path, the drives, later more) that dock at any side of the window, several
side by side in a line. Docked at the top or bottom a bar runs across and its width is what changes; docked left or
right it runs down and its height is. Each bar has a minimum, a normal size, a maximum and a maximum share of the
window. It is its normal size, grows with its content up to the maximum (as the drives bar does when a USB stick comes
in), and gives way when the window gets too small for the share, never below its minimum. A bar can instead fill what
the other bars of its line leave; bars that fill share that rest by their normal sizes. Content that does not fit shows
behind a `>>` button or scrolls, as you choose per bar. The layout is a file of its own, `bars.json`, as
`ribbon.json`; you change it in the window by dragging and through a bar's right-click menu and its Size window, which
shows the limits as coloured marks on the bar, and Foldex writes your copy.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Dock sides | bars at any dock side, in lines | -- | 3.1 |
| Sizes | minimum, normal, maximum, maximum share of the window; growing with the content | -- | 3.1 |
| Fill | bars that fill share the rest by their normal sizes, down to their minimum | -- | 3.1 |
| Size window | the fields with colour swatches; the limits as coloured marks on the bar while it is open | -- | 3.3 |
| Overflow | per bar: `more` or `scroll` | -- | 3.1 |
| Path bar | | -- | 3.2 |
| Drives bar | with drives that come and go | -- | 3.2 |
| Name and version | in the window title and F1's About; the default first row | -- | 3.2 |
| `bars.json` and changing bars | dragging, the bar's menu | -- | 3.3 |
| Code | `BarsFile.cs` and `web/bars.js` | -- | 3.4 |

## 3. Details

### 3.1 Terms

- **Bar**: one strip of one kind, with its settings. A kind can be in the layout more than once.
- **Dock side**: top (under the ribbon), bottom (above the status line), left or right of the panes. Bars are dock
  items as panes are (plan 01's docking); where a bar sits has nothing to do with the panes.
- **Line**: bars next to each other at one side: a row at the top or bottom, a column at the left or right. Lines at
  one side stack (rows under each other, columns next to each other); an empty line goes away.
- **Length**: the size along the line: the width in a row, the height in a column. The other size follows the
  content (a row is as high as its bars' text and buttons; a column as wide as its widest button).
- **Sizes**, on the length, each optional except normal:
  - `normal`: the length it has when nothing pushes it;
  - `max`: the most it grows to with its content;
  - `maxShare`: the most it takes of the window's width (height for a column), in %;
  - `min`: the least it shrinks to when the window gets small. It wins over the other limits. A fixed length, not a
    share of the window: a bar does not grow with the window beyond what its content needs.
- **Its length**: the larger of `normal` and what its content needs, at most `max` and `maxShare`, at least `min`.
  Example, a drives bar with min 2, normal 4, max 6 drives and a share of 30%: with 2 drives it is 4 drives long (room
  kept); with 10 drives it is 6 and the rest overflows; as the window narrows, it keeps 6 until 30% of the width is
  less, then shrinks with the window down to 2.
  Without `max` above `normal` it does not grow with its content (a fixed bar); without `maxShare` the window does not
  shrink it.
- **Fill**, a choice per bar instead of growing with its content: the bar takes what the other bars of its line leave.
  The path bar next to a search bar and a drives bar takes all the room they do not need, and gives it back when they
  grow. More than one bar that fills in a line share the rest by their normal sizes (normals 300 and 100: the rest
  split 3 to 1); a bar that reaches its minimum stays there and the others share what is left; one at its maximum
  likewise.
- **A line too short** for all its bars: the bars that fill give way first, down to their minimum; then the others,
  down to their minimum; then the line overflows (`>>` for the line, as for a bar's content).
- Lengths are in buttons for a bar of buttons (the drives), so "6 drives" does not depend on the button width; in px
  at 100% scaling for other bars (the path).
- **Overflow**, per bar: `more` (a `>>` button at the end; the rest in its menu, as toolbars) or `scroll` (the bar's
  content scrolls: the mouse wheel, or arrows at its ends). Default `more`.

### 3.2 The first kinds

- **Path**: the full path of the active pane, editable (what the location box does now: Enter goes there through the
  parent, plan 03 3.3). Default: top, `fill`. In a column (left or right) it shows the path's folders one under the
  other, each a button to go there.
- **Drives**: a button per drive in This PC, by letter (as the tree sorts them): letter, label in the tooltip, an
  optional thin free-space mark. A click: the active pane's parent goes to that drive, as a typed path. Drives that
  come or go (a USB stick, a mapped drive) are added or taken away at once (the host listens to Windows' device
  messages). Default: top, growing with its content, sizes `[not yet chosen]`. Docked left or right it is a column of
  drives that grows down as drives come in, up to its maximum.
- Later kinds, each with its own plan when chosen (`docs/xplorer2-features.md`): bookmarks, a quick filter, user
  commands, the status line.
- The name and version move to the window title and F1's About; the strip they are in now becomes the default first
  row: drives, path.

### 3.3 The file and changing it in the window

- `defaults\bars.json` ships with Foldex; your `bars.json` in the data folder replaces it whole (as `ribbon.json`).
  Per side a list of lines; a line a list of bars; a bar such as
  `{ "kind": "drives", "min": 2, "normal": 4, "max": 6, "maxShare": 30, "overflow": "more" }`,
  `{ "kind": "path", "fill": true, "normal": 300, "min": 120 }` or `{ "kind": "path", "normal": 300 }`.
- In the window: drag a bar by its grip to another place, line or side (the dock marks of plan 01's docking show
  where it lands); drag its end to set its normal size; its right-click menu: Size..., Fill the rest (a check),
  overflow, the side, remove, add a bar of a kind. Every change is written to your `bars.json` (made from the shipped
  one on the first change) and applies in every window.
- **The Size window** (a small window of the page, by Size...): Minimum, Normal, Maximum and Maximum % of the window,
  each with a colour swatch. While it is open the bar's line shows each limit as a mark in its colour; the % limit at
  its place for the window's current size, so resizing the window shows where it cuts in. No marks while the window is
  closed. Changes show at once; OK keeps them, Cancel puts them back. No checkboxes such as "resize by content":
  the fields say it (3.1). The fields are in buttons or px, as the bar's kind is (3.1).
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
- Unit (page code under Jint, as `panes.js`): the size rules of 3.1 in a row and in a column: the drives example
  (2 drives -> normal, 10 -> max, a narrow window -> the share, a very narrow one -> min); a bar without max that
  does not grow; two bars that fill sharing by their normals, one stopping at its minimum while the other shrinks
  on; who gives way when the line is too short; which items go behind `>>`.
- In the test copy: the default row (drives, path); a drive mapped with `subst` appears in the drives bar and the bar
  grows while the path bar shrinks; the drives bar moved to the left grows down; dragging the path bar's end makes it
  its normal size and writes `bars.json`; a drives bar at its maximum shows `>>`, and with `scroll` scrolls; a drive
  button takes the tree there; the Size window's marks in their colours, the % mark moving as the window is resized.

## 4. Open questions

None.
