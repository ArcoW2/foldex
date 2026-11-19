# Plan 20: Extended search options

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request: the Find dialog's Containing text and Additional rules, split off plan 06.

Builds on plan 06 (the scrap and the Find dialog) and plan 32 (filter sets: the lines, their engine and their
editor). The number in the file name is the priority; rename to reorder.

## 1. What this is about

Plan 06's Find dialog finds files and folders by name only. A better scrap needs more: files containing a text, and
rules on size, attributes, dates and any other field, as xplorer2's dialog has under Containing Text and Additional
Rules. And once a scrap holds the files containing a text, looking at one of them should show where that text is, not
just the file.

## 2. The solution, in brief

The Find dialog gets a Containing text with its options (case, whole words; normal, verbatim or regular expression;
known files or all files; by default only the start of a file) and Additional rules that are a filter set of plan
32: the same lines, brackets, and, or and not, the same engine and line editor. Plan 32's fields get one more,
Contents: a line on it tests whether a file holds a text, in a search and in a pane's filter alike. The rules are
tested on what the name search finds, the text on what passes them. Both are kept with a
scrap's search and in saved searches. F3 on a file in a scrap whose search has a text opens its preview already
searching that text, on the first match; in any preview Foldex draws (PDF and markdown included) a find bar after
LexPen's searches with Ctrl+F, F3 and Shift+F3.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Containing text | the text and its list; case sensitive, whole words; normal (the filter's wildcards), verbatim or regular expression | -- | 3.1 |
| Which files | known files or all files (Word, PDF, other binaries); the encoding found by itself | -- | 3.1 |
| Only the start | a check (on) and a size in the dialog; its default a setting (2 MB) | -- | 3.1 |
| Additional rules | a filter set (plan 32): its lines, brackets, and / or / not, its engine and line editor | -- | 3.2 |
| Contents field | a field of plan 32's lines: the file holds a text, in an encoding (automatic by default); slow (the tortoise); in Find and in a pane's filter | Which files | 3.2 |
| Contents, more | the text kind's other conditions on Contents: wildcards, a regular expression | Contents field | 3.2 |
| Kept | all of it in a scrap's search and in Predefined | -- | 3.3 |
| Find in the preview | a find bar in Foldex's own preview, after LexPen's: Ctrl+F, F3, Shift+F3, case, whole word, regular expression; PDF's text too; a warning where a preview cannot be searched | -- | 3.5 |
| F3 from a text scrap | the floating preview opened searching the scrap's text, on its first match, reading as far as the search did | Containing text; Find in the preview | 3.5 |
| Tests | see 3.4 | -- | 3.4 |

## 3. Details

### 3.1 Containing text

- In the Tab order right after Named (plan 06 3.3), before its own options.
- The text, with a list of earlier ones; Case sensitive; Whole words.
- How the text is read, one of three:
  - **Normal**: the wildcards of a filter's text (plan 32 3.1, `filters.js` `wildTest`): `*` any run of characters,
    `?` one character, `;` between alternatives (`TODO;FIXME`). In a file a match lies within one line and may start
    anywhere in it (a filter matches a whole name). Unlike a filter, `,` is no separator here: a text often holds one.
  - **Verbatim**: every character is itself; none has a meaning of its own.
  - **Regular expression** (xplorer2's "RE").
- **As LexPen does**: the page builds one regular expression from the text, its mode and Whole words, and the search
  runs that (LexPen's `FolderSearch`: "the page builds the regular expression, so the page and this agree on what
  matches"). The preview's find bar (3.5) gets the same expression, so it lights what the search found.
- **Which files**, one of two:
  - **Known files** (the default): the files Foldex can read as text (text, code, markdown, CSV, HTML and the like;
    the kinds of its own preview, plan 04). Fast.
  - **All files**: also Word, PDF and other binaries. Their text is read through Windows' IFilter where one is
    installed for the type [which ones are on a usual PC: not yet checked]; any other file is searched in its bytes.
    Slower; its label says so.
- **The encoding** is found by itself, as xplorer2's Default: a BOM when there is one, else UTF-8 when the bytes are
  valid UTF-8, else the system's code page. No encoding list.
- **Only the start of a file**: a check and, after it, a size (in KB or MB); a file is searched only up to there.
  The check starts on and the size at a new setting (Settings, Contents; 2 MB as shipped); both can be changed for
  one search in the dialog.
- Searched on the files that pass the name and the rules (3.2), last, as it is the slowest; folders never match a
  text. The text check is ported from LexPen's `FolderSearch.cs` (`ReadText`: what cannot be text skipped with Known
  files), with the encoding above and the start limit instead of its fixed 10 MB.

### 3.2 Additional rules

- The rules are a filter set of plan 32 (3.1, 3.2 there): lines, each testing one field for folders, files or both,
  with the conditions of its kind; And, Or, Not, brackets, worked out as there. Nothing of it is made twice: the lines
  are kept in the same shape, tested by the same engine (`filters.js`, `filterTestOf`) and edited with the same line
  editor (Manage filters' line part, 3.3 there), in the Find dialog under the text.
- In the dialog: the lines of the set, a row each as Manage filters shows them; a double click edits one, Add, Change,
  Remove, Up, Down, brackets, as there. The line being edited is Manage filters' line editor: Folders and Files, the
  field, its conditions, And / Or, Not.
- **Contents**, a new field in plan 32's field list (so in Manage filters too): its value is the file itself, and a
  line on it tests whether the file holds a text. First as a text and an encoding: Contains, the text, and Encoding
  (Automatic, as 3.1, by default; or one chosen). Later the text kind's other conditions on it (matches wildcards,
  matches a regular expression; plan 32 3.1). A folder: the line does not apply to it (plan 32's rule: left out).
- It is a slow field (the tortoise, plan 32 3.1): the page's engine asks the host whether a file holds the text, as
  it asks for a Windows property, and the item waits for the answer. The host's check is the one of 3.1 (Known files
  or All files, Only the start, the encoding), so a Contents line and the Containing text find the same.
- Containing text stays in the dialog as the quick way; Contents is for what it cannot say: two texts, a text in
  some files only, a file without a text (`Not Contents contains "TODO"`).
- Where they are tested: the scrap's page tests every item the name search streams to it with the set (the same
  engine as a pane's filter, so a slow field is read as there); what passes goes back to the host for the text check
  (3.1). One engine, so a rule means the same in a filter and in a search; the cost is a round trip per batch of
  results. Not chosen: the engine again in C# beside the page's (two engines that can come to differ), or Everything's
  and the index's own size and date tests (a third way to read the same rule).

### 3.3 Kept

- Part of a scrap's search (plan 06 3.4) and of a saved search (Predefined), with Find's last search (`searches.json`
  `last`): the text and all its options of 3.1, the start size, the rules.

### 3.4 Tests

- Unit: the expression built from a text in each mode, with and without Whole words and Case sensitive; the encodings
  (BOM, UTF-8, the code page); only the start (a match before and after the limit); Known files skipping a binary,
  All files reading it; rules combined as a filter set is (plan 32's tests reused); a Contents line, its Not and its
  encoding, on files made for it; a Normal text with `*`, `?` and `;`.
- In the test copy, Contents as a pane's filter: a folder filtered on a text, the tortoise, the files appearing as the
  host answers.
- In the test copy: a search with a text and a size rule into a scrap; Search again keeps both; a Word file and a PDF
  found with All files and not with Known files.
- Find in the preview (3.5), unit where the page allows, else in the test copy over CDP: a text, a code file, a
  markdown file and a PDF each searched with each option; F3 and Shift+F3 through the matches and past the end; Esc
  closes the bar, a second Esc the F3 window; Ctrl+F on an image: the warning on the status line.
- F3 from a text scrap: a scrap searched for a text, F3 on a file in it: the floating window has the keyboard, the bar
  holds the text with the scrap's options, the first match shown and lit; a match past previewTextKB but within the
  search's start limit shown; F3 the next one; Ctrl+F, another text, F3: its matches. F3 on a file of a scrap without a
  text, and on an image in a text scrap: the preview as now, no bar.

### 3.5 Find in the preview, and F3 from a text scrap

- **LexPen is the model.** LexPen's find bar (`..\LexPen\web\find.js`) already searches its preview as well as its
  editor (`previewMatches`). Foldex's preview gets that bar, find row only: a preview is read-only, so no replace row.
  Its parts as LexPen's: the text, its count, Aa (case), W (whole word), .* (regular expression), previous, next,
  close; Enter / F3 next, Shift+Enter / Shift+F3 previous, Esc closes the bar. Where Foldex differs: no replace row,
  and no "one search for both panes" (a preview has one page).
- In every preview Foldex draws itself (plan 04: text, code, markdown, HTML, CSV and the like), docked or floating,
  and in PDF: Foldex's PDF preview draws its pages without text, so it gets pdf.js's text layer over them, for the
  bar to find and light the text. A preview by Windows' handler (a native window over the page) and an image, video
  or sound have nothing to search: Ctrl+F there gives a warning on the status line (this preview cannot be searched).
- Keys: a pane page sends every key to its window (`pane.js`), and the window's Ctrl+F is the Find dialog, its F3
  `preview.float` (not enabled with a preview active). In a preview page Ctrl+F, F3 and Shift+F3 are the page's own,
  taken before `pane.js` passes them on. Esc closes the bar first; with no bar open it closes an F3 window, as now.
- F3 with no search yet: the bar opens, as LexPen's Find next does with an empty or hidden bar.
- **F3 from a text scrap.** F3 on a file in a scrap whose search has a Containing text (3.1) opens the floating
  preview (plan 14 3.5; it takes the keyboard) with the bar open, holding the scrap's expression (3.1) with its case,
  and scrolled to the first match. From there it is the bar of the paragraph above: F3 on, Ctrl+F for another text.
  A scrap without a text, or a file whose preview cannot be searched: F3 as now.
- Such a preview reads the file as far as the search did: up to the search's start limit, or the whole file (up to
  Show all's limit) when the search read it whole, not previewTextKB; so a match the search found is in what it shows.
- The bar searches with JavaScript's regular expressions, the search ran .NET's. A regular expression only .NET reads
  the same way may find nothing in the preview: the bar shows no match, as for any text.

## 4. Open questions

None.
