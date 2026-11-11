# Plan 18: Pane content and shape

Status: executed; see 6. As built.

- 2026-11-11: draft; the part "View settings per pane" of plan 03 (content and tree or list) moved here.
- 2026-11-11: revised: Files is greyed out in a tree.
- 2026-11-11: revised: a tree child has no row for its folder; its lines start at the header.
- 2026-11-11: revised: a tree has the columns of a list, also with folders only.
- 2026-11-12: executed.

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
has something to show under the pane's Show setting: subfolders, or, with files shown, files too. A tree has the same
columns as a list, whatever it shows.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Show | folders, files, both: in the header's menu; a list and a tree honour it; Files greyed out in a tree | 3.1; 3.2; 6.1 |
| Shape | tree or one folder, in the header's menu; the pane's view switches, its state kept | 3.1; 3.3; 6.1 |
| A tree with files | files as rows without an arrow; a click focuses, a double-click opens | 3.2; 6.1 |
| Columns in a tree | the list's columns, plan 11's included; the tree in the name column | 3.3; 6.1 |
| Arrows with files shown | the listing also tells whether a folder has files | 3.4; 6.1 |
| Saved | `kind` and `content` per pane, as now; a new child copies them, as now | 3.5; 6.1 |

### Not yet built

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
- **Columns**: a tree has the same columns as a list, with files and folders and with folders only: a folder has a
  date modified, can have an extension, a Git status, a comment, and later a size (plan 11). The arrows, lines and
  indent are in the name column. Now: name, size and date modified, as a list; with plan 11 the same choice of columns,
  sets and fitting as a list.
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
  files: files under the folders, a folder with only files has an arrow, the columns as in a list; a file in the tree focused: the preview
  shows it; the list to Folders: no files; the list to Tree: its folder opened in place, no row for its folder, the line starting at the header and the rows one
  level in, its child still follows; the
  project closed and opened: the panes as they were set.

## 4. Open questions

None.

## 6. As built

### 6.1 Built (2026-11-12, branch `plan01-foundation`)

- The pane menu: Show (Folders, Files, Folders and files; Files greyed out in a tree) and Shape (Tree, One folder),
  below Branch and Pin, not for a preview. `setPaneContent` reads the pane again; `setPaneShape` makes a new view for
  the same pane (`makeView`, also used now for a new child, a new tab and a saved layout, which before always made a
  list for a child) and keeps its place as 3.3 says.
- `TreeView`:
  - Without a parent: the tops as before. As a child (`folder`): the items of its parent's folder (`load(location)`,
    called by following as a list's is), no row for that folder, the head showing its name, every row one level in so
    the lines start at the head; watched and read again when that folder changes; Up at its top goes to the folder
    above through the parent; a double-click on a folder opens it in the tree only (its parent stays); Back and
    Forward restore its folder and focus.
  - With files: listed with the tree's marks (`tree` on the `list` op); a file is a row without an expander; a click
    focuses it (its children: a preview shows it, a list keeps its folder); a double-click opens it.
  - The columns of plan 11: the header, sorting (every level read so far), moving, resizing, its menu, Fit columns
    (the name counting each row's indent), property values and the Git status of the folders read so far. A tree has
    the pane's generic columns only: "Use a set for this folder" is for a list (a tree shows many folders).
- Host: `ShellListing.List(..., tree)`: for a tree's folders `subs` and, with files shown, `files` (true, `hidden`,
  false), read in one pass that stops once both are settled (`Contents`); a link answers for its target; a shell folder
  gets `files` true (not known without listing it).
- `ListView` honours Show: folders only are listed as such (cheaper); files only leave the folders out.

### 6.2 How it was tested

- `dotnet test`: Failed 0, Passed 141 (`ShellTests.ATreeWithFilesSaysWhichFoldersHaveFiles`: a folder with only files,
  one with only hidden files and a subfolder; the earlier tests of `subs` unchanged).
- Test copy over CDP: the root tree with its column header; Show > Folders and files: files under the folders, a folder
  with only files (`pics`) and one with only a file (`__pycache__`) with an arrow; the tree's Show menu with Files
  greyed out; the list made a Tree: its head `h`, no row for `h`, `one` one level in with the line from the head
  (screenshot), the pane's columns with a size for `a.txt`; the parent on `one`: the child tree on `one`; back to One
  folder: the list on `h`; Show > Folders: only `one`; Files: nothing (h has no files); Files then Tree: Folders and
  files; closed and started again: the tree child and the root's Show as they were; a file focused in the root tree:
  the child tree kept its folder; Fit columns on the tree.
- Not tried: a preview following a file in a tree (no preview pane in the test layout), a double-click on a file in
  a tree (it opens it in its program).
