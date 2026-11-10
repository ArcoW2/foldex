# Plan 11: Columns, column sets and rows

Status: draft 2026-11-10, revised 2026-11-10 (generic columns and sets per folder, Manage sets, fitting the name
column, row lines and stripes, row height); not started.

## 1. What this is about

A list in Foldex shows three things per item, always the same: name, size and date modified, in fixed widths. You
cannot choose other columns (type, created, attributes, dimensions of a picture, length of a song, the Git status of
a file, a path in a search result), move them, resize them or sort by them, and there is no way to keep a choice of
columns for reuse or for a folder. The name column cannot be fitted to the names, so wide lists end in a gap before
the last columns. The rows have no lines or stripes to follow a row across, and their height is tied to the font.

## 2. The solution, in brief

A catalogue of columns: Foldex's own fast ones (name, size, type, dates, attributes, extension, path, link target,
Git status) and every property Windows knows. A list pane shows its generic columns, remembered by themselves as you
change them; a folder can instead use a named column set (Films, Music, a Git set, ...), for itself and if you want
for its subfolders. Sets are made from a pane's columns, applied from the header's menu and kept in
`columnsets.json`; a Manage sets window renames, edits and deletes them. You change columns in the header: drag to
move, drag an edge to resize, Ctrl+R (or automatically) fits them to their content. Rows can have stripes or lines, in
an intensity you set, and a height relative to the pane font.

## 3. Details

### 3.1 The catalogue

- **Own columns**, read with the listing itself (no extra cost): name, size, type (the shell's type name), date
  modified, created, accessed, attributes (as letters: R H S A ...), extension, link target, path (the folder an item
  is in: for search results and scraps, plan 06), and for drives in This PC: total and free size.
- **Git status**: per file and folder in a Git working tree (modified, added, untracked, ignored, ...), from LexPen's
  git status code (plan 01 3.3), read per folder shown; empty outside a working tree.
- **Shell properties**: any property of Windows' property system (`System.Image.Dimensions`, `System.Media.Duration`,
  `System.Author`, ...), listed with their display names by the host (`PSEnumeratePropertyDescriptions`) and read per
  item through `IShellItem2` / the property store. These are slower: read only for the rows in view, on the shell
  thread, in batches, as the own icons are now; the column shows the values as they come.
- A column has an id (`name`, `modified`, `git`, or the property's canonical name such as `System.Media.Duration`),
  a title, a kind (text, number, size, date, duration) for alignment, formatting and sorting, and a default width.
- Sorting by a shell property column reads that property for every item first (the status line says so while it
  runs); sorting by an own column is immediate. Natural sort for text, as now.

### 3.2 Generic columns and sets per folder

- **Generic**: every list pane shows its generic columns wherever it goes, unless the folder has a set (below).
  Changes in the header (add, remove, move, resize, sort) are remembered by themselves, per pane; a new child copies
  them with the other settings of the current child (plan 03).
- **A set for a folder**: in the header's menu, "Use a set for this folder": a set from the list, for this folder
  only or for it and its subfolders. A pane going into such a folder shows that set; leaving it, its generic columns
  again. A subfolder's own choice wins over its parent's. "Back to generic" removes the folder's choice.
- While a folder's set is shown, changes in the header change the pane's copy for now; "Update set <name>" keeps them
  in the set, or "Save as new set..." makes another.
- Folder choices are kept in Foldex's data folder (`foldercolumns.json`: path, set, with subfolders or not), not in
  the folders themselves (no `desktop.ini` written into your folders).
- Use: the Git set (name, Git status, modified) on your source folders and their subfolders; Pictures on a photo
  folder; generic everywhere else.

### 3.3 Column sets

- A set: a name, the columns with their widths and order, the sort, and whether the columns fit by themselves (3.4).
- Shipped (`defaults\columnsets.json`): Generic (name, size, type, modified: also the generic columns of a new pane),
  Dates (name, modified, created, accessed), Pictures (name, dimensions, date taken, size), Music (name, duration,
  artist, album, bitrate), Films (name, duration, frame size, size), Documents (name, authors, title, pages, modified),
  Git (name, Git status, modified). Yours in `columnsets.json` in the data folder replace shipped ones by name.
- **Manage sets** (a window as the settings window, from the header's menu and View on the ribbon): the list of sets;
  rename, delete, duplicate; edit a set's columns (add, remove, order, widths, sort) without a pane; which folders use
  it (and remove a folder's choice). A shipped set changed here becomes yours; "Reset" brings the shipped one back.
- Sets are the same in every window; with projects (plan 01 3.5) the panes keep their generic columns in the project.

### 3.4 The header, and fitting the columns

- The header row above the list: a click sorts (again: the other direction); dragging a title moves the column;
  dragging the edge after a title resizes it; the name column is always first.
- The header's right-click menu: the own columns with check marks, "More columns..." (a searchable list of every
  shell property), the sets to apply, "Use a set for this folder", "Save as new set...", "Update set <name>",
  "Manage sets...", "Fit columns", "Fit by themselves".
- **Fit columns** (Ctrl+R, action `columns.fit`, as xplorer2): every column as wide as its widest value in the folder,
  the name column included, so the other columns come right after the names instead of after a gap. When that is
  wider than the pane, the name column gives way first (down to a minimum, the names cut off with "..."); a
  horizontal scroll bar only when even that does not fit.
- **Fit by themselves**: a switch per pane (and kept in a set): the columns are fitted after every listing and when
  the pane is resized, as Fit columns does.
- Widths are in em of the pane font, so columns keep their proportions when Ctrl+wheel changes the size (plan 08).
- The tree has no columns.

### 3.5 Rows

Settings (the settings window, group Panes; the same for every list):

- `rowLines`: `none`, `stripes` (every other row shaded) or `lines` (a line under each row). Default `none`.
- `rowLinesIntensity`: 1 to 100, how strong the stripes or lines are: the text colour mixed into the background at
  that share (`color-mix` in the CSS), so it suits every theme. Default 6 for stripes, 12 for lines [not yet tried:
  the defaults are set when seen].
- `rowHeight`: the row height as a share of the pane font size, 100% to 300%. Default 170% (the 22 px at 13 px of
  today). The icons follow the row height (plan 08 3.4), so a tall row has larger icons at the same font.
- Selected and hovered rows keep their colours over the stripes.

### 3.6 Host

- The listing keeps sending the own columns. A new op asks values of shell properties for given items (`columns`:
  ids and property names); the answer comes per batch. The property list for "More columns..." comes once per run.
- Git status per folder through LexPen's code, carried over (`GitStatus.cs`).
- `ColumnSetsFile.cs` reads and writes `columnsets.json` and `foldercolumns.json` (defaults and yours, problems
  reported as with the ribbon).

### 3.7 Tests

- Unit: `ColumnSetsFile` (yours replaces a shipped set by name; a wrong entry reported and skipped; writing and
  reading back); a folder's set found for a subfolder when "with subfolders", the nearest choice winning; sorting by
  kind (numbers, sizes, dates, durations, text naturally) and Fit columns (name gives way first) in the page code
  under Jint.
- Unit (host): a property read for a known file (the dimensions of a test picture, made in the test); the Git status
  of files in a test repository made in the test.
- In the test copy: a new pane shows Generic; adding Created through the header menu, moving and resizing a column,
  sorting by size and back, all still there after going to another folder; Ctrl+R fits the name column; "Save as new
  set" writes `columnsets.json`; "Use a set for this folder, with subfolders" on a test repository shows Git status
  there and in a subfolder, and generic columns again outside it; Manage sets renames a set; stripes and lines at two
  intensities in light and dark; `rowHeight` 250% makes rows and icons taller at the same font.

## 4. Open questions

None.

## 5. As built

Not built yet.
