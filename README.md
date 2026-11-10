# Foldex

A file explorer for Windows, built the way LexPen is: a WinForms host with one WebView2 page as its UI. Panes that
connect into branches, a preview, search and scrap panes, a ribbon, actions, macros and themes are planned; see
`docs/plans`.

## Requirements

- Windows 10 or 11 (x64)
- .NET 10 Desktop Runtime (the app is framework-dependent)
- Microsoft Edge WebView2 Runtime (included with Windows 11)

To build: the .NET 10 SDK.

## Build and run

From the top folder:

```powershell
dotnet build                                  # debug build (Foldex and its tests)
dotnet run --project src -- C:\Windows        # run, optionally with a folder
dotnet test                                   # unit tests (tests\Foldex.Tests)
dotnet publish src -c Release -o C:\win32app\Foldex   # release build, where Foldex is installed
```

Close Foldex before publishing over it (the running exe is locked).

Arguments are folders to show, plus `-n` / `--new-window` for a new window (also: Shift held while starting). A
later launch hands its arguments to the running Foldex.

The version is `1.0.<commits>` (`git rev-list --count HEAD`, the `GitVersion` target in `Foldex.csproj`).

## Data folder

`%LOCALAPPDATA%\Foldex`: your `settings.json` (only what differs from `defaults\settings.json` next to the exe), and
`State\` for what Foldex keeps by itself (window position, the browser's data folder). `FOLDEX_DATA` points a test
copy elsewhere.

View > Settings (the settings window) shows every setting; a change applies at once in every window. Your
settings.json and your themes are watched: an edit by hand applies at once too.

## Themes

`themeLight` and `themeDark` pick the theme per mode (a file name in `themes\` without `.json`). The shipped themes
are in `defaults\themes\` next to the exe (LexPen's, with their app colours only); yours go in `themes\` in the data
folder, and one with the same file name replaces a shipped one. A theme:

```json
{
  "name": "My theme",
  "description": "shown with the name in the settings",
  "base": "dark-ocean",
  "colors": { "bg": "#161c27" },
  "branches": ["#6aa8ff", "#ff7b72", "#56d364", "#e3b341", "#bc8cff", "#39c5bb"]
}
```

`base` is any other theme; a theme lists only what differs from it. The colour names: `bg` (the lists), `bgSide`
(the folder tree), `bgBar` (pane heads, the ribbon), `fg` (text), `fgDim` (quieter text), `border`, `accent` (the
focus, links), `hover`, `select` (selected rows), `warning` (problems in the status line). A colour is `#rgb`,
`#rrggbb` (with alpha: `#rgba`, `#rrggbbaa`), `rgb(...)`, `rgba(...)`, `hsl(...)` or `hsla(...)`. `branches` are the six
branch colours of connected panes, in order; a theme without them takes its base's. Problems show in the status line
and the settings window.

## Testing the app

Start the debug build with `FOLDEX_DATA=<scratch folder>` and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, then drive the page through
`http://127.0.0.1:9333/json` and CDP, as in LexPen. Use a port of its own, not one your own Foldex or LexPen holds.
