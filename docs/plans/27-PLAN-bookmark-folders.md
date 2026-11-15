# Plan 27: Bookmark folders: bookmarks kept in folders of their own, as a menu with submenus

Status: not started; see Status.

- 2026-11-15: draft, at the user's request.

Builds on plan 26 (`docs/plans/executed/26-PLAN-bookmarks.md`): one list of bookmarks in bookmarks.json, the Bookmarks
menu, Manage with a tab for the bookmarks and one for quick access, Edit. The number in the file name is the priority;
rename to reorder.

## 1. What this is about

The bookmarks are one flat list. With many of them the menu grows long, and bookmarks that belong together (the
projects: LexPen, Foldex, ActiveAnts) cannot be kept together under one name.

## 2. The solution, in brief

The list can hold folders of bookmarks: a folder has a name and holds bookmarks, in your order. In the Bookmarks menu
a folder is a submenu with its bookmarks; in Manage it is a row that opens and closes, its bookmarks under it. New
folder... in Manage makes one; a bookmark is put into a folder, or taken out of it, in Manage and in Edit. A folder is
Foldex's own grouping, nothing on disk: its bookmarks keep their locations, names, icons, keys and way of opening.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The list | folders in bookmarks.json, read and written by the host; each bookmark an entry with its own id | Open questions 1, 2 | 3.1 |
| The menu | a folder as a submenu; its right-click | Open question 3 | 3.2 |
| Manage | folders as rows that open and close; New folder...; in and out of a folder | Open questions 3, 4 | 3.3 |
| Edit | the folder a bookmark is in | Open question 4 | 3.4 |
| Tests | unit and in the app | all | 3.6 |

## 3. Details

### 3.1 The list

- bookmarks.json's `bookmarks` holds bookmarks (as plan 26 3.1) and folders: { folder: name, items: [...] }, where
  items holds that folder's bookmarks in your order. The name is required; two folders may have the same name.
- Every bookmark stays an entry of its own with its id (plan 26 3.1): the same location can be in two folders, or
  twice in one.
- Added from Windows' right-click menu or with Add current folder: at the top level, at the end, as now.
- The key set (plan 26 3.6) and F1 take every bookmark, in folders too.
- In the code the folder is a `group` (`Bookmark` gets Group and Items), so it is never taken for a folder on disk;
  on screen it is a folder, as the user calls it, drawn with a folder icon of its own.

### 3.2 The menu

- A folder is a submenu item (menu.js has submenus): its name, then its bookmarks as the menu's own items are (icon,
  name, Open key, the right-click of plan 26 3.8). An empty folder is shown greyed out.
- The right-click on a folder: Rename... and Remove (3.5, question 3). Nothing else: right-click menus stay short.

### 3.3 Manage

- On each tab (plan 26 3.3) a folder is a row with an expander, its name and a folder icon, its bookmarks indented
  under it; Left and Right close and open it, as in a tree.
- A button New folder... asks its name and puts it after the selected row.
- Edit... on a folder renames it (a name asked); Delete on a folder as 3.5 says.
- Putting a bookmark into a folder and taking it out: question 4.
- Move to quick access / Move to bookmarks on a folder: the folder and all its bookmarks to the other tab
  (question 2).

### 3.4 Edit

- A field Folder (a list of the tab's folders, and "(none)" for the top level): the folder the bookmark is in. Changed,
  the bookmark goes to the end of that folder.

### 3.5 Removing a folder

- Question 3.

### 3.6 Tests

- Unit (BookmarksTests): folders kept and read back with their bookmarks in order, ids kept;
  plan 26's flat bookmarks.json read as before.
- Page (Jint): the keys of bookmarks in folders in the key set.
- In the test copy: a folder Projects made in Manage with LexPen, Foldex and ActiveAnts in it; the menu with the
  Projects submenu, a bookmark opened from it and by its key; the folder renamed, a bookmark taken out of it; kept
  after a restart.

## 4. Open questions

1. Folders inside folders (Projects > Clients > ActiveAnts), to any depth, or one level only?
2. Folders on the Quick access tab too: a folder row in the trees' Quick access area with its shortcuts under it
   (opened and closed as any row there), or folders only for the Bookmarks menu?
3. Removing a folder that holds bookmarks: are its bookmarks removed with it (after a question), or do they move up
   to where the folder was?
4. How a bookmark goes into a folder and out of it in Manage: Up and Down passing into and out of folders (as in a
   browser's bookmark manager), dragging a row onto a folder, a "Move to folder..." button, or only the Folder field
   in Edit (3.4)? More than one can be chosen.
