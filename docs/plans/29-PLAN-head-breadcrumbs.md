# Plan 29: A pane's head as a breadcrumb

Status: not started.

- 2026-11-16: draft, at the user's request.

LexPen has no breadcrumb in a pane's head (its heads name a file or a pane); the model in Foldex itself is the path bar
in a column (plan 10 3.2, bars.js `pathSegments`), whose folders are buttons that take the active pane there.

## 1. What this is about

A pane's head shows the folder it shows as one piece of text, and only its name once the folder is listed (a child
tree) or the whole path cut off at the right (a list). Which folder that is, and getting to one of its parents, needs
the path bar or Backspace pressed several times.

## 2. The solution, in brief

The head of a list and of a child tree shows the path of its folder as a breadcrumb: each folder of the path a part
of its own, separated by `\`, starting with the drive (`C:`). Where the head is too narrow, the parts at the start give
way to a `...` part that opens a menu of them, so the end of the path always shows. Clicking a part takes that pane to that folder as typing it would (`goTo`): a follower's source
reveals and focuses it in its tree, and the follower follows. The part of the folder shown now is not a button.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| The parts | the head's title as the path's folders, the start giving way when narrow | -- | 3.1 |
| A click | a part takes the pane there by goTo, the source revealing it | -- | 3.2 |
| Pane pages | the same in a docked stand-in's head and in a floating page's own head | -- | 3.3 |
| Tests | unit and in the app | -- | 3.5 |

## 3. Details

### 3.1 The parts

- The parts are the path bar's (bars.js `pathSegments`), taken out of it into one function that both use, with the
  path as its argument instead of the active pane's: a drive's part is `C:` and stands for `C:\`, a UNC path's first
  part is `\\server\share`. A path on a drive starts with its drive, without a This PC part before it (as the path
  bar; Explorer's has one).
- A location that is not on disk (This PC, Network, the Recycle Bin, Quick access) is one part: its shown name, as
  now.
- Which heads: a list and a child tree (plan 18 3.3: the folder its parent focuses). Not a root tree (its head says
  Folders), a scrap (its name), Preview, Info and the Log (their own titles); those stay as they are.
- Narrow: the head keeps its connector, pin, filter mark and branch marks; the title takes the rest. The parts that do
  not fit drop from the start, the last part always shown, cut off with `...` at its end when even it does not fit
  alone. The dropped parts are one `...` part at the start; its click opens a menu of them, top folder first (as the
  bars' `>>`), an item taking the pane there as a part's click does (3.2).
- The tooltip of the title: the whole path, as text.
- Plan 25 (names): a child's head there is "name - folder"; the folder part of that is this breadcrumb, the name stays
  text. A root pane's head (name only) has no breadcrumb.

### 3.2 A click

- A part's click calls `goTo(pane, path)` (app.js), as a typed path does: the pane's opener (the pane itself when it
  goes its own way, else its source) reveals the folder, and a follower follows by `layout.focus`. So a list following
  the tree shows `c:\Myfolder\Myproject` and the tree has that folder focused and in view.
- The head's mousedown starts dragging the pane to another dock place after 6 px (`dragToDock`); a click without that
  movement is the part's click, so the parts need no exception in that handler. A part that is dragged moves the pane,
  as the rest of the head does.
- The current folder's part (the last) does nothing on a click; it is not a button.
- Right-click on the head is the pane menu, on the parts as well.

### 3.3 Pane pages (plan 14 stage 6)

- Docked: the stand-in's head is the window's; its title comes with the page's `sync` (pagedviews.js, `m.title`). The
  sync gets the location already (`location`); the window draws the parts from that, and a click is the window's own
  `goTo`.
- Floating: the page draws its own head; the parts are drawn there from the same function. Whether a click there can
  call `goTo` in the page or must ask the window's page (which keeps the layout and the source pane):
  `[not yet checked]`.

### 3.4 Alternatives not taken

- A separate breadcrumb row under the head: takes a row of height in every pane for what the head already names.
- `>` as separator (Explorer): `\` is what the path is, and what the path bar's box shows.

### 3.5 Tests

- Unit (Jint, as bars.js's size rules): the parts of a drive's root, a folder on a drive, a UNC path, a shell
  location; which parts drop for a given room.
- In the app (test copy, through the debugging port): a list following the tree on `C:\...\a\b\c`, a click on `b`:
  the list shows `...\b`, the tree's focus is on `b` and in view; a child tree's head the same; a narrow pane's `...` menu and one of its
  folders chosen; a list going its own
  way; a narrow pane keeps the last part; a floating list's head; dragging the head by a part still docks the pane.

## 4. Open questions

None.
