# Plan 40: Foldex's right-click menu for items, arranged by Dexmenu

Status: not started; see Status.

- 2026-11-20: draft, at the user's request.

Builds on plan 02 3.1 (Explorer's menu shown as a native popup, `ShellMenu`), plan 23 3.2 (Foldex's own items at its
top) and plan 31 3.5 (the Foldex submenu). The menu itself is arranged by Dexmenu, a program of its own for every
program that shows Windows' right-click menu: `..\Dexmenu\docs\plans\01-PLAN-dexmenu.md`. LexPen has no menu of this
kind: it adds its items to Explorer's menu as registry verbs (`..\LexPen\src\ExplorerMenu.cs`: Open with LexPen,
Compare), which Dexmenu places like any other.

## 1. What this is about

A right-click on an item shows Explorer's own menu: long, in Explorer's order, with Foldex's own items only squeezed
in at its top. The user wants the menu ordered and grouped as they choose, while what installed programs add to it
keeps working. Dexmenu does that for Explorer, the file dialogs and Foldex alike; Foldex has to work with it and place
its own items well in it.

## 2. The solution, in brief

Foldex keeps building and showing Windows' menu as it does now; Dexmenu, loaded with that menu as with Explorer's,
arranges it, Foldex's own items included. Foldex gives its own items fixed texts in a submenu of its own, so a layout
can place them, and checks that its right-click works the same with Dexmenu as without.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Foldex's own items | fixed texts, in the Foldex submenu, so Dexmenu's layout can place them | -- | 3.1 |
| Foldex with Dexmenu | Foldex's right-click shown arranged; an item chosen does what it does now | Dexmenu plan 01 (Showing it) | 3.2; 3.3 |

Moved out: reading Windows' menu, showing it arranged, running the chosen item, Windows' own menu as a fallback, and
their tests, to Dexmenu plan 01 (`..\Dexmenu\docs\plans\01-PLAN-dexmenu.md` 3.1-3.8, 3.11).

## 3. Details

### 3.1 Foldex's own items

- Foldex adds its items to Windows' menu before it is shown (quick access and bookmarks first, then the Foldex
  submenu: plan 31 3.5), so Dexmenu sees them as items like any other and its layout places them by name (Dexmenu 3.3:
  the text without `&`, with its submenu).
- Their texts stay fixed (not with the item's name in them), so a layout keeps placing them; where a text has to
  name the item, it goes in a submenu whose name is fixed. Which of the current texts need this: [not yet checked].

### 3.2 Foldex with Dexmenu

- Foldex shows the menu itself (`ShellMenu`, `TrackPopupMenu`) with its window as owner, and forwards the menu
  messages to the extensions (`IContextMenu2/3.HandleMenuMsg`). Dexmenu relies on exactly that (its 3.4, 3.5), so
  nothing changes in Foldex for it.
- Foldex runs unelevated; its elevated helper shows no menus. So Dexmenu installed per user covers Foldex (Dexmenu
  3.9).

### 3.3 Tests

- In the test copy, with Dexmenu installed: the right-click on a file, a folder, several items and a folder's empty
  part shows the arranged menu; Foldex's own items placed by the layout; a registry verb (LexPen's Compare), a .dll
  extension's item (7-Zip, when installed) and Send to chosen from it, each doing what it does now.
- Without Dexmenu: the menu as now.

## 4. Open questions

None.
