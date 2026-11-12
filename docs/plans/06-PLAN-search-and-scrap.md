# Plan 06: Search and scrap: panes of items from anywhere

Status: draft 2026-11-10, revised 2026-11-12 (six times); not started.

- 2026-11-10: draft.
- 2026-11-12: revised with the user's answers: Delete per pane kind, a scrap per project and not kept across a restart,
  missing entries dropped, search inside a collection, every engine available, a scrap standing alone (no source, no
  followers), opened empty and docked as any pane.
- 2026-11-12: revised again: search results always go into a scrap (no search pane of its own); a Find dialog after
  xplorer2's; a scrap keeps its search while it lives, can take more results, be renamed and cleared; a docked scrap
  keeps its name, search and place across a restart, empty. Containing text and additional rules moved to plan 20.
- 2026-11-12: revised: no archive content for now; Search again goes into the same scrap, with Clear the scrap first
  on.
- 2026-11-12: revised: Named gets a regular expression option and a fuzzy match (nice to have); the keyboard
  starts in Named, with Files and Folders before it and Containing text right after it.
- 2026-11-12: revised: no Local search.
- 2026-11-12: revised: a scrap can be a parent (a folder focused in it shows in its child), built in this plan when
  small; a scrap's pane is marked by a dashed ring instead of a solid one.

Builds on plan 03 (connected panes).

## 1. What this is about

The panes of plan 03 show one folder. Two things do not fit that: the result of a search (files from many folders) and
a scrap container (files and folders collected by hand, from wherever, to act on together later). In Explorer a search
result is a dead end and there is no scrap container at all: collecting files from several places means copying them
somewhere first.

## 2. The solution, in brief

A scrap is a pane holding a flat list of files and folders from anywhere. It has no source, but can be a parent: a
folder focused in it shows in its child pane. Its ring is dashed, so it never passes for a folder pane. It has a name, can be opened empty, filled by dragging and pasting, renamed, cleared and docked anywhere. A search is a
Find dialog (after xplorer2's) whose results always fill a scrap: a new one, or an existing one chosen at the bottom
of the dialog, which can be cleared first. A scrap keeps its search while it lives, to change and run again into
the same scrap (cleared first by default); a search started on a scrap searches
its entries into a new scrap. In a scrap Delete takes the entry out and Alt+Delete also moves the file to the recycle
bin. A scrap lives as long as Foldex runs; a docked one comes back after a restart empty, with its name, search and
place.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Scrap pane | flat entries, the folder column, grouping, watched entries, missing ones dropped; no source; the dashed ring and head edge; the name in the head; rename, clear; docked; lifetime | -- | 3.1, 3.2 |
| Scrap as a parent | a folder focused in a scrap shows in its child; built here when small, else moved to a plan of its own | scrap pane | 3.1 |
| Filling a scrap | New scrap, drag, Add to scrap, paste; a folder as its own path | scrap pane | 3.2 |
| Find dialog | Look in, subfolders, depth / breadth first, search index, Files, Folders, regular expression, fuzzy (nice to have), Named, Predefined and Save, clear, ok, cancel, the target scrap, Clear the scrap first | scrap pane | 3.3 |
| Running a search | engines, streaming results, Stop, the scrap keeping its search, searching again, a search on a scrap | Find dialog | 3.4 |
| File actions on a scrap | Delete, Alt+Delete, Alt+Shift+Delete, the scrap's Delete button | scrap pane | 3.5 |
| Own menu for mixed folders | Foldex's own menu for items from different folders | scrap pane | 3.5 |

Moved to plan 20 (extended search options): Containing text and Additional rules (size, attributes, date ranges).

## 3. Details

LexPen has no file finder of this kind (its `find.js` and `FolderSearch.cs` find text in files); the Find dialog
follows xplorer2's, as the user gave it, in Foldex's own dialog look.

### 3.1 The scrap pane

- An entry is a shell item's parsing name (the full path for a file or folder on disk, plan 02 3.1); the pane shows its
  name and, as a column, the folder it is in. Grouping by that folder is a view option.
- A flat list: a folder in it is one entry, its own path, not its contents; there is no tree.
- Entries are watched: renamed or moved by Foldex, the entry follows; removed outside Foldex, the entry is dropped at
  once.
- No source: a scrap is never a child.
- **A parent**: a scrap can have followers as any parent (plan 03): a folder focused in it shows its contents in a
  child pane, with branches as any parent. Following goes through `layout.follow` with the focused path and whether
  it is a folder (`app.js`), which a scrap entry has too, so this looks small [not yet checked by building it]. Built
  in this plan when it is; else it moves to a plan of its own and the scrap stays without followers until then.
- **Marked as a scrap**: only the pane with the keyboard has a ring now (`app.css`, `.pane.active::after`: a solid
  2px border in its colour). A scrap always has one, dashed: dimmed while another pane has the keyboard, the full
  2px in its colour while it has it. So a scrap never passes for a folder pane, active or not.
- **Its head** shows the scrap's name (where a folder pane shows its folder), and the head's bottom edge is dashed as
  well, in the ring's colour and strength.
- Every scrap has a name: "Scrap N" for one opened empty, the searched name for one a search made. Rename... and
  Clear (all entries out, nothing on disk changes) are on its menu.
- More than one scrap at a time, each with its own name and colour.

### 3.2 Filling a scrap, and its lifetime

- Opened empty by an action (New scrap), without searching first.
- Opened by a search only when the search starts (3.4), not when the Find dialog opens.
- Filled by dragging items onto it from any pane (also from Explorer), by an action Add to scrap on the selection, by
  pasting, and by searches (3.3). Dropping a folder adds the folder's own path, not its files.
- **A drop onto a scrap never moves or copies anything on disk**, whatever keys are held (Shift, Ctrl) and whatever
  the drag's source offers: it only adds an entry per dropped item, all of them when several are dropped at once,
  each placed by the scrap's own order (its sort), not at the drop point. An item already in it is not added twice.
- Usually short-lived: collecting files for one action on all of them (renaming, moving).
- Belongs to its project's window and lives while Foldex runs; there is no scrap shared by all projects.
- After a restart a scrap in the panes is gone. A docked scrap comes back in its dock, empty, with its name and its
  search options (so a mini scrap can stay in the window as a drop target). Saved in the project's session.

### 3.3 The Find dialog

After xplorer2's "Find files or folders", without Special folders and Local search:

| Field | What |
|---|---|
| Look in | The active pane's folder when opened; a list of earlier ones. When the active pane is a scrap: that scrap (3.4) |
| Search subfolders | On by default |
| Go depth first / Breadth first | The order of Foldex's own walk |
| Use search index | On by default: any index that can answer is used (Everything, the Windows Search index, ...). Off: only Foldex's own walk (3.4) |
| Files, Folders | What to find; both on by default |
| Regular expression | Named is a regular expression instead of a pattern with `*` and `?` |
| Fuzzy | A number up to 100 next to Named: how closely a name must match; 100 is an exact match (the default). Nice to have, only if simple (3.4); off while Regular expression is on |
| Named | The name pattern; a list of earlier ones |
| Predefined, Save | Saved searches by name, kept for all projects |
| Into | At the bottom: New scrap, or one of the window's scraps by name (the results are added to it) |
| Clear the scrap first | Next to Into: the chosen scrap emptied before the search. Off by default; on for Search again (3.4) |
| clear, ok, cancel | Clear empties the fields; ok searches |

- Ctrl+F opens it (reserved for this since plan 10).
- No Archived content (searching inside zip files and the like) for now.
- **Keyboard**: when the dialog opens the keyboard is in Named, its text selected. Files, Folders, Regular expression
  and Fuzzy come before Named in the Tab order (Shift+Tab reaches them); Tab from Named goes straight to Containing
  text (plan 20), and until that is built to the field after it.
- Containing text and Additional rules (size, attributes, date ranges): plan 20.

### 3.4 Running a search

- Ctrl+F from any pane opens only the dialog; no scrap opens yet. The scrap opens when ok starts the search (cancel:
  no scrap at all), and it becomes the active pane. Into an existing scrap: that scrap becomes the active pane.
- The results stream into the scrap right after ok; Stop on the scrap.
- **Engines**: with Use search index on (the default), whatever index is available, to make the search fast:
  Everything when it is installed, the Windows Search index where Look in is indexed, and others that may come; where
  none can answer, and with Use search index off, Foldex's own walk. A criterion an engine cannot answer is
  tested by Foldex on its candidates. [Which criteria each engine answers: not yet checked.]
- **The scrap keeps its search** (Look in and every field) while it lives: Search again... opens the dialog with it, to
  change and run again. Into is that scrap and Clear the scrap first is on, so by default the new results replace
  the old; turned off, they are added.
- **Fuzzy match**: a name passes when its similarity to Named is at least the number. Only Foldex's own test can do
  that, so a fuzzy search gives up the engines' speed for the name. [The measure (edit distance or other) and
  whether it stays simple: not yet checked; dropped from this plan if not.]
- **Into an existing scrap**: the results are added to its entries; an entry already in it is not added twice. This
  searches outside the scrap; it is not a search inside its entries.
- **A search on a scrap** (Look in is a scrap): only the scrap's own entries are tested, files and folders alike, a
  folder entry not searched inside; the results go into a new scrap.

### 3.5 File actions on a scrap

| Action | On a scrap |
|---|---|
| Copy, cut | The selected items, from all their folders; pasted in one go into the target folder |
| Paste into a folder in the scrap | As into any folder |
| Paste onto the scrap itself | Adds the items as entries; nothing is copied |
| Move | The files move; the entries follow to their new paths |
| Rename, properties, open | Per item, as in a folder pane |
| Delete | Takes the entries out; nothing on disk changes |
| Alt+Delete | Takes them out and deletes them from disk (recycle bin) |
| Alt+Shift+Delete | Takes them out and deletes them permanently, as Shift+Delete in Explorer, after a question |

- In a folder pane Delete deletes from disk (recycle bin) as in Explorer, and Shift+Delete permanently; Alt+Delete
  and Alt+Shift+Delete do the same there.
- A scrap's head has a Delete button that does what Alt+Delete does (xplorer2 has one); the keys stay the main way.
- Copying or moving all go through `IFileOperation` (plan 05), so two files with the same name from different folders
  get Windows' own conflict dialog.
- Deleting from disk from several folders: one confirmation listing the folders involved.
- Explorer's context menu does not exist for items from different folders (plan 02, 6.2 item 7): the shell makes none.
  Such a selection gets Foldex's own menu (Copy, Cut, Delete, Alt+Delete, Properties per item, ...); a selection
  within one folder keeps Explorer's. Dragging them out and the shell clipboard for them: [not yet checked] (plan 02,
  6.3).
- The keys are in `keys.json` like all keys; Alt+Delete and Alt+Shift+Delete are free in Windows [not yet checked
  against PowerToys and the like on this PC].

### 3.6 Tests

- Unit: a folder focused in a scrap followed by its child;
  entries following a move and a rename; an entry removed outside Foldex dropped; a dropped folder added as one
  entry; several items dropped at once added in the scrap's order, nothing moved; results added to an existing scrap without doubles; Delete taking out entries only; Clear; a search on a
  scrap testing only its entries; a docked scrap's name, search and place restored empty from a session.
- Unit: a regular expression name; a fuzzy match at a few numbers.
- In the test copy: a scrap's dashed ring and head edge, with and without the keyboard; its name in the head, also
  after Rename; a folder focused in a scrap shown in its
  child. Ctrl+F in a folder pane, Look in filled with its folder, the keyboard in Named, Shift+Tab to
  Folders, Tab past Named, no scrap yet while the dialog is open, cancel leaving none; a name searched, a new scrap opened as the active pane and filled; the
  same search into that scrap from another folder, results added and that scrap the active pane; Search again with a changed name (Into that scrap, cleared first), and once with Clear off; a search on the
  scrap into a new scrap; a new empty scrap docked, filled by dragging from three folders, copied into one, conflicts
  asked by Windows; Delete leaves the files on disk; Alt+Delete and the Delete button move them to the recycle bin;
  Delete in a folder pane moves them to the recycle bin; after a restart the docked scrap is back empty, the other
  gone.

## 4. Open questions

None.
