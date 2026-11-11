# Plan 13: Pane themes per branch

Status: draft 2026-11-11, revised 2026-11-11 (a pane theme is a branch colour of the window theme, the inner colours
calculated; three settings); not started. Builds on plan 07 (themes, branch colours) and plan 03 (branches, the
colour a parent takes from the path it serves).

## 1. What this is about

A branch is one colour now (plan 07 3.2): the head, the focus ring, the tab and the branch marks show it, but inside
the pane everything is the window's theme. The background, the selected rows, the hovered row and the focused row's
outline look the same in every branch, so the only thing that tells two lists apart is a thin ring and a head.

A branch should have a style of its own, a pane theme, that is seen inside the pane as well: background, focus and
highlight all from that same pane theme.

## 2. The solution, in brief

A pane theme is one colour: a branch colour of the window theme, which each theme chooses to fit itself. The other
colours inside the pane (background, selection, hover) are calculated from it and the window theme's own colours, so
a pane's background stays close to the window's light or dark background. Three settings: whether pane themes follow
the branch colour at all, how much the branch colour weighs against the window colours in the calculated colours (a
slider), and how intense the main colour (head, ring, tab, marks) is (a slider). A pane draws itself in the pane theme
of the path it serves (plan 03), by setting those colours on its own element, so everything inside it follows. The
background sliders keep working on top.

## 3. Details

### 3.1 A pane theme is a branch colour

The six `branches` of a window theme (plan 07 3.1) are its pane themes. Nothing new goes into the theme files: the
theme chooses its branch colours to suit itself. A greenish theme may use blue, red, yellow and no green, or make its
first branch the theme's own green. A branch stays a place in that list (plan 07 3.2), so changing the window theme
restyles every branch at once.

### 3.2 The calculated colours

From the branch colour (the main colour) and the window theme, for the current mode:

- **Main colour**: the head, the focus ring, the tab and the branch marks. The branch colour, mixed toward the
  window's `bg` by the intensity setting (3.3).
- **Background** (`bg`, and `bgSide` for a tree): the window's colour with a share of the branch colour, the share set
  by the mix setting (3.3). Kept close to the window's own light or dark background.
- **Selection** (`select`) and **hover** (`hover`): the window's colour with a larger share of the branch colour than
  the background, so a selected row stays clearly visible on the tinted background.
- **Text, dim text, borders**: the window theme's, unchanged.

The shares for selection and hover relative to the background are [not yet decided]; they are fixed in code, tuned in
a test copy against the light and dark themes.

### 3.3 Settings

In the settings window, group Panes (as rows of `settingrows.js`, defaults in `defaults\settings.json`):

- `paneThemeFollowsBranch` (toggle, default on): on, the inside of a pane is calculated from its branch colour; off,
  the inside is the window theme's and only the main colour shows the branch (as now).
- `paneThemeMix` (slider, 0 to 100%): how much the branch colour weighs against the window colour in the calculated
  colours; 0% is the window theme's colours, 100% the most branch colour the calculation allows.
- `paneThemeIntensity` (slider, 0 to 100%): how intense the main colour is; 100% the theme's branch colour as it is,
  lower toward the window's background.

Defaults: [not yet decided]; tuned in a test copy.

### 3.4 Applied per pane

`look.js` calculates each branch place's colours from the window theme and the settings. `app.js drawHeads` already
decides the colour of each pane (`Layout.pathColour`); it sets that place's colours on the pane element as the
variables the page already uses (`--bg`, `--bg-side`, `--select`, `--hover`) plus `--pane-colour` for the main
colour. CSS variables set on an element hold for everything inside it, so the rows, the selection, the hover, the
focused row's outline and the head pick them up without each rule changing. A pane without a branch (a root with no
children) keeps the window theme. Tabs and branch marks take the main colour.

`color-mix()` in CSS can do the mixing from the variables directly; where the calculation needs more than a mix (for
example keeping the background within a distance of the window's), it is done in `look.js`.

### 3.5 The background sliders

`paneBgFocused`, `paneBgBranch` and `paneBgOther` mix the pane's own background toward black or white. With pane
themes that background is the calculated one, so the sliders keep working: they make a pane darker or lighter, the
pane theme gives its tint.

### 3.6 The shipped themes' branch colours

The branch colours of the shipped themes came from LexPen and the defaults, not chosen for each theme. Each theme's
list is reviewed so its colours suit it as pane themes (distinct from each other and from the theme's own colours, or
the first one deliberately the theme's colour).

### 3.7 What does not work and why

- Separate pane theme files with a full colour set each: more to make and keep than a branch colour, and the window
  theme would no longer decide what fits it. The calculated colours give a style per branch from one colour.
- Restyling each CSS rule per branch (`.pane[data-branch="2"] .row.selected`): the rules multiply by six; the
  variables on the pane element need none.

### 3.8 Tests

- Under Jint (the `look.js` calculation, without DOM): for a light and a dark window theme, a branch colour gives the
  expected colours at mix 0% (the window's own), at 100%, and with intensity 0% and 100%; `paneThemeFollowsBranch` off
  gives the window's colours inside.
- `ThemeFileTests`: every settings row names a setting (existing test, now with the new rows).
- Test copy: a tree with two branches; the background, the selected row and the hover of each list in its own pane
  theme; the parent in the colours of the path it serves; the sliders change it at once; light and dark themes.

## 4. Open questions

1. The root tree serves every branch and takes the colour of the path it serves (plan 03). Should it take the whole
   pane theme (its background changing with each branch switch), or only the main colour (head and ring), keeping the
   window theme's background?

## 5. Status

### Built

Nothing yet.

### Not yet built

- The calculated colours from a branch colour and the window theme (3.2).
- Settings `paneThemeFollowsBranch`, `paneThemeMix`, `paneThemeIntensity` (3.3).
- Pane colours set per pane from its path's branch; tabs and marks in the main colour (3.4).
- The background sliders on the calculated background (3.5).
- The shipped themes' branch colours reviewed (3.6).
