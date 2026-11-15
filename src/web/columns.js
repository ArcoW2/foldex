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

// Fit columns (3.4): each column as wide as it needs; too wide for the pane, the name column (the first) gives way
// first, down to its minimum. Widths in px.
function fitWidths(needs, available, nameMin) {
  const widths = [...needs];
  const over = widths.reduce((a, x) => a + x, 0) - available;
  if (over > 0) widths[0] = Math.max(nameMin, widths[0] - over);
  return widths.map(x => Math.ceil(x));
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

// Sorting by a column (3.1): folders first, as now; then by the column's value, empty values last; equal values by
// name. `desc`: the other direction.
function columnComparer(id, kind, desc) {
  const sign = desc ? -1 : 1;
  return (a, b) => {
    if (a.folder !== b.folder) return a.folder ? -1 : 1;
    if (id !== 'name') {
      const x = sortValue(a, id, kind), y = sortValue(b, id, kind);
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
      if (x !== null && y !== null) {
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : naturalCompare(String(x), String(y));
        if (c) return sign * c;
      }
      return naturalCompare(a.name, b.name);
    }
    return sign * naturalCompare(a.name, b.name);
  };
}

// ---------- Sets and the pane's columns ----------

let columnSets = { sets: [], mine: [], folders: [] };
let propList = null;   // Windows' properties for columns (the host's propList), asked once
const propInfo = new Map();

function setColumnSets(m) {
  columnSets = m;
  if (m.problems?.length) status(m.problems.join(' '), true);
  for (const v of views.values()) if (v instanceof ListView && v.location) v.chooseColumns(true);
  paneOfKind('columnsets')?.render();
}

function columnInfo(id) {
  return OwnColumns.find(c => c.id === id) ?? InfoOnly.find(c => c.id === id) ?? propInfo.get(id)
    ?? { id, title: id.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2'), kind: 'text', width: 10 };
}

const copyColumns = c => JSON.parse(JSON.stringify({ columns: c.columns, sort: c.sort ?? null, fit: !!c.fit }));
const setNamed = name => columnSets.sets.find(s => s.name.toLowerCase() === name.toLowerCase());

// A new pane's columns: the Generic set's.
function genericColumns() {
  const generic = setNamed('Generic');
  return generic ? copyColumns(generic) : { columns: OwnColumns.slice(0, 4).map(c => ({ id: c.id, width: c.width })), sort: null, fit: false };
}

// The pane's own (generic) columns, kept on the pane, so they go with the layout into the project.
function paneColumns(id) {
  const pane = layout.pane(id);
  return pane.columns ??= genericColumns();
}

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
  for (const v of views.values()) if (v instanceof ListView) v.drawHeader();
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

// ---------- The header (3.4) ----------

// A list's header: the titles at their widths, the sort marked; a click sorts, dragging a title moves its column,
// dragging the edge after it resizes it; its menu by a right-click.
function drawColumnHeader(view) {
  const head = view.colhead;
  const inner = document.createElement('div');
  inner.className = 'colhead-inner';
  const cols = view.cols.columns, fontPx = view.fontPx();
  cols.forEach((col, k) => {
    const info = columnInfo(col.id);
    const cell = document.createElement('div');
    cell.className = 'colcell' + (RightAligned.has(info.kind) ? ' right' : '');
    cell.style.width = `${(col.width ?? info.width) * fontPx}px`;
    cell.textContent = info.title;
    cell.title = info.title + (info.id.includes('.') ? ` (${info.id})` : '');
    if (view.cols.sort?.id === col.id) cell.classList.add(view.cols.sort.desc ? 'desc' : 'asc');
    cell.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.classList.contains('colgrip')) resizeColumn(view, k, e);
      else moveColumn(view, k, e);
    });
    const grip = document.createElement('span');
    grip.className = 'colgrip';
    cell.append(grip);
    inner.append(cell);
  });
  head.replaceChildren(inner);
  inner.style.transform = `translateX(${-view.body.scrollLeft}px)`;
}

// A title clicked (not dragged): sort by it, again the other way.
function sortByColumn(view, id) {
  const sort = view.cols.sort;
  view.cols.sort = sort?.id === id ? { id, desc: !sort.desc } : { id, desc: false };
  view.columnsChanged();
  view.sortEntries();
}

function moveColumn(view, k, e) {
  const startX = e.clientX;
  let moved = false;
  const cells = [...view.colhead.querySelectorAll('.colcell')];
  const move = m => {
    if (!moved && Math.abs(m.clientX - startX) < 5) return;
    moved = true;
    cells[k].classList.add('dragging');
  };
  const up = m => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    cells[k].classList.remove('dragging');
    if (!moved) return sortByColumn(view, view.cols.columns[k].id);
    if (k === 0) return;   // the name column stays first
    // The place: before the first title whose middle is right of the mouse; never before the name.
    let to = cells.findIndex(c => { const r = c.getBoundingClientRect(); return m.clientX < r.left + r.width / 2; });
    if (to < 0) to = cells.length;
    to = Math.max(1, to);
    const cols = view.cols.columns;
    const [col] = cols.splice(k, 1);
    cols.splice(to > k ? to - 1 : to, 0, col);
    view.columnsChanged();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

function resizeColumn(view, k, e) {
  e.preventDefault();
  e.stopPropagation();
  const col = view.cols.columns[k], fontPx = view.fontPx();
  const start = e.clientX, from = (col.width ?? columnInfo(col.id).width) * fontPx;
  const move = m => {
    col.width = Math.max(2, Math.round((from + m.clientX - start) / fontPx * 10) / 10);
    view.drawHeader();
    view.render();
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    view.columnsChanged();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

function columnHeaderMenu(view) {
  const cols = view.cols, has = id => cols.columns.some(c => c.id === id);
  const toggle = id => {
    if (has(id)) cols.columns = cols.columns.filter(c => c.id !== id);
    else cols.columns.push({ id, width: columnInfo(id).width });
    view.columnsChanged();
  };
  const choice = setFor(columnSets.folders, view.location);
  const useSet = (set, subfolders) => {
    const folders = columnSets.folders.filter(f => f.path.toLowerCase() !== view.location.toLowerCase());
    folders.push({ path: view.location, set: set.name, subfolders });
    post({ op: 'folderColumnsSave', folders });
  };
  return [
    ...OwnColumns.filter(c => c.id !== 'name').map(c => ({ label: c.title, checked: has(c.id), run: () => toggle(c.id) })),
    { label: 'More columns...', run: () => moreColumns(view) },
    '-',
    { label: 'Apply a set', items: columnSets.sets.map(s => ({ label: s.name, run: () => {
      Object.assign(cols, copyColumns(s));
      view.columnsChanged();
      view.sortEntries();
    } })) },
    { label: 'Use a set for this folder', enabled: !!view.location && /^[A-Za-z]:\\|^\\\\/.test(view.location), items: [
      ...columnSets.sets.map(s => ({ label: s.name, checked: choice?.set === s.name, items: [
        { label: 'This folder only', run: () => useSet(s, false) },
        { label: 'With its subfolders', run: () => useSet(s, true) } ] })),
      '-',
      { label: 'Back to generic', enabled: !!choice, run: () =>
        post({ op: 'folderColumnsSave', folders: columnSets.folders.filter(f => f !== choice) }) } ] },
    { label: 'Save as new set...', run: async () => {
      const name = await askText('Name of the new column set', '');
      if (!name) return;
      saveMine([...columnSets.mine.filter(m => m.name.toLowerCase() !== name.toLowerCase()), { name, ...copyColumns(cols) }]);
    } },
    { label: cols.set ? `Update set ${cols.set}` : 'Update set', enabled: !!cols.set, run: () =>
      saveMine([...columnSets.mine.filter(m => m.name.toLowerCase() !== cols.set.toLowerCase()), { name: cols.set, ...copyColumns(cols) }]) },
    { label: 'Manage sets...', run: () => openManageSets() },
    '-',
    { label: 'Fit columns', run: () => view.fitColumns() },
    { label: 'Fit by themselves', checked: !!cols.fit, run: () => { cols.fit = !cols.fit; view.columnsChanged(); if (cols.fit) view.fitColumns(); } },
  ];
}

function saveMine(mine) {
  post({ op: 'columnSetsSave', mine });
}

// More columns: every property Windows has for columns, searchable; a click adds or takes away a column. In a modal
// floating window (plan 14 3.7, dialogpage.js moreColumnsHere); each click changes the pane's columns here at once.
async function moreColumns(view) {
  const list = await askPropList();
  await dialogWindow('More columns', { what: 'moreColumns', list, shown: view.cols.columns.map(c => c.id) }, m => {
    if (m.on) view.cols.columns.push({ id: m.name, width: 10 });
    else view.cols.columns = view.cols.columns.filter(c => c.id !== m.name);
    view.columnsChanged();
  });
}

// ---------- Manage sets (3.3) ----------

// Its screen is its page's (columnsets.html, colsmanage.js): a pane there is one of (app.js openOnePane), docked in a
// frame or floating, both as any pane of a page can be. This page sends it the sets with the columns there are, and
// does for it what needs this page: saving what it changed, a name or a Yes asked, closing it.
function openManageSets() {
  askPropList().then(() => paneOfKind('columnsets')?.render());
  openOnePane('columnsets');
}

// What the Manage page is sent (ColumnSetsView, app.js): the sets, and every column's title and width.
function columnSetsForPage() {
  const titles = {};
  for (const c of [...OwnColumns, ...InfoOnly, ...propInfo.values()]) titles[c.id] = { title: c.title, width: c.width };
  return { kind: 'sets', columnSets, titles, own: OwnColumns.map(c => ({ id: c.id, title: c.title })),
    props: (propList ?? []).map(p => ({ name: p.name, title: p.title })) };
}

// What the Manage page asks of this page.
async function columnSetsPageAsks(view, m) {
  switch (m.kind) {
    case 'saveMine': return saveMine(m.mine);
    case 'folders': return post({ op: 'folderColumnsSave', folders: m.folders });
    case 'close': return closePane(view.id);
    case 'ask': {
      const value = m.what === 'yes' ? await askYes(m.title) : await askText(m.title, m.value ?? '');
      return view.send({ kind: 'answer', key: `answer:${m.req}`, req: m.req, value });
    }
  }
}
