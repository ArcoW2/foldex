# Plan 13: Pane themes per branch

Status: executed; see 6. As built.

- 2026-11-11: draft.
- 2026-11-11: revised: a pane theme is a branch of the window theme, set colours or calculated ones; three settings with
  sliders defaulting in the middle; a root pane without children in the first pane theme.
- 2026-11-11: executed.
- 2026-11-11: revised and executed: the intensity feeds both mixes; a mix for the pane heads; both mixes 0 to
  100; the switch dropped (mix 0 is the same); the text on a head chosen by contrast.

Builds on plan 07 (themes, branch colours) and plan 03 (branches, the colour a parent takes from the path it
serves).

## 1. What this is about

A branch is one colour now (plan 07 3.2): the head, the focus ring, the tab and the branch marks show it, but inside
the pane everything is the window's theme. The background, the selected rows, the hovered row and the focused row's
outline look the same in every branch, so the only thing that tells two lists apart is a thin ring and a head.

A branch should have a style of its own, a pane theme, that is seen inside the pane as well: background, focus and
highlight all from that same pane theme.

## 2. The solution, in brief

A pane theme is a branch of the window theme, which each theme chooses to fit itself: at least a base colour, and
optionally its own background, selection, hover and so on. A colour it does not set is calculated from its base colour
and the window theme's own colours, so a pane's background stays close to the window's light or dark background. Three
settings, in this order: how intense the branch colours are, how much of that colour the pane heads and tabs take, and
how much of it the inside of a pane takes; for both mixes 0 is the window's colours and 100 the branch colour at its
intensity. The text on a head is whichever of the window's text and background colours stands out more. A pane draws itself in the pane theme of the path it serves (plan 03), a root pane
without children in the first one, by setting those colours on its own element, so everything inside it follows. The
background sliders keep working on top.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| `branches` entries | a colour, or an object with `base` and any of `bg`, `bgSide`, `select`, `hover` | 3.1; 6.1 |
| Calculated colours | the window's colour with a share of the base colour, per branch place, in `look.js` | 3.2; 6.1 |
| Settings | `paneThemeIntensity`, `paneHeadMix`, `paneThemeMix`, in the settings window's group Panes | 3.3; 6.3 |
| Head text | the window's text or background colour, whichever stands out more from the head | 3.3; 6.3 |
| Pane colours | per pane from its path's pane theme; a root pane without children in the first one; tabs and marks in the base colour | 3.4; 6.1 |
| Background sliders | working on the pane theme's background | 3.5 |
| Shipped themes reviewed | the first branch the theme's own accent | 3.6; 6.1 |

### Not yet built

## 3. Details

### 3.1 A pane theme is a branch of the window theme

The six `branches` of a window theme (plan 07 3.1) are its pane themes. An entry is a colour, as now (the base colour,
everything else calculated), or an object with a base colour and any of the pane's own colours:

```
"branches": [
  "#2f9e44",
  { "base": "#0969da", "bg": "#f3f8ff", "select": "#b6d7ff" },
  ...
]
```

The colours an entry can set: `base` (required), `bg`, `bgSide` (a tree's background), `select`, `hover`. A colour it
does not set is calculated (3.2). The theme chooses its pane themes to suit itself (3.6). A branch stays a place in
that list (plan 07 3.2), so changing the window theme restyles every branch at once.

### 3.2 The calculated colours

For each colour the pane theme does not set, from its base colour and the window theme, for the current mode:

- **Base colour**: the head, the focus ring, the tab and the branch marks; its strength set by the intensity setting
  (3.3).
- **Background** (`bg`, and `bgSide` for a tree): the window's colour with a share of the base colour, the share set
  by the mix setting (3.3). Kept close to the window's own light or dark background.
- **Selection** (`select`) and **hover** (`hover`): the window's colour with a larger share of the base colour than
  the background, so a selected row stays clearly visible on the tinted background.
- **Text, dim text, borders**: the window theme's, unchanged.

### 3.3 Settings

In the settings window, group Panes (as rows of `settingrows.js`, defaults in `defaults\settings.json`), in this
order:

- `paneThemeIntensity` (slider, 0 to 200%, default 100%): how intense every branch colour is. 100% the theme's colour
  as it is; toward 0% fainter, mixed toward the window's background; toward 200% stronger, mixed toward the window's
  text colour. The rings and marks show it as it is; the two mixes below start from it.
- `paneHeadMix` (slider, 0 to 100%, default 100%): the pane heads and tabs. 0% the window's colours (no colour
  difference), 100% the branch colour at its intensity; the shares a head and a tab already had (full when active, a
  tint otherwise) are multiplied by it.
- `paneThemeMix` (slider, 0 to 100%, default 8%): the inside of a pane (background, selection, hover, the focused
  row's outline). 0% the window's colours, 100% the branch colour at its intensity. Selection and hover take more of
  it than the background: at mix m a colour takes 1 - (1 - m)^w of the branch colour, w 1 for the background, 2 for
  hover, 5 for selection (at 8%: 8%, about 15%, about 34%). A colour the pane theme sets is used as it is, except at
  0%.

The text on an active head or tab is the window's text or background colour, whichever has the higher contrast with
the head as drawn, so a faint branch colour on a dark theme gets light text.

### 3.4 Applied per pane

`look.js` calculates each branch place's colours from the window theme and the settings. `app.js drawHeads` already
decides the colour of each pane (`Layout.pathColour`); it sets that place's colours on the pane element as the
variables the page already uses (`--bg`, `--bg-side`, `--select`, `--hover`) plus `--pane-colour` for the base colour.
CSS variables set on an element hold for everything inside it, so the rows, the selection, the hover, the focused
row's outline and the head pick them up without each rule changing. Tabs and branch marks take the base colour.

A root pane without children is the start of the first branch: it takes the first pane theme (now it has no branch
colour and shows the accent). Whether its background changes follows `paneThemeFollowsBranch`, as for every pane. A
root pane with children takes the pane theme of the path it serves, as every parent (plan 03).

`color-mix()` in CSS can do the mixing from the variables directly; where the calculation needs more than a mix (for
example keeping the background within a distance of the window's), it is done in `look.js`.

### 3.5 The background sliders

`paneBgFocused`, `paneBgBranch` and `paneBgOther` mix the pane's own background toward black or white. With pane
themes that background is the pane theme's (set or calculated), so the sliders keep working: they make a pane darker
or lighter, the pane theme gives its tint.

### 3.6 The shipped themes' pane themes

The branch colours of the shipped themes came from LexPen and the defaults, not chosen for each theme. Each theme's
list is reviewed: the first pane theme fits the theme itself (a dark green theme gets a slightly brighter green as its
first branch), the others are distinct from it and from each other, and readable on the theme's light or dark
background.

### 3.7 What does not work and why

- Separate pane theme files: the window theme would no longer decide what fits it, and a pane theme would have to be
  made for light and dark apart. An entry in the theme's own list, mostly a single colour, is enough.
- Restyling each CSS rule per branch (`.pane[data-branch="2"] .row.selected`): the rules multiply by six; the
  variables on the pane element need none.

### 3.8 Tests

- Under Jint (the `look.js` calculation, without DOM): for a light and a dark window theme, a base colour gives the
  window's own colours at mix -100 and more of the base colour at +100; intensity 100% gives the base colour as it
  is, 0% the window's background, 200% the window's text colour; mix 0 the window's colours, 100 the branch colour;
  a colour the pane theme sets is used as it is; the head mix as a factor.
- `ThemeFileTests`: a `branches` entry as a colour and as an object; an object without `base` reported as a problem;
  every settings row names a setting (existing test, now with the new rows).
- `PanesTests`: a root pane without children has the first branch's colour.
- Test copy: a tree with two branches; the background, the selected row and the hover of each list in its own pane
  theme; the parent in the colours of the path it serves; the sliders change it at once; light and dark themes.

## 4. Open questions

None.

## 6. As built

### 6.1 Built (2026-11-11, branch `plan01-foundation`)

- `ThemeFile.cs`: a `branches` entry is a colour or `{ "base": ..., "bg": ..., ... }` (`PaneColours`); `base` gives
  `--branch-N`, the others `--branch-N-bg`, `-bg-side`, `-select`, `-hover`. An entry without `base`, with a name that
  is not a pane colour, or with a value that is not a colour: reported, and the base theme's list used, as a wrong
  list was before.
- `look.js paneThemeVars`: per branch place, without DOM, the variables set on the root element: `--branch-N` at its
  intensity (`color-mix` toward `--bg` below 100%, toward `--fg` above); `--branch-N-bg`, `-bg-side`, `-select`,
  `-hover` the theme's own or `color-mix(base share%, var(--name))`; `--branch-N-accent` the base colour (the focused
  row's outline). With `paneThemeFollowsBranch` off these are the window's own (`var(--bg)`, ..., `var(--accent)`).
  While no theme has arrived, the base colours are read from `app.css`, so the variables are always there.
- `app.js drawHeads`: on each pane, besides `--branch`, the page's own `--bg`, `--bg-side`, `--select`, `--hover` and
  `--accent` as `var(--branch-N-...)`; every rule in the pane follows without a change in `app.css`. Defined on the
  root, those variables refer to the root's `--bg`, so the pane's own `--bg` makes no cycle.
- `panes.js pathColour`: a root without children gives 0, the first branch. The head menu's colour swatch for such a
  root: `var(--branch-0)` (it was the accent).
- Shipped themes: every theme with an accent of its own got a `branches` list: its accent first, then its base's
  (`light` or `dark`) without the colour nearest to the accent in hue. `light`, `dark` and `black` (no accent of its
  own) are unchanged: their first branch already fits.
- Decided during the build: the new hints in `settingrows.js` have no apostrophes (an escaped one was lost on the way
  and broke the file; `EverySettingsRowNamesASetting` caught it).

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 101 (`LookTests`: defaults, mix -100 and +100, intensity 0, 50 and 200, a set colour
  not mixed, following off; `ThemeFileTests`: an entry as a colour and as an object, three wrong entries reported;
  `PanesTests`: a root without children in branch 0, a root with children in the colour of its path).
- Revised (6.3): `LookTests` rewritten for the scales of 6.3; Failed 0, Passed 101.
- A test copy over CDP: the default layout's tree and list tinted in branch 0; a second child of the tree below it in
  branch 1, the tree in branch 1's colour while that child had the keyboard; dark and light; Light seafoam with its
  green as branch 0; mix -100 and following off gave the window's own backgrounds, intensity 0 a base colour equal to
  the background. Screenshots of dark and Light seafoam looked at. Hover was not looked at by hand.

### 6.3 Revised (2026-11-11): intensity first, a head mix, both mixes 0 to 100

- The settings, in this order: `paneThemeIntensity`, `paneHeadMix` (new), `paneThemeMix` (now 0 to 100, default 8,
  the background's share at the old default). `paneThemeFollowsBranch` dropped: mix 0 is the same.
- `look.js`: the inside mixes `var(--branch-N)` (the colour at its intensity), no longer the theme's colour as it is;
  shares by the weights of 3.3. `--head-mix` (0 to 1) multiplies each head's and tab's share in `app.css` with
  `calc()`, so a tab keeps its 18% and 45% and a head its 22%, 55% and full. `applyHeadText` resolves each branch's
  active head colour on a hidden element and sets `--branch-N-text`; `drawHeads` puts it on panes and tabs as
  `--branch-text`.
- Test copy over CDP: dark with intensity 40 and 10 and head mix 30 gave light text, the defaults dark text on the
  full colour; light with intensity 10 dark text, 200 light text. Head mix 0 drew every head in the window's bar
  colour; mix 0 the window's backgrounds; mix 100 at intensity 50 the branch colour at half. Screenshot of dark at
  intensity 30 looked at: the light text on the faint red head reads.
