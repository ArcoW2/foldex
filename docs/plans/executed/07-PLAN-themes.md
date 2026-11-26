# Plan 07: Themes, branch colours and the settings window

Status: executed; see 6. As built.

- 2026-11-10: draft.
- 2026-11-10: revised: no theme sets, every LexPen theme, six branch colours, the settings window.
- 2026-11-10: executed.

Takes the themes row and the settings window of plan 01 3.3 out into a plan of their own.

## 1. What this is about

Foldex's colours are fixed in `web/app.css`: one light and one dark block, each with the page colours and six branch
colours, which are named (`blue`, `red`, ...) in `web/panes.js`. You cannot pick another look, and a branch is
stored by a colour name, so a theme cannot change what the branches look like without the names lying. And there is
no settings window: a setting is changed by editing settings.json by hand or by one of the few actions that write one.

## 2. The solution, in brief

Themes as in LexPen, cut down to what an explorer needs: a theme is a JSON file with a name, an optional base theme
and only the colours that differ from it, plus an ordered list of six branch colours. Every LexPen theme is carried
over, with its app colours only. Settings `themeLight` and `themeDark` pick the theme per mode; one theme colours the
whole window. A branch is a place in the theme's list (the first, second, ... colour), not a colour name, so changing
theme recolours every branch at once. A settings window as LexPen's shows every setting as a row; a change applies at
once in every Foldex window.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Theme files | name, base, the colours that differ, six branch colours; yours replacing shipped ones | 3.1 |
| Branches | places 0 to 5 in the theme's list | 3.2 |
| Applying | `themeLight` and `themeDark`, the host resolving every chain, a change applied at once in every window, problems in the status line | 3.3 |
| Shipped themes | every LexPen theme, `light` and `dark` as the roots | 3.4 |
| Settings window | | 3.5 |
| Light / dark switch | the sun / moon at the right of the ribbon's tabs; to the mode Windows has: following Windows again | 3.3; 6.1 |

### Not yet built

## 3. Details

### 3.1 A theme file

`defaults\themes\*.json` ship with Foldex; your own go in `themes\` in the data folder, and a file with the same name
replaces a shipped one (as LexPen's `ThemeFile`).

```
{
  "name": "Dark ocean",
  "description": "blue tint",
  "base": "dark",
  "colors": { "bg": "#161c27", "bgBar": "#202839", "select": "#2a4a7a" },
  "branches": ["#6aa8ff", "#ff7b72", "#56d364", "#e3b341", "#bc8cff", "#39c5bb"]
}
```

- **Colours**: LexPen's names for the colours an explorer uses: `bg`, `bgSide` (the folder tree), `bgBar` (pane heads,
  the ribbon), `fg`, `fgDim`, `border`, `accent`, `hover`, `select`, `warning`. They are the CSS variables of the
  first block of `app.css` without the dashes (`--bg-side` is `bgSide`); a later variable is a theme colour by being
  added there. No editor colours: Foldex has no editor. Viewers (plan 04) add theirs when they come.
- **Branches**: six colours, in order. A theme without a list takes its base's whole; lists are not merged per entry.
  A list of another length is reported and the base's is used.
- **Base**: any other theme, through its own base and so on; a cycle or a missing base is reported and the mode's
  root (`light`, `dark`) is used. A wrong colour name or value is reported and skipped.
- `light` and `dark` are the roots: they set every colour and the branch list.
- A theme is not light or dark itself: the mode that chose it is.

### 3.2 Branches as places in the list

- `panes.js` keeps a branch as a number (0 to 5) instead of a name; `newColour` picks the lowest number no connection
  has, else the one used least.
- The page draws branch `n` with `--branch-<n>`, set from the theme's list.
- The mark on a head says "Switch to branch 2", not a colour name.
- Projects (plan 01 3.5) save the numbers, so a layout keeps its branches under any theme.

### 3.3 Applying

- Settings `themeLight` (default `light`) and `themeDark` (default `dark`), next to `followWindows` and `theme` that
  already decide the mode. One theme for the whole window: no separate themes for parts of it, no theme sets.
- The host (`ThemeFile.cs`, from LexPen's, without the code colours, the renamed list and the theme sets) reads the
  themes, resolves each chain and sends the page every theme complete, as CSS variables, with the settings. The page
  picks the theme of the mode in force, so a switch of Windows between light and dark needs nothing from the host.
- A change of settings.json or of a theme file in the data folder (by hand, or by the settings window) is sent to
  every window again, and applies at once.
- Problems (a wrong base, name or value) show in the status line with the settings' problems.
- **The light / dark switch** (as LexPen's Day / night): a moon in light mode, a sun in dark mode, at the right of the
  ribbon's tabs; also the action `theme.toggle`. A click gives every window the other mode. When that is the mode
  Windows has, `followWindows` goes on again, so Foldex changes with Windows from then on; else `followWindows` goes
  off and `theme` keeps the mode. Unlike LexPen, where the switch while following Windows lasts only until Windows
  changes mode and is not kept.

### 3.4 Shipped themes

Every LexPen theme, light and dark, with its name and description: the colours of 3.1 that it sets, nothing else.
`light` and `dark` take LexPen's colours too, and the branch lists Foldex has now.

### 3.5 The settings window

As LexPen's (`SettingsForm.cs`, `web/settings.html`, `settings.js`), cut down:

- One window for Foldex, not modal, opened by the action `settings.open` (F1, the ribbon: View > Foldex > Settings);
  opening it again brings it to the front.
- A row per setting, in groups (General, Panes), with a search box that filters the rows. A row: its title, a hint,
  the control, and a mark when the value is yours (differs from the default); a reset button puts the default back.
- Controls: a switch for true / false; a list for a choice (the mode; a theme, the list showing each theme's name and
  description, yours marked).
- The rows are described once, in `web/settingrows.js`; the window and the tests read them there.
- A change goes to the host, which writes your settings.json and sends the new settings to every window (the settings
  window too). The window's colours are the theme's, as the main windows.
- "Open settings.json" opens your file in the program Windows has for it (creating it when there is none).
- Left out: LexPen's layers (window, theme set, screen), file types, fonts, sliders, colour pickers.

### 3.6 What is left out

- The theme colours window (LexPen's `ThemeColoursForm`): editing a theme is editing its JSON.
- Theme sets: one theme for the window is enough.
- A theme of its own per project: with projects, if wanted.

### 3.7 Tests

- Unit (`ThemeFileTests`): the names come from `app.css`; a theme's chain (own colours win, then the base's); a
  missing or cyclic base falls back to the root; a wrong name or value reported and skipped; a theme without
  `branches` takes its base's list, one of the wrong length is reported; your file replaces a shipped one; every
  shipped theme loads without problems and `light` and `dark` set every name.
- Unit (`PanesTests`): a further child gets the lowest free number; with all taken, the one used least.
- Unit (`KeysAndRibbonTests`): every row of `settingrows.js` names a setting of the default settings.json.
- In the test copy: choosing a theme in the settings window recolours the main window and the settings window, the
  branch heads included; a change of followWindows or theme switches mode; a theme file of your own dropped in the
  data folder shows in the list; your settings.json gets the value.

## 4. Open questions

None.

## 6. As built

### 6.1 Built (2026-11-10, branch `plan01-foundation`)

- `ThemeFile.cs`: names from the first `:root` block of `app.css`, the chain, branch lists, problems; `Load` reads the
  shipped themes and yours and resolves every one to CSS variables (`--branch-0` to `--branch-5` for the list).
- `defaults/themes/`: every LexPen theme, generated from LexPen's files: the colours of 3.1 each sets, its name,
  description and base; `light` and `dark` with LexPen's colours and the six branch colours Foldex had.
- `app.css`: LexPen's names (`--bg-side`, `--bg-bar`, `--fg-dim`, `--border`, `--accent`, `--select`, `--warning`
  instead of `--head`, `--muted`, `--line`, `--focus`, `--selected`, `--warn`); the light and dark blocks equal
  `light.json` and `dark.json` (a test keeps them so); the folder tree on `bgSide`.
- `web/look.js` applies mode and theme, in the main page and the settings window. `panes.js` keeps branches as
  numbers 0 to 5; a mark's tooltip says "Switch to branch n".
- `AppHost`: `SetSetting` writes and tells every window and the settings window (`settings` event with settings and
  themes); your settings.json and `themes\*.json` are watched (two watchers, the change applied once the writing has
  rested for 300 ms).
- The settings window: `SettingsForm.cs`, `web/settings.html`, `settings.js`, `settings.css`, rows in
  `web/settingrows.js`; action `settings.open` on View > Foldex. No key: LexPen has none either.
- README: a Themes section with the colour names (the theme files point to it).

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 77 (`ThemeFileTests`: names, chain, missing and circular base, wrong name, value and
  branch list, yours replacing a shipped one, every shipped theme without problems, the roots complete, app.css equal
  to the roots, every settings row a setting; `PanesTests`: numbered branches, the one used least).
- A test copy over CDP: the page came up dark with the dark theme (18 themes known); Settings opened its window with
  the five rows; choosing Dark ocean recoloured both windows and wrote only `"themeDark": "dark-ocean"`; a theme file
  dropped in the test copy's `themes\` showed in the list as "My test (yours)" without a restart; chosen, the heads of
  two branches took its first two branch colours; followWindows off switched to light and back on to dark.
  `PrintWindow` of the main window showed the ocean colours, the tree on its side colour, and the two branch colours.
- The light / dark switch in a test copy, Windows dark: a click went light with `followWindows` off, the moon shown;
  a second click went dark with `followWindows` on again, the sun shown; the button at the right end of the tab row.
- Not tried: the settings window drawn (the shot helper takes the main window only), "open settings.json" (it starts
  your editor).
