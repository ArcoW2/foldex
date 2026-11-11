# Plan 15: Projects and window sessions

Status: partly executed; see Status and 6. As built.

- 2026-11-11: draft, taken out of plan 12 (3.4): the layout in the project.
- 2026-11-11: revised: widened to projects as LexPen's (plan 01 3.5), taking plan 01's projects and window sessions
  and plan 03's layout in the project; unnamed projects: the last closed per desktop kept; the commands in View >
  Projects and at the project in the bottom bar.
- 2026-11-11: revised: a layout saved as the default for new projects, and a window reset to it, as LexPen's.
- 2026-11-11: partly executed: everything but the checks by hand.
- 2026-11-11: revised and executed: one window per project; the Projects menu shows a project's panes as a tree, not
  a folder per window.
- 2026-11-11: revised and executed: the panes in that tree by their names, as their heads show them.
- 2026-11-11: revised and executed: a click on a pane opens (or shows) its project with the focus on that pane; the
  tree drawn with lines (plan 16).
- 2026-11-12: checked in the test copy: Delete, the name dialog, a Shift launch, the ribbon group; several virtual
  desktops left for a check by hand.

Builds on plan 12 (docking panes) and plan 03 (connected panes). As LexPen's projects
(LexPen `docs/plans/executed/PLAN-window-sessions.md` and `PLAN-manage-projects.md`), with one window per project.
The number in the file name is the priority; rename to reorder.

## 1. What this is about

Foldex keeps only the layout of the last closed window, in `State\state.json` (plan 12 3.4). Other windows are
forgotten when they close, and nothing is kept per task: a layout made for one job is gone once the window is used
for another. Plan 01 3.5 promised projects as LexPen's; there are none yet.

## 2. The solution, in brief

Work is organised in projects, as in LexPen, one window per project. A project has a number, a name you can give it,
and its window's session (its panes with their connections and state per branch, its docks, its place and its virtual
desktop), saved continuously in `State\projects.json`. At start every window that was open comes back, each on its
own desktop. The project of a window is shown at the left of the bottom bar; a click there opens the Projects menu:
every project with its panes by name as a tree, a new project, rename, Manage projects. The same commands are in the ribbon,
View > Projects. A window's layout can be saved as the default a new project starts with, and a window reset to it.
Manage projects is a window of its own with every project in one list, to open, close, rename and delete several at
once. A named project stays until deleted; of the unnamed ones only the last closed per desktop is kept.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Project store | `ProjectStore.cs`: projects, their window and session, `State\projects.json` written atomically | 3.1; 6.1 |
| Window sessions | the window's layout, place and desktop, saved a second after a change | 3.2, 3.3; 6.1 |
| Closing and start | the rules of 3.4: what is kept, what comes back | 3.4; 6.1 |
| Virtual desktops | `VirtualDesktop.cs` from LexPen; launches to the window on the current desktop | 3.5; 6.1 |
| Bottom bar and Projects menu | the project at the left of the bottom bar; the menu of 3.6 with each project's pane tree (`projectmenu.js`) | 3.6; 6.1, 6.3 |
| Ribbon and actions | View > Projects; the actions of 3.6 | 3.6 |
| Name prompt | a small dialog of the page for a project name, and for yes / no | 3.6 |
| Default layout | Save layout as default (`defaultLayout`), Reset layout | 3.2, 3.6; 6.1 |
| Manage projects | the window of 3.7 | 3.7; 6.1, 6.3 |
| Settings | `projectsSort`, `defaultLayout` | 3.6, 3.7 |
| `state.json` | keeps only places; its layout became project 1 | 3.8; 6.1 |
| Checks in the test copy | Delete with its question; the name dialog; a Shift launch; the ribbon's Projects group | 3.10; 6.4 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Checks by hand | windows on several virtual desktops (start, launch, closed last per desktop) | you: making desktops changes your own Windows session | 3.10; 6.2; 6.4 |

## 3. Details

### 3.1 Projects and their window

- A project: a number (1, 2, 3, ..., never reused), a name, the time it was created and last used, and one window.
  Unnamed, it is shown as "Project 3". A window is always a project of its own: a new window is a new project.
- The window is kept when the project closes, so it opens again as it was.
- `ProjectStore.cs`, as LexPen's: kept in `State\projects.json`, written whole to a temporary file that then replaces
  the old one, so a crash during the write never leaves a broken file. Pure apart from that file: the rules are
  tested without windows. The file keeps LexPen's shape, a list of windows per project, holding one. What LexPen has
  for several windows per project (moving a window, merging projects, a new window in a project), for documents and
  drafts and for theme sets is left out.
- The title bar shows the project: `Foldex - <name>`.

### 3.2 A window's session; a new window

- What a window keeps: what the page tells the host now (plan 12 3.4): the panes (`Layout.toJSON`: kinds, settings,
  connections, colours, the state per branch: location, focus, selection), the docks, the active pane; and its
  bounds, maximized state and virtual desktop id.
- A new window comes from a Shift launch, a launch on a desktop without a Foldex window (3.5), or New project (3.6);
  it is a new project.
- A new project opens with the default layout: `defaultLayout` in the settings when one was saved (3.6), else
  Foldex's own (plan 03 3.5).

### 3.3 Saving: continuously

- The page tells its layout 800 ms after a change, as now; the host saves the window's session with it, and on a
  move, a resize, a desktop change and a rename, a second later. A crash or a forced reboot loses at most that.
- The host is the only writer of `projects.json`.

### 3.4 Closing, and the start

- **Windows closing Foldex** (log-off, shutdown, Task Manager) or a crash: every window that was open comes back at
  the next start, in its project, on its own desktop.
- **A window closed by hand** (or from Manage projects): its project is closed and keeps the window for when it is
  opened again. Closing the last Foldex window by hand is this too.
- **An unnamed project, closed**: kept only as the last closed unnamed project of its desktop: an older unnamed closed
  project of the same desktop goes. So a launch on that desktop brings it back (3.5), and unnamed projects do not
  pile up.
- **A named project** is never dropped by closing; it stays until you delete it.
- **The start**: the windows that were open come back, each on its desktop. With none, a launch on a desktop opens
  the project closed last there (3.5).

### 3.5 Virtual desktops and launches

- `VirtualDesktop.cs` from LexPen (`IVirtualDesktopManager`): a window's desktop saved; put back at start; launches
  go to the current desktop. A desktop that no longer exists, or the interface failing: the current desktop.
- A launch (with or without a path): to the Foldex window on the current desktop, the most recently used there; with
  none on this desktop, the project closed last on this desktop is opened again, else a new project. The path goes to
  the first tree, as now. Shift: a new project.
- A closed project opened from the menu: on the current desktop, at its size and place.
- A saved place on a monitor that is no longer there: the window opens a step from the window used last, or on the
  primary monitor.

### 3.6 The bottom bar, the Projects menu, the ribbon

The bottom bar shows the window's project at its left (its name, or "Project 3"), before the status text; a click
opens the Projects menu there (the page's own menu, `menu.js`):

```
Projects
  v Foldex  (this window)          >    Folders
  v Klanten                        >      foldex
    Project 7                      >        Preview
  -----------------------------           LexPen
  New project...                        Folders
  Rename this project...                ------------------------------------
  -----------------------------         Open project / Show project
  Manage projects...                    Delete project...                  (closed projects)
```

(`v`: the menu's check mark: an open project.)

- The projects: open ones checked, this window's project first and marked, then the most recently used first.
- A project's submenu: its window's panes as a tree: each root pane, then the panes that follow it a step in, down
  to the end, each by its name as its head and tab show it (a tree "Folders", a list its folder's name, "Preview").
  The page keeps those names with its layout; the tree has lines as the trees do (plan 16). A click on a pane opens
  the project (or brings it to the front) and puts the focus on that pane. Open project opens a closed project; Show
  project brings an open one to the front. Delete project... (a closed project only; asks first).
- New project...: asks a name (empty: "Project 8"); opens a new window with the default layout in it. Rename this
  project...: the name of this window's project (empty: unnamed again).
- The name is asked in a small dialog of the page (a text box, OK and Cancel; Enter and Esc).
- **Save layout as default**: this window's panes and docks become `defaultLayout` in your settings.json, the layout
  a new project starts with (with its folders). **Reset layout**: this window back on the default layout, at the
  folder it shows; with no default saved, Foldex's own.
- Actions (F1, keys, ribbon): `projects.menu` (the menu at the bottom bar), `projects.manage`, `project.new`,
  `project.rename`, `layout.saveDefault`, `layout.resetDefault`. Ribbon, View > Projects: Projects (large; the
  menu), Manage, New, Rename, Save layout as default, Reset layout. Drop-down buttons in the ribbon are not built
  (plan 01 3.3), so the list is in the menu.

### 3.7 Manage projects

A window of its own, as LexPen's (`ProjectsForm.cs`, `web/projects.html`, `projects.js`), one for the app, its place
kept. From top to bottom: a menu bar, a search box, the list, two buttons.

- The list: a row per project with a checkbox, its name ("Project n" dimmed when unnamed), open or closed, its
  panes' folders, created, last used. A row unfolds to show its panes as the tree of 3.6. Double-click a row: open
  the project. Space checks, Enter opens the checked ones (or the row with the focus), F2 renames, Del deletes.
- Sort by name, created or last used, from the View menu or the column headers; a second click reverses. Default:
  last used, newest first; kept in the setting `projectsSort`.
- Select: Shift+click a range (from the last clicked), All (Ctrl+A), None, Invert, Not used since (a week, a month,
  three months, half a year, a year).
- Search: filters the rows on name and folders; the actions work only on the checked rows shown.
- Project menu: New project..., Open, Close, Rename (F2), Delete... (Del).
  - Close: closes their windows, as by hand. Nothing is unsaved in Foldex, so it does not ask.
  - Delete: asks first ("Delete 3 projects? An open one closes; folders and files are not touched.").
- View menu: Sort by name / created / last used, Reverse order, Unfold all / selected, Fold all / selected.
- Buttons: Open selected, Close selected.
- The list follows changes made elsewhere while it is open.

### 3.8 `state.json`

- With projects it keeps only what is not a window's: the place for a window without its own, and the Manage
  window's place.
- At the first start with projects, its layout and place become project 1 with its window, open, so nothing is lost.

### 3.9 What does not work and why

- Several windows per project (LexPen's): not used in Foldex. The code for it (moving a window, merging projects,
  a new window in a project, the setting `newWindowProject`) only made the menus longer.
- A folder per window in the Projects menu: it was the folder of the pane active when the session was saved, mostly
  the root tree's selection, which says little about the project. The pane tree shows all of it.
- A pane in that tree by its kind and folder ("Tree: D:\prive"): a tree's folder is only the item selected in it.
  A pane is an item of the window with a name of its own, as its head shows it.
- Keeping every unnamed project (LexPen's `keepUnnamedProjects`): LexPen drops one without files; Foldex windows have
  no files, so every closed window would leave a "Project n" behind.
- Dropping every unnamed project on close: closing the last window would lose its layout, which plan 12 keeps now.
- A drop-down in the ribbon for the projects: not built (plan 01 3.3); the menu at the bottom bar and the ribbon's
  Projects button give the same list.

### 3.10 Tests

- Unit, `ProjectStoreTests`: numbers never reused; save and load round trip; `state.json` becoming project 1; a
  closed project keeps its window and layout, a new one has none; the pane tree (roots, children a step in, a name and
  folder per pane, the name kept by the page or made as the page makes it); an unnamed closed project replaces the older unnamed closed one of the same desktop, not one of
  another desktop, a named one stays; delete refuses an open project; start windows; forget.
- Every settings row names a setting; every ribbon button names an action (existing tests); every page script
  parses.
- Test copy over CDP: the project at the bottom bar; the menu with the pane tree; New project opens a window; rename
  shows in the title and the bar; two projects closed by hand: the one closed last comes back at start; a crash
  (process killed) brings every window back; Manage: open, close, rename, delete.

## 4. Open questions

None.

## 6. As built

### 6.1 Built (2026-11-11, branch `plan01-foundation`)

- `ProjectStore.cs`: LexPen's, without drafts, documents and theme sets. `DropIfUnwanted`: a named project stays; an
  unnamed one without windows goes; a closed unnamed one removes the other closed unnamed ones whose window closed
  last was on the same desktop (an unknown desktop counts as one). `StartWindows`: every window still open.
- `AppHost`: `Launch` opens the windows still open first, each on its desktop, then routes the paths once they are
  settled; `Route` to the window used last on this desktop, else a new window that may become the project closed last
  there (`WindowShown`, as LexPen's: `Forget` the new entry, `Rekey` the window). `Place` (own place, else the last
  closed window's for the first, else a step from the window used last). `Closed`: by hand `CloseByHand`, Windows
  closing Foldex nothing (they come back); the place goes to `state.json`. `SaveSession` from the page's layout,
  `WindowPlaceChanged` on move, resize, activation and a 5 s desktop check; `projects.json` written a second after the
  last change. `ProjectList`, `ProjectCommand`, `CloseProjects`, `DeleteProjects` (asking with a MessageBox).
- `MainForm`: a `Key`; the page starts in `OnShown`, after `WindowShown`, so the layout it gets is its project's; the
  title `Foldex - <project>`; ops `projects`, `projectCommand`, `openProjects`, `layoutReset` (the page reloaded on the
  default layout, or on its own default with `freshLayout`).
- Page: `projectmenu.js` (the project in the bottom bar, the menu on `menu.js`, the dialog `ask`); `actions.js` group
  Projects; `app.js` `saveLayoutAsDefault` and `windowLayout`; View > Projects in `ribbon.json`.
- Manage: `ProjectsForm.cs` (as `SettingsForm`, with LexPen's request and answer), `projects.html`, `projects.css`,
  `projects.js` (LexPen's page without tabs and drafts, its menus on `menu.js`); Empty projects in the Select menu
  left out (a Foldex window always has panes).
- Not taken from LexPen: `Monitors.cs` (the screen check in `Place` does it), `keepUnnamedProjects` (3.9).
- Found on the way: two hints with an apostrophe written by a script lost their escape and broke `actions.js` and
  `app.js`; a new test parses every page script.

### 6.2 How it was tested

- `dotnet test` after 6.1: Failed 0, Passed 111; after 6.3: Failed 0, Passed 109 (`ProjectStoreTests` as in 3.10;
  `EveryPageScriptParses`).
- A test copy over CDP, one virtual desktop: the first start made project 1 from `state.json`, its three panes back,
  "Project 1" in the bottom bar and the title; the Projects menu opened upward at the bottom bar (screenshot); Rename
  to Klanten; New project Archief opened a second window; both closed by hand (`WM_SYSCOMMAND` `SC_CLOSE`: a plain
  `WM_CLOSE` from another process counts as Task Manager, and then both stayed open, as 3.4 says): both kept closed;
  the next start brought Klanten back (closed last on this desktop), Archief stayed closed; Foldex killed: Klanten
  back at the next start; Manage (screenshot): both projects, a row unfolded, This PC by its name; Open and Close from
  Manage on Archief; Save layout as default, then New project Nieuw opened with the three panes of Klanten;
  `defaultLayout` emptied and Reset layout: Klanten on Foldex's own two panes, at its folder. After 6.3: a child added
  below the tree, the menu's Klanten submenu showed the tree and both lists a step in (screenshot).
- Not tried: more than one virtual desktop, Delete (its question is a MessageBox), the name dialog by hand, a Shift
  launch, the ribbon's Projects group on screen.

### 6.3 Revised (2026-11-11): one window per project, the pane tree

- Removed: `ProjectStore.MoveWindow`, `Merge`, `CloseWithProject`, the other-window branch of `CloseByHand` and the
  sibling fallback of `LayoutOf`; `AppHost.ProjectForNewWindow` (a new window is a new project), `MergeProjects`, the
  `newWindow`, `window` and `move` commands, the reopening of a project's other closed windows in `WindowShown`;
  `MainForm.WithProject`; the setting `newWindowProject` and its row; the action `project.moveWindow` and its ribbon
  button; Merge, the Windows column and the window lines in Manage.
- Added: `ProjectStore.PaneTree` (roots in order, each followed by its followers a level deeper; a pane's folder from
  the state of the branch it showed last); `ProjectList` gives `panes` (depth, kind, folder) and, for Manage,
  `folders` (every pane's); `menu.js` items take `indent`.
- Then (the same day): the panes by name. `app.js windowLayout` adds `names` (each pane's `tabTitle`) to the layout
  the page tells; `PaneTree` gives a pane's name from it, or for a layout from before as the page makes it (Folders,
  Preview, a list's folder's last part, else Files); the menu and Manage's details show only the name. Test copy: a
  child list sent to C:\Windows was "Windows" on the page and in `projects.json`; the menu showed Folders with its
  lists a step in. `dotnet test`: Failed 0, Passed 109.
- Then: a click on a pane. `PaneTree` gives each pane's id; the menu's item sends it with `open`; the host brings
  the window to the front (opening it when closed) and tells its page `focusPane`. A name from before the page kept
  names, a shell place's path, is shown by the shell's name (This PC). Test copy: from Klanten's menu a pane of the
  closed Archief: Archief opened with the focus on that pane (`activePane` p2).

### 6.4 Checks in the test copy (2026-11-12)

- The ribbon's View tab: the Projects group (Projects, Manage, New, Rename, Save layout as default, Reset layout), next
  to Presets, Columns and Bars (screenshot).
- The name dialog: New project showed "Name of the new project" with its box, OK and Cancel (screenshot); OK with
  "Probeer": a new window, titled "Foldex 1.0.88 - Probeer".
- A Shift launch (Shift held through `keybd_event` while the exe started): a new window, a new project.
- Delete from Manage on the open project Probeer: Windows' question "Delete 'Probeer'?" came (found by its title,
  answered OK through `WM_COMMAND`); the window closed and the project left the list.
- Left: several virtual desktops (making one changes the Windows session of whoever runs the test); a check by hand.
