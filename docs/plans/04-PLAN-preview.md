# Plan 04: Preview

Status: draft 2026-11-10; not started. Depends on plan 02 (how the UI is drawn) and plan 03 (the preview is a follower).

## 1. What this is about

Explorer's preview pane depends on whatever preview handlers are installed: text files often show nothing useful,
markdown is plain text, code has no colour, many types show nothing. Foldex should show what a file is without opening
it in another program.

## 2. The solution, in brief

The preview is a pane connected like any other (plan 03) and shows the file focused in its source. Types Foldex renders
itself, in the page, reuse LexPen's viewers: text and code coloured, markdown rendered, images, PDF, media, hex, CSV,
an archive's listing, a folder's summary. Every other type goes to the Windows preview handler registered for it
(Office and the like), hosted in a native window. Open in LexPen is one action away.

## 3. Details

### 3.1 What shows what

| Type | Shown by |
|---|---|
| Text, code, by LexPen's language packs | LexPen's colouring, read-only |
| Markdown | LexPen's markdown-it preview (math, Mermaid) |
| Images (png, jpg, gif, webp, svg, ico, bmp) | The page; svg as an image, no scripts |
| PDF | pdf.js, as LexPen's PDF view |
| Audio, video | The page's media element, for the codecs WebView2 plays [not yet checked which] |
| CSV, TSV | LexPen's CSV view |
| Zip | A listing read by the host (`System.IO.Compression`) |
| Binary without a viewer | Hex, as LexPen's hex view |
| Office and others with a Windows preview handler | The handler, in a native window (3.2) |
| A folder | Its size, number of items by type, dates [what exactly: not yet decided] |
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
  to preview it. The limit is a setting [default not yet decided].
- **Locked files**: opened with sharing for read and write; when that fails, properties and the reason.
- **HTML and markdown**: no scripts, no network; remote images in markdown off by default (open question 2).
- **Speed**: the preview follows the source's debounce (plan 03, 3.3); a slow viewer is cancelled when the focus moves on.

### 3.4 Actions

Open in LexPen (handed to LexPen's pipe as a later launch would), open with the default program, copy the preview's
text, zoom, the bar above the preview as LexPen's (theme or original for PDF, page, zoom).

### 3.5 Tests

- Unit: choosing the viewer per type and setting; the placeholder check; the large-file limit.
- In the test copy: each row of 3.1 with a sample file (LexPen's `docs/examples` has several); a placeholder file not
  downloaded; a .docx through its handler with a ribbon drop-down over it.

## 4. Open questions

1. **LexPen's viewers: copied or shared?** Same choice as plan 01 question 2, for the viewer code in particular (the
   largest part that could be shared).
2. **Remote content.** Remote images in markdown and HTML previews: off, on, or per folder?
3. **Text preview editable?** Suggestion: no, read-only; editing is LexPen's, one action away.
