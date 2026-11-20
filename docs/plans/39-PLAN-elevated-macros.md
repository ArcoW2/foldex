# Plan 39: Elevated macros: a macro with administrator rights for its programs and file actions

Status: not started; see Status.

- 2026-11-20: draft, at the user's request.

Builds on plan 34 (macros, executed: the language, `run`, Manage macros), plan 05 (executed: Foldex never runs
elevated; file operations through `IFileOperation`; the elevated helper, started through UAC, a private pipe only its
parent may use) and plan 31 (the helper's further tasks and its lifetime, not started). LexPen has no elevated macros;
this is Foldex's own.

## 1. What this is about

A macro cannot do work that needs administrator rights without Windows asking again and again: each `run ... admin`
asks UAC for that one program, and each file action in a protected folder (copy into Program Files, delete in a system
folder) asks for that one operation, as Explorer does. A macro that does several such things asks for each, or it
fails halfway. And a macro that should never touch anything protected has no way to say so.

## 2. The solution, in brief

Every macro gets a setting, Administrator rights: ask when needed, ask at the start, or never. With rights (Windows
asks once, through UAC), the macro's programs are started by the elevated helper, as administrator, and its file
actions are done by the helper, without a question per program or per operation. A macro with "when needed" asks the
first time a step needs it, or at the step `elevate`; one with "at the start" asks before its first step; one with
"never" is refused without asking. Once a macro has the rights it keeps them until it has done running; then they go.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The setting | per macro: ask when needed, ask at the start, never; in macros.json and Manage macros | -- | 3.1 |
| Asking | UAC once for the run; `elevate`; refused or cancelled: the macro stops (or `$$error`); `$$elevated` | -- | 3.2 |
| Programs | every `run` of a macro with rights started by the helper, as administrator, waited for when asked | -- | 3.3 |
| File actions | the macro's file actions done by the helper (`IFileOperation` in it), no question per operation | Open questions 1, 2 | 3.4 |
| Kept until done | the rights for the whole run, then gone; shown while they last | Plan 31 3.3 (the shield) | 3.5 |
| The helper | new operations: start a program, file operations; refused outside a macro with rights | -- | 3.6 |
| The guide | `elevate`, `$$elevated` and the setting in the macros' README | -- | 3.7 |
| Tests | 3.8 | -- | 3.8 |

## 3. Details

### 3.1 The setting

- Per macro, `elevation` in macros.json: `needed` (ask when needed), `start` (ask at the start), `never`. A macro
  without it: [not yet decided] (open question 3).
- Manage macros: under the macro's keys and icon, "Administrator rights" with the three choices, each with its hint.
- A macro's setting is its own: a macro it `use`s runs under the rights of the macro that runs (they are one run).

### 3.2 Asking for the rights

- `needed`: the macro asks the first time a step needs them (3.3, 3.4), or at the step `elevate` (a statement of its
  own; usually the first line, so the question comes before anything has been done).
- `start`: it asks before its first step; `elevate` then changes nothing.
- `never`: a step that needs the rights fails with "<step>: needs administrator rights, and this macro may not ask
  for them (Manage macros: Administrator rights)", at its line; `elevate` is the same error. No UAC question.
- Asking is starting the elevated helper (plan 05 3.3) through UAC. When the helper already runs (plan 31 3.3 keeps it
  a while after its last task), a macro that may ask uses it without a question: it is elevated already.
- Cancelled at Windows' question: the macro stops, "Administrator rights refused", at the step's line; with
  `onerror continue` it goes on with `$$error` set, and asks again at the next step that needs them.
- `$$elevated`: true while the macro has the rights.

### 3.3 Programs

- A macro with rights: every `run` is started by the helper (3.6), as administrator, with its parameters, folder and
  window; `wait` waits for it there and gives its exit code. No UAC question per program.
- Needing the rights (for `needed`): `run ... admin`, and a program Windows refuses to start without them (its error
  "requires elevation", 740): the macro asks, then starts it through the helper.
- Without the macro's rights `run` is as now: started as the user. What `run ... admin` does in a macro set to
  "never" (Windows asking for that one program, as plan 34 has it, or refused): open question 4.

### 3.4 File actions

- A macro with rights: its file actions (open question 2: which) are done by the helper, which runs `IFileOperation`
  elevated, so Windows asks nothing per operation; their progress and result come back as from the host's own
  (`fileOp`), so the panes follow as now.
- Needing the rights (for `needed`): an operation the host's `IFileOperation` would elevate (a protected source or
  target). Whether that can be known before Windows asks is [not yet checked]: `IFileOperation` decides it itself
  (open question 1).

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
  elevated and for how long, and what "never" refuses; an example.

### 3.8 Tests

- Unit (Jint): `elevate` read and run against an environment (asked once; refused: the error at its line; with
  `onerror continue`: `$$error`); `$$elevated`; a `run` that needs the rights asks first under `needed`, fails under
  `never`.
- Unit (host): the helper's request parsing for `start` and the file operations, refusal of anything outside the set
  and of paths that are not full; macros.json keeps `elevation`.
- By hand (UAC cannot be clicked by the test copy): a macro with `start` asks once and starts two programs as
  administrator without asking again; a copy into Program Files in a macro with rights asks nothing; Cancel at the
  question stops the macro at its line; `never` refuses without a question; after the macro the helper is gone.

## 4. Open questions

1. **"Never" and Windows' own question.** Outside a macro a file action in a protected folder lets Windows ask (plan
   05). In a macro set to "never", should such an action fail without Windows' question, or may Windows still ask for
   that one operation? (Failing needs `IFileOperation` told not to elevate: [not yet checked] whether it can be.)
2. **Which file actions.** The actions on the active pane a macro can run (delete, rename, new folder, new file,
   paste into the pane's folder), or also new steps with a source and a target (copy / move <items> to <folder>),
   which plan 35 meant to add for recording?
3. **A new macro's setting.** Ask when needed, or never? And a macro of before (macros.json without the setting)?
4. **`run ... admin` without the macro's rights.** In a macro set to "never", is `run ... admin` (one program as
   administrator, Windows asking for it alone, as plan 34 has it) still allowed, or refused as everything else?
