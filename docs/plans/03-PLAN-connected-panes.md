# Plan 03: Connected panes and branches

Status: draft 2026-11-10, revised 2026-11-10 (collection panes, plan 06; state per branch); not started. The core idea of Foldex.

## 1. What this is about

Explorers have a fixed shape: a folder tree on the left, one or two file lists beside it. What is shown where is
decided by the program, not by the task. Foldex replaces the fixed shape with panes of one kind that can be connected,
so the layout follows the work: a tree driving two lists, a chain of folder columns, a list driving a preview.

## 2. The solution, in brief

Every pane is the same kind: it shows a folder's folders, files or both, in a view of its own. A pane can follow one
other pane: when the item focused in its source is a folder, the follower shows that folder. A pane can have several
followers, so the connections form a tree per window; each connection has a branch colour. A pane keeps its state
(what it shows, what is selected) per branch below it, and shows the state of the branch that is active, in that
branch's colour. A click in a pane changes only the active branch; activating a pane in another branch makes every
pane above it restore its state for that branch. The preview (plan 04) is a follower like any other.

## 3. Details

### 3.1 Terms

- **Pane**: shows one location (a folder on disk or a shell folder such as This PC, Network, Recycle Bin: plan 02
  3.1), or a collection of items from anywhere (search results, a scrap: plan 06). Its own settings: content (folders, files, both), view (tree, list, details, icons),
  sort, filter, hidden files.
- **Connection**: from a source pane to a follower. A follower has at most one source; a source any number of
  followers. No cycles: a connection that would make one is refused.
- **Branch**: a colour on connections. Connections out of one pane with the same colour belong to one branch; different
  colours are different branches. A new connection gets the colour of the branch its source is in; a new colour is a
  choice when connecting, or later.
- **Branch state**: a pane keeps its state per branch below it: the location it shows, the selection and the focused
  item (and the scroll position with them). A pane without followers has one state. A new branch starts with a copy of
  the source's state for the branch active at that moment.
- **Active branch**: the branch of the pane last activated. Every pane above it shows its state for that branch, and its
  header takes that branch's colour. A click or navigation in a pane changes only its state for the active branch, and
  so only the followers in that branch.
- **Switching**: activating a pane in another branch makes every pane above it restore its state for that branch: its
  location, selection and focus come back as they were when that branch was last active.

### 3.2 An example

```
 [A tree: C:\] --red---> [B both] --red--> [D preview]
               \
                --blue--> [C files]
```

With red active, A's header is red and A shows `C:\` with `C:\Projects` focused; B shows `C:\Projects`. Clicking in C
makes blue active: A's header turns blue and A restores its blue state, `C:\Temp` focused, which C shows. Clicking
`C:\Docs` in A now changes A's blue state and C; B stays on `C:\Projects`. Navigating A to `D:\` changes only A's blue
state too. Clicking in B makes red active again: A comes back on `C:\` with `C:\Projects` focused, as red left it.
Clicking a file in B makes D preview it.

A follower with the same colour as its sibling shows the same folder differently: A's folder in B as details and in a
second red pane as thumbnails.

### 3.3 Following

| Focused in the source | Folder or file follower | Preview follower |
|---|---|---|
| A folder | Shows that folder | Shows the folder (plan 04) |
| A file | Stays as it is (open question 1) | Shows the file |
| Several items | Open question 2 | The focused one |
| Nothing (empty folder) | Stays as it is | Empty |

- **Navigating inside a follower** (double-click, Backspace, typing a path) changes that follower's state for the active
  branch and everything downstream of it in that branch; its source stays as it is. The next change in the source
  takes the follower back.
- **Pinned follower**: a pin in the pane header stops it following until unpinned; its connection and colour stay.
- **Debounce**: arrowing quickly through a source updates followers once the cursor rests, so a long walk does not
  load every folder on the way. The delay is a setting [default not yet decided].

### 3.4 Making and changing connections

- Actions: New connected pane (right of, below, floating), Connect to... (pick the source), Disconnect, Branch colour.
- With the mouse: drag the connector in a pane's header onto another pane.
- Panes are dock items (LexPen's docking, plan 01); where a pane sits has nothing to do with its connections.
- A pane's header shows the active branch's colour and the name of its source; a source also shows small marks in the
  colours of the other branches it feeds, to switch to one with a click.

### 3.5 Presets

Common shapes as a starting point, each just panes and connections: classic (tree drives a list), dual (tree drives two
lists in two colours), columns (a chain of folder panes, as Finder's column view), list with preview. Saved layouts of
the user's own: open question 5.

### 3.6 Keyboard

To the follower, to the source, to the next branch (keys [not yet decided], in `keys.json` as all keys). Back and
forward: open question 4.

### 3.7 Saved in the project

Panes and their settings, connections and colours, each pane's state per branch (location, selection, focus), the
active branch.

### 3.8 Watching folders

Every folder shown is watched for changes; panes showing the same folder share one watcher.

### 3.9 Tests

- Unit (the model, without UI): connect, refuse a cycle, colour taken over from the source's branch, a new branch
  starting from a copy of the source's state, a click changing only the active branch's state, activation restoring
  every upstream pane's state for that branch, a pinned follower not following, removing a pane in the middle (open
  question 3), saving and reading back.
- In the test copy: the example of 3.2 clicked through; the presets; dragging a connector.

## 4. Open questions

1. **A file focused in the source.** Followers stay as they are (suggestion), or a follower showing folders shows the
   file's folder?
2. **Several items selected in the source.** The follower shows the focused one only (suggestion), or the contents of
   all selected folders together, with a column for the folder each entry is in?
3. **Removing a pane in the middle.** Its followers connect to its source (suggestion), or become free panes?
4. **Back and forward.** Per pane, or per branch (one step back restores every pane of the branch)? Suggestion: per
   branch, because a click in a source changes several panes at once.
5. **Saved layouts.** Presets only, or the user's own pane shapes saved by name, apart from projects?
6. **View settings per branch?** The branch state holds what is shown and selected. The view settings (content, view,
   sort, filter, hidden files) stay per pane (suggestion), or are they part of the branch state too, so A could be a
   tree for red and details for blue?
