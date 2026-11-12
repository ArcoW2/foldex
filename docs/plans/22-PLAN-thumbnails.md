# Plan 22: Thumbnail views: grid, mosaic, river, details, cards

Status: draft 2026-11-12; not started; see Status.

- 2026-11-12: draft, at the user's request: a pane shows its images as thumbnails, in a grid (cropped or fitted), a
  mosaic, a river, details or cards; the text shown can be set; small icons on an image (a map pin for a GPS
  location).

Builds on plan 03 (a pane's view: details or icons) and plan 11 (Windows' properties for columns). The number in the
file name is the priority; rename to reorder.

## 1. What this is about

A Foldex pane shows a folder as details (columns) or icons (plan 03 3.1). For a folder of photos neither shows what
the images are: the icon of a .jpg is the same for all of them. Explorer and xplorer2 show thumbnails, but only in a
plain grid; there is no layout that keeps each image's proportions, no view with the image beside its information, and
no sign of what an image holds (a location, a rating, a video's length).

## 2. The solution, in brief

A pane gets a Thumbnails view in five layouts: a grid of equal cells (each image cut to fill its square, or made
smaller to fit in it), a mosaic (columns of images at their own proportions, nothing cut off), a river (rows of equal
height, each image at its own proportions, the rows filling the width), details (the image at the left, its
information at the right, one per line) and cards (an image above its text, as many cards side by side as fit). The
thumbnails come from Windows' own thumbnail cache, so nothing is written into the folder. Which information details and
cards show, and which small icons an image carries (a map pin when it has a GPS location, ...), can be set; the
thumbnail size follows Ctrl+mouse wheel.

## Status

### Built

| Part | What | Reference |
|---|---|---|

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|
| Thumbnails from Windows | the host asks Windows' thumbnail for an item at a size (its cache; nothing in the folder) | open question 1 | 3.1 |
| The view | Thumbnails as a pane's view beside Details and Icons; its layout and size per pane, kept with the layout | -- | 3.2 |
| Grid | equal cells: cut to fill, or fitted | The view | 3.3 |
| Mosaic | columns, each image at its own proportions, nothing cut | The view | 3.3 |
| River | rows of equal height filling the width, each image at its own proportions | The view | 3.3 |
| Details | the image at the left, its information at the right, one per line | The view; Information | 3.3 |
| Cards | image and text as a card of a fixed width, as many side by side as fit | The view; Information | 3.3 |
| Information | which properties details and cards show, chosen per pane (Windows' properties, as columns) | The view | 3.4 |
| Icons on images | small icons at an image's bottom: a map pin for a GPS location, ... | The view; open question 3 | 3.5 |
| Size | the thumbnail size per pane: Ctrl+mouse wheel, and in the view's menu | The view | 3.2 |
| Tests | see 3.7 | -- | 3.7 |

## 3. Details

### 3.1 Thumbnails

- The host asks Windows for an item's thumbnail at the size drawn (`IShellItemImageFactory`), as Explorer does: for
  images, videos, PDFs and what else has a thumbnail handler; Windows keeps them in its own cache
  (%LOCALAPPDATA%\Microsoft\Windows\Explorer), so nothing is written into the folder and Explorer's thumbnails are
  reused. An item without one shows its icon, large.
- Asked only for the items in view (and a little around them), off the UI thread (as listings and icons are, plan 02
  3.5), a few at a time; the page keeps what came per item and size, and a smaller size is drawn from a larger one
  while it comes.
- Each thumbnail comes with its width and height, so the mosaic and the river can place an image before its pixels
  arrive. [Whether Windows gives the proportions without making the thumbnail: not yet checked; else from the image's
  own size property.]
- Where Windows gives none (a network share, a format without a handler): whether Foldex makes its own and where it
  keeps them: open question 1.

### 3.2 The view

- The pane head's View menu (plan 12 3.2) gets Thumbnails beside Details and Icons, with its layouts: Grid (cut),
  Grid (fit), Mosaic, River, Details, Cards. Per pane, kept with the layout (as `pane.view`), so a photo folder's pane
  can be thumbnails while its parent tree is details.
- The size: Ctrl+mouse wheel over the pane in thumbnails (in steps; the pane font is not changed then, as it is in
  details), and Larger / Smaller in the View menu. Per pane.
- Keyboard, selection and focus as in a list: the arrows move the focused item in the layout's order (left to right,
  then down; in a mosaic down a column is still the next item in order), Ctrl and Shift select, the focused item
  highlighted as everywhere (the highlight settings).
- Drawn as the rows are: only what is in view, so a folder of thousands of photos scrolls as one of a hundred.
- Folders show their icon (or Windows' folder thumbnail with images in it), so a folder of folders of photos can be
  walked in this view.

### 3.3 The layouts

- **Grid (cut)**: equal square cells; each image cut to fill its cell (the shorter side fills it, the middle shown).
- **Grid (fit)**: equal square cells; each image made smaller to fit its cell whole, the rest of the cell empty.
- **Mosaic**: as many columns as fit at the size; each image at its own proportions across the column's width, put in
  the shortest column, so nothing is cut and the columns end at about the same height.
- **River**: rows of the same height; each image at its own proportions, as many in a row as fit, then the row's
  images all made a little larger or smaller so the row fills the width exactly (the last row as it is).
- **Details**: one item per line: the thumbnail at the left, at the size, and its information at the right (3.4), as
  many lines of it as fit beside the image.
- **Cards**: a card is the image (at the size) above its information, a fixed width; as many cards side by side as
  fit the pane's width, so a wide pane has two or more columns of cards and a narrow one a single column.
- The names under the images in Grid, Mosaic and River: shown or not, per pane.

### 3.4 Information

- Which properties details and cards show, per pane, chosen as columns are (plan 11: Foldex's own and Windows'
  properties): for instance the name, the size, the date taken, the dimensions, the camera, the place. Its own list,
  in the order chosen; a few chosen by default [which: not yet decided; the name, the date taken, the dimensions,
  the size as a start].
- Values read as for columns (`props`, only for what is in view).

### 3.5 Icons on images

- Small icons at the bottom of an image (in every layout), each when the item has it: a map pin for a GPS location
  (System.GPS.Latitude); further ones by question 3. Which of them are shown can be set, per pane or for all (question
  2).
- Each icon's tooltip says what it shows (the place's coordinates, ...).

### 3.6 What it is not

- Not an image viewer: opening an image is Enter, as anywhere (its program, or the preview pane, plan 04).
- No editing of images or their properties here.

### 3.7 Tests

- Unit: the mosaic's placement (each image into the shortest column, its height by its proportions); the river's rows
  (as many as fit, the row scaled to the width exactly, the last row not); the grid's cells; cards per row by the
  pane's width; the keyboard's order in each layout.
- Host: a thumbnail for a .jpg at two sizes, with its proportions; none for a text file (its icon then); nothing new
  in the folder after.
- In the test copy: a folder of photos in each layout, a screenshot of each; Ctrl+wheel larger and smaller; the
  arrows and Ctrl+click in a mosaic; details and cards with the information chosen; a photo with a GPS location shows
  the map pin, one without does not; the pane back in its layout and size after a restart; a folder of a few
  thousand images scrolled.

## 4. Open questions

1. **Where Windows gives no thumbnail.** Windows' cache covers most cases without writing into the folder. For the
   rest (a share without thumbnails, a format without a handler): show the icon, make Foldex's own thumbnails in its
   own data folder, or write them next to the images in the folder (as some viewers do, a hidden .thumbs folder)?
   Suggestion: the icon first; Foldex's own cache in its data folder if that turns out not enough; never in the
   user's folders unless asked for.
2. **Settings per pane or for all.** The information shown and the icons on images: per pane (as the layout and the
   size), or one choice for every pane?
3. **Which icons.** Besides the map pin for a GPS location: a rating (stars), a video (and its length), a RAW file
   with a JPEG companion, a hidden file, ...? Which ones do you want?
4. **Which information by default.** For details and cards when nothing is chosen yet: the name, the date taken, the
   dimensions and the size, or others?
