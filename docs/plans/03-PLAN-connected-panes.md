# Plan 03: Connected panes and branches

Status: draft 2026-11-10, revised 2026-11-10 (collection panes, plan 06; state per branch; default layout, executing;
parent and child, the open questions answered; detach, attach and tabs: plan 12); partly executed 2026-11-10 (stage 1:
the model, the default layout, executing; then detach, attach, branch colour, pinning, keys, back and forward,
watching folders); see 5. Status and 6. As built. The core idea of Foldex.

## 1. What this is about

Explorers have a fixed shape: a folder tree on the left, one or two file lists beside it. What is shown where is
decided by the program, not by the task. Foldex replaces the fixed shape with panes of one kind that can be connected,
so the layout follows the work: a tree driving two lists, a chain of folder columns, a list driving a preview.

## 2. The solution, in brief

Every pane is the same kind: it shows a folder's folders, files or both, in a view of its own. A pane can be the child
of one other pane, its parent: when the item focused in the parent is a folder, the child shows that folder. A pane
can have several children, so the panes form a tree per window; each parent-child connection has a branch colour. A
pane keeps its state (what it shows, what is selected) per branch below it, and shows the state of the branch that is
active, in that branch's colour. A click in a pane changes only the active branch; activating a pane in another branch
makes every pane above it restore its state for that branch. The preview (plan 04) is a child like any other.

A window opens with two panes: on the left the root, a pane without a parent that shows folders only, and filling the
rest its child, showing files and folders of the folder focused in the root. Double-clicking an item executes it: a
file opens as Windows opens it; a folder is opened by the pane's parent, so the child then shows it; in a pane without
a parent the folder expands in place, as in a tree.

## 3. Details

### 3.1 Terms

- **Pane**: shows one location (a folder on disk or a shell folder such as This PC, Network, Recycle Bin: plan 02
  3.1), or a collection of items from anywhere (search results, a scrap: plan 06). Its view settings are its own, not
  per branch: content (folders, files, both), view (tree, list, details, icons), sort, filter, hidden files.
- **Parent and child**: a child follows its parent. A child has one parent; a parent any number of children. No
  cycles: a connection that would make one is refused. A child can be detached (it becomes a root) and a pane
  attached to another (plan 12 3.2).
- **Root**: a pane without a parent; the window's first pane is one.
- **Branch**: a colour on parent-child connections. A parent's children of the same colour belong to one branch;
  different colours are different branches. A child's first child continues its branch (its colour); a root's
  first child and a further child start a new branch, in a colour not yet used in the window (with all taken, the one
  used least), so the children of two roots differ. Two
  children in one branch (the same colour) is a choice when connecting, or later. A new child starts with the view
  settings of the parent's current child (the one in its active branch, not a preview), else the defaults.
- **Branch state**: a pane keeps its state per branch below it: the location it shows, the selection and the focused
  item (and the scroll position with them). A pane without children has one state. A new branch starts with a copy of
  the parent's state for the branch active at that moment.
- **Active branch**: the branch of the pane last activated. Every pane above it shows its state for that branch, and its
  header takes that branch's colour. A click or navigation in a pane changes only its state for the active branch, and
  so only the children in that branch.
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

A child with the same colour as its sibling shows the same folder differently: A's folder in B as details and in a
second red pane as thumbnails.

### 3.3 Following

| Focused in the parent | Folder or file child | Preview child |
|---|---|---|
| A folder | Shows that folder | Shows the folder (plan 04) |
| A file | Stays as it is | Shows the file |
| Several items | Only the focused one counts | The focused one |
| Nothing (empty folder) | Stays as it is | Empty |

- **Executing** (double-click, Enter): a file opens as Windows opens it (its default verb, through the host). A folder
  in a pane with a parent is opened by that parent: the parent focuses the folder and shows it in its tree (expanded
  down to it), and the child, following it, shows the folder. A folder in a tree without a parent expands in place
  and is focused; in a list without a parent (a detached one, plan 12) it opens in that list.
- **Open** (the ribbon's button) is a switch for a folder: open (expanded in its tree) or closed; a file has none. In a
  tree it opens or closes the focused folder there; in a child its parent opens the folder (expanded, focused) and the
  child follows; lit while the folder is open. Enter is executing (as a double-click), not Open.
- **Up and typing a path in a child** (Backspace, the location box): the parent goes up, or to the path, and the child
  follows.
- **Pinned child**: a pin in the pane header stops it following until unpinned; its connection and colour stay.
- **Debounce**: arrowing quickly through a parent updates its children once the cursor rests, so a long walk does not
  load every folder on the way. The delay is a setting [default not yet decided].

### 3.4 Making, closing and changing panes

- Actions: New pane (a root, when there is none or as an extra one), New child pane (right of, below, as a tab), New
  tab, Detach, Attach to, Branch colour; from the ribbon and the pane header's menu (plan 12 3.2).
- With the mouse: drag the connector in a pane's header onto another pane to make it that pane's child.
- **Closing**: any pane can be closed, the root and the last pane included. A closed pane's children get its parent as
  their parent, in their own colours; the children of a closed root become roots. With no pane left, the window is
  empty until a new pane is made from the ribbon or the menu.
- Panes are dock items (plan 12: sides, center, groups with tabs); where a pane sits has nothing to do with its
  connections.
- A pane's header shows the active branch's colour and the name of its parent. A parent shows a mark per branch it
  feeds, at the right of its header: the first branch rightmost, each keeping its place; the active one full and
  larger, the others smaller and fainter; a click on one switches to that branch.
- Focus, as LexPen's focus ring in the branch colour: the pane with the keyboard has a 2px border in its branch
  colour and its header filled with it (text in the background colour); the other panes have their header tinted
  with theirs. While the focus is in another window, the ring and the header are dimmed.

### 3.5 The default layout and presets

A new window opens with:

- **The root**, docked left: folders only, linked folders included (junctions, symbolic links, and the shell's folders
  such as This PC, Network and the Recycle Bin, plan 02 3.1), each link marked as one.
- **Its child** filling the rest of the window: files and folders of the folder focused in the root, in the root's
  branch colour.

The location the root starts on: the folder given on the command line, else the window's last state in its project
(3.7), else This PC.

Presets come first, each just panes and connections: dual (the root drives two children in two colours), columns (a
chain of folder panes, as Finder's column view), with preview (a preview child added to the default). Layouts of the
user's own, saved by name, come later.

### 3.6 Keyboard, back and forward

To the parent, to the child, to the next branch: Alt+Shift+Left, Alt+Shift+Right, Alt+Shift+Down (in `keys.json`, as
all keys; Ctrl+arrows stay the panes' own, Ctrl+Shift+arrows select words in the location box, Ctrl+Alt+arrows turn
the screen on some graphics drivers). Back and forward: Alt+Left and Alt+Right, as Explorer, and on the ribbon (Home >
Go).

Back and forward are per branch: one step back restores every pane of the active branch as it was, because a click in
a parent changes several panes at once. A branch here is the chain below one child of the root (each branch of the
root, each tab of plan 12, has its own history): the root, that child, and down from it each pane's child in the
branch it shows. A new step is kept when a folder in the chain changes; a selection made while the folders stay the
same is kept with the current step, so going back brings the selected item back too.

### 3.7 Saved in the project

Panes and their settings, connections and colours, each pane's state per branch (location, selection, focus), the
active branch.

### 3.8 Watching folders

Every folder shown is watched for changes (the lists' folders, the folders open in a tree; folders on disk and on
shares, not the shell's own such as This PC); panes and windows showing the same folder share one watcher. A change
is told once the folder has been quiet for 300 ms; a list reads its folder again where it is (selection and scroll
position kept), a tree the folder's subfolders.

### 3.9 Tests

- Unit (the model, without UI): connect, refuse a cycle, colour taken over from the parent's branch, a new branch
  starting from a copy of the parent's state, a click changing only the active branch's state, activation restoring
  every pane above for that branch, a pinned child not following, closing a pane in the middle (its children to its
  parent), closing a root (its children become roots), closing the last pane, saving and reading back.
- Unit: executing a folder in a child moves its parent's focus; a folder executed in a pane without a parent expands
  there; a file focused in a parent leaves a folder child as it is.
- In the test copy: a new window has the default layout of 3.5 (root left, folders only, links marked; the child
  showing the root's folder); a double-clicked folder in the child is focused in the root and shown in the child;
  Backspace in the child moves the root up; a double-clicked file opens in its program; the example of 3.2 clicked
  through; the presets; dragging a connector; back and forward per branch.

## 4. Open questions

None.

## 5. Status

### Built

- The model of 3.1 without DOM: panes, roots, parent and child, a cycle refused, branch colours, a state per branch,
  activation restoring the panes above, JSON for the project (6.1).
- Following, with the debounce (3.3).
- Executing: a file opens; a folder in a child is opened by its parent; in a tree without a parent it expands in
  place; in a list without a parent it opens in that list (3.3).
- Open as a switch; Up and a typed path in a child go through the parent (3.3).
- Pinning a child: a pin button in the head; unpinned, it catches up (3.3).
- The default layout: the root tree at the left, folders only, links marked; its child list (3.5; 6.1).
- New pane, New child pane (at the right), Close pane, Next and Previous pane (3.4; 6.1).
- A new child starts a new branch in an unused colour and copies the settings (kind, content) of the current child
  (3.1).
- Detach: a child becomes a root on what it shows and keeps its children (3.1; plan 12 3.2).
- Attach: the connector in a pane's head dragged onto another pane; a cycle refused (3.4).
- Branch colour, as the action `branch.colour` 1 to 6: a free colour makes a branch of its own, a sibling's colour
  joins that branch (3.1, 3.4).
- Heads in the branch colour; the branch marks in a parent's head (3.4).
- Focus as LexPen's: the ring and the head in the branch colour (3.4). A parent is drawn in the colour of the path it
  serves: the colour of the last pane down the branches shown, so with a grandchild in a new branch focused, every
  parent up to the root takes that colour (dull, the focused pane bright).
- Keys between panes: to the parent, the child, the next branch (3.6).
- Back and forward per branch, a selection kept with its step (3.6).
- Watching folders (3.8).

### Not yet built

- A child below, as a tab or floating; New tab; Attach to as a submenu; the pane header's menu: moved to plan 12.
- View settings per pane that can be changed: content, view, sort, filter (3.1); a list ignores content.
- Hidden files as a view setting per pane (3.1); for now one setting for every pane, `showHidden` (plan 01 6.2).
- The debounce delay as a setting (3.3); it is fixed at 150 ms (6.1).
- Saving the layout in the project (3.7, needs plan 01's projects).
- The presets other than the default (3.5).

## 6. As built

### 6.1 Stage 1 (2026-11-10, branch `plan01-foundation`)

- `web/panes.js`: the model of 3.1 without DOM: panes, roots, parent-child connections (a cycle refused), branch
  colours, a state per colour, activation restoring the panes above, following (3.3), executing (a file opens; a folder
  in a pane with a parent is opened by that parent; in a pane without one it expands in place), pinning, closing (any
  pane; its children to its parent; a root's children become roots), JSON for the project. The code calls the parent
  `source`.
- `web/app.js`: the default layout of 3.5: the root as a tree of folders (your profile folder, This PC, Network, the
  Recycle Bin; links marked "link"), a splitter, the child list (files and folders, Explorer's menu, drag out, drop,
  Delete, Backspace, F5, "List as administrator" when access is denied), the Preview button adding a preview child
  (plan 04's Windows handlers). Heads in their branch colour, marks for other branches. A path typed in the location
  box, and Backspace in a child, go through the parent. The debounce is 150 ms (3.3).
- Since (with plan 01's actions and ribbon): New pane (a root tree at the end of the window), New child pane (a list
  at the right of the active pane, following it; a child of a file selection stays empty until a folder is focused),
  Close pane (its children to its parent; with none left the status line says how to make one), Next / Previous pane,
  Hidden items; drives in This PC sorted by letter, before the rest.
- Host: listings per channel (a pane, a tree node: a new one stops only the old one of the same channel), folders only
  for the tree, links marked (junctions and symbolic links; the shell's link flag), `describe` for the tree's top,
  `execute` running the default command of Explorer's menu (as a double-click in Explorer).

### 6.2 Since (2026-11-10)

- `panes.js`: `detach`, `attach` (a cycle refused; a new branch beside other children), `setColour` (a free colour:
  a branch of its own from the parent's state; a sibling's: joins it, the parent's old state going when no child is
  left in it); a parent whose last child leaves keeps what it showed; executing a folder in a list without a parent
  (or pinned) opens it in that list.
- `app.js`: the connector and the pin in each head (drawn in CSS), Detach, Pin and Branch colour as actions (Detach
  and Pin on View > Panes); the history per branch (`branchChain`, `recordStep`, `goHistory`; at most 100 steps per
  branch); the keys of 3.6; folders shown told to the host (`watch`), lists read again in place (`reread`).
- Host: `Shell/FolderWatch.cs` (a `FileSystemWatcher` per folder, shared, told after 300 ms of quiet), the `watch` op.
- Fixed after use: in a list the focus outline stayed on the item clicked before until the window was drawn again
  (the list drew before its focus was set); checked over CDP: a click on another item moves the outline at once.
- After use: the selected rows of a pane without the keyboard are a little less strong (the selection colour mixed
  55% into the background), and so are those of every pane while another window has the focus (which pane gets the
  keys back is not known then). Measured over CDP: active list full, tree lighter; focus away, both lighter.

### 6.3 How it was tested

- `dotnet test`: `PanesTests` runs `panes.js` under Jint (the example of 3.2, executing, closing, JSON); the count of
  the last run is in the commit's report.
- A test copy over CDP, started on a scratch folder: the tree came up expanded down to it from This PC, the child
  listed its files; a folder executed in the child was focused in the tree and listed in the child; Backspace went
  back to the parent folder through the tree; Preview added a preview child in the same branch (`p3`, parent `p2`,
  blue) that showed `one.txt` through its Windows handler. The window drawn by `PrintWindow` showed the three panes.
- A second child of the tree (New child pane with the tree active) came up red beside the blue one; the tree focused
  `two` for red and `one` for blue, and switching between the two lists brought the tree's focus and colour back each
  time, the other list staying as it was.
- Executing a file (its program starting on the desktop) is left for the checks by hand.
- Unit (`PanesTests`): detach (a root keeping its children; the parent forgetting the branch, or keeping what it
  showed when it was the last child), attach (a cycle refused, a new branch), another colour (its own branch, joining
  a sibling's), a list without a parent opening a folder in itself.
- Test copy: Detach on the list, then a double-click on `deep` opened it in the list while the tree stayed; the
  connector dragged onto the tree attached it again; a second child set to branch colour 1 joined the first and showed
  its folder; pinned, the list stayed on `one` while the tree went to `deep`, and unpinned it went to `deep`. Back and
  forward: the tree to `one`, `deep`, `two`, then Back twice (`one`) and Forward (`deep`), list with it; `b.txt`
  selected in `one`, then `two`, then Alt+Left: `one` with `b.txt` selected again; Alt+Shift+Left / Right / Down
  went to the tree, back to the list, and to a second branch. Watching: a file made and removed in the list's folder
  from outside appeared and went, `b.txt` staying selected; a folder made and removed in a folder open in the tree
  appeared and went there.
