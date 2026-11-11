# Plan 17: History per pane

Status: not started; see Status.

- 2026-11-11: draft.
- 2026-11-11: revised: a parent that follows a child's Back keeps a step of its own; the histories are saved
  with the window's session in its project.
- 2026-11-11: revised: Back in a child is Back in its parent; only a pane without a parent goes back in its own
  history.

Changes plan 03 3.6 (back and forward per branch). Builds on plan 03 (following, a child that goes through its
parent) and plan 15 (the window's session in its project). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

Back and forward are per branch now (plan 03 3.6): one step back restores every pane of the active branch, from the
root down, as it was. Which pane went where is not the unit; the whole chain is. So Back in a child can move the root
tree, and Back in the tree can change a child that was pinned or that you navigated on its own. The mouse's back and
forward buttons do nothing.

## 2. The solution, in brief

Every pane has a history of its own: the folders it showed, each with its selection. Back and Forward act on the pane
with the focus, from the keys (Alt+Left, Alt+Right), the ribbon and the mouse's back and forward buttons. A pane
without a parent goes back or forward in its own history, and its children follow it, as they follow any change. In a
child that follows its parent, Back and Forward are its parent's: the parent goes back, and the child follows. A pane
keeps a history per branch it shows, as it keeps its state per branch.
The histories are saved with the window's session, so a project opens with them.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| History per pane | steps per pane (and per branch it shows): folder and selection | -- | 3.1 |
| Back and forward on the focused pane | a pane without a parent goes back; in a child, its parent does; children follow | -- | 3.2 |
| Mouse buttons | the mouse's back and forward buttons run the same actions | -- | 3.3 |
| Saved in the project | the histories in the window's session (plan 15) | -- | 3.1 |
| The per-branch history removed | `branchChain` stays for the backgrounds; `histories`, `recordStep`'s chain snapshot go | -- | 3.4 |

## 3. Details

### 3.1 The steps of a pane

- A step: the folder the pane shows (a list's location, a tree's focused folder) and its selection.
- A new step is kept when the pane's folder changes, whatever changed it: a click in it, a typed path, Up, or its
  parent (following). A selection made while the folder stays is kept with the current step, so going back brings the
  selected items back too (as plan 03 3.6 does now).
- Per pane and per branch it shows: a parent shows another state per branch (plan 03 3.1), so it keeps a history per
  branch as well; switching branches switches histories.
- At most 100 steps per history, as now.
- Saved with the window's session in its project (plan 15 3.2), with the panes: a project opens with every pane's
  history, and Back works as before it was closed. A pane that is closed takes its history with it.

### 3.2 Back and forward

- On the pane with the focus. Greyed out on the ribbon when that pane has no step to go to.
- A pane without a parent (a root, a pinned child, a list without a parent): it goes to the folder of the step in its
  own history, with that step's selection.
- A child that follows its parent: Back and Forward are its parent's. The parent goes back or forward in its own
  history and the child follows it. When the parent is itself a child, the same holds one level up, so the step is
  taken by the first pane up the chain without a parent.
- That fits plan 03 3.3: a following child changes folder only through its parent (Up, a typed path, opening a
  folder), so every folder it showed is a step in its parent's history.
- Its children follow it, as on any change of folder.
- A step going back or forward is not a new step in any history.

### 3.3 The mouse

- The mouse's back and forward buttons (`button` 3 and 4 in the page) run `history.back` and `history.forward`, on
  the pane with the focus. The browser's own back and forward on those buttons is stopped (the page has no history of
  its own to go to).
- A press over another pane does not move the focus first.

### 3.4 What changes in plan 03

- Plan 03 3.6 "Back and forward are per branch: one step back restores every pane of the active branch" goes; this
  plan replaces it. `branchChain` stays: it also decides the background of the panes in the active branch.
- `docs/xplorer2-features.md`: the row Back / forward / up says "per pane (plan 17)" once built.

### 3.5 Tests

- Unit (Jint, the history without DOM): steps added on a folder change and not on a selection change; going back and
  forward; a new folder after going back drops the steps ahead; at most 100; a history per branch; to JSON and back.
- Test copy over CDP: a tree and its list: into three folders in the list, Back twice in the list: the list and the
  tree's focus back two folders (the tree's history went back); Back in the tree: the tree goes back, the list
  follows; a child of a child: Back goes back in the root; a pinned list: Back moves only the list, in its own
  history; the mouse's back button (a synthetic `mouseup` with `button` 3) on the focused pane; a project closed and
  opened again: Back goes on where it was.

## 4. Open questions

None.
