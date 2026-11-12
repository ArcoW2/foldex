# Plan 10: Bars

Status: executed; see 6. As built.

- 2026-11-10: draft.
- 2026-11-10: revised: bars dock at any side; overflow a choice per bar; the bar that fills.
- 2026-11-11: revised: a bar's length from a minimum, a normal size, a maximum and a maximum share of the window;
  bars that fill share the rest by their normal sizes; the Size window with coloured marks.
- 2026-11-11: revised: no checkboxes in the Size window; a bar of buttons sized in buttons.
- 2026-11-11: revised: no minimum share of the window.
- 2026-11-11: executed.

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

| Part | What | Reference |
|---|---|---|
| Dock sides | bars at any dock side, in lines | 3.1; 6.1 |
| Sizes | minimum, normal, maximum, maximum share of the window; growing with the content | 3.1; 6.1 |
| Fill | bars that fill share the rest by their normal sizes, down to their minimum | 3.1; 6.1 |
| Size window | the fields with colour swatches; the limits as coloured marks on the bar while it is open | 3.3; 6.1 |
| Overflow | per bar: `more` or `scroll` | 3.1; 6.1 |
| Path bar | | 3.2; 6.1 |
| Drives bar | with drives that come and go | 3.2; 6.1 |
| Name and version | in the window title and F1's About; the default first row | 3.2; 6.1 |
| `bars.json` and changing bars | dragging, the bar's menu | 3.3; 6.1 |
| Code | `BarsFile.cs` and `web/bars.js` | 3.4; 6.1 |

### Not yet built

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
- **Its length**: the larger of `normal` and what its content needs, at most `max` and `maxShare` (the share not below
  `normal`), at least `min`.
  Example, a drives bar with min 2, normal 4, max 6 drives and a share of 30%: with 2 drives it is 4 drives long (room
  kept); with 10 drives it is 6 and the rest overflows; as the window narrows, it keeps 6 until 30% of the width is
  less, then shrinks with the window down to its normal 4. Below its normal only a line too short shrinks it (after
  the bars that fill are at their minimum), down to 2; a window growing again gives it back its normal 4 before a bar
  that fills grows.
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
  messages). Default: top, growing with its content: min 2, normal 4, max 6 drives, at most 30% of the window. Docked
  left or right it is a column of drives that grows down as drives come in, up to its maximum.
- Later kinds, each with its own plan when chosen (`docs/xplorer2-features.md`): bookmarks, a quick filter, user
  commands, the status line.
- The name and version move to the window title and F1's About; the strip they are in now becomes the default first
  row: drives, path.

### 3.3 The file and changing it in the window

- `defaults\bars.json` ships with Foldex; your `bars.json` in the data folder replaces it whole (as `ribbon.json`).
  Per side a list of lines; a line a list of bars; a bar such as
  `{ "kind": "drives", "min": 2, "normal": 4, "max": 6, "maxShare": 30, "overflow": "more" }`,
  `{ "kind": "path", "fill": true, "normal": 300, "min": 120 }` or `{ "kind": "path", "normal": 300 }`.
- In the window, in the bars' change mode (as LexPen's ribbon: Change the bars on a bar's right-click menu, View >
  Bars on the ribbon, F1; Done or Esc ends it, Ctrl+Z takes the last change back): the grips and splitters show and
  the bars' content does not respond. Drag a bar by its grip to another place, line or side (the place it lands is
  marked); drag the splitter after it (the border at its end) to set its normal size: above its maximum the maximum
  grows with it, below its minimum the minimum follows (the least: 1 button, or 20 px); its right-click menu, anywhere
  on the bar: Size..., Fill the rest (a check), overflow, remove, add a bar of a kind (its side only by dragging).
  Outside the mode a right-click on a bar offers Change the bars and Reset the bars; the path box keeps its own menu. Every change is written to your `bars.json` (made from the shipped
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

## 6. As built

### 6.1 Built (2026-11-11, branch `plan01-foundation`)

- `BarsFile.cs`: reads `defaults\bars.json` or yours (yours replaces it whole), keeps per side the lines and per line
  the bars, and reports a wrong kind, side, size, share or overflow (left out); `Save` writes yours through a `.tmp`
  file; `SaveBars(null)` removes yours (Reset the bars).
- `Shell\Drives.cs`: the drives with the shell's name (`Local Disk (C:)`), size and free space when ready, on an STA
  thread. `MainForm` tells the page the drives when asked, on Windows' device messages (arrival, removal), and when
  the letters change, looked at every 4 s (a drive made with `subst` or mapped sends no device message).
- `web/bars.js`: the size rules as pure functions (`barPx`, `lineLengths`, `fitItems`), run by the tests under Jint;
  drawing the lines at each side (`#bars-top`, `#bars-bottom`, `#bars-left`, `#bars-right` around the panes); the drives
  bar (a button per drive, the current one framed, a thin mark of the space used, the name and free space in the
  tooltip, a click takes the active pane's parent there); the path bar (the location box in a row, the folders as
  buttons in a column); `>>` with the rest in a menu, or scrolling by the wheel; the bar's menu (Size..., Fill the rest,
  Overflow, Free space, Add a bar, Remove this bar; Side was taken out on 2026-11-12, dragging does it); dragging by the grip (the place it lands marked: before or
  after a bar, or a new line at a side) and by its end (the normal size); the Size window (not modal, so the window can
  be resized while the marks follow).
- The strip with the name, version and location box is gone: the version is in the window title
  (`Foldex 1.0.n - project`) and at the top of F1's list; the location box is the path bar. View > Bars on the ribbon:
  Add path bar, Add drives bar, Reset bars (also in F1), so a window without bars can get them back.
- Decided while building:
  - A size in buttons includes the bar's grip and padding, and the `>>` when there are more buttons than that: the
    drives example shows 6 drives and `>>` at its maximum. In a column the `>>` is a button high, so one more drive
    shows in its place when that is all that is left.
  - The shipped drives bar: min 2, normal 4, max 6, at most 30%, as the example of 3.1; the path bar fills, normal 300,
    min 120 px.
  - Bars are the same in every window; a change in one is written and every window draws it again.
  - Dragging uses marks of its own, not plan 01's dock marks: a bar lands in a line or a new line, not in an area.

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 131 (`BarsTests`: the shipped bars; yours replaces them; wrong entries reported and
  left out; writing keeps the file readable; the drives example (2 drives: normal, 10: max and `>>`, a window of 500
  px: 30%, of 100 px: min); a bar without a max above its normal does not grow; bars that fill share by their normals;
  one stops at its minimum while the other shrinks on; a line too short takes from the filling bars, then the others,
  then hides; what goes behind `>>`).
- Test copy over CDP: the default row (drives C: and D:, room for 4; the path filling the rest); drives made with
  `subst` came in by themselves (5 drives: the bar grew from 112 to 137 px, the path shrank), with 7 drives 6 and
  `>>`, its menu the seventh by name; a drive button took the tree to C:\ and framed C:; Side > Left: a column of
  drives (and `bars.json` written); a path bar at the right: the folders under each other; the Size window: its four
  marks in their colours on the drives bar, the 30% mark further along; Scroll: no `>>`, the wheel scrolls; the end
  dragged: the normal size written; the grip dragged onto the path bar's right half: the drives after the path; onto
  the bottom: a new line there; the `subst` drives removed: gone from the bar; Reset bars: your file removed, the
  shipped bars back.
- Not tried: a USB stick (the device message), a window narrowed by hand until the 30% cuts in (the rule is in the
  tests), dragging with a real mouse.

### 6.3 Changed (2026-11-12)

- The bar menu's Side is gone: a bar's side is set by dragging it.
- The share of the window takes a bar back to its normal size, not below it; below its normal size only a line too
  short shrinks it, after the bars that fill are at their minimum. So a growing window gives the drives their normal 4
  before the path that fills grows. Test (Jint): the drives and a filling path at 250, 274, 500 and 1000 px. Test copy
  with seven drives given to the page, the window resized from 1400 down to 314 px (the least Windows allows) and up to
  1600: the drives at 4 down to the smallest, the path taking the change; 5 and 6 above with the 30%.
- The change mode (the user's: the path box filled its bar, so its menu could not be reached, and the end that sets
  the size could not be seen): `bars.change` (View > Bars: Change bars; F1), a bar's right-click menu outside it
  (Change the bars, Reset the bars...); in it the bars outlined, the grips and splitters shown (a visible border at a
  bar's end, 6 px to grab), the content not responding, the bar's menu on a right-click anywhere on it (the path box
  included), a note at the foot with Done; Esc ends it, Ctrl+Z takes back the last change (each save in the mode keeps
  the bars before it). Test copy, real mouse and key events over CDP: outside the mode no grips or splitters and the
  short menu; in it a click on D: left the pane on C:\ (outside: it went to D:\); the path box's right-click gave the
  bar's menu; the drives' splitter dragged 80 px raised normal and max from 8 to 11; Ctrl+Z back to 8; Esc ended it
  (screenshot).
- The splitter made wider (12 px, a tinted band; the bar keeps room for it in the mode, so it covers no button), and
  Done at the end of the bar's menu in the mode, as LexPen's change mode menu. Test copy: the splitter 14 px wide with
  its border, starting after the last drive; the menu ending in Done.
