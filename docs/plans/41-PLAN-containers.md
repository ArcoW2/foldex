# Plan 41: Containers

Status: not started; see Status.

- 2026-11-26: draft.

Above projects (plan 15) and their virtual desktops. LexPen has nothing like it yet: Foldex leads here, and LexPen
takes the same over once it is built in Foldex. So the parts that are not Foldex's own (the container store, the
data folder per container, the process per container, the password window) are kept free of Foldex's panes and
pages, to be taken over as they are. The number in the file name is the priority; rename to reorder.

## 1. What this is about

Projects keep a window's layout apart, but everything else is shared by all of them: the bookmarks and quick access,
the ribbon, the themes, the settings, the column sets, the filters, the macros. There is no way to keep whole working
worlds apart (work and private, or one customer and another), and no way to keep one of them from someone else who
sits at the PC.

## 2. The solution, in brief

A container is a complete Foldex of its own: its own projects and layouts, bookmarks, quick access, ribbon, themes,
settings and everything else Foldex keeps. "Default" is the one that exists from the start; it is the data Foldex has
now. Each container runs in its own Foldex process with its own data folder, so they stay apart without any part of
Foldex having to know about containers. The container is shown at the left of the bottom bar, left of the project; a
click there opens the Containers menu: every container, to open (as a project opens) or close, copy to a new one (a new
container is always a copy of another), rename, password, delete. A container other than Default can have a password,
shown by a lock: it locks the container in Foldex, it does not encrypt its files. It is asked when the container opens,
and before a change to it while it is closed; not again while Foldex has it open anywhere. Once it is closed, it is
asked again. Copying a container with a password always asks it; the copy has none. Deleting one asks its password
and then whether you are sure; without the password it warns first that the container has one. Deleting the current
container closes its window and opens Default, which removes the folder. A container can be
switched to never open by itself: it then opens only when chosen. At start, the containers that were open come back,
except those.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Container store | `ContainerStore.cs`: the containers, their folders, passwords and switches, in the top `State\containers.json` | -- | 3.1, 3.4 |
| Data folder per container | `DataFolder` resolves a container's folder; Default is the top folder | -- | 3.1 |
| Process per container | `--container`, a mutex and pipe per container, a launch routed to the right one; none given: Default | -- | 3.2, 3.3 |
| Start and close | which containers come back at start; the never-open switch; closing a container | -- | 3.3 |
| Password | set, change, remove (not for Default); asked when a locked container opens, before a change to it while closed, and before a copy; the lock mark | -- | 3.4, 3.5 |
| Delete | the two flows of 3.6: with the password, or the warning that it has one; then the question; an open container closed first; the current one deleted by Default | -- | 3.6 |
| Bottom bar and Containers menu | the container left of the project; the menu of 3.5 | -- | 3.5 |
| Dialogs | the name, the password, the delete warning and question | -- | 3.5, 3.6 |
| Ribbon and actions | the actions of 3.5, View > Containers | -- | 3.5 |
| Copy | a new container as a copy of another | -- | 3.6 |
| Tests | the store, the routing, the folders; checks in a test copy | -- | 3.8 |

## 3. Details

### 3.1 What a container is, and where it lives

- A container has a number (never reused), a name, the time it was created and last opened, an optional password
  (3.4) and the never-open switch (3.3). "Default" cannot be deleted or renamed, and has no password: Foldex must
  always be able to start, and Default is what opens when nothing else does (3.3).
- Its data folder is a complete Foldex data folder (`DataFolder`): `settings.json`, `bookmarks.json`, `ribbon.json`,
  `bars.json`, `keys.json`, `columnsets.json`, `filters.json`, `macros.json`, `searches.json`, `renames.json`,
  `listers.json`, `themes\`, and `State\` with its projects, folder use, the folder cache, the thumbnails and the
  WebView2 profile (`EBWebView\`). Nothing of one container is in another's folder, so nothing leaks between them,
  not even the thumbnails or the folder cache.
- Default's data folder is the top folder (`%LOCALAPPDATA%\Foldex`, or `FOLDEX_DATA` in a test copy), as now: nothing
  moves when this is built. Every other container's folder is `Containers\<number>\` under it. By number, not by
  name, so a rename moves nothing and any name can be used.
- The list of containers is the only thing above them: `State\containers.json` in the top folder, written as
  `projects.json` is (whole, to a temporary file that then replaces it). `ContainerStore.cs`, pure apart from that
  file, as `ProjectStore.cs`. Foldex and LexPen each keep their own list in their own top folder: a "Work" container
  in one is not one in the other, and each has its own password.
- Because Default's folder is the top folder, its `State\` holds `containers.json` too. Default's own code never reads
  it; only the container store does.
- Nothing in Foldex's settings acts on Windows as a whole (checked: no registry writes, no start-with-Windows), so
  every setting can be per container. The program's own `defaults\` folder is shared: it is read only.

### 3.2 A process per container

- Everything Foldex keeps goes through `AppHost.DataDir`, set once per process. A process per container, started with
  `--container <number>`, gets that container's folder as `DataDir`. Every file, cache and helper then belongs to that
  container without a change anywhere else. The elevated helper and the lister helper are already per process.
- **No container given is Default**: a process started without `--container` is Default's, with the top folder as
  `DataDir`, as Foldex is now.
- The single-instance mutex and pipe (`Program.PipeName`) get the container's number, so each container has its own
  running instance, and a launch for it goes to that one.
- Each container has its own WebView2 profile in its own `State\`, so the containers share no browser state.
- Memory: each open container is a process with its own WebView2. That cost is [not yet measured].

### 3.3 Opening, closing, start, launches

- **Open**: from the Containers menu (3.5) or `Foldex.exe --container <name or number>`. An open container's window
  comes to the front; a closed one starts its process, which asks for the password first when it has one (3.4) and
  then opens its projects as Foldex does now (plan 15 3.4).
- **Close**: the menu's Close container closes every window of that container; its process ends when its last window
  closes, as now (`AppHost` ends with its last window). Closed, it needs its password again.
- **Open or closed**: a container is open while its process runs. The store keeps per container whether it was open
  when Foldex last ended. A container closed while another still runs is marked closed. The last process to end
  keeps its mark, and so do all processes ending at the same time because Windows shuts down or signs out.
- **Start** (Foldex launched while no container runs): the process is Default's (3.2). It starts the containers open
  when Foldex last ended, each in its process and each asking its password when it has one. A container switched to
  never open by itself does not come back; it opens only when chosen. Default shows its own window when it was open
  too, or when none is left to come back; else its process ends once the others have started.
- **A launch** while containers run (a folder from Explorer, a shortcut, Win+E when Foldex takes it): to Default
  (opened when needed), unless it names a container with `--container`.
- Virtual desktops (plan 15 3.5): each container's projects keep their own desktops, as now; a launch picks the
  container first, then that container picks its window on the current desktop.

### 3.4 Password

- Set, changed or removed from the Containers menu (3.5): Set password..., Change password..., Remove password. Not
  for Default (3.1).
- **Changing a closed container asks its password first.** A container with a password that is not open asks it
  before a change to it: rename, set, change or remove its password, the never-open switch. That includes a change
  made from another container's window: that window asks, in a password dialog over itself, and checks it against
  the hash. An open container asks nothing for these, as it asks nothing to be opened again.
- **Copy and Delete ask it always**, open or not (3.6).
- Kept as a salted PBKDF2 hash (SHA-256) in `containers.json`, never the password itself. The number of iterations is
  [not yet chosen]; high enough that trying passwords is slow, low enough that opening is not.
- Asked by the container's own process, before it shows any window: a small window of its own with the container's
  name and a password box. A wrong password says so and asks again; Cancel ends that process, so the container stays
  closed. While it runs nothing asks again, also not when it is opened from another container (its window comes to
  the front).
- What it protects: Foldex will not show that container to someone at the PC who does not know the password. It does
  not encrypt the container's files: anyone who can read the user's `%LOCALAPPDATA%` can read its bookmarks and
  settings, and can open the container by removing the hash from `containers.json`. That last part is also the way
  back from a forgotten password. Encrypting the folder is not part of this plan.

### 3.5 Bottom bar, menu, ribbon, dialogs

- The bottom bar shows the container at its left, left of the project, with a lock mark when it has a password. A
  click opens the Containers menu; a click while it is open closes it (the generic opener, `menu.js`).
- The Containers menu: every container, the open ones marked, the current one checked and the ones with a password
  with the lock mark, each with a submenu of its commands. There is no New container: a new one is always a copy
  (3.6). Unlike the Projects menu (plan 15 3.6), it shows nothing of what a container
  holds: no projects, windows, panes or folders, of no container, the current one included (its projects are in the
  Projects menu). A container's submenu:
  - Open (3.3), first;
  - Copy to a new container... (3.6);
  - Rename... (not Default);
  - Set password... / Change password... / Remove password (not Default);
  - Never open by itself (a check);
  - Close (when open);
  - Delete... (not Default; 3.6).

  A change of a closed container with a password asks its password first; Copy and Delete ask it always (3.4).
- The same commands are actions, in the default ribbon under View > Containers, next to Projects; there they work on
  the current container. A ribbon is per container, so a ribbon made before this has the group only after Reset or
  when added by hand (plan 19).
- Windows (plan 14 3.7): the name dialog, both password windows (at start, and before a change), the delete warning
  and the delete question are floating only, modal; the menu is a menu. The password window at start has no Foldex window to be
  over; it stands on its own.

### 3.6 Copy and Delete

- **A new container is always a copy** of an existing one; there is no empty new container.
- **Copy to a new container**: a new container with a copy of the source's folder without its `State\` (no projects,
  caches or browser profile). Its settings, ribbon, themes, bookmarks, column sets, filters, macros and keys are
  copied. A source with a password asks it first, also when it is open (the copy takes everything that is in it).
  The password is not copied: the new container has none. Its name is asked first (the name dialog, 3.5).
- **Delete**, two flows for a container with a password, both asked by the window it is chosen in:
  1. The password entered (also when the container is open): then the question below.
  2. The password box left empty (Delete pressed without it): first "This container has a password. Are you sure you
     want to delete it?", then the question below. A wrong password is not this flow: it says so and asks again.

  A container without a password goes to the question at once. The question: "Delete container <name>? This cannot
  be undone: its projects, layouts, ribbon, themes, bookmarks, quick access, settings and everything else in it are
  removed." Yes deletes it. For the current container (the one of the window it is chosen in) the question adds:
  "This window closes and Default opens."
- Deleting removes the container's folder permanently, not to the Recycle Bin, as the question says, and takes it out
  of `containers.json`. An open container is closed first: the window that deletes it tells its process to close
  (over its pipe), waits until it has ended, then removes the folder.
- **The current container** is deleted by Default: its window asks Default to delete it (over Default's pipe, starting
  Default when it is not running), then closes every window of the container. Default comes to the front, waits until
  the deleted container's process has ended, then removes its folder and takes it out of `containers.json`. Default
  marks it deleted at once, so it is not opened again while the folder is still there.

### 3.7 What stays the same

- Projects, their windows, their desktops and Manage projects work within one container as now. The Projects menu
  shows the projects of the container the window belongs to.
- No pane, list or tree knows about containers. Copying, moving and dragging files between windows of two containers
  works as between Foldex and Explorer: they are separate programs.

### 3.8 Tests

- `ContainerStore`: create, rename, delete, the numbers never reused; set, check, change and remove a password, with
  the hash, never the password, in the file; the open marks and the never-open switch, and what start opens from them
  (a closed one, a never-open one, none left: Default).
- `DataFolder`: Default is the top folder; another container's folder by its number.
- `Program`: `--container` parsed; the pipe and mutex names per container.
- In a test copy (`FOLDEX_DATA`): two containers open at once with different bookmarks and ribbons; a locked container
  asks once, opening it again while open does not ask, after Close it asks again; a closed locked container asks its
  password before a rename, a password change and the never-open switch, an open one does not; a copy of a locked
  container asks its password open or closed, and the copy has no password; Default offers no password; both delete
  flows (password, then the question; no password, the warning, then the question), an open container closed
  before its folder goes; the current container deleted: the question says its window closes and Default opens,
  Default comes up (also when it was not running) and removes the folder after the process has ended; a never-open
  container does not come back at start; a launch without `--container` goes to Default; the lock mark in the bottom
  bar and the menu for a container with a password.

## 4. Open questions

1. **The name**: "container", "space" or "profile"? The plan uses "container". "Profile" fits the mechanism best:
   browsers use it for exactly this (own data folder, own process, own settings, an optional lock), so users know
   it; but Windows has user profiles too. "Container" says "kept apart" (Firefox uses it for that) and clashes with
   nothing in Foldex's UI; xplorer2's "scrap container" is mentioned only in `docs/xplorer2-features.md`. "Space"
   reads as a place, close to a virtual desktop or a project's layout. The recommendation: "profile", else
   "container".

## 5. (not used)
