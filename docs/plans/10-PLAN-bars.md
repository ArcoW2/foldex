# Plan 10: Bars

Status: draft 2026-11-10; not started.

## 1. What this is about

Besides the ribbon, Foldex has one fixed strip at the top: the name, the version and the location box. Other things
an explorer keeps at hand, such as a button per drive, have no place, and what is there cannot be moved, resized or
left out. xplorer2 has toolbars, a drive bar and an address bar, each fixed in its kind of place.

## 2. The solution, in brief

Bars: strips of one kind each (the full path, the drives, later more) that you place in rows above the panes, in any
order, several in a row. Each bar has a width mode: a width you set, filling the rest of its row, or growing with its
content (as the drives bar does when a USB stick comes in) between a minimum and a maximum. The layout is a file of
its own, `bars.json`, as `ribbon.json`; you change it in the window by dragging a bar's edge and through a bar's
right-click menu, and Foldex writes your copy.

## 3. Details

### 3.1 Terms

- **Bar**: one strip of one kind, with its settings. A kind can be in the layout more than once (two path bars are
  not useful, two button bars are).
- **Row**: a horizontal line of bars, above the panes, under the ribbon. Rows stack; an empty row goes away.
- **Width mode**:
  - `fixed`: the width you set (in px at 100% scaling), by dragging the bar's right edge or in its menu;
  - `fill`: the rest of the row (shared equally when more than one bar of the row fills);
  - `content`: as wide as its content needs, at least `min` and at most `max`; it grows and shrinks as the content
    changes. When the row is too narrow, `fill` bars give way first, then `content` bars down to their `min`.
- Content that does not fit a bar's width: open question 2.

### 3.2 The first kinds

- **Path**: the full path of the active pane, editable (what the location box does now: Enter goes there through the
  parent, plan 03 3.3). Default `fill`.
- **Drives**: a button per drive in This PC, by letter (as the tree sorts them): letter, label in the tooltip, an
  optional thin free-space mark. A click: the active pane's parent goes to that drive, as a typed path. Drives that
  come or go (a USB stick, a mapped drive) are added or taken away at once (the host listens to Windows' device
  messages). Default `content`, min one button, max [open question 1].
- Later kinds, each with its own plan when chosen (`docs/xplorer2-features.md`): bookmarks, a quick filter, user commands, the status line.
- The name and version move to the window title and F1's About; the strip they are in now becomes the default first
  row: drives, path.

### 3.3 The file and changing it in the window

- `defaults\bars.json` ships with Foldex; your `bars.json` in the data folder replaces it whole (as `ribbon.json`).
  A row is a list of bars; a bar is `{ "kind": "drives", "width": "content", "min": 40, "max": 400 }` or
  `{ "kind": "path", "width": "fill" }` or `{ "kind": "path", "width": 300 }`.
- In the window: drag a bar's right edge to make it `fixed` at that width; a bar's right-click menu: width mode, min
  and max for `content`, move left / right / to the row above or below, remove, add a bar of a kind. Every change is
  written to your `bars.json` (made from the shipped one on the first change) and applies in every window.
- A wrong entry in a hand-edited file is reported in the status line and left out, as with keys and the ribbon.

### 3.4 Where it lives

- Bars are the same in every window for now; with projects (plan 01 3.5) a project may get a layout of its own.
- The page draws the rows (`web/bars.js`); the host reads and writes the file (`BarsFile.cs`, as `RibbonFile.cs`)
  and tells of drives that come and go.

### 3.5 Tests

- Unit (`BarsFile`): defaults and yours (yours replaces), a wrong kind or width reported and skipped, writing keeps
  the file readable.
- Unit (page code under Jint, as `panes.js`): the width rules of 3.1: fixed, fill shared, content between min and max,
  who gives way when the row is too narrow.
- In the test copy: the default rows (drives, path); a drive mapped with `subst` appears in the drives bar and the
  bar grows; dragging the path bar's edge makes it fixed and writes `bars.json`; moving a bar to a new row; a drive
  button takes the tree there.

## 4. Open questions

1. **The maximum of a growing bar.** In px, as a share of the row's width (for example at most half), or both (the
   smaller wins)? The share keeps working when the window is made narrow; px is simpler to set.
2. **Content wider than its bar** (a fixed drives bar with more drives than fit, a growing one at its maximum):
   a `>>` button at the end with the rest in a menu (as toolbars), a second line inside the bar, or scrolling?
3. **Rows below the panes, or bars beside them** (left or right, vertical)? Above only keeps it simple; below suits
   a status line as a bar.

## 5. As built

Not built yet.
