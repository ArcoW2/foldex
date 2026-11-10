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

## Testing the app

Start the debug build with `FOLDEX_DATA=<scratch folder>` and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, then drive the page through
`http://127.0.0.1:9333/json` and CDP, as in LexPen. Use a port of its own, not one your own Foldex or LexPen holds.
