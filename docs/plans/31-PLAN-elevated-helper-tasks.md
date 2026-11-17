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

The elevated helper gets three more operations: take ownership, make a symbolic link or junction, and list a folder
after taking ownership of it (for SYSTEM and TrustedInstaller folders). It stays a while after its last operation, so
a series asks UAC once; the time is a setting, and while it runs the ribbon shows a shield in a warning colour.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Take ownership | the helper's operation; an action for the selected items | Open question 1 | 3.1 |
| Links without developer mode | symbolic links and junctions made through the helper | -- | 3.2 |
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

- Symbolic links (to a file or a folder) and junctions (to a folder) made through the helper when the user cannot
  make them (no developer mode); with developer mode, Foldex makes them itself.
- Where: [not yet decided] (open question 2).

### 3.3 The helper's lifetime

- It stays after its last operation for the time of a setting [default not yet decided], so a series asks UAC once;
  then it exits. It still exits at once when Foldex goes.
- While it runs, the ribbon shows a shield in the theme's warning colour; a click on it ends the helper.

### 3.4 Tests

- Unit: the helper's request parsing for the new operations, refusal of anything outside the set and of paths that
  are not full.
- By hand (UAC cannot be clicked by the test copy): copy into Program Files with the Windows prompt; take ownership of
  a folder of another user; a symbolic link without developer mode; `WindowsApps` listed after taking ownership; the
  helper staying for its time and exiting after it; refused when the prompt is cancelled.

## 4. Open questions

1. **Take ownership: for whom.** The current user, or the Administrators group (as Explorer's Advanced Security
   does when you pick it)? The current user is what most "take ownership" tools do.
2. **Making a link: where.** As xplorer2 does (a command "New link" with the source being the selected item and the
   target the other pane's folder), or a dialog asking for both, or both?
