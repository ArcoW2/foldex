# Plan 22: Thumbnail views: grid, mosaic, river, details, cards

Status: executed (2026-11-12); see As built.

- 2026-11-12: draft, at the user's request: a pane shows its images as thumbnails, in a grid (cropped or fitted), a
  mosaic, a river, details or cards; the text shown can be set; small icons on an image (a map pin for a GPS
  location).
- 2026-11-12: revised with the user's answers: Foldex's own thumbnail cache, as FastStone's, made in the background,
  kept in Foldex's data folder or in the image folders (a setting); the information and the icons one choice for every
  pane; a RAW icon; by default the date taken, the author or copyright, and the description.
- 2026-11-12: revised: the cache in Foldex's data folder by default; its size a setting, the oldest thumbnails going
  first.
- 2026-11-12: executed.

Builds on plan 03 (a pane's view: details or icons) and plan 11 (Windows' properties for columns). The number in the
file name is the priority; rename to reorder.

## 1. What this is about

A Foldex pane shows a folder as details (columns) or icons (plan 03 3.1). For a folder of photos neither shows what
the images are: the icon of a .jpg is the same for all of them. Explorer and xplorer2 show thumbnails, but only in a
plain grid; there is no layout that keeps each image's proportions, no view with the image beside its information, and
no sign of what an image holds (a location, a rating, a RAW original).

## 2. The solution, in brief

A pane gets a Thumbnails view in five layouts: a grid of equal cells (each image cut to fill its square, or made
smaller to fit in it), a mosaic (columns of images at their own proportions, nothing cut off), a river (rows of equal
height, each image at its own proportions, the rows filling the width), details (the image at the left, its
information at the right, one per line) and cards (an image above its text, as many cards side by side as fit).
Foldex keeps its own thumbnail cache, as FastStone does, made in the background ahead of what is shown, in Foldex's
data folder or next to the images (a setting). Which information details and cards show (by default the date taken,
the author or copyright, and the description) and which small icons an image carries (a map pin for a GPS location, a
RAW mark) are one choice for every pane; the thumbnail size follows Ctrl+mouse wheel.

## Status

### Built

| Part | What | Reference |
|---|---|---|
| Thumbnail cache | Foldex's own, from Windows' thumbnail handlers, kept by path, size, date and thumbnail size; trimmed to its size, the oldest first | 3.1; 6 |
| Making in the background | per pane, what is in view first, the rest of the folder after; a new request or another folder replaces it | 3.1; 6 |
| Where the cache is | thumbnailCache: Foldex's data folder (default) or a hidden .foldex-thumbs folder next to the images | 3.1; 6 |
| The view | Thumbnails in the View menu beside Details and Icons; layout and size per pane, kept with the layout | 3.2; 6 |
| Grid | cut to fill or fitted | 3.3 |
| Mosaic | columns, the shortest first, nothing cut | 3.3 |
| River | rows of equal height filling the width, the last as it is | 3.3 |
| Details | the image at the left, the name and information at the right | 3.3 |
| Cards | a card of a fixed width, as many side by side as fit | 3.3 |
| Information | one choice for every pane (thumbInfo), chosen in the menu | 3.4; 6 |
| Icons on images | GPS and RAW, one choice for every pane (thumbIcons) | 3.5 |
| Size | Ctrl+mouse wheel and Larger / Smaller, per pane | 3.2 |
| Tests | unit and test copy | 3.7; 6 |

### Not yet built

| Part | What | Waits for | Reference |
|---|---|---|---|

## 3. Details

### 3.1 Thumbnails and their cache

- Foldex keeps its own thumbnail cache, as FastStone does, so a folder of photos shows at once the second time,
  whatever Windows' own cache has kept or thrown away. A thumbnail is made once from what Windows gives for the item
  (`IShellItemImageFactory`, the thumbnail handlers of Explorer: images, RAW with a codec installed, videos, PDFs, ...);
  an item without one shows its icon, large.
- Kept per item by its path, its size and date changed, and the thumbnail size (a few fixed sizes; the size drawn is
  scaled from the nearest larger one); a file changed or gone makes its thumbnail stale, made again or dropped.
- **Where**: a setting, thumbnailCache: in Foldex's data folder (the default: one cache for every folder; nothing
  written next to the images), or in the image folders themselves (hidden, so it goes along when the folder is copied
  or moved). [Where FastStone keeps its cache: not yet checked.]
- **Made in the background**: when a pane shows a folder in Thumbnails, the host makes what is missing on a thread of
  its own, at low priority: the items in view first, then the rest of the folder ahead of scrolling. The page draws
  each thumbnail as it comes; one not made yet shows its icon until then. Leaving the folder stops what is left for
  it.
- Each thumbnail is kept with the image's own width and height, so the mosaic and the river place an image right
  before its thumbnail is drawn.
- **Its size**: a setting, thumbnailCacheMB; above it the thumbnails used longest ago go first. The default is set once
  the size of a thumbnail is measured (6. As built).

### 3.2 The view

- The pane head's View menu (plan 12 3.2) gets Thumbnails beside Details and Icons, with its layouts: Grid (cut),
  Grid (fit), Mosaic, River, Details, Cards. Per pane, kept with the layout (as `pane.view`), so a photo folder's pane
  can be thumbnails while its parent tree is details.
- The size: Ctrl+mouse wheel over the pane in thumbnails (in steps; the pane font is not changed then, as it is in
  details), and Larger / Smaller in the View menu. Per pane.
- Keyboard, selection and focus as in a list: the arrows move the focused item in the layout's order (left to right,
  then down; in a mosaic down a column is still the next item in order), Ctrl and Shift select, the focused and the
  selected items highlighted as everywhere (the highlight settings).
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

- Which properties details and cards show: one choice for every pane (a setting), chosen as columns are (plan 11:
  Foldex's own and Windows' properties), in the order chosen.
- By default: the date taken (System.Photo.DateTaken), the author or copyright (System.Author, System.Copyright: who
  took it), and the description (System.Comment, System.Title). The name is shown above them.
- Values read as for columns (`props`, only for what is in view).

### 3.5 Icons on images

- Small icons at the bottom of an image (in every layout), each when the item has it:
  - a map pin: the image has a GPS location (System.GPS.Latitude); its tooltip the coordinates;
  - RAW: the file is a camera RAW (by its extension: .cr2, .cr3, .nef, .arw, .orf, .rw2, .dng, .raf, ... [the list:
    not yet checked against the codecs Windows has]).
  More icons later.
- Which of them are shown: one choice for every pane (a setting).

### 3.6 What it is not

- Not an image viewer: opening an image is Enter, as anywhere (its program, or the preview pane, plan 04).
- No editing of images or their properties here.

### 3.7 Tests

- Unit: the mosaic's placement (each image into the shortest column, its height by its proportions); the river's rows
  (as many as fit, the row scaled to the width exactly, the last row not); the grid's cells; cards per row by the
  pane's width; the keyboard's order in each layout.
- Host: a thumbnail for a .jpg made, kept and found again without making it anew; made again after the file changes;
  in Foldex's data folder with that setting, next to the images with the other; none for a text file (its icon then);
  the background maker doing the items in view first and stopping when the folder is left.
- In the test copy: a folder of photos in each layout, a screenshot of each; the second visit shown from the cache;
  Ctrl+wheel larger and smaller; the arrows and Ctrl+click in a mosaic; details and cards with the default
  information; a photo with a GPS location shows the map pin, a RAW file the RAW mark; the pane back in its layout and
  size after a restart; a folder of a few thousand images scrolled while its thumbnails are still being made.

## 4. Open questions

None.

## 6. As built

**Where.** `Shell/Thumbnails.cs` (the cache: `Get` makes or finds a thumbnail, `Trim` keeps the cache under its size),
`MainForm` (the op `thumbs`: per pane a job on a thread of its own, in the order asked, batches of thumbnails to the
page as event `thumbs`; a new request for the pane, or the pane going to another folder, replaces it),
`web/thumbs.js` (the layouts as pure functions, the arrows' neighbour, the RAW extensions; the page's store of
thumbnails, Ctrl+wheel zoom, the Thumbnails menu), `web/app.js` (`ListView.renderThumbs`, `askThumbs`, the keyboard),
`web/app.css` (the thumbnails and their highlights, as rows').

**Decided while building.**

- Thumbnails are made at three sizes, 96, 192 and 384 px (the longer side); the page asks the smallest not smaller than
  it draws (times the screen's scale) and the browser scales it. A JPEG at quality 85, a PNG when it has transparency.
- A thumbnail's key is a hash of its path, its length, its date changed and its size: a changed file has a new key, so
  a stale thumbnail is never shown; the old one goes when the cache is trimmed. A hit sets the file's date, so the ones
  used longest ago go first. Trimmed every 200 thumbnails made, down to nine tenths of the size.
- Next to the images the cache is a hidden folder `.foldex-thumbs` of thumbnails (one hidden database file would need
  a database library; a folder needs nothing).
- **Measured size**: 26 thumbnails at 192 px, 24 made-up images and 2 photos, took 257 KB in the cache, about 10 KB
  each. thumbnailCacheMB is 64 by default: room for some 6,000 thumbnails of that size. "A few MB" would hold a few
  hundred, less than one large photo folder; the setting goes down to 8 MB.
- An item Windows has no thumbnail for (a text file, a RAW without a codec) shows its 48 px icon; asked once.
- The proportions come with the thumbnail (Windows keeps them when it scales); until it is there an image counts as
  square, and the mosaic and the river place it again when it comes.
- The information shown (thumbInfo) and the icons (thumbIcons) are settings (lists), chosen in the pane head's View >
  Thumbnails menu from a list: date taken, author, copyright, description (title), comments, dimensions, camera,
  rating, size, date modified. By default date taken, author, copyright and description (title). A value that is
  empty leaves its line empty.
- The GPS mark is a small red "GPS" label (its tooltip the latitude), RAW a dark "RAW" label, at the image's bottom
  left.
- The keyboard: Left and Right the item before and after; Up and Down the nearest one above or below by the boxes'
  middles (thumbs.js `thumbNeighbour`); PgUp and PgDn a screen; Home and End.
- Ctrl+wheel over a pane in Thumbnails changes its thumbnail size (48 to 512 px, a step of 15 %), not the font.
- The cache's place and size are in Settings > Contents > Thumbnails.

**Tests.** Unit (`ThumbnailTests`): the grid's cells, the mosaic's columns, the river's full and last rows, details
and cards, the arrows' neighbours, RAW by extension; a thumbnail made, found again without being made anew, made anew
after the file changed, nothing next to the images; the cache next to the images a hidden folder; none for a text
file; trimming the ones used longest ago. In the test copy, with a folder of 24 made-up images in eight proportions, 2
photos with a GPS location, a fake RAW file and a text file: each layout drawn (screenshots), 26 thumbnails shown,
the GPS and RAW marks; the cache made in Foldex's data folder (26 files) and, with the setting, in a hidden folder next
to the images; the arrows in a mosaic (down to the image under it, up to the nearest above); Ctrl+wheel changing the
size and not the font; after a restart the pane back in Mosaic at its size, every thumbnail from the cache, none made
again.

**Not tested.** A folder of a few thousand images while its thumbnails are being made (the drawing is the rows' way,
only what is in view); a RAW file with a codec installed (none here); videos and PDFs (they take Windows' thumbnail
handlers, as images do).
