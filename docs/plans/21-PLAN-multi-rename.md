# Plan 21: Renaming many at once, parts of names, and companion files

Status: draft 2026-11-12, revised 2026-11-12; not started; see Status.

- 2026-11-12: draft, at the user's request: F2 with several items selected, an extended renaming of parts of names,
  and files with the same name and another extension renamed along (a setting, on by default).
- 2026-11-12: revised: the token syntax is a setting, xplorer2's by default.
- 2026-11-12: revised: companions renamed in place without a question, highlighted while the name is edited.
- 2026-11-12: revised: rename settings can be saved by name, for every project.

Builds on the rename in place (F2, `web/rename.js`) and Foldex's file operations (`Shell/FileOps.cs`). The number in
the file name is the priority; rename to reorder.

## 1. What this is about

F2 renames one item in place. With several items selected it renames only the focused one, so renaming a set of files
(photos, invoices, a series) means doing them one by one. There is also no way to change part of many names at once
(a prefix, a date, a word, the case). And renaming one file leaves its companions behind: photo.jpg renamed to
beach.jpg leaves photo.xmp and photo.raw under the old name.

## 2. The solution, in brief

F2 with more than one item selected opens a Rename dialog: every item with its new name beside it, updated as you
type, conflicts marked, and OK renames them all in one operation that Windows can undo. What changes is chosen per
part (the name, the extension, or both) and how: a pattern with tokens (the old name or a part of it, a counter, a
date), find and replace (text or a regular expression), the case, or an edit of a range of characters (insert,
remove, replace at a position, from the start or the end). Renaming one file, in place or in the dialog, also renames
the files beside it with the same name and another extension; a setting turns that off.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Rename dialog | F2 with several selected: the items with their new names, live; conflicts marked; OK, Cancel | -- | 3.1 |
| What changes | name, extension or both | Rename dialog | 3.2 |
| Pattern | tokens: the old name and parts of it, the extension, a counter, dates, the folder; the syntax a setting (xplorer2's by default) | Rename dialog | 3.3 |
| Find and replace | text or regular expression, case, first or all | Rename dialog | 3.3 |
| Case | lower, upper, first letters | Rename dialog | 3.3 |
| Parts of names | insert, remove or replace characters at a position, counted from the start or the end | Rename dialog; open question 1 | 3.3 |
| One operation | all renames through one IFileOperation, undoable in Windows; swaps through a name in between | Rename dialog | 3.4 |
| Saved renames | a rename's settings saved by name and used again, for every project (renames.json) | Rename dialog | 3.3 |
| Companion files | same name, another extension, renamed along without a question, highlighted during F2; setting renameCompanions (default on) | -- | 3.5 |
| Tests | see 3.6 | -- | 3.6 |

## 3. Details

### 3.1 The Rename dialog

- F2 (item.rename) with more than one item selected opens it; with one, the rename in place stays as it is. Folders
  and files alike, in any pane on disk; in a scrap too, items of several folders each renamed in their own folder.
- A list of every item: its name now and its new name, in the order the pane shows them (the counter follows it).
  The new names follow every change at once.
- Marked: a new name that two items would get, a name that exists in that folder already (and is not being renamed
  away), a name Windows refuses (\ / : * ? " < > |, a dot or a space at the end). OK is off while any is marked.
- An unchanged name is shown as unchanged and left alone.
- Keyboard: the dialog opens with the keyboard in its first field; Enter is OK, Esc cancels, as the Find dialog.

### 3.2 What changes

- The name (without the extension), the extension, or the whole name. A changed extension asks first, once for all,
  as the rename in place does.

### 3.3 How

- **Pattern**: the new name built from tokens: the old name, a part of it (characters from to), the extension, a
  counter (start, step, digits), the date modified or taken, the folder's name.
- **Token syntax**: a setting, renameTokens (Settings > Panes): xplorer2's (the default) or Total Commander's ([N],
  [C], [E], [N1-3], [YMD]). Both write the same tokens; only how they are written differs. [xplorer2's syntax: not yet
  checked; read from its manual before building.]
- **Find and replace**: a text or a regular expression, case or not, the first or every match; the replacement may
  use the regular expression's groups.
- **Case**: lower, upper, the first letter of each word.
- **Parts of names**: at a position counted from the start or from the end: insert a text, remove a number of
  characters, or replace them. What "partial parts" should cover beyond this: open question 1.
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
- In place (F2): while the name is edited, the companions are highlighted in the pane, so it is clear they go along;
  they are renamed with the file, without a question, and the status line names them.
- Folders have no companions.

### 3.6 Tests

- Unit (the new names as pure functions, under Jint): each token; a counter in the pane's order; find and replace
  with text and with a regular expression and its groups; the case; parts at positions from the start and the end;
  ways combined; a saved rename back as it was saved; conflicts (two the same, an existing name, a refused name); companions found, their new names, a
  collision left out, the setting off.
- In the test copy: F2 on three selected files, a pattern with a counter, OK, the files renamed, the pane focused on
  the renamed focus; a swap of two names; Esc leaves all as they were; F2 on photo.jpg with photo.xmp beside it, both
  renamed, photo.xmp highlighted while the name is edited, and with the setting off only the jpg (nothing
  highlighted).

## 4. Open questions

1. **"Extended renaming (partial parts renamed)".** To be answered when this plan is taken up. This plan reads it as
   editing a range of characters (insert, remove, replace at a position from the start or the end) and the tokens
   for parts of the old name; or is it something else (for instance renaming a selected part of the name, the same
   part in every file)?
