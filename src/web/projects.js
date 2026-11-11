'use strict';
// The Manage projects window's page (projects.html; ProjectsForm hosts it), docs/plans/15-PLAN-projects.md 3.7, as
// LexPen's: every project in one list with a checkbox, its name, open or closed, its panes' folders, created and last
// used; a row unfolds to show its window's panes as a tree. A search filters on name and folders; the list sorts by
// name, created or last used (View menu or the column headers; the setting projectsSort). The menus (Project, Select,
// View; menu.js) and the buttons act on the checked projects that are shown; the host does the work (AppHost: open,
// close, rename, delete, new) and asks before deleting. Checking: a click toggles a project and is the anchor;
// Shift+click sets every row from the anchor to it to the clicked one's new state.
// Keys: Up / Down move, Space checks (Shift: range), Enter opens, F2 renames, Del deletes, Right / Left unfold and
// fold (Ctrl: the checked rows, or all), Ctrl+A checks all, Ctrl+F searches, Esc empties the search, then goes back.

const $ = s => document.querySelector(s);

// ---------- Host bridge: a request and its answer ({ id, result } or { id, error }); events ({ event }) ----------
const pending = new Map(), events = {};
let lastId = 0;
function host(op, args) {
  return new Promise((resolve, reject) => {
    pending.set(++lastId, { resolve, reject });
    chrome.webview.postMessage({ ...args, id: lastId, op });
  });
}
chrome.webview.addEventListener('message', e => {
  if (e.data.event) return events[e.data.event]?.(e.data);
  const { id, result, error } = e.data;
  const call = pending.get(id);
  pending.delete(id);
  error ? call?.reject(new Error(error)) : call?.resolve(result);
});

const view = {
  list: [], values: {}, search: $('.pv-search'), el: $('.pv-list'), count: $('.pv-count'),
  checked: new Map(),   // id -> true, in the order of checking
  anchor: null, focus: null, unfolded: new Set(), renaming: null, busy: false, shown: [],
};
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Sorting and filtering ----------
// The setting projectsSort: "name", "created" or "used", then "-asc" or "-desc".
function sortOf() {
  const [by, dir] = String(view.values.projectsSort ?? 'used-desc').split('-');
  return { by: ['name', 'created', 'used'].includes(by) ? by : 'used', desc: dir !== 'asc' };
}
function setSort(by, desc) {
  view.values.projectsSort = `${by}-${desc ? 'desc' : 'asc'}`;
  host('setting', { name: 'projectsSort', value: view.values.projectsSort });
  draw();
}
// Name: the named projects alphabetically (case ignored), then the unnamed ones by their number.
function compare(a, b, by) {
  if (by === 'name') {
    if (!!a.name !== !!b.name) return a.name ? -1 : 1;
    return a.name ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id - b.id : a.id - b.id;
  }
  if (by === 'created') {
    if (!!a.created !== !!b.created) return a.created ? 1 : -1;
    return a.created ? Date.parse(a.created) - Date.parse(b.created) || a.id - b.id : a.id - b.id;
  }
  return (a.used ? Date.parse(a.used) : 0) - (b.used ? Date.parse(b.used) : 0) || a.id - b.id;
}

const words = () => view.search.value.toLowerCase().split(/\s+/).filter(Boolean);
const haystack = p => [p.display, ...p.folders].join('\n').toLowerCase();

// The rows shown: filtered, then sorted.
function shownRows() {
  const ws = words(), { by, desc } = sortOf();
  const rows = view.list.filter(p => { const hay = haystack(p); return ws.every(w => hay.includes(w)); });
  rows.sort((a, b) => compare(a, b, by));
  if (desc) rows.reverse();
  return rows;
}

// The checked projects that are shown, in the order of checking.
function selected() {
  const shown = new Set(view.shown.map(p => p.id));
  return [...view.checked.keys()].filter(id => shown.has(id));
}
const byId = id => view.list.find(p => p.id === id);

// ---------- Drawing ----------
const pad = n => String(n).padStart(2, '0');
function dateText(iso, time) {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` + (time ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : '');
}
function marked(text, ws) {
  let html = escapeHtml(text);
  for (const w of ws) html = html.replace(new RegExp(escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<span class="pv-mark">${m}</span>`);
  return html;
}

function rowHtml(p, ws) {
  const unfolded = view.unfolded.has(p.id);
  const cls = ['pv-row', 'pv-grid', view.checked.has(p.id) && 'pv-checked', view.focus === p.id && 'pv-focus', unfolded && 'pv-unfolded'].filter(Boolean).join(' ');
  const folders = p.folders;
  const name = view.renaming === p.id
    ? `<input class="pv-rename" value="${escapeHtml(p.name)}" placeholder="Empty: Project ${p.id}" spellcheck="false">`
    : marked(p.display, ws);
  let html = `<div class="${cls}" data-id="${p.id}">` +
    `<button class="pv-fold" tabindex="-1" title="Its panes (Right / Left)"></button>` +
    `<input type="checkbox" class="pv-check" tabindex="-1"${view.checked.has(p.id) ? ' checked' : ''}>` +
    `<span class="pv-name${p.name ? '' : ' pv-unnamed'}" title="${escapeHtml(p.display)}">${name}</span>` +
    `<span class="pv-state${p.open ? ' pv-open-now' : ''}">${p.open ? 'open' : 'closed'}</span>` +
    `<span class="pv-folders" title="${escapeHtml(folders.join('\n'))}">${marked(folders.join('; ') || '(no folder)', ws)}</span>` +
    `<span class="pv-date">${dateText(p.created, false)}</span>` +
    `<span class="pv-date">${dateText(p.used, true)}</span></div>`;
  if (unfolded) {
    // Its window's panes as a tree: a root, then its children a step in.
    html += `<div class="pv-details" data-id="${p.id}">` + (p.panes.length ? p.panes.map(pane =>
      `<div class="pv-pane" style="padding-left: ${pane.depth * 1.5}em">${escapeHtml(pane.name)}</div>`).join('') : '(no panes)') + '</div>';
  }
  return html;
}

function draw() {
  const ws = words(), { by, desc } = sortOf();
  view.shown = shownRows();
  const top = view.el.scrollTop;
  view.el.innerHTML = view.shown.length ? view.shown.map(p => rowHtml(p, ws)).join('')
    : `<div class="pv-empty">${view.list.length ? 'No project matches the search.' : 'No projects.'}</div>`;
  view.el.scrollTop = top;
  for (const b of document.querySelectorAll('.pv-sort')) {
    b.classList.toggle('pv-on', b.dataset.sort === by);
    b.classList.toggle('pv-desc', b.dataset.sort === by && desc);
  }
  const sel = selected();
  const all = $('.pv-all');
  all.checked = view.shown.length > 0 && sel.length === view.shown.length;
  all.indeterminate = sel.length > 0 && sel.length < view.shown.length;
  view.count.textContent = `${view.shown.length} of ${view.list.length} project${view.list.length === 1 ? '' : 's'}` +
    (sel.length ? `, ${sel.length} checked` : '');
  $('.pv-open').disabled = view.busy || !targets().length;
  $('.pv-close').disabled = view.busy || !targets().some(id => byId(id)?.open);
  const input = view.el.querySelector('.pv-rename');
  if (input) { input.focus(); input.select(); }
}

// ---------- Checking ----------
function setChecked(id, on) {
  if (on) { if (!view.checked.has(id)) view.checked.set(id, true); } else view.checked.delete(id);
}
// A click on a checkbox (or Space): toggles it; with Shift, every row from the anchor to it gets its new state.
function toggle(id, range) {
  const on = !view.checked.has(id);
  const ids = view.shown.map(p => p.id), from = ids.indexOf(view.anchor), to = ids.indexOf(id);
  if (range && from >= 0 && to >= 0) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    for (const x of ids.slice(a, b + 1)) setChecked(x, on);   // in the order shown, after the rows already checked
  } else setChecked(id, on);
  view.anchor = view.focus = id;
  draw();
}
function checkAll(on) {
  for (const p of view.shown) setChecked(p.id, on);
  draw();
}
function invert() {
  for (const p of view.shown) setChecked(p.id, !view.checked.has(p.id));
  draw();
}
// Adds the shown projects that pass the test to the checked ones.
function checkWhere(test) {
  for (const p of view.shown) if (test(p)) setChecked(p.id, true);
  draw();
}
const DAY = 24 * 3600 * 1000;
const SINCE = [['A week', 7], ['A month', 30], ['Three months', 91], ['Half a year', 182], ['A year', 365]];

// What an action works on: the checked projects shown, else the row with the focus.
const targets = () => { const sel = selected(); return sel.length ? sel : view.focus !== null && byId(view.focus) ? [view.focus] : []; };

// ---------- Folding ----------
function fold(ids, open) {
  for (const id of ids) open ? view.unfolded.add(id) : view.unfolded.delete(id);
  draw();
}
const shownIds = () => view.shown.map(p => p.id);

// ---------- Actions ----------
async function busy(work) {
  view.busy = true;
  draw();
  try { await work(); } finally { view.busy = false; await refresh(); }
}
const openProjects = () => { const ids = targets(); if (ids.length) host('open', { projects: ids }); };
const closeProjects = () => { const ids = targets().filter(id => byId(id)?.open); if (ids.length) busy(() => host('close', { projects: ids })); };
const deleteProjects = () => { const ids = targets(); if (ids.length) busy(() => host('delete', { projects: ids })); };
async function newProject() {
  const name = await askName('Name of the new project');
  if (name !== null) host('new', { name });
}
function startRename() {
  const id = view.focus ?? selected()[0];
  if (id === undefined || id === null) return;
  view.focus = view.renaming = id;
  draw();
}
function endRename(keep) {
  const input = view.el.querySelector('.pv-rename');
  const id = view.renaming;
  view.renaming = null;
  if (keep && input && id !== null) host('rename', { project: id, name: input.value.trim() }).then(refresh);
  draw();
  view.el.focus();
}

// A name, or null for Cancel / Esc.
function askName(title) {
  const dialog = $('.pv-dialog'), input = $('.pv-dialog-input');
  $('.pv-dialog-label').textContent = title;
  input.value = '';
  dialog.returnValue = '';
  dialog.showModal();
  input.focus();
  return new Promise(resolve => dialog.addEventListener('close', () => {
    resolve(dialog.returnValue === 'ok' ? input.value.trim() : null);
    view.el.focus();
  }, { once: true }));
}

// ---------- The menu bar (menu.js) ----------
const MENUS = [
  ['Project', () => {
    const sel = selected();
    return [
      { label: 'New project...', run: newProject },
      { label: 'Open (Enter)', run: openProjects, enabled: targets().length > 0 },
      { label: 'Close', run: closeProjects, enabled: targets().some(id => byId(id)?.open) },
      { label: 'Rename (F2)', run: startRename, enabled: view.focus !== null || sel.length > 0 },
      '-',
      { label: 'Delete... (Del)', run: deleteProjects, enabled: targets().length > 0 },
    ];
  }],
  ['Select', () => [
    { label: 'All (Ctrl+A)', run: () => checkAll(true) },
    { label: 'None', run: () => checkAll(false) },
    { label: 'Invert', run: invert },
    '-',
    { label: 'Not used since', items: SINCE.map(([label, days]) => ({ label, run: () => {
      const before = Date.now() - days * DAY;
      checkWhere(p => !p.used || Date.parse(p.used) < before);
    } })) },
  ]],
  ['View', () => {
    const { by, desc } = sortOf(), any = selected().length > 0;
    return [
      { label: 'Sort by name', checked: by === 'name', run: () => setSort('name', false) },
      { label: 'Sort by created', checked: by === 'created', run: () => setSort('created', true) },
      { label: 'Sort by last used', checked: by === 'used', run: () => setSort('used', true) },
      { label: 'Reverse order', run: () => setSort(by, !desc) },
      '-',
      { label: 'Unfold all (Ctrl+Right)', run: () => fold(shownIds(), true) },
      { label: 'Unfold selected', run: () => fold(selected(), true), enabled: any },
      { label: 'Fold all (Ctrl+Left)', run: () => fold(shownIds(), false) },
      { label: 'Fold selected', run: () => fold(selected(), false), enabled: any },
    ];
  }],
];
const bar = $('.pv-menubar');
for (const [title, items] of MENUS) {
  const b = Object.assign(document.createElement('button'), { textContent: title });
  b.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const r = b.getBoundingClientRect();
    openMenu(r.left, r.bottom + 2, items());
  });
  bar.append(b);
}

// ---------- Mouse ----------
view.el.addEventListener('click', e => {
  const row = e.target.closest('.pv-row');
  if (!row || e.target.closest('.pv-rename')) return;
  const id = +row.dataset.id;
  if (e.target.closest('.pv-fold')) { view.focus = id; return fold([id], !view.unfolded.has(id)); }
  if (e.target.closest('.pv-check')) { e.preventDefault(); return toggle(id, e.shiftKey); }
  // A click on the name of the row that has the focus: rename.
  if (e.target.closest('.pv-name') && view.focus === id && !e.shiftKey && !e.ctrlKey) {
    clearTimeout(view.renameTimer);
    view.renameTimer = setTimeout(startRename, 450);   // not when it becomes a double click
    return;
  }
  view.focus = id;
  draw();
});
view.el.addEventListener('dblclick', e => {
  clearTimeout(view.renameTimer);
  const row = e.target.closest('.pv-row');
  if (!row || e.target.closest('.pv-check, .pv-fold, .pv-rename')) return;
  host('open', { projects: [+row.dataset.id] });
});
view.el.addEventListener('keydown', e => {
  if (!e.target.closest('.pv-rename')) return;
  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); endRename(true); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endRename(false); }
});
view.el.addEventListener('focusout', e => { if (e.target.closest('.pv-rename')) setTimeout(() => { if (view.renaming !== null) endRename(true); }); });
for (const b of document.querySelectorAll('.pv-sort'))
  b.addEventListener('click', () => { const { by, desc } = sortOf(); setSort(b.dataset.sort, b.dataset.sort === by ? !desc : b.dataset.sort !== 'name'); });
$('.pv-all').addEventListener('change', e => checkAll(e.target.checked));
$('.pv-open').addEventListener('click', openProjects);
$('.pv-close').addEventListener('click', closeProjects);
view.search.addEventListener('input', () => draw());

// ---------- Keys ----------
function moveFocus(d) {
  const ids = shownIds();
  if (!ids.length) return;
  const at = ids.indexOf(view.focus);
  view.focus = ids[at < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, at + d))];
  draw();
  view.el.querySelector('.pv-focus')?.scrollIntoView({ block: 'nearest' });
}
document.addEventListener('keydown', e => {
  if ($('.pv-dialog').open || view.renaming !== null) return;
  const inSearch = e.target === view.search;
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); view.search.focus(); view.search.select(); return; }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (view.search.value) { view.search.value = ''; draw(); view.el.focus(); }
    else host('back');
    return;
  }
  if (inSearch) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); view.el.focus(); if (view.focus === null) moveFocus(0); }
    return;
  }
  const ctrl = e.ctrlKey;
  if (e.key === 'ArrowDown') moveFocus(1);
  else if (e.key === 'ArrowUp') moveFocus(-1);
  else if (e.key === 'Home') moveFocus(-1e9);
  else if (e.key === 'End') moveFocus(1e9);
  else if (e.key === ' ' && view.focus !== null) toggle(view.focus, e.shiftKey);
  else if (e.key === 'Enter') openProjects();
  else if (e.key === 'F2') startRename();
  else if (e.key === 'Delete') deleteProjects();
  else if (ctrl && e.key.toLowerCase() === 'a') checkAll(true);
  else if (e.key === 'ArrowRight') fold(ctrl ? (selected().length ? selected() : shownIds()) : view.focus !== null ? [view.focus] : [], true);
  else if (e.key === 'ArrowLeft') fold(ctrl ? (selected().length ? selected() : shownIds()) : view.focus !== null ? [view.focus] : [], false);
  else return;
  e.preventDefault();
});

// ---------- Host events ----------
async function refresh() {
  view.list = await host('list');
  const ids = new Set(view.list.map(p => p.id));
  for (const id of [...view.checked.keys()]) if (!ids.has(id)) view.checked.delete(id);
  for (const id of [...view.unfolded]) if (!ids.has(id)) view.unfolded.delete(id);
  if (!ids.has(view.focus)) view.focus = null;
  if (view.renaming === null) draw();
}
// The projects changed: the list follows, a moment later (changes come in groups).
events.projects = () => { clearTimeout(view.refreshTimer); view.refreshTimer = setTimeout(refresh, 300); };
events.settings = m => {
  view.values = m.settings.values;
  applyLook(view.values, m.themes.themes);
  if (view.renaming === null) draw();
};

(async () => {
  const init = await host('init');
  view.values = init.look.settings.values;
  applyLook(view.values, init.look.themes.themes);
  view.list = init.list ?? [];
  draw();
  view.el.focus();
})();
