'use strict';
// Thumbnail layouts (docs/plans/executed/22-PLAN-thumbnails.md 3.3), without the DOM, so the tests run them under Jint: where
// each item of a pane in the Thumbnails view goes, from each image's proportions (width / height; 1 until its thumbnail
// is there), the pane's width and the thumbnail size. app.js (ListView.renderThumbs) draws what this places.

const ThumbLayouts = { 'grid-cut': 'Grid (cut)', 'grid-fit': 'Grid (fit)', mosaic: 'Mosaic', river: 'River', details: 'Details', cards: 'Cards' };
const ThumbGap = 6;            // px between items
const ThumbSizes = { min: 48, max: 512, step: 1.15 };   // the thumbnail size in px, and a Ctrl+wheel step (times)
const RawExtensions = new Set(['cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'orf', 'rw2', 'raf', 'dng', 'pef',
  'srw', 'x3f', 'rwl', '3fr', 'erf', 'kdc', 'mrw', 'raw']);

// Each item's box { x, y, w, h } (all of it: image and text), its image { ix, iy, iw, ih } in it, its text
// { tx, ty, tw, th } (th 0: none), and the height of all. `o`: { line (px of a line of text), names (a name under the
// image in Grid, Mosaic, River), info (lines of text in Details and Cards, the name included), card (a card's width) }.
function thumbLayout(kind, ratios, width, size, o) {
  const gap = ThumbGap, line = o.line, label = o.names ? line : 0;
  const boxes = [];
  const across = cell => Math.max(1, Math.floor((width + gap) / (cell + gap)));
  if (kind === 'mosaic') {
    // Columns; each image at its proportions across a column's width, into the shortest column.
    const cols = across(size), colW = (width - gap * (cols - 1)) / cols, heights = Array(cols).fill(0);
    for (const r of ratios) {
      const c = heights.indexOf(Math.min(...heights));
      const ih = colW / r;
      boxes.push({ x: c * (colW + gap), y: heights[c], w: colW, h: ih + label, ix: 0, iy: 0, iw: colW, ih, tx: 0, ty: ih, tw: colW, th: label });
      heights[c] += ih + label + gap;
    }
    return { boxes, height: Math.max(0, ...heights) };
  }
  if (kind === 'river') {
    // Rows of the size's height; a full row made larger or smaller to fill the width exactly, the last as it is.
    let y = 0;
    for (let start = 0; start < ratios.length;) {
      let end = start, sum = 0;
      while (end < ratios.length && (end === start || sum + size * ratios[end] + gap * (end - start) <= width)) sum += size * ratios[end++];
      const last = end === ratios.length;
      const scale = (width - gap * (end - start - 1)) / sum;
      const h = size * (last ? Math.min(1, scale) : scale);
      let x = 0;
      for (let k = start; k < end; k++) {
        const w = h * ratios[k];
        boxes.push({ x, y, w, h: h + label, ix: 0, iy: 0, iw: w, ih: h, tx: 0, ty: h, tw: w, th: label });
        x += w + gap;
      }
      y += h + label + gap;
      start = end;
    }
    return { boxes, height: Math.max(0, y - gap) };
  }
  if (kind === 'details') {
    // One per line: the image in a square at the left, its text beside it.
    const h = Math.max(size, o.info * line);
    ratios.forEach((r, i) => boxes.push({ x: 0, y: i * (h + gap), w: width, h, ix: 0, iy: 0, iw: size, ih: size,
      tx: size + 2 * gap, ty: 0, tw: Math.max(0, width - size - 2 * gap), th: o.info * line }));
    return { boxes, height: Math.max(0, ratios.length * (h + gap) - gap) };
  }
  if (kind === 'cards') {
    // A card: the image above its text, a fixed width; as many side by side as fit.
    const cw = Math.max(size, o.card), ch = size + gap + o.info * line, cols = across(cw);
    ratios.forEach((r, i) => boxes.push({ x: (i % cols) * (cw + gap), y: Math.floor(i / cols) * (ch + gap), w: cw, h: ch,
      ix: 0, iy: 0, iw: cw, ih: size, tx: 0, ty: size + gap, tw: cw, th: o.info * line }));
    return { boxes, height: Math.max(0, Math.ceil(ratios.length / cols) * (ch + gap) - gap) };
  }
  // A grid: square cells, the image cut to fill its cell (grid-cut) or fitted in it (grid-fit, drawn so).
  const cols = across(size), h = size + label;
  ratios.forEach((r, i) => boxes.push({ x: (i % cols) * (size + gap), y: Math.floor(i / cols) * (h + gap), w: size, h,
    ix: 0, iy: 0, iw: size, ih: size, tx: 0, ty: size, tw: size, th: label }));
  return { boxes, height: Math.max(0, Math.ceil(ratios.length / cols) * (h + gap) - gap) };
}

// The item the arrows go to from item i: Left and Right the one before and after; Up and Down the nearest one above
// or below, by the boxes' middles (so in a mosaic or a river the one that is really there).
function thumbNeighbour(boxes, i, key) {
  if (key === 'ArrowLeft') return Math.max(0, i - 1);
  if (key === 'ArrowRight') return Math.min(boxes.length - 1, i + 1);
  const b = boxes[i], mx = b.x + b.w / 2, my = b.y + b.h / 2, down = key === 'ArrowDown';
  let best = i, bestScore = Infinity;
  boxes.forEach((c, k) => {
    const cy = c.y + c.h / 2;
    if (down ? c.y < b.y + b.h - 1 : c.y + c.h > b.y + 1) return;   // not below (above) it
    const score = Math.abs(cy - my) * 4 + Math.abs(c.x + c.w / 2 - mx);
    if (score < bestScore) [best, bestScore] = [k, score];
  });
  return best;
}

// The size of thumbnail the host makes for a size drawn: the smallest of its sizes not smaller (the screen's pixels).
const thumbBucket = (size, ratio = 1) => [96, 192, 384].find(s => s >= size * ratio) ?? 384;

const isRaw = name => RawExtensions.has(name.slice(name.lastIndexOf('.') + 1).toLowerCase());

// ---------- The page's part (called from app.js; not run by the tests) ----------

const thumbStore = new Map();    // "size:id" -> { url } (url null: Windows has none, the icon is shown)
const thumbRatios = new Map();   // id -> width / height of its image

// Thumbnails came from the host: kept, and the pane drawn again (placed again when an image's proportions changed it).
function thumbsCame(m) {
  for (const t of m.items) {
    const id = t.id.toLowerCase();
    thumbStore.set(`${m.size}:${id}`, { url: t.url });
    if (t.url && t.width > 0 && t.height > 0) thumbRatios.set(id, t.width / t.height);
  }
  views.get(m.channel)?.render();
}

// Ctrl+wheel and Larger / Smaller: the pane's thumbnail size a step up (1) or down (-1).
const zoomedThumbSize = (pane, step) => Math.round(Math.min(ThumbSizes.max, Math.max(ThumbSizes.min, (pane.thumbSize ?? 160) * ThumbSizes.step ** step)));
function thumbZoom(id, step) {
  const pane = layout.pane(id), v = views.get(id);
  if (!pane || !v) return;
  const size = zoomedThumbSize(pane, step);
  if (size === pane.thumbSize) return;
  const focus = v.entries.findIndex(x => same(x.id, layout.state(id).focus));
  pane.thumbSize = size;
  v.render();
  if (focus >= 0) v.scrollTo(focus);
  tellLayout();
}

// The information details and cards show, and the icons on images: one choice for every pane (3.4, 3.5).
const ThumbInfoChoices = [['System.Photo.DateTaken', 'Date taken'], ['System.Author', 'Author'], ['System.Copyright', 'Copyright'],
  ['System.Title', 'Description (title)'], ['System.Comment', 'Comments'], ['System.Image.Dimensions', 'Dimensions'],
  ['System.Photo.CameraModel', 'Camera'], ['System.Rating', 'Rating'], ['size', 'Size'], ['modified', 'Date modified'],
  ['gpsLocation', 'GPS location']];
const thumbInfo = () => Array.isArray(settings.thumbInfo) ? settings.thumbInfo : ['System.Photo.DateTaken', 'System.Author', 'System.Copyright', 'System.Title'];
const thumbIcons = () => Array.isArray(settings.thumbIcons) ? settings.thumbIcons : ['gps', 'raw'];

function toggleIn(name, list, value) {
  setSetting(name, list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  for (const v of views.values()) if (v.thumbsView?.()) v.render();
}

// The Views menu (the ribbon's Views, as xplorer2's): details or icons, the thumbnail layouts, and for thumbnails the
// size and names; a dimmed line heads each group; the information and the icons in a submenu each.
function viewsMenu(id) {
  const pane = layout.pane(id);
  const on = pane.view === 'thumbs';
  const heading = label => ({ label, enabled: false });
  return [
    ...[['details', 'Details'], ['icons', 'Icons']]
      .map(([view, label]) => ({ label, checked: (pane.view ?? 'details') === view, run: () => setPaneView(id, view) })),
    '-',
    heading('Thumbnails'),
    ...Object.entries(ThumbLayouts).map(([kind, label]) => ({ label, checked: on && (pane.thumbLayout ?? 'grid-cut') === kind, run: () => {
      pane.thumbLayout = kind;
      if (!on) setPaneView(id, 'thumbs');
      else views.get(id)?.render();
      askPropList().then(() => views.get(id)?.render());
      tellLayout();
    } })),
    '-',
    heading('Thumbnail size'),
    { label: 'Larger (Ctrl+wheel)', enabled: on, run: () => thumbZoom(id, 1) },
    { label: 'Smaller (Ctrl+wheel)', enabled: on, run: () => thumbZoom(id, -1) },
    { label: 'Names under the images', enabled: on, checked: pane.thumbNames !== false, run: () => {
      pane.thumbNames = pane.thumbNames === false;
      views.get(id)?.render();
      tellLayout();
    } },
    { label: 'Information (details, cards)', items: ThumbInfoChoices.map(([prop, label]) => ({ label, checked: thumbInfo().includes(prop),
      run: () => toggleIn('thumbInfo', thumbInfo(), prop) })) },
    { label: 'Icons on images', items: [['gps', 'GPS location'], ['raw', 'RAW']].map(([icon, label]) => ({ label, checked: thumbIcons().includes(icon),
      run: () => toggleIn('thumbIcons', thumbIcons(), icon) })) },
  ];
}
