# Plan 16: The look of a tree: expanders and tree lines

Status: executed; see 6. As built.

- 2026-11-11: draft.
- 2026-11-11: executed.

Builds on plan 03 (the tree panes) and plan 15 (the Projects menu's pane tree). The number in the file name is the
priority; rename to reorder.

## 1. What this is about

A tree pane shows its folders indented, with `+` and `-` before them; nothing shows which folder a row belongs to
when the tree is deep or long. The Projects menu's pane tree (plan 15 3.6) is only indented as well. Explorers draw
tree lines, and some prefer `>` and `v` to `+` and `-`.

## 2. The solution, in brief

Two settings for every tree, in Settings > Panes: the expanders, `+` / `-` or `>` / `v`, and the tree lines: solid,
dotted or none. The lines join each row to its parent, as a folder structure is drawn: a vertical line down from a
parent past its children, a short horizontal one into each child, the last child closing the line. The tree panes and
the Projects menu's pane tree draw them the same way; a change shows at once in every window.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Settings | `treeExpanders` (`plus`, `chevron`), `treeLines` (`solid`, `dotted`, `none`), rows in Settings > Panes | 3.1; 6.1 |
| Lines in a tree pane | per row the pieces of line for each level, worked out when the tree is flattened | 3.2; 6.1 |
| Expanders | `+` / `-` or a chevron `>` / `v` | 3.1; 6.1 |
| Lines in the Projects menu | the pane tree of plan 15 3.6 with the same lines | 3.3; 6.1 |

### Not yet built

## 3. Details

### 3.1 Settings

- `treeExpanders`: `plus` (default; `+` closed, `-` open) or `chevron` (`>` closed, `v` open, drawn by CSS).
- `treeLines`: `dotted` (default), `solid` or `none`; in the theme's dim text colour, faint.
- Rows in the settings window, group Panes, as choices. A change shows at once (the tree panes draw again).

### 3.2 The lines in a tree pane

A tree pane draws only the rows in view (plan 02), so each row carries its own pieces of line: per level above it,
one of

- **pass**: the vertical line of an ancestor that has more children below goes through this row;
- **mid**: this row's own joint, not the last child: the vertical line goes through, and a short horizontal line
  goes into the row;
- **end**: the last child: the vertical line stops halfway, then the horizontal line;
- nothing: an ancestor that was the last child: its line has ended.

And **down**: an open folder with children starts its line under its expander. The pieces are worked out when the
tree is flattened (`TreeView.flatten`), from the visible rows only: a hidden folder (hidden items off) does not keep
a line going. The lines sit in the expander column of each level, under the row's selection colour.

### 3.3 The Projects menu

The pane tree of a project (plan 15 3.6) gets the same pieces from the order and depth of its panes (`treeGuides` in
`panes.js`, which the tests run), drawn in the menu item's indent.

### 3.4 Tests

- Unit (Jint, `panes.js treeGuides`): a list of depths gives pass, mid, end and nothing as 3.2 says (the last child,
  a deeper last child under a non-last one, two roots, a down for a node with children).
- Every settings row names a setting (existing test).
- Test copy: a tree opened three levels deep with each setting: solid, dotted, none; `+` / `-` and chevrons;
  screenshots in light and dark; the Projects menu's tree with lines.

## 4. Open questions

None.

## 6. As built

### 6.1 Built (2026-11-11, branch `plan01-foundation`)

- `panes.js`: `treeGuides(depths)` (per row its levels, `pass`, `mid`, `end` or `''`, and `down`) and
  `guideElements` (the pieces as spans at a given x per level). `TreeView.flatten` works them out from the visible
  rows; `render` puts them in each row (level k at 14 + 14k px, the expander's middle) and draws the expander as the
  setting says (a chevron is a CSS border turned 45 degrees). `settingsChanged` draws the trees again when
  `treeExpanders` changes; `look.js` puts `treeLines` on the root element and `app.css` draws the lines dotted,
  solid or not at all, in the dim text colour at 55%.
- `menu.js`: an item takes `guides`; `projectmenu.js` gives each pane of the tree its guides.
- Defaults: `plus` and `dotted`.

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 110 (`PanesTests.TreeLinesPassJoinAndEnd`).
- Test copy over CDP, dark theme: the Folders tree with dotted lines (screenshot); chevrons with solid lines
  (screenshot); the Projects menu's tree of Klanten with its joints (screenshot).
- Not looked at: `none`, the light theme.
- After use: in the Projects menu the lines sat in the label, shorter than the row, so they broke between rows; now
  they are placed over the whole row (label 26 px in) and join up. Test copy: Klanten's tree as one line from under
  Folders past its lists (screenshot); the rows as high as the main menu's (23 px, measured).
