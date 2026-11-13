# Plan 26: Bookmarks: names, icons, keys, Regular or Root, opened in a new pane, in Home > Open

Status: not started.

- 2026-11-13: draft, at the user's request.

Builds on plan 23 (`docs/plans/executed/23-PLAN-quick-access-and-favourites.md` 3.6, 3.7), which built favourite
folders as LexPen's: a menu (the folders, Add current folder, Add a folder..., Manage...), Manage (Up, Down, Add...,
Change..., Delete, Close), a folder opening in the active pane. This plan turns them into bookmarks, xplorer2's word,
with xplorer2's icon choice (Plain, Default, Custom). The number in the file name is the priority; rename to reorder.

## 1. What this is about

A favourite folder shows only its folder's own name and cannot be renamed, so two called "Docs" cannot be told apart
and a folder with a meaningless name keeps it. It has no icon of its own and no key. Manage shows a name with its
parent folder under it instead of columns, and its Change... only picks another folder. It opens only in the active
pane, never in a pane of its own, and never as the top of a pane. The button sits in Home > Go; it belongs in Home >
Open. A quick access shortcut cannot be renamed either.

## 2. The solution, in brief

Favourite folders become Bookmarks. Every bookmark has a name, an icon, two optional keys and a way of opening,
kept with its folder in bookmarks.json. Manage shows two columns, Name (the icon, then the name) and Location; Edit...
opens a window with the name, the location (a folder, a network path or a shell folder), Regular or Root, the icon
(Plain, Default or Custom; Custom opens a Change Icon window with every icon of a dll, exe or ico file, SHELL32.dll by
default) and the two keys, pressed into key fields as one key or a chord (starting with Ctrl+B by default): one opens
the bookmark in the active pane, the other in a new pane with a child pane. Regular goes to the folder (from a child
pane: its parent focuses the folder and the child shows it); Root makes the folder the top of the pane, with a ".."
row to go up. In the Bookmarks menu a click opens a bookmark in the active pane; a right-click offers Open, Open in a
new pane, Open in a new pane with a child pane, Edit... and Remove. The Bookmarks button is in Home > Open. F2 on a
quick access shortcut gives it a name of its own, without touching the folder.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Word | Favourite folders called Bookmarks everywhere; bookmarks.json | -- | 3.0 |
| Kept | name, icon, two keys and Regular / Root per bookmark in bookmarks.json, read and written by the host | Word | 3.1 |
| Manage | columns Name (icon, name) and Location; Edit... | Kept | 3.2 |
| Edit | the window: name, location, open as, icon, two keys | Kept | 3.3 |
| Change Icon | the window with a file's icons; the host reads them | Edit | 3.4 |
| Keys | a bookmark's two keys in the key set, a clash asked; the key fields | Kept | 3.5 |
| Menu | names, icons and keys in the Bookmarks menu | Kept | 3.6 |
| Right-click | a right-click (or the menu key) on a bookmark in the menu: Open, Open in a new pane (with or without a child pane), Edit..., Remove | Edit | 3.7 |
| Ribbon | Bookmarks in Home > Open | Word | 3.8 |
| Quick access names | F2 on a shortcut: its own name, kept in quickaccess.json | -- | 3.9 |
| Regular and Root | a bookmark opened as the top of a pane, ".." to go up in trees and lists | Kept | 3.10 |
| Tests | unit and in the app | all | 3.11 |

## 3. Details

### 3.0 What changes in what is built

Plan 23's favourite folders stay and are changed, not made again:

| Built (plan 23) | Where | Changes to |
|---|---|---|
| The word "favourite folders", "Favourites" | ribbon.json, folderlists.js, actions.js, MainForm.cs (Windows' menu items), F1 | "Bookmarks": the ribbon button, the menu, Manage's title, "Add to bookmarks" / "Remove from bookmarks" in Windows' menu, the actions (bookmarks.menu, bookmarks.add, bookmarks.manage; the old names still accepted, so a ribbon.json or keys.json of your own keeps working) |
| favourite-folders.json: `folders` only | FolderLists.cs, AppHost.cs | bookmarks.json: `folders` plus `items` (3.1); favourite-folders.json read once when bookmarks.json is not there yet |
| "folderLists" to every window, folderListSet | AppHost.cs, MainForm.cs, folderlists.js | carry the items too (3.1) |
| Manage: a row of name with its parent folder; Change... picks a folder | folderlists.js (manageFavourites), app.css | columns Name and Location; Edit... and Add... open Edit (3.2, 3.3) |
| The menu: the folder's name | folderlists.js (favouritesMenu), menu.js | the name, icon and key; a right-click menu (3.6, 3.7) |
| The button in Home > Go | defaults/ribbon.json | in Home > Open (3.8) |
| The key set from keys.json | keys.js | plus the bookmarks' keys (3.5) |
| quickaccess.json: `folders` only; a shortcut shows its folder's name | FolderLists.cs, folderlists.js (quickAccessEntries) | `items` with a name; F2 on a shortcut (3.9) |
| item.rename (F2): the item on disk | actions.js | a quick access shortcut first: its name (3.9) |

Unchanged: Add current folder / Remove current folder, Add a folder..., where a bookmark opens (favouritePane), a
missing folder's question, quick access apart from its names.

### 3.1 Kept

- bookmarks.json keeps the folders (`folders`, in your order) and `items`: folder -> { name, icon, key, keyNew,
  root }, only for bookmarks that have one of them. quickaccess.json gets `items` the same way, with only a name
  (3.9); its shortcuts keep the folder's own icon.
- name: empty, or the folder's own name, is not kept (the folder's name is shown). icon: absent is Default (the
  folder's own icon), "plain" is no icon, otherwise "<file>,<index>" (as Windows writes an icon place, %SystemRoot%
  kept as written). key (Open) and keyNew (Open in a new pane with a child pane): each as keys.json writes one
  ("Ctrl+B, 1"); either can be absent. root: true for Root (3.10); absent is Regular.
- FolderLists keeps them with the list: a folder taken off loses them; the same folder (any case, a known folder by
  its shell name or path) has one entry; a folder changed in Edit keeps its name, icon and keys.
- The host sends them with the lists ("folderLists") to every window; folderListSet carries them.
- Folders added from Windows' right-click menu or from the Bookmarks menu get none of them.

### 3.2 Manage

- Two columns with a head: Name (the icon, then the name; the folder's name when it has none of its own) and Location
  (the full path; a missing folder struck through). The columns can be made wider by dragging their border in the
  head; no sorting (the order is yours, set with Up and Down).
- Buttons: Up, Down, Add..., Edit..., Delete, Close. Edit... (also Enter, F2 and a double click) opens Edit (3.3) for
  the selected row. Add... opens Edit empty, with the location's Browse... opened at once (Windows' folder picker); a
  folder already in the list is refused there.
- Up, Down, Delete, Close and their keys as built; every change goes to the host at once.
- Where Foldex differs from LexPen: LexPen's Manage has one row per file with its folder under it, and Change...
  picks another file. Foldex has columns and Edit..., as the user asked.

### 3.3 Edit

- A modal window in the page (as every Foldex dialog: Esc cancels, Enter is OK, letter shortcuts). Fields:
  - Name: a text box, its text selected. Empty: the folder's name.
  - Location: a text box with Browse... (Windows' folder picker at that folder): a folder on disk, a network path
    (`\\server\share\folder`) or a shell folder. Other places (FTP and the like) are not part of this plan; the field
    and the stored location are plain text, so they can come later. A folder already another bookmark is refused
    with a message on OK. A folder that is not there: asked whether to keep it anyway (a share can be away).
  - Open as: Regular or Root (two radio buttons; 3.10).
  - Icon: Plain, Default or Custom (three radio buttons), the icon shown beside them. Custom: the Change Icon button
    shows and opens Change Icon (3.4); choosing Custom without an icon yet opens it at once.
  - Keys: two key fields (3.5), each with a Clear button: "Open" and "Open in a new pane with a child pane".
- OK keeps everything at once (one change to the host); Cancel keeps nothing.

### 3.4 Change Icon

- As xplorer2's: a file name box (default `%SystemRoot%\System32\SHELL32.dll`), Browse... (Windows' file picker for
  .dll, .exe, .ico, .icl), a panel with every icon in that file, and OK and Cancel at the bottom. A click selects an
  icon; a double click selects it and is OK. The icon chosen before is selected when it opens.
- The host reads the icons (ExtractIconEx per index; a file with none says so in the panel), off its window's
  thread, and sends them as small pictures (as the list's icons are sent); the page asks again when the file name
  changes (Enter in the box, or Browse...).
- The icon is drawn from its file wherever a bookmark shows (Manage, the menu): the host makes the picture once and
  keeps it (as other icons are kept); a file that is gone falls back to Default.

### 3.5 Keys

- A bookmark has two keys, both optional, as it can be opened in more than one way:
  - Open: in the active pane (as a click in the menu; Regular or Root as the bookmark is set).
  - Open in a new pane with a child pane (as that item of the right-click menu, 3.7).
- Each key can be one key ("Ctrl+Alt+1") or a chord of two, as LexPen and keys.json have them ("Ctrl+B, 1"): the
  first waits in the status line for the second (keys.js, as built). The second key of a chord may have its own Ctrl,
  Alt, Shift ("Ctrl+B, Shift+1"). Any key is allowed, not only Ctrl/Alt/Shift with 0-9. The keys here are examples.
- Ctrl+B starts the bookmarks' keys by default: an empty key field (either one) offers "Ctrl+B, " and waits for the
  second key (another first key can be pressed instead: Backspace empties the field). Ctrl+B is free in the shipped
  keys.json, and WebView2's own browser keys are off (MainForm: AreBrowserAcceleratorKeysEnabled false), so nothing
  else answers it. The shipped keys.json keeps Ctrl+B for the bookmarks: it binds no other key or chord starting with
  Ctrl+B. This is a convention for the shipped keys, not a rule for you: any key can be chosen (a clash, below).
- The keys live with the bookmarks (3.1), not in keys.json: the page adds them to the key set when the lists come
  (actions bookmarks.open and bookmarks.openNew, with the folder as their parameter), so F1 lists them with the
  rest. keys.json is not written by Foldex (it may hold your own comments).
- A key field: focused, it takes the next key pressed (with its Ctrl, Alt, Shift) and shows it; a second key
  pressed within it makes a chord of the two; a third starts again. Backspace and Clear empty it. It does not run
  the keys it takes.
- A bookmark's two keys the same: refused on OK.
- Any other clash is asked on OK, naming what has the key and what it loses, and the bookmark gets the key on Yes
  (No: back in the field). Any key can be taken this way, Ctrl+C too (Copy then has no key, unless it has another):
  - the same key or chord bound in keys.json ("Ctrl+C is Copy. Use it for this bookmark? Copy then has no key.");
  - the same key or chord of another bookmark (that bookmark loses it);
  - a single key that keys.json or another bookmark uses as the first key of a chord (those chords stop working);
  - a chord whose first key is bound on its own (that key no longer runs its action on its own).
- The bookmarks' keys are added to the key set after keys.json, so a key taken this way runs the bookmark. F1 shows
  the action that has the key; one that lost it shows no key.
- Where Foldex differs from xplorer2: xplorer2 allows only Ctrl, Alt, Shift with 0-9; Foldex allows any key or chord.

### 3.6 The menu

- The Bookmarks menu shows the icon (none for Plain), the name, and the Open key at the right (as a key shows in other
  menus); the tooltip the full path. A missing folder: "<name> (not there)". Two bookmarks with the same name are left
  as they are: the tooltip and Manage show their locations.
- The right-click menu (3.7) shows each key at its own item.
- menu.js gets an icon per item (a picture before the label, in the check mark's column when the menu has no checks).

### 3.7 Right-click on a bookmark

- In the Bookmarks menu, a right-click on a bookmark opens a small menu beside it, as a submenu:
  - Open: in the active pane, as a left click (Regular or Root, as the bookmark is set).
  - Open in a new pane: a new root pane (newRootPane: a folder tree of its own in the left area, in a colour of its
    own, the keyboard in it). Regular: This PC at its top, the folder revealed and focused. Root: the folder as its
    top (3.10). The new pane has no children: Enter on a folder in it opens a child pane, as in any root pane.
  - Open in a new pane with a child pane: the same, and a child list beside it showing the folder.
  - Edit...: Edit (3.3) for this bookmark.
  - Remove: off the bookmarks (no question; nothing on disk changes).
- A missing folder: the Open items ask to take it off, as a left click does.
- With the keys: the menu key or Shift+F10 on the lit bookmark opens the same small menu.
- menu.js gets this generic: an item may carry `context` (items), shown at a right-click or the menu key on that item.
  The opener rule (CLAUDE.md, Menus) is about the button that opened the menu and is not touched.
- The right-click works on the bookmarks of the menu only. Manage has no right-click menu.

### 3.8 Ribbon

- ribbon.json: Bookmarks (bookmarks.menu) in Home > Open, small, stacked under Properties and Select all (the third
  in that column, the most a column holds). Go keeps Back, Forward, Up and Refresh.
- A ribbon.json of your own is not changed (it replaces the shipped one whole, plan 01 3.3); its favourites.menu
  keeps working (3.0).

### 3.9 Quick access names

- F2 (item.rename) on a shortcut in a tree's Quick access area edits the shortcut's name in place, with the same edit
  box as a rename (Enter keeps, Esc cancels). It is checked before the rename of the item on disk, as Delete checks
  for a shortcut first (plan 23 3.4): the folder on disk keeps its name. The same through the ribbon's or a menu's
  Rename on a shortcut.
- Empty, or the folder's own name: the name is dropped, and the shortcut shows its folder's name again (with its
  parent dimmed when two have the same name).
- Kept in quickaccess.json (3.1) and told to every window, so every tree shows it.
- A shortcut's subfolders (when it is expanded) are folders on disk: F2 on them renames them.

### 3.10 Regular and Root

- Regular (goTo in app.js, as built): a pane without a parent, or pinned, goes to the folder itself (a tree reveals
  and focuses it, a list shows it). A child pane does not go there on its own: its parent focuses the folder (a tree
  reveals it, a list selects it), and the child, following, shows the folder's items, its first item focused, and
  keeps the keyboard.
- Root opens the folder as the top of the pane, also in an existing pane without a parent. From a child pane, Root
  is as Regular: the parent looks the folder up and focuses it, and the child follows; no pane's top changes.
  - A tree: its tops (This PC, Quick access and the rest) give way to that one folder, opened; a ".." row above it
    goes up: the folder above becomes the top (a drive's ".." gives the tree its usual tops). Backspace and Up on the
    top do the same. The Quick access area is not shown while a tree has a folder as its top.
  - A list: it shows the folder with a ".." row at the top of its items; ".." (Enter or a double click on it) goes
    to the folder above, which keeps the ".." row (a drive's ".." goes to This PC, without one). Backspace and Up do
    the same. The ".." row is never selected with Ctrl+A, never copied, dragged or deleted, and sorts first whatever
    the sort.
- The top is kept with the pane in the layout, so it is still there after a restart. A Regular bookmark opened in
  such a tree reveals the folder under that top when it is under it, else gives the tree its usual tops first.
- Built on what child trees have: a child tree has a folder as its top (TreeView `root`) and goes up from it
  (`up()`); a root tree gets the same, and the ".." row is new in trees and lists.

### 3.11 Tests

- Unit (FolderListsTests): name, icon, both keys and root kept and read back; one key without the other; a file without
  `items` read as before; favourite-folders.json taken over when bookmarks.json is not there; all of them dropped when
  the folder is taken off and kept when it is changed; one entry for the same folder in another case and for a known
  folder by its shell name and path; an empty name and the folder's own name not kept. The icons of SHELL32.dll read
  (some found, each a picture); a file without icons gives none.
- Page (Jint): the clashes of 3.5 found and named (a key bound, a prefix, a chord on a bound first key, another
  bookmark's key, a bookmark's two keys the same); a bookmark's key over a keys.json key runs the bookmark; the old
  action names still run.
- In the test copy (CDP, real keys and mouse where possible): the word Bookmarks in the ribbon, the menu, Manage and
  Windows' menu; Manage's columns with icons; Edit: a name, a location by typing, Plain / Default / Custom, Change
  Icon (SHELL32's icons, a double click), a key and a chord pressed into the key fields, a clash asked (No keeps the
  old key; Yes on Ctrl+C: the bookmark opens with it, Copy has no key in F1); kept after a restart; the Open key opens
  the bookmark in the active pane, the other in a new pane with a child pane; a bookmark with only one of the two
  keys; F1 lists them; the menu with names, icons and keys; the right-click: Open, Open in a new pane (its own colour,
  the keyboard in it, This PC at the top and the folder focused), with a child pane, Edit..., Remove; the menu key on
  a lit bookmark; Root in an existing tree and in a new pane: the folder as the top, "..", Backspace, up to a drive
  and back to the usual tops, kept after a restart; Root in a list: the ".." row first in every sort, left out of
  Ctrl+A, going up; Root from a child pane: as Regular, no top changed; Regular from a child pane: the parent focuses the folder, the child shows it with its first item
  focused and keeps the keyboard; a network path as a location; Bookmarks in Home > Open. F2 on a quick access
  shortcut: renamed, the folder on disk unchanged, kept after a restart, emptied back to the folder's name; F2 on a
  subfolder under a shortcut still renames that folder.

## 4. Open questions

None.
