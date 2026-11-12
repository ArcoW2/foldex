# Plan 14: Floating panes

Status: draft 2026-11-11, revised 2026-11-12; not started; see Status.

- 2026-11-11: draft, taken out of plan 12 (its open question 1).
- 2026-11-12: revised: wanted, for any pane, a scrap included; connected and coloured as when docked.

Builds on plan 12 (docking panes) and plan 03 (connected panes). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

A Foldex pane docks in its window (plan 12) but cannot float as a window of its own, for instance on another
monitor. LexPen's panes can (LexPen `docs/plans/executed/PLAN-docking.md` 3.3, 3.5).

## 2. The solution, in brief

Any pane can float, a scrap included: it is shown in a window of its own, a form with its own WebView2, and docks back
from its menu or by dragging. It stays connected exactly as when docked: a floating child still follows its parent, a
floating parent still drives its children, and its colours (head, ring, branch marks, pane theme) are the ones it
would have docked; the messages go through the host, as LexPen's floating panes do. Moving a pane between docked and
floating hands over what it shows, so it comes back as it was.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Float and dock back | Float in the pane head's menu, for any pane (a scrap too); back by the menu or by dragging onto the window | -- | 3.1 |
| The floating window | a form with its own WebView2 showing one pane, in the window's theme | -- | 3.2 |
| Connections across windows | following, executing, back and forward through the host | -- | 3.3 |
| Colours across windows | head, ring, branch marks and pane theme as when docked, changing with the window's | Connections across windows | 3.3 |
| A floating scrap | drops, its search, its dashed ring; what a restart leaves | open question 1 | 3.3 |
| Kept | a floating pane's place and size with the window's layout | -- | 3.4 |

## 3. Details

### 3.1 Floating and docking back

- Any pane can float: a tree, a list, a preview, a scrap (docs/plans/executed/06-PLAN-search-and-scrap.md).
- The pane head's menu (plan 12 3.2) gets Float; a floating pane's menu gets Dock, back to the place it came from.
- Dragging a floating pane's head onto a dock mark of its window docks it there (plan 12 3.1).

### 3.2 The floating window

- A form of its own with its own WebView2, as LexPen's `PaneForm`; it shows one pane, drawn by the same page code.
- It belongs to the window it came from, and closes with it.

### 3.3 Connections

- Foldex's panes are drawn in one page (plan 02 option A), so a floating pane is in another page: what a docked pane
  gets from the layout in the page (its parent's focused folder, its branch, the colours) it gets by messages through
  the host.
- Whether that needs a channel of the pane's own, as LexPen's: `[not yet checked]`.
- Connected as when docked: its parent and children, its branch and pin stay; the Branch menu (detach, attach, branch
  colour) works across windows.
- Coloured as when docked: its head, its ring (a scrap's dashed), its branch marks and its pane theme are what the
  layout gives it, and change when the main window's change (another active pane, another branch, another theme).
- A floating scrap: still a drop target, its search runs and fills it as when docked.

### 3.4 Kept

- A floating pane's place and size go with the window's layout (plan 12 3.4; plan 15 once projects are built).

### 3.5 Tests

- In the test copy: a list floated, the tree's focus changed, the floating list follows; docked back, it shows the
  same folder and selection; the layout with a floating pane back after a restart.
- A floating list's head and ring in its branch colour, changing when another branch becomes active in the main
  window; a floating tree driving a docked list; a scrap floated, files dropped on it, a search into it.

## 4. Open questions

1. **A floating scrap after a restart.** A scrap in the center goes at a restart, a docked one comes back empty (plan
   06 3.2). A floating scrap: back empty in its window, as a docked one (suggestion: it is kept somewhere on purpose,
   as a mini scrap is), or gone?
