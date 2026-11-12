# Plan 23: Quick access in a tree, favourite folders

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request.
- 2026-11-12: revised: quick access and favourite folders two lists; quick access one list, shown in a top tree
  only; a shortcut expands, its subfolders in another tree colour; drag to add and to reorder; the first list from
  Explorer's pinned folders.

Favourite folders as LexPen has them (`..\LexPen\docs\plans\executed\PLAN-favourite-folders.md`). The number in the
file name is the priority; rename to reorder.

## 1. What this is about

A folder you go to often takes a walk through the tree every time. Foldex has no place to keep such folders: no
shortcuts in the tree, as Explorer's Quick access, and no list of favourite folders, as LexPen has.

## 2. The solution, in brief

A tree that holds folders and has no parent gets a Quick access area at its top: a head that folds the area up or
open, and under it shortcuts to folders (Downloads, Documents and the like among them). A shortcut goes to its
folder and can be expanded; its subfolders are drawn in another tree colour, so they are not taken for the tree
itself. Right-click a folder and "Add to quick access" puts it there, or drag it onto the area; right-click a shortcut
and "Remove from quick access" takes it out; dragging a shortcut puts it in another place. The list is one for all of
Foldex and starts as Explorer's pinned Quick access folders.
Apart from it, favourite folders as LexPen's: a Favourites button in the ribbon with the list, Add current folder,
Add a folder... and Manage... (a dialog to put in order, add, change and delete); "Add to favourite folders" on a
folder's right-click menu. Both lists are kept by the host and shared by all windows.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Lists | quickaccess.json (first filled from Explorer's pinned folders) and favourite-folders.json, kept by the host, shared by all windows | -- | 3.1 |
| Right-click items | Foldex's own items in Windows' menu for a folder: add to / remove from quick access and favourite folders | -- | 3.2 |
| A folder twice in a tree | a tree that shows one folder in two places (a shortcut's subfolders, This PC and the user folder) keeps each place apart | -- | 3.3 |
| Quick access area | the area at the top of a top tree: head, fold, shortcuts that expand, their own tree colour, going there | Lists; A folder twice in a tree | 3.4 |
| Dragging | a folder dropped on the area added; a shortcut dragged to another place | Quick access area | 3.5 |
| Favourites button | the ribbon button with the list, add current, add a folder, manage | Lists | 3.6 |
| Manage | the dialog for favourite folders | Lists | 3.7 |
| Tests | unit and in the app | the others | 3.8 |

## 3. Details

### 3.1 The lists

- Two lists, each in your order, apart from each other: quick access (quickaccess.json) and favourite folders
  (favourite-folders.json), in Foldex's data folder, written whole through a temporary file (as searches.json and
  renames.json). A folder that comes twice (any case) is kept once. One list each for all of Foldex: every project
  and window shows the same.
- The host keeps them and tells every window when one changes, so all trees and ribbons follow.
- Quick access holds folders on disk or a share, and the shell's known folders by their own names (Downloads,
  Documents, Pictures, Desktop: `shell:Downloads` and the like), so a moved Documents folder is still found.
  Favourite folders hold folders on disk or a share.
- Whether each folder still exists is asked when it is shown (the area drawn, the menu opened); a missing one is
  dimmed, and a click on it says so and offers to take it off the list.
- The first time (no quickaccess.json yet): the list is Explorer's pinned Quick access folders, in Explorer's order,
  read once from the shell's Quick access folder (its pinned items; the folders Windows adds by itself as frequent
  are left out). How the shell tells pinned from frequent: [not yet checked]. After that Foldex's list is its own:
  pinning or unpinning in Explorer does not change it, nor the other way round.

### 3.2 The right-click menu

- A folder's right-click menu is Windows' own (ShellMenu). Foldex puts its own items at its top before it is shown:
  "Add to quick access" or "Remove from quick access", and "Add to favourite folders" or "Remove from favourite
  folders", then a line. Their command ids lie outside the range the shell's handlers get, so a chosen one is
  Foldex's and goes to the page as an action.
- Shown for one folder only (the focused one in a tree, or a single selected folder in a list); several items
  selected, or a file: not shown.
- Windows' own "Pin to Quick access" (Explorer's list) stays as Windows puts it; it does not touch Foldex's.
- On a shortcut in the Quick access area: Windows' menu for that folder with "Remove from quick access" at the top.

### 3.3 A folder twice in a tree

- A tree now keeps one node per folder: a folder reached in two places (the user folder at the top and under This
  PC > C: > Users) shares its children between both places, so opening one moves the rows of the other (they are
  drawn at the wrong depth, joined to the wrong folder). A shortcut that expands would do the same.
- A node is one place in the tree: its children are its own, its depth and parent too. Going to a folder by its path
  (the path bar, a child pane, a restart) takes the place under its drive (or under the shortcut it was chosen in,
  when that is where the focus is); the focus keeps which place it is on, so the arrows walk on from there.
- This is also the fix of the tree bug seen with C:\Users\<you> (2026-11-12); it may be built before the rest of this
  plan.

### 3.4 The Quick access area

- Shown in a tree pane that holds folders and has no parent (a top tree, as the Folders pane); never in a child
  tree. A setting, quickAccess, on by default, turns it off for every tree.
- At the top of the tree, above its folders, scrolling with them: a head row "Quick access" with a fold mark (the
  tree's expander, as the setting treeExpanders says); folded, only the head shows. Whether it is folded is kept per
  pane in the layout.
- Under the head the shortcuts in the list's order: the folder's icon and name (a known folder by its shown name:
  Downloads); the tooltip has the full path. Two shortcuts with the same name show their parent folder dimmed after
  the name.
- A shortcut has an expander when its folder has folders in it: it opens as a tree row does, its subfolders under it.
  Those rows (the shortcut's own row too) draw their tree lines and expanders in another colour than the tree's: the
  accent colour at the tree lines' intensity [the exact colour to be chosen when built], so they are not taken for
  the tree below.
- A click on a shortcut or one of its subfolders focuses that row; its children follow as from any tree row.
- Keys: the arrows walk from the folders into the shortcuts and the head and back; Enter or Space on the head folds;
  Del on a shortcut removes it from quick access (no question: it removes nothing on disk); on a subfolder of a
  shortcut Del deletes as anywhere.
- An empty list shows only the head, with "Right-click a folder: Add to quick access" dimmed when open.

### 3.5 Dragging

- A folder dragged onto the area (from a tree, a list, a scrap or Explorer) is added where it is dropped, between
  two shortcuts (a line shows where); dropped on a shortcut it is moved or copied into that folder, as a drop on any
  folder. Files dropped between shortcuts: not added (only folders).
- A shortcut dragged within the area goes to the place it is dropped; dragged out of the area it is its folder (a
  drop elsewhere copies or moves the folder, as dragging the folder does).

### 3.6 The Favourites button

- In the ribbon, Home > Go: Favourites (a menu button, as Projects is). Its menu, as LexPen's: the favourite folders
  first (a missing one dimmed), a line, then Add current folder (or Remove current folder), Add a folder... (Windows'
  folder picker), Manage....
- Current folder: the active pane's folder (a list's location, a tree's focused folder).
- Choosing a favourite: the active pane goes there. A list shows the folder; a tree focuses it (its children follow).
  In a scrap or the preview: the pane it is connected to, else the first list.
- An action per entry, so a key can be bound: favourites.menu (the menu at the button or the pane), favourites.add,
  favourites.manage. No default keys.

### 3.7 Manage

- A dialog in the page, as LexPen's: "Favourite folders", one row per folder (the name, its folder dimmed; a missing
  one struck through); a row selected by a click or the arrows.
- Buttons: Up and Down (also Ctrl+Up / Ctrl+Down), Add... (the folder picker; at the end; one already in the list
  left out), Change... (the picker at that folder; also a double click or Enter), Delete (Del), Close (Esc). Every
  change goes to the host at once.
- The dialog buttons as every Foldex dialog (Left/Right, letter shortcuts).
- Quick access has no Manage dialog: it is put in order by dragging in the area.

### 3.8 Tests

- Unit: the two lists (add once in any case, remove, set in order, kept, a broken file read as empty); the first
  quick access list from Explorer's pinned folders.
- In the app (the test copy, CDP): the user folder opened at the top and under C:\Users, each at its own depth; right-
  click a folder in a tree and in a list, Add to quick access; the area with the shortcut, only in the top tree; a
  click on it (the children following); a shortcut expanded, its rows in the other colour; fold and unfold, kept
  after a restart; Remove from quick access by the menu and by Del; a folder dropped between shortcuts; a shortcut
  dragged to another place; a missing folder dimmed; the Favourites menu, add current, choose one; Manage: up, down,
  add, change, delete, order after a restart; a second window following a change.

## 4. Open questions

None.
