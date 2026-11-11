# Plan 18: Pane content and shape

Status: not started; see Status.

- 2026-11-11: draft; the part "View settings per pane" of plan 03 (content and tree or list) moved here.
- 2026-11-11: revised: Files is greyed out in a tree.
- 2026-11-11: revised: a tree child has no row for its folder; its lines start at the header.

Builds on plan 03 (panes of one kind, following) and plan 12 (the pane header's menu). The number in the file name is
the priority; rename to reorder.

## 1. What this is about

Plan 03 makes every pane the same kind, showing a folder's folders, files or both, as a tree or as a list. The layout
keeps both per pane (`kind` and `content`), but nothing changes them: the root is a tree of folders and every other
pane a list of folders and files, for good. A list ignores `content`, and a tree cannot show files.

## 2. The solution, in brief

The pane header's menu gets two settings. Show: folders, files, or both. Shape: a tree, where a folder can be opened in
the pane itself, or one folder, which shows only that folder's own items and opens nothing in place. Any pane can have
any combination but a tree of files only, root or child, and keeps it with its layout in the project. A folder in a tree gets an arrow when it
has something to show under the pane's Show setting: subfolders, or, with files shown, files too.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Show | folders, files, both: in the header's menu; a list and a tree honour it; Files greyed out in a tree | -- | 3.1; 3.2 |
| Shape | tree or one folder, in the header's menu; the pane's view switches, its state kept | -- | 3.1; 3.3 |
| A tree with files | files as rows without an arrow; a click focuses, a double-click opens | open question 1 | 3.2 |
| Arrows with files shown | the listing also tells whether a folder has files | -- | 3.4 |
| Saved | `kind` and `content` per pane, as now; a new child copies them, as now | -- | 3.5 |

## 3. Details

### 3.1 The header's menu

- Two submenus in the pane header's menu (plan 12 3.2), below Branch and Pin, each a choice with a check mark:
  - **Show**: Folders, Files, Folders and files;
  - **Shape**: Tree, One folder.
- A change applies at once, to that pane only, and is saved with the layout. Not for a preview pane.

### 3.2 Show

- One folder: Folders lists only the subfolders; Files only the files; both, as a list does now.
- Tree: Folders as the root tree now; Folders and files puts each folder's files under its subfolders, as rows without
  an arrow. Files is greyed out in a tree's menu: a tree needs folders to open. A pane showing Files that is switched to
  Tree shows Folders and files.
- In a tree with files: a click on a file focuses it (its children follow it, as a list's do: a preview shows it);
  a double-click opens it as Windows does, as in a list.
- The listing asks the host for what is shown (now `foldersOnly`; then folders, files or both), so a pane of folders
  does not read every file's icon.

### 3.3 Shape

- **Tree**: folders open and close in the pane (the arrow, Right and Left, a double-click). The top rows: for a pane
  without a parent, the tree's tops as now (your profile folder, This PC, Network, the Recycle Bin); for a child, the
  items of the folder its parent focuses.
- **A tree child has no row for its folder**: the header already names it. The parent on `Win32App`: the child's
  header says `Win32App` and its first row is `_Scribbles`. The tree's lines start at the top of the pane, against the
  header, as if they came from its name, and every row moves one level to the right to make room: the top rows are
  joined to that line as children of the header. One folder (no tree) has no line and no extra step.
- **One folder**: the folder's own items; a double-click on a folder opens it through the parent, or in the pane
  itself without one (plan 03 3.3), as a list does now.
- Switching keeps the pane's place: from tree to one folder it shows its focused folder; from one folder to tree it
  opens the tree down to the folder it showed, focused.
- What follows the pane is the item focused in it, in either shape, so a child follows a tree child as it follows a
  list.
- Switching makes a new view for the pane (`TreeView` or `ListView`) with the same id, connections and states per
  branch.

### 3.4 The arrow

- Now: the tree's listing gives each folder `subs` (true, `hidden`, false; plan 16). With files shown, an arrow also
  for a folder with files: the listing gives `files` the same way (true, `hidden`, false), read in the same pass,
  which stops at the first item that settles it.
- A link answers for its target, as for `subs`.

### 3.5 Saved

- `kind` (`tree`, `list`) and `content` (`folders`, `files`, `both`) per pane are in the layout already, in the window's
  session in its project (plan 15). Layouts saved before keep what they had: a tree of folders and lists of both.
- A new child copies the current child's settings (plan 03 3.4), as now.
- The default layout (plan 03 3.5) is unchanged: the root a tree of folders, its child one folder of both.

### 3.6 Tests

- Unit (C#, `ShellListing`): a listing of files only, of folders only; `files` true, `hidden`, false.
- Unit (Jint, `panes.js`): a new child copies kind and content; switching shape keeps the states per branch.
- Test copy over CDP: the header's menu shows both submenus with the current choice checked, Files greyed out in a
  tree; a list showing Files switched to Tree: Folders and files; the root to Folders and
  files: files under the folders, a folder with only files has an arrow; a file in the tree focused: the preview
  shows it; the list to Folders: no files; the list to Tree: its folder opened in place, no row for its folder, the line starting at the header and the rows one
  level in, its child still follows; the
  project closed and opened: the panes as they were set.

## 4. Open questions

1. **Columns in a tree with files.** Proposed: names only, as the tree now; size and date columns come with plan 11
   (columns). Agreed?
