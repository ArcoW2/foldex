# Plan 40: Foldex's right-click menu for items, ready to be arranged by Dexmenu

Status: executed; see Status.

- 2026-11-20: draft, at the user's request.
- 2026-11-21: partly executed: Foldex's own items in one submenu.
- 2026-11-21: executed.

Builds on plan 02 3.1 (Explorer's menu shown as a native popup, `ShellMenu`), plan 23 3.2 (Foldex's own items at its
top) and plan 31 3.5 (the Foldex submenu). The menu itself is arranged by Dexmenu, a program of its own for every
program that shows Windows' right-click menu (`..\Dexmenu`); working with the programs that show that menu, Foldex
included, is Dexmenu's part. LexPen has no menu of this kind: it adds its items to Explorer's menu as registry verbs
(`..\LexPen\src\ExplorerMenu.cs`: Open with LexPen, Compare), which Dexmenu places like any other.

## 1. What this is about

A right-click on an item shows Explorer's own menu: long, in Explorer's order, with Foldex's own items only squeezed
in at its top. The user wants the menu ordered and grouped as they choose, while what installed programs add to it
keeps working. Dexmenu does that for Explorer, the file dialogs and Foldex alike; Foldex's part is to show Windows'
menu as Windows' menu, with its own items where a layout can place them.

## 2. The solution, in brief

Foldex keeps building and showing Windows' menu as it does now, so Dexmenu arranges it as it arranges Explorer's.
Foldex keeps its own items in one submenu with a fixed name, so a layout can place them.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Foldex's own items | every one in the submenu Foldex, a fixed name a layout places | 3.1; 6.1 |

### Not yet built

Moved out: reading Windows' menu, showing it arranged, running the chosen item, Windows' own menu as a fallback,
working with the programs that show the menu (Foldex among them), and their tests, to Dexmenu (`..\Dexmenu`).

## 3. Details

### 3.1 Foldex's own items

- Foldex adds its items to Windows' menu before it is shown, so Dexmenu sees them as items like any other and its
  layout places them by name.
- They all sit in one submenu with a fixed name, Foldex, so a layout places Foldex's items as one. Texts inside it
  that change with the item or its state (Add to or Remove from quick access, Paste ... to the folder's name) are
  placed with it, or by a pattern of the layout.

### 3.2 Windows' menu as Windows' menu

- Foldex shows the menu itself (`ShellMenu`, `TrackPopupMenu`) with its window as owner, and forwards the menu
  messages to the extensions (`IContextMenu2/3.HandleMenuMsg`), as Explorer does. Nothing in Foldex is for Dexmenu.

## 4. Open questions

None.

## 6. As built

### 6.1 Foldex's own items

- Since 38e7bff every item of Foldex's own is in the submenu Foldex at the top of Windows' menu
  (`MainForm.ShowMenu`: quick access and bookmarks, then Create link, Take ownership..., Paste ... to ...). Nothing
  else was needed.
