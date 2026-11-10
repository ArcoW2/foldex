# Plan 01: Foundation: solution layout and what comes from LexPen

Status: draft 2026-11-10, revised 2026-11-10; partly executed 2026-11-10 (the host: 3.1, 3.2, 3.6; actions, keys, F1
and the ribbon: 3.3, 3.4), the rest of 3.3 to 3.5 not started; see 5. As built. The number in the file name is the
priority; rename to reorder.

## 1. What this is about

Foldex is a file explorer for Windows, built the way LexPen is built: projects, a ribbon, actions with keys, macros,
themes, a preview. The repository (`https://github.com/ArcoW2/foldex`) holds no code yet: no solution, no `src`, no
tests. Before any feature, the skeleton has to exist and it has to be clear which parts come from LexPen and how.

## 2. The solution, in brief

The same layout and host shape as LexPen: `Foldex.sln` at the top, the app in `src`, its tests in `tests`, plans in
`docs/plans`. A .NET 10 WinForms exe, framework-dependent, published as one file, versioned by git commit count, with a
data folder in `%LOCALAPPDATA%\Foldex` and read-only defaults next to the exe. This plan creates `src` and `tests`.
LexPen's generic parts (ribbon, actions and keys, macros, themes, settings, projects, docking) are copied and adapted:
Foldex and LexPen are separate projects and share no code. How the UI is drawn follows plan 02.

## 3. Details

### 3.1 Folder layout

```
Foldex.sln
README.md
.gitattributes          LF everywhere, as LexPen
.gitignore              Visual Studio, as LexPen
.claude/skills/plans/   the plans skill (copied from LexPen)
docs/
  plans/                NN-PLAN-name.md, the number is the priority
  plans/executed/       executed plans
src/
  Foldex.csproj
  defaults/             keys.json, ribbon.json, settings.json, themes/, macros/
  web/                  the page, if plan 02 keeps WebView2 for the UI
  img/icon/
tests/
  Foldex.Tests/
```

### 3.2 Host shape (as LexPen)

- `net10.0-windows`, WinForms, `PerMonitorV2`, `win-x64`, framework-dependent, `PublishSingleFile`, ReadyToRun.
- Version `1.0.<git rev-list --count HEAD>`, the `GitVersion` target copied from `LexPen.csproj`.
- One instance, more windows: later launches hand their arguments over a named pipe (LexPen `Program.cs`, `AppHost.cs`).
- Data folder `%LOCALAPPDATA%\Foldex` with `State\`; `FOLDEX_DATA` overrides it for test copies (as `LEXPEN_DATA`).
- Defaults next to the exe, user copies in the data folder replace them whole (as `RibbonFile`, `KeysFile`).

### 3.3 What comes from LexPen

| Part | LexPen source | What changes for Foldex |
|---|---|---|
| Single instance, windows, pipe | `Program.cs`, `AppHost.cs`, `Router.cs` | Pipe name, arguments (folders instead of files) |
| Data folder, settings, settings window | `DataFolder.cs`, `SettingsFile.cs`, `SettingsForm.cs` | Other settings |
| Keys and actions | `KeysFile.cs`, `web/actions.js` | Explorer actions (3.4) |
| Ribbon | `RibbonFile.cs`, the ribbon page code, `PLAN-ribbon*` | Other tabs and groups |
| Macros | `MacroStore.cs`, macro recording, `PLAN-macros.md` | Own file extension; steps act on panes and selections |
| Themes, theme sets | `ThemeFile.cs`, `ThemeSetFile.cs`, `ThemeColoursForm.cs` | Plan 07: no editor colours, a list of branch colours |
| Projects, window sessions | `ProjectStore.cs`, `ProjectsForm.cs`, `VirtualDesktop.cs`, `Monitors.cs` | A project holds panes and connections (plan 03) |
| Docking | `web/docks.js`, `DockMoves.cs`, `PLAN-docking.md` | Plan 12: panes of plan 03 as dock items, tabs |
| Rename, folder compare, git status | `FileRename.cs`, `FolderCompare.cs`, folder pane | Reused as explorer features later |
| Viewers | markdown, code colouring, hex, CSV, PDF in `web/` | The preview of plan 04 |

Each part is a copy that Foldex owns from then on; a later fix in LexPen is carried over by hand when wanted. How much
of the page code is copied depends on plan 02: if the lists end up native, much of it does not carry over.

### 3.4 Actions

Everything the user can do is an action: an id, a title, an optional key, usable from the ribbon, the right-click menu,
the command palette (F1) and macros, as in LexPen. The first set, to grow per plan: open, open with, open in LexPen,
back, forward, up, refresh, new folder, new file, rename, copy, cut, paste, delete (recycle bin), delete permanently,
properties, copy path, select by pattern, filter, sort, view mode, show hidden, new connected pane, disconnect pane,
next branch, take ownership (plan 05).

### 3.5 Projects

A project is what LexPen's is: its windows, and per window the panes, their connections and branches (plan 03), their
locations, the theme set; saved continuously, opened from the Projects menu and Manage projects.

### 3.6 Tests

- `tests/Foldex.Tests` from the first commit, as `LexPen.Tests`, with `InternalsVisibleTo`.
- The app driven through the WebView2 debugging port as in LexPen's HANDOFF section 5, if plan 02 keeps WebView2.
- First checks: the solution builds, `dotnet test` passes, the version target gives `1.0.<count>`.

## 4. Open questions

1. **The order of the rest (5.2).** Each part taken out of LexPen's editor page on its own, on top of the host.
   Suggestion: first the plan 02 spike (it needs only this host); then actions and keys (F1), the ribbon, themes, the
   settings window, projects, macros, docking; the viewers with plan 04.

## 5. As built

### 5.1 Built (branch `plan01-foundation`)

- `Foldex.sln` with `src/Foldex.csproj` and `tests/Foldex.Tests` in solution folders `src` and `tests`, as LexPen.
- `Foldex.csproj`: the LexPen settings (net10.0-windows, WinForms, PerMonitorV2, win-x64, framework-dependent, single
  file, ReadyToRun), the `GitVersion` target, `defaults\` next to the exe, `web\` inside it. No icon yet; the window uses
  the exe's.
- `Program.cs`: one instance per user and exe (mutex and pipe, as LexPen); `-n` / `--new-window` or Shift for a new
  window; the rest are paths, handed to the running instance.
- `AppHost.cs`: the windows, the pipe listener, the shared browser environment (its data folder in `State\`,
  `ExclusiveUserDataFolderAccess` on, plan 02 3.5), `State\state.json` with the last window's position and size, the
  version.
- `MainForm.cs`: one WebView2 with the page; the JSON messages (`ready` / `hello`, `open`); `ProcessFailed` handled from
  the start (plan 02 3.5): a failed or hung renderer reloads the page, an exited browser process gets a new environment
  and a new browser; the last paths given come back on the new page.
- `DataFolder.cs`, `SettingsFile.cs` (LexPen's merge of defaults and yours, without LexPen's renamed, retired and layout
  settings), `WebFiles.cs` (LexPen's, without the panes' second site), `defaults/settings.json` (`followWindows`,
  `theme`).
- The page (`web/index.html`, `app.js`, `app.css`): name, version and commit, the paths given, settings problems;
  light or dark by Windows or the `theme` setting.
- `README.md`.

### 5.2 Built since (2026-11-10): actions, keys, F1, the ribbon

- From LexPen as they were: `KeysFile.cs` (without LexPen's renamed actions and macro keys), `RibbonFile.cs` (without
  saving: no change mode yet), `web/keys.js` (in a text box the keys that edit text stay the box's), `web/ribbonmodel.js`
  (unchanged).
- On LexPen's pattern, for Foldex: `web/actions.js` (name, title, group, run, enabled, checked, variants; items,
  folders, panes, view; Open is a switch for a folder, Execute is Enter), `web/palette.js` (F1: every action with its keys, searchable), `web/ribbon.js` (tabs, groups,
  large and small buttons stacked by `ribbonColumns`, greyed out and lit as the actions say).
- `defaults/keys.json` and `defaults/ribbon.json` with Foldex's actions: open, properties, delete, copy, cut, paste
  (Explorer's clipboard formats, `Shell/ShellClipboard.cs`), copy path, select all, new folder (IFileOperation), up,
  refresh, hidden items (setting `showHidden`, written to your settings.json), preview, new pane, new child pane, close
  pane, next and previous pane.
- The keys a pane handled itself before (Enter, Backspace, Delete, F5) are actions in `keys.json` now; moving the cursor
  stays the pane's own.

### 5.3 Not built yet

From LexPen: the ribbon's icons, split buttons and drop-down lists, key tips, change mode and collapsing; the menus;
macros; projects; docking; the viewers (plan 04). Themes and the settings window: plan 07, built. The order is open
question 1.

### 5.4 How it was tested

- `dotnet build`: no warnings, no errors; version `1.0.8 4bf9c0d` at the time.
- `dotnet test`: Failed 0, Passed 21 (ProgramTests, DataFolderTests, SettingsFileTests, WebFilesTests).
- A test copy (`FOLDEX_DATA` in the session scratchpad, debugging port 9333) driven over CDP:
  - the page showed `Version 1.0.8 (4bf9c0d)`, the path given (`C:\Windows`), no settings problems, the theme as
    Windows (dark);
  - a second launch with `D:\prive` exited and the first window showed `D:\prive`; one Foldex process stayed;
  - the renderer process killed: the page came back (a marker set before was gone, so it was a new page);
  - the browser process killed: a new browser process under Foldex, the page back, Foldex still running;
  - after the fix of 5.4 (rebuilt): a second launch with `D:\prive`, then the renderer killed: the new page showed
    `D:\prive`, not the start's `C:\Windows`;
  - closing the window wrote `State\state.json` with its position and size.
- Actions, keys and the ribbon (5.2): `dotnet test` Failed 0, Passed 66 (`KeysAndRibbonTests`: key spelling, user keys,
  ribbon items, every shipped key and ribbon button naming an action of `actions.js`). In the test copy: the ribbon
  showed Home and View; New folder made `New folder` on disk; New child pane added a pane following the list; Close pane
  and Preview worked; Hidden items wrote `"showHidden": true` to the test copy's settings.json; F1 listed 19 actions;
  Alt+P toggled the preview; Backspace in the location box stayed in the box. Copy, cut and paste were not tried (they
  use your real clipboard): by hand.

### 5.5 Resolved during execution

| Item | Decision |
|---|---|
| A new page after a failure showed the start's paths | The window keeps the last paths given and sends those |
| Second window placement | 32 px right and down of the saved place, so it is not exactly over the first |
| A saved place on a screen that is gone | The default place on the main screen (three quarters of its working area) |
