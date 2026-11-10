# Plan 01: Foundation: solution layout and what comes from LexPen

Status: draft 2026-11-10; not started. The number in the file name is the priority; rename to reorder.

## 1. What this is about

Foldex (working name, from the folder name) is a file explorer for Windows, built the way LexPen is built: projects,
a ribbon, actions with keys, macros, themes, a preview. The repository holds no code yet: no solution, no `src`, no
tests. Before any feature, the skeleton has to exist and it has to be clear which parts come from LexPen and how.

## 2. The solution, in brief

The same layout and host shape as LexPen: `Foldex.sln` at the top, the app in `src`, its tests in `tests`, plans in
`docs/plans`. A .NET 10 WinForms exe, framework-dependent, published as one file, versioned by git commit count, with a
data folder in `%LOCALAPPDATA%\Foldex` and read-only defaults next to the exe. LexPen's generic parts (ribbon,
actions and keys, macros, themes, settings, projects, docking) start as a copy and are adapted; whether they later
move into a library shared by both apps is open question 2. How the UI is drawn follows plan 02.

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
| Themes, theme sets | `ThemeFile.cs`, `ThemeSetFile.cs`, `ThemeColoursForm.cs` | Colours for lists, branch colours (plan 03) |
| Projects, window sessions | `ProjectStore.cs`, `ProjectsForm.cs`, `VirtualDesktop.cs`, `Monitors.cs` | A project holds panes and connections (plan 03) |
| Docking | `web/docks.js`, `DockMoves.cs`, `PLAN-docking.md` | Panes of plan 03 are the dock items |
| Rename, folder compare, git status | `FileRename.cs`, `FolderCompare.cs`, folder pane | Reused as explorer features later |
| Viewers | markdown, code colouring, hex, CSV, PDF in `web/` | The preview of plan 04 |

Whether a part is copied as-is depends on plan 02: if the lists end up native, much of the page code does not carry over.

### 3.4 Actions

Everything the user can do is an action: an id, a title, an optional key, usable from the ribbon, the right-click menu,
the command palette (F1) and macros, as in LexPen. The first set, to grow per plan: open, open with, open in LexPen,
back, forward, up, refresh, new folder, new file, rename, copy, cut, paste, delete (recycle bin), delete permanently,
properties, copy path, select by pattern, filter, sort, view mode, show hidden, new connected pane, disconnect pane,
next branch, run as administrator (plan 05).

### 3.5 Projects

A project is what LexPen's is: its windows, and per window the panes, their connections and branches (plan 03), their
locations, the theme set; saved continuously, opened from the Projects menu and Manage projects.

### 3.6 Tests

- `tests/Foldex.Tests` from the first commit, as `LexPen.Tests`, with `InternalsVisibleTo`.
- The app driven through the WebView2 debugging port as in LexPen's HANDOFF section 5, if plan 02 keeps WebView2.
- First checks: the solution builds, `dotnet test` passes, the version target gives `1.0.<count>`.

## 4. Open questions

1. **The `src` project.** The request said `src` already holds a project; this repository has no `src` at all (checked
   2026-11-10, no commits either). Is it elsewhere, or not yet synced by Synology Drive, or should this plan create it?
2. **Shared code with LexPen.** Copy now and let both diverge, or a shared library from day one (a project in a third
   repository, referenced by both, or a git submodule)? Suggestion: copy now; decide on sharing once plan 02 has
   settled what Foldex's UI is made of, because that decides how much is shared at all.
3. **Name.** Foldex as the final name? LexPen had a name check (web, GitHub, winget, trademark registers) before it was
   fixed; the same for Foldex [not yet checked].
4. **GitHub.** A private repository like LexPen, with the same squash-merge habit? The commit email for this
   repository is set to the GitHub noreply address, as LexPen's HANDOFF says every personal repository needs.
