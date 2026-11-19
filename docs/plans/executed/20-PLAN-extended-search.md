# Plan 20: Extended search options

Status: executed; see Status and 6 (As built).

- 2026-11-12: draft, at the user's request: the Find dialog's Containing text and Additional rules, split off plan 06.
- 2026-11-19: partly executed: stage 1 (Containing text, the preview's find bar, F3 from a text scrap, the scrap
  while it fills, Sort when done).
- 2026-11-19: executed.

Builds on plan 06 (the scrap and the Find dialog) and plan 32 (filter sets: the lines, their engine and their
editor). Built in two stages around plan 36 (filter results in the folder cache, the filter engine run by the host):
first everything that is not a filter (the text, the preview's find bar, the scrap while it fills), then, on top of
plan 36, the rules and the Contents field, tested by the host's engine. The number in the file name is the priority;
rename to reorder.

## 1. What this is about

Plan 06's Find dialog finds files and folders by name only. A better scrap needs more: files containing a text, and
rules on size, attributes, dates and any other field, as xplorer2's dialog has under Containing Text and Additional
Rules. And once a scrap holds the files containing a text, looking at one of them should show where that text is, not
just the file.

## 2. The solution, in brief

The Find dialog gets a Containing text with its options (case, whole words; normal, verbatim or regular expression;
known files or all files; by default only the start of a file) and Additional rules that are a filter set of plan
32: the same lines, brackets, and, or and not, the same engine and line editor. Plan 32's fields get one more,
Contents: a line on it tests whether a file holds a text, known files or all files, in a search and in a pane's
filter alike, with a warning that it can be very slow. The rules are tested by the host's filter engine (plan 36)
on what the name search finds, the text on what passes them. Every item found shows in the scrap at once, at its
end; when the search ends the scrap is sorted once by its own sort (none: kept as found), unless the Find dialog's
Sort when done (its default a setting, on) is unchecked. A search never holds the window up: Stop works at once, and
it goes on wherever the panes go. Both are kept with a scrap's search and in saved searches. F3 on a file in a scrap whose search has a text opens its preview already
searching that text, on the first match; in any preview Foldex draws (PDF and markdown included) a find bar after
LexPen's searches with Ctrl+F, F3 and Shift+F3.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Containing text | the text and its list; case sensitive, whole words; normal (the filter's wildcards), verbatim or regular expression | 3.1; 6.1 |
| Which files | known files or all files (Word, PDF, other binaries: Windows' IFilter, else the bytes); the encoding found by itself | 3.1; 6.1 |
| Only the start | a check (on) and a size in the dialog; its default a setting (2048 KB) | 3.1; 6.1 |
| Found at once | each batch added at the scrap's end, not sorted in; sorted once at the end; a scrap without a sort keeps the order found | 3.6; 6.2 |
| Sort when done | a check at the bottom of the Find dialog; its default a setting (on) | 3.6; 6.2 |
| Responsive | the window answering while a search runs; Stop at once; a search independent of the panes | 3.6; 6.2 |
| Kept: the text | the text, its options, Sort when done in a scrap's search, Find's last search and Predefined | 3.3; 6.1 |
| Find in the preview | a find bar in Foldex's own preview, after LexPen's: Ctrl+F, F3, Shift+F3, case, whole word, regular expression; PDF's text too; a warning where a preview cannot be searched | 3.5; 6.3 |
| F3 from a text scrap | the floating preview opened searching the scrap's text, on its first match, reading as far as the search did | 3.5; 6.3 |
| Tests, stage 1 | see 3.4 and 6.4 | 3.4; 6.4 |
| Additional rules | a kept filter set (plan 32) chosen in the dialog, its lines shown; tested by the host's engine during the search | 3.2; 6.5 |
| Contents field | a field of plan 32's lines: the file holds a text, in an encoding (automatic by default), known files or all files; in Find and in a pane's filter; the tortoise and a warning that it can be very slow | 3.2; 6.5 |
| Contents, more | contains, matches wildcards, matches a regex | 3.2; 6.5 |
| Kept: the rules | the rules in a scrap's search, Find's last search and Predefined | 3.3; 6.5 |
| Tests, stage 2 | see 6.5 | 3.4; 6.5 |

### Not yet built

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
- **Contents**, a new field in plan 32's field list, so in a pane's filter (Manage filters) as much as in Find's
  rules: its value is the file itself, and a line on it tests whether the file holds a text. First as a text and an
  encoding: Contains, the text, and Encoding (Automatic, as 3.1, by default; or one chosen). Later the text kind's
  other conditions on it (matches wildcards, matches a regular expression; plan 32 3.1). A folder: the line does not
  apply to it (plan 32's rule: left out).
- The line has its own **Known files / All files** (3.1's choice; Known files by default), as a filter has no Find
  dialog to take it from: with Known files only the files Foldex reads as text are opened, any other file does not
  pass; with All files Word, PDF and other binaries are read too. Only the start of a file always holds for it, at
  the setting's size (3.1).
- It is a slow field (the tortoise, plan 32 3.1), and slower than any other: every file the line is tested on is
  opened and read. So it says more than the tortoise does: in the field list its tooltip, and under a line using it a
  warning, that it can be very slow (in a large folder, on a share, and most of all with All files). Its value is
  read by the host's engine (plan 36 3.3) through the text check of 3.1, so a Contents line and the Containing text
  find the same; in a pane's filter its results are kept in the folder cache and worked out in the background as any
  filter's (plan 36).
- Containing text stays in the dialog as the quick way; Contents is for what it cannot say: two texts, a text in
  some files only, a file without a text (`Not Contents contains "TODO"`).
- Where they are tested: in the host, during the search, by plan 36's engine (`filters.js` run by the host): each
  item the name search finds is tested with the set before it is handed to the scrap, and the text check (3.1) runs
  on what passes. One engine, so a rule means the same in a filter and in a search, and no round trip to the page.
  Not chosen: Everything's and the index's own size and date tests (a second way to read the same rule).

### 3.3 Kept

- Part of a scrap's search (plan 06 3.4) and of a saved search (Predefined), with Find's last search (`searches.json`
  `last`): the text and all its options of 3.1, the start size, the rules, Sort when done (3.6).

### 3.4 Tests

- Unit: the expression built from a text in each mode, with and without Whole words and Case sensitive; the encodings
  (BOM, UTF-8, the code page); only the start (a match before and after the limit); Known files skipping a binary,
  All files reading it; rules combined as a filter set is (plan 32's tests reused); a Contents line, its Not and its
  encoding, on files made for it; a Normal text with `*`, `?` and `;`.
- In the test copy, Contents as a pane's filter: a folder filtered on a text, the tortoise and the warning under the
  line, the files appearing as the host answers; with Known files a .docx holding the text does not pass, with All
  files it does.
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

### 3.6 While it searches and filters

- **Found at once.** The host hands what it found over in batches while it runs (`FileSearch.Run`, every 250 ms);
  each batch shows in the scrap at once, added at its end, without waiting for the search to end. Today every batch
  filters and sorts the whole scrap again (`ScrapView.searchChanged`), so items already there move while you look at
  them and the work grows with the scrap: a batch is only added at the end now, tested only against the scrap's own
  filter and search bar (the rules, 3.2, are tested in the host before it); nothing already shown moves, the focus
  and the selection stay.
- **Sorted at the end.** When the search ends (done or stopped) the scrap is sorted once by the sort it has (its
  columns' sort, plan 28 3.4). A scrap without a sort (its sort list empty: a new scrap's, or emptied in the Sort
  window) keeps the order found. Today a scrap without a sort is sorted by name (`byName`): for a scrap, an empty sort
  means its own order (`scrapMerge`'s). A click on a title sorts by that column, as in any list (`sortAfterClick`).
- **Sort when done**, a check at the bottom of the Find dialog, on the row of its buttons (beside Clear): checked,
  the scrap is sorted at the end as above; unchecked, it keeps the order found, whatever its sort, until a click on a
  title or the Sort window sorts it. Its default is a new setting (Settings, Contents, with the search's other
  settings; on as shipped); the check is kept with the scrap's search, Find's last search and a saved search (3.3),
  so Search again and a Predefined search bring back what they had.
- **Responsive.** The search runs in the host, never in the page (as now); the text check (3.1) and the rules'
  slow fields as well. The page does only the small work per batch above, so keys, the mouse, other panes and their
  folders keep answering while a search runs, however many items come.
- **Stop** (the scrap's head, its menu) ends the search at once: the host's walk, the index's query, the text checks
  and the rules' questions still waiting are all dropped (the search's cancellation, `FileSearch`'s
  CancellationToken, reaches each of them); what was found stays, and is sorted (above).
- **A search is not tied to a place.** Once started it goes on whatever the panes do: the active pane moving to other
  folders, another pane made active, the scrap's own parent changing focus, another search started into another scrap.
  It ends only when done, stopped, or its scrap closed.
- A pane's filter, a slow one included, is plan 36's: its results kept in the folder cache, worked out in the
  background, the pane showing what passed so far wherever it goes.
- Tests: a search finding many items over several seconds: items show from the first batch on, none already shown
  moves, the keyboard moves the focus in another pane meanwhile; Stop: the search ends at once, the scrap sorted; a
  scrap without a sort: the order found kept; the active pane moved to three folders during a search: the search goes
  on unchanged. Sort when done unchecked: a sorted scrap keeps the order found at the end; the setting off: the check starts
  unchecked in a new Find.

## 4. Open questions

None.


## 6. As built

### 6.1 Stage 1: Containing text (2026-11-19)

- The page builds the expression (`scraps.js` `searchExpression`): Normal escapes the text, `*` becomes `[^\r\n]*`,
  `?` `[^\r\n]`, `;` alternatives; Whole words wraps it in `\b(?:...)\b`. The host runs it (`Shell/TextSearch.cs`,
  .NET Regex, CultureInvariant, Multiline, a 2 s time-out per file) in `FileSearch.Run` after the name test, files only.
- Known files: the own preview's text kinds (text, code, markdown, HTML, CSV) or a file of another type whose start
  looks like text (`OwnPreview.LooksLikeText`), read as the preview reads them (`OwnPreview.Decode`). So the encoding
  without a BOM is UTF-8 when valid, else Latin-1, not the system's code page as 3.1 says: one reader for the search
  and the preview, so both find the same.
- All files, any other file: Windows' IFilter (`LoadIFilter` from query.dll), initialised with the index and other
  attributes to apply (without them the plain text filter gives no text at all); a filter that gives no text, or no
  filter: the file's bytes. On this PC .docx, .xlsx, .doc, .msg, .odt and .pdf have a filter (their
  PersistentHandler in the registry); whether .pdf's comes with Windows or with another program: not checked.
- The settings are in Settings > Search and scrap > Find (the tab that holds the search's settings), not Contents as
  3.1 says: `searchStartKB` (2048) and `findSortWhenDone` (true). The earlier texts are kept in searches.json `text`.
- The dialog is 620 px wide (it was 560): the rows of Containing text's options fit then.

### 6.2 Stage 1: the scrap while it fills

- `FileSearch.Run` sends what it found every 250 ms also while it tests candidates that do not match (before, only
  when the next match came, so a slow text check could hold a found item back).
- `ScrapView.add` while searching only appends (`addFound`: the batch through the scrap's own filter, no sort);
  `searched` sorts once (`searchChanged`). `ScrapView.comparer`: without a sort, or with Sort when done off
  (`keepFound`), the scrap's own order; a click on a title or the Sort window (`sortEntries`) ends `keepFound`.

### 6.3 Stage 1: the preview's find bar

- `previewfind.js` in preview.html: the bar over the content's top right; keys in the capture phase, before pane.js;
  CSS highlights (`pv-find`, `pv-find-cur`), also in previewdoc.css for markdown and HTML in their shadow root.
- PDF: pdf.js's text of every page (`getTextContent`) for the matches and the count; the current match lit in its
  page's text layer (pdf.js 6's `TextLayer`, drawn with the page in `pdfDraw`, its CSS from pdf.js's own rules).
- F3 from a scrap with a text (`floatPreview`): the view's `find` (text, expression, case, whole words, regex) goes
  with the own preview's show; the bar uses the scrap's expression while its text is unchanged. The preview reads
  the file to the search's start limit (at least previewTextKB), or 32 MB when the search read files whole.
- Found while testing, not in this plan: a floating window's WebView2 did not serve the own preview's files (only
  the main window called `OwnPreview.Serve`), so a PDF, an image or a video in an F3 window could not load; PaneForm
  serves them now. A preview pane's page could not put a word on the status line (`PreviewView.receive` had no
  `status`); it can now (Ctrl+F on an image).

### 6.4 Stage 1: tests

- `dotnet test`: 279 passed. New: `TextSearchTests` (the expression in each mode read the same by JavaScript under
  Jint and by .NET; whole words; the encodings; Known files and All files on a binary; only the start; Windows' text
  filter through the IFilter interop; a search with a text), `ScrapTests` (searches.json's `text`).
- In a test copy (built to src\bin\alt, its own data folder, CDP into its pages) on a folder made for it: a search
  for "needle" found a.txt, b.md and d.cs, not a 3 MB file with it past 2 MB, not a PDF (Known files), not a folder
  named after it; with the whole file the large one too; with All files the PDF; a regular expression and Whole words
  as expected. Through the dialog: its rows, the options disabled without a text, OK into a new scrap, the text kept.
  On C:\Program Files ("copyright"): items from the first second on, the first ones not moving, the scrap's page
  answering in 11 to 28 ms while it ran, Stop ending it. Sort when done on and off with a sort by name, descending.
  F3 from the scrap on a.txt: the window with the keyboard, the bar on "needle", 1 of 2 lit; F3, Shift+F3, Esc, Ctrl+F
  (its text selected), Esc twice closing the window; b.md (shadow root) and e.pdf (3 matches over 2 pages, lit in the
  text layer); Ctrl+F on an image: the warning; the docked preview (Alt+P) with the bar.

### 6.5 Stage 2: the rules and Contents (2026-11-19, after plan 36)

- Contents: a field of plan 32's lines (`filters.js`: kind `contents`, a slow field), in Manage filters' field list
  after the columns. Its line: contains, matches wildcards, matches a regex; the text; an encoding (Automatic,
  UTF-8, UTF-16 LE, UTF-16 BE, Windows-1252, Latin-1); All files or the known ones. The host reads the files
  (`FilterEngine.Fill`, `TextSearch` with the encoding chosen, Only the start at the searchStartKB setting) and puts
  each line's answer on the item (`contents`, by the condition's key); filters.js tests that. The expression builder
  moved from scraps.js to filters.js (`filterTextPattern`), so the host's engine has it too; scraps.js's
  `searchExpression` calls it.
- A folder passes a Contents line: the line does not apply to it and is left out (plan 32's rule).
- In the field list Contents has the tortoise with its own tooltip; under a Contents line a warning that every file
  is opened and read and that it can be very slow, in place of the tortoise's usual one.
- The rules in the Find dialog differ from 3.2: not an editor of lines in the dialog but a choice of a kept filter
  set (Rules: None or a set's name), its lines in short under it. The dialog is a modal window, so Manage filters cannot
  be used while it is open; a set is made and changed there, with the same lines and editor, and chosen here. The
  rules' lines show three lines high, scrolling, so the dialog's window keeps fitting.
- The host tests the rules during the search (`FileSearch` `Ruled`), on each item the name finds, before the text,
  with the same engine and `Fill`: no round trip to the page.
- A scrap's own filter with a Contents line is still the page's (a scrap is not one folder on disk): its items wait
  for a value that never comes there, so they do not show. Not built: open for when it is wanted.
- Tests: `dotnet test` 287 passed. New in `FilterResultsTests`: a Contents line contains, wildcards, a regex, Not,
  an encoding chosen (a Latin-1 file read as UTF-8 does not hold the word, as Windows-1252 it does); a search with rules,
  and with rules and a text. In a test copy: a list filtered on Contents "needle" (the file with it past the start
  limit not shown); Contents in the field list; a search with a rule and a text; the dialog's Rules with a kept set,
  its lines shown, the window still fitting.