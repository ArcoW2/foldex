# Plan 42: Compare two folders

Status: not started; see Status.

- 2026-11-26: draft.

Takes plan 01's "Folder compare, from LexPen" part (plan 01 3.3) into a plan of its own. LexPen's folder compare is
the model: `..\LexPen\src\FolderCompare.cs`, its plan `..\LexPen\docs\plans\executed\PLAN-file-compare.md` 3.5, and
`..\LexPen\docs\features.md` ("Compare two folders").

## 1. What this is about

Foldex cannot compare two folders: which files are equal, which differ, which are on one side only, down through the
subfolders. xplorer2 has it (Synchronize / compare folders, `docs/xplorer2-features.md`), and so has LexPen, from which
Foldex takes its parts.

## 2. The solution, in brief

LexPen's folder compare, taken over as Foldex's own copy: both trees listed by the host, each file marked equal,
different, to check or on one side only, first by size and date, then by contents in the background, with Stop. The
result is a pane of its own showing one tree of both folders with a mark column, docked or floating as any pane. A
double click on a file pair hands the two files to LexPen's compare. Read-only, as LexPen's: nothing on disk changes.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The host's compare | both trees listed and merged, the marks, the content check in the background with Stop | -- | 3.1 |
| The compare pane | one tree of both folders, the marks, Differences only, Stop | open question 1 | 3.2 |
| Starting it | the action Compare folders..., which two folders it takes | open question 3 | 3.3 |
| A file pair in LexPen | a double click (or Enter) on a file pair: `LexPen.exe --compare a b` | -- | 3.4 |
| Copying across | the selected rows copied to the other side | open question 2 | 3.5 |

## 3. Details

### 3.1 The host's compare (as LexPen)

- `FolderCompare.cs` copied from LexPen: both trees walked (reparse points not followed, folders that cannot be read
  skipped, `.git` left out), merged by path relative to each folder, sorted folders first, then by name ignoring case.
- A row's mark: `=` equal (same size, dates within 2 seconds, as FAT keeps them), `~` different (another size), `?`
  to check (same size, another date), `<` only on the left, `>` only on the right; a folder on one side only is
  marked as a whole; a folder on both sums up what is inside it.
- The second pass, on a thread of its own and cancellable: the `?` files compared byte by byte (`SameBytes`, stops at
  the first difference), each result sent to the page as it comes; a file that cannot be read is marked `!`.
- Where Foldex differs: no text compare with Ignore whitespace / case (`SameText`). Those are the options of LexPen's
  file compare, which Foldex does not have; a file pair that differs is opened in LexPen for that (3.4).
- Folders on disk only (paths), not shell locations such as the Recycle Bin or a zip: `FolderCompare` walks the file
  system, as LexPen's does. A folder that is not on disk is refused with a message.

### 3.2 The compare pane

- A pane of its own kind, after LexPen's folder pane in compare mode: its head shows both paths, its rows one tree of
  both folders with the columns of each side (size and date modified, left and right) and the mark. Expand and
  collapse, the keys and the cursor as in a folder pane.
- Show: all, or the differences only (the equal rows hidden; a folder stays when something inside differs).
- Stop ends the second pass; Again lists both folders again.
- Docked and floating, as every pane (plan 14 3.7 gets its row when built).
- Words: the *selected* rows are the ones an action for several works on (copy across, 3.5); the *focused* row is the
  one a double click or Enter opens (3.4).

### 3.3 Starting it

- The action `folders.compare`, "Compare folders...", in F1, the ribbon (Tools) and a folder's own Foldex menu
  (plan 40), with the two folders it takes as open question 3 decides.
- Where LexPen also has `--compare old new` on the command line: Foldex the same, `Foldex.exe --compare <A> <B>`,
  handed to a running Foldex as any later launch (plan 01 3.2).

### 3.4 A file pair in LexPen

- A double click or Enter on a focused file that is on both sides: LexPen's file compare,
  `LexPen.exe --compare <left> <right>`, found by its registration as Open in LexPen is (`MainForm.cs`, op
  `openLexPen`). A file on one side only opens as a double click in a folder pane does.
- LexPen not installed: the status line says so, as Open in LexPen does.

### 3.5 Copying across

- The selected rows copied to the other side (`<<` / `>>`), through `IFileOperation` with Windows' own conflict and
  permission dialogs (plan 05), the rows compared again afterwards. This is the synchronize half of xplorer2's
  feature; LexPen's compare is read-only. Whether it is part of this plan: open question 2.

### 3.6 Tests

- Unit (the host): the listing and the marks on two test trees in a temporary folder (one side only, another size,
  same size and another date, a folder on one side, `.git` left out), `SameBytes`, the second pass cancelled. LexPen's
  `FolderCompareTests.cs` is the start.
- Unit: `--compare` in the arguments (two folders, a wrong count).
- In the app (the test copy over the debugging port): a compare of two test folders, the marks, Differences only,
  Stop, the pane docked and floating.

## 4. Open questions

1. **Where the result shows.** One pane with a tree of both folders, as LexPen's folder pane in compare mode
   (written in 3.2), or the marks in two panes side by side, each showing its own folder, as xplorer2 does?
2. **Copying across (3.5).** In this plan, or read-only first as LexPen's, with copying a plan of its own (with
   xplorer2's Synchronize and Backup copy rows)?
3. **Which two folders.** Suggestion: two selected folders in one pane; else the active pane's folder and the
   folder of the other pane of its parent (as Open in the other pane finds it); else a picker for the second.
4. **Kept in the project.** LexPen compares again when a project with a compare opens. Should a compare pane be kept
   with the project's layout (plan 15), or close with the window?
