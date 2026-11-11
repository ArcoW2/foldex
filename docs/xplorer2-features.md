# xplorer2 Ultimate's features, against Foldex

A reference list and a status, not a plan: the features of xplorer2 Ultimate, read from zabkat.com on 2026-11-10,
and for each where Foldex stands. Plans are made from it when wanted. The Foldex column is the status: it is
updated whenever a plan is written, built or closed that touches a feature here.

## Source and how to read the table

- Read from zabkat.com on 2026-11-10: the manual chapters (`x2h_*.htm`), the editions (`x2buy.htm`, `x2lite.htm`),
  the comparison `blog/ultimate-vs-professional.htm`, the release posts of v6.0, v6.3, v6.4 and the older news page.
  Not read: skins, plugins, translations, the tour pages.
- **Edition**: `U` stated as Ultimate only; `P+` Pro and Ultimate (the site gives no edition, so whether Lite has it
  is not known); `All` on the Lite feature list. The site marks editions with images that did not come through as
  text, so `P+` is partly inferred.
- **Foldex**: `built` (in the code now), `part` (some of it built), `plan NN` (in that plan, not built), `--` (in no
  plan).
- **Prio**: yours: 0 maybe someday to 5 immediately, `-` not wanted. Each group is sorted on it, highest first;
  a plan is made from a row when you ask for one.
- **Depends on**: what has to be there first: another row (by its name) or a plan. `--`: nothing.
- Foldex's connected panes (plan 03) replace dual panes, tabs and Miller columns as a concept; those rows say so.

## Panes, layout, navigation

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Folder tree, follows active folder | P+ | built | 5 | -- |
| Two trees (one per pane) | P+ | built (any number of roots) | 5 | -- |
| Ribbon or menu bar, quick access toolbar | All | part: ribbon built; menus, QAT -- | 5 | -- |
| Drive bar with free space | P+ | plan 10 (drives bar) | 5 | bars (plan 10) |
| Detachable, floating, docked panes | P+ | built (plan 12); floating: open question | 4 | -- |
| Miller columns | P+ | plan 03 (preset "columns") | 4 | presets (plan 03) |
| Named window layouts (workspaces) | P+ | plan 01 (projects) | 4 | projects (plan 01) |
| Address bar: breadcrumbs, typed path, autocomplete | P+ | part: typed path built; as a bar: plan 10 | 4 | bars (plan 10) |
| Back / forward / up | P+ | built (plan 03 3.6: per branch) | 4 | -- |
| Frequent folders, jump list | P+ | -- | 4 | Back / forward / up (the history) |
| Bookmarks (keys, icons, dual bookmarks) | P+ | -- | 4 | bars (plan 10), for a bookmark bar |
| Folder tabs (lock, colour, rename, reopen closed) | All / P+ | part: tabs built (plan 12; a tab is a branch); lock, rename, reopen -- | 3 | Detachable, floating, docked panes |
| Details pane, infobar, multi-part status bar | P+ | -- | 3 | bars (plan 10) |
| Full screen; clone window | P+ | part: new window (-n) built | 3 | -- |
| Mirror browsing / scrolling | P+ | -- | 3 | -- |
| Spring-loaded tabs and tree during drag | P+ | -- | 3 | -- |
| Dual pane, vertical or horizontal | All | part: connected panes side by side (plan 03); one below the other: built (plan 12) | 2 | Detachable, floating, docked panes (a child below) |
| Folder groups (saved sets of tabs) | P+ | -- (projects, plan 01 3.5) | 2 | Named window layouts (projects) |
| Hide a folder from the tree | P+ | -- | 2 | -- |

## Lists, filtering, selection

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Columns: shell properties, column sets | P+ | plan 11 | 4 | -- |
| Cloud status columns | P+ | -- | 4 | Columns |
| Sorting: secondary, natural, folders first | P+ | part: natural sort, folders first | 4 | Columns |
| Wildcard filter | All | -- | 4 | -- |
| Quick filter box (live) | P+ | -- | 4 | Wildcard filter; bars (plan 10), for the box |
| Hyperfilters (rules, saved) | P+ | -- | 4 | Wildcard filter; Columns (rules on properties) |
| Colour coding by rule | P+ | -- | 4 | Hyperfilters (the rules) |
| Colour tags on files | All | -- | 4 | -- |
| Views: details, list, thumbnails, Ctrl+wheel thumbnail zoom | All | part: details-like list; Ctrl+wheel font size and icons that grow built (plan 08); columns plan 11 | 3 (mostly detail now) | Columns |
| Grouping, custom groups | P+ | -- | 3 | Columns; Sorting |
| Select by mask, invert, by content, by rule | P+ | part: select all | 3 | Wildcard filter; Hyperfilters (by rule) |
| Selection clipboard, sticky selection, checkboxes | P+ | -- | 3 | -- |
| Type-ahead | P+ | -- | 3 | -- |
| Programmable columns (expressions) | U | -- | 2 | Columns |
| Per-folder view settings | P+ | plan 11 (a column set per folder) | 1 | Columns (column sets per folder, plan 11) |
| Browse flat (folder and subfolders as one list) | P+ | -- | 1 | Columns (the path column) |
| Over 1000 system properties as columns | U | -- | No idea | Columns |

## Search, scrap

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Everything integration | U | -- | 4 | Scrap containers (the results) |
| Scrap containers (collect from many folders, save) | P+ | plan 06 | 4 | -- |
| Mini scrap (docked drop stack) | P+ | -- | 4 | Scrap containers; docking (plan 01) or bars (plan 10) |
| Find files on any property, results as a pane | P+ | plan 06 | 3 | Hyperfilters (the criteria); Scrap containers (the results) |
| Text in files (IFilters, regex) | P+ | plan 06 [not yet checked how far] | 3 | Find files |
| Indexed search (Windows search index) | U | -- | 3 | Find files |
| MFT name search | U | -- | 3 | Find files; the elevated helper (plan 05) |
| Saved searches | P+ | -- | 2 | Find files |

## File operations

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Copy, move, delete, clipboard, drag and drop | All | built (IFileOperation, Explorer's formats) | 5 | -- |
| Robust copy (queue, filters, overwrite rules, log) | P+ | -- | 4 | Wildcard filter; Hyperfilters (copy filters) |
| Mass rename (regex, tokens, preview) | P+ | plan 01 3.3 (later) | 4 | -- |
| Split and merge files | P+ | -- | 4 | -- |
| Comments and descdriptions | P+ | -- | 4 | Columns (to see them) |
| Paths over 260 characters | P+ | [not yet checked] | 4 | -- |
| CSV export, copy path | P+ | part: copy path built | 4 | Columns |
| Hard links, junctions, symbolic links | P+ | part: shown and followed; making them -- | 3 | the elevated helper (plan 05), for symbolic links |
| Attributes and timestamps (touch, shift) | P+ | -- | 3 | -- |
| Ttags, bulk properties | P+ | -- | 3 | Columns (to see them) |
| Robust delete, shred | P+ | -- | 2 | Robust copy (the same engine) |
| Alternate data streams, unblock | P+ | -- | 2 | -- |
| New file from templates | P+ | part: new folder built | 2 | -- |

## Compare, sync, disk usage

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Synchronize / compare folders, subfolders | All / P+ | plan 01 3.3 (later) | 3 | Robust copy (to copy what differs) |
| Folder statistics, folder sizes | P+ | -- | 3 | Columns (a size column for folders) |
| Find empty folders | P+ | -- | 3 | Find files |
| Duplicate finder | P+ | -- | 3 | Scrap containers (the results) |
| Fast duplicate detection | U | -- | 3 | Duplicate finder |
| Similar photos, blur detection | P+ | -- | 3 | Duplicate finder |
| Backup copy (one way) | P+ | -- | 2 | Synchronize / compare; Robust copy |
| Text compare | P+ | -- | 2 (Use LexPen?) | -- |

## Preview, shell, archives, network

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Preview: Windows preview handlers | All | built (plan 04, part) | 4 | -- |
| Explorer's right-click menu, extended verbs | All | built | 4 | -- |
| Elevated window | P+ | part: list as administrator (plan 05); no elevated window by design | 4 | -- |
| Own viewers: text, hex, images | P+ | plan 04 | 3 | -- |
| Full shell namespace (This PC, Recycle Bin, MTP, cloud) | All | built | 3 | -- |
| Total Commander plugins (WLX, WDX, WCX) | P+ / U | -- | 3 | -- |
| Enter archive (7z, RAR via plugins) | U | -- | 3 | Total Commander plugins (WCX) |
| Replace Explorer (Win+E, folder opening) | P+ | -- | 3 | -- |
| UNC paths, map network drive | P+ | part: UNC listed; Network shows nothing here [not yet checked why] | 3 | -- |
| Peek preview (large popup) | P+ | -- | 2 | Own viewers |

## Customisation and automation

| Feature | Edition | Foldex | Prio | Depends on |
|---|---|---|---|---|
| Keyboard remapping, command finder | P+ | built (keys.json, F1) | 5 | -- |
| Custom toolbars, skins | P+ | part: ribbon.json; bars plan 10; icons -- | 5 | bars (plan 10); ribbon icons (plan 01) |
| Dark mode, themes | P+ | built (plan 07); a pane theme per branch: plan 13 | 5 | -- |
| Fonts | P+ | built (plan 08) | 5 | -- |
| Options window with search | P+ | built (plan 07) | 5 | -- |
| Settings export / import | P+ | built (settings.json is a file) | 3 | -- |
| Portable mode (settings in a file) | U | part: FOLDEX_DATA | 3 | -- |
| UI macros, macro recorder | P+ | plan 01 (macros) | 3 | -- |
| Command line in the address bar, $-tokens | P+ | -- | 2 | Address bar; User commands (the tokens) |
| User commands (tools with tokens) | P+ | -- | 2 | -- |
| Built-in console | P+ | -- | 1 | -- |
