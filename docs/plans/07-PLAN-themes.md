# Plan 07: Themes and branch colours

Status: draft 2026-11-10; not started. Takes the themes row of plan 01 3.3 out into a plan of its own.

## 1. What this is about

Foldex's colours are fixed in `web/app.css`: one light and one dark block, each with the page colours and six branch
colours, which are named (`blue`, `red`, ...) in `web/panes.js`. You cannot pick another look, and a branch is
stored by a colour name, so a theme cannot change what the branches look like without the names lying.

## 2. The solution, in brief

Themes as in LexPen, cut down to what an explorer needs: a theme is a JSON file with a name, an optional base theme
and only the colours that differ from it, plus an ordered list of branch colours. Light and dark are the shipped
roots and set everything. Settings `themeLight` and `themeDark` pick the theme per mode. A branch is a place in the
theme's list (the first, second, ... colour), not a colour name, so switching theme recolours every branch at once.

## 3. Details

### 3.1 A theme file

`defaults\themes\*.json` ship with Foldex; your own go in `themes\` in the data folder, and a file with the same name
replaces a shipped one (as LexPen's `ThemeFile`).

```
{
  "name": "Dark ocean",
  "description": "blue tint",
  "base": "dark",
  "colors": { "bg": "#161c27", "head": "#1b2230", "selected": "#2a4a7a" },
  "branches": ["#6aa8ff", "#ff7b72", "#56d364", "#e3b341", "#bc8cff", "#39c5bb"]
}
```

- **Colours**: the CSS variables of the light block of `app.css` without the dashes (`bg`, `fg`, `muted`, `line`,
  `head`, `hover`, `selected`, `focus`, `warn`; a later variable is a theme colour by being added there). No editor
  colours: Foldex has no editor. Viewers (plan 04) add theirs when they come.
- **Branches**: the list, in order. A theme without one takes its base's list whole; lists are not merged per entry.
- **Base**: any other theme, through its own base and so on; a cycle or a missing base is reported and the mode's
  root is used. A wrong colour name or value is reported and skipped.
- A theme is not light or dark itself: the mode that chose it is.

### 3.2 Branches as places in the list

- `panes.js` keeps a branch as a number (0, 1, 2, ...) instead of a name. `newColour` picks the lowest number no
  connection has, else the one used least, counting up to the length of the active theme's list.
- The page draws branch `n` with `--branch-<n>`, set from the theme's list. A number beyond the list (a project saved
  under a theme with a longer list) wraps round the list.
- The tooltip on a head's mark says "branch 2" with the colour swatch, not a colour name.
- Projects (plan 01 3.5) save the numbers, so a layout keeps its branches under any theme.

### 3.3 Choosing and applying

- Settings `themeLight` (default `light`) and `themeDark` (default `dark`), next to `followWindows` and `theme` that
  already decide the mode.
- The host reads the themes (`ThemeFile.cs`, from LexPen's, without the code colours and the renamed list), resolves
  the chain and hands the page the complete set of variables for the mode in force, on start and whenever the mode,
  the settings or a theme file change.
- Choosing: action `theme.choose` with a variant per theme in F1, and a drop-down on the View tab once the ribbon has
  drop-downs (plan 01 5.3). Choosing writes `themeLight` or `themeDark` (the mode in force) to your settings.json.

### 3.4 Shipped themes

`light` and `dark` (today's colours, the branch lists as today's six), plus a few tinted ones to copy from, as
LexPen's examples. Which ones: open question 2.

### 3.5 What is left out

- The theme colours window (LexPen's `ThemeColoursForm`): editing a theme is editing its JSON for now.
- Theme sets: open question 1.

### 3.6 Tests

- Unit (`ThemeFileTests`): the names come from `app.css`; a theme's chain (own colours win, then the base's); a
  missing or cyclic base falls back to the root; a wrong name or value reported and skipped; a theme without
  `branches` takes its base's list; your file replaces a shipped one.
- Unit (`PanesTests`): a further child gets the lowest free number; with all numbers taken, the one used least;
  JSON keeps the numbers.
- In the test copy: a theme with its own branch list recolours the heads of open panes; switching Windows to dark
  changes theme; choosing a theme from F1 writes the setting.

## 4. Open questions

1. **Theme sets.** In LexPen a set combines the look settings and is chosen per project or per virtual desktop. In
   Foldex the look is two settings, so a set adds little until projects exist. Leave sets out until projects (plan 01
   3.5), or build them now?
2. **Which tinted themes to ship**, besides light and dark: LexPen's tints carried over (ocean, forest, wine,
   parchment, sand, ... in both modes), only a couple, or none for now?
3. **The length of the branch list.** Six as today, or another number? More colours means more branches told apart,
   but the colours get harder to tell from each other on a pane head.

## 5. As built

Not built yet.
