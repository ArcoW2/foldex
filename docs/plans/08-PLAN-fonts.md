# Plan 08: Fonts for the window and the panes

Status: draft 2026-11-10; not started.

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

Not built yet.
