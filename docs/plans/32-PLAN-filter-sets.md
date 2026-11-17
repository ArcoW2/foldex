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
active pane's set, edited), the list of kept sets and Manage filters, in the corners as LexPen's.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Filter lines | the tests a line can hold, each used or not, and an item against them | -- | 3.1 |
| Combining | and / or, brackets, exceptions; the order they are worked out in | -- | 3.2 |
| The editor | the lines of a set: add (with and), change, remove, move, brackets | Filter lines; open question 1 | 3.3 |
| Kept sets | `filters.json` (name, lines), the defaults, every window told | -- | 3.4 |
| Defaults | one for a new root, one for a new child (a tab too); a child made a root keeps its own | Kept sets | 3.5 |
| In the head | the filter in italic between brackets at the head's start, a click switches it, giving way to the name | -- | 3.6 |
| Ribbon and menus | Home's group Filter, its corners; the pane menu's Filter... | The editor; Kept sets | 3.7 |
| Tests | see 3.8 | -- | 3.8 |

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
| Date modified | within a range | from and to, each a date or open; or the last n days, weeks or months |
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

### 3.3 The editor

- Opened by Filter... (the active pane's set) and from Manage filters (a kept set). Where it lives: open question 1.
- A list of the lines, each as it reads (`And Not Files, name *.tmp`); under the list, the line chosen with all it can
  be: its And / Or, Not, its brackets, and every test of 3.1 with its values.
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
- The filter mark the head has now (plan 10: filtered by the search bar) stays for the search bar.

### 3.7 Ribbon and menus

Home, after Find: the group Filter.

| Button | Action |
|---|---|
| Filter... (large) | `pane.filter`: the editor on the active pane's set |
| Filters (the list) | `filters.list`: None, then every kept set, the pane's checked; a choice applies it to the active pane |
| Manage filters | `filters.manage` |
| Left corner | `filters.manage` |
| Right corner | `filters.list` |

- The pane menu's Filter... opens the editor too; a submenu Filters with the kept sets beside it.
- Icons: a funnel (Filter..., as now), a funnel with lines (the list), the framed window with a funnel (Manage filters).

### 3.8 Tests

- Unit (Jint): each test on items (Folders and Files, names, regex, attributes, dates, open ranges, the last n days),
  several in one line; Not; And before Or; brackets, and unmatched brackets refused; an empty line and an empty set;
  the examples of 3.1. `filters.json` read, cleaned and written back.
- In the test copy: a set made in the editor and kept; chosen from the list on another pane; None; the defaults for a
  new root, a new child and a new tab; a child detached keeping its filter; the head's `[name]`, a click switching it
  off (dimmed, every item) and on; a narrow head cutting the filter first.

## 4. Open questions

1. **The editor and Manage filters: where.** One pane (docked or floating, as Manage the bookmarks) with the kept sets
   at the left and the editor of the chosen one at the right, Filter... opening it on the active pane's set; or the
   editor as a floating window of its own beside the pane, and Manage filters only the list of sets?
2. **Keys.** A key per kept set (as bookmarks have), a key for switching the active pane's filter off and on, or only
   the list?
