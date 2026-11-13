# Plan 26: Favourite folders with names, icons and keys, opened in a new pane, in Home > Open

Status: not started.

- 2026-11-13: draft, at the user's request.
- 2026-11-13: revised: Manage in columns (Name with its icon, Location); Edit... instead of Change..., a window with
  name, location, icon (Plain, Default, Custom with a Change Icon window) and a key (a chord as keys.json has them).
- 2026-11-13: revised: a quick access shortcut renamed with F2.
- 2026-11-13: revised: answers: a new pane is a tree from This PC with the folder focused; the right-click menu also
  has Edit... and Remove; a favourite opens Regular or as Root (the pane's top, with ".." up); Open in a new pane with
  or without a child pane; the favourites' keys start with Ctrl+F; a location is a path or a network path.

Builds on plan 23 (`docs/plans/executed/23-PLAN-quick-access-and-favourites.md` 3.6, 3.7), which built the favourite
folders as LexPen's: the Favourites menu (the folders, Add current folder, Add a folder..., Manage...), Manage (Up,
Down, Add..., Change..., Delete, Close), a favourite opening in the active pane. The icon choice is xplorer2's (Plain,
Default, Custom). The number in the file name is the priority; rename to reorder.

## 1. What this is about

A favourite shows only its folder's own name and cannot be renamed, so two favourites called "Docs" cannot be told
apart and a folder with a meaningless name keeps it. It has no icon of its own and no key. Manage shows a name with
its parent folder under it instead of columns, and its Change... only picks another folder. A favourite opens only in
the active pane; there is no way to open it in a pane of its own. The Favourites button sits in Home > Go, but the
user wants it in Home > Open.

## 2. The solution, in brief

Every favourite gets a name, an icon and a key of its own, kept with its folder in favourite-folders.json. Manage
shows two columns, Name (the icon, then the name) and Location, and its Change... becomes Edit...: a window with the
name, the location, the icon (Plain, Default or Custom; Custom opens a Change Icon window that shows every icon of a
dll, exe or ico file, SHELL32.dll by default) and the key, pressed into a key field as one key or a chord of two
("Ctrl+F, 1"), checked against the keys Foldex has. A favourite opens Regular (the pane goes to the folder, as now)
or as Root (the folder becomes the top of the pane, with ".." to go up), also in an existing pane. The key and a
click in the Favourites menu open it in the active pane; a right-click on a favourite offers Open, Open in a new pane
(a new root tree, This PC at its top and the folder focused, or the folder as its top for a Root favourite), Open in
a new pane with a child pane, Edit... and Remove. The Favourites button moves from Home > Go to Home > Open. A quick
access shortcut gets a name of its own too: F2 on it edits its name in place, as a rename does, without touching the
folder.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Kept | name, icon, key and Regular / Root per favourite in favourite-folders.json, read and written by the host | -- | 3.1 |
| Manage | columns Name (icon, name) and Location; Edit... instead of Change... | Kept | 3.2 |
| Edit | the window: name, location, open as, icon, key | Kept | 3.3 |
| Root | a favourite opened as the top of a pane, ".." to go up | Kept; open question 2 | 3.10 |
| Change Icon | the window with a file's icons; the host reads them | Edit | 3.4 |
| Keys | a favourite's key in the key set, checked for clashes; the key field | Kept | 3.5 |
| Menu | names and icons in the Favourites menu | Kept | 3.6 |
| Right-click | a right-click (or the menu key) on a favourite in the menu: Open, Open in a new pane (with or without a child pane), Edit..., Remove | Edit | 3.7 |
| Ribbon | Favourites moved from Home > Go to Home > Open | -- | 3.8 |
| Quick access names | F2 on a shortcut: its own name, kept in quickaccess.json | Kept | 3.9 |
| Tests | unit and in the app | all | 3.11 |

## 3. Details

### 3.0 What changes in what is built

The favourites of plan 23 stay; this plan changes them, it does not make them again:

| Built (plan 23) | Where | Changes to |
|---|---|---|
| favourite-folders.json: `folders` only | FolderLists.cs, AppHost.cs | `folders` plus `items` (name, icon, key); old files read as before (3.1) |
| "folderLists" to every window, folderListSet | AppHost.cs, MainForm.cs, folderlists.js | carry the items too (3.1) |
| Manage: a row of name with its parent folder; Change... picks a folder | folderlists.js (manageFavourites), app.css | columns Name and Location; Edit... opens Edit; Add... opens Edit (3.2, 3.3) |
| The Favourites menu: the folder's name | folderlists.js (favouritesMenu), menu.js | the name, icon and key; a right-click menu (3.6, 3.7) |
| The button in Home > Go | defaults/ribbon.json | in Home > Open (3.8) |
| The key set from keys.json | keys.js | plus the favourites' keys (3.5) |
| quickaccess.json: `folders` only; a shortcut shows its folder's name | FolderLists.cs, folderlists.js (quickAccessEntries) | `items` with a name; F2 on a shortcut (3.9) |
| item.rename (F2): the item on disk | actions.js | a quick access shortcut first: its name (3.9) |

Unchanged: Add current folder / Remove current folder, Add a folder..., the right-click items in Windows' menu, where
a favourite opens (favouritePane), a missing folder's question, quick access.

### 3.1 Kept

- favourite-folders.json keeps its list of folders (`folders`, in your order) and gets `items`: folder -> { name,
  icon, key, root }, only for favourites that have one of them. A file without `items` (as written now) reads as
  before. root: true for a Root favourite (3.10); absent is Regular.
  quickaccess.json gets `items` the same way, with only a name (3.9); its shortcuts keep the folder's own icon.
- name: empty, or the folder's own name, is not kept (the folder's name is shown). icon: absent is Default (the
  folder's own icon, as now), "plain" is no icon, otherwise "<file>,<index>" (as Windows writes an icon place,
  %SystemRoot% kept as written). key: as keys.json writes one ("Ctrl+K, 1").
- FolderLists keeps them with the list: a folder taken off loses them; the same folder (any case, a known folder by
  its shell name or path) has one entry; a folder changed in Edit keeps its name, icon and key.
- The host sends them with the lists ("folderLists") to every window; folderListSet carries them.
- Folders added from Windows' right-click menu or from the Favourites menu get none of them.

### 3.2 Manage

- Two columns with a head: Name (the icon, then the name; the folder's name when it has none of its own) and Location
  (the full path; a missing folder struck through, as now). The columns can be made wider by dragging their border in
  the head; no sorting (the order is yours, set with Up and Down).
- Buttons: Up, Down, Add..., Edit..., Delete, Close. Edit... (also Enter, F2 and a double click) opens Edit (3.3) for
  the selected row. Add... opens Edit empty, with the location's Browse... opened at once (Windows' folder picker); a
  folder already in the list is refused there.
- Up, Down, Delete, Close and their keys as now; every change goes to the host at once, as now.
- Where Foldex differs from LexPen: LexPen's Manage has one row per file with its folder under it, and Change...
  picks another file. The user asked for columns, names, icons and keys, so Foldex has Edit... and a window of its own.

### 3.3 Edit

- A modal window in the page (as every Foldex dialog: Esc cancels, Enter is OK, letter shortcuts). Fields:
  - Name: a text box, its text selected. Empty: the folder's name.
  - Location: a text box with Browse... (Windows' folder picker at that folder): a folder on disk, a network path
    (`\\server\share\folder`) or a shell folder. Other places (FTP and the like) are not part of this plan; the field
    and the stored location are plain text, so they can come later. A folder already another favourite is refused
    with a message on OK. A folder that is not there: asked whether to keep it anyway (a share can be away).
  - Open as: Regular or Root (two radio buttons; 3.10).
  - Icon: Plain, Default or Custom (three radio buttons), the icon shown beside them. Custom: the Change Icon button
    shows and opens Change Icon (3.4); choosing Custom without an icon yet opens it at once.
  - Key: a key field (3.5), with a Clear button.
- OK keeps everything at once (one change to the host); Cancel keeps nothing.

### 3.4 Change Icon

- As xplorer2's: a file name box (default `%SystemRoot%\System32\SHELL32.dll`), Browse... (Windows' file picker for
  .dll, .exe, .ico, .icl), a panel with every icon in that file, and OK and Cancel at the bottom. A click selects an
  icon; a double click selects it and is OK. The icon chosen before is selected when it opens.
- The host reads the icons (ExtractIconEx per index; a file with none says so in the panel), off its window's
  thread, and sends them as small pictures (as the list's icons are sent); the page asks again when the file name
  changes (Enter in the box, or Browse...).
- The icon is drawn from its file wherever a favourite shows (Manage, the menu): the host makes the picture once and
  keeps it (as other icons are kept); a file that is gone falls back to Default.

### 3.5 Keys

- A favourite's key opens it in the active pane (as a click in the menu). Keys can be one key ("Ctrl+Alt+1") or a
  chord of two, as LexPen and keys.json have them ("Ctrl+F, 1", "Ctrl+F, B"): the first waits in the status line for
  the second (keys.js, as now). Any key is allowed, not only Ctrl/Alt/Shift with 0-9.
- The favourites' keys start with Ctrl+F by default: an empty key field offers "Ctrl+F, " and waits for the second
  key (another first key can be pressed instead: Backspace empties the field). Ctrl+F is Find now; what happens to
  Find is open question 1.
- The keys live with the favourites (3.1), not in keys.json: the page adds them to the key set when the lists come
  (an action favourites.open with the folder as its parameter), so F1 lists them with the rest. keys.json is not
  written by Foldex (it may hold your own comments).
- The key field: focused, it takes the next key pressed (with its Ctrl, Alt, Shift) and shows it; a second key
  pressed within it makes a chord of the two; a third starts again. Backspace and Clear empty it. It does not run
  the keys it takes.
- A clash is refused on OK, naming what has the key: the same key or chord already bound (keys.json or another
  favourite); a single key that another favourite or keys.json uses as the first key of a chord; a chord whose first
  key is bound on its own (that key would stop working on its own; Ctrl+F excepted once Find has moved, question 1).
- Where Foldex differs from xplorer2: xplorer2 allows only Ctrl, Alt, Shift with 0-9; Foldex allows any key or chord,
  as the user asked.

### 3.6 The menu

- The Favourites menu shows the icon (none for Plain) and the name, and the key at the right (as a key shows in
  other menus); the tooltip the full path (as now). A missing folder: "<name> (not there)", as now. Two favourites
  with the same name are left as they are: the tooltip and Manage show their locations.
- menu.js gets an icon per item (a picture before the label, in the check mark's column when the menu has no checks).

### 3.7 Right-click on a favourite

- In the Favourites menu, a right-click on a favourite opens a small menu beside it, as a submenu:
  - Open: the active pane goes there, as a left click (Regular or Root, as the favourite is set).
  - Open in a new pane: a new root pane (newRootPane: a folder tree of its own in the left area, in a colour of its
    own, the keyboard in it). Regular: This PC at its top, the folder revealed and focused. Root: the folder as its
    top (3.10). The new pane has no children: Enter on a folder in it opens a child pane, as in any root pane.
  - Open in a new pane with a child pane: the same, and a child list beside it showing the folder.
  - Edit...: Edit (3.3) for this favourite.
  - Remove: off the favourites (no question; nothing on disk changes).
- A missing folder: the Open items ask to take it off, as a left click does now.
- With the keys: the menu key or Shift+F10 on the lit favourite opens the same small menu.
- menu.js gets this generic: an item may carry `context` (items), shown at a right-click or the menu key on that item.
  The opener rule (CLAUDE.md, Menus) is unchanged: it is about the button that opened the menu.
- The right-click works on the favourites of the menu only. Manage has no right-click menu.

### 3.8 Ribbon

- ribbon.json: the Favourites item (favourites.menu) goes from Home > Go to Home > Open, small, stacked under
  Properties and Select all (the third in that column, the most a column holds). Go keeps Back, Forward, Up and
  Refresh.
- A ribbon.json of your own is not changed (it replaces the shipped one whole, plan 01 3.3).

### 3.9 Quick access names

- F2 (item.rename) on a shortcut in a tree's Quick access area edits the shortcut's name in place, with the same edit
  box as a rename (Enter keeps, Esc cancels). It is checked before the rename of the item on disk, as Delete checks
  for a shortcut first (plan 23 3.4): the folder on disk keeps its name. The same through the ribbon's or a menu's
  Rename on a shortcut.
- Empty, or the folder's own name: the name is dropped, and the shortcut shows its folder's name again (with its
  parent dimmed when two have the same name, as now).
- Kept in quickaccess.json (3.1) and told to every window, so every tree shows it.
- A shortcut's subfolders (when it is expanded) are folders on disk: F2 on them renames them, as now.

### 3.10 Root favourites

- A favourite set to Root opens as the top of the pane, also in an existing pane:
  - A tree: its tops (This PC, Quick access and the rest) give way to that one folder, opened; a ".." row above it
    goes up: the folder above becomes the top (a drive's ".." gives the tree back its usual tops). Backspace and Up
    on the top do the same. The Quick access area is not shown while a tree has a folder as its top.
  - A list: it shows the folder, as Regular (a list's folder is its top already; Up and Backspace go up). [How a
    list shows Root is open question 2.]
- The top is kept with the pane in the layout, so it is still there after a restart. A Regular favourite opened in
  such a tree reveals the folder under that top when it is under it, else gives the tree its usual tops back first.
- Built on what child trees have now: a child tree already has a folder as its top (TreeView `root`) and goes up from
  it (`up()`); a root tree gets the same, and the ".." row is new.

### 3.11 Tests

- Unit (FolderListsTests): name, icon and key kept and read back; a file without `items` read as before; all three
  dropped when the folder is taken off and kept when it is changed; one entry for the same folder in another case and
  for a known folder by its shell name and path; an empty name and the folder's own name not kept. The icons of
  SHELL32.dll read (some found, each a picture); a file without icons gives none.
- Page (Jint): the clash rules of 3.5 (a key bound, a prefix, a chord on a bound first key, another favourite's key).
- In the test copy (CDP, real keys and mouse where possible): Manage's columns with icons; Edit: a name, a location by
  typing, Plain / Default / Custom, Change Icon (SHELL32's icons, a double click), a key and a chord pressed into the
  key field, a clash refused (Ctrl+F, 1); kept after a restart; the key and the chord open the favourite in the
  active pane; F1 lists them; the menu with names, icons and keys; the right-click: Open, Open in a new pane (its own
  colour, the keyboard in it, This PC at the top and the folder focused), with a child pane, Edit..., Remove; the
  menu key on a lit favourite; a Root favourite in an existing tree and in a new pane: the folder as the top, "..",
  Backspace, up to a drive and back to the usual tops, kept after a restart; a network path as a location;
  Favourites in Home > Open. F2 on a quick access shortcut: renamed, the folder on disk
  unchanged, kept after a restart, emptied back to the folder's name; F2 on a subfolder under a shortcut still renames
  that folder.

## 4. Open questions

1. Ctrl+F starts the favourites' chords, but Ctrl+F is Find now. Once Ctrl+F is the first key of a chord, it waits
   for a second key and no longer finds on its own. Where does Find go? Suggested: "Ctrl+F, F" (Ctrl+F then F), and
   F3 as well. Other free Ctrl keys in the shipped keys.json: Ctrl+B, Ctrl+D, Ctrl+E, Ctrl+G, Ctrl+I, Ctrl+J, Ctrl+K,
   Ctrl+L, Ctrl+M, Ctrl+N, Ctrl+P, Ctrl+Q, Ctrl+S, Ctrl+U, Ctrl+Y, Ctrl+Z.
2. A Root favourite in a list pane: the same as Regular (the plan now), or should a list get a ".." row as well?
