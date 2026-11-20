# Foldex macros

A macro is a short script that does what you would otherwise do by hand: start a program on the selected files, go to
a folder and select what matches, run any Foldex action. You keep your macros in Manage macros (Tools > Manage macros),
in folders of your own, each with a name, an icon and up to two keys.

This guide lists everything a macro can say. The language is the one of LexPen's macros, with what a file manager needs
added (items, lists, `run`, `for each`) and LexPen's editor statements left out.

- [Where macros are](#where-macros-are)
- [A first macro](#a-first-macro)
- [The lines of a macro](#the-lines-of-a-macro)
- [Text and numbers](#text-and-numbers)
- [Variables](#variables)
- [System variables](#system-variables)
- [Items and their fields](#items-and-their-fields)
- [Lists](#lists)
- [Functions](#functions)
- [Running a program: run](#running-a-program-run)
- [Doing it for each item: for each](#doing-it-for-each-item-for-each)
- [Conditions: if and switch](#conditions-if-and-switch)
- [Jumps: labels, goto, gosub](#jumps-labels-goto-gosub)
- [Procedures and functions of your own](#procedures-and-functions-of-your-own)
- [Foldex's actions as steps](#foldexs-actions-as-steps)
- [Panes and items: go, select, focus, pane](#panes-and-items-go-select-focus-pane)
- [When something goes wrong](#when-something-goes-wrong)
- [Examples](#examples)

## Where macros are

- **Manage macros** (Tools > Manage macros): the tree of your macros at the left, the macro chosen at the right: its
  name, its keys, its icon and its steps. New makes a folder, a macro, or a macro that runs a program (Run a program...,
  a form: no script needed). Run runs the chosen macro on the active pane. Problems in the steps show under them as you
  type.
- **Running one**: its key; Tools > Macros (the tree as a menu); F1 (every macro is listed as "Macro: name"); a ribbon
  button of its own (Change the ribbon: drag "Macro: name" from F1 onto the ribbon).
- **While one runs** the status line says so; **Esc** stops it. An error stops it too: the line and why are on the
  status line and in the Log.
- **The file**: `macros\macros.json` in Foldex's data folder (`%LOCALAPPDATA%\Foldex`). Copy the `macros` folder to
  another PC to take every macro along.

## A first macro

Open the focused file in Notepad:

```
run "notepad.exe" quoted($$focused)
```

`run` starts a program; `$$focused` is the item the cursor is on; `quoted(...)` puts double quotes round it when its
path has a space, so Notepad gets it as one file.

## The lines of a macro

- One step per line. Upper or lower case does not matter for the words of the language (`IF`, `if`).
- `#` starts a comment, to the end of the line.
- A line that ends with ` \` (a backslash, outside text) goes on on the next line:

  ```
  run \
    "dotnet" "build -c Release" \
    in $$location \
    wait
  ```

- Indenting is free: use it to show what is inside an `if` or a `for each`. Tab in the editor puts in two spaces.

## Text and numbers

- **Text** is between double quotes: `"C:\Tools\x.exe"`. A backslash is just a backslash, so paths are written as they
  are. A double quote inside text is written twice: `"say ""hi"""` is `say "hi"`.
- A **line break** and a **tab** in text: `$$newline` and `$$tab`.
- **Joining** text: `&`: `"name: " & $$focused.name`.
- **Numbers** calculate: `+ - * /`, brackets: `($a + 1) * 2`. A division that does not come out keeps up to 6
  decimals. A result keeps the look of the number it started from (its decimals, leading zeros).
- **Comparing**: `=`, `<>`, `<`, `>`, `<=`, `>=` (as numbers when both are numbers, else as text, upper and lower case
  apart); `contains`, `starts`, `ends`, `matches` (a regular expression): `if $$focused.name starts "IMG_" then ...`.
- **And, or, not**: `if $$count > 0 and not $$focused.ext = "tmp" then ...`.
- **True** is anything but `false`, `0` and empty text.

## Variables

- A variable starts with `$`: `$name`, `$total`, `$f`. It holds a value; a variable never given one is empty text.
- `set $name = <value>` gives it one: `set $n = 0`, `set $dest = "D:\Backup\" & $$date`.
- `inc $n`, `dec $n`: one up, one down.
- `append $list <value>` adds a value to a list, with `", "` between in its text; `append $list <value> <separator>`
  with another separator: `append $names $f.name ";"`. A value of several parts goes between brackets:
  `append $lines ($f.name & " " & $f.size) $$newline`.
- **Types** (optional): `$n:int`, `$n:float`, `$n:text`, with separators: `$n:float(",")` (a comma as decimal point),
  `$n:float(".", ",")` (thousands and decimal). A typed variable refuses a value that does not fit.

## System variables

They start with `$$`, are read-only and tell where Foldex is now:

| Variable | What |
|---|---|
| `$$location` | the folder of the active pane (empty for a scrap) |
| `$$focused` | the item the active pane's cursor is on (an item, see below) |
| `$$selected` | the selected items (a list, in the pane's order) |
| `$$count` | how many items are selected |
| `$$other` | the folder of the other pane: the one Ctrl+Shift+O opens into; empty when there is none |
| `$$pane` | the active pane's name (empty without one) |
| `$$project` | the name of the window's project |
| `$$date`, `$$time` | now: `2026-11-20`, `14:05:09` |
| `$$error`, `$$errorText` | whether the last step failed, and why (with `onerror continue`) |
| `$$exitCode` | the exit code of the last `run ... wait` |
| `$$elevated` | whether the macro has administrator rights now (see Administrator rights) |
| `$$newline`, `$$tab` | a line break and a tab |

*Focused* and *selected* are not the same: the focused item is the one the cursor is on (one item); the selected items
are the ones an action for several items works on.

## Items and their fields

An item (`$$focused`, an item of `$$selected`, the variable of a `for each` over items) is its path, name and
extension as text, so `run $$focused` works as it is. A dot reads one of its fields. Of `D:\abc\def\ghi.jkl`:

| Field | Value |
|---|---|
| `pathNameExt` | `D:\abc\def\ghi.jkl` |
| `path` | `D:\abc\def` (the folder it is in) |
| `nameExt` | `ghi.jkl` |
| `name` | `ghi` |
| `ext` | `jkl` |
| `size` | in bytes, a number (a folder: when its size was counted, else empty) |
| `modified`, `created`, `accessed` | as your date format setting writes dates |
| `attributes` | the letters of the Attributes column: `R H S A C E L O` |
| `type` | as the Type column: `Text Document` |
| `target` | a link's target |

- A folder's `name` is its whole name, its `ext` empty.
- A field the item has no value for is empty text.
- Text that is a path (not an item) has the path's fields too: `"x\y\z.tar.gz".ext` is `gz`.
- Windows' properties have dots in their names, so they are read with a function:
  `prop($$focused, "System.Photo.DateTaken")`.

## Lists

- `$$selected` is a list; so is a variable made with `append`, and `files "*.log"` (the active pane's items matching).
- An item of a list by its number, from 1: `$$selected[1]`, `$$selected[$i].name`. Past the end: empty text.
- `count($$selected)`: how many.
- As text a list is its items with `", "` between.
- Text that is not a list counts as one item per line.

## Functions

On text and paths:

| Function | Gives |
|---|---|
| `len(t)` | the length of the text |
| `upper(t)`, `lower(t)`, `trim(t)` | in upper case, in lower case, without spaces at its ends |
| `left(t, n)`, `right(t, n)` | the first, the last n characters |
| `mid(t, from, n)` | n characters from position `from` (from 1) |
| `pos(find, t)` | where `find` is in `t` (from 1; 0: not there) |
| `replace(t, from, to)` | `t` with every `from` replaced by `to` |
| `path(p)` | the folder a path is in: `path("D:\abc\def\ghi.jkl")` is `D:\abc\def`; `path($f.path)` the folder above |
| `nameExt(p)`, `name(p)`, `ext(p)` | the parts of a path's name, as the fields |
| `quoted(p)` | between double quotes when it holds a space; a list: each item, a space between |
| `unquoted(p)` | the double quotes round it taken off |
| `padleft(t, n)`, `padright(t, n)` | made n characters long with spaces before or after (longer: as it is) |

On numbers:

| Function | Gives |
|---|---|
| `round(n, d)` | n with d decimals: `round($f.size / 1024, 3) & " KB"`, `round($f.size / 1048576, 1) & " MB"` |

On items and lists:

| Function | Gives |
|---|---|
| `count(list)` | how many items |
| `files(pattern)` or `files "pattern"` | the active pane's items whose name matches (`*.log;*.txt`) |
| `prop(item, "System....")` | a Windows property of the item, as Windows shows it |

## Running a program: run

```
run <what> [<parameters>] [in <folder>] [minimized | maximized | hidden] [admin | admin_forced] [wait]
```

- `<what>`: a program, a document (opened with its program) or a URL; started as Windows' Run starts it. `run
  $$focused` opens the focused file as a double click would.
- `<parameters>`: one text; join parts with `&` and quote paths: `"-x " & quoted($$focused)`.
- `in <folder>`: where it starts; without, the active pane's folder. `..` is worked out: `in $$focused.path & "\.."` is
  the folder above the focused item's.
- `minimized`, `maximized`, `hidden`: its window.
- `admin`: as administrator (Windows asks). With the macro's administrator rights it runs so anyway; under the setting
  Never it is an error.
- `admin_forced`: this one program as administrator, whatever the macro's setting (also Never): Windows asks for it
  alone, unless the macro has the rights. `admin` and `admin_forced` together: a mistake.
- `wait`: the macro goes on when the program has ended; `$$exitCode` then has its exit code.
- The options can stand anywhere and in any order, also before what it runs and on lines of their own (with ` \`).

Run a program... in Manage macros writes such a line for you, and opens again on a macro that is one `run` line.

## Doing it for each item: for each

```
for each $f in $$selected
  run "C:\Tools\convert.exe" quoted($f) & " " & $f.size in $f.path wait
next
```

- `$f` is each item in turn, with its fields.
- The list: `$$selected`, `files "*.jpg"`, a variable made with `append`.

## Conditions: if and switch

```
if $$count = 0 then stop

if $$focused.ext = "txt" then
  run "notepad.exe" quoted($$focused)
elseif $$focused.ext = "md" then
  run $$focused
else
  run "explorer.exe" "/select," & quoted($$focused)
endif

switch lower($$focused.ext)
  case "jpg", "png"
    run "mspaint.exe" quoted($$focused)
  case "zip"
    run "C:\Program Files\7-Zip\7zFM.exe" quoted($$focused)
  else
    run $$focused
endswitch
```

- `if ... then <one step>` on one line, or a block with `else`, `elseif` and `endif`.
- `case` takes one value or several with commas; `case > 10` compares.

## Jumps: labels, goto, gosub

- `:name` on a line of its own is a label; `goto :name` goes there.
- `gosub :name` goes there and comes back with `return`.
- `stop` ends the macro.

## Procedures and functions of your own

```
function sizeText($bytes)
  if $bytes >= 1048576 then return round($bytes / 1048576, 1) & " MB"
  return round($bytes / 1024, 1) & " KB"
endfunction

procedure launch($item)
  run $item
endprocedure

launch $$focused
set $s = sizeText($$focused.size)
```

- A procedure is a step; a function gives a value.
- Its variables are its own; `global $x` uses the macro's `$x`; `ref $x` in its parameters changes the caller's
  variable.
- `use "Other macro"` at the top makes the procedures and functions of another macro (by its name) usable here.

## Foldex's actions as steps

Any action of Foldex is a step, by its name, with its parameters as F1 shows them:

```
pane.newChild "right"
item.selectAll
hidden.toggle
```

F1 (All actions and keys) lists every action; its name is in the row's tooltip and in keys.json. An action works on
the active pane, as its key would.

## Panes and items: go, select, focus, pane

| Step | What |
|---|---|
| `go "D:\data"` | the active pane goes to that folder |
| `select "*.log"` | the items matching are the selection (several: `*.log;*.txt`) |
| `focus "a.txt"` | the cursor to that item |
| `pane "Left"` | the pane of that name becomes the active one |

## Copying and moving: copy, move

```
copy <items> to <folder> [replace | noreplace]
move <items> to <folder> [replace | noreplace]
```

- `<items>`: a list (`$$selected`, `files "*.log"`, a list made with `append`), one item (`$$focused`, `$f`) or a path.
- `<folder>`: where they go, a full path.
- A name that is there already: without an option Windows asks, as for a copy in a pane (the macro waits);
  `replace` replaces every one without asking; `noreplace` leaves every one as it is (that item is not copied or
  moved, the others are).
- As a copy in a pane: Windows' own copy, its progress in the operations' list, undo as usual.

```
copy $$selected to "D:\Backup" replace
move files "*.log" to $$location & "\old" noreplace
```

## Administrator rights

A macro runs as you. Some things need administrator rights: a program that asks for them, a copy into
`C:\Program Files`, a delete in a protected folder. Normally Windows asks for each of them on its own. A macro can ask
once instead, and then everything it starts or copies runs as administrator without another question.

When it asks is the macro's setting, in Manage macros under Administrator rights:

| Setting | What |
|---|---|
| At the step elevate | the default: the macro asks where it says `elevate`; until then it runs as you |
| At the start | the macro asks before its first step |
| Never | the macro never has them: `elevate` and `run ... admin` are errors, and a program or copy that needs them fails instead of asking |

- `elevate` (a line of its own): asks for the rights here, unless the macro has them; Windows' administrator question
  shows (on a PC where it asks). Refused: the macro stops at that line, or with `onerror continue` goes on without
  them (`$$error` set); a later `elevate` asks again.
- With the rights, every `run` starts its program as administrator, and every file step (copy, move, and actions such
  as delete or rename) is done as administrator: no question per program or per copy.
- They last until the macro ends (done, stopped with Esc, or an error), for every macro it `use`s too. While they
  last the status line says so and the ribbon shows the shield. The helper that does the work stays for the minutes
  of the setting helperMinutes after its last task, so a second macro shortly after asks nothing.
- `$$elevated`: whether the macro has them now.
- Never: a program that asks for administrator by itself is started as you without Windows' question (and fails
  where it needs the rights); a copy into a protected folder is not done and the step fails.

```
elevate
copy $$selected to "C:\Program Files\Tool" replace
run "C:\Program Files\Tool\setup.exe" "/quiet" wait
if $$exitCode <> 0 then
  log "setup failed: " & $$exitCode
endif
```

## When something goes wrong

- When the macro is read (as you type in Manage macros), mistakes are shown with their line: a word the language does
  not know, a missing `endif` or `next`, a field that is no field. A warning (dimmed) does not stop it.
- While it runs, an error stops it: on the status line and in the Log, with its line.
- `onerror continue` lets it go on after an error; then `$$error` says whether the last step failed and `$$errorText`
  why. `onerror stop` is the default again.

## Examples

Open the focused file in an editor of your own, waiting for it, and tell the result:

```
run "C:\Program Files\Notepad++\notepad++.exe" quoted($$focused) wait
if $$exitCode <> 0 then stop
```

Show the selected files' names and sizes in KB, one per line, in a message of Windows' own:

```
for each $f in $$selected
  append $lines (padright($f.nameExt, 30) & round($f.size / 1024, 1) & " KB") $$newline
next
run "powershell.exe" "-NoProfile -Command Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('" & replace($lines, "'", "''") & "')" hidden
```

Pack the selected items with 7-Zip into the folder of the first:

```
run "C:\Program Files\7-Zip\7z.exe" \
  "a backup.7z " & quoted($$selected) \
  in $$selected[1].path \
  minimized wait
```

Open the focused folder in the other pane, or tell why not:

```
if $$other = "" then stop
pane.openInOther
```

Select the pictures, and copy them:

```
select "*.jpg;*.jpeg;*.png;*.heic"
if $$count = 0 then stop
item.copy
```
