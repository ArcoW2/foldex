First public release of **Foldex**: a file explorer for Windows 10/11 (x64) with panes that connect: a folder tree drives a list, which drives a preview, in branches of their own colour, docked or floating.

For the full feature overview, see the [README](https://github.com/ArcoW2/foldex#readme).

## Highlights

- **Connected panes**: trees, lists, Miller columns, any number of roots; each pane docked or floating, with its own back and forward; window layouts kept as projects.
- **Lists your way**: every property Windows has as a column, column sets, thumbnails (grid, mosaic, river, cards), filters and filter sets, folder sizes.
- **Preview**: Foldex's own viewers (text, code, markdown, images, PDF, CSV, zip, hex, a folder's summary), Windows' preview handlers, [LexPen](https://github.com/ArcoW2/LexPen) (a text and code editor with a viewer, by the same author), and Total Commander lister plugins; the viewer chosen per type. F3 opens a preview in a window of its own.
- **Find**: by name and any property, text in files (also as a regular expression), with Everything or the Windows search index; results in a scrap pane, which also collects items from many folders.
- **Files**: copy, move, delete and drag and drop as Explorer does them; multi-rename with tokens and a preview; symbolic links, junctions and hard links; administrator rights only for the step that needs them.
- **Bookmarks and quick access**, with keys and folders of their own.
- **Macros** with keys, and programs run with the selected items.
- **Ribbon, keys and themes, all to your liking**: rearrange the ribbon as you like (drag buttons, groups and tabs, add your own; Reset brings the shipped one back); put any action on any key (F1 lists them all); make your own light and dark themes, with a colour per branch, and choose the fonts.

## Install

1. Download `Foldex-1.0.438-win-x64.zip` and extract it to any folder you can write to (for example `C:\Apps\Foldex`).
2. Run `Foldex.exe`. Settings are kept in `%LOCALAPPDATA%\Foldex`, not next to the exe.

Needs the [.NET 10 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/10.0) (x64) and the Microsoft Edge WebView2 Runtime (included with Windows 11). No installer.

**Unsigned:** Windows SmartScreen may show "Windows protected your PC" on first start. Click *More info* > *Run anyway*, or tick *Unblock* in the zip's Properties before extracting.

## Verify the download

SHA-256 of `Foldex-1.0.438-win-x64.zip`:

```
F34D1329D582A85EF57E9C6B72EA053D0D19B360DD8CE6EBC4D7894D72318607
```

PowerShell: `Get-FileHash .\Foldex-1.0.438-win-x64.zip -Algorithm SHA256`

---

Copyright (c) 2026 Arco Witter. Released under the [MIT License](https://github.com/ArcoW2/foldex/blob/main/LICENSE).
Like Foldex? [Support me on Ko-fi](https://ko-fi.com/arcowitter).
