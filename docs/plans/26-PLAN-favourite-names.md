# Plan 26: Favourite folders with names, opened in a new pane, in Home > Open

Status: not started.

- 2026-11-13: draft, at the user's request.

Builds on plan 23 (`docs/plans/executed/23-PLAN-quick-access-and-favourites.md` 3.6, 3.7), which built the favourite
folders as LexPen's: the Favourites menu (the folders, Add current folder, Add a folder..., Manage...), Manage (Up,
Down, Add..., Change..., Delete, Close), a favourite opening in the active pane. The number in the file name is the
priority; rename to reorder.

## 1. What this is about

A favourite shows only its folder's own name, so two favourites called "Docs" or "temp" cannot be told apart, and a
folder with a long or meaningless name keeps that name in the menu. A favourite opens only in the active pane; there
is no way to open it in a pane of its own. The Favourites button sits in Home > Go, but the user wants it in Home > Open.

## 2. The solution, in brief

Every favourite gets a name of its own, kept with its folder in favourite-folders.json; without one it shows its
folder's name, as now. Manage shows the name and the folder per row, and Change... edits both (Add... asks the folder,
then offers the name). A click on a favourite in the menu opens it in the active pane, as now; a right-click on it
opens a small menu with Open and Open in a new pane, the latter a new root pane (a folder tree of its own) on that
folder. The Favourites button moves from Home > Go to Home > Open.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Names kept | a name per favourite in favourite-folders.json, read and written by the host | -- | 3.1 |
| Names shown | the menu and Manage show the name (the folder's name when it has none) | Names kept | 3.2 |
| Manage | the name per row; Change... edits name and folder; Add... offers the name | Names kept | 3.3 |
| Right-click | a right-click (or the menu key) on a favourite in the menu: Open, Open in a new pane | -- | 3.4 |
| Ribbon | Favourites moved from Home > Go to Home > Open | -- | 3.5 |
| Tests | unit and in the app | all | 3.6 |

## 3. Details

### 3.1 Names kept

- favourite-folders.json keeps its list of folders (`folders`, in your order) and gets `names`: folder -> name, only
  for favourites that have a name of their own. A file without `names` (as written now) reads as before: no names.
  Quick access has no names (it shows the folder's own name, plan 23 3.4).
- FolderLists keeps the names with the list: a folder taken off loses its name; the same folder (any case, a known
  folder by its shell name or path) has one name. An empty name, or one equal to the folder's own name, is not kept.
- The host sends the names with the lists ("folderLists") to every window; folderListSet carries them, and a new op
  (folderListName: folder, name) sets one.
- Folders added from Windows' right-click menu ("Add to favourite folders") or from the Favourites menu ("Add current
  folder", "Add a folder...") get no name: they show the folder's name until one is given in Manage.

### 3.2 Names shown

- The Favourites menu: the name; the tooltip the full path (as now). A missing folder: "<name> (not there)", as now.
- Two favourites with the same name are allowed; nothing is added to tell them apart in the menu (the tooltip has
  the path; open question 3).

### 3.3 Manage

- A row: the name, then its folder dimmed (now: the folder's name, then its parent). A favourite without a name of its
  own shows its folder's name, as now.
- Change... (also Enter or a double click): a small dialog in the page with Name (a text box, its text selected) and
  Folder (a text box with Browse..., Windows' folder picker at that folder). OK keeps both; a folder that is already
  another favourite is refused with a message, as LexPen refuses a double. An empty name means "the folder's name".
- Add...: the folder picker first (as now; one already in the list left out), then the same dialog with the folder
  filled in and the name empty, so Enter keeps it without a name.
- Up, Down, Delete, Close and their keys as now. Every change goes to the host at once, as now.
- Where Foldex differs from LexPen: LexPen's favourites have no names (its Change... picks another file). The user
  asked for names, so Change... edits a name and a folder here.

### 3.4 Right-click on a favourite

- In the Favourites menu, a right-click on a favourite opens a small menu beside it, as a submenu: Open (the active
  pane goes there, as a left click) and Open in a new pane (a new root pane on that folder: newRootPane, a folder tree
  of its own in the left area with that folder revealed and focused, its children following). A missing folder: both
  ask to take it off, as a left click does now.
- With the keys: the menu key or Shift+F10 on the lit favourite opens the same small menu.
- menu.js gets this generic: an item may carry `context` (items), shown at a right-click or the menu key on that item.
  The Favourites menu is its first user. The opener rule (CLAUDE.md, Menus) is unchanged: it is about the button that
  opened the menu.
- The right-click works on the favourites of the menu only. Manage has no right-click menu.

### 3.5 Ribbon

- ribbon.json: the Favourites item (favourites.menu) goes from Home > Go to Home > Open, small, stacked under
  Properties and Select all (the third in that column, the most a column holds). Go keeps Back, Forward, Up and
  Refresh.
- A ribbon.json of your own is not changed (it replaces the shipped one whole, plan 01 3.3).

### 3.6 Tests

- Unit (FolderListsTests): names kept and read back; a file without `names` read as before; a name dropped when its
  folder is taken off; one name for the same folder in another case and for a known folder by its shell name and path;
  an empty name and one equal to the folder's own name not kept.
- In the test copy (CDP, real keys and mouse where possible): a name given in Manage shows in the menu and in Manage;
  kept after a restart; Change... to a folder already in the list refused; Add... with a name and without one; a
  right-click on a favourite: the small menu, Open goes there in the active pane, Open in a new pane makes a root tree
  on that folder; the menu key on a lit favourite; a missing folder asked to be taken off; Favourites in Home > Open,
  not in Home > Go.

## 4. Open questions

1. Open in a new pane: a folder tree from This PC with the favourite revealed (as New pane does now), or a tree whose
   top is the favourite itself (nothing above it)? The plan has the first, since Foldex has no tree with a folder as
   its top yet.
2. Should the right-click menu also have Change... (the name and folder dialog) and Remove from favourites? Not asked,
   so not in the plan.
3. Two favourites with the same name in the menu: leave them as they are (the tooltip tells), or show the folder
   dimmed after the name, as Manage does?
