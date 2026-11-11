# Plan 15: Projects and window sessions

Status: not started; see Status.

- 2026-11-11: draft, taken out of plan 12 (3.4): the layout in the project.
- 2026-11-11: revised: widened to projects as LexPen's (plan 01 3.5), taking plan 01's projects and window sessions
  and plan 03's layout in the project; unnamed projects: the last closed per desktop kept; the commands in View >
  Projects and at the project in the bottom bar.

Builds on plan 12 (docking panes) and plan 03 (connected panes). As LexPen's projects
(LexPen `docs/plans/executed/PLAN-window-sessions.md` and `PLAN-manage-projects.md`). The number in the file name is
the priority; rename to reorder.

## 1. What this is about

Foldex keeps only the layout of the last closed window, in `State\state.json` (plan 12 3.4). Other windows are
forgotten when they close, and nothing is kept per task: a layout made for one job is gone once the window is used
for another. Plan 01 3.5 promised projects as LexPen's; there are none yet.

## 2. The solution, in brief

Work is organised in projects, as in LexPen. A project has a number, a name you can give it, and windows; each window
keeps its session (its panes with their connections and state per branch, its docks, its place and its virtual
desktop), saved continuously in `State\projects.json`. At start every window that was open comes back, each on its
own desktop. The project of a window is shown at the left of the bottom bar; a click there opens the Projects menu:
every project with its windows, a new project, rename, move this window to another project, Manage projects. The same
commands are in the ribbon, View > Projects. Manage projects is a window of its own with every project in one list,
to open, close, merge, rename and delete several at once. A named project stays until deleted; of the unnamed ones
only the last closed per desktop is kept.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Project store | `ProjectStore.cs`: projects, windows, sessions, `State\projects.json` written atomically | -- | 3.1 |
| Window sessions | each window's layout, place and desktop, saved a second after a change | -- | 3.2, 3.3 |
| Closing and start | the rules of 3.4: what is kept, what comes back | -- | 3.4 |
| Virtual desktops | `VirtualDesktop.cs` from LexPen; launches to the window on the current desktop | -- | 3.5 |
| Bottom bar and Projects menu | the project at the left of the bottom bar; the menu of 3.6 | -- | 3.6 |
| Ribbon and actions | View > Projects; the actions of 3.6 | -- | 3.6 |
| Name prompt | a small in-page dialog for a project name | -- | 3.6 |
| Manage projects | the window of 3.7 | -- | 3.7 |
| Setting | `newWindowProject` | -- | 3.2 |
| `state.json` | keeps only the place for a window without its own; its layout becomes project 1 | -- | 3.8 |

## 3. Details

### 3.1 Projects and their windows

- A project: a number (1, 2, 3, ..., never reused), a name, the time it was created and last used, and its windows.
  Unnamed, it is shown as "Project 3".
- A project's windows: the open ones, and those that were open when the project was last closed, so it opens again
  as it was.
- `ProjectStore.cs`, as LexPen's: kept in `State\projects.json`, written whole to a temporary file that then replaces
  the old one, so a crash during the write never leaves a broken file. Pure apart from that file: the rules are
  tested without windows. What LexPen has for documents and drafts (`HasFiles`, `DraftsOf`) and theme sets is left
  out: Foldex has none.
- The title bar shows the project: `Foldex - <name>`.

### 3.2 A window's session; a new window

- What a window keeps: what the page tells the host now (plan 12 3.4): the panes (`Layout.toJSON`: kinds, settings,
  connections, colours, the state per branch: location, focus, selection), the docks, the active pane; and its
  bounds, maximized state and virtual desktop id.
- A new window comes from a Shift launch, or a launch on a desktop without a Foldex window (3.5), or New window in a
  project's submenu (3.6). Setting `newWindowProject` (settings window, group General): `same` (default) joins the
  project of the last window used on this desktop, a new project when there is none; `new` always a new project.
- A new window in a project opens with the layout of that project's most recently used window, else the default
  layout (plan 03 3.5).

### 3.3 Saving: continuously

- The page tells its layout 800 ms after a change, as now; the host saves the window's session with it, and on a
  move, a resize, a desktop change and a rename, a second later. A crash or a forced reboot loses at most that.
- The host is the only writer of `projects.json`.

### 3.4 Closing, and the start

- **Windows closing Foldex** (log-off, shutdown, Task Manager) or a crash: every window that was open comes back at
  the next start, in its project, on its own desktop.
- **A window closed by hand while another window of its project stays open**: it is forgotten.
- **A window closed by hand as the last open window of its project**: the project is closed and keeps this window
  for when it is opened again. Closing the last Foldex window by hand is this too.
- **An unnamed project, closed**: kept only as the last closed unnamed project of its desktop (the desktop of the
  window closed last): an older unnamed closed project of the same desktop goes. So a launch on that desktop brings
  it back (3.5), and unnamed projects do not pile up.
- **A named project** is never dropped by closing; it stays, also without windows, until you delete it.
- **The start**: the windows that were open come back, each on its desktop. With none, a launch on a desktop opens
  the project closed last there (3.5).

### 3.5 Virtual desktops and launches

- `VirtualDesktop.cs` from LexPen (`IVirtualDesktopManager`): a window's desktop saved; put back at start; launches
  go to the current desktop. A desktop that no longer exists, or the interface failing: the current desktop.
- A launch (with or without a path): to the Foldex window on the current desktop, the most recently used there; with
  none on this desktop, the project closed last on this desktop is opened again, else a new window (3.2). The path
  goes to the first tree, as now. Shift: a new window.
- A closed window or project opened from the menu: on the current desktop, at its size and place.
- A saved place on a monitor that is no longer there: the window opens on the primary monitor (`Monitors.cs` from
  LexPen).

### 3.6 The bottom bar, the Projects menu, the ribbon

The bottom bar shows the window's project at its left (its name, or "Project 3"), before the status text; a click
opens the Projects menu there (the page's own menu, `menu.js`):

```
Projects
  v Foldex  (this window)          >    v Window 1: D:\prive\foldex  (this window)
  v Klanten                        >      Window 2: C:\Users\acw\Documents
    Project 7                      >    ------------------------------------
  -----------------------------         New window in this project
  New project...                        Open project                       (all its windows)
  Rename this project...                Delete project...                  (closed projects)
  Move this window to              >    Klanten / Project 7 / ---- / New project...
  -----------------------------
  Manage projects...
```

- The projects: open ones checked, this window's project first and marked, then the most recently used first. A
  window is shown by the folder of its active pane.
- A project's submenu: an open window comes to the front; a closed one opens as it was; New window in this project;
  Open project (all its windows); Delete project... (a closed project only; asks first).
- New project...: asks a name (empty: "Project 8"); opens a new window with the default layout in it. Rename this
  project...: the name of this window's project (empty: unnamed again). Move this window to: another project or a
  new one; its old project, left without windows, by 3.4.
- The name is asked in a small dialog of the page (a text box, OK and Cancel; Enter and Esc).
- Actions (F1, keys, ribbon): `projects.menu` (the menu at the bottom bar), `projects.manage`, `project.new`,
  `project.rename`, `project.moveWindow` (the menu's Move this window to part). Ribbon, View > Projects: Projects
  (large; the menu), Manage, New, Rename, Move window. Drop-down buttons in the ribbon are not built (plan 01 3.3), so
  the lists are in the menu.

### 3.7 Manage projects

A window of its own, as LexPen's (`ProjectsForm.cs`, `web/projects.html`, `projectsview.js`), one for the app, its
place kept. From top to bottom: a menu bar, a search box, the list, two buttons.

- The list: a row per project with a checkbox, its name ("Project n" dimmed when unnamed), open or closed, its
  windows' folders, the number of windows, created, last used. A row unfolds to show its windows, each with the
  folders of its panes; a click on a window line opens that window. Double-click a row: open the project. Space
  checks, Enter opens the checked ones (or the row with the focus), F2 renames, Del deletes.
- Sort by name, created or last used, from the View menu or the column headers; a second click reverses. Default:
  last used, newest first; kept in the setting `projectsSort`.
- Select: Shift+click a range (from the last clicked), All (Ctrl+A), None, Invert, Not used since (a week, a month,
  three months, half a year, a year).
- Search: filters the rows on name and folders; the actions work only on the checked rows shown.
- Project menu: New project..., Open, Close, Merge to '<first checked>', Rename (F2), Delete... (Del).
  - Merge: the windows of the other checked projects move to the first one checked; the empty projects go. Asks
    first.
  - Close: closes their open windows; the windows stay in the project. Nothing is unsaved in Foldex, so it does not
    ask.
  - Delete: asks first ("Delete 3 projects? Their windows close; folders and files are not touched."); a project
    with open windows is closed first.
- View menu: Sort by name / created / last used, Reverse order, Unfold all / selected, Fold all / selected.
- Buttons: Open selected, Close selected.
- The list follows changes made elsewhere while it is open.

### 3.8 `state.json`

- With projects it keeps only what is not a window's: the place for a window without its own, the settings and
  Manage windows' places.
- At the first start with projects, its layout and place become project 1 with one window, open, so nothing is lost.

### 3.9 What does not work and why

- Keeping every unnamed project (LexPen's `keepUnnamedProjects`): LexPen drops one without files; Foldex windows have
  no files, so every closed window would leave a "Project n" behind.
- Dropping every unnamed project on close: closing the last window would lose its layout, which plan 12 keeps now.
- A drop-down in the ribbon for the projects: not built (plan 01 3.3); the menu at the bottom bar and the ribbon's
  Projects button give the same list.

### 3.10 Tests

- Unit, `ProjectStoreTests` (as LexPen's, without drafts): new project and window numbers never reused; save and load
  round trip; an atomic write leaves the old file on a failure; closing by hand with another window open forgets the
  window; the last window keeps the project closed with it; an unnamed closed project replaces the older unnamed
  closed one of the same desktop, not one of another desktop; a named one stays; merge; move a window (the old
  unnamed project dropped when empty); delete refuses a project with open windows; start windows; last closed on a
  desktop; the layout of a new window from the project's last used one; `state.json` becoming project 1.
- Every new settings row names a setting; every ribbon button names an action (existing tests).
- Test copy over CDP: the project at the bottom bar; the menu; New project opens a window in it; rename shows in the
  title and the bar; two windows, one closed by hand, the other closed: the project comes back with the right one at
  start; a crash (process killed) brings every window back; Manage: open, close, merge, rename, delete.

## 4. Open questions

None.
