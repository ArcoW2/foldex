# Plan 31: The elevated helper's further tasks: ownership, links, its lifetime

Status: not started; see Status.

- 2026-11-17: draft, at the user's request: the parts of plan 05 that are not about elevating file operations.

Builds on plan 05 (executed): Foldex never runs elevated; file operations go through `IFileOperation`, which asks
for administrator permission per operation; a small elevated helper (the same exe, started through UAC, a private pipe
only its parent may use) lists a folder the user cannot read. This plan gives that helper its other tasks.

## 1. What this is about

Some things an explorer does need administrator rights that `IFileOperation` does not give: taking ownership of a
file or folder, changing its permissions, making a symbolic link or a junction without developer mode, and looking
into folders owned by SYSTEM or TrustedInstaller (`System Volume Information`, `WindowsApps`), where elevation alone
is not enough. And the helper is started for each listing now, so a series of such tasks asks UAC each time.

## 2. The solution, in brief

The elevated helper gets three more operations: take ownership (for the current user), make a symbolic link, and list
a folder after taking ownership of it (for SYSTEM and TrustedInstaller folders). A submenu Create link holds, per
kind that fits the item (a symbolic link; a junction for a folder; a hard link for a file), "in other pane" (with more
than one other pane, a list of them to choose from) and "to clipboard"; from the clipboard, "Paste symbolic link (junction, hard link) to <item name>" makes it in any folder. No dialog: a link is named as the
item, and only a name that is there asks for another. A link is not a shortcut: it is the file system's own. Create
link is in a Foldex submenu at the top of Explorer's right-click menu, as xplorer2 adds its own. The helper stays a while after its last operation, so a series
asks UAC once; the time is a setting, and while it runs the ribbon shows a shield in a warning colour.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Take ownership | the helper's operation, for the current user; an action for the selected items | -- | 3.1 |
| Create link | a submenu: symbolic link, junction (a folder), hard link (a file), each in other pane or to clipboard; a symbolic link through the helper without developer mode | -- | 3.2 |
| Paste link | "Paste symbolic link / junction / hard link to <item name>" while the clipboard holds a link source | Create link | 3.2 |
| The Foldex submenu | Foldex's own items for an item in a submenu at the top of Explorer's right-click menu | -- | 3.5 |
| SYSTEM and TrustedInstaller folders | listed after taking ownership | Take ownership | 3.1 |
| Helper lifetime | stays a while after its last operation, the time as a setting, the shield in the ribbon | -- | 3.3 |
| Checks by hand | copying into a protected location (plan 05's `IFileOperation`) and each operation here through UAC | -- | 3.4 |

## 3. Details

### 3.1 Ownership

- An operation of the helper: take ownership of the paths given (full paths only, checked as `list` checks its path),
  for the current user; with Recursive, of everything under a folder. Its result per path: done, or why not.
- An action, Take ownership, for the selected items (`selected`, not the focused one: it works on several), on the
  item's menu and in F1; plan 01 lists it among the actions.
- A folder owned by SYSTEM or TrustedInstaller that the helper cannot list: "Take ownership and list" in its message,
  which does both through the helper.
- Changing permissions beyond ownership (an ACL editor) is not part of this: Windows' Security tab in Properties does
  that.

### 3.2 Links

- **A link is not a shortcut.** A shortcut (.lnk) is a small file of its own that Explorer follows when it is opened;
  a program reading it reads the shortcut. A link is the file system's own: the item seen at another place, so every
  program reading it reads the item itself. Foldex makes links, and its menu says "link", never "shortcut". (A
  shortcut Explorer's own New > Shortcut makes, in its menu.)
- **Create link**: a submenu in the Foldex submenu (3.5), for the focused item (one link, to one item); its entries
  are actions too (F1, keys, the ribbon). Per kind that fits the item, two entries, the kinds apart by a line:

  ```
  Symbolic link in other pane
  Symbolic link to clipboard
  ----
  Junction in other pane        (a folder on a local drive)
  Junction to clipboard
  ----
  Hard link in other pane       (a file)
  Hard link to clipboard
  ```

  - **in other pane**: the other panes are the window's panes showing a folder on disk (a list's folder, a tree's
    focused folder; docked or floating), but the one right-clicked in. One of them: the entry makes it there at once.
    More: the entry is "Symbolic link in pane >" (and so for the other kinds), a submenu of those panes by their name
    and folder ("Left - D:\data"; one without a name by its folder alone, plan 25 3.5), the pane Ctrl+Shift+O opens
    into first. None: the entry is off.
  - **to clipboard**: nothing is made yet; the item is put on the clipboard as a link source of that kind, and Paste
    link makes it where you want it, the item's own folder too.
  - No "next to the item": there it cannot have the item's name, so it always needs another; the clipboard does it
    when wanted (pasted in the item's folder, it asks for the name).
- **Paste <kind> to <item name>**: while the clipboard holds a link source, the Foldex submenu of a folder (a list's
  empty part, a tree's folder) and the Paste group offer it, its text always naming the kind on the clipboard:
  "Paste symbolic link to <item name>", "Paste junction to <item name>" or "Paste hard link to <item name>"; it makes
  that one in that folder. The link source is the item on Windows' clipboard as a copy is (so
  Paste still pastes a copy) with a mark of Foldex's own that holds the kind; anything put on the clipboard after it
  ends it.
- No dialog: its name is the item's own (a link stands for the item; not Windows' "- Shortcut"); a name that is there
  in the folder asks for another (askText, the name offered with " (2)"), Cancel makes nothing.
- A symbolic link needs administrator rights without developer mode: then the helper makes it (UAC as plan 05);
  with developer mode, and for a junction or a hard link (no rights needed), Foldex makes it itself. Refused (no
  rights, another drive for a hard link, a share for a junction): why, on the status line.
- As xplorer2's New link, which puts it in the other pane only; Foldex adds the clipboard, as the user often does not
  want it there.

### 3.3 The helper's lifetime

- It stays after its last operation for the time of a setting [default not yet decided], so a series asks UAC once;
  then it exits. It still exits at once when Foldex goes.
- While it runs, the ribbon shows a shield in the theme's warning colour; a click on it ends the helper.

### 3.4 Tests

- Unit: the helper's request parsing for the new operations, refusal of anything outside the set and of paths that
  are not full.
- Unit: what Create link offers for a file (symbolic link, hard link) and a folder (symbolic link, junction on a local
  drive only); a hard link to another drive refused; a name that is there asked with " (2)" offered.
- In the test copy: a junction and a hard link (no rights needed) in other pane (one other pane: at once; three: the
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
