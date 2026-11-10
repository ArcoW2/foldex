# Plan 09: The features of xplorer2 Ultimate, against Foldex

Status: draft 2026-11-10; not started. A list to choose from, not a build plan: what is chosen goes into the plan of
its area (or a new one).

## 1. What this is about

Foldex is meant to replace xplorer2 Ultimate in daily use. Nothing yet says which of xplorer2's features Foldex has,
which a plan already covers, and which are missing, so it is not clear what Foldex lacks before it can take over.

## 2. The solution, in brief

One table of xplorer2 Ultimate's features, read from zabkat.com, grouped by area, with for each the edition that has
it, where Foldex stands (built, in a plan, or not planned) and a column for you to mark what you want. The features
you mark are then added to the plans of their area, or get a plan of their own.

## 3. Details

### 3.1 Source and how to read the table

- Read from zabkat.com on 2026-11-10: the manual chapters (`x2h_*.htm`), the editions (`x2buy.htm`, `x2lite.htm`),
  the comparison `blog/ultimate-vs-professional.htm`, the release posts of v6.0, v6.3, v6.4 and the older news page.
  Not read: skins, plugins, translations, the tour pages.
- **Edition**: `U` stated as Ultimate only; `P+` Pro and Ultimate (the site gives no edition, so whether Lite has it
  is not known); `All` on the Lite feature list. The site marks editions with images that did not come through as
  text, so `P+` is partly inferred.
- **Foldex**: `built` (in the code now), `part` (some of it built), `plan NN` (in that plan, not built), `--` (in no
  plan).
- **Want**: for you to fill in: `yes`, `no`, `later`. Empty: not decided.
- Foldex's connected panes (plan 03) replace dual panes, tabs and Miller columns as a concept; those rows say so.

### 3.2 Panes, layout, navigation

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Dual pane, vertical or horizontal | All | part: connected panes side by side (plan 03); one below the other: plan 03 | |
| Folder tabs (lock, colour, rename, reopen closed) | All / P+ | -- (branches instead) | |
| Folder groups (saved sets of tabs) | P+ | -- (projects, plan 01 3.5) | |
| Detachable, floating, docked panes | P+ | plan 01 (docking), plan 03 | |
| Miller columns | P+ | plan 03 (preset "columns") | |
| Folder tree, follows active folder | P+ | built | |
| Two trees (one per pane) | P+ | built (any number of roots) | |
| Hide a folder from the tree | P+ | -- | |
| Details pane, infobar, multi-part status bar | P+ | -- | |
| Named window layouts (workspaces) | P+ | plan 01 (projects) | |
| Ribbon or menu bar, quick access toolbar | All | part: ribbon built; menus, QAT -- | |
| Full screen; clone window | P+ | part: new window (-n) built | |
| Address bar: breadcrumbs, typed path, autocomplete | P+ | part: typed path built | |
| Back / forward / up | P+ | part: up built; back/forward plan 03 3.6 | |
| Frequent folders, jump list | P+ | -- | |
| Drive bar with free space | P+ | -- | |
| Bookmarks (keys, icons, dual bookmarks) | P+ | -- | |
| Mirror browsing / scrolling | P+ | -- | |
| Spring-loaded tabs and tree during drag | P+ | -- | |

### 3.3 Lists, filtering, selection

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Views: details, list, thumbnails, Ctrl+wheel thumbnail zoom | All | part: details-like list; Ctrl+wheel font plan 08 | |
| Columns: shell properties, column sets | P+ | -- | |
| Over 1000 system properties as columns | U | -- | |
| Programmable columns (expressions) | U | -- | |
| Cloud status columns | P+ | -- | |
| Sorting: secondary, natural, folders first | P+ | part: natural sort, folders first | |
| Grouping, custom groups | P+ | -- | |
| Per-folder view settings | P+ | -- (view is per pane, plan 03) | |
| Browse flat (folder and subfolders as one list) | P+ | -- | |
| Wildcard filter | All | -- | |
| Quick filter box (live) | P+ | -- | |
| Hyperfilters (rules, saved) | P+ | -- | |
| Select by mask, invert, by content, by rule | P+ | part: select all | |
| Selection clipboard, sticky selection, checkboxes | P+ | -- | |
| Type-ahead | P+ | -- | |
| Colour coding by rule | P+ | -- | |
| Colour tags on files | All | -- | |

### 3.4 Search, scrap

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Find files on any property, results as a pane | P+ | plan 06 | |
| Text in files (IFilters, regex) | P+ | plan 06 [not yet checked how far] | |
| Indexed search (Windows search index) | U | -- | |
| MFT name search | U | -- | |
| Everything integration | U | -- | |
| Saved searches | P+ | -- | |
| Scrap containers (collect from many folders, save) | P+ | plan 06 | |
| Mini scrap (docked drop stack) | P+ | -- | |

### 3.5 File operations

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Copy, move, delete, clipboard, drag and drop | All | built (IFileOperation, Explorer's formats) | |
| Robust copy (queue, filters, overwrite rules, log) | P+ | -- | |
| Robust delete, shred | P+ | -- | |
| Mass rename (regex, tokens, preview) | P+ | plan 01 3.3 (later) | |
| Hard links, junctions, symbolic links | P+ | part: shown and followed; making them -- | |
| Attributes and timestamps (touch, shift) | P+ | -- | |
| Split and merge files | P+ | -- | |
| Comments and tags, bulk properties | P+ | -- | |
| Alternate data streams, unblock | P+ | -- | |
| New file from templates | P+ | part: new folder built | |
| Paths over 260 characters | P+ | [not yet checked] | |
| CSV export, copy path | P+ | part: copy path built | |

### 3.6 Compare, sync, disk usage

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Synchronize / compare folders, subfolders | All / P+ | plan 01 3.3 (later) | |
| Backup copy (one way) | P+ | -- | |
| Folder statistics, folder sizes | P+ | -- | |
| Find empty folders | P+ | -- | |
| Duplicate finder | P+ | -- | |
| Fast duplicate detection | U | -- | |
| Similar photos, blur detection | P+ | -- | |
| Text compare | P+ | -- | |

### 3.7 Preview, shell, archives, network

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Preview: Windows preview handlers | All | built (plan 04, part) | |
| Own viewers: text, hex, images | P+ | plan 04 | |
| Peek preview (large popup) | P+ | -- | |
| Full shell namespace (This PC, Recycle Bin, MTP, cloud) | All | built | |
| Explorer's right-click menu, extended verbs | All | built | |
| Total Commander plugins (WLX, WDX, WCX) | P+ / U | -- | |
| Enter archive (7z, RAR via plugins) | U | -- | |
| Replace Explorer (Win+E, folder opening) | P+ | -- | |
| UNC paths, map network drive | P+ | part: UNC listed; Network shows nothing here [not yet checked why] | |
| Elevated window | P+ | part: list as administrator (plan 05); no elevated window by design | |

### 3.8 Customisation and automation

| Feature | Edition | Foldex | Want |
|---|---|---|---|
| Keyboard remapping, command finder | P+ | built (keys.json, F1) | |
| Custom toolbars, skins | P+ | part: ribbon.json; icons -- | |
| Dark mode, themes | P+ | built (plan 07) | |
| Fonts | P+ | plan 08 | |
| Options window with search | P+ | built (plan 07) | |
| Settings export / import | P+ | built (settings.json is a file) | |
| Portable mode (settings in a file) | U | part: FOLDEX_DATA | |
| Command line in the address bar, $-tokens | P+ | -- | |
| Built-in console | P+ | -- | |
| User commands (tools with tokens) | P+ | -- | |
| UI macros, macro recorder | P+ | plan 01 (macros) | |

### 3.9 What follows

When the Want column is filled in, each `yes` goes to the plan of its area (03 panes, 04 preview, 06 search and
scrap, 08 fonts, plan 01 for rename, compare, macros and projects), or into a new plan per area for what has none
yet (filtering and selection, columns, robust copy, bookmarks).

## 4. Open questions

1. **The Want column.** Fill it in here (or say which areas matter most), so the plans can follow.

## 5. As built

Not built yet.
