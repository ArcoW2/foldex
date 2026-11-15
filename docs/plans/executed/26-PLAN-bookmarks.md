# Plan 26: Bookmarks, quick access among them: names, icons, keys, Regular or Root, new panes, in Home > Open

Status: executed; see Status and 6 (As built).

- 2026-11-13: draft, at the user's request.
- 2026-11-15: executed.

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
Quick access area of a tree without a parent, without it in the Bookmarks menu. Every entry stands on its own: one
location can be on both, or twice on one, each entry with its own name, icon and keys. Manage has a tab for the
bookmarks and one for quick access, each in columns: Name (the icon, then the name) and Location; its button To quick
access (or To bookmarks) moves or copies the selected entry to the other tab; Edit has the flag as a check box (no
menu item of its own: right-click menus stay short). Edit...
opens a window with all of it; Custom icons come from a Change Icon window (every icon of a dll, exe or ico file,
SHELL32.dll by default); keys are pressed into key fields as one key or a chord, starting with Ctrl+B by default: one
opens the bookmark in the active pane, the other in a new pane with a child pane. Regular goes to the folder (from a
child pane: its parent focuses the folder and the child follows); Root makes it the top of the pane, with a ".." row
to go up. An item opens its folder and is focused there (gone: the folder, at its top). A location not there or not
reachable is a message; nothing moves. In the Bookmarks menu a click opens a bookmark; a right-click offers Open, Open
in a new pane, Open in a new pane with a child pane, Edit... and Remove. F2 on a quick access
shortcut renames it. The Bookmarks button is in Home > Open.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| One list | bookmarks.json: every bookmark an entry (location, item, quick access, name, icon, keys, root); quickaccess.json and favourite-folders.json taken over | 3.0; 3.1; 6.1 |
| Word | Favourite folders called Bookmarks everywhere | 3.0; 6.1 |
| Quick access flag | the area shows the flagged entries, the menu the others; switching | 3.2; 6.2 |
| Manage | columns Name (icon, name), Location, Quick access; Edit... | 3.3; 6.2 |
| Edit | the window: name, location, quick access, open as, icon, two keys | 3.4; 6.3 |
| Change Icon | the window with a file's icons; the host reads them | 3.5; 6.3 |
| Keys | a bookmark's two keys in the key set, a clash asked; the key fields | 3.6; 6.4 |
| Menu | names, icons and keys in the Bookmarks menu | 3.7; 6.5 |
| Right-click | in the menu: Open, Open in a new pane (with or without a child pane), Edit..., Remove; on a shortcut: Edit... | 3.8; 6.5 |
| Ribbon | Bookmarks in Home > Open | 3.9; 6.5 |
| Quick access shortcuts | F2 renames a shortcut; its icon | 3.10; 6.6 |
| Regular and Root | a bookmark opened as the top of a pane, ".." to go up in trees and lists | 3.11; 6.7 |
| Items and missing places | an item as a bookmark; a location not there or not reachable: a message, nothing moves | 3.12; 6.8 |
| Tests | unit and in the app | 3.13; 6.9 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.0 What changes in what is built

Plan 23's quick access and favourite folders stay and are changed, not made again:

| Built (plan 23) | Where | Changes to |
|---|---|---|
| Two lists: quickaccess.json and favourite-folders.json, each `folders`, a list of paths | FolderLists.cs, AppHost.cs | one list, bookmarks.json, `bookmarks`, a list of entries (3.1); both old files taken over once |
| "folderLists" to every window; folderListAdd, folderListRemove, folderListSet per kind | AppHost.cs, MainForm.cs, folderlists.js | the one list of entries; a change sets an entry's flag rather than moving it between lists (3.2) |
| The word "favourite folders", "Favourites" | ribbon.json, folderlists.js, actions.js, MainForm.cs (Windows' menu items), F1 | "Bookmarks": the ribbon button, the menu, Manage's title, Windows' menu items, the actions (bookmarks.menu, bookmarks.add, bookmarks.manage; the old names still accepted, so a ribbon.json or keys.json of your own keeps working) |
| Windows' menu: Add to / Remove from quick access, Add to / Remove from favourite folders, for one folder | MainForm.cs (ShellMenu.AddOwn), app.js | for one folder or one file, per tab: Add to quick access, or Remove from quick access when it is there; the same for the bookmarks; on a shortcut also Edit... (3.2, 3.8) |
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

- bookmarks.json is one list, `bookmarks`, in your order, one entry per bookmark: { id, location, item, quickAccess,
  name, icon, key, keyNew, root }. Only id and location are always there; the rest only when set.
- Every entry stands on its own: a location can be on both tabs, or twice on one, each entry with its own name, icon,
  keys and way of opening. An entry is known by its id (short, made when it is added; an entry without one gets one,
  written once), never by its location: the keys, Edit, Remove, F2 and Del work on that one entry.
- item: true when the location is an item (a file) rather than a folder, set when it is added (Windows' menu on a
  file, or Edit finding a file there). It is the one difference between the two: after the folder opens, the item is
  focused (3.12). Kept rather than asked each time, so a file that is gone is still known to be one.
- quickAccess: true for a quick access shortcut (3.2); absent is a bookmark of the menu.
- name: empty, or the location's own name, is not kept (its own name is shown). icon: absent is Default (the
  location's own icon), "plain" is no icon, otherwise "<file>,<index>" (as Windows writes an icon place, %SystemRoot%
  kept as written). key (Open) and keyNew (Open in a new pane with a child pane): each as keys.json writes one
  ("Ctrl+B, 1"); either can be absent. root: true for Root (3.11); absent is Regular.
- Taken over once, when bookmarks.json is not there yet: quickaccess.json's folders (quickAccess set), then
  favourite-folders.json's; a folder in both is on both tabs. Neither file there either: the first list from
  Explorer's pinned folders, quickAccess set, as built.
- A location changed in Edit keeps the rest of its entry.
- The host keeps the list (FolderLists), writes it whole through a temporary file and sends it to every window after
  a change, as built.
- Added from Windows' right-click menu or the Bookmarks menu: only location, item for a file, and quickAccess when
  added to quick access.

### 3.2 The quick access flag

- With quickAccess, an entry is a shortcut in the Quick access area at the top of every tree without a parent, in
  the order of the list; without it, an entry of the Bookmarks menu, in the order of the list. One entry is never
  both; the same location in both is two entries.
- Moving an entry to the other tab is one change to its flag; it keeps its place in the list, name, icon, keys and the
  rest: Manage's Move to (3.3), or Edit's Quick access check box. Copying makes another entry: Manage's Copy to.
- No menu has a switch of its own: right-click menus stay short. Edit is one click away from both (the Bookmarks
  menu's right-click, a shortcut's right-click, Manage).
- Dragging a shortcut within the area moves that entry in the list: it lands before the shortcut it was dropped on,
  or after the last one; bookmarks of the menu in between keep their places. A folder dropped on the area from
  elsewhere is a new shortcut, also when the location is a shortcut or a bookmark already.
- Del on a shortcut takes that entry off the list; nothing on disk changes.

### 3.3 Manage

- Two tabs: Bookmarks (the entries of the menu) and Quick access (the shortcuts); each entry is on one of them. Each
  shows its entries in the order of the list, in two columns with a head: Name (the icon, then the name; the
  location's own name when it has none) and Location (the full path; a missing one struck through). The columns can
  be made wider by dragging their border in the head; no sorting (the order is yours, set with Up and Down).
- Up and Down are two small arrows in a narrow strip left of the list (greyed out at the first and last entry); the
  buttons under it: Add..., Edit..., To quick access (on the Bookmarks tab) or To bookmarks (on the Quick access
  tab), Delete, Close. Edit... (also Enter, F2 and a double click) opens Edit (3.4) for the selected row. Add... opens
  Edit empty, Quick access checked on the Quick access tab, with the location's Browse... opened at once (Windows'
  folder picker).
- To quick access / To bookmarks has a chevron and opens a menu (its hint: "Move or copy the selected entry to Quick
  access" or "... to Bookmarks"):
  - Move to: the selected entry to the other tab, its place in the list kept (also Space).
  - Copy to: a copy of it on the other tab, beside it in the list: its own id, the same location, name, icon and way of
    opening, no keys (a key opens one entry). Renaming either later leaves the other as it is.
- Up and Down move an entry past its neighbour on the same tab; the entries of the other tab keep their places.
- Each row has a handle before its icon: dragged up or down, a line shows where the entry goes, and let go it moves
  there on its tab (the list scrolls near its edges); the entries of the other tab keep their places.
- Delete, Close and their keys as built; every change goes to the host at once.
- Where Foldex differs from LexPen: LexPen's Manage has one row per file with its folder under it, and Change...
  picks another file. Foldex has columns and Edit..., as the user asked.

### 3.4 Edit

- A modal window in the page (as every Foldex dialog: Esc cancels, Enter is OK, letter shortcuts). Fields:
  - Name: a text box, its text selected. Empty: the location's own name.
  - Location: a text box with Browse... (Windows' folder picker at that folder): a folder or a file on disk, a
    network path (`\\server\share\folder`) or a shell folder; a file's path is typed or comes from Windows' menu.
    Other places (FTP and the like) are not part of this plan; the field and the stored location are plain text, so
    they can come later. A location another entry has too is fine. One that is not there: asked whether to keep it
    anyway (a share can be away).
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
  (actions bookmarks.open and bookmarks.openNew, with the entry's id as their parameter), so F1 lists them with the
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
  - Remove: off the list (no question; nothing on disk changes).
- A location that is not there or not reachable: the Open items give the message of 3.12, as a left click does.
- With the keys: the menu key or Shift+F10 on the lit bookmark opens the same small menu.
- menu.js gets this generic: an item may carry `context` (items), shown at a right-click or the menu key on that item.
  The opener rule (CLAUDE.md, Menus) is about the button that opened the menu and is not touched.
- A quick access shortcut's right-click is Windows' menu with Foldex's items at its top (as built: Remove from quick
  access), plus Edit... (3.4).
- Right-click menus are kept short on purpose: Foldex has many features, and each item added makes every menu longer.
  What is set once (the quick access flag, Regular or Root, the icon, the keys) lives in Edit and Manage only.

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
  Windows' menu; the old lists taken over (both, a folder in both); Manage's two tabs, their columns with icons, Move
  and Space (the entry moves between the tabs, the menu and the area at once, in every window), Up and Down within a
  tab; Edit from
  the menu's right-click and from a shortcut's right-click, its Quick access box moving the entry; Edit: a name, a location by
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

## 6. As built

### 6.1 One list, the word

- src/Bookmarks.cs (was FolderLists.cs): `Bookmark` (the entry, written with only what is set) and `Bookmarks` (Load,
  Start, Save, Unique, Add, ToQuickAccess, and the known folders as before). AppHost keeps one `List<Bookmark>`,
  sends "bookmarks" (the list and the known folders' paths) in hello and to every window after a change.
- The page's file is src/web/bookmarks.js (was folderlists.js). Ops to the host: bookmarkAdd, bookmarkRemove,
  bookmarksSet (the whole list: Manage, Edit, a flag switched, F2), bookmarksExist, bookmarkCheck (3.12), pickFile,
  iconFile; the event bookmarkEdit (Windows' menu's Edit...).
- The old action names (favourites.menu, .add, .manage) run as the new ones (actions.js ActionAliases); F1 lists
  only the new ones.
- Windows' menu for one folder or file, per tab: Add to quick access, or Remove from quick access when an entry of
  that location is there (every such entry of that tab goes: Bookmarks.RemoveFrom); the same for the bookmarks. On a
  quick access shortcut the page sends its entry's id: its Remove from quick access takes off only that one, and
  Edit... edits it.
- Every entry has an id (Bookmark.Id, made by Bookmark.NewId or the page's newBookmarkId); Bookmarks.Clean gives one to
  an entry without (or with one that came before), and Load writes them once. A tree's shortcut row carries its
  entry's id (`bm`) and is a place of its own per entry (TreeView.add), so one location can be two shortcuts.

### 6.2 The flag, Manage

- The area and the menu filter the one list (quickAccessList, menuBookmarks). A drop on the area goes through
  Bookmarks.ToQuickAccess: its place counted among the shortcuts, a bookmark of the menu given the flag in its place.
- Manage: two tabs over one grid with a head (manageRows: the list's entries of the tab shown); a border in the head
  dragged sizes the column before it (the widths are kept while Foldex runs, not saved). The To button's text and
  hint follow the tab, its letter marked again (buttons.js markButtons); its menu (Move to, Copy to) is a menu of the
  page, which menu.js now puts inside the open modal dialog so it is not under it. Space is Move to; Enter, F2 and a
  double click are Edit...
- A shortcut dragged within the area: the page remembers its entry's id (qaDragging) and sends it with the drop, so
  the host moves that entry (Bookmarks.ToQuickAccess moveId); a folder from elsewhere is a new shortcut.
- Tested in the test copy: the To button's text and hint on both tabs; its menu inside the dialog, on top, closed by a
  second click on the button; Move to by the menu and by Space; Copy to (the copy on the other tab, beside it, without
  the keys; renamed in Edit, the original keeps its name and Ctrl+B, 1 still opens the original); Windows' menu with
  an entry of the location on both tabs (Remove from quick access, Remove from bookmarks; on the shortcut also
  Edit...); two shortcuts of one location as two rows in the tree, Del on one taking off only that one; the ids the
  same after a restart; Ctrl+Down on the Quick access tab swapping only with its neighbour there.
- The row handle (bookmarks.js dragManageRow, moveInTab: mouse events, not the browser's drag): tested with a real
  mouse drag of the first row below the third and of the last row to the top, the line shown before the drop, the
  Quick access entries in between keeping their places.
- Manage is still a modal dialog; as a pane, docked or floating, it is in plan 14 3.7.

### 6.3 Edit, Change Icon

- Edit and Change Icon use the Find dialog's look (dialog.find). An empty location and two equal keys are refused in the status line, the dialog staying open; a location not there or not reachable is
  asked (Foldex's own question window).
- Change Icon reads every icon of the file on the host (ShellIcons.AllFromFile, ExtractIconEx, 32 px PNGs); a custom
  icon is asked once per "file,index" (ShellIcons.FromFile, kept) and drawn wherever the bookmark shows.

### 6.4 Keys

- keys.js buildKeys: keys.json's keys, then the bookmarks'; a bookmark's key removes the same key, the chords a
  single key starts, and a single key a chord starts with, so F1 shows what lost its key.
- The key field takes every key itself (buttons.js leaves its Alt+letter alone); Tab, Esc and Enter keep their
  dialog meanings, so they cannot be a bookmark's key.

### 6.5 Menu, right-click, ribbon

- menu.js: an item may have icon, key, title and context. A right-click on an item with a context opens it as a
  submenu; the menu key and Shift+F10 on the lit item do the same. Items without a context are as before.
- ribbon.json: Bookmarks under Properties and Select all in Home > Open; Go has Back, Forward, Up, Refresh.

### 6.6 Quick access shortcuts

- A shortcut row takes its entry's name and icon; an item's shortcut has no expander. F2 (item.rename) on a
  shortcut opens the rename box with an own callback (rename.js startRename `own`): the entry's name, nothing on disk.
- A click on a shortcut that is gone, an item or Root opens it as its bookmark (the message, the item focused, the
  top set); a folder's shortcut is as built.

### 6.7 Regular and Root

- A tree: the pane's `top` (kept with the layout); init describes that folder, puts the ".." row before it and opens
  it; Quick access is not shown. A click on ".." goes up (the row is not focused; the keys pass over it, as over the
  area's head); Backspace and Up on the top do the same. A drive's or a share's ".." gives the usual tops. A path
  revealed outside the top gives the usual tops first.
- A list: `top: true` on the pane; while it is on disk its items start with a ".." entry. It sorts first, passes
  every filter, is focused but never selected (so never copied, dragged, deleted or in Ctrl+A), and nothing follows
  it; Enter or a double click goes up. A Regular bookmark opened in such a list takes the flag off.
- From a child pane Root is Regular (goTo).

### 6.8 Items, places not there

- bookmarkCheck on the host: NetworkGuard for a share, then whether the folder (an item's folder) and the item are
  there, and whether the location is a file (Edit sets `item` from it). The page then says "<location> is not
  there." or "<server> is not reachable." in the status line and gives the keyboard back; nothing moves.
- An item opened: its folder as a folder bookmark; the list that lists it selects and focuses it once it is listed
  (bookmarks.js itemListed, from ListView.done); gone, the folder's first item is focused.
- Not guarded: a tree whose top is on a share that does not answer waits for Windows' answer when Foldex starts (the
  describe runs on its own thread; the window does not wait).

### 6.9 Tests

- Unit: BookmarksTests (entries kept and read back with their ids, only what is set written, a location more than once
  each with its own id, a known folder by both names, names dropped, the two plan 23 lists taken over and Explorer
  asked only without them, ToQuickAccess (a new shortcut, a dragged one moved), Add and RemoveFrom, an entry from the
  page, SHELL32's icons and a file without icons) and BookmarkKeysTests in Jint (the area and the menu in list order,
  the keys in the key set by id, every kind of clash named, another entry of the same location's key too, a
  bookmark's key over a keys.json key, the old action names, F1's variants). `dotnet test`: 217 passed, 0 failed
  (2026-11-15).
- In the test copy (CDP, real keys and mouse, UI Automation for the question window), with a data folder holding plan
  23's two lists: taken over (a folder in both one shortcut); Bookmarks in Home > Open; the menu with names, icons
  and keys; Edit from the menu with a name and keys pressed into the fields (the offered Ctrl+B, a chord with Shift, a
  third key starting again, Backspace); Ctrl+B, 1 in a tree and Ctrl+B, Shift+1 (a new pane in its own colour, the
  folder focused, a child showing it, the keyboard in the new pane); F1's rows; Ctrl+C for a bookmark asked (No kept
  Copy's key and the dialog, Yes gave it to the bookmark, Copy without a key in F1); Manage's columns with icons, the
  check box by a click and Space moving the entry between the area and the menu at once, Ctrl+Up; the menu's
  right-click and the menu key and Shift+F10; Windows' menu items for a bookmark and for a file; Change Icon
  (SHELL32's icons, a double click), Plain; Root in a tree (".." and Backspace up to the drive, then the usual
  tops), kept after a restart with the keys, names and icons; Root and Regular from a child pane (the parent focuses,
  the child shows the folder with its first item focused and keeps the keyboard); an item from Windows' menu as a
  bookmark and as a shortcut, from a tree and from a list, and renamed away; a folder not there (the message, nothing
  moved, no new pane, the keyboard back); F2 on a shortcut, emptied back, a subfolder under it not a shortcut; Root in
  a list without a parent (".." first by size too, out of Ctrl+A, Delete and Copy disabled on it, Enter up, a drive's
  ".." to This PC without one); two equal keys refused.
- Not tried in the app: a network path as a location (no share here), the Edit... of Windows' menu clicked (its
  text checked), a drop on the area (as built; ToQuickAccess unit tested), a second window getting the change.
- Seen while testing: a click on a tree's ".." while the tree is being read again does nothing.
