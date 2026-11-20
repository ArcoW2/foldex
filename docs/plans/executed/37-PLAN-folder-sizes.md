# Plan 37: Folder sizes (Ctrl+D, or automatic), kept while Foldex runs

Status: executed; see As built (section 6).

- 2026-11-19: draft, at the user's request.
- 2026-11-19: executed.

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

| Part | What | Reference |
|---|---|---|
| Ctrl+D | the action, its key, its order: the focused folder, the selected ones, the rest | 3.1; 6.1 |
| Automatic | the setting: every folder a pane shows counted by itself; off by default; shares only when they are cached | 3.2; 6.2 |
| Counting | the host walks a folder's tree off the window's thread, at low priority, a record per folder; going on when the pane leaves | 3.3; 6.3 |
| Shown | the Size column of a folder: its size, marked while counted; the status line's total of the selection with them | 3.4; 6.4 |
| Kept | in the folder cache, under its budget; shown at once wherever the folder shows again; the ones no window shows going first when over it | 3.5; 6.5 |
| Changes | a change: that folder's own files read again, the difference added up the chain; lost changes and Refresh: counted again or let go | 3.6; 6.6 |
| Sorting | by Size, folders with a size among the files | 3.7 |
| Size format | at the user's request during the build: sizes in bytes or short, the tooltip in every unit | 6.7 |
| Tests | see 3.8 | 3.8; 6.8 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 Ctrl+D

- Action `folders.size` ("Folder sizes"), Ctrl+D (free in the shipped keys.json), in F1 and on the ribbon's View tab,
  group Columns, under Fit all columns.
- The order (CLAUDE.md: the focused item is the one the cursor is on, the selected ones the ones an action for several
  items works on): the focused folder first, then the other selected folders, then the rest of the folders the pane
  shows.
- In a list and in a tree that shows columns (plan 18); a folder that already has a kept size (3.5) is not counted
  again. Ctrl+D again while counting: nothing more (the same folders are on their way).

### 3.2 Automatic

- A setting "Count folder sizes automatically" (`folderSizesAuto`, a toggle, off by default), in the settings window's
  Contents tab, group Columns. Off by default because one folder shown can start a walk of a whole drive.
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

- In the Size column of a folder's row, as a file's size is shown; while it is counted "..." in its place (tooltip
  "Being counted"); a tooltip with the number of files and folders in it.
- The status line's total of the selection counts a selected folder's size when it has one, and says when some
  selected folders have none.

### 3.5 Kept

- With the folder cache (plan 24), apart from its folders' reads: per folder its size, the size of its own files (for
  3.6), its files and folders. Any pane, in any window, showing that folder's row shows the size at once.
- Only while Foldex runs; not on disk. Kept across a restart it would almost always be changed, and a folder's date
  says nothing of changes deeper down, so it would not be reliable.
- Under the cache's one budget (`folderCacheMB`), no budget of its own. A record takes 327 bytes, measured on the built
  record (FolderSizesTests.WhatARecordTakes: 2001 records, paths of 94 characters); the budget counts it so
  (FolderSizes.RecordBytes).
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

## 6. As built

### 6.1 Ctrl+D

- `folders.size` in actions.js (group View), Ctrl+D in keys.json, a button in the shipped ribbon.json (View, Columns).
  A ribbon of your own (ribbon.json in the data folder) does not get the button by itself: add it in the ribbon's
  change mode.
- It runs in the pane's page (a list or a tree, a scrap too): `countSizes` on ListView and TreeView. A list: the
  focused folder, the other selected folders, then the other folders it shows. A tree (it has no selection): the focused
  folder, then the other folders it shows.
- The page marks the folders it asked for as being counted and posts them (`sizeFolders`); the host puts them before
  what was asked earlier.

### 6.2 Automatic

- After a list is read (and after a folder came in item by item) the page asks the host what it knows of its folders
  (`folderSizes`) and, with the setting on, counts the rest. A tree asks for the folder rows it draws, once each, and
  only when it shows the Size column. Switching the setting on counts the lists shown at once.
- A share with Cache network shares off: the host says it is skipped, the mark goes.

### 6.3 Counting

- `src/Shell/FolderSizes.cs`: one worker thread at below-normal priority, its disk reads at background priority
  (THREAD_MODE_BACKGROUND_BEGIN); it waits while the folder cache answers a window (`Busy`).
- One walk at a time: a folder asked for while a large tree is walked waits for that walk.
- A walk takes a folder in it that has a record as it is (kept current), so counting a folder above folders counted
  before only reads what is new.
- A folder in the tree that cannot be read counts as empty; the folder asked for itself: skipped.

### 6.4 Shown

- columns.js keeps the sizes told by path (`folderSizes`); the Size column, its sort and its tooltip read them, so a
  list, a tree and a scrap show the same.
- There was no total of the selection in the status line before this plan: now, with more than one item selected,
  "N selected: size", and "; n folders without a size (Ctrl+D)" when some selected folders have none.

### 6.5 Kept

- The folder cache counts the records in its budget (`ExtraBytes`); over it, the cache lets go of its folders first (a
  folder is read again sooner than a tree is walked again), then the records: only ones with none under them, the
  deepest and the ones used longest ago first, never one in a folder a window shows. Its parent is marked, so a
  deletion there is not mistaken for a file's.
- The settings window's memory figure for the folder cache counts the records too.

### 6.6 Changes

- The watch (with its subfolders) is on the folder a counted folder is in, not on each counted folder: the folders
  counted in one list share one watch; a watch above makes the ones under it go. A watch goes when no record is under
  it any more.
- A change is put in once things are quiet for 300 ms. Changes under a folder being walked wait for its walk; each
  change is put in so that seeing it twice does no harm (a folder made: counted, the difference with what was known
  added).
- A watch that cannot be made (some shares): the size is told, not kept.
- F5 lets go in the host when the list or tree asks its folder from disk again (MainForm `list` with `fresh`).

### 6.7 Size format (asked during the build)

- Setting `sizeFormat` (Contents > Columns, "Sizes"): short (1.9 MB, as before) or in bytes (1,966,080, with the
  separators of Windows' language). Every column of kind size follows it; they sort by the bytes either way.
- A size cell's tooltip: the bytes, then KB, MB, GB and TB as far as the size reaches (MB too, between KB and GB); a
  folder's adds its files and folders.

### 6.8 A folder read whole (asked after the build)

- A folder the cache reads from disk whole (a pane opens it) gets its size from that read, without a walk and whatever
  the setting, when every folder in it (links not counted) has a record; one with no folders in it always does. So
  going up from a folder just opened shows its size, and going up again from a folder whose folders all have one.
  FolderCache `ReadWhole` tells FolderSizes `Listed` on the thread pool, for a folder read from disk and for one shown
  from the cache; the record is kept current as a counted one (the same watch on the folder it is in).
- It passes up: a size made (so, or counted with Ctrl+D) makes the folder above it the same way when the cache holds
  that one whole (`ItemsOf`), and so on up, without reading anything again.
- A change made between the cache's read and the watch starting is not seen; F5 counts the folder again.
- Tests: FolderSizesTests.AFolderReadWholeGetsItsSizeWhenEveryFolderInItHasOne (a folder with an unknown folder in it
  stays without; read up from the deepest, no walk; the folders above, held by the cache, get theirs when the last
  unknown folder in them is read, without a read of their own; a change added up). In a test copy, the setting off: a folder
  with two files opened, then its parent: the folder's size shown there (3.9 KB). All tests: 296 passed.

### 6.10 A folder of tens of thousands of folders (2026-11-20, a hang the user found)

- The user's D:\temp holds 50338 folders and 1622 files (counted then); going to another folder and back hung the pane
  for minutes. Profiled in a test copy (the pane sorted on size, sizes counted by themselves): going away took 271 s,
  214 s of them in `askFolderSizes`, which searched the host's answer through again for every folder (quadratic). The
  host did the same: `Known` and `Count` searched the queue per folder, and `Listed` (6.8) went through all of the
  folder's items again after each of its folders was counted.
- Now: the answer made a map once (`askFolderSizes`); the queue has an index (`queued`); `Listed` keeps per folder its
  folders and how far the check came (`waitingFolders`), checks from the start again only when a record went
  meanwhile; an entry keeps its size key (`sizeK`, a sort on size asked for it in every comparison).
- Measured in the same test copy: away 52 ms, back 713 ms, the longest block of the page 155 ms; the host counting
  about a thousand folders a second, a little over one core (its background work, as the setting asks).

### 6.9 Tests

- Unit (FolderSizesTests): a tree counted with a record per folder and no read of the cache; a junction not followed;
  a file grown three folders down, a file made, a folder deleted and a folder made, each added up by its difference;
  F5; over the budget the deepest records go and a change under one that went lets go of the ones above; what a record
  takes. All tests: 293 passed.
- In a test copy (CDP): Ctrl+D in a list with three folders: their sizes, the tooltips with files and folders; a file of
  5 MB written two folders down: the folder's size grew without counting again; sorted by Size descending; two items
  selected: the total in the status line; F5: the sizes gone; the setting on: counted after the list was read again;
  sizes in bytes and the tooltips in every unit.
- Not tried in a test copy: a share, a tree with the Size column, a watch losing changes (covered by code only), the
  memory budget filling up (covered by the unit test).

