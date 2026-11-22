# Foldex

A file explorer for Windows with panes that connect: a folder tree drives a list, which drives a preview, in branches
of their own colour, docked or floating. Built the way LexPen is: a WinForms host with one WebView2 page as its UI.

## Features

- **Connected panes**: trees, lists, Miller columns, any number of roots; each pane docked or floating, with its own
  back and forward; window layouts kept as projects.
- **Lists your way**: every property Windows has as a column, column sets, thumbnails (grid, mosaic, river, cards),
  filters and filter sets, folder sizes.
- **Preview**: Foldex's own viewers (text, code, markdown, images, PDF, CSV, zip, hex, a folder's summary), Windows'
  preview handlers, [LexPen](https://github.com/ArcoW2/LexPen) (a text and code editor with a viewer, by the same
  author), and Total Commander lister plugins; the viewer chosen per type. F3 opens a preview in a
  window of its own.
- **Find**: by name and any property, text in files (also as a regular expression), with Everything or the Windows
  search index; results in a scrap pane, which also collects items from many folders.
- **Files**: copy, move, delete and drag and drop as Explorer does them; multi-rename with tokens and a preview;
  symbolic links, junctions and hard links; administrator rights only for the step that needs them.
- **Bookmarks and quick access**, with keys and folders of their own.
- **Macros** with keys, and programs run with the selected items.
- **Ribbon, keys and themes, all to your liking**: rearrange the ribbon as you like (drag buttons, groups and tabs,
  add your own; Reset brings the shipped one back); put any action on any key (F1 lists them all); make your own
  light and dark themes, with a colour per branch, and choose the fonts.

## Install

Download `Foldex-<version>-win-x64.zip` from [Releases](https://github.com/ArcoW2/foldex/releases) and extract it to
any folder you can write to (for example `C:\Apps\Foldex`), then run `Foldex.exe`. Settings are kept in
`%LOCALAPPDATA%\Foldex`, not next to the exe. No installer.

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

## Right-click menus

A folder or file gets Explorer's own menu, with every installed extension, and a Foldex submenu at the top. So does
the empty space of a folder on disk, in a list or a tree: Windows' menu for the folder itself (New, Properties, and
what extensions add there, such as Git or Open with Visual Studio), with New folder, New file and Paste link in the
Foldex submenu. Shift+right-click shows the extended entries, as in Explorer. Places that are not folders on disk
(quick access, a scrap pane) get Foldex's own menu only.

Explorer's empty-space menu has entries that its folder view adds, not the folder. Foldex has no Explorer folder view,
so Windows does not give it these entries, and they are not in Foldex's menu:

| Explorer entry | In Foldex |
|---|---|
| View | Views (ribbon): details, icons or thumbnails |
| Sort by | a click on a column title, or the Sort window |
| Group by | not available |
| Refresh | Refresh (F5) |
| Paste, Paste shortcut | Paste (Ctrl+V); Paste link in the Foldex submenu for links |
| Undo | not available |
| Customize this folder... | not available; Properties > Customize does the same |

Windows 11 entries that only its new compact menu shows (such as Open in Terminal, from packaged apps) may be
missing as well, as they are from Explorer's Show more options menu.

## Testing the app

Start the debug build with `FOLDEX_DATA=<scratch folder>` and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, then drive the page through
`http://127.0.0.1:9333/json` and CDP, as in LexPen. Use a port of its own, not one your own Foldex or LexPen holds.

## Releasing

`release\notes-template.md` describes a release; `release\notes-<version>.md` are the notes of each one (tracked). The
zip and its SHA-256 go in `release\` too, but only to GitHub Releases, not into git.

## License and support

Copyright (c) 2026 Arco Witter. Released under the [MIT License](LICENSE).
Like Foldex? [Support me on Ko-fi](https://ko-fi.com/arcowitter).
