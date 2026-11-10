# Plan 11: Columns and column sets

Status: draft 2026-11-10; not started.

## 1. What this is about

A list in Foldex shows three things per item, always the same: name, size and date modified, in fixed widths. You
cannot choose other columns (type, created, attributes, dimensions of a picture, length of a song, a path in a
search result), move them, resize them or sort by them, and there is no way to keep a choice of columns for reuse.

## 2. The solution, in brief

A catalogue of columns: Foldex's own fast ones (name, size, type, dates, attributes, extension, path, link target)
and every property Windows knows (the shell's property system). A list pane shows a column set: which columns, in
which order, each with its width, and the sort. You change it in the header (drag to move, drag an edge to resize,
right-click for the columns and the sets) and save it as a named set, to apply to any pane later. Sets are kept in
`columnsets.json` in the data folder; a few ship as defaults.

## 3. Details

### 3.1 The catalogue

- **Own columns**, read with the listing itself (no extra cost): name, size, type (the shell's type name), date
  modified, created, accessed, attributes (as letters: R H S A ...), extension, link target, path (the folder an
  item is in: useful in search results and scraps, plan 06), and for drives in This PC: total and free size.
- **Shell properties**: any property of Windows' property system (`System.Image.Dimensions`, `System.Media.Duration`,
  `System.Author`, ...), listed with their display names by the host (`PSEnumeratePropertyDescriptions`) and read per
  item through `IShellItem2` / the property store. These are slower: read only for the rows in view, on the shell
  thread, in batches, as the own icons are now; the column shows the values as they come.
- A column has an id (`name`, `modified`, or the property's canonical name such as `System.Media.Duration`), a title,
  a kind (text, number, size, date, duration) for alignment, formatting and sorting, and a default width.
- Sorting by a shell property column reads that property for every item first (the status line says so while it
  runs); sorting by an own column is immediate. Natural sort for text, as now.

### 3.2 A pane's columns

- Every list pane has its column set: an ordered list of `{ column, width }` and the sort (column, direction).
  It belongs to the pane, not the branch (plan 03 3.1: the view is per pane); a new child copies it with the other
  settings of the current child (plan 03).
- The header row above the list: a click sorts (again: the other direction); dragging a title moves the column;
  dragging the edge between two titles resizes; the name column always comes first and fills what the others leave
  [not yet decided: fixed name width, see open question 3].
- The header's right-click menu: the columns of the catalogue that are used most (the own ones) with check marks,
  "More columns..." (a searchable list of every shell property), the saved sets to apply, "Save as set...", "Update
  set <name>", "Reset to the default set".
- Widths are in em of the pane font, so a column keeps its share when Ctrl+wheel changes the size (plan 08).
- The tree has no columns.

### 3.3 Column sets

- A set: a name, the columns with their widths and order, and the sort. `columnsets.json` in the data folder holds
  yours; `defaults\columnsets.json` the shipped ones, which yours replace by name.
- Shipped: "Details" (name, size, type, modified; the default for a new pane), "Dates" (name, modified, created,
  accessed), "Pictures" (name, dimensions, date taken, size), "Media" (name, duration, artist, album, bitrate),
  "Documents" (name, authors, title, pages, modified). Which exactly: open question 2.
- Applying a set to a pane copies it into the pane: changing the pane afterwards does not change the set until you
  update the set.
- Sets are the same in every window; with projects (plan 01 3.5) the panes keep their own columns in the project.

### 3.4 Host

- The listing keeps sending the own columns. A new op asks values of shell properties for given items (`columns`:
  ids and property names); the answer comes per batch. The property list for "More columns..." comes once per run.
- `ColumnSetsFile.cs` reads and writes `columnsets.json` (defaults and yours, problems reported as with the ribbon).

### 3.5 Tests

- Unit: `ColumnSetsFile` (yours replaces a shipped set by name; a wrong entry reported and skipped; writing and
  reading back); sorting by kind (numbers, sizes, dates, durations, text naturally) in the page code under Jint.
- Unit (host): a property read for a known file (the dimensions of a test picture, made in the test).
- In the test copy: a new pane shows the Details set; adding Created through the header menu; moving and resizing a
  column; sorting by size and back; "Save as set" writes `columnsets.json`; applying the set to a second pane gives it
  the same columns, order and widths; a shell property column (Dimensions) on a folder of pictures fills in.

## 4. Open questions

1. **Per folder as well?** xplorer2 can remember columns per folder (a pictures folder always with Dimensions). Only
   per pane and sets (this plan), or also a set bound to a folder, applied when a pane goes there?
2. **The shipped sets.** The five of 3.3, fewer, or others?
3. **The name column's width.** Filling what the other columns leave (always the full pane width, no horizontal
   scrolling), or a width of its own like the others (a horizontal scroll bar when the columns are wider than the
   pane, as Explorer)?

## 5. As built

Not built yet.
