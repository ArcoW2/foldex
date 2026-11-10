# Plan 03: Connected panes and branches

Status: draft 2026-11-10, revised 2026-11-10 (collection panes, plan 06; state per branch; default layout, executing;
parent and child, the open questions answered); partly executed 2026-11-10 (stage 1: the model, the default layout,
executing); see 5. As built. The core idea of Foldex.

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
  cycles: a connection that would make one is refused. A pane cannot be disconnected from its parent (for now).
- **Root**: a pane without a parent; the window's first pane is one.
- **Branch**: a colour on parent-child connections. A parent's children of the same colour belong to one branch;
  different colours are different branches. A parent's first child continues the parent's branch (its colour); a
  further child starts a new branch, in a colour not yet used in the window (with all taken, the one used least). Two
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
  down to it), and the child, following it, shows the folder. A folder in a pane without a parent expands in place, as
  in a tree, and is focused.
- **Open** (the ribbon's button) is a switch for a folder: open (expanded in its tree) or closed; a file has none. In a
  tree it opens or closes the focused folder there; in a child its parent opens the folder (expanded, focused) and the
  child follows; lit while the folder is open. Enter is executing (as a double-click), not Open.
- **Up and typing a path in a child** (Backspace, the location box): the parent goes up, or to the path, and the child
  follows.
- **Pinned child**: a pin in the pane header stops it following until unpinned; its connection and colour stay.
- **Debounce**: arrowing quickly through a parent updates its children once the cursor rests, so a long walk does not
  load every folder on the way. The delay is a setting [default not yet decided].

### 3.4 Making, closing and changing panes

- Actions: New pane (a root, when there is none or as an extra one), New child pane (right of, below, floating),
  Branch colour; from the ribbon and the menus.
- With the mouse: drag the connector in a pane's header onto another pane to make it that pane's child.
- **Closing**: any pane can be closed, the root and the last pane included. A closed pane's children get its parent as
  their parent, in their own colours; the children of a closed root become roots. With no pane left, the window is
  empty until a new pane is made from the ribbon or the menu.
- Panes are dock items (LexPen's docking, plan 01); where a pane sits has nothing to do with its connections.
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

To the child, to the parent, to the next branch (keys [not yet decided], in `keys.json` as all keys). Back and forward
are per branch: one step back restores every pane of the active branch as it was, because a click in a parent changes
several panes at once.

### 3.7 Saved in the project

Panes and their settings, connections and colours, each pane's state per branch (location, selection, focus), the
active branch.

### 3.8 Watching folders

Every folder shown is watched for changes; panes showing the same folder share one watcher.

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

## 5. As built

### 5.1 Stage 1 (2026-11-10, branch `plan01-foundation`)

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

### 5.2 Not built yet

Connector dragging (3.4), a child below or floating (only at the right now), choosing a branch colour (a further
child gets a new one; joining a sibling's branch is not possible yet), view settings per pane (a new child copies
kind and content from the current child, but no action changes them yet and a list ignores content), pinning in the page, docking (plan 01), keys and back and
forward per branch (3.6), saving the layout in the project (3.7, needs plan 01's projects), folder watching (3.8), the
presets other than the default (3.5), the hidden files setting (hidden and system folders such as
`System Volume Information` show for now).

### 5.3 How it was tested

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
