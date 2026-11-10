# Plan 06: Search and scrap: panes of items from anywhere

Status: draft 2026-11-10; not started. Builds on plan 03 (connected panes).

## 1. What this is about

The panes of plan 03 show one folder. Two things do not fit that: the result of a search (files from many folders) and
a scrap container (files and folders collected by hand, from wherever, to act on together later). In Explorer a search
result is a dead end and there is no scrap container at all: collecting files from several places means copying them
somewhere first.

## 2. The solution, in brief

A pane can show a collection instead of a folder: a list of items from any number of locations. A search pane holds
what a search found, a scrap pane what was put in it. Both are panes like any other: connected to a source, and a
source for followers, so a folder focused in a result drives the next pane and a file drives the preview. Every file
action works on a collection as on a folder, so copying copies items from several locations at once. Delete only takes
an item out of the collection; Alt+Delete deletes it from disk and from the pane.

## 3. Details

### 3.1 Collections

- An entry is a shell item's parsing name (the full path for a file or folder on disk, plan 02 3.1); the pane shows its name and, as a column, the folder it is in.
  Grouping by that folder is a view option.
- Entries are watched: renamed or moved by Foldex, the entry follows; removed outside Foldex, the entry is marked as
  missing (open question 3).
- Branches (plan 03) work unchanged: a collection pane keeps one selection per branch colour.

### 3.2 Search pane

- Criteria: name pattern, text in the file, size, dates, attributes, type; combinable.
- **Scope**: the folder a search pane's source has focused (so it follows like any follower, plan 03 3.3), or a fixed
  folder when it has no source. Scope from a source collection (search inside the folders of a scrap): open question 4.
- Results stream in while the search runs; Stop; a change of scope or criteria cancels the running search and starts
  again (debounced as plan 03 3.3).
- Engines: Foldex's own walk of the folders (LexPen's `FolderSearch.cs` for the text part), the Windows Search index
  where the scope is indexed, Everything when it is installed. Which ones: open question 5.
- A search pane's criteria and scope are saved in the project; its results are not, they are searched again.

### 3.3 Scrap pane

- Filled by dragging items onto it from any pane (also from Explorer), by an action Add to scrap on the selection, and
  by pasting.
- Saved in the project; whether there is also a scrap shared by all windows and projects, as LexPen's clipboards:
  open question 2.
- More than one scrap pane, each with its own name and colour.

### 3.4 File actions on a collection

| Action | On a collection |
|---|---|
| Copy, cut | The selected items, from all their folders; pasted in one go into the target folder |
| Paste into a folder in the collection | As into any folder |
| Paste onto the collection itself | Search: not possible. Scrap: adds the items as entries; nothing is copied |
| Move | The files move; the entries follow to their new paths |
| Rename, properties, open | Per item, as in a folder pane |
| Delete | Takes the entries out of the collection; nothing on disk changes |
| Alt+Delete | Deletes the items from disk (recycle bin) and takes them out of the pane |
| Alt+Shift+Delete | Deletes permanently, as Shift+Delete in Explorer, after a question |

- Copying or moving all go through `IFileOperation` (plan 05), so two files with the same name from different folders
  get Windows' own conflict dialog.
- Deleting from disk from several folders: one confirmation listing the folders involved.
- Explorer's context menu, dragging out and the shell clipboard for items from different folders need a data object
  and a menu over items without one common parent folder [not yet checked]; a check for the spike of plan 02.
- The keys are in `keys.json` like all keys; Alt+Delete and Alt+Shift+Delete are free in Windows [not yet checked
  against PowerToys and the like on this PC].

### 3.5 Tests

- Unit: entries following a move and a rename; a missing entry; Delete taking out entries only; the search
  criteria combined; a search cancelled on a scope change.
- In the test copy: search a folder, focus a result folder, its follower shows it; a scrap filled from three folders,
  copied into one, conflicts asked by Windows; Delete leaves the files on disk; Alt+Delete moves them to the recycle bin.

## 4. Open questions

1. **Delete in a folder pane.** In a collection, Delete only takes the entry out. In a normal folder pane: Delete still
   deletes from disk as in Explorer, or one rule everywhere (Delete never touches the disk, Alt+Delete always does)?
   Suggestion: one rule everywhere, because a key that deletes in one pane and does not in the next is the kind of
   difference that costs files; in a folder pane Delete then says to use Alt+Delete.
2. **A scrap across projects.** Scraps per project only, or also one shared by every window and project (kept across
   restarts, as LexPen's numbered clipboards)?
3. **Missing entries.** An item removed outside Foldex: kept as a marked entry until removed by hand (suggestion), or
   dropped from the collection at once?
4. **Search inside a collection.** May a search pane's source be a collection, searching in all its folders (for
   example: find the .config files in every folder collected in a scrap)?
5. **Search engines.** Foldex's own walk only, or also the Windows Search index and Everything when present?
6. **Collections in collections.** A scrap holding a search pane's current results as a snapshot (Add all to scrap):
   wanted?
