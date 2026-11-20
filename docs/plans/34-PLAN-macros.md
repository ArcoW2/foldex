# Plan 34: Macros: run programs, act on panes and items, kept in a tree with keys

Status: not started.

- 2026-11-19: draft, at the user's request.

Takes over plan 01's Macros part (plan 01 3.3: LexPen's `MacroStore.cs`, its recording, `PLAN-macros.md`); recording
is plan 35. Builds on
plan 26 and 27 (bookmarks: entries with names, icons and keys, kept in folders to any depth, Manage the bookmarks) and
plan 19 / 30 (the ribbon). LexPen is the model: `..\LexPen\docs\plans\executed\PLAN-macros.md` and
`PLAN-macro-window.md`, `..\LexPen\web\macrolang.js`, `..\LexPen\src\MacroStore.cs`. It covers xplorer2's user
commands (a program with tokens, under a key). The number in the file name is the priority; rename to reorder.

## 1. What this is about

Foldex cannot run a program on what a pane shows: xplorer2 starts an executable from a user command, with the
focused file, the selection or a fixed text as its parameters, under a key or a button. Foldex has no way to do that,
and no way to repeat a series of its own actions either. LexPen has macros for the second; Foldex has none, though
plan 01 meant to bring them over.

## 2. The solution, in brief

A macro is a script in LexPen's macro language: a step per line, each step a Foldex action by name or a statement
(variables, if, switch, goto, gosub), plus a statement that runs a program, document or URL with parameters, and a
loop over a list of items. System variables say where Foldex is: the active pane's folder, the focused item, the
selected items, the other pane's folder; an item reads its fields as the columns name them (`$$focused.size`, in
bytes), a list is indexed from 1, and functions take paths apart (name, extension, quoted, unquoted) and round a number,
so a size divided to KB or MB gets its decimals. Macros are arranged as the bookmarks are, but kept apart
from them, in a folder of their own that can be copied on its own: a tree with folders to any depth in your order,
each macro with a name, an icon and keys. Manage macros (a pane, docked or floating) holds the tree and the editor;
New offers a folder, a macro, and Run a program (a form that writes the one-line macro). They run from their key,
from a Macros menu on the ribbon (the tree as submenus), from F1 and from a ribbon button of their own. Recording a
macro is plan 35.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The language | LexPen's macro language (`macrolang.js`) copied: statements, variables, conditions, labels; Foldex actions as steps | -- | 3.1 |
| System variables | the active pane's folder, the focused item, the selected items, the other pane, ... | -- | 3.2 |
| Items and functions | an item's fields (`$$focused.size`), a list's index from 1, `prop`; the functions on a path (with `unquoted`), `round`, `padleft`, `padright` | The language | 3.2 |
| Run | `run`: a program, document or URL with parameters, where it starts, its window, as administrator, waiting for it | -- | 3.3 |
| For each | a loop over a list of items (the selected ones) | -- | 3.4 |
| The tree | macros in folders to any depth, your order, a name, an icon and keys each; `macros\` in the data folder, apart from the bookmarks | -- | 3.5 |
| Manage macros | a pane (docked or floating): the tree, New (Folder, Macro, Run a program), the editor, Run, Key, Icon, Move to folder | The tree | 3.6 |
| Run a program | the form: program, parameters (fixed text and variables), start in, window, as administrator | Run | 3.6 |
| Running them | keys, the Macros menu on the ribbon, F1, a ribbon button for one macro; errors on the status line and in the Log | -- | 3.7 |
| Tests | see 3.8 | -- | 3.8 |

Moved out: recording macros to plan 35.

## 3. Details

### 3.1 The language

- LexPen's macro language as it is (`..\LexPen\web\macrolang.js`; its plan 3.2 to 3.5): a step per line, `#` a
  comment; text between double quotes with `\"`, `\\`, `\n`, `\t`; `set`, `$name` variables with their number rules,
  `&` joining, `inc`, `dec`, `append`; `if ... then` on one line or as a block with `else`, `elseif`, `endif`;
  `switch` / `case` / `endswitch`; `:label`, `goto`, `gosub`, `return`, `stop`; procedures and functions. No
  JavaScript, for LexPen's reason: a macro can only do what its statements say.
- A step that is an action: any Foldex action by its name with its parameters, as keys.json and ribbon.json name it
  (`pane.newChild "right"`, `item.copy`, `hidden.toggle`). It acts on the active pane, as a key would.
- Copied, not shared: the copy is Foldex's own from then on (plan 01 3.3). What LexPen's language has that has no
  meaning here (the editor's cursor: `moveto`, `type`, `find`, `$$line`, documents and their panes) is left out; a
  macro that uses it is told so when it is read (LexPen's validation, its plan 3.10).
- Steps for panes and items, new: `go "D:\data"` (the active pane goes there; not `goto`, which LexPen keeps for labels), `select "*.log"` (the items
  matching, as Select by pattern), `focus "name"`, `pane "name"` (the pane of that name becomes the active one, plan
  25's names). [The full list: written when the part is built, from the actions F1 lists.]

### 3.2 System variables

Read-only and set before every step, `$$` in front as in LexPen, so a macro's own variable cannot change one. They
keep the selected and the focused items apart (the project's words):

| Variable | What |
|---|---|
| `$$location` | the active pane's folder (empty for a scrap) |
| `$$focused` | the item the active pane focuses (an item, below) |
| `$$selected` | the selected items, a list (3.4), in the pane's order; `$$selected[1]` the first |
| `$$count` | how many items are selected |
| `$$other` | the folder of the other pane: the next other child of the parent, as Ctrl+Shift+O picks it; empty when there is none |
| `$$pane` | the active pane's name (plan 25) |
| `$$project` | the project's name |
| `$$date`, `$$time` | now, as `2026-11-19` and `14:05:09` |
| `$$error`, `$$errorText` | the last step failed, and why (as LexPen's) |
| `$$exitCode` | the exit code of the last `run ... wait` |

- **An item** (`$$focused`, an item of `$$selected`, the variable of `for each` over items) is a text, its full path,
  so `run $$focused` and `"x " & quoted($$focused)` use it as it is; a dot reads one of its fields. Where Foldex
  differs from LexPen: LexPen's values are text only, without fields or lists; an item is more than its path.
  - The fields are the ids of the columns and of the filter's fields: `name`, `ext`, `size`, `modified`, `created`,
    `accessed`, `attributes`, `type`, `target`, `fullPath`, and `folder` (the folder it is in) and `base` (its name
    without the extension): `$$focused.size`, `$$selected[2].modified`, `$f.fullPath`.
  - `size` is in bytes, always, a number (so it calculates and compares: `if $f.size > 1000000 then`); another unit
    is a division (below). Dates as the setting dateFormat writes them; attributes as the Attributes column's
    letters. A field the item has no value for (a folder's size not counted, a link target of a file that is none):
    empty text.
  - Windows' properties, whose names have dots of their own: `prop($$focused, "System.Photo.DateTaken")`, read only
    when a macro asks (they are slow to read).
- **A list** is indexed from 1, as LexPen counts (`mid`, `pos`): `$$selected[1]`, `$$selected[$i].name`; past its end:
  empty text. `count(<list>)` its length.
- **Functions on a path**, for any text that is one (an item, a line read from a file, full or relative): `name($p)`
  (without its folder), `base($p)` (without its extension too), `ext($p)`, `folder($p)`, `quoted($p)` (between double
  quotes when it holds a space; on a list: each item), `unquoted($p)` (the double quotes round it taken off, when
  there are). On an item they give what its fields give.
- **Numbers and sizes**: LexPen's arithmetic divides already (`/`, up to 6 decimals when it does not come out), so a
  size in another unit is a division, its decimals `round(<number>, <decimals>)`: `round($f.size / 1024, 3) & " kb"`,
  `round($f.size / 1048576, 2) & " MB"`. `padleft(<text>, <length>)` and `padright(<text>, <length>)` a text made that
  long with spaces before or after it (a longer one as it is), for columns in a text written out. A number's decimal
  separator as LexPen's numbers keep it (its plan 3.2).

### 3.3 Run

- `run <what> [<parameters>]`, both expressions: `run "C:\Tools\x.exe" "--verbose " & quoted($$focused)`.
  `<what>` is a program, a document (opened with its program) or a URL: the host starts it as Windows' Run does
  (ShellExecute), so `run $$focused` opens the focused file as a double click would.
- Options after it, as words: `in <folder>` (where it starts; default `$$location`), `minimized`, `maximized`,
  `hidden`, `admin` (as administrator: Windows asks, as for any program; not Foldex's elevated helper, plan 05),
  `wait` (the macro goes on when the program ends; `$$exitCode` then has its code).
- Without `wait` the macro goes on at once. A program that cannot start: `$$error`, and the macro stops unless it
  tests `$$error` (LexPen's rules, its plan 3.5).
- The host starts it, never the page; the page asks with the macro's line, so what runs is what the macro says.

### 3.4 For each

- New to the language: `for each $p in <list>` ... `next`. A list is `$$selected`, a variable made with `append`, or
  `files "<pattern>"` (the active pane's items matching). `$p` is each item in turn, with its fields (3.2) when the
  list holds items.
- So: `for each $f in $$selected` / `run "C:\Tools\conv.exe" quoted($f) & " " & $f.size wait` / `next`: the program
  once per selected file, one after the other, with its size in bytes.

### 3.5 The tree

- As the bookmarks (plan 27): folders hold macros and other folders, to any depth, in your order; a folder is
  Foldex's own grouping. Every macro has an id (never known by its name), a name (any text), an icon (as a
  bookmark's: from a file, SHELL32.dll by default) and two keys (as a bookmark's, plan 26 3.6: one key or a chord, a
  clash asked).
- Kept apart from the bookmarks: a folder of its own in the data folder, `macros\`, holding `macros.json` (the tree,
  each macro's id, name, icon, keys and text), written by Foldex whole, through a temporary file, as bookmarks.json.
  Nothing of it is in bookmarks.json or keys.json, so copying `macros\` to another PC copies every macro and nothing
  else. A file that cannot be read counts as empty and is not overwritten until a macro is changed.

### 3.6 Manage macros

- A pane of its own, **docked or floating** (both), first floating, as Manage the bookmarks; plan 14 3.7's list gets
  its row. It looks as Manage the bookmarks: the tree at the left (folders that open and close, drag onto a folder or
  between rows, Move to folder..., Remove with the question for a folder that holds something), the chosen macro at
  the right: its name, icon, keys, and its text in an editor with the language's colours.
- New is a drop-down: **Folder...**, **Macro...** (an empty macro in the editor), **Run a program...**.
- **Run a program...**: a form that writes a one-line macro, so starting an executable needs no script: Program (a
  field and Browse), Parameters (fixed text; a button inserts a variable: the focused item, the selected items, the
  first selected, the folder, the other pane's folder), Start in (the folder, or one chosen), Window (normal,
  minimized, maximized, hidden), Run as administrator, Wait until it ends. OK writes the `run` line; the macro is an
  ordinary macro from then on (its text can be changed; the form opens again on it while it is one `run` line).
- Run (the chosen macro now, on the active pane of the window), Key..., Icon..., Rename (F2), Delete (Del).

### 3.7 Running them

- A macro's keys (3.5) run it. In keys.json a macro is also `["macro.run", "<id>"]`, as LexPen's `macroRun`.
- Tools > Macros on the ribbon: a split button whose list is the tree (folders as submenus, as the Bookmarks menu,
  plan 27 3.2), ending with Manage macros...; the group's corners Manage (left) and the list (right), as LexPen's and
  the Bookmarks group's.
- F1 lists every macro by its name and folder, with its key.
- A macro on the ribbon: `macro.run` with the macro's id as a button (Change the ribbon: dragged from F1 as any action),
  with the macro's name and icon.
- While a macro runs: the status line says which; Esc stops it. An error stops it: the line and why on the status
  line (a warning) and in the Log.

### 3.8 Tests

- Unit (Jint, as the other page tests): every statement copied keeps LexPen's tests' results; `for each`; an item's
  fields and its text, a list's index (1, its last, past its end), `count`, `prop`; the functions on a path (on an
  item and on a relative path read as text), `quoted` and `unquoted` both ways; a size divided to KB and MB with `round`
  to 0 and 3 decimals, `padleft`, `padright`; the system variables from a pane state made for it; a left-out statement
  refused when read.
- Unit (host): `run` with each option builds the start it should (program, arguments, folder, window, verb); the
  tree's file read, written and read back; a broken file counts as empty and stays as it is.
- In the test copy: Run a program with `notepad.exe` and the focused file: Notepad opens it; a key given and pressed;
  a `for each` over three selected files with `wait`; a macro in a folder two deep, run from the ribbon's list and
  from F1; Manage macros floated, docked and floated again; a failing program: the warning and the Log line.

## 4. Open questions

None.
