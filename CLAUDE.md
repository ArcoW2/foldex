# Foldex

- **LexPen is the model.** Where LexPen (`..\LexPen`) has the same thing (a menu, a window, a dialog, an order of
  items), Foldex does it as LexPen does, unless the user said otherwise. Look at LexPen before building such a part,
  and say where Foldex differs and why.
- **Menus.** Every button or element that opens a menu also closes it on the next click while it is open. This is
  generic (`src/web/menu.js`: the opener of a menu); a new opener needs nothing of its own for it.
- **Words.** The *selected* items are the ones an action for several items works on (copy, delete, properties); the
  *focused* item is the one the cursor is on: scrolling follows it and actions for one item use it (rename, open,
  execute). Keep both apart in code, docs and messages.
