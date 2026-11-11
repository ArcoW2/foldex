# Plan 13: Pane themes per branch

Status: not started.

- 2026-11-11: draft.
- 2026-11-11: revised: a pane theme is a branch of the window theme, set colours or calculated ones; three settings with
  sliders defaulting in the middle; a root pane without children in the first pane theme.

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
settings: whether the inside of a pane follows its pane theme at all, how much the base colour weighs against the
window colours in the calculated colours, and how intense the base colour (head, ring, tab, marks) is; both sliders
have their default in the middle. A pane draws itself in the pane theme of the path it serves (plan 03), a root pane
without children in the first one, by setting those colours on its own element, so everything inside it follows. The
background sliders keep working on top.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| `branches` entries | a colour, or an object with its own colours | -- | 3.1 |
| Calculated colours | from the base colour and the window theme | -- | 3.2 |
| Settings | `paneThemeFollowsBranch`, `paneThemeMix`, `paneThemeIntensity` | -- | 3.3 |
| Pane colours | per pane from its path's pane theme; a root pane without children in the first one; tabs and marks in the base colour | -- | 3.4 |
| Background sliders | on the pane theme's background | -- | 3.5 |
| Shipped themes reviewed | their pane themes, the first fitting the theme | -- | 3.6 |

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

In the settings window, group Panes (as rows of `settingrows.js`, defaults in `defaults\settings.json`):

- `paneThemeFollowsBranch` (toggle, default on): on, the inside of a pane is its pane theme's (set or calculated);
  off, the inside is the window theme's and only the base colour shows the branch (as now).
- `paneThemeMix` (slider, -100 to +100, default 0): how much the base colour weighs against the window colour in the
  calculated colours. 0 is the calculation as tuned; toward -100 the window's colours, -100 the window's own; toward
  +100 more of the base colour. Colours a pane theme sets itself are not mixed.
- `paneThemeIntensity` (slider, 0 to 200%, default 100%): how intense the base colour is. 100% the theme's colour as
  it is; toward 0% fainter, mixed toward the window's background; toward 200% stronger, mixed toward the window's text
  colour.

The fixed shares behind mix 0 (for the background, and the larger ones for selection and hover) are [not yet
decided]; they are tuned in a test copy against the light and dark themes.

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
  is, 0% the window's background, 200% the window's text colour; a colour the pane theme sets is used as it is;
  `paneThemeFollowsBranch` off gives the window's colours inside.
- `ThemeFileTests`: a `branches` entry as a colour and as an object; an object without `base` reported as a problem;
  every settings row names a setting (existing test, now with the new rows).
- `PanesTests`: a root pane without children has the first branch's colour.
- Test copy: a tree with two branches; the background, the selected row and the hover of each list in its own pane
  theme; the parent in the colours of the path it serves; the sliders change it at once; light and dark themes.

## 4. Open questions

None.
