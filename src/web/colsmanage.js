'use strict';
// Manage column sets, the page of its pane (docs/plans/executed/14-PLAN-floating-panes.md 3.0, 3.7; docs/plans/executed/28-PLAN-column-sets-window.md
// 3.1 - 3.3): docked in a frame of its window's page, or floating. Its window's page sends the sets with the columns
// there are (`sets`); a change made here goes back whole (`saveMine`, `order`, `folders`), and the sets come again. A
// name and a question are asked of the window's page (`ask`), which answers (`answer`). Opened from a pane's header
// (Columns...), the list starts with that pane's own columns (`pane`), changed there (`paneColumns`).
//
// Two parts side by side, a line between them to drag (stacked, the sets first, where they do not fit): at the left the
// sets as a list (a grip per row, arrows, New, Rename, Duplicate, Delete, Reset); at the right the set chosen: its
// columns, each on two lines (title, shown, width, sort; Fit, minimum, maximum), arrows, Remove, Add a column, and the
// folders that use it.

let columnSets = { sets: [], mine: [], folders: [] };
let columnTitles = {};   // id -> { title, width }: Foldex's own columns and Windows' properties
let ownColumns = [], propList = [];
let managed = null;      // the set chosen by its name; PaneEntry: the pane's own columns
let paneCols = null;     // { id, title, columns, sort }: the pane the window was opened from (Columns...)
let chosenColumn = 0;    // the column chosen in the right part (its index)
let paneShown = null;    // { set, columns: id -> width }: how that pane shows its columns now (set: a folder's, null: its own)

const PaneEntry = ':pane';
const manageEl = document.getElementById('manage');
const columnInfo = id => columnTitles[id] ?? { title: id.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2'), width: 10 };
// The width the pane shows a column at now, when the right part shows what that pane shows (its own, or its folder's set).
const shownWidth = id => paneShown && (managed === PaneEntry ? !paneShown.set : !!paneShown.set && managed === paneShown.set)
  ? paneShown.columns[id] ?? null : null;
const copyColumns = c => JSON.parse(JSON.stringify({ columns: c.columns, sort: Array.isArray(c.sort) ? c.sort : c.sort?.id ? [c.sort] : [] }));
const setNamed = name => columnSets.sets.find(s => s.name.toLowerCase() === name.toLowerCase());
const saveMine = mine => toWindow({ kind: 'saveMine', mine });
const saveFolders = folders => toWindow({ kind: 'folders', folders });
const FitModes = [['never', 'never'], ['manual', 'manual'], ['enlarge', 'auto-enlarge'], ['shrink', 'auto-shrink'], ['both', 'auto-both']];
const fitOf = col => FitModes.some(([m]) => m === col.fit) ? col.fit : col.id === 'name' ? 'manual' : 'never';
const firstDescOf = col => col?.first === 'desc';   // as columns.js: its first sort direction
const EmTip = 'em: the width of the pane font\'s letter M; the column grows and shrinks with the font size';

paneHandlers.sets = m => {
  columnSets = m.columnSets ?? columnSets;
  columnTitles = m.titles ?? {};
  ownColumns = m.own ?? [];
  propList = m.props ?? [];
  paneCols = m.pane ?? null;
  paneShown = m.shown ?? null;
  if (m.pane && m.paneFirst) managed = PaneEntry;
  if (m.choose) managed = m.choose;
  if (managed === PaneEntry && !paneCols || managed !== PaneEntry && (managed === null || !setNamed(managed))) managed = columnSets.sets[0]?.name ?? null;
  if (m.split) manageEl.style.setProperty('--cs-left', `${m.split}px`);
  drawManage();
};

// A name or a Yes asked of the window's page: its answer.
let asks = 0;
const asked = new Map();
function askWindowPage(m) {
  const req = ++asks;
  toWindow({ kind: 'ask', req, ...m });
  return new Promise(resolve => asked.set(req, resolve));
}
paneHandlers.answer = m => { asked.get(m.req)?.(m.value ?? null); asked.delete(m.req); };
const askText = (title, value) => askWindowPage({ what: 'text', title, value });
const askYes = async title => !!await askWindowPage({ what: 'yes', title });

// The set changed here: written as yours (a shipped one changed becomes yours; Reset brings it back).
function changeSet(name, change) {
  const set = copyColumns(setNamed(name));
  change(set);
  saveMine([...columnSets.mine.filter(m => m.name.toLowerCase() !== name.toLowerCase()), { name, ...set }]);
}

// What the right part shows changed: the set chosen, or the pane's own columns (sent to that pane).
function changeChosen(change) {
  if (managed !== PaneEntry) return changeSet(managed, change);
  const c = copyColumns(paneCols);
  change(c);
  Object.assign(paneCols, c);
  toWindow({ kind: 'paneColumns', id: paneCols.id, columns: c });
  drawManage();
}

const button = (text, run, enabled = true, title = '') => {
  const b = Object.assign(document.createElement('button'), { textContent: text, disabled: !enabled, title });
  b.addEventListener('click', run);
  return b;
};

// A row of a list dragged by its handle: it goes before the row whose middle is below the mouse when let go.
function dragRow(e, list, k, moved) {
  e.preventDefault();
  const rows = [...list.children].filter(r => r.dataset.movable);
  const row = rows.find(r => +r.dataset.i === k);
  row.classList.add('dragging');
  const up = m => {
    removeEventListener('mouseup', up);
    row.classList.remove('dragging');
    const at = rows.findIndex(r => { const b = r.getBoundingClientRect(); return m.clientY < b.top + b.height / 2; });
    const to = at < 0 ? +rows[rows.length - 1].dataset.i + 1 : +rows[at].dataset.i;
    if (to !== k && to !== k + 1) moved(k, to > k ? to - 1 : to);
  };
  addEventListener('mouseup', up);
}
const moveIn = (list, from, to) => list.splice(to, 0, ...list.splice(from, 1));

function drawManage() {
  drawSets();
  drawChosen();
}

// ---------- The sets (3.2) ----------

function drawSets() {
  const list = manageEl.querySelector('.cs-setlist');
  const rows = [];
  if (paneCols) {
    const row = Object.assign(document.createElement('div'), { className: 'cs-row cs-setrow' + (managed === PaneEntry ? ' selected' : '') });
    row.append(Object.assign(document.createElement('span'), { className: 'cs-name', textContent: `This pane's columns (${paneCols.title})` }));
    row.addEventListener('click', () => { managed = PaneEntry; chosenColumn = 0; drawManage(); });
    rows.push(row);
  }
  columnSets.sets.forEach((s, k) => {
    const row = Object.assign(document.createElement('div'), { className: 'cs-row cs-setrow' + (s.name === managed ? ' selected' : '') });
    row.dataset.i = k;
    row.dataset.movable = '1';
    const handle = Object.assign(document.createElement('span'), { className: 'bm-handle', title: 'Drag to move the set' });
    handle.addEventListener('mousedown', e => dragRow(e, list, k, moveSet));
    row.append(handle, Object.assign(document.createElement('span'), { className: 'cs-name',
      textContent: s.name + (s.shipped && s.mine ? ' (changed)' : s.shipped ? '' : ' (yours)') }));
    row.addEventListener('click', e => {
      if (e.target.closest('.bm-handle')) return;
      managed = s.name;
      chosenColumn = 0;
      drawManage();
    });
    rows.push(row);
  });
  list.replaceChildren(...rows);
  const at = columnSets.sets.findIndex(s => s.name === managed);
  manageEl.querySelector('.cs-sets .up').disabled = at <= 0;
  manageEl.querySelector('.cs-sets .down').disabled = at < 0 || at >= columnSets.sets.length - 1;
  const set = managed !== PaneEntry && managed && setNamed(managed);
  const others = name => columnSets.mine.filter(m => m.name.toLowerCase() !== name.toLowerCase());
  manageEl.querySelector('.cs-setbuttons').replaceChildren(
    button('New...', async () => {
      const name = await askText('Name of the new column set', '');
      if (!name) return;
      managed = name;
      saveMine([...others(name), { name, columns: [{ id: 'name', width: columnInfo('name').width }], sort: [] }]);
    }),
    button('Rename...', async () => {
      const name = await askText('New name of the set', set.name);
      if (!name || name === set.name) return;
      const mine = others(set.name).filter(m => m.name.toLowerCase() !== name.toLowerCase());
      mine.push({ name, ...copyColumns(set) });
      if (set.shipped) mine.push({ name: set.name, deleted: true });
      managed = name;
      saveMine(mine);
      saveFolders(columnSets.folders.map(f => f.set === set.name ? { ...f, set: name } : f));
    }, !!set),
    button('Duplicate...', async () => {
      const name = await askText('Name of the copy', `${set.name} (2)`);
      if (name) { managed = name; saveMine([...others(name), { name, ...copyColumns(set) }]); }
    }, !!set),
    button('Delete...', async () => {
      if (!await askYes(`Delete the column set ${set.name}?`)) return;
      saveMine([...others(set.name), ...(set.shipped ? [{ name: set.name, deleted: true }] : [])]);
      managed = null;
    }, !!set),
    button('Reset', () => saveMine(others(set.name)), !!set && set.shipped && set.mine, 'The set back as shipped'));
}

// The sets in another order (a grip, the arrows): kept, and used in every list of sets.
function moveSet(from, to) {
  const names = columnSets.sets.map(s => s.name);
  moveIn(names, from, to);
  columnSets.sets = names.map(setNamed);
  drawSets();
  toWindow({ kind: 'order', order: names });
}

// ---------- The set chosen (3.3) ----------

function drawChosen() {
  const pane = managed === PaneEntry;
  const set = pane ? paneCols : managed && setNamed(managed);
  const label = manageEl.querySelector('.cs-setname'), list = manageEl.querySelector('.cs-columns');
  if (!set) {
    label.textContent = 'No set chosen';
    list.replaceChildren();
    manageEl.querySelector('.cs-columnbuttons').replaceChildren();
    manageEl.querySelector('.setfolders').replaceChildren();
    return;
  }
  label.textContent = pane ? `Columns of this pane (${paneCols.title})`
    : `Set: ${set.name}${set.shipped && set.mine ? ' (changed)' : set.shipped ? '' : ' (yours)'}`;
  chosenColumn = Math.min(chosenColumn, set.columns.length - 1);
  const sort = Array.isArray(set.sort) ? set.sort : [];
  list.replaceChildren(...set.columns.map((col, k) => columnRow(set, sort, col, k, list)));
  manageEl.querySelector('.cs-set .up').disabled = chosenColumn <= 0;
  manageEl.querySelector('.cs-set .down').disabled = chosenColumn >= set.columns.length - 1;
  // Remove the column chosen (not the name); a column added, from Foldex's own and Windows' properties.
  const chosen = set.columns[chosenColumn];
  // The columns to add chosen in a window of its own (dialogpage.js pickColumnHere): found by typing, or in the list;
  // one or more, added at the end in the list's order, the last one chosen here.
  const choices = [...ownColumns.map(c => ({ id: c.id, title: c.title })), ...propList.map(p => ({ id: p.name, title: `${p.title} (${p.name})` }))]
    .filter(({ id }) => !set.columns.some(c => c.id === id));
  const add = button('Add a column...', async () => {
    const ids = await askWindowPage({ what: 'column', columns: choices });
    if (ids?.length) changeChosen(s => {
      for (const id of ids) if (!s.columns.some(c => c.id === id)) s.columns.push({ id, width: columnInfo(id).width });
      chosenColumn = s.columns.length - 1;
    });
  }, choices.length > 0, 'Columns added to the set: Foldex\'s own or Windows\' properties (Ctrl+click or Shift+click chooses more than one)');
  manageEl.querySelector('.cs-columnbuttons').replaceChildren(
    button('Remove', () => changeChosen(s => s.columns.splice(chosenColumn, 1)), !!chosen && chosen.id !== 'name',
      'The column chosen out of the set (the name column stays)'), add);
  // The folders that use it.
  const folders = manageEl.querySelector('.setfolders');
  if (pane) return folders.replaceChildren();
  const using = columnSets.folders.filter(f => f.set.toLowerCase() === set.name.toLowerCase());
  folders.replaceChildren(using.length ? 'Used by:' : 'No folder uses it.', ...using.map(f => {
    const row = document.createElement('div');
    row.append(`${f.path}${f.subfolders ? ' and its subfolders' : ''} `,
      button('Remove', () => saveFolders(columnSets.folders.filter(x => x !== f))));
    return row;
  }));
}

// A column on two lines: the grip, its title, Shown, its width and its sort cell; its Fit, minimum, maximum and Give way.
function columnRow(set, sort, col, k, list) {
  const row = Object.assign(document.createElement('div'), { className: 'cs-row cs-colrow' + (k === chosenColumn ? ' selected' : '') });
  row.dataset.i = k;
  row.dataset.movable = '1';
  row.addEventListener('mousedown', e => {
    if (e.target.closest('input, select, button, .bm-handle') || k === chosenColumn) return;
    chosenColumn = k;
    for (const r of list.children) r.classList.toggle('selected', +r.dataset.i === k);
    manageEl.querySelector('.cs-set .up').disabled = k <= 0;
    manageEl.querySelector('.cs-set .down').disabled = k >= set.columns.length - 1;
    manageEl.querySelector('.cs-columnbuttons button').disabled = col.id === 'name';
  });
  // A grip on each of its two lines: either drags the column.
  const grip = () => {
    const handle = Object.assign(document.createElement('span'), { className: 'bm-handle', title: 'Drag to move the column' });
    handle.addEventListener('mousedown', e => dragRow(e, list, k, (from, to) => changeChosen(s => {
      moveIn(s.columns, from, to);
      chosenColumn = to;
    })));
    return handle;
  };
  const number = (value, change, title, empty = false, caption = '') => {
    const box = Object.assign(document.createElement('input'), { type: 'number', min: 1, step: 0.5, value: value ?? '', title,
      placeholder: empty ? 'none' : '' });
    box.addEventListener('change', () => changeChosen(s => change(s.columns[k], box.value === '' ? null : Number(box.value))));
    const unit = Object.assign(document.createElement('span'), { className: 'cs-unit', textContent: 'em', title: EmTip });
    const wrap = Object.assign(document.createElement('span'), { className: 'cs-size' });   // kept together when lines wrap
    if (caption) wrap.append(Object.assign(document.createElement('span'), { className: 'cs-caption', textContent: caption }));
    wrap.append(box, unit);
    return wrap;
  };
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'cs-shown', checked: !col.hidden, disabled: col.id === 'name',
    title: col.id === 'name' ? 'Shown: the name column always is' : 'Shown; off: kept in the set, not shown (Select columns... in a pane shows it)' });
  box.addEventListener('change', () => changeChosen(s => { if (box.checked) delete s.columns[k].hidden; else s.columns[k].hidden = true; }));
  // How wide the pane it was opened from shows it now (an auto column fitted), when that pane shows these columns.
  const now = shownWidth(col.id);
  // The sort cell: none, the column's first direction, the other one, none again; its place in the sort when more than
  // one column sorts.
  const at = sort.findIndex(s => s.id === col.id), firstDesc = firstDescOf(col);
  const dirName = desc => desc ? 'descending' : 'ascending';
  const sortCell = button(at < 0 ? '-' : `${sort[at].desc ? 'v' : '^'}${sort.length > 1 ? at + 1 : ''}`, () => changeChosen(s => {
    const i = s.sort.findIndex(x => x.id === col.id);
    if (i < 0) s.sort.push({ id: col.id, desc: firstDesc });
    else if (s.sort[i].desc === firstDesc) s.sort[i].desc = !firstDesc;
    else s.sort.splice(i, 1);
  }), true, at < 0 ? `Not sorted by; a click: ${dirName(firstDesc)}`
    : sort[at].desc === firstDesc ? `${sort[at].desc ? 'Descending' : 'Ascending'}; a click: ${dirName(!firstDesc)}`
    : `${sort[at].desc ? 'Descending' : 'Ascending'}; a click: not sorted by`);
  sortCell.className = 'cs-sort';
  const first = Object.assign(document.createElement('div'), { className: 'cs-line' });
  first.append(grip(), box, Object.assign(document.createElement('span'), { className: 'cs-title', textContent: columnInfo(col.id).title, title: col.id }));
  if (now != null && !col.hidden) first.append(Object.assign(document.createElement('span'), { className: 'cs-now',
    textContent: `shown ${Math.round(now * 10) / 10} em`, title: `How wide the pane shows it now (${EmTip})` }));
  const fit = document.createElement('select');
  fit.title = 'How the column fits its values: never: only with Ctrl+Shift+R (every column); manual: with Ctrl+R too; auto: as soon as the values change, and with either key';
  fit.append(...FitModes.map(([value, text]) => new Option(text, value)));
  fit.value = fitOf(col);
  fit.addEventListener('change', () => changeChosen(s => { s.columns[k].fit = fit.value; }));
  // Give way (columns.js fittedWidths): its place in the order in which fitted columns narrow when too wide for the pane.
  const giveWay = Object.assign(document.createElement('span'), { className: 'cs-size' });
  const wayBox = Object.assign(document.createElement('input'), { type: 'number', min: 1, step: 1, value: col.giveWay ?? '',
    placeholder: col.id === 'name' ? 'last' : 'none',
    title: 'Give way: when the fitted columns are too wide for the pane, they narrow in this order (1 first), each down to its minimum; '
      + 'only while the column is fitted. Empty: it does not give way (the name column: it gives way last)' });
  wayBox.addEventListener('change', () => changeChosen(s => {
    const v = Number(wayBox.value);
    if (Number.isInteger(v) && v >= 1) s.columns[k].giveWay = v; else delete s.columns[k].giveWay;
  }));
  giveWay.append(Object.assign(document.createElement('span'), { className: 'cs-caption', textContent: 'give way' }), wayBox);
  // First (columns.js sortAfterClick): the direction a first click on its title sorts it.
  const firstWrap = Object.assign(document.createElement('span'), { className: 'cs-size' });
  const firstBox = document.createElement('select');
  firstBox.title = 'First: the direction a first click on the column title sorts by it; a second click the other way';
  firstBox.append(new Option('^ ascending', 'asc'), new Option('v descending', 'desc'));
  firstBox.value = firstDesc ? 'desc' : 'asc';
  firstBox.addEventListener('change', () => changeChosen(s => { if (firstBox.value === 'desc') s.columns[k].first = 'desc'; else delete s.columns[k].first; }));
  firstWrap.append(Object.assign(document.createElement('span'), { className: 'cs-caption', textContent: 'first' }), firstBox);
  const second = Object.assign(document.createElement('div'), { className: 'cs-line cs-fitline' });
  second.append(grip(), Object.assign(document.createElement('span'), { className: 'cs-caption', textContent: 'Fit' }), fit,
    number(col.width ?? columnInfo(col.id).width, (c, v) => { c.width = v ?? columnInfo(col.id).width; },
      `Width asked for; an auto column fits from it (${EmTip})`, false, 'width'),
    number(col.min, (c, v) => { if (v) c.min = v; else delete c.min; }, `Minimum width (${EmTip})`, false, 'min'),
    number(col.max, (c, v) => { if (v) c.max = v; else delete c.max; }, `Maximum width, empty: none (${EmTip})`, true, 'max'), giveWay, firstWrap, sortCell);
  row.append(first, second);
  return row;
}

// ---------- The arrows, the keys, the line between the parts ----------

manageEl.querySelector('.cs-sets .up').addEventListener('click', () => {
  const at = columnSets.sets.findIndex(s => s.name === managed);
  if (at > 0) moveSet(at, at - 1);
});
manageEl.querySelector('.cs-sets .down').addEventListener('click', () => {
  const at = columnSets.sets.findIndex(s => s.name === managed);
  if (at >= 0 && at < columnSets.sets.length - 1) moveSet(at, at + 1);
});
manageEl.querySelector('.cs-set .up').addEventListener('click', () => {
  if (chosenColumn > 0) changeChosen(s => { moveIn(s.columns, chosenColumn, chosenColumn - 1); chosenColumn--; });
});
manageEl.querySelector('.cs-set .down').addEventListener('click', () => changeChosen(s => {
  if (chosenColumn < s.columns.length - 1) { moveIn(s.columns, chosenColumn, chosenColumn + 1); chosenColumn++; }
}));
for (const bar of manageEl.querySelectorAll('.bm-arrows')) bar.addEventListener('mousedown', e => e.preventDefault());

// Up and Down in the sets' list choose the set above or below; in the columns' list, the column.
manageEl.querySelector('.cs-setlist').addEventListener('keydown', e => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const names = [...(paneCols ? [PaneEntry] : []), ...columnSets.sets.map(s => s.name)];
  const at = names.indexOf(managed) + (e.key === 'ArrowUp' ? -1 : 1);
  if (at < 0 || at >= names.length) return;
  managed = names[at];
  chosenColumn = 0;
  drawManage();
});
manageEl.querySelector('.cs-columns').addEventListener('keydown', e => {
  if (e.target !== e.currentTarget || e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const count = manageEl.querySelectorAll('.cs-colrow').length;
  chosenColumn = Math.max(0, Math.min(count - 1, chosenColumn + (e.key === 'ArrowUp' ? -1 : 1)));
  drawChosen();
});

// The line between the parts dragged: the sets' part wider or narrower; where it is, kept with the pane.
manageEl.querySelector('.cs-split').addEventListener('mousedown', e => {
  e.preventDefault();
  const left = manageEl.querySelector('.cs-sets'), x0 = e.clientX, w0 = left.getBoundingClientRect().width;
  const width = x => Math.round(Math.max(160, Math.min(manageEl.clientWidth - 320, w0 + x - x0)));
  const move = m => manageEl.style.setProperty('--cs-left', `${width(m.clientX)}px`);
  const up = m => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    toWindow({ kind: 'split', at: width(m.clientX) });
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
});

manageEl.querySelector('.close').addEventListener('click', () => toWindow({ kind: 'close' }));
