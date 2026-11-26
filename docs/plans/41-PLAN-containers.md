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
click there opens the Containers menu: every container, to open (as a project opens) or close, a new one, rename,
password, delete. A container can have a password: it is asked when the container opens, and before any change to it
while it is closed; not again while Foldex has it open anywhere. Once it is closed, it is asked again. A container can be switched to never open by itself: it
then opens only when chosen. At start, the containers that were open come back, except those.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Container store | `ContainerStore.cs`: the containers, their folders, passwords and switches, in the top `State\containers.json` | -- | 3.1, 3.4 |
| Data folder per container | `DataFolder` resolves a container's folder; Default is the top folder | -- | 3.1 |
| Process per container | `--container`, a mutex and pipe per container, a launch routed to the right one | Q3 | 3.2, 3.3 |
| Start and close | which containers come back at start; the never-open switch; closing a container | -- | 3.3 |
| Password | set, change, remove; asked when a locked container opens, and before a change to it while closed | Q1 | 3.4 |
| Bottom bar and Containers menu | the container left of the project; the menu of 3.5 | -- | 3.5 |
| Dialogs | the name, the password, the delete question | -- | 3.5 |
| Ribbon and actions | the actions of 3.5, View > Containers | -- | 3.5 |
| New and Duplicate | a new container from Foldex's defaults, or a copy of one | Q2 | 3.6 |
| Tests | the store, the routing, the folders; checks in a test copy | -- | 3.8 |

## 3. Details

### 3.1 What a container is, and where it lives

- A container has a number (never reused), a name, the time it was created and last opened, an optional password
  (3.4) and the never-open switch (3.3). "Default" cannot be deleted or renamed; it can have a password.
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
  file, as `ProjectStore.cs`.
- Because Default's folder is the top folder, its `State\` holds `containers.json` too. Default's own code never reads
  it; only the container store does.
- Nothing in Foldex's settings acts on Windows as a whole (checked: no registry writes, no start-with-Windows), so
  every setting can be per container. The program's own `defaults\` folder is shared: it is read only.

### 3.2 A process per container

- Everything Foldex keeps goes through `AppHost.DataDir`, set once per process. A process per container, started with
  `--container <number>`, gets that container's folder as `DataDir`. Every file, cache and helper then belongs to that
  container without a change anywhere else. The elevated helper and the lister helper are already per process.
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
- **Start** (Foldex launched while no container runs): the containers open when Foldex last ended come back, each in
  its process and each asking its password when it has one. A container switched to never open by itself does not
  come back; it opens only when chosen. When none is left to come back, Default opens.
- **A launch** while containers run (a folder from Explorer, a shortcut, Win+E when Foldex takes it): to the
  container that was active last, when it is open; else to Default (opened when needed). Only the container named
  with `--container` changes that. Q3 asks whether it should always go to Default instead.
- Virtual desktops (plan 15 3.5): each container's projects keep their own desktops, as now; a launch picks the
  container first, then that container picks its window on the current desktop.

### 3.4 Password

- Set, changed or removed from the Containers menu (3.5): Set password..., Change password..., Remove password.
- **Changing a closed container asks its password first.** A container with a password that is not open asks it
  before any change to it: rename, set, change or remove its password, the never-open switch, duplicate, delete. That
  includes a change made from another container's window: that window asks, in a password dialog over itself, and
  checks it against the hash. An open container asks nothing for a change, as it asks nothing to be opened again.
- Kept as a salted PBKDF2 hash (SHA-256) in `containers.json`, never the password itself. The number of iterations is
  [not yet chosen]; high enough that trying passwords is slow, low enough that opening is not.
- Asked by the container's own process, before it shows any window: a small window of its own with the container's
  name and a password box. A wrong password says so and asks again; Cancel ends that process, so the container stays
  closed. While it runs nothing asks again, also not when it is opened from another container (its window comes to
  the front).
- What it protects: Foldex will not show that container to someone at the PC who does not know the password. It does
  not encrypt the container's files: anyone who can read the user's `%LOCALAPPDATA%` can read its bookmarks and
  settings, and can open the container by removing the hash from `containers.json`. That last part is also the way
  back from a forgotten password. Q1 asks whether encryption is wanted.

### 3.5 Bottom bar, menu, ribbon, dialogs

- The bottom bar shows the container at its left, left of the project, with a lock mark when it has a password. A
  click opens the Containers menu; a click while it is open closes it (the generic opener, `menu.js`).
- The Containers menu: every container, the open ones marked and the current one checked, each with a submenu, as a
  project in the Projects menu (plan 15 3.6); then New container... (3.6). A container's submenu:
  - Open (3.3), first;
  - Duplicate... (3.6);
  - Rename... (not Default);
  - Set password... / Change password... / Remove password;
  - Never open by itself (a check);
  - Close (when open);
  - Delete... (not Default; not while open; asks first); its folder goes to the Recycle Bin.

  Each change of a closed container with a password asks its password first (3.4).
- The same commands are actions, in the default ribbon under View > Containers, next to Projects; there they work on
  the current container. A ribbon is per container, so a ribbon made before this has the group only after Reset or
  when added by hand (plan 19).
- Windows (plan 14 3.7): the name dialog, both password windows (at start, and before a change) and the delete
  question are floating only, modal; the menu is a menu. The password window at start has no Foldex window to be
  over; it stands on its own.

### 3.6 New and Duplicate

- **New container**: an empty folder, so it starts as Foldex does on a new PC: Foldex's defaults, the bookmarks from
  Explorer's pinned folders, one project.
- **Duplicate container**: a copy of a container's folder without its `State\` (no projects, caches or browser
  profile). Its settings, ribbon, themes, bookmarks, column sets, filters, macros and keys are copied; its password
  is not.
- Q2 asks whether New should start from the current container's look (settings, ribbon, themes) rather than from the
  defaults.

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
  password before a rename, a password change, the never-open switch, a duplicate and a delete, an open one does not;
  a never-open container does not come back at start; a launch goes to the container of 3.3.

## 4. Open questions

1. **Password: a lock or encryption?** The plan locks a container in Foldex only (3.4): its files stay readable on
   disk. Encrypting them means every file, cache and the WebView2 profile of a container stays encrypted at rest, and
   a forgotten password loses that container. That would be a much larger plan of its own. The lock is the
   recommendation.
2. **A new container: defaults or the current look?** The plan starts a new one from Foldex's defaults (3.6), with
   Duplicate for a full copy. The alternative: a new one takes the current container's settings, ribbon and themes,
   but none of its bookmarks or projects.
3. **A launch without `--container`**: to the container active last (3.3, the recommendation) or always to Default?
4. **The name**: "container" or "space"? The plan uses "container". Foldex's own scrap is called scrap in the UI, so
   neither name clashes there; xplorer2 calls its scrap a "scrap container", which only `docs/xplorer2-features.md`
   mentions.
5. **Foldex and LexPen: one list of containers or one each?** Once LexPen has containers too, they can be the same
   (a "Work" container in both, its password asked once for both) or each program its own. The same list needs a
   place both read, outside either program's data folder. The plan does not decide it yet; it keeps the list in
   Foldex's own folder (3.1).

## 5. (not used)
