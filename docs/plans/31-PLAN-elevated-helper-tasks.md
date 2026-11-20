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
a folder after taking ownership of it (for SYSTEM and TrustedInstaller folders). Create link... asks for the kind of
link, its name and where it goes: in the other pane, next to the item, or to the clipboard, from where Paste link to
<item name> makes it in any folder. It stays a while after its last operation, so
a series asks UAC once; the time is a setting, and while it runs the ribbon shows a shield in a warning colour.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Take ownership | the helper's operation, for the current user; an action for the selected items | -- | 3.1 |
| Create link | a dialog: kind, name, where (the other pane, next to the item, the clipboard); symbolic links through the helper without developer mode | Open question 1 | 3.2 |
| Paste link | "Paste link to <item name>" while the clipboard holds a link source | Create link | 3.2 |
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

- **Create link...**: an action for the focused item (one link, to one item), on the item's menu and in F1: a dialog
  (a modal floating window, plan 14 3.7) with the item it links to, the kind of link, its name, and where it goes:
  - **In the other pane**: in the folder of the pane Ctrl+Shift+O opens into (offered only when there is one);
  - **Next to the item**: in the folder the item is in;
  - **To the clipboard**: nothing is made yet; the item is put on the clipboard as a link source, and Paste link makes
    it where you want it.
- **Paste link to <item name>**: while the clipboard holds a link source, a folder's menu (a list's empty part, a
  tree's folder) and the Paste group offer it; it makes the link in that folder, of the kind chosen in Create link.
  The link source is the item on Windows' clipboard as a copy is (so Paste still pastes a copy) with a mark of
  Foldex's own that holds the kind; anything put on the clipboard after it ends it.
- The kinds, as fit the item: a symbolic link (a file or a folder), a junction (a folder on a local drive), a hard
  link (a file, on the same drive). The default kind and name: open question 1.
- A symbolic link needs administrator rights without developer mode: then the helper makes it (UAC as plan 05);
  with developer mode, and for a junction or a hard link (no rights needed), Foldex makes it itself. Refused (no
  rights, another drive for a hard link, a share for a junction): why, in the dialog's message or on the status line.
- As xplorer2's New link, which puts it in the other pane only; Foldex asks, as the user often does not want it
  there.

### 3.3 The helper's lifetime

- It stays after its last operation for the time of a setting [default not yet decided], so a series asks UAC once;
  then it exits. It still exits at once when Foldex goes.
- While it runs, the ribbon shows a shield in the theme's warning colour; a click on it ends the helper.

### 3.4 Tests

- Unit: the helper's request parsing for the new operations, refusal of anything outside the set and of paths that
  are not full.
- Unit: the kinds a Create link offers for a file, a folder, a folder on a share; a hard link to another drive
  refused.
- In the test copy: Create link to the other pane, next to the item, to the clipboard and Paste link in a third folder
  (a junction and a hard link: no rights needed); the Paste link entry gone once something else is copied.
- By hand (UAC cannot be clicked by the test copy): copy into Program Files with the Windows prompt; take ownership of
  a folder of another user; a symbolic link without developer mode; `WindowsApps` listed after taking ownership; the
  helper staying for its time and exiting after it; refused when the prompt is cancelled.

## 4. Open questions

1. **Create link: its defaults.** The kind first chosen (a symbolic link for both, or a junction for a folder and a
   symbolic link for a file), and the name (the item's own name, as a link usually has; or with " - link" after it,
   as Windows' "- Shortcut")?
