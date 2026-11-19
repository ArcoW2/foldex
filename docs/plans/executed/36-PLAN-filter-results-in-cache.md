# Plan 36: Filter results in the folder cache, worked out in the background

Status: executed; see Status and 6 (As built).

- 2026-11-19: draft, at the user's request.
- 2026-11-19: executed.

Builds on plan 24 (the folder cache: one read per folder, kept current by its watch, read-ahead in the background),
plan 32 (filter sets: lines, the engine `filters.js`, kept sets, a pane's filter switched off and on) and plan 20
(the Contents field: a filter line that reads every file). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

A pane's filter is worked out by the pane's page, on the items it has, every time it shows a folder. A filter with a
slow field (a Windows property, the Git status, plan 20's Contents) has to wait for every item's value again each
time: going back to a folder, switching the filter off and on, or another pane with the same filter all start from
nothing. Nothing is worked out ahead, while the folder cache does read folders ahead. And a tree that shows files
(plan 18) cannot show only the folders that lead to something that passes, since a folder's contents are not tested
until it is opened.

## 2. The solution, in brief

Every filter gets an id of its own, new each time its lines change. The folder cache keeps, per item, the result of
every filter id it was tested with: passes or not. A pane with a filter asks the cache for its folder with that id
and shows only the items that pass; what is not tested yet is tested by the host, in the background, with the same
engine (`filters.js`, run by the host), and shows as soon as it passes. A change on disk drops the results of that
item, so it is tested again. Switching a filter off shows everything; on again, its id is the active one and its
results are still there. A changed filter is a new id; the results of the old one are dropped. In a tree a folder
shows when it passes itself or holds, at any depth, an item that passes; the host tests the folders under it in the
background, as read-ahead reads them, and a folder not known yet shows dimmed. A filter relative to now by the clock
(minutes, hours) keeps no results, so using it again is as slow as the first time, which the line editor warns
for; one relative by the date (days and longer) keeps them until the date changes.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Filter ids | an id per filter that follows its lines; kept sets and a pane's own set alike | 3.1; 6.1 |
| Results in the cache | per item: the filter keys it was tested with and the outcome; dropped on a change on disk; Refresh restarts the filter on the folders refreshed | 3.2; 6.1 |
| The engine in the host | `filters.js` run by the host (Jint), with the values the host has or reads | 3.3; 6.1 |
| Requests with a filter | a pane asks with its filter's key; what passes comes as it is tested, each answer only what is new | 3.4; 6.2 |
| In the background | testing goes on after the pane leaves; a folder read ahead tested with the filters in use | 3.5; 6.2 |
| Off and on, changed | off: all shown; on: the key's results used again; a change: another id, the old results dropped | 3.6; 6.2 |
| Trees | a folder shown when it or something under it passes, dimmed while not known yet; the folders under it tested in the background, the deepest first | 3.7; 6.3 |
| Relative dates | relative by the clock: no results kept, a warning under such a line; relative by the date: kept, replaced when the date changes | 3.8; 6.1 |
| Tests | see 3.9 and 6.4 | 3.9; 6.4 |

### Not yet built

## 3. Details

### 3.1 Filter ids

- A filter (a kept set in `filters.json`, or a pane's own set) has an id, a GUID, made when the set is made and made
  anew every time its lines change (a line added, changed, removed, moved, a bracket). Renaming a kept set, its key
  or its default marks do not change what passes: the id stays.
- Two panes with the same kept set share its id, so its results; a pane's own set has an id of its own.
- The id is kept with the set (in `filters.json`; a pane's own set in the layout), so the results it names are found
  again after a restart only if the cache still has them (the cache is in memory, plan 24).

### 3.2 Results in the cache

- Per cached item (plan 24 3.1) a small map: filter id -> passes (true) or not (false). An id missing is "not tested
  yet", never "does not pass".
- A change of the item on disk (the watch, plan 24 3.4) drops its whole map: its values changed, so every filter
  tests it again. A folder read again (its changes lost) drops the maps of all its items.
- **Refresh** (F5, plan 24: the folder read again) restarts the filter on the folder or folders it was given for:
  the pane's folder, or in a tree the folders it refreshes. Their items' maps are dropped (every filter id, not only
  the pane's), and the pane's filter tests them again at once, the background (3.5) the other ids in use. Nothing
  outside those folders is touched; in a tree the "holds a pass" of the folders above them (3.7) is worked out again
  as their results come.
- Memory: the maps count toward the cache's memory (plan 24 3.5); they go with their folder when it gives way.

### 3.3 The engine in the host

- One engine: the host runs the page's `filters.js` (it needs no page; its tests run it under Jint already) through
  Jint, so a line means the same in the host as in the page; not a second engine in C#.
- The values a line needs: the bare read (name, size, dates, attributes) the cache has; Windows' properties and the
  Git status read by the host as for a column (they are read in the host now, for the page); Contents through plan 20's
  text check. A value not read yet is read for the test, at the background's priority (3.5).
- Today the page tests (`filterTestOf`); with this plan the page only shows what the host says passes. The search
  bar's quick filter stays the page's own (it is typed and gone, plan 32 2).
- Plan 20's search rules and its Contents field are tested by this engine too, so they are built after it.

### 3.4 Requests with a filter

- A pane with a filter switched on asks for its folder with the filter's id. The cache answers with the items whose
  result for that id is true, at once, and tests the ones without a result; each that passes is sent as it is known
  (as items come now while a folder is read, plan 24 3.3).
- The pane's count says how many are shown and that testing goes on, as it does for a read (`n of m items`, the
  progress bar while it is testing).
- Moving the pane to another folder ends its wait for the old one, not the testing (3.5).

### 3.5 In the background

- Testing a folder goes on when the pane that asked has left it, as plan 24's read-ahead goes on: at low priority,
  one folder after another, never holding up a request a pane waits for. Folders in use first, then the ones read
  ahead.
- Read-ahead (plan 24 3.6) tests what it reads with the filters in use by any pane (the active ids), so a folder
  opened later shows its filtered items at once.
- It stops for a folder on a share that is down (plan 24 3.8), as the reads do. A setting can switch the background
  testing off [where it goes in Settings: written when built].

### 3.6 Off and on, changed

- Switching a pane's filter off (its head, Ctrl+Alt+F; plan 32 3.6) shows all items; the results stay in the cache.
  On again: the same id, so its results are used at once and only what is untested is tested.
- Changing the filter (Manage filters, plan 32 3.3) makes a new id (3.1): the pane asks with it, everything is tested
  again. The results of the old id are dropped from every item in the background, unless another pane still uses
  that id; an id no set has any more is dropped the same way. (Dropping, not leaving them to be overwritten: an old
  id is never asked again, so its results would only take memory.)
- Cancel in Manage filters (back to what the pane had) gives the pane its old id back; its results are still there
  until the drop above has reached them.

### 3.7 Trees

- A tree with a filter (a tree showing files, plan 18; or folders only): a folder shows when it passes itself, or
  when something under it passes, at any depth; a file shows when it passes.
- For that the host tests the folders under a tree's folders in the background (3.5), as deep as needed, and keeps
  per folder whether something under it passes for the id (a folder's own result next to its "holds a pass").
  A change anywhere under it drops that up the chain, as far as it no longer holds.
- A folder whose contents are not known yet for the id shows, dimmed (as unknown); when the host finds nothing under
  it passes, it goes; when something does, it shows as any folder. A folder that passes itself is never dimmed.

### 3.8 Relative dates

- A line relative to now (plan 32 3.1: "modified within 7 days", "today", "30 minutes ago") changes its result
  without any change on disk, so its results cannot always be kept:
  - **Relative by the clock** (minutes, hours): its outcome changes from moment to moment. A filter with such a line
    keeps no results in the cache: every request tests again, as the page does today. So every time it is used again
    (the folder opened again, the filter switched on again, a search run again) it is as slow as the first time, and
    with a slow field in the same filter (a Windows property, Contents) extra slow. The line editor says so under such
    a line, as it warns for a slow field (plan 32 3.1, plan 20 3.2): a relative time is not kept, so using this filter
    again is as slow as the first time; days instead of minutes or hours are kept.
  - **Relative by the date** (today, a day, days, weeks, months, years ago or from now): its outcome changes only
    when the date does. Its results are kept as any others, and dropped for every filter id with such a line when the
    date changes (at midnight, or when Foldex sees a new date after the PC slept); its folders in use are then
    tested again in the background.
  - An absolute date (with a time or not) is not relative: kept as any result.
- Which kind a filter is, is worked out from its lines when its id is made (3.1): no relative line, by the date, or
  by the clock (one clock line is enough).

### 3.9 Tests

- Unit (host, Jint): `filters.js` run by the host gives the same results as under the page tests (plan 32's tests run
  through the host's engine too); a result map kept, dropped on a change, dropped for an old id; a tree's "holds a
  pass" up the chain and dropped when the last passing item goes; a filter by the clock keeps nothing, one by the date
  keeps its results until the date changes and then none.
- In the test copy: a folder filtered on a Windows property, left and opened again: shown at once, no reading again;
  the filter off and on: at once; the filter changed: tested again; F5: that folder tested again, another folder's
  results kept; a file changed on disk: tested again and its
  row coming or going; a tree with a filter showing only the folders that lead to a passing file, the ones not known
  yet dimmed and going or staying as they become known; the window answering while a large folder is tested in the
  background.
- Unit (host): a "today" filter across a change of date, with the cache's clock set by the test (the cache reads the
  date through a clock the tests can set).

## 4. Open questions

None.


## 6. As built

### 6.1 Ids, results, the engine (2026-11-19)

- The id is not a GUID made at a change but a hash of the set's lines (`filters.js` `filterKey`): changed lines give
  another id, the same lines again the same one, so Cancel in Manage filters finds its results back by itself and no
  id has to be stored. The key results are kept under: the id; `id@YYYY-MM-DD` for a set relative by the date (another
  day: another key, the day before's results replaced item by item as they are tested); none for a set relative by
  the clock (`filterRelative`).
- A range "from 7 days ago" is worked out from the moment it is tested, so a result kept for the day can be a few
  hours off by the evening: the trade-off chosen (kept until the date changes) over testing again all day.
- The host's engine (`Shell/FilterEngine.cs`): Jint (now in the app, as it was in the tests) runs the page's
  filters.js (from the page's own files) with a `filterAll`; the items are the listing's entries (the cache's, or one
  without its icon for an item no pane shows: `ShellListing.FilterEntry`), with the Windows properties
  (`ShellProps.Values`) and the Git status (`GitStatus.Of`) the set needs, read before they are tested.
- Kept on the cache's items (`FolderCache.Item.Results`); a change on disk makes another Item, a folder read again
  (F5, or a watch that lost track) other Items, so their results go with the old ones. They count toward the cache's
  memory (`ResultBytes`, 120 per result: chosen, not measured).

### 6.2 Requests, background, off and on

- `Shell/FilterJobs.cs`: per folder and key one job (`filterResults`), started by the first request and going on
  when nobody asks any more; a request gets what was found after its `from` and waits at most 400 ms for more; the
  page asks until `done`. A job without a key (relative by the clock) is the asking pane's own (`run`).
- A list uses the host only for a set with a slow field (a Windows property, the Git status): a set that reads only
  what the listing has is tested by the page at once with the same engine, as before; keeping those results would
  save nothing. A tree always uses the host (its folders' "holds a pass").
- Changed: the page posts `filterForget` for the old id when no other pane of the window uses it; the host drops its
  results and its jobs. Read-ahead tests a folder it read with the keys used in the last 30 minutes.
- A change in a folder (`FolderCache.FilterGone`) drops the jobs for it, and the tree jobs for it and the folders
  above it; the windows are told (`filterStale`) and their trees ask again. A list drops the changed items' results
  when it takes in the change (`patch`) and asks again for an item it has no result for, once per item.

### 6.3 Trees

- A node whose parent is not a folder on disk (the tops, This PC's drives, quick access) always shows: those are the
  ways in. In a folder on disk: a file when it passes; a folder when it passes, or holds a pass (`filterHolds`), dimmed
  (`filter-unknown`) while that is not known.
- Looking under a tree's folders takes turns (two at a time, chosen, not measured), the deepest folder waiting first,
  and a long look hands its turn over between folders when a deeper one waits: a folder opened later does not wait for
  a whole drive above it.

### 6.4 Tests

- `dotnet test`: 285 passed. New: `FilterResultsTests`: the host's engine as the page's; results kept, gone with a
  changed file and with F5; another day's key replaced; a forgotten filter's results gone; a tree's "holds a pass" three
  folders down, gone when the last pass is deleted; a set without a key keeps nothing; the key in the page (the same
  lines the same id, other lines another, a date for days and today, none for hours).
- In a test copy over CDP: a list filtered on Windows' item type: the host's result for every item the same as the
  page's own engine on the same values; on C:\Windows\System32 (5019 items, every file's item type read) the first
  time 43.5 s, off and on again 367 ms, away and back 833 ms with the folder's listing. A tree filtered on files
  `*.log`: the folders that lead to one shown, the others gone, after 578 ms; a .log made in a hidden folder brought it
  back in 1.2 s, deleted it went in 3.0 s; the tree's page answering in 7 ms meanwhile, with D:\temp (50178 folders)
  open in the same tree. Not tried in the app: the read-ahead with filters, a relative by the clock warning shown.