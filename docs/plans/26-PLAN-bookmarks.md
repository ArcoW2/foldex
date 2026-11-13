# Plan 26: Bookmarks, quick access among them: names, icons, keys, Regular or Root, new panes, in Home > Open

Status: not started.

- 2026-11-13: draft, at the user's request.

Builds on plan 23 (`docs/plans/executed/23-PLAN-quick-access-and-favourites.md`), which built quick access (an area at
the top of a tree without a parent) and favourite folders as LexPen's (a menu with Add current folder, Add a
folder..., Manage...; Manage with Up, Down, Add..., Change..., Delete, Close), as two lists. This plan makes them one
list of bookmarks, xplorer2's word, with xplorer2's icon choice (Plain, Default, Custom). The number in the file name
is the priority; rename to reorder.

## 1. What this is about

Quick access and favourite folders are two lists, kept apart, so moving a folder from one to the other means taking
it off one and adding it to the other. Neither entry can be renamed: two called "Docs" cannot be told apart, and a
folder with a meaningless name keeps it. They have no icon of their own and no key; a file cannot be one. Manage shows
a name with its parent folder under it instead of columns, and its Change... only picks another folder. A favourite
opens only in the active pane, never in a pane of its own, and never as the top of a pane. The button sits in Home >
Go; it belongs in Home > Open.

## 2. The solution, in brief

One list of bookmarks, in bookmarks.json. A bookmark is a folder or an item (a file), each with a location, a name,
an icon, two optional keys, a way of opening (Regular or Root) and a quick access flag: with the flag it shows in the
Quick access area of a tree without a parent, without it in the Bookmarks menu, so switching is one click. Manage
shows every bookmark in columns: Name (the icon, then the name), Location and Quick access (a check box). Edit...
opens a window with all of it; Custom icons come from a Change Icon window (every icon of a dll, exe or ico file,
SHELL32.dll by default); keys are pressed into key fields as one key or a chord, starting with Ctrl+B by default: one
opens the bookmark in the active pane, the other in a new pane with a child pane. Regular goes to the folder (from a
child pane: its parent focuses the folder and the child follows); Root makes it the top of the pane, with a ".." row
to go up. An item opens its folder and is focused there (gone: the folder, at its top). A location not there or not
reachable is a message; nothing moves. In the Bookmarks menu a click opens a bookmark; a right-click offers Open, Open
in a new pane, Open in a new pane with a child pane, Edit..., Move to quick access and Remove. F2 on a quick access
shortcut renames it. The Bookmarks button is in Home > Open.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| One list | bookmarks.json: every bookmark an entry (location, item, quick access, name, icon, keys, root); quickaccess.json and favourite-folders.json taken over | -- | 3.0; 3.1 |
| Word | Favourite folders called Bookmarks everywhere | -- | 3.0 |
| Quick access flag | the area shows the flagged entries, the menu the others; switching | One list | 3.2 |
| Manage | columns Name (icon, name), Location, Quick access; Edit... | One list | 3.3 |
| Edit | the window: name, location, quick access, open as, icon, two keys | One list | 3.4 |
| Change Icon | the window with a file's icons; the host reads them | Edit | 3.5 |
| Keys | a bookmark's two keys in the key set, a clash asked; the key fields | One list | 3.6 |
| Menu | names, icons and keys in the Bookmarks menu | One list | 3.7 |
| Right-click | in the menu: Open, Open in a new pane (with or without a child pane), Edit..., Move to quick access, Remove; on a shortcut: Move to bookmarks | Edit | 3.8 |
| Ribbon | Bookmarks in Home > Open | Word | 3.9 |
| Quick access shortcuts | F2 renames a shortcut; its icon | One list | 3.10 |
| Regular and Root | a bookmark opened as the top of a pane, ".." to go up in trees and lists | One list | 3.11 |
| Items and missing places | an item as a bookmark; a location not there or not reachable: a message, nothing moves | One list | 3.12 |
| Tests | unit and in the app | all | 3.13 |

## 3. Details

### 3.0 What changes in what is built

Plan 23's quick access and favourite folders stay and are changed, not made again:

| Built (plan 23) | Where | Changes to |
|---|---|---|
| Two lists: quickaccess.json and favourite-folders.json, each `folders`, a list of paths | FolderLists.cs, AppHost.cs | one list, bookmarks.json, `bookmarks`, a list of entries (3.1); both old files taken over once |
| "folderLists" to every window; folderListAdd, folderListRemove, folderListSet per kind | AppHost.cs, MainForm.cs, folderlists.js | the one list of entries; a change sets an entry's flag rather than moving it between lists (3.2) |
| The word "favourite folders", "Favourites" | ribbon.json, folderlists.js, actions.js, MainForm.cs (Windows' menu items), F1 | "Bookmarks": the ribbon button, the menu, Manage's title, Windows' menu items, the actions (bookmarks.menu, bookmarks.add, bookmarks.manage; the old names still accepted, so a ribbon.json or keys.json of your own keeps working) |
| Windows' menu: Add to / Remove from quick access, Add to / Remove from favourite folders, for one folder | MainForm.cs (ShellMenu.AddOwn), app.js | for one folder or one file; Add to quick access / Add to bookmarks, Move to quick access / Move to bookmarks, Remove from quick access / Remove from bookmarks (3.2) |
| Manage: a row of name with its parent folder; Change... picks a folder | folderlists.js (manageFavourites), app.css | every bookmark; columns Name, Location, Quick access; Edit... and Add... open Edit (3.3, 3.4) |
| The menu: the folder's name | folderlists.js (favouritesMenu), menu.js | the name, icon and key; a right-click menu (3.7, 3.8) |
| The button in Home > Go | defaults/ribbon.json | in Home > Open (3.9) |
| The key set from keys.json | keys.js | plus the bookmarks' keys (3.6) |
| A quick access shortcut: its folder's name and icon | folderlists.js (quickAccessEntries), app.js (TreeView) | its entry's name and icon; F2 renames it (3.10) |
| item.rename (F2): the item on disk | actions.js | a quick access shortcut first: its name (3.10) |
| A missing folder: a question to take it off the list | folderlists.js (openFavourite, missingFolder) | a message only; nothing moves (3.12) |

Unchanged: the Quick access area itself (its head, folding, expanding a shortcut, its tree colour, dragging into and
within it, Del on a shortcut), Add current folder / Remove current folder, Add a folder..., where a bookmark opens
(favouritePane).

### 3.1 The list

- bookmarks.json is one list, `bookmarks`, in your order, one entry per bookmark: { location, item, quickAccess, name,
  icon, key, keyNew, root }. Only location is always there; the rest only when set.
- item: true when the location is an item (a file) rather than a folder, set when it is added (Windows' menu on a
  file, or Edit finding a file there). It is the one difference between the two: after the folder opens, the item is
  focused (3.12). Kept rather than asked each time, so a file that is gone is still known to be one.
- quickAccess: true for a quick access shortcut (3.2); absent is a bookmark of the menu.
- name: empty, or the location's own name, is not kept (its own name is shown). icon: absent is Default (the
  location's own icon), "plain" is no icon, otherwise "<file>,<index>" (as Windows writes an icon place, %SystemRoot%
  kept as written). key (Open) and keyNew (Open in a new pane with a child pane): each as keys.json writes one
  ("Ctrl+B, 1"); either can be absent. root: true for Root (3.11); absent is Regular.
- Taken over once, when bookmarks.json is not there yet: quickaccess.json's folders (quickAccess set), then
  favourite-folders.json's; a folder in both is one entry, with quickAccess set (it stays where you see it in the
  tree). Neither file there either: the first list from Explorer's pinned folders, quickAccess set, as built.
- One entry per location (any case, a known folder by its shell name or path). A location changed in Edit keeps the
  rest of its entry.
- The host keeps the list (FolderLists), writes it whole through a temporary file and sends it to every window after
  a change, as built.
- Added from Windows' right-click menu or the Bookmarks menu: only location, item for a file, and quickAccess when
  added to quick access.

### 3.2 The quick access flag

- With quickAccess, an entry is a shortcut in the Quick access area at the top of every tree without a parent, in
  the order of the list; without it, an entry of the Bookmarks menu, in the order of the list. Never both.
- Switching is one change to the flag; the entry keeps its place in the list, name, icon, keys and the rest:
  - Manage: the Quick access check box of a row (a click, or Space on the selected row).
  - Edit: the Quick access check box.
  - The Bookmarks menu: right-click a bookmark, Move to quick access (3.8).
  - A shortcut: Windows' menu on it has Move to bookmarks (Foldex's own items at its top, as built).
  - Windows' menu on a folder or file that is a bookmark: Move to quick access or Move to bookmarks, beside Remove.
- Dragging within the area (as built) moves the entry in the list: it lands before the shortcut it was dropped on,
  or after the last one; bookmarks of the menu in between keep their places. A folder dropped on the area is added
  with quickAccess set, or, when it is a bookmark of the menu, gets the flag.
- Del on a shortcut (as built) takes the entry off the list; nothing on disk changes.

### 3.3 Manage

- Every bookmark, quick access ones too, in the order of the list, in three columns with a head: Name (the icon, then
  the name; the location's own name when it has none), Location (the full path; a missing one struck through) and
  Quick access (a check box). The columns can be made wider by dragging their border in the head; no sorting (the
  order is yours, set with Up and Down).
- Buttons: Up, Down, Add..., Edit..., Delete, Close. Edit... (also Enter, F2 and a double click) opens Edit (3.4) for
  the selected row. Add... opens Edit empty, with the location's Browse... opened at once (Windows' folder picker); a
  location already in the list is refused there.
- Up, Down, Delete, Close and their keys as built; Space toggles Quick access; every change goes to the host at once.
- Where Foldex differs from LexPen: LexPen's Manage has one row per file with its folder under it, and Change...
  picks another file. Foldex has columns and Edit..., as the user asked.

### 3.4 Edit

- A modal window in the page (as every Foldex dialog: Esc cancels, Enter is OK, letter shortcuts). Fields:
  - Name: a text box, its text selected. Empty: the location's own name.
  - Location: a text box with Browse... (Windows' folder picker at that folder): a folder or a file on disk, a
    network path (`\\server\share\folder`) or a shell folder; a file's path is typed or comes from Windows' menu.
    Other places (FTP and the like) are not part of this plan; the field and the stored location are plain text, so
    they can come later. A location already another bookmark is refused with a message on OK. One that is not there:
    asked whether to keep it anyway (a share can be away).
  - Quick access: a check box (3.2).
  - Open as: Regular or Root (two radio buttons; 3.11).
  - Icon: Plain, Default or Custom (three radio buttons), the icon shown beside them. Custom: the Change Icon button
    shows and opens Change Icon (3.5); choosing Custom without an icon yet opens it at once.
  - Keys: two key fields (3.6), each with a Clear button: "Open" and "Open in a new pane with a child pane".
- OK keeps everything at once (one change to the host); Cancel keeps nothing.

### 3.5 Change Icon

- As xplorer2's: a file name box (default `%SystemRoot%\System32\SHELL32.dll`), Browse... (Windows' file picker for
  .dll, .exe, .ico, .icl), a panel with every icon in that file, and OK and Cancel at the bottom. A click selects an
  icon; a double click selects it and is OK. The icon chosen before is selected when it opens.
- The host reads the icons (ExtractIconEx per index; a file with none says so in the panel), off its window's
  thread, and sends them as small pictures (as the list's icons are sent); the page asks again when the file name
  changes (Enter in the box, or Browse...).
- The icon is drawn from its file wherever a bookmark shows (the menu, a shortcut, Manage): the host makes the
  picture once and keeps it (as other icons are kept); a file that is gone falls back to Default.

### 3.6 Keys

- A bookmark, quick access ones too, has two keys, both optional, as it can be opened in more than one way:
  - Open: in the active pane (as a click in the menu or on a shortcut; Regular or Root as the bookmark is set).
  - Open in a new pane with a child pane (as that item of the right-click menu, 3.8).
- Each key can be one key ("Ctrl+Alt+1") or a chord of two, as LexPen and keys.json have them ("Ctrl+B, 1"): the
  first waits in the status line for the second (keys.js, as built). The second key of a chord may have its own Ctrl,
  Alt, Shift ("Ctrl+B, Shift+1"). Any key is allowed, not only Ctrl/Alt/Shift with 0-9. The keys here are examples.
- Ctrl+B starts the bookmarks' keys by default: an empty key field (either one) offers "Ctrl+B, " and waits for the
  second key (another first key can be pressed instead: Backspace empties the field). Ctrl+B is free in the shipped
  keys.json, and WebView2's own browser keys are off (MainForm: AreBrowserAcceleratorKeysEnabled false), so nothing
  else answers it. The shipped keys.json keeps Ctrl+B for the bookmarks: it binds no other key or chord starting with
  Ctrl+B. This is a convention for the shipped keys, not a rule for you: any key can be chosen (a clash, below).
- The keys live with the bookmarks (3.1), not in keys.json: the page adds them to the key set when the list comes
  (actions bookmarks.open and bookmarks.openNew, with the location as their parameter), so F1 lists them with the
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

### 3.7 The menu

- The Bookmarks menu shows the entries without quickAccess: the icon (none for Plain), the name, and the Open key at
  the right (as a key shows in other menus); the tooltip the full path. A missing location: "<name> (not there)". Two
  with the same name are left as they are: the tooltip and Manage show their locations.
- The right-click menu (3.8) shows each key at its own item.
- menu.js gets an icon per item (a picture before the label, in the check mark's column when the menu has no checks).

### 3.8 Right-click

- In the Bookmarks menu, a right-click on a bookmark opens a small menu beside it, as a submenu:
  - Open: in the active pane, as a left click (Regular or Root, as the bookmark is set).
  - Open in a new pane: a new root pane (newRootPane: a folder tree of its own in the left area, in a colour of its
    own, the keyboard in it). Regular: This PC at its top, the folder revealed and focused. Root: the folder as its
    top (3.11). The new pane has no children: Enter on a folder in it opens a child pane, as in any root pane.
  - Open in a new pane with a child pane: the same, and a child list beside it showing the folder.
  - Edit...: Edit (3.4) for this bookmark.
  - Move to quick access (3.2).
  - Remove: off the list (no question; nothing on disk changes).
- A location that is not there or not reachable: the Open items give the message of 3.12, as a left click does.
- With the keys: the menu key or Shift+F10 on the lit bookmark opens the same small menu.
- menu.js gets this generic: an item may carry `context` (items), shown at a right-click or the menu key on that item.
  The opener rule (CLAUDE.md, Menus) is about the button that opened the menu and is not touched.
- A quick access shortcut's right-click is Windows' menu with Foldex's items at its top (as built): Move to bookmarks
  and Remove from quick access, plus Edit... (3.4).

### 3.9 Ribbon

- ribbon.json: Bookmarks (bookmarks.menu) in Home > Open, small, stacked under Properties and Select all (the third
  in that column, the most a column holds). Go keeps Back, Forward, Up and Refresh.
- A ribbon.json of your own is not changed (it replaces the shipped one whole, plan 01 3.3); its favourites.menu
  keeps working (3.0).

### 3.10 Quick access shortcuts

- A shortcut shows its entry's name and icon (the location's own when it has none, as built).
- F2 (item.rename) on a shortcut edits its entry's name in place, with the same edit box as a rename (Enter keeps,
  Esc cancels). It is checked before the rename of the item on disk, as Delete checks for a shortcut first (plan 23
  3.4): the folder on disk keeps its name. The same through the ribbon's or a menu's Rename on a shortcut. Empty, or
  the location's own name: the name is dropped (with the parent dimmed when two have the same name, as built).
- A shortcut for an item: a row without an expander; a click opens its folder and focuses the item (3.12).
- A shortcut's subfolders (when it is expanded) are folders on disk: F2 on them renames them.

### 3.11 Regular and Root

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

### 3.12 Items, and places that are not there

- An item (a file) is a bookmark as a folder is, with item set (3.1): Windows' right-click menu for one file gets the
  same Foldex items as one folder, and Edit takes a file's path. Its Default icon is the file's own.
- Opened, an item opens its folder as a folder bookmark would (Regular or Root, from a child pane through its parent,
  3.11), and the item is selected and focused in the pane that lists the folder's items: the active pane when it
  lists, else the child that follows it (a tree of folders shows no files). A Root item makes its folder the top.
- An item that is gone: its folder opens all the same, the focus on its first item.
- A location that is not there or not reachable (a folder, an item's folder, a share or server that does not answer;
  asked as a pane asks, NetworkGuard): a message in the status line ("<location> is not there." / "<server> is not
  reachable."). Nothing moves: no pane goes anywhere, no new pane is made, the bookmark stays in the list. The active
  pane gets the keyboard back (after the menu, a shortcut or a key). Taking it off is Remove (3.8), Del on a shortcut
  or Manage.

### 3.13 Tests

- Unit (FolderListsTests): an entry's location, item, quickAccess, name, icon, both keys and root kept and read back;
  one key without the other; quickaccess.json and favourite-folders.json taken over once (plain paths, quickAccess
  set for the first, a folder in both one entry with quickAccess); Explorer's pinned folders when none of the three
  is there; a flag switched keeps the entry's place and the rest; a location changed keeps the rest; one entry for
  the same location in another case and for a known folder by its shell name and path; an empty name and the
  location's own name not kept. The icons of SHELL32.dll read (some found, each a picture); a file without icons
  gives none.
- Page (Jint): the area and the menu each take their entries, in list order; a drag in the area moves the entry
  between its neighbours; the clashes of 3.6 found and named (a key bound, a prefix, a chord on a bound first key,
  another bookmark's key, a bookmark's two keys the same); a bookmark's key over a keys.json key runs the bookmark;
  the old action names still run.
- In the test copy (CDP, real keys and mouse where possible): the word Bookmarks in the ribbon, the menu, Manage and
  Windows' menu; the old lists taken over (both, a folder in both); Manage's columns with icons and the Quick access
  check box (a click and Space: the entry moves between the menu and the area at once, in every window); Move to
  quick access from the menu's right-click, Move to bookmarks from a shortcut's menu; Edit: a name, a location by
  typing, the Quick access box, Plain / Default / Custom, Change Icon (SHELL32's icons, a double click), a key and a
  chord pressed into the key fields, a clash asked (No keeps the old key; Yes on Ctrl+C: the bookmark opens with it,
  Copy has no key in F1); kept after a restart; the Open key opens the bookmark in the active pane, the other in a
  new pane with a child pane, for a bookmark and for a shortcut; F1 lists them; the menu with names, icons and keys;
  the right-click: Open, Open in a new pane (its own colour, the keyboard in it, This PC at the top and the folder
  focused), with a child pane, Edit..., Remove; the menu key on a lit bookmark; Root in an existing tree and in a new
  pane: the folder as the top, "..", Backspace, up to a drive and back to the usual tops, kept after a restart; Root
  in a list: the ".." row first in every sort, left out of Ctrl+A, going up; Root from a child pane: as Regular, no
  top changed; Regular from a child pane: the parent focuses the folder, the child shows it with its first item
  focused and keeps the keyboard; a network path as a location; an item (added from Windows' menu) as a bookmark and
  as a shortcut: its folder opens and the item is selected and focused, in a list and through a tree's child; the
  item renamed away: the folder at its top; a folder renamed away and an unreachable share: the message, no pane
  moved, the keyboard back in the active pane; Bookmarks in Home > Open. F2 on a shortcut: renamed, the folder on
  disk unchanged, kept after a restart, emptied back to the folder's name; F2 on a subfolder under a shortcut still
  renames that folder.

## 4. Open questions

None.
