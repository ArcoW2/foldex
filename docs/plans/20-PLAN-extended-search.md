# Plan 20: Extended search options

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request: the Find dialog's Containing text and Additional rules, split off plan 06.

Builds on plan 06 (the scrap and the Find dialog). The number in the file name is the priority; rename to reorder.

## 1. What this is about

Plan 06's Find dialog finds files and folders by name only. A better scrap needs more: files containing a text, and
rules on size, attributes and dates (ranges), as xplorer2's dialog has under Containing Text and Additional Rules.
And once a scrap holds the files containing a text, looking at one of them should show where that text is, not just
the file.

## 2. The solution, in brief

The Find dialog gets a Containing text box with its options and a list of additional rules (size, attributes, date
ranges), all combined with the name. Text is searched by LexPen's `FolderSearch` on the files the name search found;
rules are tested by the engine where it can, else by Foldex. Both are kept with a scrap's search and in saved searches.
F3 on a file in a scrap whose search has a text opens its preview already searching that text, on the first match;
in that preview F3 and Shift+F3 go to the next and previous match, and Ctrl+F opens its find bar, after LexPen's, to
search something else.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Containing text | the text, case sensitive, whole words, regular expression | plan 06 | 3.1 |
| Additional rules | size, attributes, date ranges; added, edited, removed, ordered | plan 06 | 3.2 |
| Kept | in a scrap's search and in Predefined | plan 06 | 3.3 |
| Find in the preview | a find bar in Foldex's own preview, after LexPen's: Ctrl+F, F3, Shift+F3, case, whole word, regular expression | -- | 3.5 |
| F3 from a text scrap | the floating preview opened searching the scrap's text, on its first match | Containing text; Find in the preview | 3.5 |
| Tests | see 3.4 | -- | 3.4 |

## 3. Details

### 3.1 Containing text

- In the Tab order right after Named (plan 06 3.3), before its own options.
- The text, with a list of earlier ones; Case sensitive, Whole words, a regular expression (xplorer2's "RE").
- Searched by LexPen's `FolderSearch.cs` (its text check, skipping binary files and files over its size limit), on the
  files that pass the name and the rules; folders never match a text.
- xplorer2's Search all files, Verbatim and its encoding list: open question 1.

### 3.2 Additional rules

- A list under the text: each rule one line (size more or less than, attributes set or not, modified / created /
  accessed between two dates or within the last ...); a double click adds one, buttons to add, edit, remove, move up
  and down, as xplorer2's.
- All rules must hold (and). Whether also "or": open question 2.

### 3.3 Kept

- Part of a scrap's search (plan 06 3.4) and of a saved search (Predefined).

### 3.4 Tests

- Unit: each rule on files made for it; a text search with each option; rules combined.
- In the test copy: a search with a text and a size rule into a scrap; Search again keeps both.
- Find in the preview (3.5), unit where the page allows, else in the test copy over CDP: a text, a code file and a
  markdown file each searched with each option; F3 and Shift+F3 through the matches and past the end; Esc closes the
  bar, a second Esc the F3 window.
- F3 from a text scrap: a scrap searched for a text, F3 on a file in it: the floating window has the keyboard, the bar
  holds the text with the scrap's options, the first match shown and lit; F3 the next one; Ctrl+F, another text, F3:
  its matches. F3 on a file of a scrap without a text, and on an image in a text scrap: the preview as now, no bar.

### 3.5 Find in the preview, and F3 from a text scrap

- **LexPen is the model.** LexPen's find bar (`..\LexPen\web\find.js`) already searches its preview as well as its
  editor (`previewMatches`). Foldex's preview gets that bar, find row only: a preview is read-only, so no replace row.
  Its parts as LexPen's: the text, its count, Aa (case), W (whole word), .* (regular expression), previous, next,
  close; Enter / F3 next, Shift+Enter / Shift+F3 previous, Esc closes the bar. Where Foldex differs: no replace row,
  and no "one search for both panes" (a preview has one page).
- In every preview Foldex draws itself (plan 04: text, code, markdown, HTML, CSV and the like), docked or floating. A
  preview by Windows' handler (a native window over the page) and an image, video or sound have nothing to search:
  Ctrl+F there does nothing [what it says, if anything: open question 3]. PDF: open question 4.
- Keys: a pane page sends every key to its window (`pane.js`), and the window's Ctrl+F is the Find dialog, its F3
  `preview.float` (not enabled with a preview active). In a preview page Ctrl+F, F3 and Shift+F3 are the page's own,
  taken before `pane.js` passes them on. Esc closes the bar first; with no bar open it closes an F3 window, as now.
- F3 with no search yet: the bar opens, as LexPen's Find next does with an empty or hidden bar.
- **F3 from a text scrap.** F3 on a file in a scrap whose search has a Containing text (3.1) opens the floating
  preview (plan 14 3.5; it takes the keyboard) with the bar open, holding that text with its Case sensitive, Whole
  words and regular expression, and scrolled to the first match. From there it is the bar of the paragraph above:
  F3 on, Ctrl+F for another text. A scrap without a text, or a file whose preview cannot be searched: F3 as now.
- The text is searched in what the preview shows, by the page (JavaScript's regular expressions); the scrap's search
  ran in .NET (`FolderSearch`). A pattern only .NET reads the same way may find nothing in the preview: the bar shows
  no match, as for any text. A text past what the preview shows (it shows the start of a large file, previewTextKB;
  Show all reads more): open question 5.

## 4. Open questions

1. **xplorer2's other text options.** Search all files, Verbatim and the encoding list: wanted, and as xplorer2 means
   them? [What xplorer2 does with each: not yet checked.]
2. **Combining rules.** Only and, or also or (or not)?
3. **Ctrl+F on a preview that cannot be searched.** Nothing, or a word on the status line ("this preview cannot be
   searched")?
4. **PDF.** Search its pages too (pdf.js's text layer, as LexPen's preview does if it shows PDF [not yet checked]), or
   leave PDF out?
5. **A match past what the preview shows.** A large file shows only its start. When the scrap's text is not in it:
   read the rest at once (as Show all), offer Show all in the bar, or only say there is no match in the part shown?
