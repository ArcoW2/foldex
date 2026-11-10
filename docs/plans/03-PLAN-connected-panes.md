# Plan 03: Connected panes and branches

Status: draft 2026-11-10, revised 2026-11-10 (collection panes, plan 06); not started. The core idea of Foldex.

## 1. What this is about

Explorers have a fixed shape: a folder tree on the left, one or two file lists beside it. What is shown where is
decided by the program, not by the task. Foldex replaces the fixed shape with panes of one kind that can be connected,
so the layout follows the work: a tree driving two lists, a chain of folder columns, a list driving a preview.

## 2. The solution, in brief

Every pane is the same kind: it shows a folder's folders, files or both, in a view of its own. A pane can follow one
other pane: when the item focused in its source is a folder, the follower shows that folder. A pane can have several
followers, so the connections form a tree per window. Each connection has a branch colour; a source pane keeps one
selection per colour and marks it in that colour. Activating a pane switches every pane upstream of it to its branch,
so the next click there drives that branch. The preview (plan 04) is a follower like any other.

## 3. Details

### 3.1 Terms

- **Pane**: shows one location (a folder on disk or a shell folder such as This PC, Network, Recycle Bin: plan 02
  3.1), or a collection of items from anywhere (search results, a scrap: plan 06). Its own settings: content (folders, files, both), view (tree, list, details, icons),
  sort, filter, hidden files.
- **Connection**: from a source pane to a follower. A follower has at most one source; a source any number of
  followers. No cycles: a connection that would make one is refused.
- **Branch**: a colour on connections. Connections out of one pane with the same colour share one selection in that
  pane; different colours have their own. A new connection gets the colour of the branch its source is in; a new
  colour is a choice when connecting, or later.
- **Active branch**: the branch of the pane last activated. Each pane upstream of it shows that branch's selection as
  its cursor; the other branches' selections stay marked in their colours, dimmed.

### 3.2 An example

```
 [A tree: C:\] --red---> [B both] --red--> [D preview]
               \
                --blue--> [C files]
```

A shows `C:\Projects` marked red (B shows it) and `C:\Temp` marked blue (C shows it). Clicking in C makes blue active:
A's cursor moves to `C:\Temp`. Clicking `C:\Docs` in A now changes C, not B. Clicking a file in B makes red active and
D previews that file.

A follower with the same colour as its sibling shows the same folder differently: A's folder in B as details and in a
second red pane as thumbnails.

### 3.3 Following

| Focused in the source | Folder or file follower | Preview follower |
|---|---|---|
| A folder | Shows that folder | Shows the folder (plan 04) |
| A file | Stays as it is (open question 2) | Shows the file |
| Several items | Open question 3 | The focused one |
| Nothing (empty folder) | Stays as it is | Empty |

- **Navigating inside a follower** (double-click, Backspace, typing a path) changes that follower and everything
  downstream of it; its source stays as it is. The next change in the source takes the follower back.
- **Pinned follower**: a pin in the pane header stops it following until unpinned; its connection and colour stay.
- **Debounce**: arrowing quickly through a source updates followers once the cursor rests, so a long walk does not
  load every folder on the way. The delay is a setting [default not yet decided].

### 3.4 Making and changing connections

- Actions: New connected pane (right of, below, floating), Connect to... (pick the source), Disconnect, Branch colour.
- With the mouse: drag the connector in a pane's header onto another pane.
- Panes are dock items (LexPen's docking, plan 01); where a pane sits has nothing to do with its connections.
- A pane's header shows its branch colour as a stripe and the name of its source; a source shows one stripe per
  colour it feeds.

### 3.5 Presets

Common shapes as a starting point, each just panes and connections: classic (tree drives a list), dual (tree drives two
lists in two colours), columns (a chain of folder panes, as Finder's column view), list with preview. Saved layouts of
the user's own: open question 6.

### 3.6 Keyboard

To the follower, to the source, to the next branch (keys [not yet decided], in `keys.json` as all keys). Back and
forward: open question 5.

### 3.7 Saved in the project

Panes and their settings, connections and colours, each pane's location, each branch's selection in each source, the
active branch.

### 3.8 Watching folders

Every folder shown is watched for changes; panes showing the same folder share one watcher.

### 3.9 Tests

- Unit (the model, without UI): connect, refuse a cycle, colour taken over from the source's branch, one selection
  per colour, activation switching the upstream panes, a pinned follower not following, removing a pane in the middle
  (open question 4), saving and reading back.
- In the test copy: the example of 3.2 clicked through; the presets; dragging a connector.

## 4. Open questions

1. **Is this the meaning of branch?** The plan reads "when a deeper branch is selected, all prior panes switch to that
   branch" as: a source keeps one selection per branch, and activating a pane deeper down switches the panes above it
   to that branch's selection. The simpler reading would be: a branch is only a colour grouping panes that belong
   together, and all followers of a source always show the same thing. Which one?
2. **A file focused in the source.** Followers stay as they are (suggestion), or a follower showing folders shows the
   file's folder?
3. **Several items selected in the source.** The follower shows the focused one only (suggestion), or the contents of
   all selected folders together, with a column for the folder each entry is in?
4. **Removing a pane in the middle.** Its followers connect to its source (suggestion), or become free panes?
5. **Back and forward.** Per pane, or per branch (one step back restores every pane of the branch)? Suggestion: per
   branch, because a click in a source changes several panes at once.
6. **Saved layouts.** Presets only, or the user's own pane shapes saved by name, apart from projects?
