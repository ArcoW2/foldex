# Plan 15: The layout in the project

Status: not started; see Status.

- 2026-11-11: draft, taken out of plan 12 (3.4).

Builds on plan 01's projects (3.5) and plan 12 (docking panes). The number in the file name is the priority; rename to
reorder.

## 1. What this is about

The layout of a window (docks, groups, splits, sizes, tabs) is kept only as the last closed window's, in
`State\state.json` (plan 12 3.4). Projects (plan 01 3.5) are meant to hold each window's panes and connections, but
there are no projects yet, so a layout cannot be kept per project.

## 2. The solution, in brief

Once projects exist, each window's layout is saved in the project, continuously, with the panes, their connections
and their state per branch (plan 03 3.7), and opening the project brings every window back as it was.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Saved in the project | each window's areas, groups, splits, sizes, tabs and the tab shown, with the panes | plan 01's projects | 3.1 |
| Opened from the project | every window of the project back as it was | plan 01's projects | 3.2 |
| `State\state.json` | what it keeps once projects exist | open question 1 | 3.3 |

## 3. Details

### 3.1 Saved

- Per window: the dock layout as plan 12 keeps it now (areas, groups, splits, sizes, tabs, which tab is shown), and
  the panes with their connections, colours and state per branch (plan 03 3.7).
- Saved continuously, as the rest of the project (plan 01 3.5).

### 3.2 Opened

- Opening a project makes its windows with their layouts; each pane lists what its state says.

### 3.3 `State\state.json`

- Now: the layout of the last closed window, brought back at the next start (plan 12 3.4).
- With projects: open question 1.

### 3.4 Tests

- Unit: a project's JSON with two windows' layouts read and written back unchanged.
- In the test copy: a project with a changed layout closed and opened again, the layout and folders back.

## 4. Open questions

1. **`State\state.json` once projects exist.** Keep it for a window without a project, or drop it when every window
   belongs to a project?
