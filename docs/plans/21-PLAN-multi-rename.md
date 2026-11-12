# Plan 21: Renaming many at once, parts of names, and companion files

Status: draft 2026-11-12, revised 2026-11-12; not started; see Status.

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

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Rename dialog | F2 with several selected: the preview (every item and its new name, live; conflicts marked); OK, Cancel | -- | 3.1 |
| What changes | name, extension or both | Rename dialog | 3.2 |
| Pattern | tokens: the old name and parts of it, the extension, the parent folder, a counter, created and modified date and time in a chosen format; the syntax a setting (xplorer2's by default) | Rename dialog | 3.3 |
| Token list | every token with what it gives for the first item, picked to insert it; date formats chosen there | Pattern | 3.3 |
| Find and replace | text or regular expression, case, first or all | Rename dialog | 3.3 |
| Case | lower, upper, first letters | Rename dialog | 3.3 |
| A part changed | a part of the name or extension marked (in the first item's name, or by position from the start or the end) and replaced in every item: cde to klm in abcdefg.hij | Rename dialog | 3.3 |
| Dates in names | a date or date and time in the names found and changed: another format, shifted, the file's own date, or one part of it (year, month, day, hour, ...) | Rename dialog | 3.3 |
| One operation | all renames through one IFileOperation, undoable in Windows; swaps through a name in between | Rename dialog | 3.4 |
| Saved renames | a rename's settings saved by name and used again, for every project (renames.json) | Rename dialog | 3.3 |
| Companions in the dialog | listed under their file, renamed along as the setting says | Rename dialog | 3.5 |
| Tests | see 3.6 | -- | 3.6 |

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
- **Token syntax**: a setting, renameTokens (Settings > Panes): xplorer2's (the default) or Total Commander's ([N],
  [C], [E], [N1-3], [YMD]). Both write the same tokens; only how they are written differs. [xplorer2's syntax: not yet
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
