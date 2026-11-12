# Plan 24: One read per folder: a folder cache with read-ahead

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request.
- 2026-11-12: revised: the cache kept until memory gets tight, with a memory setting; read-ahead of the folders you use
  most, and deeper when there is memory to spare; network shares cached with a check when shown again, a setting;
  nothing may wait on a network share that is down (3.8, a part of its own).

Builds on the listing (src/Shell/ShellListing.cs, MainForm.List), the folder watchers (src/Shell/FolderWatch.cs,
plan 03 3.8) and the progress bar of the status line. The number in the file name is the priority; rename to reorder.

## 1. What this is about

- Every pane reads its folder itself. Opening a folder in the tree while its file pane follows reads that folder twice
  at the same time: the file pane all of it, the tree its folders (and for each of them whether it has folders in
  it). Going back to a folder read a moment ago reads it again. Each read has its own count, so the progress bar has
  two totals that come at different moments.
- Nothing is read before it is asked for: even the folders you open every day start from nothing.
- A network share that is down or slow can hold Foldex up while Windows waits for its time-out.

## 2. The solution, in brief

The host gets one folder cache for all windows, between the panes and the disk. A folder is read once, whoever asks
for it; a second pane asking while it is being read gets what is read so far and the rest as it comes. The cache
keeps the bare read of a folder (names, attributes, sizes, dates) and the extras per item as far as they were needed:
icons for a pane that shows the items, for a tree whether each folder has folders in it. Every cached folder is
watched, and a change on disk is put into the cache as it is reported; a folder whose changes were lost is read again.
The cache grows up to the memory a setting allows and gives way when Windows runs short, the folders used longest ago
going first. Foldex remembers which folders you open most; in the background, at low priority, it reads those ahead,
and with memory to spare the folders under them too. Network shares are cached with a quick check when shown again
(a setting). Nothing in Foldex waits on a network share: every touch of one runs off the window's thread with a short
limit, and a share found unreachable is not tried again for a while; meanwhile its folders show what the cache has.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| No waiting on the network | every touch of a share off the window's thread, with a limit; a share found down not tried again for a while | -- | 3.8 |
| The cache | per folder the bare read, the extras per kind, shared by all windows and requests | -- | 3.1; 3.2 |
| Shared reads | a request joining a read under way; per-request stop | The cache | 3.3 |
| Kept current | the watch on every cached folder, changes put in, lost changes read again | The cache | 3.4 |
| Memory | the cache up to the setting, giving way when Windows runs short, the least recently used first | The cache | 3.5 |
| Folder use | which folders you open, how often, how lately | -- | 3.6 |
| Read-ahead | the folders you use most, deeper with memory to spare | Kept current; Memory; Folder use | 3.6 |
| Network shares | cached with a check when shown again, a setting | Kept current; No waiting on the network | 3.7 |
| The progress bar | one count per folder | Shared reads | 3.9 |
| Tests | unit and in the app | the others | 3.10 |

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
  (3.10).

### 3.5 Memory

- The cache keeps folders until it reaches the memory the setting folderCacheMB allows (Settings > App > Memory, a
  slider), then lets go of the folders used longest ago (least recently used: the last time a pane showed or asked for
  it) until it is under again. A folder some pane shows is never let go.
- When Windows says memory is short (its low-memory notice, `CreateMemoryResourceNotification`), the cache lets go of
  everything no pane shows, whatever the setting.
- The slider's range and default: [not yet calculated]; set when the memory per cached item is measured (3.10, with
  D:\temp). The settings window shows next to the slider how much the cache uses now and how many folders it holds.
- A folder let go stops being watched.

### 3.6 Folder use and read-ahead

- Folder use: every folder a pane opens is noted with how often and how lately (one score from both: often and lately
  counting, old use fading). Kept in State\folderuse.json for all projects and windows; the folders that score lowest
  drop out when the list is long (its length: [not yet calculated]). Only folders on local drives and, when they are
  cached (3.7), on network shares.
- Read-ahead, in the background at the lowest priority, one folder at a time, while nothing else is being read:
  1. the folders that score highest, best first;
  2. with memory to spare under the setting, the folders under those (their subfolders, a level deeper each round),
     until the cache is at its limit.
  Read-ahead never lets go of a folder to make room for itself: it only fills what is free.
- It stops at once when a pane asks for a folder, and goes on after that read is done.
- Read ahead means the bare read and the folder check (so a tree can open it at once); icons are left for when a pane
  shows the items.
- At start: read-ahead begins after the windows have shown their folders.
- Network shares are read ahead only when they are cached (3.7) and the share answers (3.8).

### 3.7 Network shares and other places

- Network shares: cached, as the setting cacheNetwork says (on by default). They report changes too, less reliably;
  some NAS devices do not report at all. So a cached network folder is checked when a pane shows it again: a quick
  read of names and dates (the bare read only), the changes put in. While the check runs the pane shows what the cache
  has. Off: network folders are read every time, as now.
- Cloud folders (Synology Drive, OneDrive): their files are on a local drive (placeholders), changes by the sync
  client are reported as any change; cached as local folders. Reading a placeholder's icon or contents can make the
  client download it: the extras must not open the files (as now).
- Shell places (This PC, the Recycle Bin, a phone): not cached; read as now.

### 3.8 No waiting on the network

- A rule for all of Foldex, not only the cache: the window's thread never touches a network path (no folder read, no
  exists check, no watcher start, no shell item, no icon). Every such touch runs on a worker with a time limit; the
  window goes on and gets the answer (or "not reachable") when it comes.
- Known places that touch the disk on the window's thread now (found by reading the code; a full list: [not yet
  checked]): the Git column's `Directory.Exists` (MainForm, op "git"), starting a folder watcher (FolderWatch.Start),
  and Windows' right-click menu (ShellMenu.Create in ShowMenu). These move off it.
- A share that does not answer within the limit is marked unreachable (per server). For a while nothing more is sent
  to it: its folders show what the cache has, marked as not current (the status says the share is not reachable and
  since when), and a pane on it says so without waiting. Then one quick try (a worker, the same limit); answered, the
  share is reachable again and its shown folders are checked (3.7).
- The limit and the wait before trying again: [not yet calculated]; set from what a reachable share takes on this
  network (measured in the tests), so a working but slow share is not taken for down.
- Read-ahead and the cache's checks never wait on an unreachable share; a watcher on a share that goes away is dropped
  and made again when it is back.
- A file operation on a share (copy, move) is Windows' own (IFileOperation) and shows Windows' own progress; it is not
  held by this rule, but it runs off the window's thread already.

### 3.9 The progress bar

- One count per folder: the cache's read has the count; every request on that folder shares it, so the bar has one
  total per folder however many panes ask.
- A folder answered from the cache does not show the bar.

### 3.10 Tests

- Unit: the cache's merge of folders only and files and folders; a change reported during the read; created,
  deleted, renamed, changed put in; a lost change reading the folder again; a request joining a read and stopping
  alone; letting go of the least recently used at the limit, never a shown folder; the folder use score (often,
  lately, fading); read-ahead order and stopping for a pane's request; a share marked unreachable and tried again.
- In the app (the test copy): D:\temp opened in the tree with its file pane following: one read (the host's log of
  reads), one count, the bar filling once; back to a folder read before: answered at once, no read; a file made,
  deleted, renamed in a cached folder from outside Foldex: in the pane, with the time from the change to the pane
  measured; the memory per cached item measured with D:\temp (for 3.5); read-ahead: a folder used often opened from
  the cache after a restart; read-ahead stopping when a folder is opened.
- The network: a share made unreachable while shown (its server stopped or the cable out): the window keeps
  answering (a key moves the cursor in another pane at once, measured), the share's pane shows the cache marked not
  current; back: checked and current again. A share that never answers at start: Foldex starts without waiting for it.

## 4. Open questions

None.
