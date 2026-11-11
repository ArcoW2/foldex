# Plan 14: Floating panes

Status: not started; see Status.

- 2026-11-11: draft, taken out of plan 12 (its open question 1).

Builds on plan 12 (docking panes) and plan 03 (connected panes). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

A Foldex pane docks in its window (plan 12) but cannot float as a window of its own, for instance on another
monitor. LexPen's panes can (LexPen `docs/plans/executed/PLAN-docking.md` 3.3, 3.5).

## 2. The solution, in brief

A pane can float: it is shown in a window of its own, a form with its own WebView2, and docks back from its menu or by
dragging. It keeps its connections: a floating child still follows its parent and a floating parent still drives its
children, the messages going through the host, as LexPen's floating panes do. Moving a pane between docked and
floating hands over what it shows, so it comes back as it was.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Float and dock back | Float in the pane head's menu; back by the menu or by dragging onto the window | open question 1 | 3.1 |
| The floating window | a form with its own WebView2 showing one pane, in the window's theme | open question 1 | 3.2 |
| Connections across windows | following, executing, branch colours and back and forward through the host | open question 1 | 3.3 |
| Kept | a floating pane's place and size with the window's layout | open question 1 | 3.4 |

## 3. Details

### 3.1 Floating and docking back

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

### 3.4 Kept

- A floating pane's place and size go with the window's layout (plan 12 3.4; plan 15 once projects are built).

### 3.5 Tests

- In the test copy: a list floated, the tree's focus changed, the floating list follows; docked back, it shows the
  same folder and selection; the layout with a floating pane back after a restart.

## 4. Open questions

1. **Wanted, now or later?** LexPen's panes can float; for Foldex's panes this was left open in plan 12. Build it, keep
   it for later, or drop it?
