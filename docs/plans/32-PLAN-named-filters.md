# Plan 32: Named filters

Status: not started; see Status.

- 2026-11-17: draft, at the user's request.

Builds on plan 03 (a filter per pane: wildcards for its files, Filter... on the pane menu) and plan 19 / plan 30 (the
ribbon, its corners: the manager at the left, the list at the right, as LexPen's). It is the first step of
xplorer2's hyperfilters (`docs/xplorer2-features.md`, Lists, filtering, selection): filters kept and chosen by name.

## 1. What this is about

A pane's filter is typed each time (Filter...: `*.cs;*.md`) and forgotten when it is taken away. Filters used again
and again (the sources of a project, the pictures, everything but temporary files) cannot be kept, named, or chosen
from a list.

## 2. The solution, in brief

A filter can be kept under a name, in a file of your own (`filters.json`). Home gets a group Filter: Filter... (as
now: type one for the active pane), the list of named filters (one chosen applies it to the active pane, None takes it
away), and Manage filters (a pane that adds, renames, changes, orders and removes them). Its corners as LexPen's: Manage
filters at the left, the list at the right. A pane filtered by a named filter shows that name on its filter mark.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Kept filters | `filters.json` (name, pattern), read and written by the host, every window told | -- | 3.1 |
| The list | a drop-down of the named filters for the active pane; None | Kept filters | 3.2 |
| Save as | Filter...'s dialog: the pattern typed kept under a name too | Kept filters | 3.2 |
| Manage filters | a pane: add, rename, change, order, remove | Kept filters; open question 4 | 3.3 |
| Ribbon | Home's group Filter with its corners | The list; Manage filters | 3.4 |
| What a filter can say | beyond wildcards | open question 1 | 3.5 |
| Tests | see 3.6 | -- | 3.6 |

## 3. Details

### 3.1 Kept filters

- `filters.json` in the data folder (`%LOCALAPPDATA%\Foldex`), as `searches.json` and `renames.json` are kept: a list
  of `{ name, pattern }`, in the order Manage filters gives them. None shipped [not yet decided: a few examples, or an
  empty list].
- The host reads and writes it (a `.tmp` file, as `BarsFile.Save`) and tells every window when it changed.
- A pane keeps what it is filtered by as now (`filter`, the pattern) and, when the pattern came from a named filter,
  its name (`filterName`), so the filter mark and the list can say which. A named filter changed in Manage filters
  changes the panes filtered by it [not yet decided: or they keep the pattern they had].

### 3.2 Choosing one

- The list (an action `filters.list`, a drop-down only, as Bookmarks): None, then every named filter, the one of the
  active pane checked. A choice filters the active pane.
- Filter... asks as now; its dialog gets a field Name: filled in, the pattern is also kept under that name (an existing
  name: replaced, after a question).
- Keys: F1 lists `filters.list`; a key per named filter [not yet decided] (open question 3).

### 3.3 Manage filters

- A pane of its own, as Manage the bookmarks: docked or floating (plan 14 3.7's list gets its row), first floating.
- A line per filter: its name and pattern, editable in place; New, Remove, Up, Down; a test field that shows which
  of the active pane's files a pattern lets through [not yet decided].

### 3.4 The ribbon

Home, after Find: a group Filter.

| Button | Action |
|---|---|
| Filter... (large) | `pane.filter`, as now |
| Filters (the list) | `filters.list` |
| Manage filters | `filters.manage` |
| Left corner | `filters.manage` |
| Right corner | `filters.list` |

Icons: a funnel (Filter..., as now), a funnel with lines (the list), the framed window with a funnel (Manage filters,
a pane).

### 3.5 What a filter can say

Now: wildcards for files, `;` between them, folders always shown. Beyond that (open question 1), as xplorer2's
filters: an exclusion (`-*.tmp`), folders filtered too, size, date or attributes, a column's value.

### 3.6 Tests

- Unit: `filters.json` read, cleaned and written back; a pane's filter with its name kept with the layout.
- In the test copy: a filter saved from Filter..., chosen from the list on another pane, None; changed and renamed in
  Manage filters; the ribbon's group and its corners; the filter mark's name.

## 4. Open questions

1. **What a filter can say.** Wildcards only (as now), or also exclusions, folders, and rules on size, date,
   attributes or a column (xplorer2's hyperfilters)? The last is a plan of its own; exclusions and folders are small.
2. **A filter and the children.** Does a named filter on a pane stay on that pane only (as the filter now), or can it
   be set for a branch (the children following it)?
3. **Keys.** A key per named filter (as bookmarks have), or only the list?
4. **Manage filters: a pane or a dialog.** A pane as Manage the bookmarks (docked or floating, stays open), or a
   small modal window as Select columns?
