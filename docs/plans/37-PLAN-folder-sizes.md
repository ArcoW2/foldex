# Plan 37: Folder sizes (Ctrl+D, or automatic), kept while Foldex runs

Status: not started.

- 2026-11-19: draft, at the user's request.

Builds on plan 24 (the folder cache: one read per folder, its watches, its memory), plan 11 / 28 (the columns: Size),
plan 36 (work in the background in the host, told to the windows as it is done). xplorer2's Ctrl+D (folder sizes;
`docs/xplorer2-features.md`, Folder statistics, folder sizes). LexPen has nothing like it. The number in the file
name is the priority; rename to reorder.

## 1. What this is about

A folder's Size column is empty: how much a folder holds (all its files, at any depth) is not shown anywhere. xplorer2
works it out on Ctrl+D and shows it in the Size column. Working it out reads the whole tree under a folder, which can
take long, so it should be done once and kept, not again every time the folder is shown. A setting should do it
without Ctrl+D, for every folder shown.

## 2. The solution, in brief

Ctrl+D (action `folders.size`) works out the size of the folders of the active pane in the host, in the background:
the focused folder first, then the other selected folders, then the rest of the pane's folders; it goes on when the
pane shows another folder. A setting (off by default) does the same by itself for every folder a pane shows. Each size
shows in the Size column as soon as it is known, a folder's row marked while it is counted. Counting walks the disk
without filling the cache with the files it passes, and keeps one small record per folder (its size, its own files'
size, files and folders) for every folder in the tree, so a subfolder's size is there at once. The records are kept
in the folder cache, under its one memory budget, while Foldex runs; not across a restart. A change in a folder is
added to its size and to the sizes above it by the difference, so a busy drive is not counted again and again;
Refresh lets go of the sizes in the folder refreshed. Sorting by Size sorts the folders with a size among the files.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Ctrl+D | the action, its key, its order: the focused folder, the selected ones, the rest | -- | 3.1 |
| Automatic | the setting: every folder a pane shows counted by itself; off by default; shares only when they are cached | Counting | 3.2 |
| Counting | the host walks a folder's tree off the window's thread, at low priority, a record per folder; going on when the pane leaves | -- | 3.3 |
| Shown | the Size column of a folder: its size, marked while counted; the status line's total of the selection with them | Counting | 3.4 |
| Kept | in the folder cache, under its budget; shown at once wherever the folder shows again; the ones no window shows going first when over it | Counting | 3.5 |
| Changes | a change: that folder's own files read again, the difference added up the chain; lost changes and Refresh: counted again or let go | Kept | 3.6 |
| Sorting | by Size, folders with a size among the files | Shown | 3.7 |
| Tests | see 3.8 | -- | 3.8 |

## 3. Details

### 3.1 Ctrl+D

- Action `folders.size` ("Folder sizes"), Ctrl+D (free in the shipped keys.json), in F1 and on the ribbon's View tab
  [where on it: as the ribbon's other view buttons; written when built].
- The order (CLAUDE.md: the focused item is the one the cursor is on, the selected ones the ones an action for several
  items works on): the focused folder first, then the other selected folders, then the rest of the folders the pane
  shows.
- In a list and in a tree that shows columns (plan 18); a folder that already has a kept size (3.5) is not counted
  again. Ctrl+D again while counting: nothing more (the same folders are on their way).

### 3.2 Automatic

- A setting "Folder sizes: count automatically" (`folderSizesAuto`, a toggle, off by default) [its group in the
  settings window: written when built]. Off by default because one folder shown can start a walk of a whole drive.
- On: every folder a pane shows is counted as Ctrl+D would (3.1's order, the focused folder first), when the pane
  shows it; a folder with a kept size is not counted again.
- Shares only when "Cache network shares" (`cacheNetwork`) is on, and never while one is unreachable (plan 24 3.8).
- At the lowest priority of the host's background work: a read for a pane or a filter (plan 36) goes first.

### 3.3 Counting

- The host walks the folder's tree (files at any depth, their sizes summed; also the number of files and folders, for
  the status line and a tooltip), off the window's thread, at low priority, a folder at a time, as plan 36's jobs.
- The walk reads the disk itself, not through the folder cache: the files it passes are not put in the cache (a walk
  of a drive would push out every folder worth keeping). What it keeps is a record per folder in the tree (3.5): the
  walk of one folder gives the sizes of every folder under it.
- Links and junctions are not followed (a loop, or a size counted twice); hidden and system files are counted (they
  take room all the same).
- Going on when the pane shows another folder or is closed: the folders asked for are counted in the background all
  the same, so their sizes are there when they are shown again. Foldex closing stops it.

### 3.4 Shown

- In the Size column of a folder's row, as a file's size is shown; while it is counted a mark in its place (an
  hourglass or "..." [written when built]); a tooltip with the number of files and folders in it.
- The status line's total of the selection counts a selected folder's size when it has one, and says when some
  selected folders have none.

### 3.5 Kept

- With the folder cache (plan 24), apart from its folders' reads: per folder its size, the size of its own files (for
  3.6), its files and folders. Any pane, in any window, showing that folder's row shows the size at once.
- Only while Foldex runs; not on disk. Kept across a restart it would almost always be changed, and a folder's date
  says nothing of changes deeper down, so it would not be reliable.
- Under the cache's one budget (`folderCacheMB`), no budget of its own. Measured: a record takes about 275 bytes (a
  table of path to four numbers, 119145 folders under D:\temp, paths of 78 characters on average; PowerShell,
  2026-11-19); the count used for the budget is set from a measurement of the built record [not yet measured].
- Over the budget: the records of folders no window shows go first, the ones used longest ago and the deepest first; a
  folder's total stays right when the records under it go. A record a window shows never goes. A folder whose record
  went is counted again when it shows with the setting on (3.2), or on Ctrl+D: disk time, never a wrong size.

### 3.6 Changes

- To see a change at any depth the host watches the tree of every folder counted (one watch with its subfolders per
  folder counted at the top, as Windows can), not only the folders it caches; the watch goes with the record.
- A change in a folder (a file made, deleted, grown, renamed): that folder's own files are read again (that folder
  only, not its tree), and the difference with its kept own size is added to its size and to the size of every folder
  above it. A folder made or moved in is counted (3.3) and added up the chain; one deleted or moved out is taken off.
  So a drive that changes all the time (temp files, logs) is not counted again and again.
- A change in a folder whose record went (3.5): the difference is not known, so the folders above it let go of their
  size, and are counted again as 3.5 says.
- Changes lost (the watch's buffer ran over): the tree of that watch is counted again.
- Refresh (F5) lets go of the sizes of the folder refreshed and of the folders in it, as it lets go of its read (plan
  24) and its filter results (plan 36); with the setting on they are counted again.

### 3.7 Sorting

- Sorted by Size, a folder with a size sorts by it, among the files (folders first stays as the column sort has it,
  plan 28 3.4); a folder without one sorts as now. A size coming in while sorted by Size: the row moves to its place.

### 3.8 Tests

- Unit (host): a folder's size, files and folders counted, links not followed; the walk puts no folder in the cache's
  reads; the records of the folders under it kept; a file grown three folders down adds the difference there and
  above; a folder deleted takes its size off; a change under a dropped record lets go of the sizes above; lost
  changes count the tree again; F5 lets go; a share that is down is not touched; over the budget the records no window
  shows go first.
- In a test copy: Ctrl+D on a folder with a focused folder and two selected: the focused one counted first, then the
  selected, then the rest; another folder shown before it is done, then back: the sizes there; the sizes in the Size
  column and the selection's total; another pane on the same folder shows them at once; a file added deep down: the
  sizes above it grown by its size; F5: gone; sorted by Size; the setting on: a folder opened counts by itself, a
  share not with "Cache network shares" off.

## 4. Open questions

None.
