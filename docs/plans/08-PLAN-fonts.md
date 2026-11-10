# Plan 08: Fonts for the window and the panes

Status: draft 2026-11-10; executed 2026-11-10 with 16 px icons (open question 1 still open); see 5. As built.

## 1. What this is about

Foldex draws everything in Segoe UI at 13 px, fixed in `web/app.css`, and the rows of a pane are a fixed 22 px high.
You cannot choose a font or a size, not for the window and not for what the panes list, and a long list cannot be
made smaller to see more of it, or larger to read it better.

## 2. The solution, in brief

Two fonts in the settings, as LexPen's app and editor fonts: one for the window (ribbon, pane heads, location box,
status line, settings window) and one for the inside of the panes (the rows of trees and lists), each a font and a
size. Ctrl+mouse wheel over any pane changes the pane size, for all panes alike, and keeps it as the setting. Rows
grow and shrink with the pane font.

## 3. Details

### 3.1 The settings

| Setting | Default | What |
|---|---|---|
| `appFont` | `""` (Segoe UI) | The window: ribbon, pane heads, location box, status line, F1, the settings window |
| `appSize` | `0` (9.75 pt, today's 13 px) | In points |
| `paneFont` | `""` (Segoe UI) | The rows of every pane: trees and lists |
| `paneSize` | `0` (9.75 pt) | In points; also Ctrl+mouse wheel |

- A font name is one of the installed families. The host lists them (`Fonts.cs`, from LexPen's, without the
  monospaced mark, which an explorer does not need) for the settings window.
- A font that is not installed (a settings.json from another PC) falls back to Segoe UI, as CSS does by itself.
- The preview pane (plan 04) shows Windows' preview handlers, which draw their own fonts: not affected.

### 3.2 The settings window

- A row kind `font`: a list of the installed families, each shown in itself, with "Segoe UI (default)" first.
- A row kind `size`: a number box in points, with 0 meaning the default; steps of 0.5.
- The four rows in a group "Fonts".

### 3.3 Ctrl+mouse wheel

- Over any pane (tree or list), Ctrl+wheel up makes `paneSize` one point larger, down one smaller, between 6 and 36
  points. All panes change together, in every window: it is the setting, written to your settings.json.
- Writing is held back until the wheel rests (as LexPen's sliders), so a fast turn does not write the file at every
  step; the panes follow at once.
- The browser's own Ctrl+wheel zoom is off already (`IsZoomControlEnabled` false), so the page itself does not zoom.

### 3.4 Rows that follow the font

- The row height is measured from the pane font (its line height plus padding) instead of the fixed 22 px, in the CSS
  (a variable) and in the code that places rows in long lists (only rows in view are drawn).
- Icons are 16 px (the system's small icons) at any size for now: open question 1.
- The scroll position keeps the focused row in view when the size changes.

### 3.5 Tests

- Unit: the four settings in `settingrows.js` and the defaults (the existing check); `Fonts.List` returns families
  without the vertical `@` variants.
- In the test copy: a pane font chosen in the settings window changes the rows and not the ribbon; an app font the
  ribbon and not the rows; Ctrl+wheel over a list makes every pane's rows larger, the row height following, and
  settings.json holds the new `paneSize` once the wheel rests; at 6 and 36 points the wheel stops.

## 4. Open questions

1. **Larger icons.** At a large pane size, 16 px icons look small. Use the system's 32 px icons above some row
   height, or keep 16 px always for now?

## 5. As built

### 5.1 Built (2026-11-10, branch `plan01-foundation`)

- `Fonts.cs` (LexPen's, without the monospaced mark); the settings window asks for the list (`fonts`), built on another
  thread.
- `defaults/settings.json`: `appFont`, `appSize`, `paneFont`, `paneSize` in a Fonts group; `web/settingrows.js` with the
  row kinds `font` (the families, each drawn in itself, "Segoe UI (default)" first) and `size` (a number box, 0 to 36,
  steps of 0.5).
- `web/look.js` `applyFonts`: CSS variables `--app-font`, `--app-size`, `--pane-font`, `--pane-size`, `--row-height`;
  the row height is the pane font size times 22 / 13 (today's 22 px at 13 px), at least 16 px.
- `app.css`: the page in the window font, inputs and buttons inheriting it, the pane bodies in the pane font, rows of
  `--row-height`; the small texts (ribbon group names, link marks) and the size and date columns in `em`, so they
  scale with their font.
- `app.js`: `RowHeight` follows the setting; a change draws every tree and list again, the same rows at the top and
  the focused one in view; Ctrl+mouse wheel over a tree or list (not the preview) one point up or down, 6 to 36,
  written after 200 ms of rest.
- Found on the way and fixed: the tree's focused folder ended up just below the bottom edge at the start (the status
  line came in after the tree had scrolled); a tree made shorter keeps its focused folder in view.

### 5.2 How it was tested

- `dotnet test`: Failed 0, Passed 78 (`FontsTests`: Segoe UI there, no `@` families; the rows check covers the four
  settings).
- A test copy over CDP: three Ctrl+wheel steps up over the list made the rows 29 px and the font 17 px at once, the
  ribbon stayed 13 px, settings.json got `"paneSize": 12.75` after the wheel rested; forty steps down stopped at 6 pt
  (16 px rows). In the settings window (groups General, Fonts, Panes): Consolas as pane font changed the rows only; 12
  pt as window size changed the ribbon, the location box and the settings window to 16 px. `PrintWindow` of both
  windows: the Fonts rows with Reset on the changed size; Consolas rows at a large size with the dates whole after the
  `em` fix (before it they were cut off).