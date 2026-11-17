# Plan 32: Filter sets

Status: executed; see Status and 6.

- 2026-11-17: draft, at the user's request.
- 2026-11-17: executed.

Builds on plan 03 (a filter per pane: wildcards for its files, Filter... on the pane menu), plan 11 (the columns: an
item's attributes and dates) and plan 19 / plan 30 (the ribbon, its corners: the manager at the left, the list at the
right, as LexPen's). It is xplorer2's hyperfilters (`docs/xplorer2-features.md`, Lists, filtering, selection): rules
on more than the name, combined, kept by name.

## 1. What this is about

A pane's filter is only wildcards for file names (`*.cs;*.md`), typed each time and forgotten when it is taken away.
What a filter can say is too little (no attributes, no dates, no exceptions, no regex, no combinations), it cannot be
kept or chosen by name, a new pane always starts unfiltered, and a filtered pane shows it only by a small mark.

## 2. The solution, in brief

A filter is a set of lines. A line tests one field of an item, for folders, files or both (two checks): any column
Foldex has or can show (Name by default, chosen from a list you can type in), with the conditions its kind allows (a
text matching wildcards or a regex, a number or date range, absolute or relative to now, true or false, attributes,
has a value); a field that does not apply to an item leaves the line out for it, and a line can be an exception (not). Lines are joined by and (a new line's
default) or or, and brackets group them: "Folders" or "Files and modified this week" shows every folder and only the
files of this week. A set can be kept under a name. Two sets can be defaults: one for a new root
pane, one for a new child (a new tab is a child); a child that becomes a root keeps the filter it has. A filtered pane
shows its filter at the start of its head, in italic between brackets; a click there switches it off and on (off:
dimmed), and when the head is too narrow the filter gives way before the name. Home's group Filter has Filter... (the
active pane's set, in Manage filters), the list of kept sets (ending with Manage filters...) and Manage filters: a pane,
docked or floating as every Manage..., the kept sets beside the editor of the one chosen; in the corners as LexPen's.
A kept set can have a key, as a bookmark has; Ctrl+Alt+F switches the active pane's filter off and on. The search
bar's filter stays as it is: a quick filter for once, apart from these sets.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Filter lines | Folders and Files, a field (any column), its conditions by kind, Not; an item against them | 3.1; 6 |
| Combining | and / or, brackets, exceptions; the order they are worked out in | 3.2; 6 |
| Manage filters | a pane (docked or floating): the kept sets, and the editor of the one chosen: add (with and), change, remove, move, brackets | 3.3; 6 |
| Kept sets | `filters.json` (name, lines), the defaults, every window told | 3.4; 6 |
| Defaults | one for a new root, one for a new child (a tab too); a child made a root keeps its own | 3.5; 6 |
| In the head | the filter in italic between brackets at the head's start, a click switches it, giving way to the name | 3.6; 6 |
| Slow fields | the tortoise in the field list and under a line using one; in Select columns' lists, the names aligned | 3.1; 6 |
| Ribbon and menus | Home's group Filter, its corners; the pane menu's Filter... | 3.7; 6 |
| Keys | a key per kept set, as a bookmark's; a key switching the active pane's filter off and on | 3.8; 6 |
| Tests | see 3.9 and 6 | 3.9; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
## 3. Details

### 3.1 Filter lines

A line tests one field of an item, for the folders, the files or both:

- **Folders, Files**: two checks; a folder passes only when Folders is checked, a file only when Files is checked;
  both checked (the default): either.
- **Field**: any column Foldex has or can show (its own columns and Windows' properties, as Select columns lists
  them), chosen from a drop-down with a search box (type to find a column); a new line's field is Name. A slow field has
  a tortoise in front of its name (below).
- **Condition**: what the field must be. Which conditions there are depends on the field's kind; the editor shows only
  those of the field chosen (nothing that does not apply is shown).
- **Not**: an exception; an item passes when it does not pass the line.

| Kind of field | Conditions |
|---|---|
| Text (Name, Type, Extension, Folder, a text property) | matches wildcards (`;` between them: `*.cs;*.md`); matches a regex; contains; is; case does not matter |
| Number (Size, Total size, Free space, a number property) | is a value; a range: from and to, each with no limit when empty; a size in bytes, KB, MB, GB |
| Date (Date modified, created, accessed, a date property) | is on a day: today, a day, or n days ago or from now (the new line's default: today); a range: from and to, each with no limit, an absolute date (with a time or not), or relative to now: n minutes, hours, days, weeks, months or years ago, or from now; the last n days is from n days ago, no limit after |
| Yes / no (a boolean property) | true, false |
| Attributes | each attribute (hidden, system, read-only, archive, compressed, encrypted, offline, link): has / has not / either |
| A list of values (Git status, a property with fixed values) | is one of the values chosen |
| Every kind | has a value; has no value; and with every other condition a check **or empty**: an item whose field has no value passes too |

- A field that does not apply to an item (a property only files have, for a folder; GPS for a folder): the line is
  left out for that item, as if it were not there (it lets the item through). A field that applies but has no value
  for the item (a .jpg without GPS): it passes "has no value", and any other condition only when that line's "or empty"
  is checked (`Files, Date taken from 2024-01-01, or empty`: the photos since 2024 and those without a date taken).
- So: all images with a GPS location: `Files, Extension matches *.jpg;*.heic` And `Files, GPS has a value`. All folders,
  files of this week only: `Folders` Or `Files, Date modified from 7 days ago`. Everything but temporary files:
  `Not Files, Name matches *.tmp;*.bak`.
- The values are those the columns show (`columns.js columnText` and its kinds): a field that is not in the listing
  (a Windows property, Git status) is read as a column's is (`askProps`, the Git status asked); an item whose value is
  not read yet is not shown until it is.
- Slow fields: those read per item after the listing (Windows' properties, Git status, Total size of a folder) can
  take a while in a large folder [not yet checked: how long]. In the field's drop-down they have a tortoise in front of
  their name (a drawing of Foldex's own, stroked in the text colour as the ribbon's icons; its tooltip: read per item,
  slow in a large folder); a line using one shows the same tortoise and a short warning under the field.
- Select columns (plan 28 3.7) marks them the same way, in both its lists. Every line there keeps the tortoise's room
  in front of its name, empty for a column that is not slow, so all names start at the same place. Its lists are
  `<select>` boxes now, which cannot hold a drawing: they become lists of Foldex's own that keep what the boxes do
  (several chosen with Ctrl and Shift, a double click moving a column, the keys, Up and Down).
- A filter of before (Filter...'s wildcards, kept by a pane in a layout) is read as a set of two lines: `Folders, Name has
  a value` Or `Files, Name matches` its wildcards, so every folder still shows.

### 3.2 Combining

- The first line stands alone; every other line starts with And or Or (a new line: And).
- Brackets: a line can open one or more brackets before it and close them after it; they must match (the editor says
  where they do not).
- Worked out as usual: Not first, then And before Or, brackets first of all. `A Or B And C` is `A Or (B And C)`.
- An empty set (no lines) lets every item through.

### 3.3 Manage filters, the editor

- The editor is Manage filters: a pane of its own, docked or floating as every Manage... (Manage the bookmarks, Manage
  column sets), first floating; plan 14 3.7's list gets its row. Filter... opens it on the active pane's set.
- It looks as Manage column sets does: at the left the kept sets (on top the active pane's set when it is not a kept
  one), each with its key and its default marks; at the right, on top, the lines of the set chosen, a row each with its
  And / Or, its opening brackets, Not, what it tests in short, its closing brackets; under them the line chosen with
  Folders and Files, its field (the drop-down to type in) and only the conditions of that field's kind (3.1). Narrow: the two
  parts on top of each other, the sets first (as Manage column sets).
- Add: a new line after the one chosen, joined with And. Remove, Up, Down.
- Applied to the pane at once as lines change (the pane shows what passes), so a set is tried while it is made; Cancel
  puts back what the pane had.
- Keep as...: the set under a name (an existing name: replaced, after a question).

### 3.4 Kept sets

- `filters.json` in the data folder (`%LOCALAPPDATA%\Foldex`), as `searches.json` and `renames.json` are kept: a list
  of `{ name, lines }` in the order Manage filters gives them, and which ones are the defaults (3.5).
- The host reads and writes it (a `.tmp` file, as `BarsFile.Save`) and tells every window when it changed.
- A pane keeps its set as it is (its lines) and, when it came from a kept one, that one's name; and whether it is
  switched off (3.6). A kept set changed in Manage filters changes the panes using it; a kept set deleted leaves them
  its lines, without its name.

### 3.5 Defaults

- Two defaults, each a kept set or none: one for a new root pane (New pane, a preset's roots), one for a new child
  (New child pane, New tab: a tab is a child).
- Set in Manage filters: a check per set, Default for a new root pane, Default for a new child pane (a tab too).
- A pane gets its default once, when it is made. A child that becomes a root (Detach from parent, its parent closed)
  keeps the filter it has: nothing is applied then. A pane's own choice afterwards (another set, None) is its own.

### 3.6 In the head

- A filtered pane's head starts with its filter: the kept set's name, or for a set not kept a short form of its lines
  (`*.cs;*.md`, else Filter), in italic between brackets: `[Sources]`.
- A click on it switches the filter off and on: off, the pane shows every item and the bracketed name is dimmed; on
  again, the same set. Kept with the pane, so it stays over a restart.
- The head too narrow: the filter is cut first (to `[...]` at the least) so the name keeps its room; its whole text
  in the tooltip.
- The search bar's filter (plan 10: typed text, the pane filtered while you type, its mark in the head) is another
  thing and stays as it is: a quick filter for once, not a set. Both can be on at once: an item shows when it passes
  both.

### 3.7 Ribbon and menus

Home, after Find: the group Filter.

| Button | Action |
|---|---|
| Filter... (large) | `pane.filter`: Manage filters on the active pane's set |
| Filters (the list) | `filters.list`: None, then every kept set, the pane's checked, and at its end Manage filters...; a set chosen applies it to the active pane |
| Manage filters | `filters.manage` |
| Left corner | `filters.manage` |
| Right corner | `filters.list` |

- The pane menu's Filter... opens Manage filters too; a submenu Filters with the kept sets (and Manage filters...) beside it.
- Icons: a funnel (Filter..., as now), a funnel with lines (the list), the framed window with a funnel (Manage filters).

### 3.8 Keys

- A kept set can have a key, as a bookmark has (`bookmarks.js bookmarkBindings`): given in Manage filters, kept in
  `filters.json` with the set; it applies the set to the active pane. A key that keys.json or a bookmark has already
  is refused there, with what has it.
- `filters.toggle`: the active pane's filter off and on, as a click on its `[name]` in the head; Ctrl+Alt+F (free in
  keys.json, checked). Also on the pane menu and in F1.

### 3.9 Tests

- Unit (Jint): each kind's conditions on items (text by wildcards, regex, contains; number and date ranges, dates
  absolute and relative to now, either end open; yes / no; attributes; a list of values; has a value), a field that does
  not apply (left out) and one without a value; Folders and Files; Not; And before Or; brackets, and unmatched brackets refused; an empty line and an empty set;
  the examples of 3.1. `filters.json` read, cleaned and written back, keys with it; a set's key that is taken refused.
- In the test copy: a set made in the editor and kept; chosen from the list on another pane; None; the defaults for a
  new root, a new child and a new tab; a child detached keeping its filter; the head's `[name]`, a click switching it
  off (dimmed, every item) and on, and Ctrl+Alt+F; a kept set's key; a narrow head cutting the filter first.

## 4. Open questions

None.

## 6. As built

- **The rules** are `src/web/filters.js`, without a page (the tests run it under Jint): a line against an item
  (`filterLine`), a set as a test (`filterTestOf`: Not on its line, And before Or, brackets; a line left out for an
  item as if it were not there), what is wrong with a set (`filterProblem`: brackets, a regex), a line in short
  (`filterLineText`), the head's text (`filterHeadText`). A set with a problem filters nothing until it is right; the
  editor says why.
- **A field's kind** comes from its column (`columns.js columnInfo`): text, size, number, date; Windows' yes / no
  properties are now `bool` (`ShellProps`: display type 2, and a raw 1 / 0 for VT_BOOL); Attributes is `attrs` (its
  letters R H S A C E L O), Git status `list`, GPS `flag` (has a value or not).
- **A field that does not apply**: one only a drive has (Total size, Free space) for anything else; a folder without a
  value for a field (Size, Extension, a Windows property: those are read for files only). **Waiting**: an item whose
  property or Git status is not read yet is not shown; the list asks for it (`ListView.askFilterValues`: the
  properties of the waiting items, the folder's Git status) and filters again when it comes. A tree reads no
  properties: there such an item shows. An item that is not on disk (no property can be read) shows.
- **A pane** keeps its set as `filterSet` ({ name of a kept one, lines, off }) with the layout; `filter` (wildcards of
  before) is read as a set (3.1). `setPaneFilter`, `togglePaneFilter`, `defaultFilterFor` (New pane, a preset's tree,
  New child pane, New tab, a list's own root tab) in `app.js`; a list filters again from what it read
  (`filterChanged`, no new listing), a tree folds again.
- **Manage filters** (`filters.html`, `filterspane.js`, `FiltersView`): the pane's row is always on top when it was
  opened for a pane, saying what the pane has ("This pane (Windows): Exes", "its own filter", "no filter"), so None,
  Cancel and Keep as... are always at hand; editing it while it uses a kept set makes it the pane's own (the name
  goes). For a kept set: Use in (the pane), Key, the two defaults; New, Rename, Duplicate, Delete, the arrows for the
  order. A line row: And / Or, the brackets opened (`(` to `(((`), Not, what it tests, the brackets closed. The field:
  a box to type in with its list under it (Up, Down, Enter, Esc). Dates: open, a day, a day and a time, or n minutes
  to years ago; sizes with a unit, kept in bytes.
- **Dates and numbers**: "open" reads "no limit" (a range without an end on that side); relative to now a date is
  some time ago or some time from now (`ahead`); a date can be on one day (`on`: today, a day, n days ago or from now:
  that day from its start to its end), a number or size can be one value (`is`). Unit tested (`DatesFromNow`,
  `ADateOnADayAndANumberThatIs`); in the test copy a date field chosen starts as "is today", a range to "7 days from
  now".
- **The line chosen**: under its field, the field's condition and its "or <field> is empty" together in one box (a line at
  its left), so the empty check reads as part of the field's value: "or Date modified is empty".
- **Brackets in the editor**: a line is indented a step per bracket open before it (the lines after an opening bracket,
  up to and with the one that closes it; nested, deeper), so taking a closing bracket away indents the lines after it,
  adding one brings them back. While they do not match, one field has an outline in the theme's warning colour: more
  closing than opening, the first opening field that can take one more; more opening than closing, the last closing
  field that can. The first line has a space as wide as And / Or, so every line's fields start at the same place.
  Tested in the test copy: `A And (B Or (C And D)) Or E` indented 0, 0, 1, 2, 0 steps; a closing bracket fewer: the
  last line indented and its closing field outlined; three closing: the first opening field outlined.
- **Keys**: a kept set's key is taken in Manage filters (keys.js `strokeOf`), refused when keys.json, a bookmark or
  another set has it (`filterKeyClash`); bound as `filters.apply` with the set's name (keys.js `buildKeys`).
  `filters.toggle` on Ctrl+Alt+F.
- **Ribbon**: Home's Filter group as the user arranged it, with Filters (the list) and On (`filters.toggle`) stacked
  beside Filter..., Hidden under them, its corners Manage filters and the list. Icons: the list (a funnel with lines),
  on or off (a funnel struck through), Manage filters (the funnel in the framed window). The pane menu: Filter...,
  Filters (None, the kept sets, Manage filters...), Filter on.
- **Select columns** (dialogpage.js): its lists are `pickList`s, as a `<select multiple>` (a click, Ctrl+click,
  Shift+click, the arrows with and without Shift, Home, End, Ctrl+A; a double click or Enter moves), each line with
  the tortoise's room in front.
- Tested: `FiltersTests` (each kind's conditions; dates absolute and relative, either end open; a field that does not
  apply, an empty one, or empty; Folders and Files; Not; And before Or; brackets; problems; an empty and an off set;
  waiting for a value; a filter of before); `dotnet test` 248 passed. In the test copy: a set on C:\Windows (Folders
  Or Files with Extension exe;dll: 101 of 118 shown, only exe and dll files), the head `[Filter]`, a click on it off
  (dimmed, 114 shown: the hidden ones stay hidden) and on, `filters.toggle`; Manage filters opened by Filter... with
  the pane's set, Keep as... "Exes" (filters.json written, the head `[Exes]`), Default for a new child pane, a new tab
  getting Exes; None; after a restart the set back on the list; a key: Ctrl+C refused ("Ctrl+C is Copy"), Ctrl+Alt+E
  taken and applying Exes; a line added (And), its field typed and chosen (Date modified, 7 days ago), the pane at
  once 41 of 118; the field list with the tortoises; Select columns with its tortoises, a click and a Ctrl+click,
  shown, a double click on Name (stays), hidden again; the ribbon's group.
- Not checked: a regex line and an attributes line through the editor (the rules are unit tested); a Windows property
  as a field on a large folder (how long it waits); Git status in a repository; the narrow layout of Manage filters;
  a filter on a scrap.
