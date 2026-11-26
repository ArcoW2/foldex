# Plan 41: Profiles

Status: executed; see Status and 6.

- 2026-11-26: draft.
- 2026-11-26: executed.

Above projects (plan 15) and their virtual desktops. LexPen has nothing like it yet: Foldex leads here, and LexPen
takes the same over once it is built in Foldex. So the parts that are not Foldex's own (the profile store, the
data folder per profile, the process per profile, the password window) are kept free of Foldex's panes and
pages, to be taken over as they are. The number in the file name is the priority; rename to reorder.

## 1. What this is about

Projects keep a window's layout apart, but everything else is shared by all of them: the bookmarks and quick access,
the ribbon, the themes, the settings, the column sets, the filters, the macros. There is no way to keep whole working
worlds apart (work and private, or one customer and another), and no way to keep one of them from someone else who
sits at the PC.

## 2. The solution, in brief

A profile is a complete Foldex of its own: its own projects and layouts, bookmarks, quick access, ribbon, themes,
settings and everything else Foldex keeps. "Default" is the one that exists from the start; it is the data Foldex has
now. Each profile runs in its own Foldex process with its own data folder, so they stay apart without any part of
Foldex having to know about profiles. The profile is shown at the left of the bottom bar, left of the project; a
click there opens the Profiles menu: every profile, to open (as a project opens) or close, copy to a new one (a new
profile is always a copy of another), rename, password, delete. A profile other than Default can have a password,
shown by a lock: it locks the profile in Foldex, it does not encrypt its files. It is asked when the profile opens,
and before a change to it while it is closed; not again while Foldex has it open anywhere. Once it is closed, it is
asked again. Copying a profile with a password always asks it; the copy has none. Deleting one asks its password
and then whether you are sure; without the password it warns first that the profile has one. Deleting the current
profile closes its window and opens Default, which removes the folder. A profile can be
switched to never open by itself: it then opens only when chosen. At start, the profiles that were open come back,
except those.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Profile store | `ProfileStore.cs`: the profiles, their folders, passwords and switches, in the top `State\profiles.json` | 3.1, 3.4; 6.1 |
| Data folder per profile | `DataFolder.ProfileDir`; Default is the top folder | 3.1 |
| Process per profile | `--profile`, a mutex and pipe per profile (`ProfileProcesses`), none given: Default | 3.2, 3.3; 6.1 |
| Start and close | which profiles come back at start; the never-open switch; Close profile | 3.3; 6.1 |
| Password | set, change, remove (not for Default); asked at start, before a change while closed, before a copy; the lock mark | 3.4, 3.5; 6.1 |
| Delete | the two flows; an open profile closed first; the current one removed by Default | 3.6; 6.1 |
| Bottom bar and Profiles menu | the profile left of the project; the menu of 3.5 | 3.5 |
| Dialogs | the name (askText), the passwords, the delete warning and question (AskForm) | 3.5, 3.6; 6.1 |
| Ribbon and actions | View > Profiles: Profiles, Copy, Rename, Password, Close | 3.5; 6.1 |
| Copy | a new profile as a copy of another | 3.6 |
| Tests | `ProfileStoreTests`, `DataFolderTests`, `ProgramTests`; checks in a test copy | 3.8; 6.2 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
## 3. Details

### 3.1 What a profile is, and where it lives

- A profile has a number (never reused), a name, the time it was created and last opened, an optional password
  (3.4) and the never-open switch (3.3). "Default" cannot be deleted or renamed, and has no password: Foldex must
  always be able to start, and Default is what opens when nothing else does (3.3).
- Its data folder is a complete Foldex data folder (`DataFolder`): `settings.json`, `bookmarks.json`, `ribbon.json`,
  `bars.json`, `keys.json`, `columnsets.json`, `filters.json`, `macros.json`, `searches.json`, `renames.json`,
  `listers.json`, `themes\`, and `State\` with its projects, folder use, the folder cache, the thumbnails and the
  WebView2 data (`EBWebView\`). Nothing of one profile is in another's folder, so nothing leaks between them,
  not even the thumbnails or the folder cache.
- Default's data folder is the top folder (`%LOCALAPPDATA%\Foldex`, or `FOLDEX_DATA` in a test copy), as now: nothing
  moves when this is built. Every other profile's folder is `Profiles\<number>\` under it. By number, not by
  name, so a rename moves nothing and any name can be used.
- The list of profiles is the only thing above them: `State\profiles.json` in the top folder, written as
  `projects.json` is (whole, to a temporary file that then replaces it). `ProfileStore.cs`, pure apart from that
  file, as `ProjectStore.cs`. Foldex and LexPen each keep their own list in their own top folder: a "Work" profile
  in one is not one in the other, and each has its own password.
- Because Default's folder is the top folder, its `State\` holds `profiles.json` too. Default's own code never reads
  it; only the profile store does.
- Nothing in Foldex's settings acts on Windows as a whole (checked: no registry writes, no start-with-Windows), so
  every setting can be per profile. The program's own `defaults\` folder is shared: it is read only.

### 3.2 A process per profile

- Everything Foldex keeps goes through `AppHost.DataDir`, set once per process. A process per profile, started with
  `--profile <number>`, gets that profile's folder as `DataDir`. Every file, cache and helper then belongs to that
  profile without a change anywhere else. The elevated helper and the lister helper are already per process.
- **No profile given is Default**: a process started without `--profile` is Default's, with the top folder as
  `DataDir`, as Foldex is now.
- The single-instance mutex and pipe (`Program.PipeName`) get the profile's number, so each profile has its own
  running instance, and a launch for it goes to that one.
- Each profile has its own WebView2 data in its own `State\`, so the profiles share no browser state.
- Memory: each open profile is a process with its own WebView2. That cost is [not yet measured].

### 3.3 Opening, closing, start, launches

- **Open**: from the Profiles menu (3.5) or `Foldex.exe --profile <name or number>`. An open profile's window
  comes to the front; a closed one starts its process, which asks for the password first when it has one (3.4) and
  then opens its projects as Foldex does now (plan 15 3.4).
- **Close**: the menu's Close profile closes every window of that profile; its process ends when its last window
  closes, as now (`AppHost` ends with its last window). Closed, it needs its password again.
- **Open or closed**: a profile is open while its process runs. The store keeps per profile whether it was open
  when Foldex last ended. A profile closed while another still runs is marked closed. The last process to end
  keeps its mark, and so do all processes ending at the same time because Windows shuts down or signs out.
- **Start** (Foldex launched while no profile runs): the process is Default's (3.2). It starts the profiles open
  when Foldex last ended, each in its process and each asking its password when it has one. A profile switched to
  never open by itself does not come back; it opens only when chosen. Default shows its own window when it was open
  too, or when none is left to come back; else its process ends once the others have started.
- **A launch** while profiles run (a folder from Explorer, a shortcut, Win+E when Foldex takes it): to Default
  (opened when needed), unless it names a profile with `--profile`.
- Virtual desktops (plan 15 3.5): each profile's projects keep their own desktops, as now; a launch picks the
  profile first, then that profile picks its window on the current desktop.

### 3.4 Password

- Set, changed or removed from the Profiles menu (3.5): Set password..., Change password..., Remove password. Not
  for Default (3.1).
- **Changing a closed profile asks its password first.** A profile with a password that is not open asks it
  before a change to it: rename, set, change or remove its password, the never-open switch. That includes a change
  made from another profile's window: that window asks, in a password dialog over itself, and checks it against
  the hash. An open profile asks nothing for these, as it asks nothing to be opened again.
- **Copy and Delete ask it always**, open or not (3.6).
- Kept as a salted PBKDF2 hash (SHA-256) in `profiles.json`, never the password itself. The number of iterations is
  [not yet chosen]; high enough that trying passwords is slow, low enough that opening is not.
- Asked by the profile's own process, before it shows any window: a small window of its own with the profile's
  name and a password box. A wrong password says so and asks again; Cancel ends that process, so the profile stays
  closed. While it runs nothing asks again, also not when it is opened from another profile (its window comes to
  the front).
- What it protects: Foldex will not show that profile to someone at the PC who does not know the password. It does
  not encrypt the profile's files: anyone who can read the user's `%LOCALAPPDATA%` can read its bookmarks and
  settings, and can open the profile by removing the hash from `profiles.json`. That last part is also the way
  back from a forgotten password. Encrypting the folder is not part of this plan.

### 3.5 Bottom bar, menu, ribbon, dialogs

- The bottom bar shows the profile at its left, left of the project, with a lock mark when it has a password. A
  click opens the Profiles menu; a click while it is open closes it (the generic opener, `menu.js`).
- The Profiles menu: every profile, the open ones marked, the current one checked and the ones with a password
  with the lock mark, each with a submenu of its commands. There is no New profile: a new one is always a copy
  (3.6). Unlike the Projects menu (plan 15 3.6), it shows nothing of what a profile
  holds: no projects, windows, panes or folders, of no profile, the current one included (its projects are in the
  Projects menu). A profile's submenu:
  - Open (3.3), first;
  - Copy to a new profile... (3.6);
  - Rename... (not Default);
  - Set password... / Change password... / Remove password (not Default);
  - Never open by itself (a check);
  - Close (when open);
  - Delete... (not Default; 3.6).

  A change of a closed profile with a password asks its password first; Copy and Delete ask it always (3.4).
- The same commands are actions, in the default ribbon under View > Profiles, next to Projects; there they work on
  the current profile. A ribbon is per profile, so a ribbon made before this has the group only after Reset or
  when added by hand (plan 19).
- Windows (plan 14 3.7): the name dialog, both password windows (at start, and before a change), the delete warning
  and the delete question are floating only, modal; the menu is a menu. The password window at start has no Foldex window to be
  over; it stands on its own.

### 3.6 Copy and Delete

- **A new profile is always a copy** of an existing one; there is no empty new profile.
- **Copy to a new profile**: a new profile with a copy of the source's folder without its `State\` (no projects,
  caches or WebView2 data). Its settings, ribbon, themes, bookmarks, column sets, filters, macros and keys are
  copied. A source with a password asks it first, also when it is open (the copy takes everything that is in it).
  The password is not copied: the new profile has none. Its name is asked first (the name dialog, 3.5).
- **Delete**, two flows for a profile with a password, both asked by the window it is chosen in:
  1. The password entered (also when the profile is open): then the question below.
  2. The password box left empty (Delete pressed without it): first "This profile has a password. Are you sure you
     want to delete it?", then the question below. A wrong password is not this flow: it says so and asks again.

  A profile without a password goes to the question at once. The question: "Delete profile <name>? This cannot
  be undone: its projects, layouts, ribbon, themes, bookmarks, quick access, settings and everything else in it are
  removed." Yes deletes it. For the current profile (the one of the window it is chosen in) the question adds:
  "This window closes and Default opens."
- Deleting removes the profile's folder permanently, not to the Recycle Bin, as the question says, and takes it out
  of `profiles.json`. An open profile is closed first: the window that deletes it tells its process to close
  (over its pipe), waits until it has ended, then removes the folder.
- **The current profile** is deleted by Default: its window asks Default to delete it (over Default's pipe, starting
  Default when it is not running), then closes every window of the profile. Default comes to the front, waits until
  the deleted profile's process has ended, then removes its folder and takes it out of `profiles.json`. Default
  marks it deleted at once, so it is not opened again while the folder is still there.

### 3.7 What stays the same

- Projects, their windows, their desktops and Manage projects work within one profile as now. The Projects menu
  shows the projects of the profile the window belongs to.
- No pane, list or tree knows about profiles. Copying, moving and dragging files between windows of two profiles
  works as between Foldex and Explorer: they are separate programs.

### 3.8 Tests

- `ProfileStore`: create, rename, delete, the numbers never reused; set, check, change and remove a password, with
  the hash, never the password, in the file; the open marks and the never-open switch, and what start opens from them
  (a closed one, a never-open one, none left: Default).
- `DataFolder`: Default is the top folder; another profile's folder by its number.
- `Program`: `--profile` parsed; the pipe and mutex names per profile.
- In a test copy (`FOLDEX_DATA`): two profiles open at once with different bookmarks and ribbons; a locked profile
  asks once, opening it again while open does not ask, after Close it asks again; a closed locked profile asks its
  password before a rename, a password change and the never-open switch, an open one does not; a copy of a locked
  profile asks its password open or closed, and the copy has no password; Default offers no password; both delete
  flows (password, then the question; no password, the warning, then the question), an open profile closed
  before its folder goes; the current profile deleted: the question says its window closes and Default opens,
  Default comes up (also when it was not running) and removes the folder after the process has ended; a never-open
  profile does not come back at start; a launch without `--profile` goes to Default; the lock mark in the bottom
  bar and the menu for a profile with a password.

## 4. Open questions

None.

## 5. (not used)

## 6. As built

### 6.1 What differs or was decided

- **Where it lives**: `ProfileStore.cs` (the list, pure apart from its file), `ProfileProcesses.cs` (running, starting,
  telling a profile's process; its passwords; copying and removing its folder), `Program.cs` (`--profile`, the
  password at start, the start of 3.3), `AppHost.cs` (the commands, the pipe's `close`, `profileChanged` and
  `removeDeleted`), `projectmenu.js` (the bottom bar and the menu), `actions.js`, `ribbonicons.js`,
  `defaults\ribbon.json`.
- **The profile of a process** is `FOLDEX_PROFILE`, set by `Program` from `--profile` before `AppHost.DataDir` is
  read; the helpers a profile's process starts (the lister helper) inherit it. Default keeps the pipe and mutex name
  Foldex had before, so nothing changes for it.
- **Every process writes `profiles.json`**: a change reads it anew and writes it under a named mutex
  (`ProfileStore.Change`). Whether a profile is open is not stored: its mutex exists while its process runs.
- **The passwords** are asked by the host in Foldex's own question window (`AskForm`, given a password box), over the
  window they are asked from; at start on its own. PBKDF2 with SHA-256 at 600,000 iterations (OWASP's Password Storage
  Cheat Sheet for that hash), kept per profile with its salt so a later count does not break the ones set before. A
  new password is typed twice; an empty one is refused (Remove password takes it away). The name of a copy or a rename
  is asked in the page (`askText`), after the password.
- **Close profile** closes every window as Windows does: its projects stay open and come back when the profile opens
  again. Its process ends with its last window; closed while another profile still runs, it is marked not to come
  back at start.
- **Delete** marks the profile deleted at once (it is no longer listed or opened), then the folder is removed once its
  process has ended, tried again for a while (WebView2's own processes can hold files a bit after). A folder that still
  cannot go stays marked, and Default removes it at its next start. Deleting the current profile shows Default (started
  with `--profile 0` when it is not running) and tells it over its pipe to remove it.
- **Never open by itself** is offered for Default too: at start Default then opens only when nothing else comes back.
- **An unknown `--profile`** says so in an error window and starts nothing.
- **The menu's lock** is a `mark` of a menu item (`menu.js`), an element after its label; the bottom bar shows the
  same lock after the name.
- **The window title** names the profile when it is not Default, without Foldex's version (that is in F1's About):
  `Foldex - Work/Project 1`; in Default `Foldex - Project 1`. A rename of the profile retitles its windows.

### 6.2 Tests

- `ProfileStoreTests`: Default only without a file; numbers never reused, free names; Default cannot be renamed,
  deleted or get a password; the hash, never the password, in the file, checked and removed; a deleted profile not
  listed or found; found by number or name; what start opens (never-open, none left: Default); a copy without
  `State\` and the other profiles. `DataFolderTests`: the folders per profile. `ProgramTests`: `--profile` taken out;
  Default's pipe name as before, another profile's its own.
- In a test copy (`FOLDEX_DATA`), each profile's page through its own debugging port and the dialogs through UI
  Automation: Default on the existing data shows "Default" left of the project; a copy has the settings, not `State\`;
  the copy opens as its own process with its own WebView2 data, and a setting changed there stays out of Default; both
  come back at the next start; a password set (typed twice) shows the lock; Close from Default closes it and marks it
  closed; a change of it closed asks the password (a wrong one says so); opening it asks at start (Cancel keeps it
  closed), opening it again while open asks nothing; Copy asks the password while it is open, the copy has none;
  Delete without a password asks the question only; with the box empty the warning, then the question, the open
  profile closed and its folder removed; the current profile deleted with Default closed: the question says this
  window closes and Default opens, Default starts and removes the folder.
- Not checked in the app: the never-open switch at start (the store test has it), marks kept at a Windows shutdown.