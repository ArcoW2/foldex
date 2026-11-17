# Plan 32: Filter sets

Status: not started; see Status.

- 2026-11-17: draft, at the user's request.

Builds on plan 03 (a filter per pane: wildcards for its files, Filter... on the pane menu), plan 11 (the columns: an
item's attributes and dates) and plan 19 / plan 30 (the ribbon, its corners: the manager at the left, the list at the
right, as LexPen's). It is xplorer2's hyperfilters (`docs/xplorer2-features.md`, Lists, filtering, selection): rules
on more than the name, combined, kept by name.

## 1. What this is about

A pane's filter is only wildcards for file names (`*.cs;*.md`), typed each time and forgotten when it is taken away.
What a filter can say is too little (no attributes, no dates, no exceptions, no regex, no combinations), it cannot be
kept or chosen by name, a new pane always starts unfiltered, and a filtered pane shows it only by a small mark.

## 2. The solution, in brief

A filter is a set of lines. A line can hold every test there is, each one used or not: Folders and Files (checks),
the name by wildcards or a regex, attributes, date modified and date created within a range; an item passes a line when
it passes all the tests the line uses, and a line can be an exception (not). Lines are joined by and (a new line's
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

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Filter lines | the tests a line can hold, each used or not, and an item against them | -- | 3.1 |
| Combining | and / or, brackets, exceptions; the order they are worked out in | -- | 3.2 |
| Manage filters | a pane (docked or floating): the kept sets, and the editor of the one chosen: add (with and), change, remove, move, brackets | Filter lines | 3.3 |
| Kept sets | `filters.json` (name, lines), the defaults, every window told | -- | 3.4 |
| Defaults | one for a new root, one for a new child (a tab too); a child made a root keeps its own | Kept sets | 3.5 |
| In the head | the filter in italic between brackets at the head's start, a click switches it, giving way to the name | -- | 3.6 |
| Ribbon and menus | Home's group Filter, its corners; the pane menu's Filter... | Manage filters; Kept sets | 3.7 |
| Keys | a key per kept set, as a bookmark's; a key switching the active pane's filter off and on | Kept sets | 3.8 |
| Tests | see 3.9 | -- | 3.9 |

## 3. Details

### 3.1 Filter lines

A line holds every test below, each used or not (unused: it lets everything through). An item passes the line when it
passes every test the line uses; a line using none lets every item through. Which tests to use, and how lines combine
(3.2), is the user's: any line can hold any of them.

| Test | Passes | Values |
|---|---|---|
| Folders, Files | a folder when Folders is checked, a file when Files is checked; both checked (the default): either | two checks |
| Name (wildcards) | the name against wildcards, `;` between them (`*.cs;*.md`), as the filter now | case does not matter |
| Name (regex) | the name against a regular expression | case does not matter, unless asked [not yet decided] |
| Attributes | the attributes it has and has not | hidden, system, read-only, archive, compressed, encrypted, offline, link (a junction or symbolic link); each: has / has not / either |
| Date modified | within a range | from and to, each open, an absolute date (with a time or not), or relative to now (n minutes, hours, days, weeks, months or years ago); the last n days is from n days ago to open |
| Date created | within a range | as Date modified |

- Examples: all folders, files of this week only: `Folders` Or `Files, modified the last 7 days`. Folders of this
  week and every file: `Folders, modified the last 7 days` Or `Files`. Everything but temporary files: `Not Files,
  name *.tmp;*.bak`.
- An exception is a line marked Not: an item passes when it does not pass the line.
- The values come from the listing the pane has (name, attributes, dates, as the columns show them): a filter reads
  nothing more from disk.
- A filter of now (Filter...'s wildcards) is a set of one line: Files, its wildcards; Folders checked too, since folders
  are always shown now.
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
  every test of 3.1 and its values. Narrow: the two parts on top of each other, the sets first (as Manage column sets).
- Add: a new line after the one chosen, joined with And. Remove, Up, Down.
- Applied to the pane at once as lines change (the pane shows what passes), so a set is tried while it is made; Cancel
  puts back what the pane had.
- Keep as...: the set under a name (an existing name: replaced, after a question).

### 3.4 Kept sets

- `filters.json` in the data folder (`%LOCALAPPDATA%\Foldex`), as `searches.json` and `renames.json` are kept: a list
  of `{ name, lines }` in the order Manage filters gives them, and which ones are the defaults (3.5).
- The host reads and writes it (a `.tmp` file, as `BarsFile.Save`) and tells every window when it changed.
- A pane keeps its set as it is (its lines) and, when it came from a kept one, that one's name; and whether it is
  switched off (3.6). A kept set changed in Manage filters changes the panes using it [not yet decided: or they keep
  the lines they had].

### 3.5 Defaults

- Two defaults, each a kept set or none: one for a new root pane (New pane, a preset's roots), one for a new child
  (New child pane, New tab: a tab is a child).
- Set in Manage filters (a mark per set: Default for roots, Default for children) and in the Settings window [not yet
  decided: or only one of them].
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

- Unit (Jint): each test on items (Folders and Files, names, regex, attributes, dates, open ranges, the last n days),
  several in one line; dates absolute (with and without a time) and relative to now, either end open; Not; And before Or; brackets, and unmatched brackets refused; an empty line and an empty set;
  the examples of 3.1. `filters.json` read, cleaned and written back, keys with it; a set's key that is taken refused.
- In the test copy: a set made in the editor and kept; chosen from the list on another pane; None; the defaults for a
  new root, a new child and a new tab; a child detached keeping its filter; the head's `[name]`, a click switching it
  off (dimmed, every item) and on, and Ctrl+Alt+F; a kept set's key; a narrow head cutting the filter first.

## 4. Open questions

None.
