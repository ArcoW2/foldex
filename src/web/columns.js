'use strict';
// Columns (docs/plans/executed/11-PLAN-columns.md): Foldex's own columns and Windows' properties, the header above a list
// (sorting, moving, resizing, its menu), the generic columns of a pane, a set per folder (foldercolumns.json), the
// column sets (columnsets.json, Manage sets) and fitting the columns to their content.

// ---------- The catalogue (3.1) ----------

// Width in em of the pane font; kind for alignment, formatting and sorting.
const OwnColumns = [
  { id: 'name', title: 'Name', kind: 'text', width: 22 },
  { id: 'size', title: 'Size', kind: 'size', width: 7 },
  { id: 'type', title: 'Type', kind: 'text', width: 12 },
  { id: 'modified', title: 'Date modified', kind: 'date', width: 11 },
  { id: 'created', title: 'Date created', kind: 'date', width: 11 },
  { id: 'accessed', title: 'Date accessed', kind: 'date', width: 11 },
  { id: 'attributes', title: 'Attributes', kind: 'text', width: 6 },
  { id: 'ext', title: 'Extension', kind: 'text', width: 6 },
  { id: 'target', title: 'Link target', kind: 'text', width: 16 },
  { id: 'path', title: 'Folder', kind: 'text', width: 18 },
  { id: 'total', title: 'Total size', kind: 'size', width: 7 },
  { id: 'free', title: 'Free space', kind: 'size', width: 7 },
  { id: 'git', title: 'Git status', kind: 'git', width: 8 },
  { id: 'gps', title: 'GPS', kind: 'gps', width: 4 },
];
// Not a column, a line on a card (thumbs.js ThumbInfoChoices): the GPS location in one.
const InfoOnly = [{ id: 'gpsLocation', title: 'GPS location', kind: 'text', width: 16 }];

// Windows' properties a value of Foldex's own is made of; a property column: itself.
const GpsProps = ['System.GPS.LatitudeDecimal', 'System.GPS.LongitudeDecimal', 'System.GPS.LatitudeRef', 'System.GPS.LongitudeRef'];
const propsFor = id => id.includes('.') ? [id] : id === 'gps' ? GpsProps.slice(0, 1) : id === 'gpsLocation' ? GpsProps : [];

// An item's GPS location, "52.02587 N, 4.35292 E" (Windows' decimal degrees and their N/S, E/W); '' without one.
function gpsText(x) {
  const p = x.props ?? {}, lat = p['System.GPS.LatitudeDecimal']?.[1], lon = p['System.GPS.LongitudeDecimal']?.[1];
  if (lat == null || lon == null) return '';
  const part = (v, ref, plus, minus) => `${Math.abs(v).toFixed(5)} ${ref || (v < 0 ? minus : plus)}`;
  return `${part(lat, p['System.GPS.LatitudeRef']?.[0], 'N', 'S')}, ${part(lon, p['System.GPS.LongitudeRef']?.[0], 'E', 'W')}`;
}
const hasGps = x => x.props?.['System.GPS.LatitudeDecimal']?.[1] != null;

// Whether an item has properties of `names` it does not have and that were not asked for it yet; those are marked as
// asked (each name once per item, so a column or card line added later still gets its values).
function propsToAsk(x, names) {
  const asked = x.propsAsked ??= new Set();
  const missing = names.filter(n => !(x.props && n in x.props) && !asked.has(n));
  for (const n of missing) asked.add(n);
  return missing.length > 0;
}
const GitWords = { M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', U: 'Untracked', I: 'Ignored', '!': 'Conflict' };
const RightAligned = new Set(['size', 'number', 'date']);
const NameMinEm = 8;   // the name column gives way down to this when fitting (3.4)

// ---------- No DOM: the tests run these under Jint ----------

// The set a folder uses (3.2): its own choice, else the nearest folder above it that chose one with its subfolders.
// `folders`: [{ path, set, subfolders }]. Null: the pane's generic columns.
function setFor(folders, path) {
  if (!path) return null;
  const p = path.replace(/\\+$/, '').toLowerCase();
  let best = null;
  for (const f of folders) {
    const q = f.path.replace(/\\+$/, '').toLowerCase();
    const fits = p === q || (f.subfolders && p.startsWith(q + '\\'));
    if (fits && (!best || q.length > best.path.replace(/\\+$/, '').length)) best = f;
  }
  return best;
}

// Fitting (plan 28 3.6): the new width of each column (em), from its width now and what its values need (`needs`, em).
// `which`: 'fit' (Ctrl+R) the columns whose Fit is manual or auto, or the name column when every one is never; 'all'
// (Ctrl+Shift+R) every column; 'auto' (after a listing, values read, the pane resized) the auto ones as their Fit says:
// enlarge only wider, shrink only narrower. Each within its minimum and maximum; too wide for the room (em), the name
// column gives way first, down to NameMinEm (not for Ctrl+R: there it gets its whole width, the pane scrolling).
function fittedWidths(columns, needs, which, room) {
  const auto = c => ['enlarge', 'shrink', 'both'].includes(fitOf(c));
  let fitted = columns.map(c => which === 'all' || (which === 'fit' ? fitOf(c) !== 'never' : auto(c)));
  if (which === 'fit' && !fitted.some(Boolean)) fitted = columns.map(c => c.id === 'name');
  const widths = columns.map((c, k) => {
    if (!fitted[k]) return c.width;
    const mode = which === 'auto' ? fitOf(c) : 'both';
    return withinLimits(c, mode === 'enlarge' ? Math.max(c.width, needs[k]) : mode === 'shrink' ? Math.min(c.width, needs[k]) : needs[k]);
  });
  const name = columns.findIndex(c => c.id === 'name');
  const over = widths.reduce((a, w) => a + w, 0) - room;
  if (which !== 'fit' && over > 0 && name >= 0 && fitted[name])
    widths[name] = Math.max(Math.max(columns[name].min ?? 0, NameMinEm), widths[name] - over);
  return widths.map((w, k) => fitted[k] ? Math.ceil(w * 10) / 10 : w);
}

// Text in natural order (file2 before file10), case not counting.
function naturalCompare(a, b) {
  if (typeof collator !== 'undefined') return collator.compare(a, b);
  const parts = s => String(s).toLowerCase().match(/\d+|\D+/g) ?? [];
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const n = /^\d/.test(x[i]) && /^\d/.test(y[i]);
    const c = n ? Number(x[i]) - Number(y[i]) : x[i] < y[i] ? -1 : x[i] > y[i] ? 1 : 0;
    if (c) return c;
  }
  return x.length - y.length;
}

// The value of an item's column to sort by: a number (sizes, dates, numbers, a property's raw value), a text, or null.
function sortValue(x, id, kind) {
  if (id.includes('.')) {
    const v = x.props?.[id];
    return v ? (v[1] ?? v[0]) : null;
  }
  if (id === 'git') return x.git ? GitWords[x.git] : null;
  if (id === 'gps') return hasGps(x) ? 'GPS' : null;
  const v = x[id];
  return v === undefined || v === '' ? null : v;
}

// Sorting by several columns (plan 28 3.4): folders first, as now; then by each column of the sort in turn (`sort`:
// [{ id, desc }]), empty values last; equal in all of them, by name.
function sortComparer(sort) {
  return (a, b) => {
    if (a.folder !== b.folder) return a.folder ? -1 : 1;
    for (const { id, desc } of sort) {
      const sign = desc ? -1 : 1;
      if (id === 'name') {
        const c = naturalCompare(a.name, b.name);
        if (c) return sign * c;
        continue;
      }
      const x = sortValue(a, id), y = sortValue(b, id);
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
      if (x !== null && y !== null) {
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : naturalCompare(String(x), String(y));
        if (c) return sign * c;
      }
    }
    return naturalCompare(a.name, b.name);
  };
}

// Sorting by one column (3.1).
const columnComparer = (id, kind, desc) => sortComparer([{ id, desc }]);

// The ways a column fits (plan 28 3.6), and the default of a column that has none: the name fitted when asked, the
// others never.
const FitModes = ['never', 'manual', 'enlarge', 'shrink', 'both'];
const fitOf = col => FitModes.includes(col.fit) ? col.fit : col.id === 'name' ? 'manual' : 'never';

// A set's or a pane's columns as plan 28 keeps them (3.9): { columns: [{ id, width, hidden, fit, min, max }], sort:
// [{ id, desc }] }. Written before: a sort { id, desc } is a list of one, "fit": true (every column fitted after every
// listing) makes every column fit both ways.
function normalColumns(c) {
  const sort = Array.isArray(c?.sort) ? c.sort : c?.sort?.id ? [c.sort] : [];
  const columns = (c?.columns ?? []).map(col => {
    const n = { ...col };
    if (!FitModes.includes(n.fit) && c.fit === true) n.fit = 'both';
    return n;
  });
  return { columns, sort: sort.filter(s => s?.id).map(s => ({ id: s.id, desc: !!s.desc })) };
}

// A column's width in em kept inside its minimum and maximum (plan 28 3.6).
const withinLimits = (col, em) => Math.min(col.max ?? Infinity, Math.max(col.min ?? 2, em));

// ---------- Sets and the pane's columns ----------

let columnSets = { sets: [], mine: [], folders: [] };
let propList = null;   // Windows' properties for columns (the host's propList), asked once
const propInfo = new Map();

function setColumnSets(m) {
  columnSets = m;
  if (m.problems?.length) status(m.problems.join(' '), true);
  for (const v of views.values()) if (v instanceof ListView && !isPaged(v) && v.location) v.chooseColumns(true);
  paneOfKind('columnsets')?.render();
}

function columnInfo(id) {
  return OwnColumns.find(c => c.id === id) ?? InfoOnly.find(c => c.id === id) ?? propInfo.get(id)
    ?? { id, title: id.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2'), kind: 'text', width: 10 };
}

const copyColumns = c => JSON.parse(JSON.stringify(normalColumns(c)));
const setNamed = name => columnSets.sets.find(s => s.name.toLowerCase() === name.toLowerCase());

// A new pane's columns: the Generic set's.
function genericColumns() {
  const generic = setNamed('Generic');
  return generic ? copyColumns(generic) : { columns: OwnColumns.slice(0, 4).map(c => ({ id: c.id, width: c.width })), sort: [] };
}

// The pane's own (generic) columns, kept on the pane, so they go with the layout into the project; as plan 28 keeps
// them (one written before is made so once).
function paneColumns(id) {
  const pane = layout.pane(id);
  if (!pane.columns || !Array.isArray(pane.columns.sort) || 'fit' in pane.columns) pane.columns = normalColumns(pane.columns ?? genericColumns());
  return pane.columns;
}

// The columns a pane shows: those not hidden (plan 28 3.7).
const shownColumns = cols => cols.columns.filter(c => !c.hidden);
// Whether the Git status of the items is needed: its column shown, or sorted by.
const wantsGit = cols => shownColumns(cols).some(c => c.id === 'git') || cols.sort.some(s => s.id === 'git');

function askPropList() {
  if (propList) return Promise.resolve(propList);
  return new Promise(done => {
    propListWaiters.push(done);
    if (propListWaiters.length === 1) post({ op: 'propList' });
  });
}
const propListWaiters = [];

function propListCame(list) {
  propList = list;
  for (const p of list) propInfo.set(p.name, { id: p.name, title: p.title, kind: p.kind, width: 10 });
  for (const done of propListWaiters.splice(0)) done(list);
  for (const v of views.values()) if (v instanceof ListView && !isPaged(v)) v.drawHeader();
}

// ---------- Values shown ----------

function columnText(x, id) {
  if (id.includes('.')) return x.props?.[id]?.[0] ?? '';
  const c = columnInfo(id);
  if (id === 'git') return x.git ? GitWords[x.git] ?? x.git : '';
  if (id === 'gps') return hasGps(x) ? 'GPS' : '';
  if (id === 'gpsLocation') return gpsText(x);
  const v = x[id];
  if (v == null || v === '') return '';
  if (c.kind === 'size') return formatSize(v);
  if (c.kind === 'date') return dateFormat.format(v);
  return String(v);
}

// ---------- Asking the host: Git status per folder, property values per item ----------

const columnReplies = new Map();
let columnReq = 0;

// `send`: how it goes to the host (a drop onto a scrap: with the dropped files).
function askHost(message, send = post) {
  return new Promise(done => {
    columnReplies.set(++columnReq, done);
    send({ ...message, req: columnReq });
  });
}

function columnReply(m) {
  const done = columnReplies.get(m.req);
  columnReplies.delete(m.req);
  done?.(m);
}

// ---------- A row's cells ----------

// A row's cell of a column (plan 28 3.3): the first holds what marks the item before its value (the view adds it); the
// name's cell is in the text's own colour wherever it is.
function columnCell(c, k, x, sorted) {
  const cell = document.createElement('span');
  cell.className = 'cell' + (k === 0 ? ' first' : '') + (c.id === 'name' ? ' has-name' : RightAligned.has(c.kind) ? ' right' : '')
    + (c.id === 'git' && x.git ? ` git-${x.git === '!' ? 'conflict' : x.git}` : '') + (sorted.has(c.id) ? ' sorted' : '');
  cell.style.width = `${c.width}px`;
  return cell;
}

// A column's value in its cell; in the first, a part of its own after the item's marks.
function columnValue(cell, k, text) {
  if (k > 0) cell.textContent = text;
  else cell.append(Object.assign(document.createElement('span'), { className: 'value', textContent: text }));
}

const linkMark = () => Object.assign(document.createElement('span'), { className: 'link', textContent: 'link' });

// ---------- Fitting (plan 28 3.6) ----------

// A list's or a tree's shown columns fitted (fittedWidths): what each needs measured on `items`, the first column with
// what marks an item before its value (`marks(x, measure)`, px). True when a width changed.
function fitViewColumns(view, items, marks, which) {
  const measure = document.createElement('canvas').getContext('2d');
  const style = getComputedStyle(view.body);
  measure.font = `${style.fontSize} ${style.fontFamily}`;
  const fontPx = view.fontPx(), pad = 14;
  const cols = shownColumns(view.cols);
  const needs = cols.map((col, k) => {
    let widest = measure.measureText(columnInfo(col.id).title).width + 16;
    for (const x of items)
      widest = Math.max(widest, measure.measureText(col.id === 'name' ? x.name : columnText(x, col.id)).width + (k === 0 ? marks(x, measure) : 0));
    return (widest + pad) / fontPx;
  });
  const now = cols.map(c => ({ ...c, width: c.width ?? columnInfo(c.id).width }));
  const widths = fittedWidths(now, needs, which, (view.body.clientWidth - 2) / fontPx);
  let changed = false;
  cols.forEach((col, k) => {
    if (widths[k] === now[k].width) return;
    col.width = widths[k];
    changed = true;
  });
  return changed;
}

const hasAutoFit = cols => shownColumns(cols).some(c => ['enlarge', 'shrink', 'both'].includes(fitOf(c)));

// ---------- The header (3.4) ----------

// A list's header: the shown columns' titles at their widths, each sorted one with its arrow, and its place in the
// sort when more than one column sorts (plan 28 3.4); a click sorts, Ctrl+click opens the Sort window, dragging a title
// moves its column, dragging the edge after it resizes it; its menu by a right-click.
function drawColumnHeader(view) {
  const head = view.colhead;
  const inner = document.createElement('div');
  inner.className = 'colhead-inner';
  const fontPx = view.fontPx(), sort = view.cols.sort;
  let before = null;   // the column shown before this one: its edge is also grabbed at this one's left
  for (const col of shownColumns(view.cols)) {
    const info = columnInfo(col.id);
    const cell = document.createElement('div');
    cell.className = 'colcell' + (RightAligned.has(info.kind) ? ' right' : '');
    cell.style.width = `${(col.width ?? info.width) * fontPx}px`;
    // The title in a part of its own (it gives way, with ...), the sort's arrow and place after it, never over it.
    cell.append(Object.assign(document.createElement('span'), { className: 'coltitle', textContent: info.title }));
    cell.title = info.title + (info.id.includes('.') ? ` (${info.id})` : '');
    const at = sort.findIndex(s => s.id === col.id);
    if (at >= 0) {
      cell.classList.add(sort[at].desc ? 'desc' : 'asc');
      if (sort.length > 1) cell.dataset.place = at + 1;
    }
    cell.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      // By its id now: the view's columns may have been taken again (a layout from the window) since this was drawn.
      const id = e.target.classList.contains('colgrip') ? e.target.dataset.of : col.id;
      const now = view.cols.columns.find(c => c.id === id);
      if (!now) return;
      if (e.target.classList.contains('colgrip')) resizeColumn(view, now, e);
      else moveColumn(view, now, e);
    });
    // The edge between two titles is grabbed on both sides of the line: at this one's right (its own width) and at
    // the next one's left (this one's).
    const grip = Object.assign(document.createElement('span'), { className: 'colgrip' });
    grip.dataset.of = col.id;
    cell.append(grip);
    if (before) {
      const left = Object.assign(document.createElement('span'), { className: 'colgrip before' });
      left.dataset.of = before.id;
      cell.append(left);
    }
    before = col;
    inner.append(cell);
  }
  // An edge under the mouse (or being dragged) lit as one bar: its line, a pixel left of it (the left grip) and a pixel
  // right of it (the right grip).
  const light = (id, on) => {
    for (const g of inner.querySelectorAll('.colgrip')) {
      if (g.dataset.of !== id) continue;
      g.classList.toggle('lit', on);
      if (!g.classList.contains('before')) g.parentElement.classList.toggle('edge-lit', on);   // its line itself
    }
  };
  for (const g of inner.querySelectorAll('.colgrip')) {
    g.addEventListener('mouseenter', () => light(g.dataset.of, true));
    g.addEventListener('mouseleave', () => { if (view.resizing !== g.dataset.of) light(g.dataset.of, false); });
  }
  if (view.resizing) light(view.resizing, true);
  head.replaceChildren(inner);
  inner.style.transform = `translateX(${-view.body.scrollLeft}px)`;
}

// A click on a title (plan 28 3.4): the sort after it, or null when the Sort window opens instead (a sort of several
// columns without this one). A sort of one column (or none): by this one alone, again the other way; of several with
// this one in it: only this one turned.
function sortAfterClick(sort, id) {
  const at = sort.findIndex(s => s.id === id);
  if (sort.length > 1) return at < 0 ? null : sort.map((s, k) => k === at ? { ...s, desc: !s.desc } : s);
  return [{ id, desc: at === 0 ? !sort[0].desc : false }];
}

// A pane's sort changed: the header drawn again, the list sorted that way.
function sortChanged(view, sort) {
  view.cols.sort = sort;
  view.columnsChanged();
  view.sortEntries();
}

function moveColumn(view, col, e) {
  const startX = e.clientX;
  let moved = false;
  const cells = [...view.colhead.querySelectorAll('.colcell')], shown = shownColumns(view.cols);
  const mine = cells[shown.indexOf(col)];
  const move = m => {
    if (!moved && Math.abs(m.clientX - startX) < 5) return;
    moved = true;
    mine.classList.add('dragging');
  };
  const up = m => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    mine.classList.remove('dragging');
    if (!moved) {
      if (e.ctrlKey) return openSortWindow(view, col.id);
      const sort = sortAfterClick(view.cols.sort, col.id);
      return sort ? sortChanged(view, sort) : openSortWindow(view, col.id);
    }
    // The place: before the first title whose middle is right of the mouse; any column anywhere, the name too (plan
    // 28 3.3). Hidden columns keep their place among the others.
    const to = cells.findIndex(c => { const r = c.getBoundingClientRect(); return m.clientX < r.left + r.width / 2; });
    const before = to < 0 ? null : shown[to];
    if (before === col) return;
    const all = view.cols.columns;
    all.splice(all.indexOf(col), 1);
    all.splice(before ? all.indexOf(before) : all.length, 0, col);
    view.columnsChanged();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

// Its edge dragged: the column's width, within its minimum and maximum (plan 28 3.6).
function resizeColumn(view, col, e) {
  e.preventDefault();
  e.stopPropagation();
  const fontPx = view.fontPx();
  const start = e.clientX, from = (col.width ?? columnInfo(col.id).width) * fontPx;
  view.resizing = col.id;   // its edge stays lit while dragged (drawColumnHeader)
  const move = m => {
    col.width = withinLimits(col, Math.round((from + m.clientX - start) / fontPx * 10) / 10);
    view.drawHeader();
    view.render();
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    view.resizing = null;
    view.columnsChanged();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

// The header's right-click menu (plan 28 3.8), as xplorer2's: the columns, the fits, the sets.
function columnHeaderMenu(view) {
  const cols = view.cols;
  const choice = setFor(columnSets.folders, view.location);
  const useSet = (set, subfolders) => {
    const folders = columnSets.folders.filter(f => f.path.toLowerCase() !== view.location.toLowerCase());
    folders.push({ path: view.location, set: set.name, subfolders });
    post({ op: 'folderColumnsSave', folders });
  };
  return [
    { label: 'Select columns...', run: () => selectColumns(view) },
    { label: 'Fit columns', key: 'Ctrl+R', run: () => view.fitColumns('fit') },
    { label: 'Fit all columns', key: 'Ctrl+Shift+R', run: () => view.fitColumns('all') },
    '-',
    { label: 'Column sets', items: [
      ...columnSets.sets.map(s => ({ label: s.name, checked: cols.set === s.name, run: () => {
        Object.assign(cols, copyColumns(s));
        view.columnsChanged();
        view.sortEntries();
      } })),
      '-',
      { label: 'Save as new set...', run: async () => {
        const name = await askText('Name of the new column set', '');
        if (!name) return;
        saveMine([...columnSets.mine.filter(m => m.name.toLowerCase() !== name.toLowerCase()), { name, ...copyColumns(cols) }]);
      } },
      { label: cols.set ? `Update set ${cols.set}` : 'Update set', enabled: !!cols.set, run: () =>
        saveMine([...columnSets.mine.filter(m => m.name.toLowerCase() !== cols.set.toLowerCase()), { name: cols.set, ...copyColumns(cols) }]) },
      { label: 'Manage sets...', run: () => openManageSets() } ] },
    { label: 'Use a set for this folder', enabled: !!view.location && /^[A-Za-z]:\\|^\\\\/.test(view.location), items: [
      ...columnSets.sets.map(s => ({ label: s.name, checked: choice?.set === s.name, items: [
        { label: 'This folder only', run: () => useSet(s, false) },
        { label: 'With its subfolders', run: () => useSet(s, true) } ] })),
      '-',
      { label: 'Back to generic', enabled: !!choice, run: () =>
        post({ op: 'folderColumnsSave', folders: columnSets.folders.filter(f => f !== choice) }) } ] },
    { label: 'Columns...', enabled: !cols.set, run: () => openManageSets(view.id) },
  ];
}

function saveMine(mine) {
  post({ op: 'columnSetsSave', mine });
}

// ---------- Select columns (plan 28 3.7) and the Sort window (3.5) ----------

// Select columns: the columns not shown and the shown ones, arrows between; the set's filter. A modal floating window
// (dialogpage.js selectColumnsHere); each move shows or hides columns in this pane at once (not in the set).
async function selectColumns(view) {
  const list = await askPropList();
  const cols = view.cols, set = cols.set ? setNamed(cols.set) : null;
  const titled = id => ({ id, title: columnInfo(id).title });
  const shown = () => shownColumns(cols).map(c => c.id);
  await dialogWindow('Select columns', { what: 'selectColumns', setName: set?.name ?? null,
    setIds: set ? set.columns.map(c => c.id) : null, shown: shown().map(titled),
    all: [...OwnColumns.map(c => titled(c.id)), ...list.map(p => ({ id: p.name, title: p.title }))] }, m => {
    for (const id of m.show ?? []) {
      const col = cols.columns.find(c => c.id === id);
      if (col) delete col.hidden;
      else cols.columns.push({ id, width: columnInfo(id).width });
    }
    for (const id of m.hide ?? []) {
      const col = cols.columns.find(c => c.id === id);
      if (col && id !== 'name') col.hidden = true;
    }
    view.columnsChanged();
    view.sortEntries();
    return shown();
  });
}

// The Sort window: the pane's sort in order, `from` (the title Ctrl+clicked, or clicked outside a sort of several
// columns) added at its end when it is not in it. A modal floating window (dialogpage.js sortHere); each change sorts
// the pane at once.
async function openSortWindow(view, from) {
  if (!view.cols.sort.some(s => s.id === from)) sortChanged(view, [...view.cols.sort, { id: from, desc: false }]);
  const set = view.cols.set ? setNamed(view.cols.set) : null;
  const titles = Object.fromEntries(view.cols.columns.map(c => [c.id, columnInfo(c.id).title]));
  titles.name = columnInfo('name').title;
  await dialogWindow('Sort', { what: 'sort', sort: view.cols.sort, titles, setSort: set ? normalColumns(set).sort : null },
    m => sortChanged(view, m.sort));
}

// ---------- Manage sets (3.3) ----------

// Its screen is its page's (columnsets.html, colsmanage.js): a pane there is one of (app.js openOnePane), docked in a
// frame or floating, both as any pane of a page can be. This page sends it the sets with the columns there are, and
// does for it what needs this page: saving what it changed, a name or a Yes asked, closing it. `paneId` (Columns...
// in a pane's header, plan 28 3.8): that pane's own columns first in its list, chosen.
let managedPane = null, managedPaneFirst = false;
function openManageSets(paneId = null) {
  managedPane = paneId;
  managedPaneFirst = !!paneId;
  askPropList().then(() => paneOfKind('columnsets')?.render());
  openOnePane('columnsets');
  paneOfKind('columnsets')?.render();
}

// What the Manage page is sent (ColumnSetsView, app.js): the sets, every column's title and width, the pane whose own
// columns it shows too, where the line between its parts is (kept with its pane, `split`).
function columnSetsForPage(viewId = null) {
  const titles = {};
  for (const c of [...OwnColumns, ...InfoOnly, ...propInfo.values()]) titles[c.id] = { title: c.title, width: c.width };
  const pane = managedPane && layout.pane(managedPane) ? {
    id: managedPane, title: views.get(managedPane)?.el.querySelector('.title')?.textContent || layout.pane(managedPane).kind,
    ...normalColumns(layout.pane(managedPane).columns ?? genericColumns()) } : null;
  const first = managedPaneFirst;
  managedPaneFirst = false;
  return { kind: 'sets', columnSets, titles, own: OwnColumns.map(c => ({ id: c.id, title: c.title })),
    props: (propList ?? []).map(p => ({ name: p.name, title: p.title })), pane, paneFirst: first,
    split: viewId ? layout.pane(viewId)?.split ?? null : null };
}

// What the Manage page asks of this page.
async function columnSetsPageAsks(view, m) {
  switch (m.kind) {
    case 'saveMine': return saveMine(m.mine);
    case 'order': return post({ op: 'columnSetsSave', order: m.order });
    case 'folders': return post({ op: 'folderColumnsSave', folders: m.folders });
    case 'paneColumns': return views.get(m.id)?.setOwnColumns(m.columns);
    case 'split':
      layout.pane(view.id).split = m.at;
      return tellLayout();
    case 'close': return closePane(view.id);
    case 'ask': {
      const value = m.what === 'yes' ? await askYes(m.title) : await askText(m.title, m.value ?? '');
      return view.send({ kind: 'answer', key: `answer:${m.req}`, req: m.req, value });
    }
  }
}
