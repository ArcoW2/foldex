# Plan 04: Preview

Status: executed; see Status and As built.

- 2026-11-10: draft.
- 2026-11-10: partly executed through plans 02 and 03: Windows preview handlers in a preview child.
- 2026-11-17: executed.

Depends on plan 02 (how the UI is drawn) and plan 03 (the preview is a follower).

## 1. What this is about

Explorer's preview pane depends on whatever preview handlers are installed: text files often show nothing useful,
markdown is plain text, code has no colour, many types show nothing. Foldex should show what a file is without opening
it in another program.

## 2. The solution, in brief

The preview is a pane connected like any other (plan 03) and shows the file focused in its source. Types Foldex renders
itself, in the page, use LexPen's libraries (plan 01, 3.3): text and code coloured, markdown rendered, images, PDF, media, hex, CSV,
an archive's listing, a folder's summary. Every other type goes to the Windows preview handler registered for it
(Office and the like), hosted in a native window. Open in LexPen is one action away.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Windows preview handlers | in a native window over the page's area, with the snapshot swap for page popups | 3.2; plan 02 6.1, 6.2 item 4 |
| Preview as a follower | the Preview action opens a child that follows | plan 03 6.1 |
| Own viewers | text and code, markdown, HTML, images, PDF, audio and video, CSV, zip listing, hex | 3.1; 6 |
| Summary and properties | a folder's summary; properties for anything else | 3.1; 6 |
| Viewer order | own viewer, Windows' handler, text, Windows' picture, hex, properties; previewWindowsTypes | 3.1; 6 |
| Care | cloud placeholders, large files, locked files, no scripts in HTML and markdown, remote images by a setting | 3.3; 6 |
| Preview actions | Open in LexPen, Open, Copy text, Show all, zoom, the PDF's page, in the bar above the preview | 3.4; 6 |

### Not yet built

## 3. Details

### 3.1 What shows what

| Type | Shown by |
|---|---|
| Text, code, by LexPen's language packs | LexPen's colouring, read-only (editing is LexPen's: Open in LexPen, 3.4) |
| Markdown | LexPen's markdown-it preview (math, Mermaid) |
| Images (png, jpg, gif, webp, svg, ico, bmp) | The page; svg as an image, no scripts |
| PDF | pdf.js, as LexPen's PDF view |
| Audio, video | The page's media element, for the codecs WebView2 plays [not yet checked which] |
| CSV, TSV | LexPen's CSV view |
| Zip | A listing read by the host (`System.IO.Compression`) |
| Binary without a viewer | Hex, as LexPen's hex view |
| Office and others with a Windows preview handler | The handler, in a native window (3.2) |
| A folder | Its folders and files, its files' size, its file types by count and size, its dates (6) |
| Anything else | Properties: size, dates, attributes |

The order: Foldex's own viewer first, then a Windows preview handler, then properties. A setting per type can prefer the
Windows handler.

### 3.2 Windows preview handlers

- Found through the registry (`shellex\{8895b1c6-b41f-4c1c-a562-0d564250836f}` on the type), created as COM objects
  (`IPreviewHandler`, initialised with `IInitializeWithStream`, `...WithFile` or `...WithItem`), drawn into a native window
  the host owns. Most run out of process in the shell's surrogate (`prevhost.exe`), so a crashing handler does not take
  Foldex down [not yet checked for every handler].
- A native window over the page covers the page's menus (plan 02, 3.3); the spike of plan 02 decides how that is
  solved.
- A handler is unloaded when the preview moves on, so it does not hold the file open.

### 3.3 Care

- **Cloud placeholders** (Synology Drive, OneDrive files on demand): previewing must not download a file that is not
  local. The host checks the attributes (`RECALL_ON_DATA_ACCESS`, `OFFLINE`) and shows properties with a Download and
  preview button instead.
- **Large files**: text and hex read only the start, with a "show all" action; nothing reads a whole large file just
  to preview it. The limit is the setting `previewTextKB` (256 KB by default).
- **Locked files**: opened with sharing for read and write; when that fails, properties and the reason.
- **HTML and markdown**: no scripts, ever. Remote images (in markdown and HTML) are shown by default; the setting
  `previewRemoteImages` (on by default, Settings: Preview) turns them off, and then nothing is fetched from the network.
- **Speed**: the preview follows the source's debounce (plan 03, 3.3); a slow viewer is cancelled when the focus moves on.

### 3.4 Actions

Open in LexPen (handed to LexPen's pipe as a later launch would), open with the default program, copy the preview's
text, zoom, the bar above the preview as LexPen's (theme or original for PDF, page, zoom).

### 3.5 Tests

- Unit: choosing the viewer per type and setting; the placeholder check; the large-file limit.
- In the test copy: a markdown file with a remote image, shown, and not fetched with `previewRemoteImages` off.
- In the test copy: each row of 3.1 with a sample file (LexPen's `docs/examples` has several); a placeholder file not
  downloaded; a .docx through its handler with a ribbon drop-down over it.

## 4. Open questions

None.

## 6. As built

**Host** (`src/Shell/OwnPreview.cs`, the `preview` op in `src/MainForm.cs`):

- **Viewer order.** A type with an own viewer gets it, and Windows' handler is unloaded. The exception is an
  extension in `previewWindowsTypes` that Windows has a handler for. Every other file goes to Windows' handler. Without
  one, the file is shown as text when its start looks like text, else as the picture Windows makes of it (its thumbnail
  handler), else as hex, and as properties last. A folder gets its summary.
- **What is sent.** Images, video, sound and PDF go to the page as a URL of Foldex's own (`foldex-files.example`). That
  server answers with `Access-Control-Allow-Origin: *`, so pdf.js can fetch from the panes' origin, and its filter
  takes requests from frames too. Text-like kinds come in the message: their first `previewTextKB`, or up to
  `OwnPreview.AllBytes` with Show all. A zip's entries are read with `System.IO.Compression`. Hex is the first 64 KB.
- **Folder summary.** The folder's own folders and files, not its subfolders, at most `SummaryItems` of them. Its files'
  size, the 15 most common types with count and size, and its dates.
- **Placeholders.** A file with the attribute Offline, RecallOnOpen or RecallOnDataAccess gets its properties and a
  Download and preview button. The button reads the file all the same.
- **Locked files.** Opened with read, write and delete sharing. When that fails, the properties and the system's reason
  are shown.
- **Open in LexPen.** The op `openLexPen` starts LexPen.exe with the file, found through
  `HKCR\Applications\LexPen.exe\shell\open\command`. That is what a later launch does, and LexPen hands the file to its
  running window.

**Page** (`src/web/previewpane.js`, `preview.html`, `previewdoc.css`):

- **Libraries.** LexPen's own, copied into `src/web/vendor`: `core.js` (markdown-it with its plugins and highlight.js),
  KaTeX, Mermaid, and pdf.js without its viewer. KaTeX and Mermaid load the first time a document needs them, pdf.js
  the first time a PDF is shown.
- **Not LexPen's viewer code.** The viewers are Foldex's own, smaller than LexPen's, which are tied to its editor:
  - Code is coloured by highlight.js, not LexPen's language packs; a text over 1 MB stays plain.
  - CSV is a table: RFC 4180 quotes, the separator found from the first line, at most 5000 rows.
  - PDF pages are canvases drawn as they come into sight, with the page shown in the bar.
  - Hex is offset, 16 bytes and their text.
- **Markdown and HTML.** Rendered as LexPen does, front matter included, in a shadow root so an HTML file's styles stay
  inside it. Made harmless before it is shown: no script, frame, object, base, meta or link elements, no `on...`
  attributes, no `javascript:` addresses, form actions removed. The page's Content-Security-Policy allows only the
  page's own scripts, so nothing a document brings can run anyway.
- **Images in documents.** A relative image is shown from the file's folder. With `previewRemoteImages` off, web images
  and CSS `url()`s are dropped, leaving a dashed box with the address in its tooltip. A link only scrolls within the
  document; others are not followed.
- **The bar.** Open in LexPen and Copy text for text-like kinds; Open (as a double-click); Show all when cut; zoom
  (-, 100%, +, Ctrl+wheel, Ctrl+plus, minus and 0); the page for a PDF. Video and sound have no bar; their players have
  their own.

**Settings** (Contents, Preview): `previewRemoteImages` (on), `previewTextKB` (256), `previewWindowsTypes` (empty). The
Settings window gained a text field for the last one.

**Tested:**

- **Unit tests** (`OwnPreviewTests`): the viewer per extension, `previewWindowsTypes`, the start of a large file and
  Show all, a zip's listing, code's language, properties, a folder's summary, hex for an unknown binary.
- **In the test copy** (each file shown in the preview pane and its page read through CDP):
  - Viewers: a JPEG, a PDF (pages drawn, page count), a WAV, LexPen's `demo.md` (front matter, Mermaid diagrams,
    KaTeX, coloured code), C#, JSON, SQL, a CSV with quotes and a line break in a field, a zip, a binary as hex, an
    `.nss` as text, a large text and Show all, a font through Windows' handler, a folder's summary.
  - Care: a markdown and an HTML file with `onerror`, `<script>` and `javascript:` (none ran); a remote image shown, and
    not fetched with the setting off; a file held without sharing (its reason shown); `.pdf` in `previewWindowsTypes`
    (Windows' handler).
- **Not tested:** a real cloud placeholder (none to hand), and Open in LexPen clicked (it starts the real LexPen).