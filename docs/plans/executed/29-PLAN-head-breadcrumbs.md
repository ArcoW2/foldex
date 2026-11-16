# Plan 29: A pane's head as a breadcrumb

Status: executed; see Status and 6 (As built).

- 2026-11-16: draft, at the user's request.
- 2026-11-16: executed.

LexPen has no breadcrumb in a pane's head (its heads name a file or a pane); the model in Foldex itself is the path bar
in a column (plan 10 3.2, bars.js `pathSegments`), whose folders are buttons that take the active pane there.

## 1. What this is about

A pane's head shows the folder it shows as one piece of text, and only its name once the folder is listed (a child
tree) or the whole path cut off at the right (a list). Which folder that is, and getting to one of its parents, needs
the path bar or Backspace pressed several times.

## 2. The solution, in brief

The head of a list and of a child tree shows the path of its folder as a breadcrumb: each folder of the path a part
of its own, separated by `\`, starting with the drive (`C:`). Where the head is too narrow, the parts at the start give
way to a `...` part that opens a menu of them, so the end of the path always shows. Clicking a part takes that pane to
that folder as typing it would (`goTo`): a follower's source reveals and focuses it in its tree, and the follower
follows. The part of the folder shown now is not a button.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| The parts | the head's title as the path's folders, the start giving way to `...` when narrow | 3.1; 6 |
| A click | a part (or an item of the `...` menu) takes the pane there by goTo, the source revealing it | 3.2; 6 |
| Pane pages | the same in a docked stand-in's head and in a floating page's own head | 3.3; 6 |
| Tests | unit and in the app | 3.5; 6 |

### Not yet built

## 3. Details

### 3.1 The parts

- The parts are the path bar's (bars.js `pathSegments`), one function that both use, with the path as its argument:
  a drive's part is `C:` and stands for `C:\`, a UNC path's first part is `\\server\share`. A path on a drive starts
  with its drive, without a This PC part before it (as the path bar; Explorer's has one).
- A location that is not on disk (This PC, Network, the Recycle Bin, Quick access) is one part: its shown name, as
  now.
- Which heads: a list and a child tree (plan 18 3.3: the folder its parent focuses). Not a root tree (its head says
  Folders), a scrap (its name), Preview, Info and the Log (their own titles); those stay as they are. A list on a link
  that shows its target's contents keeps its text (`name -> target`).
- Narrow: the head keeps its connector, pin, filter mark and branch marks; the title takes the rest. The parts that do
  not fit drop from the start, the last part always shown, cut off with `...` at its end when even it does not fit
  alone. The dropped parts are one `...` part at the start; its click opens a menu of them, top folder first (as the
  bars' `>>`), an item taking the pane there as a part's click does (3.2). Which parts drop is bars.js
  `crumbsLeftOut`, fitted again whenever the title's width changes.
- The tooltip of the title: the whole path, as text.
- Plan 25 (names): a child's head there is "name - folder"; the folder part of that is this breadcrumb, the name stays
  text. A root pane's head (name only) has no breadcrumb.

### 3.2 A click

- A part's click calls `goTo(pane, path)` (app.js), as a typed path does: the pane's opener (the pane itself when it
  goes its own way, else its source) reveals the folder, and a follower follows by `layout.focus`. So a list following
  the tree shows `c:\Myfolder\Myproject` and the tree has that folder focused and in view.
- The head's mousedown starts dragging the pane to another dock place after 6 px (`dragToDock`); a click without that
  movement is the part's click, so the parts need no exception in that handler.
- The current folder's part (the last) does nothing on a click; it is not a button.
- Right-click on the head is the pane menu, on the parts as well.

### 3.3 Pane pages (plan 14 stage 6)

- Docked: the stand-in's head is the window's; the page's `sync` carries the title's path (`crumbs`) beside its text,
  and the window draws the parts from it (pagedviews.js); a click is the window's own `goTo`. A sync with the same path
  leaves the parts as they are.
- Floating: the page draws its own head with the same function; a click calls the page's `goTo`, which the page sends
  to its window (viewpage.js), so it works as docked.

### 3.4 Alternatives not taken

- A separate breadcrumb row under the head: takes a row of height in every pane for what the head already names.
- `>` as separator (Explorer): `\` is what the path is, and what the path bar's box shows.

### 3.5 Tests

- Unit (Jint, as bars.js's size rules): the parts of a drive's root, a folder on a drive, a UNC path, a machine;
  which parts drop for a given room.
- In the app (test copy, through the debugging port): a list following the tree on `...\Myfolder\Myproject\Thisproject`,
  a click on `Myproject`: the list shows it, the tree's focus is on it and in view; a narrow head's `...` menu and one of
  its folders chosen; a floating list's head and a click in it.

## 4. Open questions

None.

## 6. As built

- bars.js: `pathSegments(path)` for the path bar's column and the heads (a UNC path's first part `\\server\share`,
  where the column had `server` and `share` apart, with ids that did not lead anywhere); `crumbsLeftOut` the pure rule
  of 3.1.
- app.js: `headTitle(el, text, path)` draws a head's title (parts, or the text), `fitCrumbs` hides the start behind
  `...` (a ResizeObserver on each title); `paneElement` handles a part's click and the `...` menu; a list's `load` and
  `done` and a child tree's `load` use it. app.css: the parts as links (underlined on hover), the separators dimmer.
- Tested: `dotnet test` (226 passed, BarsTests' two new ones among them). In the test copy, with the window's mouse
  through the debugging port (the mouse hit-tested by the window's page, as a real one): the head
  `d:\...\crumbs\Myfolder\Myproject\Thisproject` in parts, the whole path in its tooltip; `Myproject` clicked: the list
  there, the pane still docked, the tree's focus on `Myproject`, its row in view; the title limited to 140 px:
  `...\Thisproject`; `...` clicked: a menu of the folders before, top first; clicked again: closed; `Myfolder` chosen
  in it: the list there and the tree's focus on it; floated: its own head `...\Myfolder\Myproject\Thisproject`,
  `Myproject` clicked in it: the list there and the tree's focus on it.
- Not checked: a child tree's head, a list going its own way, a UNC path in a head, and dragging the head by a part
  (it should move the pane as the rest of the head does): `[not yet checked]`.
