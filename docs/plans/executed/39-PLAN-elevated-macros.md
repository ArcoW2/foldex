# Plan 39: Elevated macros: a macro with administrator rights for its programs and file actions

Status: executed; see Status and 6.

- 2026-11-20: draft, at the user's request.
- 2026-11-20: executed.

Builds on plan 34 (macros, executed: the language, `run`, Manage macros), plan 05 (executed: Foldex never runs
elevated; file operations through `IFileOperation`; the elevated helper, started through UAC, a private pipe only its
parent may use) and plan 31 (executed: the helper's further tasks and its lifetime). LexPen has no elevated macros;
this is Foldex's own.

## 1. What this is about

A macro cannot do work that needs administrator rights without Windows asking again and again: each `run ... admin`
asks UAC for that one program, and each file action in a protected folder (copy into Program Files, delete in a system
folder) asks for that one operation, as Explorer does. A macro that does several such things asks for each, or it
fails halfway. And a macro that should never touch anything protected has no way to say so: Windows' question stops
it until it is answered.

## 2. The solution, in brief

A macro asks for administrator rights at the step `elevate`, where its writer put it, or, with its setting "at the
start", before its first step; Windows asks once (UAC), and the rights last until the macro has done running. With
them the macro's programs are started by the elevated helper, as administrator, and its file actions are done by the
helper, without a question per program or per operation; an `elevate` when the macro has them already asks nothing.
Foldex never asks by itself: without the rights the macro's steps run as now, Windows asking where it does. A macro set
to "never" may not have them: `elevate` is an error, and its programs and file actions are started so that Windows
does not ask either (for a program `__COMPAT_LAYER=RunAsInvoker`); what needs the rights then fails, so the macro can
go on with `onerror continue`. `run ... admin_forced` is the one exception: that program alone as administrator,
whatever the setting. New steps copy and move items to a folder; a name that is there is asked, or answered for every
one with `replace` or `noreplace`.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| The setting | per macro: at the step elevate (a new macro's), at the start, never; in macros.json and Manage macros | 3.1; 6.1 |
| Asking | `elevate`; at the start; UAC once; refused or cancelled: the macro stops (or `$$error`); `$$elevated` | 3.2; 6.1 |
| Programs | every `run` of a macro with the rights started by the helper, as administrator, waited for when asked | 3.3; 6.2 |
| Never | programs started with `__COMPAT_LAYER=RunAsInvoker`; file actions with `FOF_NOERRORUI`; `elevate` and `admin` errors | 3.3; 3.4; 6.2; 6.3 |
| admin_forced | `run ... admin_forced`: one program as administrator whatever the setting | 3.3; 6.2 |
| File actions | the macro's file actions done by the helper (`IFileOperation` in it), no question per operation | 3.4; 6.3 |
| Copy and move | new steps: `copy <items> to <folder>`, `move <items> to <folder>`; a name that is there asked, or `replace`, `noreplace` | 3.4; 6.3 |
| Kept until done | the rights for the whole run, then gone; shown while they last | 3.5; 6.1 |
| The helper | new operations: start a program, file operations | 3.6; 6.2; 6.3 |
| The guide | the setting, `elevate`, `$$elevated`, `admin_forced`, copy and move in the macros' README | 3.7 |
| Tests | unit and in the test copy | 3.8; 6.4 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 The setting

- Per macro, `elevation` in macros.json: `step` (ask at the step `elevate`), `start` (ask at the start), `never`. A new
  macro has `step`; a macro without the setting counts as `step` too.
- Manage macros: under the macro's keys and icon, "Administrator rights" with the three choices ("At the step
  elevate", "At the start", "Never"), each with its hint.
- A macro's setting is its own: a macro it `use`s runs under the rights of the macro that runs (they are one run).

### 3.2 Asking for the rights

- Foldex never asks by itself: only the step `elevate` and the setting "at the start" ask. The macro's writer knows
  where the rights are needed; Foldex does not find it out.
- `elevate` (a statement of its own, anywhere in the macro): the macro asks, unless it has the rights already; then it
  goes on without a question.
- `start`: the macro asks before its first step; an `elevate` in it then asks nothing.
- `never`: `elevate` is an error at its line: "elevate: this macro may not have administrator rights (Manage macros:
  Administrator rights)".
- Asking is starting the elevated helper (plan 05 3.3) through UAC. When the helper already runs (plan 31 3.3 keeps it
  a while after its last task), a macro that asks uses it without a question: it is elevated already.
- Cancelled at Windows' question: the macro stops, "Administrator rights refused", at the line of the step; with
  `onerror continue` it goes on without them, with `$$error` set; a later `elevate` asks again.
- `$$elevated`: true while the macro has the rights.

### 3.3 Programs

- A macro with the rights: every `run` is started by the helper (3.6), as administrator, with its parameters, folder
  and window; `wait` waits for it there and gives its exit code. No UAC question per program.
- Without them (`step` before its `elevate`, or after a refusal): `run` is as now, started as the user; a program that
  asks for administrator itself, and `run ... admin`, get Windows' question for that one program.
- `never`: every `run` is started with `__COMPAT_LAYER=RunAsInvoker` in the environment of the process started, so a
  program that asks for administrator by its manifest starts as the user, without Windows' question (and fails itself
  where it needs the rights); `run ... admin` is an error at its line. The variable works only for a process started
  after it is set (the user's point), so Foldex sets it on what it starts, never on itself:
  - a program: started directly (not through ShellExecute) with the variable in its environment; `wait` and the exit
    code as for any program;
  - a document or a URL (which needs ShellExecute): through `cmd /c "set __COMPAT_LAYER=RunAsInvoker&& start "" <what>
    <parameters>"`; cmd's `start /wait` does not give the program's exit code (checked: 0 for an exit code of 7), so
    for a document `$$exitCode` stays empty.
  - Checked 2026-11-20 on the user's PC: `cliconfg.exe` (its manifest: requireAdministrator) started directly without
    the variable: Windows refused it (740, "requires elevation"); with it: started, not elevated, nothing asked; the
    same through cmd's `start`; `cmd /c exit 7` started directly with the variable: exit code 7.
- `run ... admin_forced`: a new option, that one program as administrator whatever the setting: in a macro with the
  rights started by the helper; without them (also under `never`) Windows asks for that program alone (`runas`, as
  plan 34's `admin`). The macro's rights stay as they were. `admin` and `admin_forced` together: an error when the
  macro is read.

### 3.4 File actions

- The file actions: the actions on the active pane a macro runs (delete, rename, new folder, new file, paste into the
  pane's folder) and the new steps below.
- A macro with the rights: its file actions are done by the helper, which runs `IFileOperation` elevated, so Windows
  asks nothing per operation; their progress and result come back as from the host's own (`fileOp`), so the panes
  follow as now.
- Without them: as now, Windows asks per operation in a protected place (plan 05).
- `never`: a file action is done by `IFileOperation` with `FOF_NOERRORUI` (0x400) besides its usual flags, so Windows
  does not show its question ("You'll need to provide administrator permission"); the operation is aborted, and the
  step fails at its line (with `onerror continue`: `$$error`). Not `FOF_NO_UI`: it answers yes to every question of a
  name that is there (it holds `FOF_NOCONFIRMATION`), which would replace without `replace`. Whether the question of a
  name that is there still shows with `FOF_NOERRORUI`: [not yet checked].
  - Checked 2026-11-20 on the user's PC (an administrator; `ConsentPromptBehaviorAdmin` 0, so UAC itself never asks
    there): a copy into `C:\Program Files` with Foldex's usual flags (0x240) showed Windows' question for
    administrator permission (seen by the user); with 0x400 (and with 0x604, 0x614) nothing was shown, the copy was
    aborted (`GetAnyOperationsAborted`: true) and the file was not there.
- **New steps** (also for plan 35's recording): `copy <items> to <folder>` and `move <items> to <folder>`; the items a
  list or one item or path (`$$selected`, `$f`, `files "*.log"`, a text), the folder a path. As the panes' copy and
  move: `IFileOperation`, its progress in the operations' list. `copy` stops being one of LexPen's left-out words
  (plan 34 6.1) for this step; LexPen's `copy $var` (the editor's selection) stays refused.
- **A name that is there** (as `del /Y` answers every question): without an option, Windows asks, as for the panes'
  copy and move (the macro waits for the answer); `replace` replaces every one without asking; `noreplace` leaves every
  one as it is, without asking (that item is not copied or moved; the others are). `copy $$selected to "D:\Backup"
  replace`. Both: an error when the macro is read. The same options for plan 35's recorded steps.

### 3.5 Kept until done

- The rights last for the whole run, every step and every macro it uses; when the macro ends (done, stopped, Esc, an
  error) they go: the helper started for it is ended, unless plan 31's lifetime keeps it for its time.
- While a macro has them the status line says so ("Macro X runs as administrator... (Esc stops it)"), and plan 31's
  shield shows in the ribbon.
- One macro runs at a time (plan 34 6.4), so the rights are never shared with another macro.

### 3.6 The helper

- New operations, in the fixed set and checked as `list` is: `start` (what, parameters, folder, window, wait; its exit
  code back) and the file operations of 3.4 (each with full paths only).
- The host sends them only for a macro that has the rights, while it runs; the helper itself still only answers its
  parent (plan 05 3.3).

### 3.7 The guide

- `src/defaults/macros/README.md`: a section "Administrator rights": the setting, `elevate`, `$$elevated`, what runs
  elevated and for how long, what "never" does, `admin_forced`; `copy` and `move` with the steps; an example.

### 3.8 Tests

- Unit (Jint): `elevate` read and run against an environment (asked once, not again when the macro has the rights;
  refused: the error at its line; with `onerror continue`: `$$error`, a later `elevate` asks again); "at the start"
  asks before the first step; under `never` `elevate` and `run ... admin` are errors at their line; `$$elevated`;
  `admin_forced` under every setting, with `admin` an error; `copy` and `move` read (a list, an item, a text to a
  folder, with `replace`, `noreplace`, both an error) and LexPen's `copy $var` still refused.
- Unit (host): the helper's request parsing for `start` and the file operations, refusal of anything outside the set
  and of paths that are not full; macros.json keeps `elevation`; a `never` run's start has `__COMPAT_LAYER` set.
- By hand (UAC cannot be clicked by the test copy; on the user's PC an administrator is elevated without UAC asking,
  so UAC's own question is seen only on a PC set to ask, or as a standard user): a macro with `elevate` asks once and starts two programs as
  administrator without asking again; "at the start" asks before anything; a copy into Program Files in a macro with
  the rights asks nothing; Cancel at the question stops the macro at its line; under `never` a program whose manifest
  asks for administrator starts without a question, and a copy into Program Files fails without one; after the macro
  the helper is gone.

## 4. Open questions

None.

## 6. As built

### 6.1 The setting, asking, the run (2026-11-20)

- macros.json keeps `elevation` (`step`, `start`, `never`; anything else left out, so it counts as `step`;
  `MacrosFile`); a new macro gets `step`. Manage macros: a row "Administrator rights" under Icon, a list of the three
  with the hint of the one chosen beside it.
- The page (macros.js): `runMacroText(name, text, elevation)`; the run keeps `elevation` and `elevated`. `start` asks
  before the first step (refused: the macro stops at line 1); `elevate` (macrolang.js, a statement) asks the
  environment, which asks the host (`macroElevate`: the helper's `hello`, which starts it through UAC, or uses the one
  running). With the rights the status line says "Macro X runs as administrator... (Esc stops it)"; the shield is
  plan 31's. `$$elevated` is a system variable.
- The host follows the run's rights for file operations (`FileOps.Rights`: set by `macroElevate`, by `macroRights`
  for never, cleared by `macroRights` at the end of the run, however it ends). The helper itself stays for plan 31's
  minutes.
- One thing to know: while a macro has the rights, a file operation started by hand in another window during the run
  goes through the helper too (one `FileOps` for all windows). One macro runs at a time and runs are short, so it is
  left so.

### 6.2 Programs (2026-11-20)

- `MacroRun.Request` has `AdminForced` and `Rights`. Rights `elevated`: the helper's `start` (MacroRun in the helper,
  ShellExecute, as administrator since the helper is), waited for there with its exit code. While it waits the helper
  answers nothing else (one pipe).
- Never: a program (`.exe`, `.com`, no extension) started directly with `__COMPAT_LAYER=RunAsInvoker` in its own
  environment; anything else through `cmd /c start "" [/wait] <what> <parameters>` with the variable in cmd's
  environment; never on Foldex itself (a test checks). A program by a name only Windows' App Paths know (no path, not
  on PATH) does not start this way: [not yet checked].
- `admin_forced`: `runas` (Windows asks for that program) without the rights, also under never; with them the helper.
  `admin` with `admin_forced`: a mistake when read. `run ... admin` under never: the step's error.

### 6.3 File actions, copy and move (2026-11-20)

- `FileOps.Start` takes `conflict`: `replace` adds `FOF_NOCONFIRMATION`; `noreplace` leaves out, before the operation,
  each item whose name is in the folder. Rights `never` adds `FOF_NOERRORUI`; rights `elevated` sends the operation to
  the helper (`fileOp`: kind, full paths, target, name, flags), which runs `IFileOperation` on an STA thread of its
  own; the host reports it as its own once done (no progress on the way). `FileOps.Perform` is the one operation both
  run. An operation has a completion a macro waits for.
- Steps `copy` and `move` (macrolang.js; `copy` no longer one of LexPen's left-out words, LexPen's `copy $var` still
  refused with its own message); the host's `macroFileOp` waits for the operation: aborted gives "not done (cancelled,
  or refused)", a failure its message.
- Whether Windows' question for a name that is there still shows with `FOF_NOERRORUI` under never: [not yet checked].
- Seen in the test copy, not looked into: a move with `replace` onto a name that is a symbolic link left the link as it
  was (the item moved went; Windows' copy engine seems to write through the link).

### 6.4 Tests

- `MacroLangTests`: `elevate` asked once; refused: the error at its line; with `onerror continue` `$$error` and a later
  `elevate` asks again; under never the error; `admin_forced` passed on, with `admin` a mistake; `copy` and `move` (a
  list, an item, a text; `replace`, `noreplace`, both a mistake; `to` missing; LexPen's `copy $var`). The guide's
  examples read. `MacroRunTests`: the start under never (directly, through cmd with `/wait`, the variable not on
  Foldex), `admin_forced` under every setting, a program's exit code under never, the helper asked to start with the
  rights; the helper's `hello`, refusals of `fileOp` and `start`, and a copy as the helper does it.
  `MacrosFileTests`: `elevation` kept, a wrong one left out. `dotnet test` 327 passed.
- In the test copy (this PC elevates an administrator without asking, so the helper really ran):
  - `step`: `$$elevated` false before `elevate`, true after; `net session` from the macro exit code 0 (administrator);
    a copy into `C:\Program Files` with `replace` and a move out of it again: done, nothing asked.
  - `step` without `elevate`: `$$elevated` false, `net session` exit code 5.
  - `start`: `$$elevated` true at the first step.
  - `never`: a copy into `C:\Program Files`: the step's error "copy: not done (cancelled, or refused)", nothing shown,
    nothing copied; `elevate` and `run ... admin` the errors (with `onerror continue`: `$$errorText`); `net session`
    exit code 5.
  - Manage macros: the row shown, changed to Never, saved in macros.json and sent to the window.
- Not checked: UAC's own question and cancelling it (this PC does not ask); a program whose manifest asks for
  administrator under never through Foldex (checked by hand before the build, 3.3).
