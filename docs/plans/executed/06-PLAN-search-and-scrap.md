# Plan 06: Search and scrap: panes of items from anywhere

Status: executed (2026-11-12); see As built.

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
- 2026-11-12: executed.
- 2026-11-12: revised and built: a pinned scrap comes back after a restart (empty), wherever it is.

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

| Part | What | Reference |
|---|---|---|
| Scrap pane | flat entries, the folder column, watched entries, missing ones dropped; no source; the dashed ring and head edge; the name in the head; rename, clear; docked; lifetime | 3.1, 3.2; 6 |
| Scrap as a parent | a folder focused in a scrap shows in its child; the child goes its own way | 3.1; 6 |
| Filling a scrap | New scrap, drop, Add to scrap, paste; a folder as its own path | 3.2; 6 |
| Find dialog | Look in, subfolders, depth / breadth first, search index, Files, Folders, regular expression, fuzzy, Named, Predefined and Save, clear, ok, cancel, Into, Clear the scrap first | 3.3; 6 |
| Running a search | Everything, the Windows Search index, Foldex's walk; streaming results, Stop, the scrap keeping its search, searching again, a search on a scrap | 3.4; 6 |
| File actions on a scrap | Delete, Alt+Delete, Alt+Shift+Delete (and Shift+Delete), the scrap's Delete button | 3.5; 6 |
| Own menu for mixed folders | Foldex's own menu for items from different folders | 3.5; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

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
  search options (so a mini scrap can stay in the window as a drop target), and so does a pinned scrap wherever it is
  (the pin in its head, or Pin in its menu). Saved in the project's session.

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

## 6. As built

**Where.** The page: `web/scraps.js` (what a scrap holds and keeps, no DOM: merging, following a move, names, one
folder or more, what a restart leaves), `web/find.js` (the Find dialog, running a search, renaming a scrap),
`web/app.js` (`ScrapView`, a `ListView` of its own entries; `newScrap`, `addToScrap`, the menu for mixed folders),
`web/panes.js` (`ownWay`; a scrap is never connected as a child), `web/actions.js` (the actions below). The host:
`Shell/FileSearch.cs` (the name test, the walk, the engines in turn), `Shell/Everything.cs`, `Shell/WindowsSearch.cs`,
`SearchesFile.cs` (searches.json), `ShellListing.Entries` (entries for given paths), `FileOps` (a permanent delete,
the ids of a finished operation and the [old, new] paths of what it moved), `MainForm` (the ops `entries`, `drop` onto
a scrap, `scrapPaste`, `search`, `searchStop`, `searchesSave`), `AppHost.RunId`. The package System.Data.OleDb
(10.0.0) for the Windows Search index.

**Decided while building.**

- Docked means in a side area (left, right, top, bottom); "in the panes" is the center area.
- "Lives while Foldex runs": a scrap's ids go with the window's layout, with the run they were made in
  (`AppHost.RunId`). A layout of another run is a restart: the scraps in the center go, a docked one comes back empty
  with its name and search, as does a pinned one in the center (a scrap's pin keeps it; it is never a child, so the
  pin has no other meaning there). Closing a project's window and opening it again in the same run keeps its scraps, as does
  a new page after the page failed.
- New scrap: docked in the right area. A search's new scrap: at the right of the active pane when that is in the
  center, else of the center's first pane shown. Its name: what was searched, made unique ("bru (2)"). Its colour: a
  branch colour as for a new branch. It has the Folder column after the name.
- Grouping by folder: sorting on the Folder column (the column header's sort); no grouping view of its own.
- Named: text without wildcards is found anywhere in the name; with * or ? it is the whole name; ";" separates
  patterns. A regular expression (.NET) is found anywhere in the name. Case never counts.
- Fuzzy: 100 minus the share of the pattern that the fewest edits take to make it a part of the name (an edit
  distance with a free start and end in the name), rounded so that one edit in three letters gives 66. It applies to
  patterns without wildcards; below 100 the search always walks the folders.
- Engines, with Use search index on: Everything (its window messages, the IPC of Everything 1.4) when it runs, the
  search includes subfolders and it has anything below Look in; else the Windows Search index (OLE DB) when it has
  anything below Look in and the name is no regular expression; else the walk. Every candidate of an index is tested
  again by Foldex's own name test and looked up on disk, so each engine finds the same. The status line says which
  engine answered.
- Look in a scrap shows as "Scrap: its name"; the search then tests its entries only (a folder not looked into) and
  fills a new scrap.
- Tab order: Look in, Search subfolders, the walk order, Use search index, Files, Folders, Regular expression, Fuzzy,
  Named, Predefined, Save, Into, Clear the scrap first, Clear, OK, Cancel. Until plan 20, Tab from Named goes to
  Predefined.
- searches.json in the data folder holds Predefined and the lists of earlier folders and names, each list the
  SearchListMax (20, chosen, not measured) used last; every window gets it again when it changes.
- A double-click or Enter on a folder in a scrap: the keyboard to its child (which shows it), or a new child at its
  right when it has none. A child of a scrap goes its own way (`ownWay`): it opens folders in itself and keeps its own
  history, as a pane without a parent.
- Delete: in a scrap Del takes the items out; Alt+Del deletes from disk (Recycle Bin) in any pane; Shift+Del and
  Alt+Shift+Del delete permanently. Each asks first in Foldex's own question box (it was the browser's confirm),
  listing the folders when the items are in more than one. A scrap drops what was deleted once the operation is done.
- Items of more than one folder in a scrap get Foldex's menu: Open, Copy, Cut, Copy path, Take out of the scrap,
  Delete (Recycle Bin), Delete permanently, Properties (per item); items of one folder on disk keep Explorer's.
- Watched: the folders of a window's scrap entries, up to ScrapWatchMax (100 folders, chosen, not measured; a watcher
  each); a change there checks the entries in it. Beyond that, F5 and Foldex's own file operations check them. A
  move or rename by Foldex reports the old path (taken before the move: afterwards the old item has none) and the
  new one, and the entries follow.
- The ribbon's Home tab has a Find group: Find, New scrap, Add to scrap, Delete from disk. Keys: Ctrl+F Find, Alt+Del,
  Shift+Del, Alt+Shift+Del.

**Tests.** Unit (`ScrapTests`): the name test (contained, wildcards, ";", a regular expression, a bad one), fuzzy at
a few numbers, the walk depth and breadth first, a search by name, folders only, without subfolders, in a scrap's
items only, a folder that is not there; entries for paths there and gone; searches.json kept, and a broken one;
merging without doubles in order, following a move of an item and of a folder above it, unique names, one folder or
more, what a restart leaves, a scrap as a parent and never a child, its child going its own way.

In the test copy, over the debugging port with real key events: a new scrap docked at the right, its dashed ring and
head edge with and without the keyboard, its name in the head and after a rename; Ctrl+F in a folder pane (Look in
its folder, the keyboard in Named, Shift+Tab to Fuzzy and on to Files, Tab from Named to Predefined, Esc: no scrap); a
search answered by Everything into a new, active scrap in the center; one with fuzzy 60 and one with a regular
expression without the index (walked); a search into the existing scrap from another folder (added, that scrap
active); Search again (Into that scrap, Clear the scrap first on) replacing the results; a search in a scrap into a
new one; a drop of files from three folders and a folder onto a scrap with Shift held (added, nothing moved); Del
(out, the file stays), Alt+Del (a question, then the Recycle Bin and out), Shift+Del on items of two folders (the
folders listed), Del in a folder pane (a question); the menu for mixed folders; a child pane of a scrap on its
folder; Add to scrap, Ctrl+V onto a scrap, a move by Foldex followed, a file deleted outside Foldex dropped; a restart
(the center scrap gone, the docked one back empty with its name); a center scrap pinned by a click on its pin back
empty after a restart, the unpinned one gone. The Windows Search engine was run directly
(Everything answers first on this PC): it gave items of the Documents folder, and nothing for a folder that is not
indexed.

**Not tested.** A drag with the real mouse from a Foldex pane onto a scrap, and out of a scrap with items of more
than one folder: the host's drag reads the physical mouse button, which the debugging port does not press (the drop
itself was tested with the browser's own drag events). Copying scrap items into one folder with Windows' conflict
dialog. Clicking the head's Delete button (it runs the action Alt+Del runs). Whether Alt+Del and Alt+Shift+Del are
taken by PowerToys or the like on this PC [not yet checked].

**Links (2026-11-20, at the user's request).** Find has "Follow links" (on by default, beside the order): Foldex's own
walk goes into junctions and symbolic links, and what is in them is found under the link's path. A link to the
search's own folder, to a folder above it or above the link, or to a folder searched already is found but not gone
into, so a loop (D:\king_trunk\king_trunk, a link to D:\king_trunk) ends there and nothing is found twice
(`FileSearch.Walk`, real paths by `ShellListing.RealPath`). An index (Everything, Windows Search) has a link but not
what is behind it: with the option each folder link it found is walked as well, not into what the index searched.
Off: links are found and not gone into, as before. Folder sizes still count no link (a link counts nothing). Read-ahead
of the cache (plan 24) no longer goes into a link to its own folder or one above it. Tested: `ScrapTests`
TheWalkFollowsLinksWithoutLooping (junctions back up, to the search's folder, to a folder searched already, elsewhere).
Not checked in the app.
