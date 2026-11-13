# Plan 24: One read per folder: a folder cache with read-ahead

Status: executed 2026-11-12; see As built.

- 2026-11-12: draft, at the user's request.
- 2026-11-12: revised: the cache kept until memory gets tight, with a memory setting; read-ahead of the folders you use
  most, and deeper when there is memory to spare; network shares cached with a check when shown again, a setting;
  nothing may wait on a network share that is down (3.8, a part of its own).
- 2026-11-12: executed.

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
| No waiting on the network | every touch of a share off the window's thread, with a limit; a share found down not tried again for a while | 3.8; 6 |
| The cache | per folder the bare read, the extras per kind, shared by all windows and requests | 3.1; 3.2; 6 |
| Shared reads | a request joining a read under way; per-request stop | 3.3; 6 |
| Kept current | the watch on every cached folder, changes put in, lost changes read again | 3.4; 6 |
| Memory | the cache up to the setting, giving way when Windows runs short, the least recently used first | 3.5; 6 |
| Folder use | which folders you open, how often, how lately | 3.6; 6 |
| Read-ahead | the folders you use most, deeper with memory to spare | 3.6; 6 |
| Network shares | cached with a check when shown again, a setting | 3.7; 6 |
| The progress bar | one count per folder | 3.9; 6 |
| Tests | unit and in the app | 3.10; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

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

## 6. As built

- The cache: src/Shell/FolderCache.cs, for all windows (AppHost.Cache). A folder's bare read is its DirectoryInfo items,
  kept per name; an item's entry (ShellListing.DiskEntry: icon, own columns) and a tree's extras (ShellListing.Contents:
  whether it has folders, and files) are worked out when a request first needs them and kept; each request gets a copy
  (a JSON node has one parent). A request while the folder is being read waits for that read (the bare read only, no
  icons, so the wait is short) and then goes on with the items as they are; two requests at once share the entries
  each works out. A link that refuses its own listing (C:\Documents and Settings) reads its target, as before. Shell
  places (not a path on disk) are listed as before, not cached. MainForm.List asks the cache; the count for the
  progress bar comes from its bare read (one per folder), marked when the folder came from the cache.
- Kept current: one watcher per cached folder (FileSystemWatcher, 64 KB buffer), started before the folder is read;
  changes reported during the read are put in after it; created, changed (read again), deleted, renamed; a folder made
  or gone in it makes its parent's tree extras be worked out again; a lost change (the watcher's error) marks the
  folder to be read again. The cache tells the windows of a change itself, once the folder is quiet for 300 ms (as
  FolderWatch did); FolderWatch now watches only what the cache does not keep (a share, with shares not cached).
  2026-11-13: the windows are told which items changed (by name, at most FolderCache.MaxNames, else the folder as a
  whole); a pane asks for those only (FolderCache.Entries, op changedEntries) and puts them in where they belong, the
  selection, the focus and the focused row's place kept, instead of reading the folder again whole. Measured in the
  test copy with D:	emp (the TEMP folder, 50423 items, changing every second or two) in two lists: the host's CPU
  while nothing was done in the window went from 15.7 s to 0.2 s per 20 s, with no listing asked for.
  2026-11-13: every share goes through the cache too (cacheNetwork now says only whether a share's folder is kept
  once no window shows it, and read ahead; off: let go then, read anew when opened again); the check of a share
  shown again tells the items that changed by name, as a watch does. Measured with \localhost\D$	emp in two
  lists: as D:	emp (0.2 s host CPU per 20 s, no listing asked for).
  A folder Windows refuses to watch is read again on every request. One watcher per drive (3.4) was not built: one per
  cached folder, the plan's fallback; whether one per drive is cheaper on a busy drive: [not yet calculated].
- Memory: the setting folderCacheMB (Settings > App > Memory, 16 to 4096 MB, default 256); over it the folders used
  longest ago go, never a shown one (the folders a window shows: its lists and the folders open in its trees, told by
  the page as before). Windows' low-memory notice (CreateMemoryResourceNotification) is checked every 5 s: then every
  folder no window shows goes. The settings window shows under the slider what the cache uses, how many folders and how
  many were read ahead, every 5 s. The size of an item is counted as 600 bytes for its bare read and 1400 more once
  its entry is worked out; measured (managed memory after a full collection, before and after letting D:\temp go):
  1865 bytes per item for 50404 items with entries and tree extras, so the count is on the safe side. 256 MB holds
  about 140000 such items.
- Folder use and read-ahead: src/Shell/FolderUse.cs. A folder a pane opens (a listing that is not a tree's level) is
  noted; the score adds one per opening, half of it fading in 14 days; at most 500 folders; State\folderuse.json,
  written every 5 s when changed. Read-ahead: a thread at the lowest priority, started after the first listing; while
  no request was answered in the last 1.5 s and the cache has room: the best scored folders not cached, then (with less
  than half the budget used) the folders in those, up to four levels deeper; each read means the bare read and the
  tree extras of its folders, no icons; it stops between items when a request comes. Local folders, and shares when
  cached and answering.
- Network shares: cached as the setting cacheNetwork says (on by default). A share's folder answered from the cache is
  read again in the background (the bare read), the changes put in and the windows told.
- No waiting on the network: src/Shell/NetworkGuard.cs. A path is on a share when it is a UNC path or its drive is a
  network drive (GetDriveType, which touches no network). Before a listing, Windows' menu, opening an item and the Git
  column, the share's root is checked on a worker with a limit; one that does not answer is marked down for its server
  and answered at once for 30 s, then tried again. A listing of a share that is down gets what the cache has, with the
  status "N items as last read; not current: \\server is not reachable (since hh:mm:ss)", or that it is not reachable
  and nothing is cached. FolderWatch starts a watcher on a share on a worker once the share answers. The limit is
  2000 ms: a share that answers took 17 ms here (165 ms the first time by its IP address), but that was the loopback
  (\\localhost\C$); no real network share was measured. A share that does not answer (192.0.2.1) kept Windows
  waiting 21.6 s the first time. Not checked for network paths: the full list of other places that touch the disk on
  the window's thread ([not yet checked], as the plan said); file operations (Windows' IFileOperation) are not held.
- Tested: unit tests (FolderCacheTests): folders only then everything (one read, the tree's extras, the counts); a
  change on disk in the cache without reading again (made, deleted, renamed); two requests at once sharing the read;
  the budget letting go of the folder used longest ago, never a shown one, and all but the shown on low memory; the
  folder use score kept; a share that does not answer not waited for (false within the limit, then at once); 188 pass.
  In the test copy (CDP): D:\temp (50250 items) in the tree and the list at once: no read beyond the one already made;
  back to D:\temp from another folder: no read, no progress bar, shown after 670 ms (copying and sending 50250
  entries); a file made in a shown folder from outside: in the list 338 ms later; \\192.0.2.1\share opened: answered
  after 2175 ms (the limit) with the page never stalled more than 1 ms, the status saying it is not reachable; after a
  restart the folders used most (f8t, D:\temp, C:\Windows) came from the cache, read ahead; the settings window's line
  under the slider.
- Not tested: a real network share (cached, checked when shown again, going down while shown, coming back), Windows'
  low-memory notice, a lost change (buffer overflow), read-ahead stopping for a request (only that the folders were
  there).
