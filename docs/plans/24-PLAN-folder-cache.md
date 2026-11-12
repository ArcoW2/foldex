# Plan 24: One read per folder: a folder cache with read-ahead

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request.

Builds on the listing (src/Shell/ShellListing.cs, MainForm.List), the folder watchers (src/Shell/FolderWatch.cs,
plan 03 3.8) and the progress bar of the status line. The number in the file name is the priority; rename to reorder.

## 1. What this is about

- Every pane reads its folder itself. Opening a folder in the tree while its file pane follows reads that folder twice
  at the same time: the file pane all of it, the tree its folders (and for each of them whether it has folders in
  it). Going back to a folder read a moment ago reads it again. Each read has its own count, so the progress bar has
  two totals that come at different moments.
- Nothing is read before it is asked for: the next folder you open always starts from nothing.

## 2. The solution, in brief

The host gets one folder cache for all windows, between the panes and the disk. A folder is read once, whoever asks
for it; a second pane asking while it is being read gets what is read so far and the rest as it comes. The cache
keeps the bare read of a folder (names, attributes, sizes, dates) and the extras per item as far as they were needed:
icons for a pane that shows the items, for a tree whether each folder has folders in it. A request for folders only
gets the cached folders and only the extras still missing; a request for files and folders later adds what folders
only did not need. Every cached folder is watched: a change on disk is put into the cache as it is reported (an item
added, gone, renamed or changed), and a folder whose changes were lost is read again. In the background, at low
priority and only on local drives, the cache reads ahead the folders you are likely to open next, and stops as soon
as you open something yourself.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The cache | per folder the bare read, the extras per kind, shared by all windows and requests | -- | 3.1; 3.2 |
| Shared reads | a request joining a read under way; per-request stop | The cache | 3.3 |
| Kept current | the watch on every cached folder, changes put in, lost changes read again | The cache | 3.4 |
| Leaving the cache | how long a folder no pane shows is kept | The cache; question 1 | 3.5 |
| Read-ahead | the folders likely next, in the background | Kept current; question 2 | 3.6 |
| Other places | network and cloud folders, shell places | Kept current; question 3 | 3.7 |
| The progress bar | one count per folder | Shared reads | 3.8 |
| Tests | unit and in the app | the others | 3.9 |

## 3. Details

### 3.1 What a cached folder holds

- The bare read: per item its name, attributes (folder, hidden, system), size and the dates, as Windows' folder read
  gives them in one pass (it always returns files and folders together: asking for folders only makes the read
  itself no cheaper). The count of the folder is the number of items in it, known when this read is done.
- The extras, worked out per item only when a request needs them:
  - the icon (and whether the file has an icon of its own): for a pane showing the items;
  - for a folder, whether it has folders (and files) in it: for a tree, which shows an expander by it.
- What a folder's entries are made of for a request is what `ShellListing.DiskEntry` and `Contents` give now; the
  page sees the same entries as today.

### 3.2 Requests

- A request (a pane's listing, a tree's level) says the folder and what it wants: folders, or files and folders, and
  whether as a tree (the folder check). The answer comes as now: in batches ("listing"), then done ("listed").
- Cached with the extras it needs: answered at once, all of it.
- Cached without some extras: the items answered at once, the missing extras worked out and sent as they come (an
  icon arriving after its row is drawn, as icons do now for other places).
- Not cached: read, and answered in batches while it is read (as now).
- Folders only, then files and folders: the second gets the folders at once and only the extras the files need; the
  read is not done again.

### 3.3 Shared reads

- One read per folder at a time. A request for a folder being read joins it: it gets what is read so far, then the
  rest with the other requests.
- Each request can be stopped by itself (its pane goes elsewhere: today's cancel per channel). The read goes on while
  any request, the cache or read-ahead (3.6) still wants it; with none left it stops, and what it read so far is
  not kept (a folder half read is not a cached folder).
- The STA thread per listing stays (a slow folder must not hold up another).

### 3.4 Kept current

- Every cached folder is watched (FolderWatch, now for the cache rather than per window; the windows are told of a
  change through the cache). The watch starts before the folder is read, and changes reported during the read are put
  in after it, so a change made while the folder was read is not lost.
- A change is put into the cache as it is reported: an item created (read and added), deleted (taken out), renamed
  (its name changed), changed (its size, date, attributes read again). The panes showing it get the change as now
  (the folder is read again from the cache; nothing goes to the disk for the items that did not change).
- When Windows loses changes (its buffer runs over, reported as an error), the folder is read again whole.
- Local drives: one watcher per drive, over all its folders, instead of one per folder (one handle; a change in a
  folder that is not cached is ignored). Whether that costs more than it saves on a busy drive (a browser's cache,
  a build): [not yet calculated]; one watcher per cached folder is the fallback.
- How soon a change is in the cache after it happens on disk: [not yet calculated]; it is measured in the tests
  (3.9).

### 3.5 Leaving the cache

- A folder some pane shows stays. One no pane shows stays as long as question 1 says, and its watch stops when it
  leaves.
- Memory: a cached folder's size per item: [not yet calculated]; measured with D:\temp in the tests.

### 3.6 Read-ahead

- In the background, at the lowest priority, one folder at a time: the folders likely to be opened next (question 2).
- Only on local drives (never a network or cloud folder, never a shell place).
- It stops at once when a request of a pane comes in, and goes on after it.
- Read ahead means the bare read and the folder check (so a tree can open it at once); icons are left for when a pane
  shows the items.

### 3.7 Other places

- Network shares: they report changes too, less reliably; some NAS devices do not report at all. Question 3.
- Cloud folders (Synology Drive, OneDrive): their files are on a local drive (placeholders), changes by the sync
  client are reported as any change; cached as local folders. Reading a placeholder's icon or contents can make the
  client download it: the extras must not open the files (as now).
- Shell places (This PC, the Recycle Bin, a phone): not cached; read as now.

### 3.8 The progress bar

- One count per folder: the cache's read has the count; every request on that folder shares it, so the bar has one
  total per folder however many panes ask.
- A folder answered from the cache does not show the bar.

### 3.9 Tests

- Unit: the cache's merge of folders only and files and folders; a change reported during the read; created,
  deleted, renamed, changed put in; a lost change reading the folder again; a request joining a read and stopping
  alone; leaving the cache.
- In the app (the test copy): D:\temp opened in the tree with its file pane following: one read (the host's log of
  reads), one count, the bar filling once; back to a folder read before: answered at once, no read; a file made, deleted,
  renamed in a cached folder from outside Foldex: in the pane, with the time from the change to the pane measured;
  read-ahead: the next folder opened from the cache; read-ahead stopping when a folder is opened.

## 4. Open questions

1. How long does a folder no pane shows stay in the cache: until memory gets tight, a fixed number of folders, or a
   time limit?
2. Read-ahead: which folders does it read (the focused folder's subfolders, the folder above, both), and how many?
3. Network shares: cached with a check (a quick read of names and dates) when a pane shows them again, or not cached
   at all? (Cloud folders such as Synology Drive are on a local drive and report their changes: cached as local
   folders, 3.7.)
