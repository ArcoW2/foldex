# Plan 21: Renaming many at once, parts of names, and companion files

Status: executed (2026-11-12); see As built.

- 2026-11-12: draft, at the user's request: F2 with several items selected, an extended renaming of parts of names,
  and files with the same name and another extension renamed along (a setting, on by default).
- 2026-11-12: revised: the token syntax is a setting, xplorer2's by default.
- 2026-11-12: revised: companions renamed in place without a question, highlighted while the name is edited.
- 2026-11-12: revised: rename settings can be saved by name, for every project.
- 2026-11-12: revised: companions for the rename in place (F2 on one file) built outside this plan, with Shift+Enter
  doing the other of the setting; here they remain for the Rename dialog.
- 2026-11-12: revised: a part of a name or extension changed (cde to klm in abcdefg.hij); a date or time in names
  changed, or any part of it; tokens for the parent folder and the dates and times in a chosen format, picked from a
  list; a preview of every new name before anything is renamed, as xplorer2's.
- 2026-11-12: executed.

Builds on the rename in place (F2, `web/rename.js`) and Foldex's file operations (`Shell/FileOps.cs`). The number in
the file name is the priority; rename to reorder.

## 1. What this is about

F2 renames one item in place. With several items selected it renames only the focused one, so renaming a set of files
(photos, invoices, a series) means doing them one by one. There is also no way to change part of many names at once
(a prefix, a date, a word, the case). And renaming one file leaves its companions behind: photo.jpg renamed to
beach.jpg leaves photo.xmp and photo.raw under the old name.

## 2. The solution, in brief

F2 with more than one item selected opens a Rename dialog. Its list is the preview, as xplorer2's: every item with its
new name beside it, updated as you type, conflicts marked; nothing is renamed until OK, which renames them all in one
operation that Windows can undo. What changes is chosen per part (the name, the extension, or both) and how: a part of
it changed (cde in abcdefg.hij made klm), a date or time in the names changed (or only its year, its hour, ...), a
pattern with tokens (the old name or a part of it, the parent folder, a counter, the dates and times in a chosen
format), picked from a list as well as typed, find and replace (text or a regular expression), or the case. Renaming
one file, in place or in the dialog, also renames the files beside it with the same name and another extension; a
setting turns that off.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Rename dialog | F2 with several selected: the preview, live, conflicts marked; Rename, Cancel | 3.1; 6 |
| What changes | name, extension or the whole name | 3.2 |
| Pattern | tokens in xplorer2's syntax (the default) or Total Commander's (renameTokens) | 3.3; 6 |
| Token list | a drop-down of every token with what it gives for the first item; dates in each format | 3.3; 6 |
| Find and replace | text or regular expression, case counting or not, the first or every match | 3.3 |
| Case | lower, upper, first letters up; alone, or after another change | 3.3 |
| A part changed | marked in the first item's name or by position, from the start or the end | 3.3 |
| Dates in names | found (year first or day first, with a time), written in a format, shifted, or the file's own date | 3.3; 6 |
| One operation | every rename in one IFileOperation; names taking another's place through a name in between first | 3.4; 6 |
| Saved renames | Predefined and Save, renames.json for every project | 3.3 |
| Companions in the dialog | listed in italics, renamed along as the setting says (a box in the dialog) | 3.5 |
| Tests | unit and test copy | 3.6; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

Built outside this plan: companion files for the rename in place (F2 on one file): the setting renameCompanions
(on by default), Shift+Enter doing the other, the companions that go along highlighted while the name is edited
(`web/rename.js`).

## 3. Details

### 3.1 The Rename dialog

- F2 (item.rename) with more than one item selected opens it; with one, the rename in place stays as it is. Folders
  and files alike, in any pane on disk; in a scrap too, items of several folders each renamed in their own folder.
- The preview, as xplorer2's: a list of every item, its name now and its new name, in the order the pane shows them
  (the counter follows it). The new names follow every change at once; nothing is renamed before OK.
- Marked: a new name that two items would get, a name that exists in that folder already (and is not being renamed
  away), a name Windows refuses (\ / : * ? " < > |, a dot or a space at the end). OK is off while any is marked.
- An unchanged name is shown as unchanged and left alone.
- Keyboard: the dialog opens with the keyboard in its first field; Enter is OK, Esc cancels, as the Find dialog.

### 3.2 What changes

- The name (without the extension), the extension, or the whole name. A changed extension asks first, once for all,
  as the rename in place does.

### 3.3 How

- **A part changed**: a part of the name or of the extension, marked in the first item's name (with the mouse or Shift
  and the arrows) or given by position (from the start or from the end, and how many characters), replaced in every
  item at the same place by a text or by tokens: abcdefg.hij with cde marked and klm typed gives abklmfg.hij. The same
  text wherever it is: find and replace (below).
- **Dates in names**: a date, or a date and time, in the names (20261112, 2026-11-12, 12-11-2026, 2026-11-12 14.30)
  found and changed: written in another format, shifted (days, hours), replaced by the item's own created or modified
  date, or only one part of it changed (the year, the month, the day, the hour, ...). [The date forms recognised: not
  yet checked against the names in use; a list in the dialog.]
- **Pattern**: the new name built from tokens: the old name, a part of it (characters from to), the extension, the
  parent folder's name (and the one above it), a counter (start, step, digits), the created and the modified date and
  time, each in a format chosen (yyyy-MM-dd, yyyyMMdd, HHmm, ...).
- **Token list**: beside the pattern a list of every token with what it gives for the first item; choosing one puts it
  in at the cursor, with its format chosen there for a date or time, so nothing has to be remembered. Typing tokens
  stays possible.
- **Token syntax**: a setting, renameTokens (Settings > Panes): "dollar", xplorer2's (the default), or "bracket",
  Total Commander's ([N], [C], [E], [N1-3], [YMD]); the setting and its choices name no other program (Dollar
  tokens, Bracket tokens). Both write the same tokens; only how they are written differs. [xplorer2's syntax: not yet
  checked; read from its manual before building.]
- **Find and replace**: a text or a regular expression, case or not, the first or every match; the replacement may
  use the regular expression's groups.
- **Case**: lower, upper, the first letter of each word.
- The ways combine in order (for instance find and replace, then the case); the list shows the result.
- **Saved renames**: the dialog's settings (what changes, the ways and their values) saved under a name and chosen
  again from a list, as the Find dialog's Predefined; kept for every project, in renames.json in the data folder
  (as searches.json), every window told when it changes.

### 3.4 Renaming

- All renames in one IFileOperation (`FileOps`, kind `rename` with a list), so Windows shows one progress and can undo
  them as one (Ctrl+Z in Explorer).
- Names that swap (a to b, b to a) or move in a chain go through a name in between [not yet checked whether
  IFileOperation orders them itself].
- Panes, scraps and the rename's focus follow the moved items as for a single rename (`FileOps` reports old and new
  paths).

### 3.5 Companion files

- Renaming a file (in place or in the dialog) whose name, without its extension, changes also renames the files in
  the same folder with that same name and another extension: photo.jpg to beach.jpg takes photo.xmp and photo.raw
  to beach.xmp and beach.raw. Only the part before the last dot counts (report.tar.gz's companions are report.tar.*).
- Only a change of the name: a changed extension takes no companions along.
- A setting, renameCompanions (Settings > Panes), on by default.
- A companion that would collide (beach.xmp exists already) is not renamed; the rename of the file itself still goes.
  In the dialog companions are listed under their file, marked as companions.
- In place (F2; built outside this plan, `web/rename.js`): while the name is edited, the companions that go along are
  highlighted in the pane; they are renamed with the file, without a question, and the status line names them.
  Shift+Enter does the other of the setting (holding Shift shows it in the highlight).
- Folders have no companions.

### 3.6 Tests

- Unit (the new names as pure functions, under Jint): each token (the parent folder, the dates in each format); a
  counter in the pane's order; a part changed by position (abcdefg.hij, cde to klm: abklmfg.hij) and from the end, in
  the name and in the extension; dates in names found in each form, reformatted, shifted, replaced by the file's date,
  one part changed; find and replace with text and with a regular expression and its groups; the case; ways combined; a saved rename back as it was saved; conflicts (two the same, an existing name, a refused name); companions found, their new names, a
  collision left out, the setting off.
- In the test copy: F2 on three selected files, a token picked from the list, the preview following each change and
  nothing renamed before OK; a pattern with a counter, OK, the files renamed, the pane focused on
  the renamed focus; a swap of two names; Esc leaves all as they were; F2 on photo.jpg with photo.xmp beside it, both
  renamed, photo.xmp highlighted while the name is edited, and with the setting off only the jpg (nothing
  highlighted).

## 4. Open questions

None.

## 6. As built

**Where.** `web/renamer.js` (the new names as pure functions: `splitName`, `formatDate`, `findDate`, `expandTokens`,
`renameOne`, `nameRefusal`, `renamePreview`), `web/renamedialog.js` (the dialog), `web/actions.js` (F2: in place for
one, the dialog for more), `Shell/FileOps.cs` (`StartRenames`, kind renameMany), `RenamesFile.cs` (renames.json),
`MainForm` (the ops `renameMany`, `renamesSave`), the setting renameTokens (Settings > Contents > Items).

**Decided while building.**

- The dialog follows xplorer2's: How (A new name from a pattern, Change a part, Replace the first match, Replace every
  match, The date in the name, Change the case), Change (the name, the extension, the whole name), the pattern or what
  to put in, Find with Regular expression and Case counts, Then the case (after any other way), the companions box,
  Predefined and Save, the preview with a count, Rename and Cancel. Only the fields of the way chosen are shown.
- **xplorer2's syntax** as its help gives it: `$B` the name, `$1` / `$003` a counter (its start and digits as written),
  `$[first:length]` a part (below 0 from the end), `${Column}` a column's value, `$$` a $. Foldex adds `$E` (the
  extension), `$N` (the whole name), `$P` (the parent folder), `$G` (the folder above it) and a format after a column:
  `${Date taken:yyyyMMdd}`. **Total Commander's**: `[N]`, `[E]`, `[P]`, `[G]`, `[C]` (start, step and digits as fields
  in the dialog), `[N2-5]`, `[N-3,3]`, `[Y] [M] [D] [h] [m] [s]` (the date modified), `[=Column:format]`, `[[`.
- **Columns by their titles** as their headers show them (Date taken, Authors, Title, Camera model, Dimensions, Date
  modified, ...); a date column with a format gives the date in it, else the value as the column shows it.
- **The token list** is a drop-down in the dialog, not one of the page's menus: those open under a modal dialog.
  Each token is shown with what it gives for the first item; a date has a choice of formats (yyyy-MM-dd, yyyyMMdd,
  dd-MM-yyyy, yyyy-MM-dd HH.mm, yyyyMMdd_HHmmss, yyyy-MM, HHmm); it goes in where the cursor was in the pattern.
- **A part** marked in the first item's name (a read-only box: mark with the mouse or Shift and the arrows) sets its
  place and length, and switches to Change a part; the place can also be typed, from the start or the end.
- **Dates in names**: the first date found, year first (2026-11-12, 2026_11_12, 2026.11.12, 20261112) or day first
  (12-11-2026), with a time after it or not (14.30, 14:30:05, 143005); written in the format given, shifted by days
  and hours, or replaced by the file's date taken, modified or created. One part changed: a format with that part
  written out (2025-MM-dd keeps the month and day and writes 2025). An impossible date (a month 13) is no date.
- **Names taking another's place** (a to b while b goes to a, or a chain): those go to a name in between first
  (`~foldex~<guid>~<name>`) in an operation of their own, then everything to its new name; the moves are reported
  from the old name to the new one. Windows' undo then has two steps for such a rename.
- **Conflicts**: a name Windows refuses (\ / : * ? " < > |, a dot or a space at the end, empty), two the same in one
  folder, a name an item there has that is not renamed away; Rename is off while any is marked. A changed extension
  asks once for all. After renaming the pane keeps the renamed items selected under their new names.

**Tests.** Unit (`RenamerTests`): xplorer2's tokens (parent folder, counter with start and digits, parts, a column
with a format, $$); Total Commander's (counter with start, step and digits, parts, the date modified's parts, a
column); a part changed (abcdefg.hij, cde made klm: abklmfg.hij), from the end, in the extension, inserted; find and
replace with text (first, all, case) and a regular expression with its groups; the date in the name rewritten,
day first, shifted, from the date taken, none, an impossible one; the case alone and after another way; the preview's
marks (two the same, a refused name), a name renamed away free. In the test copy with real keys: F2 on several
selected opens the dialog (nothing renamed); the preview following what is typed; the token list with its examples
and a token put in at the cursor; Esc leaves everything as it was; a part marked in the first name and renamed; a
pattern with the parent folder and a counter, Enter renames; the date in a name rewritten with its .xmp companion
along; a saved rename in renames.json; two names swapped through the host, their contents showing they swapped, the
moves reported both ways.

**Not tested.** Windows' undo of a rename in Explorer (Ctrl+Z there); a rename in a scrap of items of several folders
(each is renamed in its own folder by the same operation).
