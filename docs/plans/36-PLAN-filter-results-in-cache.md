# Plan 36: Filter results in the folder cache, worked out in the background

Status: not started.

- 2026-11-19: draft, at the user's request.

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
background, as read-ahead reads them.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Filter ids | a new id per filter each time its lines change; kept sets and a pane's own set alike | -- | 3.1 |
| Results in the cache | per item: the filter ids it was tested with and the outcome; dropped on a change on disk | -- | 3.2 |
| The engine in the host | `filters.js` run by the host (Jint), with the values the host has or reads | -- | 3.3 |
| Requests with a filter | a pane asks with its filter's id; only what passes comes; the rest as it is tested | Filter ids; Results in the cache; The engine in the host | 3.4 |
| In the background | testing goes on after the pane leaves, as read-ahead; low priority, stoppable | Requests with a filter | 3.5 |
| Off and on, changed | off: all shown; on: the id's results used again; a change: a new id, the old results dropped | Filter ids | 3.6 |
| Trees | a folder shown when it or something under it passes; the folders under it tested in the background | In the background; open question 1 | 3.7 |
| Relative dates | results of a line relative to now not kept past the moment they could change | open question 2 | 3.8 |
| Tests | see 3.9 | -- | 3.9 |

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
- Memory: the maps count toward the cache's memory (plan 24 3.5); they go with their folder when it gives way.

### 3.3 The engine in the host

- One engine: the host runs the page's `filters.js` (it needs no page; its tests run it under Jint already) through
  Jint, so a line means the same in the host as in the page; not a second engine in C#.
- The values a line needs: the bare read (name, size, dates, attributes) the cache has; Windows' properties and the
  Git status read by the host as for a column (they are read in the host now, for the page); Contents through plan 20's
  text check. A value not read yet is read for the test, at the background's priority (3.5).
- Today the page tests (`filterTestOf`); with this plan the page only shows what the host says passes. The search
  bar's quick filter stays the page's own (it is typed and gone, plan 32 2).

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
- A folder whose contents are not known yet for the id: open question 1.

### 3.8 Relative dates

- A line relative to now ("modified within 7 days", "today") changes its result without any change on disk: a result
  kept from yesterday can be wrong today. Such results are kept only until the moment the line's outcome could change
  (for "today" the next midnight; for "7 days ago" the moment an item's date crosses it), or not kept at all: open
  question 2.

### 3.9 Tests

- Unit (host, Jint): `filters.js` run by the host gives the same results as under the page tests (plan 32's tests run
  through the host's engine too); a result map kept, dropped on a change, dropped for an old id; a tree's "holds a
  pass" up the chain and dropped when the last passing item goes.
- In the test copy: a folder filtered on a Windows property, left and opened again: shown at once, no reading again;
  the filter off and on: at once; the filter changed: tested again; a file changed on disk: tested again and its
  row coming or going; a tree with a filter showing only the folders that lead to a passing file; the window answering
  while a large folder is tested in the background.

## 4. Open questions

1. **A tree folder not known yet.** While the host has not yet found whether a folder holds something that passes:
   shown (dimmed, as unknown) and taken away when it turns out empty, or hidden and added when something under it
   passes?
2. **Relative dates.** Keep their results until they could change (more work, every result fast), or never keep the
   results of a line relative to now (simple, such a filter as slow as today)?
