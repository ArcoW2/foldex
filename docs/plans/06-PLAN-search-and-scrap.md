# Plan 06: Search and scrap: panes of items from anywhere

Status: draft 2026-11-10, revised 2026-11-12; not started.

- 2026-11-10: draft.
- 2026-11-12: revised with the user's answers: Delete per pane kind, a scrap per project and not kept across a restart,
  missing entries dropped, search inside a collection, every engine available, a scrap standing alone (no source, no
  followers), opened empty and docked as any pane.

Builds on plan 03 (connected panes).

## 1. What this is about

The panes of plan 03 show one folder. Two things do not fit that: the result of a search (files from many folders) and
a scrap container (files and folders collected by hand, from wherever, to act on together later). In Explorer a search
result is a dead end and there is no scrap container at all: collecting files from several places means copying them
somewhere first.

## 2. The solution, in brief

A pane can show a collection instead of a folder: a flat list of items from any number of locations. A search pane
holds what a search found and is connected like any pane. A scrap pane holds what was put in it, stands alone (no
source, no followers), can be opened empty and docked anywhere as a drop target, and lives only as long as Foldex runs.
Every file action works on a collection as on a folder, so copying copies items from several locations at once. In a
folder pane Delete deletes as in Explorer; in a scrap Delete only takes the entry out, and Alt+Delete or the scrap's
Delete button deletes from disk.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Collections | entries by parsing name, flat, the folder column, grouping, watched entries, missing ones dropped | -- | 3.1 |
| Search pane | criteria, scope, streaming results, every engine available, saved criteria, search inside a collection | collections | 3.2 |
| Scrap pane | opened empty, filled by drag, action, paste and Add all to scrap; no source or followers; docked; per project, not kept across a restart; more than one | collections | 3.3 |
| File actions on a collection | Delete, Alt+Delete, Alt+Shift+Delete, the scrap's Delete button | collections | 3.4 |
| Own menu for mixed folders | Foldex's own menu for items from different folders | collections | 3.4 |

## 3. Details

### 3.1 Collections

- An entry is a shell item's parsing name (the full path for a file or folder on disk, plan 02 3.1); the pane shows its
  name and, as a column, the folder it is in. Grouping by that folder is a view option.
- A collection is a flat list: a folder in it is one entry, its own path, not its contents, and it has no tree.
- Entries are watched: renamed or moved by Foldex, the entry follows; removed outside Foldex, the entry is dropped from
  the collection at once.
- Branches (plan 03) work unchanged in a search pane: it keeps one selection per branch colour. A scrap has no source,
  so no branches.

### 3.2 Search pane

- Criteria: name pattern, text in the file, size, dates, attributes, type; combinable.
- **Scope**: the folder a search pane's source has focused (so it follows like any follower, plan 03 3.3), or a fixed
  folder when it has no source.
- **Inside a collection**: only the collection's own entries are tested against the criteria, files and folders
  alike; a folder entry is not searched inside. How such a search is started, now that a scrap has no followers: open
  question 1.
- Results stream in while the search runs; Stop; a change of scope or criteria cancels the running search and starts
  again (debounced as plan 03 3.3).
- **Engines**: whatever is available, to make the search fast: Everything when it is installed, the Windows Search
  index where the scope is indexed, else Foldex's own walk of the folders (LexPen's `FolderSearch.cs` for the text
  part). A criterion an engine cannot answer is tested by Foldex on that engine's candidates. [Which criteria each
  engine answers: not yet checked.]
- A search pane's criteria and scope are saved in the project; its results are not, they are searched again.
- Add all to scrap: the search pane's current results into a scrap, as a snapshot (later results do not follow).

### 3.3 Scrap pane

- Usually short-lived: collecting files for one action on all of them (renaming, moving).
- Opened empty by an action (New scrap), without searching first.
- Filled by dragging items onto it from any pane (also from Explorer), by an action Add to scrap on the selection, by
  pasting, and by Add all to scrap from a search pane. Dropping a folder adds the folder's own path, not its files.
  Nothing is copied or moved on disk.
- No source and no followers: it cannot be connected as parent or child. Focusing an item in it drives nothing.
- Docked as any pane, so a small scrap can stay somewhere in the window as a drop target.
- Belongs to its project's window; kept while Foldex runs, not across a restart. Whether an empty docked scrap keeps
  its place after a restart: open question 2. There is no scrap shared by all projects.
- More than one scrap pane, each with its own name and colour.

### 3.4 File actions on a collection

| Action | On a collection |
|---|---|
| Copy, cut | The selected items, from all their folders; pasted in one go into the target folder |
| Paste into a folder in the collection | As into any folder |
| Paste onto the collection itself | Search: not possible. Scrap: adds the items as entries; nothing is copied |
| Move | The files move; the entries follow to their new paths |
| Rename, properties, open | Per item, as in a folder pane |
| Delete | Scrap: takes the entries out; nothing on disk changes. Search: open question 1 |
| Alt+Delete | Deletes the items from disk (recycle bin) and takes them out of the pane |
| Alt+Shift+Delete | Deletes permanently, as Shift+Delete in Explorer, after a question |

- In a folder pane Delete deletes from disk (recycle bin) as in Explorer, and Shift+Delete permanently; Alt+Delete
  and Alt+Shift+Delete do the same there.
- A scrap's head has a Delete button that deletes the selected items from disk, as Alt+Delete (xplorer2 has one); the
  keys stay the main way.
- Copying or moving all go through `IFileOperation` (plan 05), so two files with the same name from different folders
  get Windows' own conflict dialog.
- Deleting from disk from several folders: one confirmation listing the folders involved.
- Explorer's context menu does not exist for items from different folders (plan 02, 6.2 item 7): the shell makes none.
  Such a selection gets Foldex's own menu (Copy, Cut, Delete, Alt+Delete, Properties per item, ...); a selection
  within one folder keeps Explorer's. Dragging them out and the shell clipboard for them: [not yet checked] (plan 02,
  6.3).
- The keys are in `keys.json` like all keys; Alt+Delete and Alt+Shift+Delete are free in Windows [not yet checked
  against PowerToys and the like on this PC].

### 3.5 Tests

- Unit: entries following a move and a rename; an entry removed outside Foldex dropped; a dropped folder added as one
  entry; Delete in a scrap taking out entries only; a search inside a collection testing only its entries; the search
  criteria combined; a search cancelled on a scope change.
- In the test copy: search a folder, focus a result folder, its follower shows it; a new empty scrap docked, filled by
  dragging from three folders, copied into one, conflicts asked by Windows; Delete in the scrap leaves the files on
  disk; Alt+Delete and the scrap's Delete button move them to the recycle bin; Delete in a folder pane moves them to
  the recycle bin; after a restart the scrap's entries are gone.

## 4. Open questions

1. **Search results: a search pane or a scrap?** This plan has a search pane of its own, connected (a source sets its
   scope, its focus drives followers). xplorer2 puts search results in a scrap, and the reserved Ctrl+F "scrap search"
   points that way too. If results are a scrap, a search has a fixed scope set when it starts, its results drive
   nothing, Delete there takes entries out, and a search inside a scrap is started from that scrap (its results
   filling a new scrap). If they stay a search pane: Delete in it takes the entries out (as a scrap) or deletes from
   disk (as a folder pane), and how is a search inside a scrap started, since a scrap has no followers?
2. **A docked scrap after a restart.** Its entries are gone. Does the empty pane keep its place in the dock (a mini
   scrap always there), or does the pane go too?
