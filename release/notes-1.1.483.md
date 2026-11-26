Foldex 1.1 brings **profiles**: separate Foldex worlds side by side. Also a light / dark switch, and many fixes since 1.0.438.

For the full feature overview, see the [README](https://github.com/ArcoW2/foldex#readme).

## New: profiles

A profile is a complete Foldex of its own: its own projects and window layouts, bookmarks and quick access, ribbon, keys, themes, settings, column sets, filters and macros. Each runs in its own Foldex process, so nothing of one shows up in another. What you had so far is the profile **Default**.

What you can do with them:

- **Keep worlds apart**: work and private, one customer and another, or a profile to try things out without touching your own setup.
- **Open several at once**: each profile has its own windows; the title shows which one ("Work/Project 1 - Foldex"; Default shows only the project).
- **Make a new one** by copying an existing profile (Default or another): it starts with everything the original has, then goes its own way.
- **Rename, close and delete** profiles.
- **Lock one with a password** (any profile but Default). Foldex asks it when the profile opens and before any change to it while it is closed. It locks the profile in Foldex; it does not encrypt its files.
- **Never open by itself**: a profile switched so does not come back at start; it opens only when you choose it.
- **Start one directly**: `Foldex.exe --profile <name or number>`, for example from a shortcut. A launch without it (a folder from Explorer, Win+E) goes to Default.

Where to find it: the profile's name at the left of the bottom bar opens the **Profiles** menu (open, close, copy, rename, password, delete). **Manage profiles...** at the top of that menu shows every profile in a list, with whether it is open, its never-open checkbox, when it was created and last opened. Also on the ribbon: View > Profiles, and Tools > Manage > Profiles.

## Other changes

- **Light / dark switch**: a moon (light mode) or sun (dark mode) at the right of the ribbon's tabs. When the choice matches Windows, Foldex follows Windows again when it changes.
- **Window title**: now "<project> - Foldex" (with the profile in front when it is not Default), no longer starting with "Foldex".
- **Menus of a small pane**: a column header's or a row's menu is no longer held inside its pane; it can use the whole window.
- **Column sets**:
  - Give way is a weight: when the columns do not fit, those with a higher weight shrink less, each down to its minimum, every time the pane is resized.
  - A column's first sort direction can be set (a first click sorts it descending).
  - Minimum and maximum bind fitting only; a drag goes past them.
  - Add a column adds every column chosen.
- **Column sets on the Customize tab** (a Columns group), no longer under Tools > Manage.
- **Trees select several items**, as lists do: Ctrl+click, Shift+click, Ctrl+A.
- **Tabs**: drag a tab to another place in its strip; drop a pane between two tabs.
- **Dragging a pane with Shift held** docks it nowhere.
- **Drag and drop from Explorer and Outlook** works while Foldex is not the window in front: files and Outlook attachments land in the pane. Before, some were opened in a window of their own instead.
- **Rename**: F2 in the box turns round, for this rename, whether files beside it with the same name and another extension go along.
- **Copy and paste into the same folder** makes "a - Copy.txt", as Explorer does.
- **A search's scrap** is named after what was searched (Find "text" in "*.pas").
- **A floating preview** shows its file's name in its title bar.
- **Empty space of a folder** gets Windows' menu of the folder (New, Properties, extensions), with New folder, New file and Paste link.
- **Fixes**:
  - Esc in a text box stays the box's own.
  - Back focuses the item you had.
  - A tree keeps a sensible focus when its focused item is deleted or moved.
  - Auto columns are fitted again when the filter changes.
  - Give way is kept when column sets are saved.
  - A pane drag no longer sticks over a preview or Manage pane.

Your settings, projects, bookmarks and everything else from 1.0.438 carry over as the profile Default; nothing to do.

**The ribbon:** new buttons were added and moved:
- the Profiles group on the View tab;
- Profiles in Tools > Manage;
- Column sets in a Columns group on the Customize tab.

If you never changed the ribbon, you get them by themselves. If you did change it (your own ribbon is kept as it is), they do not appear. Either reset it with Customize > Ribbon > **Reset the ribbon** (this drops your own changes to it), or add them yourself: Customize > Ribbon > **Change the ribbon**, then drag the actions from F1's list (All actions) onto it.

## Install / update

Download `Foldex-1.1.483-win-x64.zip`. Close Foldex, delete the old files in its folder (not `%LOCALAPPDATA%\Foldex`: your settings stay there), and extract the zip into it, or into any folder you can write to.

Needs the [.NET 10 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/10.0) (x64) and the Microsoft Edge WebView2 Runtime (included with Windows 11).

**Unsigned:** Windows SmartScreen may show "Windows protected your PC" on first start. Click *More info* > *Run anyway*, or tick *Unblock* in the zip's Properties before extracting.

## Verify the download

SHA-256 of `Foldex-1.1.483-win-x64.zip`:

```
F25814E7FFA4D7FA9F781B2F07401F288F4BD70791A23B3E50588D94AC2CFB94
```

PowerShell: `Get-FileHash .\Foldex-1.1.483-win-x64.zip -Algorithm SHA256`

---

Copyright (c) 2026 Arco Witter. Released under the [MIT License](https://github.com/ArcoW2/foldex/blob/main/LICENSE).
Like Foldex? [Support me on Ko-fi](https://ko-fi.com/arcowitter).
