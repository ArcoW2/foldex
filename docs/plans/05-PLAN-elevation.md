# Plan 05: Elevated rights

Status: draft 2026-11-10; not started.

## 1. What this is about

Some things an explorer does need administrator rights: copying into Program Files, deleting in a system folder,
changing permissions or ownership, looking into another user's profile, making a symbolic link without developer mode.
Running all of Foldex as administrator all the time is the bluntest answer and breaks other things (3.2).

## 2. The solution, in brief

Foldex runs as the user. File operations go through Windows' `IFileOperation`, which asks for administrator permission
per operation exactly as Explorer does, so copying into a protected folder needs no elevated Foldex. What
`IFileOperation` does not cover (permissions, ownership, links, listing protected folders) is done by a small elevated
helper: the same exe, started on demand through UAC, doing only a fixed set of operations asked over a private pipe.
Whether a whole Foldex window can also run as administrator, and which of the two comes first, are open questions.

## 3. Details

### 3.1 What needs elevation, and what does it

| Task | Done by |
|---|---|
| Copy, move, delete, rename, new folder in a protected location | `IFileOperation` (Windows asks per operation) |
| Permissions, ownership (take ownership) | Elevated helper |
| Symbolic links and junctions without developer mode | Elevated helper |
| Listing a folder the user cannot read | Elevated helper, or an elevated window (open question 1) |
| Editing a protected file in place | Not Foldex's: LexPen's |

### 3.2 Why not run everything elevated

- Windows blocks dragging from a normal program (Explorer, Outlook) into an elevated window (UIPI).
- Mapped network drives of the normal session are not visible to the elevated one (a separate logon token), unless
  the machine has `EnableLinkedConnections` set.
- Every shell extension loaded into Foldex (context menu, preview handlers, icon overlays) then runs elevated too.
- WebView2 elevated, and an elevated and a normal instance side by side [not yet checked]; see plan 02, 3.4.

### 3.3 The elevated helper

- `Foldex.exe --elevated-helper <pipe>` started with the `runas` verb, so Windows shows its UAC prompt; no service,
  no scheduled task, nothing installed (a scheduled task without a prompt would be a way around UAC: not done).
- The pipe: a fresh random name per start, its access limited to the current user, the helper accepting only its
  parent process as client.
- It accepts a fixed set of operations with their arguments (3.1), checks each, and does nothing else: no commands,
  no scripts.
- It stays for a while after the last operation so a series does not prompt each time, then exits; the time is a
  setting [default not yet decided]. While it runs, the ribbon shows a shield in a warning colour.
- A COM elevation moniker would avoid a process of its own but needs registration in HKLM, which a no-install exe does
  not have.

### 3.4 Tests

- Unit: the helper's request parsing and refusal of anything outside the set; the pipe's access rule.
- By hand (UAC cannot be clicked by the test copy): copy into Program Files with the Windows prompt; take ownership
  through the helper; the helper exiting after its time; refused when the prompt is cancelled.

## 4. Open questions

1. **An elevated window.** Also offer "Run as administrator" for a whole Foldex window (its own instance, a clearly
   different title bar and ribbon colour, its own pipe and data for WebView2), for browsing protected folders at
   length? Suggestion: yes, as an explicit action, never at start-up.
2. **Helper or elevated window first?** If only one is built first: suggestion `IFileOperation` plus the elevated window,
   the helper later; the window covers more with less code.
