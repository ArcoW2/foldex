# Plan 40: Foldex's own right-click menu for items, with every program's items still in it

Status: not started; see Status.

- 2026-11-20: draft, at the user's request.

Builds on plan 02 3.1 (Explorer's menu shown as a native popup, `ShellMenu`), plan 23 3.2 (Foldex's own items at its
top) and plan 31 3.5 (the Foldex submenu). LexPen has no menu of this kind: it adds its items to Explorer's menu as
registry verbs (`..\LexPen\src\ExplorerMenu.cs`: Open with LexPen, Compare), and those are what this plan must keep.

## 1. What this is about

A right-click on an item shows Explorer's own menu: long, in Explorer's order, with Explorer's look rather than
Foldex's theme, and with Foldex's own items only squeezed in at its top. Foldex wants a menu of its own, ordered and
grouped as Foldex wants it. But what installed programs add to that menu has to keep working as it does in Explorer:
the verbs they put in the registry (LexPen's Compare) and the shell extensions they install as a .dll (7-Zip,
TortoiseGit, a cloud drive's items).

## 2. The solution, in brief

Foldex keeps building Explorer's menu for the items as it does now (every extension asked to add its items), but no
longer shows it: it reads its items (text, icon, submenus, which are on and off) and shows them in a menu of its own,
drawn by its page in its theme, in Foldex's order and groups, with Foldex's own items among them. An item of Windows'
part that is chosen is run by its id on the same menu Windows built, so every verb and every extension does exactly
what it does in Explorer. Submenus that an extension fills only when opened are opened for it first; an item that
cannot be read (one an extension draws itself) is reached through "More (Windows' menu)...", which shows Windows' own
menu as now.

## Status

### Built

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Reading the menu | Windows' menu built as now and read: texts, icons, submenus (filled as on opening), state, ids | -- | 3.1 |
| The own menu | drawn by the page in Foldex's theme: Foldex's order and groups, its own items, Windows' items under them | Open questions 1, 2 | 3.2 |
| Running an item | Windows' item chosen: run by its id on the menu Windows built (`InvokeCommand`) | Reading the menu | 3.3 |
| Windows' menu | "More (Windows' menu)..." and a key for it: Windows' own menu as now | -- | 3.4 |
| Tests | 3.5 | -- | 3.5 |

## 3. Details

### 3.1 Reading Windows' menu

- As now: `IContextMenu` over the items, `QueryContextMenu` (with Shift: the extended verbs too), every installed
  extension adding its items. Then, instead of `TrackPopupMenu`: every item read (`GetMenuItemInfo`): its text with its
  & key, its icon (the item's bitmap as a picture), on or off, checked, a line, a submenu.
- A submenu an extension fills only when it opens (Send to, Open with, 7-Zip's): sent `WM_INITMENUPOPUP` through the
  extension (`IContextMenu2/3.HandleMenuMsg`, as Foldex forwards it now) before it is read. Whether every common
  extension fills its submenu that way without being shown on screen: [not yet checked].
- An item an extension draws itself (owner-drawn, no text): not readable; it stays in Windows' menu (3.4).
- `ShellMenu.Texts` and the page's `menuTexts` (used now for menu texts) are the start of this.

### 3.2 The own menu

- Drawn by the page (menu.js), as Foldex's other menus: its theme, its font, keys (arrows, Enter, the & letters),
  Esc, a submenu at the right.
- Foldex's order and groups: open question 1. Foldex's own items (plan 23's bookmarks, plan 31's Foldex submenu) among
  them where they belong.
- Windows' items keep their text, icon and & key, and their state (off where Windows has them off).
- Shown at the mouse; on the keyboard (the menu key, Shift+F10) at the focused item.

### 3.3 Running an item

- Windows' item chosen: run by its id on the menu Windows built for that right-click (`InvokeCommand`, with the window
  and the point as Explorer gives them), so a verb, a registry command (LexPen's Compare) and a .dll extension do what
  they do in Explorer. The menu Windows built stays until the item has run or the own menu is closed.
- Foldex's own items as now (the page's actions).

### 3.4 Windows' own menu

- "More (Windows' menu)..." at the bottom of the own menu: Windows' menu as Foldex shows it now (plan 02 3.1), for
  what the own menu cannot show (owner-drawn items) or in case one works only there. A key for it as well: open
  question 2.

### 3.5 Tests

- Unit: the menu read into items (texts, & keys, lines, submenus, on and off) from a menu made for the test.
- In the test copy: the own menu for a file, a folder, several items and a folder's empty part, against Windows' menu
  for the same: every readable item there; a registry verb (LexPen's Compare when LexPen is installed) and a .dll
  extension's item (7-Zip, when installed) chosen from the own menu: each does what it does in Explorer; Send to and
  Open with filled; "More (Windows' menu)..." shows Windows' menu.

## 4. Open questions

1. **What the own menu looks like.** Its order and groups: for example Open and Execute first, then Foldex's own (the
   Foldex submenu, bookmarks), then cut, copy, paste, delete, rename, then the programs' items (as Windows gives
   them), then Properties last? And may items be hidden (one you never use), and by whom: a fixed choice of Foldex,
   or a list of your own (a menu.json, as the ribbon's)?
2. **Windows' menu by a key.** Shift+right-click shows Windows' extended items in Explorer; should it here show
   Windows' own menu instead (and the extended items in the own menu always), or keep its meaning and Windows' menu
   only through "More..."?
