# Plan 35: Recording macros, the mouse included

Status: not started.

- 2026-11-19: draft, at the user's request.

Builds on plan 34 (macros: the language, its steps for panes and items, the tree, Manage macros). LexPen is the
model: `..\LexPen\docs\plans\executed\PLAN-macros.md` 3.1 and `PLAN-macro-window.md` 3.1 (recordings as numbered
macros). The number in the file name is the priority; rename to reorder.

## 1. What this is about

Plan 34's macros are written by hand or with Run a program. Doing a series of steps once and having Foldex write them
down is quicker, as LexPen records its macros. In a file explorer much of the work is done with the mouse (a click on
an item, a folder opened, items selected with Ctrl+click or a drawn rectangle, a pane clicked), so a recording that
skips the mouse misses most of what was done.

## 2. The solution, in brief

Record (Ctrl+Shift+M) and Stop write what you do as a new macro, "Macro N", at the top of the macro tree. Every
action run (a key, the ribbon, a menu, F1) is a step with its parameters, as in LexPen. The mouse is not left out:
what a click or a drag changes is recorded, not where it was: the focus moved to an item, items selected, a folder
opened, another pane made active, a file operation done by dropping. While it records, a Stop recording button shows
beside the ribbon's tabs; Play (Ctrl+M) plays the macro recorded or played last.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Record and Stop | Ctrl+Shift+M; Stop saves "Macro N" at the top of the tree; the Stop recording button | plan 34 | 3.1 |
| Actions | every action run, with its parameters; a dialog's answer as its parameters | plan 34 | 3.2 |
| The mouse | what it changed: the focus, the selection, the folder, the active pane, a drop | plan 34; open question 1, 2 | 3.3 |
| Play the last | Ctrl+M: the macro recorded or played last; the Macros list says which | plan 34 | 3.4 |
| Tests | see 3.5 | -- | 3.5 |

## 3. Details

### 3.1 Record and Stop

- Record (`macro.record`, Ctrl+Shift+M, free in the shipped keys.json, as LexPen's) starts; the same key or the
  Stop recording button stops. The button (a red dot and the text, as LexPen's in its menu bar) shows beside the
  ribbon's tabs while it records, also with the ribbon only when wanted (plan 30).
- Stop saves the steps as a new macro "Macro N", N the lowest number free (LexPen's rule), at the top of the macro
  tree, and selects it in Manage macros when that is open. Nothing recorded: no macro.
- Esc does not stop a recording: it is recorded as what it does (closing a dialog, clearing a filter).
- What happens while recording happens as always: the recording only writes it down.

### 3.2 Actions

- Every action run, by any way (a key, a ribbon button, a menu item, F1), is a step: the action's name and its
  parameters, as keys.json writes them (`pane.newChild "right"`).
- An action that asks (Rename, New folder, Find): its step holds the answer, so playing it does not ask again (as
  LexPen records a find with its switches). [Per dialog, which answers are parameters: written when built.]
- Typed into the path bar or the search bar: a `go` step, or the search bar's filter as a step.
- Not recorded: what only changes the view of a moment (scrolling, a pane resized, a window moved, hovering, a menu
  opened and closed again without a choice).

### 3.3 The mouse

What a click or a drag changed is recorded, never where it was on the screen:

- **The focus**: a click on an item moves the focus there: a `focus` step with the item (open question 1: by name or
  relative).
- **The selection**: Ctrl+click, Shift+click and a drawn rectangle: a `select` step with what is selected after it
  (the names), recorded once the selection rests, not per click.
- **A folder opened**: a double click on a folder, a click in a tree, a breadcrumb of a head (plan 29), a bookmark: a
  `go` step with the folder.
- **The active pane**: a click in another pane: a `pane` step with its name (plan 25; a pane without a name: its
  place, [how: written when built]).
- **A drop**: dragging items onto a folder or a pane: the file operation it did (copy, move, link) as a step, with the
  items and the target: open question 2.
- A step the language of plan 34 does not have yet (a file operation with a target) is added to it in this plan.

### 3.4 Play the last

- Play (`macro.play`, Ctrl+M, as LexPen's) plays the macro recorded or played last; the Macros list (plan 34 3.7)
  names it at its top.

### 3.5 Tests

- Unit (Jint): a series of actions, focus changes, selections and folder changes fed to the recorder gives the macro
  text expected; selection changes close together give one `select`; a dialog's answer in its step.
- In the test copy: Record; a folder opened with a double click, a file clicked, three files selected with
  Ctrl+click, Copy, another pane clicked, Paste; Stop: "Macro 1" with those steps; played on another folder, the same
  done there (open question 1 decides on which file); Ctrl+M plays it again.

## 4. Open questions

1. **A focus or selection by mouse: by name, or relative?** By name (`focus "report.txt"`: the same file every time,
   failing where it is not) or relative to where the focus was (`focus +3`: three rows down, as a key move would be,
   so the macro works on another folder's items)? Or by name, with relative as a choice at Stop?
2. **A drop.** Recorded as the operation it did (`copy` with the items and the target folder), or left out of the
   recording (the status line saying so) until plan 34's language has file operations?
