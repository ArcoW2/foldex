'use strict';
// Manage column sets, the page of its pane (docs/plans/executed/14-PLAN-floating-panes.md 3.0, 3.7; the screen of plan 05's
// Manage sets, columns.js): docked in a frame of its window's page, or floating. Its window's page sends the sets with
// the columns there are (`sets`); a change made here goes back whole (`saveMine`, `folders`), and the sets come again.
// A name and a question are asked of the window's page (`ask`), which answers (`answer`).
//
// The sets at the left, the one chosen at the right: Rename..., Duplicate, Delete, Reset; its columns (order, width,
// take away), a column added, its sort, Fit by themselves, the folders that use it.

let columnSets = { sets: [], mine: [], folders: [] };
let columnTitles = {};   // id -> { title, width }: Foldex's own columns and Windows' properties
let ownColumns = [], propList = [];
let managed = null;

const manageEl = document.getElementById('manage');
const columnInfo = id => columnTitles[id] ?? { title: id.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2'), width: 10 };
const copyColumns = c => JSON.parse(JSON.stringify({ columns: c.columns, sort: c.sort ?? null, fit: !!c.fit }));
const setNamed = name => columnSets.sets.find(s => s.name.toLowerCase() === name.toLowerCase());
const saveMine = mine => toWindow({ kind: 'saveMine', mine });
const saveFolders = folders => toWindow({ kind: 'folders', folders });

paneHandlers.sets = m => {
  columnSets = m.columnSets ?? columnSets;
  columnTitles = m.titles ?? {};
  ownColumns = m.own ?? [];
  propList = m.props ?? [];
  if (managed === null || !setNamed(managed)) managed = columnSets.sets[0]?.name ?? null;
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

function drawManage() {
  const list = manageEl.querySelector('.setlist');
  list.replaceChildren(...columnSets.sets.map(s => {
    const b = document.createElement('button');
    b.textContent = s.name + (s.shipped && s.mine ? ' (changed)' : s.shipped ? '' : ' (yours)');
    b.classList.toggle('on', s.name === managed);
    b.addEventListener('click', () => { managed = s.name; drawManage(); });
    return b;
  }));
  const set = managed && setNamed(managed);
  const edit = manageEl.querySelector('.setedit');
  if (!set) return edit.replaceChildren();
  const others = name => columnSets.mine.filter(m => m.name.toLowerCase() !== name.toLowerCase());
  const button = (text, run, enabled = true) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = !enabled;
    b.addEventListener('click', run);
    return b;
  };
  const actions = document.createElement('div');
  actions.className = 'setactions';
  actions.append(
    button('Rename...', async () => {
      const name = await askText('New name of the set', set.name);
      if (!name || name === set.name) return;
      const mine = others(set.name).filter(m => m.name.toLowerCase() !== name.toLowerCase());
      mine.push({ name, ...copyColumns(set) });
      if (set.shipped) mine.push({ name: set.name, deleted: true });
      managed = name;
      saveMine(mine);
      saveFolders(columnSets.folders.map(f => f.set === set.name ? { ...f, set: name } : f));
    }),
    button('Duplicate', async () => {
      const name = await askText('Name of the copy', `${set.name} (2)`);
      if (name) { managed = name; saveMine([...others(name), { name, ...copyColumns(set) }]); }
    }),
    button('Delete', async () => {
      if (!await askYes(`Delete the column set ${set.name}?`)) return;
      saveMine([...others(set.name), ...(set.shipped ? [{ name: set.name, deleted: true }] : [])]);
      managed = null;
    }),
    button('Reset', () => saveMine(others(set.name)), set.shipped && set.mine));
  // Its columns: order, width, take away; one added from Foldex's own and Windows' properties.
  const rows = document.createElement('div');
  rows.className = 'setcolumns';
  set.columns.forEach((col, k) => {
    const row = document.createElement('div');
    const width = document.createElement('input');
    width.type = 'number';
    width.min = 2;
    width.value = col.width ?? columnInfo(col.id).width;
    width.title = 'Width in em of the pane font';
    width.addEventListener('change', () => changeSet(set.name, s => { s.columns[k].width = Number(width.value) || columnInfo(col.id).width; }));
    const title = document.createElement('span');
    title.textContent = columnInfo(col.id).title;
    title.title = col.id;
    row.append(title, width,
      button('Up', () => changeSet(set.name, s => s.columns.splice(k - 1, 0, ...s.columns.splice(k, 1))), k > 1),
      button('Down', () => changeSet(set.name, s => s.columns.splice(k + 1, 0, ...s.columns.splice(k, 1))), k > 0 && k < set.columns.length - 1),
      button('Remove', () => changeSet(set.name, s => s.columns.splice(k, 1)), k > 0));
    rows.append(row);
  });
  const add = document.createElement('select');
  const choices = [...ownColumns.map(c => [c.id, c.title]), ...propList.map(p => [p.name, `${p.title} (${p.name})`])]
    .filter(([id]) => !set.columns.some(c => c.id === id));
  add.append(new Option('Add a column...', ''), ...choices.map(([id, t]) => new Option(t, id)));
  add.addEventListener('change', () => add.value && changeSet(set.name, s => s.columns.push({ id: add.value, width: columnInfo(add.value).width })));
  const sort = document.createElement('select');
  sort.append(new Option('No sort (by name)', ''), ...set.columns.map(c => new Option(`Sort by ${columnInfo(c.id).title}`, c.id)));
  sort.value = set.sort?.id ?? '';
  sort.addEventListener('change', () => changeSet(set.name, s => { s.sort = sort.value ? { id: sort.value, desc: !!s.sort?.desc } : null; }));
  const desc = document.createElement('label');
  const descBox = document.createElement('input');
  descBox.type = 'checkbox';
  descBox.checked = !!set.sort?.desc;
  descBox.disabled = !set.sort;
  descBox.addEventListener('change', () => changeSet(set.name, s => { if (s.sort) s.sort.desc = descBox.checked; }));
  desc.append(descBox, ' Descending');
  const fit = document.createElement('label');
  const fitBox = document.createElement('input');
  fitBox.type = 'checkbox';
  fitBox.checked = !!set.fit;
  fitBox.addEventListener('change', () => changeSet(set.name, s => { s.fit = fitBox.checked; }));
  fit.append(fitBox, ' Fit by themselves');
  // The folders that use it.
  const folders = document.createElement('div');
  folders.className = 'setfolders';
  const using = columnSets.folders.filter(f => f.set.toLowerCase() === set.name.toLowerCase());
  folders.append(using.length ? 'Used by:' : 'No folder uses it.', ...using.map(f => {
    const row = document.createElement('div');
    row.append(`${f.path}${f.subfolders ? ' and its subfolders' : ''} `,
      button('Remove', () => saveFolders(columnSets.folders.filter(x => x !== f))));
    return row;
  }));
  edit.replaceChildren(actions, rows, add, sort, desc, fit, folders);
}

manageEl.querySelector('.close').addEventListener('click', () => toWindow({ kind: 'close' }));
