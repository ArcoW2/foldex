# Plan 31: The elevated helper's further tasks: ownership, links, its lifetime

Status: executed; see Status and 6.

- 2026-11-17: draft, at the user's request: the parts of plan 05 that are not about elevating file operations.
- 2026-11-20: executed.

Builds on plan 05 (executed): Foldex never runs elevated; file operations go through `IFileOperation`, which asks
for administrator permission per operation; a small elevated helper (the same exe, started through UAC, a private pipe
only its parent may use) lists a folder the user cannot read. This plan gives that helper its other tasks.

## 1. What this is about

Some things an explorer does need administrator rights that `IFileOperation` does not give: taking ownership of a
file or folder, changing its permissions, making a symbolic link or a junction without developer mode, and looking
into folders owned by SYSTEM or TrustedInstaller (`System Volume Information`, `WindowsApps`), where elevation alone
is not enough. And the helper is started for each listing now, so a series of such tasks asks UAC each time.

## 2. The solution, in brief

The elevated helper gets two more operations, take ownership (for the current user) and make a symbolic link, and lists
with the backup privilege, so a folder only SYSTEM may read is listed too, without changing its owner or permissions.
A submenu Create link holds, per
kind that fits the item (a symbolic link; a junction for a folder; a hard link for a file; a shortcut, which is no
link but is looked for there), "in other pane" (with more
than one other pane, a list of them to choose from) and "to clipboard"; from the clipboard, "Paste symbolic link (junction, hard link) to <item name>" makes it in any folder. No dialog: a link is named as the
item, and only a name that is there asks for another. A link is not a shortcut: it is the file system's own. Create
link is in a Foldex submenu at the top of Explorer's right-click menu, as xplorer2 adds its own. The helper stays a while after its last operation, so a series
asks UAC once; the time is a setting, and while it runs the ribbon shows a shield in a warning colour.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Take ownership | the helper's operation, for the current user, with everything in folders when asked; an action for the selected items | 3.1; 6.1 |
| SYSTEM and TrustedInstaller folders | listed by the helper with the backup privilege (nothing changed on them) | 3.1; 6.1 |
| Create link | a submenu: symbolic link, junction (a folder), hard link (a file), shortcut (.lnk), each in other pane (one, or a list) or to clipboard; a symbolic link through the helper without developer mode | 3.2; 6.2 |
| Paste link | "Paste symbolic link / junction / hard link / shortcut (.lnk) to <item name>" while the clipboard holds a link source | 3.2; 6.2 |
| The Foldex submenu | Foldex's own items for an item in a submenu at the top of Explorer's right-click menu | 3.5; 6.3 |
| Helper lifetime | a session: stays after its last operation for the setting helperMinutes, the shield on the ribbon ends it | 3.3; 6.4 |
| Checks | in the test copy on a PC that elevates without asking, so the helper's operations really ran (6.5) | 3.4; 6.5 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 Ownership

- An operation of the helper: take ownership of the paths given (full paths only, checked as `list` checks its path),
  for the current user; with Recursive, of everything under a folder. Its result per path: done, or why not.
- An action, Take ownership, for the selected items (`selected`, not the focused one: it works on several), on the
  item's menu and in F1; plan 01 lists it among the actions.
- A folder only SYSTEM or TrustedInstaller may read (`System Volume Information`): the helper lists it with the backup
  privilege, which reads past a folder's permissions without changing them; owning it would not help (that one is
  owned by Administrators already). Take ownership stays an action of its own, for when you want to own something.
- Changing permissions beyond ownership (an ACL editor) is not part of this: Windows' Security tab in Properties does
  that.

### 3.2 Links

- **A link is not a shortcut.** A shortcut (.lnk) is a small file of its own that Explorer follows when it is opened;
  a program reading it reads the shortcut. A link is the file system's own: the item seen at another place, so every
  program reading it reads the item itself. Foldex's menu never calls one the other: a link is a "link", a shortcut a
  "Shortcut (.lnk)".
- **Create link**: a submenu in the Foldex submenu (3.5), for the focused item (one link, to one item); its entries
  are actions too (F1, keys, the ribbon). Per kind that fits the item, two entries, the kinds apart by a line; the
  shortcut last, for every item, so whoever looks for one finds it beside the links, not elsewhere in the menu:

  ```
  Symbolic link in other pane
  Symbolic link to clipboard
  ----
  Junction in other pane        (a folder on a local drive)
  Junction to clipboard
  ----
  Hard link in other pane       (a file)
  Hard link to clipboard
  ----
  Shortcut (.lnk) in other pane
  Shortcut (.lnk) to clipboard
  ```

  - **in other pane**: the other panes are the window's panes showing a folder on disk (a list's folder, a tree's
    focused folder; docked or floating), but the one right-clicked in and the panes above it (its parent, that one's
    parent, up to its root: `layout.pane(id).source` upwards); its children, the other branches and other trees all
    count. One of them: the entry makes it there at once.
    More: the entry is "Symbolic link in pane >" (and so for the other kinds), a submenu of those panes by their name
    and folder ("Left - D:\data"; one without a name by its folder alone, plan 25 3.5), the pane Ctrl+Shift+O opens
    into first. None: the entry is off.
  - **to clipboard**: nothing is made yet; the item is put on the clipboard as a link source of that kind, and Paste
    link makes it where you want it, the item's own folder too.
  - No "next to the item": there it cannot have the item's name, so it always needs another; the clipboard does it
    when wanted (pasted in the item's folder, it asks for the name).
- **Paste <kind> to <item name>**: while the clipboard holds a link source, the Foldex submenu of a folder (a list's
  empty part, a tree's folder) and the Paste group offer it, its text always naming the kind on the clipboard:
  "Paste symbolic link to <item name>", "Paste junction to <item name>", "Paste hard link to <item name>" or "Paste
  shortcut (.lnk) to <item name>"; it makes that one in that folder.
- **How Foldex knows what is on the clipboard**: the clipboard never holds a link, only the item; "... to clipboard"
  puts two formats on it at once: the item as a copy of a file is (the file list Explorer uses, so Paste still pastes
  a copy, in Foldex and in Explorer), and a format Foldex registers for itself (`RegisterClipboardFormat`, "Foldex
  link source") holding the kind and the item's path. A folder's menu and the Paste group look for that format; its
  path must be the file on the clipboard, else it is not offered. Whatever is put on the clipboard after it replaces
  both, so the Paste entry goes by itself. On Windows' clipboard, not in Foldex's memory: every Foldex window sees it.
  (Explorer's own "Paste shortcut", in its part of the menu, is offered for any item copied and makes a .lnk; it stays
  as it is.)
- No dialog: a link's name is the item's own (a link stands for the item; not Windows' "- Shortcut"); a name that is
  there in the folder asks for another (askText, the name offered with " (2)"), Cancel makes nothing.
- A shortcut: a .lnk made by Windows' own shell link (`IShellLink`, saved through `IPersistFile`), to the item, its
  working folder the item's folder; named as Windows names one, "<item name> - Shortcut.lnk", so it never takes the
  item's name and can be pasted in the item's own folder without a question. No rights needed (a protected folder:
  Windows' question per operation, as any new file).
- A symbolic link needs administrator rights without developer mode: then the helper makes it (UAC as plan 05);
  with developer mode, and for a junction or a hard link (no rights needed), Foldex makes it itself. Refused (no
  rights, another drive for a hard link, a share for a junction): why, on the status line.
- As xplorer2's New link, which puts it in the other pane only; Foldex adds the clipboard, as the user often does not
  want it there.

### 3.3 The helper's lifetime

- It stays after its last operation for the time of a setting (helperMinutes, 5 minutes, 0 to 120), so a series asks UAC once;
  then it exits. It still exits at once when Foldex goes.
- While it runs, the ribbon shows a shield in the theme's warning colour; a click on it ends the helper.

### 3.4 Tests

- Unit: the helper's request parsing for the new operations, refusal of anything outside the set and of paths that
  are not full.
- Unit: what Create link offers for a file (symbolic link, hard link, shortcut) and a folder (symbolic link, junction
  on a local drive only, shortcut); a hard link to another drive refused; a name that is there asked with " (2)" offered.
- In the test copy: a junction, a hard link and a shortcut (no rights needed) in other pane (one other pane: at once; three: the
  list, each pane by its name and folder), and to clipboard pasted in a
  third folder and in the item's own folder (the name asked); the Paste entry naming its kind, gone once something else is copied; the Foldex
  submenu in the right-click menu, Explorer's own items and extensions under it as before.
- By hand (UAC cannot be clicked by the test copy): copy into Program Files with the Windows prompt; take ownership of
  a folder of another user; a symbolic link without developer mode; `WindowsApps` listed after taking ownership; the
  helper staying for its time and exiting after it; refused when the prompt is cancelled.

### 3.5 The Foldex submenu

- A right-click on an item shows Explorer's own menu with every installed extension (plan 02 3.1, `ShellMenu`).
  Foldex already puts items of its own at its top (plan 23 3.2: Add to / Remove from quick access and bookmarks).
  This plan's items go in a submenu "Foldex" there, as xplorer2 adds its own: Create link (its own submenu, 3.2),
  Take ownership; on a folder (its empty part, a tree's folder) also Paste symbolic link (junction, hard link) to <item name> while the
  clipboard holds a link source.
- Made as the items of plan 23 are (inserted into the menu Windows built, with ids past the shell's range), as a
  popup of its own (`MF_POPUP`); the items of plan 23 stay where they are.
- An own menu of Foldex's, in the place of Explorer's, is plan 40.

## 4. Open questions

None.

## 6. As built

### 6.1 The helper's operations (2026-11-20)

- `ElevatedHelper.Run` switches on three privileges an administrator holds, once: SeBackupPrivilege (reading any folder:
  .NET's listing opens folders with backup semantics, so `ShellListing.List` in the helper lists a folder only SYSTEM
  may read), SeRestorePrivilege and SeTakeOwnershipPrivilege (setting an owner). New operations, checked as `list`:
  `takeOwnership` { paths (full), recursive, sid } (`SetNamedSecurityInfo` with the owner only; recursive: a walk that
  sets a link's own owner and does not go through it; per path done, or why) and `symlink` { link, target }.
- Changed from the plan: "take ownership and list" for SYSTEM folders. Checked first on the user's PC: elevated,
  `WindowsApps` (owned by TrustedInstaller) lists as it is; `System Volume Information` (owned by Administrators
  already, only SYSTEM may read it) is denied even elevated, and with the backup privilege listed (nothing changed). So
  the backup privilege, and Take ownership stays an action of its own.
- Take ownership (`item.takeOwnership`): asks first; with folders among the selected, whether also everything in them.

### 6.2 Links (2026-11-20)

- `src/Shell/Links.cs`: the kinds that fit an item, their names (the item's own; a shortcut "<name> - Shortcut.lnk";
  `FreeName` offers "name (2)"), making each: a symbolic link by .NET (with developer mode; else "elevate", and the
  host asks the helper), a junction (a folder with a mount point reparse point, written with `FSCTL_SET_REPARSE_POINT`),
  a hard link (`CreateHardLink`; on another drive refused), a shortcut (`IShellLink`, saved by `IPersistFile`).
- The host: `makeLink` (a name that is there: { exists, name } and the page asks for another), `linkSource` (put, read).
  The clipboard: the item as a copy is, and the format "Foldex link source" with "kind|path"; the windows listen to
  the clipboard (`AddClipboardFormatListener`) and are told what link source it holds (`linkSource`), so the menus and
  the ribbon know it at once.
- The page: `link.create` (a variant per kind and place, so F1 and keys have them), `link.paste` (its title names the
  kind and the item), `createLink`, `makeLinkTo`, `pasteLink`; the other panes (`linkPanes`): every pane showing a
  folder on disk but the pane itself and those above it, the one Ctrl+Shift+O opens into first. Foldex's own menu of
  a pane's empty part has "Paste <kind> to <item>" while there is a link source; the ribbon's Clipboard group a Paste
  link button (its text fixed, as the ribbon does not change texts; its tooltip names the kind and item).

### 6.3 The Foldex submenu (2026-11-20)

- `ShellMenu.OwnItem`: Foldex's own items as a tree, a submenu a popup of its own (`MF_POPUP`), the items numbered past
  the shell's range in their order. `MainForm.FoldexSubmenu`: Create link (per kind: in other pane, one or a list of
  them, to clipboard), Take ownership..., and on a folder Paste <kind> to <item>; each runs an action of the page that
  asked (`runAction`).
- The menu for items is asked by the window's page (`itemMenu`), which knows the other panes; a pane's own page sends
  its request there (viewpage.js), with its point on the screen. Explorer's Rename chosen from it renames in the pane's
  own page (`renameFocusedHere`).
- At the user's request, every item of Foldex's own is in the Foldex submenu: Add to (Remove from) quick access and
  bookmarks (plan 26) first, a line, then Create link and the others; the menu's top has only Foldex above Windows'
  items. Not yet seen in the app.

### 6.4 The helper's lifetime (2026-11-20)

- `ElevatedHelper.Session` (AppHost.Elevated): started through UAC at the first operation; kept after each for the
  setting helperMinutes (5 minutes by default, chosen: not measured; 0 to 120; 0 ends it after each); `End` (the shield,
  `helper.end`) closes the pipe, and the helper exits. Every window is told whether it runs (`helper`): the shield at
  the right of the ribbon's tabs, in the warning colour. List as administrator goes through the session too.

### 6.5 Tests

- `LinksTests`: what fits a file and a folder, the names and a free name; a junction (the folder's items through it),
  a hard link (changed through either name), a shortcut made; a symbolic link made or needing the helper; a hard link
  to another drive refused; the link source's bytes; what the helper refuses, and take ownership's answer per path.
  `dotnet test` 322 passed.
- In the test copy, on a PC that elevates an administrator without asking (`ConsentPromptBehaviorAdmin` 0), so the
  helper really ran: a hard link into the one other pane; the name taken: asked, "file (2).txt" offered and made; a
  symbolic link (no developer mode) made by the helper, the shield shown; a junction to the clipboard ("Paste junction
  to data") pasted in a third folder; Take ownership of a folder with everything in it (4 done, none failed);
  `C:\System Volume Information` listed through the helper (22 entries); the shield clicked: the helper gone, the
  shield hidden. The right-click menu photographed: Foldex > Create link > the kinds of a folder, Take ownership...,
  Paste junction to data; Windows' own items and the extensions' under it as before.
- Not checked: UAC's question itself (this PC does not ask), a cancelled question, the helper ending after its minutes,
  a symbolic link with developer mode, a share.
