# Plan 23: Quick access in a tree, favourite folders

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request.

Favourite folders as LexPen has them (`..\LexPen\docs\plans\executed\PLAN-favourite-folders.md`). The number in the
file name is the priority; rename to reorder.

## 1. What this is about

A folder you go to often takes a walk through the tree every time. Foldex has no place to keep such folders: no
shortcuts in the tree, as Explorer's Quick access, and no list of favourite folders, as LexPen has.

## 2. The solution, in brief

A tree gets a Quick access area at its top: a head that folds the area up or open, and under it shortcuts to
folders. A click on a shortcut goes to that folder as a click in the tree does. Right-click a folder, anywhere,
and "Add to quick access" puts it there; right-click a shortcut and "Remove from quick access" takes it out.
Next to it come favourite folders as LexPen's: a Favourites button in the ribbon with the list, Add current folder,
Add a folder... and Manage... (a dialog to put in order, add, change and delete); "Add to favourite folders" on a
folder's right-click menu. Both lists are kept by the host and shared by all windows.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Lists | quickaccess.json and favourite-folders.json, kept by the host, shared by all windows | -- | 3.1 |
| Right-click items | Foldex's own items in Windows' menu for a folder: add to / remove from quick access and favourite folders | -- | 3.2 |
| Quick access area | the area at the top of a tree: head, fold, shortcuts, going there | Lists | 3.3 |
| Favourites button | the ribbon button with the list, add current, add a folder, manage | Lists | 3.4 |
| Manage | the dialog for favourite folders (and quick access) | Lists | 3.5 |
| Tests | unit and in the app | the others | 3.6 |

## 3. Details

### 3.1 The lists

- Two lists of folder paths, each in your order: quickaccess.json and favourite-folders.json in Foldex's data
  folder, written whole through a temporary file (as searches.json and renames.json). A path that comes twice (any
  case) is kept once.
- The host keeps them and tells every window when one changes, so all trees and ribbons follow.
- Whether each folder still exists is asked when it is shown (the area drawn, the menu opened); a missing one is
  dimmed, and a click on it says so and offers to take it off the list.
- Only folders on disk or a share (a parsing name `X:\...` or `\\...`); a shell location (This PC, Recycle Bin)
  cannot be added.

### 3.2 The right-click menu

- A folder's right-click menu is Windows' own (ShellMenu). Foldex puts its own items at its top before it is shown:
  "Add to quick access" or "Remove from quick access", and "Add to favourite folders" or "Remove from favourite
  folders", then a line. Their command ids lie outside the range the shell's handlers get, so a chosen one is
  Foldex's and goes to the page as an action.
- Shown for one folder only (the focused one in a tree, or a single selected folder in a list); several items
  selected, or a file: not shown.
- Windows' own "Pin to Quick access" (Explorer's list) stays as Windows puts it; it does not touch Foldex's.
- On a shortcut in the Quick access area: Windows' menu for that folder with "Remove from quick access" at the top.

### 3.3 The Quick access area

- At the top of a tree pane, above its folders, scrolling with them: a head row "Quick access" with a fold mark
  (the tree's expander, `>` / `v` or `+` / `-` as the setting treeExpanders says); folded, only the head shows.
  Whether it is folded is kept per pane in the layout (so a project keeps it).
- Under the head the shortcuts in the list's order: the folder's icon and name; the tooltip has the full path. Two
  shortcuts with the same name show their parent folder dimmed after the name.
- A click on a shortcut focuses that folder in the tree below (expanded to it, as the path bar does), so the
  children follow as from any tree row. The shortcut itself is not a tree node: it has no children here.
- Keys: the arrows walk from the folders into the shortcuts and the head and back; Enter or Space on the head folds;
  Del on a shortcut removes it from quick access (no question: it removes nothing on disk).
- A tree with the area empty shows only the head, with "Right-click a folder: Add to quick access" dimmed when open.
- Whether a tree shows the area: a setting, quickAccess, on by default, for every tree; a pane can hide it from its
  pane menu (Show > Quick access).

### 3.4 The Favourites button

- In the ribbon, Home > Go: Favourites (a menu button, as Projects is). Its menu, as LexPen's: the favourite folders
  first (a missing one dimmed), a line, then Add current folder (or Remove current folder), Add a folder... (Windows'
  folder picker), Manage....
- Current folder: the active pane's folder (a list's location, a tree's focused folder).
- Choosing a favourite: the active pane goes there. A list shows the folder; a tree focuses it (its children follow).
  In a scrap or the preview: the pane it is connected to, else the first list.
- An action per entry, so a key can be bound: favourites.menu (the menu at the button or the pane), favourites.add,
  favourites.manage. No default keys.

### 3.5 Manage

- A dialog in the page, as LexPen's: "Favourite folders", one row per folder (the name, its folder dimmed; a missing
  one struck through); a row selected by a click or the arrows.
- Buttons: Up and Down (also Ctrl+Up / Ctrl+Down), Add... (the folder picker; at the end; one already in the list
  left out), Change... (the picker at that folder; also a double click or Enter), Delete (Del), Close (Esc). Every
  change goes to the host at once.
- The dialog buttons as every Foldex dialog (Left/Right, letter shortcuts).

### 3.6 Tests

- Unit: the two lists (add once in any case, remove, set in order, kept, a broken file read as empty).
- In the app (the test copy, CDP): right-click a folder in a tree and in a list, Add to quick access; the area with
  the shortcut; a click on it (the tree focused there, the list following); fold and unfold, kept after a restart;
  Remove from quick access by the menu and by Del; a missing folder dimmed; the Favourites menu, add current, choose
  one; Manage: up, down, add, change, delete, order after a restart; a second window following a change.

## 4. Open questions

1. Quick access and favourite folders: two lists, as written, or one list shown in both places? Two lists is what
   you described; one list is simpler to keep up.
2. One quick access list for all trees and projects (as written), or one per project?
3. Can a shortcut in Quick access be expanded to show its subfolders, as in Explorer's navigation pane, or does it
   only go to the folder (as written)?
4. Should dragging a folder onto the Quick access area add it, and dragging a shortcut within the area reorder it?
   Not written in yet.
5. Should Foldex's Quick access start with Windows' own Quick access folders (Explorer's pinned list) when it is
   still empty, or start empty?
