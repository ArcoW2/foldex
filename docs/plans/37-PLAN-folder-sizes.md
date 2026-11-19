# Plan 37: Folder sizes (Ctrl+D), kept until something in the folder changes

Status: not started.

- 2026-11-19: draft, at the user's request.

Builds on plan 24 (the folder cache: one read per folder, its watches, its memory), plan 11 / 28 (the columns: Size),
plan 36 (work in the background in the host, told to the windows as it is done). xplorer2's Ctrl+D (folder sizes;
`docs/xplorer2-features.md`, Folder statistics, folder sizes). LexPen has nothing like it. The number in the file
name is the priority; rename to reorder.

## 1. What this is about

A folder's Size column is empty: how much a folder holds (all its files, at any depth) is not shown anywhere. xplorer2
works it out on Ctrl+D and shows it in the Size column. Working it out reads the whole tree under a folder, which can
take long, so it should be done once and kept, not again every time the folder is shown.

## 2. The solution, in brief

Ctrl+D (action `folders.size`) works out the size of the folders of the active pane in the host, in the background:
the focused folder first, then the other selected folders, then every other folder of the pane. Each size shows in
the Size column as soon as it is known, a folder's line marked while it is counted. The sizes are kept in the folder
cache with the folder: shown at once wherever the folder shows again, in any pane or window. A change anywhere in a
folder, at any depth, lets its size go, and the sizes of the folders above it; Refresh lets go of the sizes in the
folder refreshed. Sorting by Size sorts the folders with a size among the files.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Ctrl+D | the action, its key, its order: the focused folder, the selected ones, the rest | open question 1 | 3.1 |
| Counting | the host walks a folder's tree off the window's thread, at low priority; stopped when the pane leaves | -- | 3.2 |
| Shown | the Size column of a folder: its size, marked while counted; the status line's total of the selection with them | Counting | 3.3 |
| Kept | in the folder cache with the folder; shown at once wherever it shows again | Counting | 3.4 |
| Let go | a change at any depth: that folder's size and those above it; Refresh: the folder refreshed and the ones in it | Kept | 3.5 |
| Sorting | by Size, folders with a size among the files | Shown | 3.6 |
| Tests | see 3.7 | -- | 3.7 |

## 3. Details

### 3.1 Ctrl+D

- Action `folders.size` ("Folder sizes"), Ctrl+D (free in the shipped keys.json), in F1 and on the ribbon's View tab
  [where on it: as the ribbon's other view buttons; written when built].
- In the order the user asked for, in the project's words (CLAUDE.md: the focused item is the one the cursor is on,
  the selected ones the ones an action for several items works on): the focused folder first, then the other selected
  folders, then every other folder the pane shows. Whether "the selected folder" and "the highlighted folders" mean
  that: open question 1.
- In a list and in a tree that shows columns (plan 18); a folder that already has a kept size (3.4) is not counted
  again. Ctrl+D again while counting: nothing more (the same folders are on their way).

### 3.2 Counting

- The host walks the folder's tree (files at any depth, their sizes summed; also the number of files and folders, for
  the status line and a tooltip), off the window's thread, at low priority, a folder at a time, as plan 36's jobs.
- Links and junctions are not followed (a loop, or a size counted twice); hidden and system files are counted (they
  take room all the same).
- A share: as any folder, but never while it is unreachable (plan 24 3.8).
- Stopped for a pane that leaves the folder (another folder shown, the pane closed): the folders not yet counted are
  dropped; the ones done are kept (3.4). Whether the rest should go on in the background instead: open question 2.

### 3.3 Shown

- In the Size column of a folder's row, as a file's size is shown; while it is counted a mark in its place (an
  hourglass or "..." [written when built]); a tooltip with the number of files and folders in it.
- The status line's total of the selection counts a selected folder's size when it has one, and says when some
  selected folders have none.

### 3.4 Kept

- With the folder in the folder cache (plan 24): its size, files and folders, until let go (3.5) or until the cache lets
  the folder go (memory). Any pane, in any window, showing that folder's row shows the size at once.
- Not kept across a restart: the cache lives as long as Foldex runs. Whether sizes should be kept on disk: open
  question 3.
- Its memory counts toward the cache's (a few numbers per folder).

### 3.5 Let go

- A change anywhere in a folder, at any depth (a file made, deleted, grown, renamed, a folder moved in or out), lets
  go of that folder's size and of the sizes of every folder above it (their totals hold it); the panes showing them
  show the size empty again (not counted again by themselves: Ctrl+D does that).
- To see a change at any depth the host watches the tree of every folder with a size (one watch with its subfolders
  per folder sized, as Windows can), not only the folders it caches; the watch goes with the size.
- Refresh (F5) lets go of the sizes of the folder refreshed and of the folders in it, as it lets go of its read (plan
  24) and its filter results (plan 36).

### 3.6 Sorting

- Sorted by Size, a folder with a size sorts by it, among the files (folders first stays as the column sort has it,
  plan 28 3.4); a folder without one sorts as now. A size coming in while sorted by Size: the row moves to its place.

### 3.7 Tests

- Unit (host): a folder's size, files and folders counted, links not followed; a file grown three folders down lets go
  of the size there and of the sizes above; F5 lets go; a share that is down is not touched.
- In a test copy: Ctrl+D on a folder with a focused folder and two selected: the focused one counted first, then the
  selected, then the rest; the sizes in the Size column and the selection's total; another pane on the same folder
  shows them at once; a file added deep down: the sizes above it gone; F5: gone; sorted by Size.

## 4. Open questions

1. **Which folders first.** Is "the selected folder" the focused one (the cursor) and "the highlighted folders" the
   selected ones, as the plan reads it now (3.1)?
2. **When the pane leaves.** Stop counting the rest (as written) or go on in the background, so the sizes are there when
   the folder is shown again?
3. **Kept across a restart.** Only while Foldex runs (as written), or on disk too (then checked against the folder's
   date when shown, which says nothing of changes deeper down)?
