# Plan 20: Extended search options

Status: draft 2026-11-12; not started.

- 2026-11-12: draft, at the user's request: the Find dialog's Containing text and Additional rules, split off plan 06.

Builds on plan 06 (the scrap and the Find dialog). The number in the file name is the priority; rename to reorder.

## 1. What this is about

Plan 06's Find dialog finds files and folders by name only. A better scrap needs more: files containing a text, and
rules on size, attributes and dates (ranges), as xplorer2's dialog has under Containing Text and Additional Rules.

## 2. The solution, in brief

The Find dialog gets a Containing text box with its options and a list of additional rules (size, attributes, date
ranges), all combined with the name. Text is searched by LexPen's `FolderSearch` on the files the name search found;
rules are tested by the engine where it can, else by Foldex. Both are kept with a scrap's search and in saved searches.

## Status

### Built

Nothing yet.

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Containing text | the text, case sensitive, whole words, regular expression | plan 06 | 3.1 |
| Additional rules | size, attributes, date ranges; added, edited, removed, ordered | plan 06 | 3.2 |
| Kept | in a scrap's search and in Predefined | plan 06 | 3.3 |
| Tests | see 3.4 | -- | 3.4 |

## 3. Details

### 3.1 Containing text

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

## 4. Open questions

1. **xplorer2's other text options.** Search all files, Verbatim and the encoding list: wanted, and as xplorer2 means
   them? [What xplorer2 does with each: not yet checked.]
2. **Combining rules.** Only and, or also or (or not)?
