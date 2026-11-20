# Plan 38: Languages

Status: not started. See Status below.
- 2026-11-20: draft.

LexPen has no languages of its own (its texts are English, in its code): here Foldex has no model to follow, and LexPen
could take this over later.

## 1. What this is about

Every text Foldex shows is English and written in its code: the actions' titles and hints, the settings window's
rows, the ribbon, the menus, the dialogs, the status line, the tooltips, the column titles, the names of months and
days in dates. Wanted: every one of them translatable, a language being a JSON file, and the language chosen in the
settings.

## 2. The solution, in brief

Every text the user sees goes through one function that looks it up in the language chosen, with English as it is in
the code as the fallback. A language is a JSON file of keys and texts: shipped ones in Foldex's defaults, your own (or
changed ones) in the data folder. The host loads the file chosen by the setting `language` and gives it to every page
with the settings, and uses it for its own texts. Month and day names (and the other words of a date) follow the
language. What Windows says (its properties' names, its menus, file types) stays in Windows' language. A command
writes a language file with every key and its English text, to start a translation from, and the settings window says
which texts a language lacks.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Text function | t(): a key, its English, placeholders, plurals; the fallback | Q1 | 3.2, 3.3 |
| Language files | the format; shipped and your own; loaded by the host, to every page | -- | 3.4 |
| Setting | `language`: the files found; switching | Q2 | 3.5 |
| Web texts | every page's texts through t(), area by area | Text function | 3.1, 3.6 |
| Host texts | the host's own (AskForm, its errors and messages) the same way | Language files | 3.7 |
| Dates and numbers | month and day names, AM/PM in the language; numbers | Q3 | 3.8 |
| Starting a language | write a file with every key and its English; what a language lacks | Web texts | 3.9 |
| Tests | 3.10 | -- | 3.10 |

## 3. Details

### 3.1 What is a text

Translated: whatever Foldex itself writes for the user to read.

- Actions (actions.js): title, hint, the titles of their variants; the ribbon and the menus use these.
- The settings window (settingrows.js): tabs, groups, titles, hints, the options of a choice; the settings window's own
  words (settings.html, settings.js).
- Menus built in code: the pane's menu, the column header's, a scrap's, the empty space's, the bookmarks', and so on.
- The pages' fixed texts (the *.html files): buttons, labels, placeholders.
- Dialogs (dialogpage.js and the dialogs it shows): titles, buttons, questions.
- The status line and the log: messages, with what they name filled in.
- Tooltips (title attributes) and the hints of the ribbon.
- Foldex's own column titles (OwnColumns, InfoOnly), the thumbnails' information names, the filter fields, Find's
  fields, the renamer's options.
- The Manage windows (column sets, bookmarks, filters, projects), the preview's own texts, About.
- The shipped names of things you can rename (the shipped column sets, ribbon tabs, bars): shown translated while you
  did not rename them; once renamed, your name.

Not translated:

- What Windows gives: the names of its properties, its right-click menu, file types, folder names (Desktop, Documents),
  its own dialogs (copy, delete). These are in Windows' language already.
- What you made or named: sets, bookmarks, projects, filters, macros, panes.
- Key names in shortcuts (Ctrl+Shift+R): as Windows writes them in English menus. [not yet checked what Explorer does in
  another language]
- The files you edit by hand (settings.json, keys.json): their comments stay English.

### 3.2 Keys

A text needs a key that stays when the English changes a little, and code that still reads well.

- Where a text belongs to something with an id, the key is made from that id, so the code needs nothing:
  `action.folders.size.title`, `action.folders.size.hint`, `setting.dateFormat.title`, `setting.dateFormat.hint`,
  `setting.dateFormat.option.short`, `column.modified`.
- Elsewhere the code names a key and gives its English: `t('status.noPanes', 'No panes left: ...')`. Reading the code
  shows the English; the key keeps a translation when the English is reworded.

The other way, the English itself as the key (as gettext), needs no keys at all, but one English word with two
meanings cannot be translated twice, and every reworded English text loses its translations. Q1.

### 3.3 Placeholders and plurals

- Named placeholders: `t('status.selected', '{count} selected: {size}', { count, size })`; a translation may move them.
- Plurals as Intl.PluralRules has them per language (one, few, many, other): a text with plural forms is an object
  `{ "one": "{count} file", "other": "{count} files" }`. Today's code writes `file` / `files` by hand in places; those go
  through this.

### 3.4 Language files

- One JSON file per language: its code (`nl`), its name in itself (`Nederlands`), the locale for dates and numbers
  (`nl-NL`), and `texts`: key -> text (or plural forms). Comments allowed, as settings.json.
- Shipped: `src/defaults/lang/<code>.json`. Yours: `<data folder>/lang/<code>.json`: a file of your own adds a language;
  one with the code of a shipped one changes or adds texts of it (key by key, as your settings.json over the defaults).
- English has no file: its texts are in the code (3.2). A file `en.json` of your own still changes English texts.
- The host loads the language chosen (LangFile, as SettingsFile) and sends it with the hello and with every settings
  change, so every page has it: the window's page, the panes' pages (pageHello), the floating windows, the settings
  window, the dialogs' pages. A key a language lacks: its English.
- A file that cannot be read: English, and a problem in the settings window (as a settings.json that cannot be read).

### 3.5 The setting

- `language` (Settings > App, a group "Language" of its own): English and the files found, each by its own name.
- Switching: every window's pages are loaded again (each keeps its panes and layout, as after a restart), since most
  texts are drawn once (the ribbon, the menus' definitions, the settings rows). Drawing everything again live, without
  a reload, means every part that drew a text redraws it. Q2.

### 3.6 The pages, area by area

Each area moved to t() in one go, so a half-moved area is never shipped: actions and the ribbon; the settings window;
menus; the status line and the log; the dialogs; the Manage windows; the preview; the html files. Texts made by joining
pieces of English (`${n} ${n === 1 ? 'file' : 'files'}`) become one text with placeholders, as the order of words differs
per language.

### 3.7 The host's texts

The host's own words: AskForm's buttons and questions, the errors it sends to the pages (a folder that cannot be read,
a file operation that failed), the tray and the taskbar's jump list if any. The same files, a `Lang.T(key, english)` in
C#. Windows' own messages (an exception's text from Windows) stay as Windows gives them.

### 3.8 Dates and numbers

- dates.js: the names of months and days (MMMM, MMM, dddd, ddd) and AM/PM in the language's locale; today English.
- The format of the dates stays the setting dateFormat (System: Windows' regional settings), whatever the language.
- Numbers (sizes in bytes, counts): today Windows' display language's separators (toLocaleString). With a language:
  its locale, or Windows' regional settings as the dates' System does. Q3.

### 3.9 Starting a language

- An action "Write a language file": every key and its English into `<data folder>/lang/new.json`, to translate and
  rename. It needs every key known in one place: the derived keys come from the definitions (actions, settings rows,
  columns); the keys named in code are collected as they are used and from a list written by the test of 3.10.
- The settings window, at Language: how many texts the language chosen lacks (machine-counted), and a button that writes
  them into your file of that language, with their English, to fill in.

### 3.10 Tests

- Every key named in the web code (t('key', ...)) and the host's (Lang.T) is unique: one key, one English text.
- A language file's placeholders match the English's (a translation that drops {count} is a problem).
- A shipped language file has no keys that no longer exist.
- The pages show a language's text for a key it has, English for one it lacks, a plural form by count.
- In a test copy: switching to a test language (a file of a few keys): the ribbon, a menu, the settings window and a
  status message in it; English where it lacks a key; a date with its month name.

### 3.11 Windows

No new window: the setting is a row of the settings window (docked or floating, as it is).

## 4. Open questions

1. Keys: from the ids where there is one and named in the code elsewhere (3.2, recommended), or the English text as the
   key everywhere?
2. Switching the language: the windows' pages loaded again (recommended: simple, nothing missed), or everything drawn
   again live?
3. Numbers with a language: in the language's locale, or Windows' regional settings (as the dates' System)?
4. Which languages are shipped first, besides English (Dutch?), and who translates them?

## 6. As built

Nothing built yet.
