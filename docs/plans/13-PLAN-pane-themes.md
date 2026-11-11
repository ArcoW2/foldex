# Plan 13: Pane themes per branch

Status: draft 2026-11-11; not started. Builds on plan 07 (themes, branch colours) and plan 03 (branches, the colour a
parent takes from the path it serves).

## 1. What this is about

A branch is one colour now (plan 07 3.2): the head, the focus ring, the tab and the branch marks show it, but inside
the pane everything is the window's theme. The background, the selected rows, the hovered row and the focused row's
outline look the same in every branch, so the only thing that tells two lists apart is a thin ring and a head.

A branch should have a style of its own, a named pane theme, that is seen inside the pane as well: background, focus
and highlight all from that same pane theme.

## 2. The solution, in brief

A pane theme is a named set of the colours used inside a pane: background, text, focus (head, ring, tab, mark),
selection and hover, with a light and a dark version. Each of the six branch places of a window theme names a pane
theme instead of holding one colour. A pane draws itself in the pane theme of the path it serves (the colour rule of
plan 03), by setting those colours on its own element, so everything inside it follows without other changes. A pane
theme that only gives a focus colour gets the rest made from it, so every current theme keeps working unchanged. The
background sliders (focused, its branch, other) work on the pane theme's background.

## 3. Details

### 3.1 A pane theme

A pane theme is a JSON file as a window theme (plan 07 3.1): shipped in `defaults\themes\panes\`, your own in
`themes\panes\` in the data folder, a file of yours with the same name replacing a shipped one.

```
{
  "name": "Ocean",
  "description": "blue, cool",
  "light": { "focus": "#0969da", "bg": "#f3f8ff", "bgSide": "#eaf2fc", "select": "#b6d7ff", "hover": "rgba(9, 105, 218, .08)" },
  "dark":  { "focus": "#4fa3ff", "bg": "#1b2330", "bgSide": "#1f2836", "select": "#264f78", "hover": "rgba(79, 163, 255, .10)" }
}
```

The colours a pane theme can set: `focus` (required), `bg`, `bgSide` (a tree's background), `fg`, `fgDim`, `select`,
`hover`, `border`. Everything else in a pane stays the window theme's (the ribbon, the location box, the status line
are not in a pane at all).

### 3.2 Made from one colour

A colour left out is made from `focus` and the window theme's colour of the same name: a small share of `focus` mixed
into `bg` and `bgSide`, a larger share into `select` and `hover`; `fg`, `fgDim` and `border` stay the window theme's.
So a pane theme can be a single colour, and the six branch colours of every current theme become six pane themes made
this way, with no file changed. The shares are [not yet decided]: see open question 3.

### 3.3 Branch places name pane themes

In a window theme, `branches` holds six entries; each is a pane theme's name or, as now, a colour (a pane theme made
from that colour, 3.2). A branch stays a place in that list (plan 07 3.2), so changing the window theme still restyles
every branch at once. The Branch colour menu (plan 12) shows each place with its pane theme's name and its focus colour.

### 3.4 Applied per pane

`look.js` gets the pane themes from the host with the window theme and resolves each branch place to its full set of
colours for the current mode. `app.js drawHeads` already decides the colour of each pane (`Layout.pathColour`); it
sets that place's colours on the pane element as the variables the page already uses (`--bg`, `--bg-side`,
`--select`, `--hover`, `--fg`, ...) plus `--pane-colour` for the focus. CSS variables set on an element hold for
everything inside it, so the rows, the selection, the hover, the focused row's outline and the head pick them up
without each rule changing. A pane without a branch (a root with no children) keeps the window theme.

Tabs and branch marks take the focus colour of their pane theme, as they take the branch colour now.

### 3.5 The background sliders

`paneBgFocused`, `paneBgBranch` and `paneBgOther` (built with plan 03's follow-ups) mix the pane's own background
toward black or white. With pane themes that background is the pane theme's `bg` or `bgSide`, so the sliders keep
working: they make a pane darker or lighter, the pane theme gives its tint.

### 3.6 Settings window

The settings window's General group gets no new rows: the pane themes are picked in the window theme file. Your own
pane themes and window themes are files, as now (plan 07 3.5). See open question 1 for picking them in the window.

### 3.7 What does not work and why

- One colour per branch with only the inside tinted by a fixed rule: no named style, no way to give a branch a darker
  background and a light selection, which is what a style is for.
- Pane themes inside each window theme file: every window theme would repeat them, and a pane theme you like would be
  lost on switching window theme. Separate files keep them independent.
- Restyling each CSS rule per branch (`.pane[data-branch="2"] .row.selected`): the rules multiply by six; the
  variables on the pane element need none.

### 3.8 Tests

- `ThemeFileTests`: a pane theme file read with light and dark; a missing colour made from `focus`; a file of yours
  replacing a shipped one; a `branches` entry as a name and as a colour.
- Under Jint (`look.js` resolve step, without DOM): each branch place gives the full colour set for light and dark.
- Test copy: a tree with two branches in two pane themes; the background, the selected row and the hover of each list
  in its own pane theme; the parent in the colours of the path it serves; switching branch restyles the parent.

## 4. Open questions

1. Picking: should the settings window (or the Branch colour menu) let you choose a pane theme per branch place, stored
   in your settings.json over the window theme's list? Or is editing the theme file enough for now?
2. The root tree serves every branch and takes the colours of the path it serves (plan 03). Should it take the whole
   pane theme (its background changing with each branch switch), or only the focus colour (head and ring), keeping the
   window theme's background?
3. Pane themes made from one colour: how strong should the tint inside the pane be? A fixed choice, or a setting (a
   slider, as the backgrounds)?
4. Shipped pane themes: only the ones made from the current branch colours, or also named pane themes with their own
   light and dark sets (and if so, which styles)?

## 5. Status

### Built

Nothing yet.

### Not yet built

- Pane theme files, light and dark, shipped and your own (3.1).
- Colours made from `focus` (3.2).
- Branch places naming pane themes or colours (3.3).
- Pane colours set per pane from its path's branch (3.4).
- Tabs and marks in the pane theme's focus colour (3.4).
- The background sliders on the pane theme's background (3.5).
