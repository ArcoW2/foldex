# Plan 27: Bookmark folders: bookmarks and quick access kept in folders of their own, to any depth

Status: executed; see Status and 6 (As built).

- 2026-11-15: draft, at the user's request.
- 2026-11-15: executed.

Builds on plan 26 (`docs/plans/executed/26-PLAN-bookmarks.md`): one list of bookmarks in bookmarks.json, every entry
on its own with its id, the Bookmarks menu, the trees' Quick access area, Manage with a tab for the bookmarks and one
for quick access (To quick access / To bookmarks with Move to and Copy to, a handle per row), Edit. The number in the
file name is the priority; rename to reorder.

## 1. What this is about

The bookmarks and the quick access shortcuts are flat lists. With many of them the menu and the area grow long, and
entries that belong together (the projects: LexPen, Foldex, ActiveAnts) cannot be kept together under one name.

## 2. The solution, in brief

Both tabs can hold folders: a folder has a name and holds bookmarks and other folders, in your order, to any depth. In
the Bookmarks menu a folder is a submenu; in a tree's Quick access area it is a row that opens and closes, its
shortcuts under it; in Manage it is a row that opens and closes, what it holds under it. Manage's New button opens a
menu: a folder (on the Quick access tab a quick access folder) or a bookmark. An entry goes into a folder by dragging it
onto the folder (the folder lit) or between rows (a line, as now), or with the button Move to folder..., where the
tab's top level counts as a folder too. Removing a folder that holds something asks whether that goes too, moves to
the folder above, or nothing happens. A folder is Foldex's own grouping, nothing on disk: its bookmarks keep their
locations, names, icons, keys and way of opening.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| The list | folders in bookmarks.json, nested to any depth, read and written by the host | 3.1; 6.1 |
| The menu | a folder as a submenu (submenus in submenus); its right-click | 3.2; 6.2 |
| Quick access area | a folder as a row with its shortcuts under it, in every tree without a parent | 3.3; 6.3 |
| Manage: the rows | folders as rows that open and close, any depth | 3.4; 6.4 |
| Manage: New | a drop-down: Folder..., Bookmark... | 3.4; 6.4 |
| Manage: moving | dragging onto a folder and between rows; Move to folder...; Move to and Copy to with folders | 3.4; 3.5; 6.4 |
| Removing a folder | the question: its contents removed too, moved to the folder above, or cancel | 3.6; 6.5 |
| Tests | unit and in the app | 3.7; 6.6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 The list

- bookmarks.json's `bookmarks` holds bookmarks (as plan 26 3.1) and folders: { id, folder: name, quickAccess,
  items: [...] }, where items holds that folder's bookmarks and folders in your order, to any depth. A folder's tab is
  its top-level entry's (quickAccess on the entry at the top level; what is inside a folder goes with it). The name is
  required; two folders may have the same name.
- Every bookmark and folder is an entry of its own with its id: the same location can be in two folders, or twice in
  one.
- Added from Windows' right-click menu, by a drop on the Quick access area's head, or with Add current folder: at the
  tab's top level, at the end, as now.
- The key set (plan 26 3.6) and F1 take every bookmark, inside folders too. A folder has no keys.
- In the code a folder is a `group` (`Bookmark` gets Group and Items), so it is never taken for a folder on disk; on
  screen it is a folder, as the user calls it, drawn with a folder icon of its own (distinct from a disk folder's).

### 3.2 The menu

- A folder is a submenu item (menu.js has submenus, and a submenu can have its own): its name, then what it holds as
  the menu's own items are (icon, name, Open key, the right-click of plan 26 3.8). An empty folder is greyed out.
- The right-click on a folder: Rename... and Remove (3.6). Nothing else: right-click menus stay short.

### 3.3 The Quick access area

- A quick access folder is a row in the area of every tree without a parent: its expander, its icon, its name; what it
  holds under it, one level in, opened and closed as any row (kept per pane, as the area's own fold). It is not a
  folder on disk: no Windows' menu; its right-click is Rename... and Remove, as in the menu.
- A shortcut inside a quick access folder works as one at the top (a click, its subfolders, F2, Del, Edit...).
- Dragging in the area (plan 26 3.2) also goes into folders: onto a folder row (the row lit) puts it in that folder at
  its end; between rows (a line) puts it there, in the folder of the rows around it.
- The Quick access area's head and a tree with a folder as its top (plan 26 3.11) are as built.

### 3.4 Manage: the rows, New, moving

- On each tab a folder is a row with an expander, its folder icon and its name, what it holds under it, indented;
  Left and Right close and open it, as in a tree; a double click on the folder's name opens or closes it. The columns
  stay Name and Location (a folder's Location is empty).
- Up and Down move an entry past its neighbour within its own folder; they do not go into or out of folders.
- Dragging a row by its handle (plan 26 3.3):
  - over a folder row (its middle): the folder is lit; let go, the entry goes into it, at its end;
  - between rows (the upper or lower part of a row): a line, as now; let go, it goes there, into the folder those rows
    are in;
  - a folder dragged into itself or into a folder inside it is refused (no line, nothing lit).
- The button New (it replaces Add...) has a chevron and opens a menu:
  - Folder...: asks its name; on the Quick access tab a quick access folder. It goes after the selected row, in the
    same folder (a folder selected and open: at its top inside).
  - Bookmark...: Edit empty (plan 26 3.4), on the Quick access tab Quick access checked; it goes where Folder... puts
    a folder. Its location is a place, as plan 26 3.4 has it (a folder, a file, a network path, a shell folder); web
    addresses are not bookmarks.
- The button Move to folder... (beside To quick access): a small window with the tab's folders as a tree, the tab
  itself at the top ("Bookmarks" or "Quick access": the top level, outside every folder); a folder chosen and OK, the
  selected entry goes in at its end. The folder it is in now is selected when it opens; a folder cannot be moved into
  itself or into one inside it (those are greyed out).
- Edit... on a folder renames it (its name asked); Delete on a folder as 3.6 says.

### 3.5 To quick access, To bookmarks with folders

- Move to on a folder: the folder with everything in it to the other tab's top level, at the end.
- Copy to on a folder: a copy of it and of everything in it, every copy with its own id and without keys (plan 26
  3.3), at the other tab's top level.
- Move to and Copy to on an entry inside a folder: to the other tab's top level (Move to folder... puts it deeper).

### 3.6 Removing a folder

- An empty folder goes at once. One that holds something asks, in Foldex's question window, naming how many entries it
  holds (counted when asked): Remove all (the folder and everything in it), Move up (what it holds goes to the folder
  above, where the folder was, in its order; the folder goes), or Cancel (nothing changes).
- The same question for Delete in Manage, Remove in the menu's and the area's right-click, and Del on a quick access
  folder in a tree.
- AskForm.Ask takes buttons of its own (any number; Tell has one); the page's op `confirm` asks only Yes / No. The
  page gets an op that asks with its own buttons and answers with the one chosen (null for Cancel and Esc).

### 3.7 Tests

- Unit (BookmarksTests): folders kept and read back, nested, with their entries in order and their ids; a folder's tab
  from its top-level entry; plan 26's flat bookmarks.json read as before; Move up and Remove all of a folder.
- Page (Jint): the keys of bookmarks in folders, at any depth, in the key set; moving an entry into a folder, between
  rows in a folder, and a folder into itself refused.
- In the test copy: a folder Projects made with New > Folder..., LexPen, Foldex and ActiveAnts dragged into it (the
  folder lit), a folder Clients inside it; the menu with Projects > Clients as submenus, a bookmark opened from there
  and by its key; on the Quick access tab a quick access folder, shown in a tree's area, opened and closed, a shortcut
  in it opened; Move to folder... to a folder and back to the top level; a line between rows inside a folder; Move to
  and Copy to of a folder; removing a folder: Remove all, Move up, Cancel; kept after a restart.

## 4. Open questions

None.

## 6. As built

### 6.1 The list

- Bookmarks.cs: `Bookmark` has Group (the folder's name) and Items; ToJson and From write and read
  { id, folder, quickAccess, items }. Clean works at any depth: ids made unique across the whole list, a folder
  without a name "New folder", and what a folder holds given the folder's tab (its QuickAccess). All (every entry at
  any depth), Without (an entry taken off at any depth), InGroup, and ToQuickAccess and RemoveFrom inside folders.
  The host's uses (the known folders' paths, bookmarksExist, Windows' menu) go through All.
- bookmarks.js: bookmarkPlaces (every entry with its list, tab, depth and folder), allBookmarks, locateIn,
  insideGroup, onTab, putIn, moveBookmarkTo, changeBookmark, removeBookmark, newBookmarkFolder,
  renameBookmarkFolder. Every change is made on a copy and saved whole (bookmarksSet), as in plan 26. The keys, F1's
  variants and Edit take bookmarks at any depth.
- A folder's icon is drawn in the page (an SVG: a folder with a bookmark ribbon), not one of Windows' icons.

### 6.2 The menu

- A folder is an item with `items` (a submenu; menu.js already opens submenus in submenus), greyed out when empty,
  with `context` Rename... and Remove. An empty folder can be renamed or removed in Manage (greyed out, its
  right-click is off too).

### 6.3 The Quick access area

- quickAccessEntries gives a folder as { id: "::foldex-bmgroup:<id>", bm, bmGroup, items }; TreeView builds its rows
  at any depth, each folder's place a node of its own, its children there already (no listing). Which folders are
  open is kept with the pane (`qaOpen`). A folder is never watched, never followed (select keeps it quiet), and its
  right-click is Foldex's own menu.
- Every test that meant "a shortcut" (a child of the area's head) is now "an entry of the area" (`bm`): the menu's
  entry id, F2, Del, dragging, the missing mark, the icon.
- quickAccessDrop gives { node, where (before, after, into), in (the folder), at }; the row gets qa-drop-before,
  qa-drop-after or qa-drop-into. A shortcut is dragged by the shell's drag (as built); a quick access folder, which is
  nothing on disk, by the page's own drag. Dropped within the area, the page moves the entry itself
  (moveBookmarkTo); a folder from elsewhere goes to the host, with the quick access folder (quickAccessIn) and its
  place.

### 6.4 Manage

- manageRows gives the rows shown { b, depth, parent }; a closed folder's entries left out (the closed ones are kept
  while Foldex runs). Rows are indented, a folder has an expander (a chevron) and its icon, its Location empty.
- The buttons: Up, Down (within the entry's folder), New (a chevron; Folder... and Bookmark..., on the Quick access
  tab "Quick access folder..." and "Quick access shortcut..."), Edit... (a folder: its name asked), To quick access /
  To bookmarks, Move to folder..., Delete, Close. New puts what it makes after the selected row in its folder, or at
  the top inside an open folder that is selected. Left closes a folder (else goes to the folder the row is in), Right
  opens it; a double click on a folder opens or closes it.
- Dragging a row by its handle: the middle of a folder's row lights it (into, at its end); the upper or lower half of
  a row shows a line (before or after it, in its folder); the lower half of an open folder: at its top inside. A
  folder over itself or over one inside it shows nothing and does nothing.
- Move to folder...: a window with the tab's folders as a tree under the tab's own name (the top level); the folder
  the entry is in selected; the entry itself and the folders inside it greyed out.
- Move to and Copy to: an entry at the tab's top keeps plan 26's behaviour (Move to in place, Copy to beside it); one
  inside a folder goes to the other tab's top, at the end. A copy of a folder copies everything in it, each with its
  own id and without keys.

### 6.5 Removing a folder

- The page's op `choose` (MainForm) asks with the page's own buttons through AskForm.Choose: "Remove the folder
  "<name>"?", "It holds <n> entries." (counted when asked), Remove all, Move up, Cancel. Used by Manage's Delete, the
  menu's and the area's Remove, and Del on a quick access folder (item.delete).

### 6.6 Tests

- Unit: BookmarksTests (folders kept and read back nested, their entries in order and their ids; what a folder holds
  on its tab and a folder without a name; Without and RemoveFrom inside folders; a drop into a quick access folder) and
  BookmarkKeysTests in Jint (the keys of bookmarks in folders at any depth, folders no variants of F1; an entry moved
  into a folder, between rows in it, down within it, a folder into itself or one inside it refused, a folder to the
  other tab with what it holds; the top of each tab). `dotnet test`: 224 passed, 0 failed (2026-11-15).
- In the test copy (CDP, real mouse for Manage's handle, UI Automation for the question window): New > Folder...
  Projects; Alpha and Notes dragged by their handles onto Projects (the folder lit); Clients made inside it; note.txt
  into Clients with Move to folder... (the tab's own name at the top, the folder it was in selected); Left and Right on
  Projects; the menu with Projects and Clients as submenus, two levels; Ctrl+B, 1 still opening Notes inside
  Projects; Copy to of Projects (a quick access copy with all in it, without keys); the quick access folders in a tree,
  opened (kept with the pane), a click on a folder (nothing follows), a click on a shortcut in a folder (the list
  follows); removing a quick access folder: Cancel, Move up, Remove all; Move to of a folder inside a folder; a drop
  onto a quick access folder in the tree (lit) and before a row inside it (a line), with synthetic drag events; all
  of it the same after a restart, bookmarks.json holding the folders.
- Not tried in the app: a real shell drag from Explorer into a quick access folder (the host's part is unit tested);
  a real drag of a quick access folder row (its drop was tested with synthetic events); F2 and Del on a quick access
  folder in a tree.
