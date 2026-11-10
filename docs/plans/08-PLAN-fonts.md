# Plan 08: Fonts for the window and the panes

Status: draft 2026-11-10; executed 2026-11-10, revised and executed 2026-11-10 (icons that grow with the rows); see 6. As built.

## 1. What this is about

Foldex draws everything in Segoe UI at 13 px, fixed in `web/app.css`, and the rows of a pane are a fixed 22 px high.
You cannot choose a font or a size, not for the window and not for what the panes list, and a long list cannot be
made smaller to see more of it, or larger to read it better.

## 2. The solution, in brief

Two fonts in the settings, as LexPen's app and editor fonts: one for the window (ribbon, pane heads, location box,
status line, settings window) and one for the inside of the panes (the rows of trees and lists), each a font and a
size. Ctrl+mouse wheel over any pane changes the pane size, for all panes alike, and keeps it as the setting. Rows
and their icons grow and shrink with the pane font.

## 3. Details

### 3.1 The settings

| Setting | Default | What |
|---|---|---|
| `appFont` | `""` (Segoe UI) | The window: ribbon, pane heads, location box, status line, F1, the settings window |
| `appSize` | `10` | In points, 4 to 36 |
| `paneFont` | `""` (Segoe UI) | The rows of every pane: trees and lists |
| `paneSize` | `10` | In points, 4 to 36; also Ctrl+mouse wheel |

- A font name is one of the installed families. The host lists them (`Fonts.cs`, from LexPen's, without the
  monospaced mark, which an explorer does not need) for the settings window.
- A font that is not installed (a settings.json from another PC) falls back to Segoe UI, as CSS does by itself.
- The preview pane (plan 04) shows Windows' preview handlers, which draw their own fonts: not affected.

### 3.2 The settings window

- A row kind `font`: a list of the installed families, each shown in itself, with "Segoe UI (default)" first.
- A row kind `size`: a number box in points, 4 to 36, steps of 0.5. A size outside that in a hand-edited settings.json is held to it; 0 (an older default) counts as 10.
- The four rows in a group "Fonts".

### 3.3 Ctrl+mouse wheel

- Over any pane (tree or list), Ctrl+wheel up makes `paneSize` one point larger, down one smaller, between 4 and 36
  points. All panes change together, in every window: it is the setting, written to your settings.json.
- Writing is held back until the wheel rests (as LexPen's sliders), so a fast turn does not write the file at every
  step; the panes follow at once.
- The browser's own Ctrl+wheel zoom is off already (`IsZoomControlEnabled` false), so the page itself does not zoom.

### 3.4 Rows that follow the font

- The row height is measured from the pane font (its line height plus padding) instead of the fixed 22 px, in the CSS
  (a variable) and in the code that places rows in long lists (only rows in view are drawn).
- Icons grow with the rows: drawn at a size that follows the row height (16 px up to 20, then the row height times
  16 / 22, at most 48), from the system's 16, 32 or 48 px icon: the smallest not smaller than drawn, so the browser
  only scales down and the edges stay sharp. The system's image lists of those sizes hold the same icons under the
  same index, so a size is one more request per icon, made only for the rows in view; while it comes, the icon of
  another size stands in. The 256 px list is left out: many types have only a small icon in the middle of it.
- The scroll position keeps the focused row in view when the size changes.

### 3.5 Tests

- Unit: the four settings in `settingrows.js` and the defaults (the existing check); `Fonts.List` returns families
  without the vertical `@` variants.
- In the test copy: a pane font chosen in the settings window changes the rows and not the ribbon; an app font the
  ribbon and not the rows; Ctrl+wheel over a list makes every pane's rows larger, the row height following, and
  settings.json holds the new `paneSize` once the wheel rests; at 4 and 36 points the wheel stops.

## 4. Open questions

None.

## 5. Status

### Built

- The settings `appFont`, `appSize`, `paneFont`, `paneSize` (3.1).
- The settings window's rows `font` and `size`, in a group Fonts (3.2).
- Ctrl+mouse wheel over a pane, written once the wheel rests (3.3).
- Rows that follow the pane font; icons that grow with the rows from the 16, 32 or 48 px source (3.4).

### Not yet built

Nothing.

## 6. As built

### 6.1 Built (2026-11-10, branch `plan01-foundation`)

- `Fonts.cs` (LexPen's, without the monospaced mark); the settings window asks for the list (`fonts`), built on another
  thread.
- `defaults/settings.json`: `appFont`, `appSize`, `paneFont`, `paneSize` in a Fonts group; `web/settingrows.js` with the
  row kinds `font` (the families, each drawn in itself, "Segoe UI (default)" first) and `size` (a number box, 4 to 36,
  steps of 0.5).
- Changed after use (2026-11-10): the sizes default to 10 pt instead of 0 ("the default"), and the least size is
  4 pt for the box and the wheel (the box's up arrow from 0 gave 0.5); look.js holds any stored size between 4 and
  36.
- `web/look.js` `applyFonts`: CSS variables `--app-font`, `--app-size`, `--pane-font`, `--pane-size`, `--row-height`;
  the row height is the pane font size times 22 / 13 (today's 22 px at 13 px), at least 16 px.
- `app.css`: the page in the window font, inputs and buttons inheriting it, the pane bodies in the pane font, rows of
  `--row-height`; the small texts (ribbon group names, link marks) and the size and date columns in `em`, so they
  scale with their font.
- `app.js`: `RowHeight` follows the setting; a change draws every tree and list again, the same rows at the top and
  the focused one in view; Ctrl+mouse wheel over a tree or list (not the preview) one point up or down, 4 to 36,
  written after 200 ms of rest.
- Icons (3.4): `ShellIcons.Png(index, size)` from the small, large or extra large system image list
  (`SHGetImageList`), the `icons` op with a size; the page keeps icons per size and index, `--icon-size` in the CSS.
- Found on the way and fixed: the tree's focused folder ended up just below the bottom edge at the start (the status
  line came in after the tree had scrolled); a tree made shorter keeps its focused folder in view.

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 78 (`FontsTests`: Segoe UI there, no `@` families; the rows check covers the four
  settings).
- A test copy over CDP: three Ctrl+wheel steps up over the list made the rows 29 px and the font 17 px at once, the
  ribbon stayed 13 px, settings.json got `"paneSize": 12.75` after the wheel rested; forty steps down stopped at 6 pt
  (16 px rows). In the settings window (groups General, Fonts, Panes): Consolas as pane font changed the rows only; 12
  pt as window size changed the ribbon, the location box and the settings window to 16 px. `PrintWindow` of both
  windows: the Fonts rows with Reset on the changed size; Consolas rows at a large size with the dates whole after the
  `em` fix (before it they were cut off). (This test ran before the least size became 4 pt, 6.1.)
- Icons: in C:\Windows\System32 at 10 pt the first build drew 17 px icons from the 32 px source; changed then to keep
  the 16 px icon as it is below 20 px (that case not measured again). Twelve Ctrl+wheel steps up made them 36 px from
  the 48 px source, more steps 48 px; `PrintWindow` showed sharp folder, exe and dll icons at that size.