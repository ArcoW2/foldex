# Plan 05: Elevated rights

Status: partly executed; see Status.

- 2026-11-10: draft.
- 2026-11-10: revised.
- 2026-11-10: partly executed through plan 02's spike: the elevated helper, listing only; file operations through
  `IFileOperation`.
- 2026-11-10: partly executed: the compatibility junctions.

## 1. What this is about

Some things an explorer does need administrator rights: copying into Program Files, deleting in a system folder,
changing permissions or ownership, looking into another user's profile, making a symbolic link without developer mode.
Running all of Foldex as administrator all the time is the bluntest answer and breaks other things (3.2).

## 2. The solution, in brief

Foldex runs as the user. File operations go through Windows' `IFileOperation`, which asks for administrator permission
per operation exactly as Explorer does, so copying into a protected folder needs no elevated Foldex. What
`IFileOperation` does not cover (permissions, ownership, links, listing protected folders) is done by a small elevated
helper: the same exe, started on demand through UAC, doing only a fixed set of operations asked over a private pipe,
its results going back to the host. Foldex itself, and with it WebView2, never runs elevated: there is no elevated
window.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| File operations | through `IFileOperation`; copying into a protected location not tried yet | 3.4; plan 02 6.1 |
| Elevated helper | started with `runas`, pipe for the user only, accepting only its parent; one operation: listing; "List as administrator" when access is denied | 3.3; plan 02 6.1, plan 03 6.1 |
| Compatibility junctions | a junction that denies listing: its target listed instead | 3.1 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Permissions and ownership | take ownership through the helper | -- | 3.1 |
| Links without developer mode | symbolic links and junctions | -- | 3.1 |
| SYSTEM and TrustedInstaller folders | | take ownership | 3.1 |
| Helper lifetime | stays a while after its last operation, the time as a setting, the shield in the ribbon | -- | 3.3 |
| Checks by hand | including copying into a protected location and listing through UAC | -- | 3.4; plan 02 6.3 |

## 3. Details

### 3.1 What needs elevation, and what does it

| Task | Done by |
|---|---|
| Copy, move, delete, rename, new folder in a protected location | `IFileOperation` (Windows asks per operation) |
| Permissions, ownership (take ownership) | Elevated helper |
| Symbolic links and junctions without developer mode | Elevated helper |
| Listing a folder the user cannot read | Elevated helper; the host shows its listing in the page as any other |
| Folders owned by SYSTEM or TrustedInstaller (`System Volume Information`, `WindowsApps`) | Elevated helper, after taking ownership; elevation alone is not enough |
| Compatibility junctions that deny listing to everyone (`C:\Documents and Settings`) | No elevation: Foldex lists the junction's target instead (built 2026-11-10: `ShellListing.LinkTarget`; the pane's title shows "link -> target") |
| Editing a protected file in place | Not Foldex's: LexPen's |

### 3.2 Why Foldex itself never runs elevated

- Windows blocks dragging from a normal program (Explorer, Outlook) into an elevated window (UIPI).
- Mapped network drives of the normal session are not visible to the elevated one (a separate logon token), unless
  the machine has `EnableLinkedConnections` set.
- Every shell extension loaded into Foldex (context menu, preview handlers, icon overlays) then runs elevated too.
- An elevated host starts its WebView2 elevated as well, so the page and every library in it would run as
  administrator. With all work in the host and the helper, WebView2 needs no elevation (plan 02, 3.4).

### 3.3 The elevated helper

- `Foldex.exe --elevated-helper <pipe>` started with the `runas` verb, so Windows shows its UAC prompt; no service,
  no scheduled task, nothing installed (a scheduled task without a prompt would be a way around UAC: not done).
- The pipe: a fresh random name per start, its access limited to the current user, the helper accepting only its
  parent process as client.
- It accepts a fixed set of operations with their arguments (3.1), checks each, and does nothing else: no commands,
  no scripts. Results (a listing, done or failed) go back over the pipe to the host.
- It has no window and loads no shell extensions or WebView2.
- It stays for a while after the last operation so a series does not prompt each time, then exits; the time is a
  setting [default not yet decided]. While it runs, the ribbon shows a shield in a warning colour.
- A COM elevation moniker would avoid a process of its own but needs registration in HKLM, which a no-install exe does
  not have.

### 3.4 Tests

- Unit: the helper's request parsing and refusal of anything outside the set; the pipe's access rule.
- By hand (UAC cannot be clicked by the test copy): copy into Program Files with the Windows prompt; take ownership
  through the helper; the helper exiting after its time; refused when the prompt is cancelled.

## 4. Open questions

None.
