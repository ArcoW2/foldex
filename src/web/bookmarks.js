'use strict';
// Bookmarks, quick access among them (docs/plans/executed/26-PLAN-bookmarks.md). The host keeps one list (bookmarks.json;
// Bookmarks.cs) for every window and tells each page when it changes ("bookmarks"). An entry with quickAccess is a
// shortcut of the Quick access area at the top of a tree without a parent (TreeView, app.js: its head and shortcuts are
// rows of the tree); the others are the Bookmarks menu (the ribbon's Bookmarks). Each has a location (a folder, or an
// item: a file), a name, an icon, two keys and a way of opening (Regular or Root). Added and taken off by Foldex's own
// items in Windows' right-click menu (the host), by the menu and by Manage; changed in Edit. Every entry stands on its
// own, known by its id: a location can be on both tabs, or twice on one, each with its own name, icon and keys.

let bookmarks = [];                // the entries, in your order: { id, location, item, quickAccess, name, icon, key, keyNew, root }
let bookmarkPaths = {};            // a known folder's shell name (shell:Personal) -> its path now (the host tells)
let bookmarkExists = new Map();    // lower-case location -> whether it was there when last asked
const bookmarkEntries = new Map(); // lower-case location -> the host's entry for it (its own icon), once asked
const fileIcons = new Map();       // "file,index" -> a picture (a data URL), or null when the file has none there
let qaDragging = null;             // the id of a quick access shortcut being dragged (app.js TreeView): a drop in the area moves it

const QaHeadId = '::foldex-quick-access', QaHintId = '::foldex-quick-access-hint';
const DefaultIconFile = '%SystemRoot%\\System32\\SHELL32.dll';

// Where a location is: a known folder to its path now.
const folderPath = f => bookmarkPaths?.[f] ?? f;

// A location's own name: the last part of its path (a known folder's where it is now: OneDrive's Documenten, as Explorer).
const folderName = f => folderPath(f).replace(/\\+$/, '').split('\\').pop() || f;

// The folder a location is in (shown dimmed by two shortcuts with the same name).
const folderParent = f => folderPath(f).replace(/\\+$/, '').replace(/\\[^\\]*$/, '');

const bookmarkById = id => !!id && bookmarks.find(b => b.id === id) || null;
// The first entry of a location on a tab (quick: true for quick access, false for the menu's bookmarks).
const bookmarkAt = (f, quick) => !!f && bookmarks.find(b => !!b.quickAccess === quick && same(folderPath(b.location), folderPath(f))) || null;
// A new entry's id (the host gives one to an entry without).
const newBookmarkId = () => [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, '0')).join('');
const bookmarkName = b => b.name || folderName(b.location);
const quickAccessList = () => bookmarks.filter(b => b.quickAccess);
const menuBookmarks = () => bookmarks.filter(b => !b.quickAccess);
const bookmarkMissing = f => bookmarkExists.get(f.toLowerCase()) === false;

function bookmarksCame(m) {
  bookmarks = m.bookmarks ?? [];
  bookmarkPaths = m.paths ?? {};
  buildKeys();
  for (const b of bookmarks) if (b.icon && b.icon !== 'plain') askFileIcon(b.icon);
  for (const v of views.values()) if (v instanceof TreeView) v.quickAccessChanged();
  askBookmarksExist();
  askBookmarkEntries();
  ribbonRefresh();
  if (bmManage.el?.open) drawBookmarkManage();
}

// Whether the locations are there (the host asks off its window's thread, each with a time limit).
async function askBookmarksExist() {
  const m = await askHost({ op: 'bookmarksExist' });
  bookmarkExists = new Map(Object.entries(m.exists ?? {}).map(([f, on]) => [f.toLowerCase(), on]));
  for (const v of views.values()) if (v instanceof TreeView && v.qaHead) v.render();
  if (bmManage.el?.open) drawBookmarkManage();
}

// The host's entry of every location (its own icon), once each.
async function askBookmarkEntries() {
  const wanted = bookmarks.filter(b => !bookmarkEntries.has(b.location.toLowerCase()));
  await Promise.all(wanted.map(async b => {
    const [e] = (await askHost({ op: 'entries', ids: [b.location] })).entries ?? [];
    bookmarkEntries.set(b.location.toLowerCase(), e ?? null);
  }));
  if (wanted.length && bmManage.el?.open) drawBookmarkManage();
}

// "file,index" split; null for anything else.
function iconPlace(icon) {
  const at = icon?.lastIndexOf(',') ?? -1;
  return at > 0 && /^-?\d+$/.test(icon.slice(at + 1)) ? { file: icon.slice(0, at), index: Number(icon.slice(at + 1)) } : null;
}

// A Custom icon's picture, asked of the host once (Change Icon, 3.5); everything showing bookmarks drawn again then.
async function askFileIcon(icon) {
  const place = iconPlace(icon);
  if (!place || fileIcons.has(icon)) return;
  fileIcons.set(icon, undefined);
  const m = await askHost({ op: 'iconFile', file: place.file, index: place.index });
  fileIcons.set(icon, m.icons?.[0] ?? null);
  for (const v of views.values()) if (v instanceof TreeView && v.qaHead) v.render();
  if (bmManage.el?.open) drawBookmarkManage();
}

// A bookmark's icon as an <img>: Plain is an empty one (the room kept), Custom its picture (one that is gone falls back
// to Default), Default the location's own (the host's entry, `entry` when given).
function bookmarkIcon(b, entry = null) {
  if (b.icon === 'plain') return Object.assign(document.createElement('img'), { className: 'bm-plain' });
  const custom = b.icon && fileIcons.get(b.icon);
  if (custom) return Object.assign(document.createElement('img'), { src: custom });
  const e = entry ?? bookmarkEntries.get(b.location.toLowerCase());
  const missing = [];
  const img = iconImage(e ?? { icon: -1 }, missing);
  askIcons(missing, []);
  return img;
}

// The shortcut rows of a tree's Quick access area: one per shortcut of the list, made from the host's entries (a
// location that is not there: a row of its own, marked missing); its name and icon its entry's (3.10).
async function quickAccessEntries(list) {
  return Promise.all(list.map(async b => {
    const f = b.location;
    const [e] = (await askHost({ op: 'entries', ids: [f] })).entries ?? [];
    // `bm`: the entry's id, so two shortcuts of one location are two rows (TreeView.add).
    const row = e ? { ...e, id: f, bm: b.id, name: bookmarkName(b), folder: !b.item } : { id: f, bm: b.id, name: bookmarkName(b), folder: !b.item, missing: true };
    if (b.item) row.files = row.subs = false;   // an item: no expander
    return row;
  }));
}

// F2 on a quick access shortcut (3.10): its entry's name in the rename box; empty, or the location's own name, drops it.
function renameBookmarkInPlace(tree, node) {
  startRename(tree, node.id, { at: tree.flat.indexOf(node), done: name => {
    const list = bookmarks.map(b => {
      if (b.id !== node.bm) return b;
      const c = { ...b };
      if (name && name !== folderName(b.location)) c.name = name;
      else delete c.name;
      return c;
    });
    saveBookmarks(list);
  } });
}

// ---------- Opening (3.11, 3.12) ----------

// The pane a bookmark opens in: the active one when it shows folders, else the one-folder pane following it, else the
// first one-folder pane.
function favouritePane() {
  const v = activeView();
  if (v instanceof TreeView || (v instanceof ListView && !(v instanceof ScrapView))) return activePane;
  const list = [...views.values()].find(x => x instanceof ListView && !(x instanceof ScrapView));
  return list?.id ?? null;
}

// An item opened: focused in the pane that lists its folder once that pane has it (ListView.done; a list there
// already at once).
let bookmarkItemFocus = null;   // { folder, item }

function focusItemWhenListed(folder, item) {
  bookmarkItemFocus = { folder, item };
  for (const v of views.values())
    if (v instanceof ListView && !(v instanceof ScrapView) && same(v.location, folder) && !listeners.has(v.id) && itemListed(v)) return;
}

// A list that has the folder of the item waiting: the item selected and focused (gone: as it is, at its top). True
// when it was this list.
function itemListed(view) {
  const f = bookmarkItemFocus;
  if (!f || !same(view.location, f.folder)) return false;
  bookmarkItemFocus = null;
  const x = view.entries.find(e => same(e.id, f.item));
  if (x) view.select(x, {});
  return true;
}

// Opened as a click in the menu or on a shortcut, its Open key, or its right-click menu: `how` here (the active
// pane), new (a new root pane) or newChild (that with a child list). A location not there or not reachable: a message,
// nothing moves, the keyboard back in the active pane.
async function openBookmark(b, how = 'here') {
  const path = folderPath(b.location);
  const check = await askHost({ op: 'bookmarkCheck', location: b.location, item: !!b.item });
  const back = () => activeView()?.body.focus();
  if (check.state === 'gone') { status(`${path} is not there.`, true); return back(); }
  if (check.state === 'unreachable') { status(`${check.server ?? path} is not reachable.`, true); return back(); }
  const folder = b.item ? folderOf(path) : path;
  if (b.item && check.itemThere) focusItemWhenListed(folder, path);
  else bookmarkItemFocus = null;
  if (how === 'here') {
    const id = favouritePane();
    if (!id) return;
    const view = views.get(id);
    if (b.root && layout.pane(id).source === null) setPaneTop(id, folder);
    else {
      if (view instanceof ListView) delete layout.pane(id).top;   // Regular: no ".." from here on
      // A tree that shows files goes to the item itself.
      goTo(id, b.item && check.itemThere && view instanceof TreeView && view.showsFiles() ? path : folder);
    }
    return back();
  }
  const tree = newRootPane(b.root ? null : folder, { area: 'left' }, b.root ? folder : null);
  if (how === 'newChild') tree.ready.then(() => {
    newChildPane(tree.id, 'right');
    activate(tree.id);
    tree.body.focus();
  });
}

// ---------- The menu (the ribbon's Bookmarks; 3.7, 3.8) ----------

const inBookmarks = f => !!bookmarkAt(f, false);

function bookmarkMenuItem(b) {
  const missing = bookmarkMissing(b.location);
  return {
    label: missing ? `${bookmarkName(b)} (not there)` : bookmarkName(b), title: folderPath(b.location), icon: bookmarkIcon(b),
    key: b.key ?? '', run: () => openBookmark(b),
    // Its right-click (or the menu key): what else it does; kept short on purpose (3.8).
    context: [
      { label: 'Open', key: b.key ?? '', run: () => openBookmark(b) },
      { label: 'Open in a new pane', run: () => openBookmark(b, 'new') },
      { label: 'Open in a new pane with a child pane', key: b.keyNew ?? '', run: () => openBookmark(b, 'newChild') },
      '-',
      { label: 'Edit...', run: () => editBookmark(b.id) },
      { label: 'Remove', run: () => post({ op: 'bookmarkRemove', id: b.id }) },
    ],
  };
}

function bookmarksMenu() {
  const current = currentFolder();
  const items = menuBookmarks().map(bookmarkMenuItem);
  return [
    ...items,
    ...(items.length ? ['-'] : []),
    { label: current && inBookmarks(current) ? 'Remove current folder' : 'Add current folder', enabled: !!current, run: () => toggleCurrentBookmark() },
    { label: 'Add a folder...', run: async () => { const f = await pickFolder(); if (f) post({ op: 'bookmarkAdd', location: f }); } },
    { label: 'Manage...', run: () => manageBookmarks() },
  ];
}

function toggleCurrentBookmark() {
  const current = currentFolder();
  if (!current) return;
  // Remove current folder: its every bookmark of the menu (quick access keeps its shortcuts).
  if (inBookmarks(current)) saveBookmarks(bookmarks.filter(b => b.quickAccess || !same(folderPath(b.location), folderPath(current))));
  else post({ op: 'bookmarkAdd', location: current });
}

async function pickFolder(at = '') { return (await askHost({ op: 'pickFolder', at })).folder ?? null; }

// ---------- Manage (3.3): every bookmark in columns, in your order ----------

// Two tabs: the bookmarks of the menu and the quick access shortcuts, each entry on one of them. The button To quick
// access (on Bookmarks) or To bookmarks (on Quick access) opens a menu: Move to takes the selected entry to the other
// tab (its place in the list kept), Copy to puts a copy of it there (beside it in the list, without its keys: a key
// opens one entry). `at` counts the rows of the tab shown.
const bmManage = { el: null, tab: 'bookmarks', at: 0, widths: [200, 320] };

// The list's indexes of the tab shown, in list order.
const manageRows = () => bookmarks.flatMap((b, i) => !!b.quickAccess === (bmManage.tab === 'quick') ? [i] : []);

function manageBookmarks() {
  if (!bmManage.el) buildBookmarkManage();
  bmManage.at = 0;
  drawBookmarkManage();
  bmManage.el.showModal();
  bmManage.el.querySelector('.bm-list').focus();
}

function buildBookmarkManage() {
  const el = bmManage.el = document.createElement('dialog');
  el.className = 'ask bm-manage';
  el.innerHTML = `<div class="bm-tabs"><button type="button" data-tab="bookmarks">Bookmarks</button><button type="button" data-tab="quick">Quick access</button></div>
    <div class="bm-list" tabindex="0"><div class="bm-head"></div><div class="bm-rows"></div></div>
    <div class="ask-buttons">
      <button data-do="up" title="Ctrl+Up">Up</button><button data-do="down" title="Ctrl+Down">Down</button>
      <button data-do="add">Add...</button><button data-do="edit" title="Enter, F2, double click">Edit...</button>
      <button data-do="to" class="bm-menu-button"></button>
      <button data-do="delete" title="Del">Delete</button><button data-do="close">Close</button>
    </div>`;
  document.body.append(el);
  el.querySelector('.bm-tabs').addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (!t || t.dataset.tab === bmManage.tab) return;
    bmManage.tab = t.dataset.tab;
    bmManage.at = 0;
    drawBookmarkManage();
    el.querySelector('.bm-list').focus();
  });
  const list = el.querySelector('.bm-list');
  // The head: Name, Location; a border dragged makes the column before it wider (no sorting: the order is yours).
  const head = el.querySelector('.bm-head');
  ['Name', 'Location'].forEach((title, k) => {
    const cell = Object.assign(document.createElement('span'), { className: 'bm-cell', textContent: title });
    const grip = Object.assign(document.createElement('span'), { className: 'bm-grip' });
    grip.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const x0 = e.clientX, w0 = bmManage.widths[k];
      const move = ev => { bmManage.widths[k] = Math.max(40, w0 + ev.clientX - x0); drawBookmarkWidths(); };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    });
    cell.append(grip);
    head.append(cell);
  });
  list.addEventListener('mousedown', e => {
    const r = e.target.closest('[data-i]');
    if (!r) return;
    bmManage.at = +r.dataset.i;
    drawBookmarkManage();
  });
  list.addEventListener('dblclick', e => { if (e.target.closest('[data-i]')) bookmarkManageDo('edit'); });
  el.querySelector('.ask-buttons').addEventListener('click', e => { const b = e.target.closest('[data-do]'); if (b) bookmarkManageDo(b.dataset.do); });
  el.addEventListener('keydown', e => {
    if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const key = (e.ctrlKey ? 'Ctrl+' : '') + e.key;
    const what = { 'Ctrl+ArrowUp': 'up', 'Ctrl+ArrowDown': 'down', Delete: 'delete', ArrowUp: 'prev', ArrowDown: 'next',
      Enter: 'edit', F2: 'edit', ' ': 'move' }[key];
    if (!what) return;
    e.preventDefault();
    e.stopPropagation();
    if (what === 'prev' || what === 'next') {
      bmManage.at = Math.max(0, Math.min(manageRows().length - 1, bmManage.at + (what === 'next' ? 1 : -1)));
      drawBookmarkManage();
    } else bookmarkManageDo(what);
  });
  el.addEventListener('close', () => views.get(activePane)?.body.focus());
}

function drawBookmarkWidths() {
  const el = bmManage.el;
  el.style.setProperty('--bm-cols', bmManage.widths.map(w => `${w}px`).join(' '));
}

function drawBookmarkManage() {
  drawBookmarkWidths();
  const el = bmManage.el, quick = bmManage.tab === 'quick', rows = manageRows();
  for (const t of el.querySelectorAll('[data-tab]')) t.classList.toggle('on', t.dataset.tab === bmManage.tab);
  const to = el.querySelector('[data-do=to]');
  if (to.dataset.text !== (quick ? 'To bookmarks' : 'To quick access')) {
    to.textContent = to.dataset.text = quick ? 'To bookmarks' : 'To quick access';
    to.title = quick ? 'Move or copy the selected entry to Bookmarks (Space: move)' : 'Move or copy the selected entry to Quick access (Space: move)';
    markButtons(el);   // its letter again (buttons.js)
  }
  const box = el.querySelector('.bm-rows');
  bmManage.at = Math.max(0, Math.min(bmManage.at, rows.length - 1));
  box.replaceChildren(...rows.map((i, k) => {
    const b = bookmarks[i];
    const row = document.createElement('div');
    row.className = 'bm-row' + (k === bmManage.at ? ' selected' : '') + (bookmarkMissing(b.location) ? ' missing' : '');
    row.dataset.i = k;
    const name = Object.assign(document.createElement('span'), { className: 'bm-cell bm-name' });
    name.append(bookmarkIcon(b), Object.assign(document.createElement('span'), { textContent: bookmarkName(b) }));
    const where = Object.assign(document.createElement('span'), { className: 'bm-cell bm-where', textContent: folderPath(b.location), title: folderPath(b.location) });
    row.append(name, where);
    return row;
  }));
  if (!rows.length) box.append(Object.assign(document.createElement('div'), { className: 'bm-none',
    textContent: quick ? 'No quick access yet: Add..., or Move to quick access on the Bookmarks tab.' : 'No bookmarks yet: Add... picks a folder.' }));
  box.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  for (const b of el.querySelectorAll('[data-do=up], [data-do=down], [data-do=edit], [data-do=to], [data-do=delete]')) b.disabled = !rows.length;
}

// Every change goes to the host at once: the whole list.
function saveBookmarks(list) {
  bookmarks = list;
  post({ op: 'bookmarksSet', bookmarks: list });
  if (bmManage.el?.open) drawBookmarkManage();
}

async function bookmarkManageDo(what) {
  const list = [...bookmarks], rows = manageRows(), at = bmManage.at, i = rows[at];
  switch (what) {
    case 'close': return bmManage.el.close();
    case 'up': case 'down': {
      // With its neighbour on this tab; the entries of the other tab keep their places.
      const to = at + (what === 'up' ? -1 : 1);
      if (i === undefined || to < 0 || to >= rows.length) return;
      [list[i], list[rows[to]]] = [list[rows[to]], list[i]];
      bmManage.at = to;
      return saveBookmarks(list);
    }
    case 'delete':
      if (i === undefined) return;
      list.splice(i, 1);
      return saveBookmarks(list);
    case 'to': {
      // Its menu, under the button (inside the dialog, menu.js).
      if (i === undefined) return;
      const r = bmManage.el.querySelector('[data-do=to]').getBoundingClientRect();
      return openMenu(r.left, r.bottom, [
        { label: 'Move to', run: () => bookmarkManageDo('move') },
        { label: 'Copy to', run: () => bookmarkManageDo('copy') },
      ]);
    }
    case 'move':
      // To the other tab: the flag switched, its place in the list kept.
      if (i === undefined) return;
      list[i] = { ...list[i], quickAccess: !list[i].quickAccess };
      saveBookmarks(list);
      return bmManage.el.querySelector('.bm-list').focus();
    case 'copy': {
      // A copy on the other tab, beside it in the list; its own id, no keys.
      if (i === undefined) return;
      const { key, keyNew, ...rest } = list[i];
      list.splice(i + 1, 0, { ...rest, id: newBookmarkId(), quickAccess: !list[i].quickAccess });
      saveBookmarks(list);
      return bmManage.el.querySelector('.bm-list').focus();
    }
    case 'add': {
      // Added on the tab shown: on Quick access a shortcut.
      const made = await editBookmark(null, { quickAccess: bmManage.tab === 'quick' });
      if (made) bmManage.at = Math.max(0, manageRows().findIndex(k => bookmarks[k].id === made.id));
      drawBookmarkManage();
      return bmManage.el.querySelector('.bm-list').focus();
    }
    case 'edit':
      if (i === undefined) return;
      await editBookmark(list[i].id);
      drawBookmarkManage();
      return bmManage.el.querySelector('.bm-list').focus();
  }
}

// ---------- Edit (3.4): one bookmark, all of it ----------

// Edit for the entry with the id, or (null) a new one, its Browse... opened at once, starting with `start` (Manage's
// Quick access tab: quickAccess). Resolves to the entry kept, or null for Cancel.
function editBookmark(id, start = {}) {
  const old = id ? bookmarkById(id) : null;
  if (id && !old) return Promise.resolve(null);
  const b = { ...(old ?? { location: '', ...start }) };
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const row = (label, ...kids) => el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: label }), ...kids);
  const radio = (group, value, label, on) => {
    const r = el('input', { type: 'radio', name: group, value, checked: on });
    return [r, el('label', {}, r, ` ${label}`)];
  };
  const dialog = el('dialog', { className: 'find bm-edit' });
  const form = el('form', { method: 'dialog' });
  const name = el('input', { value: b.name ?? '', spellcheck: false, placeholder: 'Empty: the name of the folder or file' });
  const where = el('input', { value: b.location, spellcheck: false });
  const browse = el('button', { type: 'button', textContent: 'Browse...' });
  const [qa, qaLabel] = (() => { const c = el('input', { type: 'checkbox', checked: !!b.quickAccess }); return [c, el('label', {}, c, ' Quick access: in the Quick access area of the trees, not in the menu')]; })();
  const [regular, regularLabel] = radio('bm-open', 'regular', 'Regular', !b.root), [root, rootLabel] = radio('bm-open', 'root', 'Root: the top of the pane', !!b.root);
  const kind = !b.icon ? 'default' : b.icon === 'plain' ? 'plain' : 'custom';
  const [plain, plainLabel] = radio('bm-icon', 'plain', 'Plain', kind === 'plain'), [def, defLabel] = radio('bm-icon', 'default', 'Default', kind === 'default'),
    [custom, customLabel] = radio('bm-icon', 'custom', 'Custom', kind === 'custom');
  const iconShown = el('span', { className: 'bm-icon-shown' });
  const changeIcon = el('button', { type: 'button', textContent: 'Change Icon...' });
  let customIcon = kind === 'custom' ? b.icon : null;
  const key = keyField(b.key ?? ''), keyNew = keyField(b.keyNew ?? '');
  const clear = field => { const c = el('button', { type: 'button', textContent: 'Clear' }); c.addEventListener('click', () => { field.set(''); field.el.focus(); }); return c; };
  const ok = el('button', { value: 'ok', textContent: 'OK' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });
  form.append(
    row('Name', name), row('Location', where, browse), el('div', { className: 'find-row find-checks' }, qaLabel),
    row('Open as', regularLabel, rootLabel), row('Icon', plainLabel, defLabel, customLabel, iconShown, changeIcon),
    row('Open', key.el, clear(key)), row('Open in a new pane with a child pane', keyNew.el, clear(keyNew)),
    el('div', { className: 'ask-buttons' }, el('span', { className: 'find-gap' }), ok, cancel));
  dialog.append(el('div', { className: 'find-title', textContent: old ? `Edit bookmark: ${bookmarkName(old)}` : 'New bookmark' }), form);
  document.body.append(dialog);

  const showIcon = () => {
    changeIcon.hidden = !custom.checked;
    const icon = plain.checked ? 'plain' : custom.checked ? customIcon : undefined;
    if (icon && icon !== 'plain' && !fileIcons.has(icon)) askFileIcon(icon).then(showIcon);   // drawn again once it came
    iconShown.replaceChildren(bookmarkIcon({ location: where.value.trim() || b.location, icon }));
  };
  const pickIcon = async () => {
    const icon = await changeIconDialog(customIcon);
    if (icon) customIcon = icon;
    if (!customIcon) def.checked = true;
    showIcon();
  };
  for (const r of [plain, def]) r.addEventListener('change', showIcon);
  custom.addEventListener('change', () => customIcon ? showIcon() : pickIcon());
  changeIcon.addEventListener('click', pickIcon);
  browse.addEventListener('click', async () => {
    const f = await pickFolder(where.value.trim());
    if (f) where.value = f;
    where.focus();
  });
  showIcon();

  return new Promise(resolve => {
    let kept = null;
    form.addEventListener('submit', async e => {
      if (e.submitter?.value === 'cancel') return;
      e.preventDefault();
      const entry = await editChecked(old, {
        location: where.value.trim(), name: name.value.trim(), quickAccess: qa.checked, root: root.checked,
        icon: plain.checked ? 'plain' : custom.checked && customIcon ? customIcon : undefined, key: key.value(), keyNew: keyNew.value(),
      }, { where, key, keyNew });
      if (!entry) return;
      kept = entry;
      dialog.close('ok');
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(kept);
      if (!bmManage.el?.open) activeView()?.body.focus();
    }, { once: true });
    dialog.showModal();
    if (old) name.select();
    else {
      where.focus();
      browse.click();   // a new one: Windows' folder picker at once
    }
  });
}

// The fields of Edit checked on OK; the entry put in the list (one change to the host) and returned, or null when
// the dialog stays open.
async function editChecked(old, b, fields) {
  if (!b.location) {
    status('A bookmark needs a location: a folder or a file.', true);
    fields.where.focus();
    return null;
  }
  const check = await askHost({ op: 'bookmarkCheck', location: b.location, item: false });
  if (check.state !== 'there' && !(await askYes(`${b.location} is ${check.state === 'unreachable' ? 'not reachable' : 'not there'}. Keep it anyway?`))) {
    fields.where.focus();
    return null;
  }
  // A file there: an item (3.1); one that is not there keeps what it was.
  const item = check.state === 'there' ? !!check.isFile : !!old?.item && same(old.location, b.location);
  if (b.key && b.key === b.keyNew) {
    status(`${b.key} cannot open the bookmark both ways: give one of them another key.`, true);
    fields.keyNew.el.focus();
    return null;
  }
  // A clash with another key is asked; Yes takes the key over (3.6).
  for (const [k, field] of [[b.key, fields.key], [b.keyNew, fields.keyNew]]) {
    if (!k || [old?.key, old?.keyNew].includes(k)) continue;
    const lines = keyClashes(k, old?.id ?? null);
    if (lines.length && !(await askYes(`Use ${k} for this bookmark?`, lines))) {
      field.el.focus();
      return null;
    }
  }
  const entry = { id: old?.id ?? newBookmarkId(), location: old && same(folderPath(old.location), b.location) ? old.location : b.location };
  if (item) entry.item = true;
  if (b.quickAccess) entry.quickAccess = true;
  if (b.name && b.name !== folderName(entry.location)) entry.name = b.name;
  if (b.icon) entry.icon = b.icon;
  if (b.key) entry.key = b.key;
  if (b.keyNew) entry.keyNew = b.keyNew;
  if (b.root) entry.root = true;
  // Its keys taken from every other bookmark that had them.
  const list = bookmarks.map(x => {
    if (x === old) return entry;
    const y = { ...x };
    for (const p of ['key', 'keyNew']) if (y[p] && [entry.key, entry.keyNew].includes(y[p])) delete y[p];
    return y;
  });
  saveBookmarks(old ? list : [...list, entry]);
  return entry;
}

// ---------- Keys (3.6): two per bookmark, in the key set after keys.json ----------

// The bookmarks' keys for the key set (keys.js buildKeys): [key, call].
const bookmarkBindings = () => bookmarks.flatMap(b => [
  ...(b.key ? [[b.key, ['bookmarks.open', b.id]]] : []),
  ...(b.keyNew ? [[b.keyNew, ['bookmarks.openNew', b.id]]] : []),
]);

// What a key would take from others when this entry (`self`, its id; null for a new one) gets it: a line per clash.
function keyClashes(key, self) {
  const lines = [];
  const what = call => call[0].startsWith('bookmarks.open') && call[1]
    ? `the bookmark ${bookmarkName(bookmarkById(call[1]) ?? { location: '?' })}` : actionTitle(call[0], call.slice(1));
  const mine = call => call[0].startsWith('bookmarks.open') && !!self && call[1] === self;
  const first = key.includes(', ') ? key.split(', ')[0] : null;
  for (const [k, call] of keys.bindings) {
    if (mine(call)) continue;
    if (k === key) lines.push(`${key} is ${what(call)}; ${what(call)} then has no key${keysOf(call[0], ...call.slice(1)).length > 1 ? ' but its others' : ''}.`);
    else if (!first && k.startsWith(key + ', ')) lines.push(`${key} starts ${k} (${what(call)}); that chord stops working.`);
    else if (first && k === first) lines.push(`${first} is ${what(call)} on its own; it no longer runs that on its own.`);
  }
  return lines;
}

// A key field (3.6): focused, it takes the next key pressed and shows it; a second key makes a chord of the two, a
// third starts again. Empty, it offers Ctrl+B and waits for the second key (Backspace empties it: another first key
// can be pressed then). It does not run the keys it takes.
function keyField(value) {
  const el = Object.assign(document.createElement('input'), { className: 'key-field', readOnly: true, spellcheck: false });
  let parts = value ? value.split(', ') : [], offered = false;
  const draw = () => { el.value = offered ? `${parts[0]}, ...` : parts.join(', '); };
  el.addEventListener('focus', () => {
    if (!parts.length) { parts = ['Ctrl+B']; offered = true; }
    draw();
  });
  el.addEventListener('blur', () => {
    if (offered) { parts = []; offered = false; }
    draw();
  });
  el.addEventListener('keydown', e => {
    if (['Tab', 'Escape', 'Enter'].includes(e.key) && !e.ctrlKey && !e.altKey) return;
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.shiftKey) { parts = []; offered = false; return draw(); }
    const stroke = strokeOf(e);
    if (!stroke) return;
    parts = parts.length === 1 ? [parts[0], stroke] : [stroke];
    offered = false;
    draw();
  });
  draw();
  return { el, value: () => offered ? '' : parts.join(', '), set: v => { parts = v ? v.split(', ') : []; offered = false; draw(); } };
}

// ---------- Change Icon (3.5): every icon of a file ----------

// Resolves to the icon chosen ("file,index"), or null for Cancel.
function changeIconDialog(current) {
  const place = iconPlace(current) ?? { file: DefaultIconFile, index: 0 };
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const dialog = el('dialog', { className: 'find bm-icons' });
  const form = el('form', { method: 'dialog' });
  const file = el('input', { value: place.file, spellcheck: false });
  const browse = el('button', { type: 'button', textContent: 'Browse...' });
  const panel = el('div', { className: 'bm-icon-panel', tabIndex: 0 });
  const ok = el('button', { value: 'ok', textContent: 'OK' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });
  form.append(el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: 'Icons in' }), file, browse), panel,
    el('div', { className: 'ask-buttons' }, el('span', { className: 'find-gap' }), ok, cancel));
  dialog.append(el('div', { className: 'find-title', textContent: 'Change Icon' }), form);
  document.body.append(dialog);
  let chosen = place.index, shownFile = null;
  const pick = k => {
    chosen = k;
    for (const c of panel.children) c.classList.toggle('selected', +c.dataset.k === k);
    panel.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  };
  const load = async () => {
    shownFile = file.value.trim();
    panel.replaceChildren(el('div', { className: 'bm-none', textContent: 'Reading...' }));
    const m = await askHost({ op: 'iconFile', file: shownFile });
    if (shownFile !== file.value.trim()) return;
    const icons = m.icons ?? [];
    panel.replaceChildren(...icons.map((url, k) => {
      fileIcons.set(`${shownFile},${k}`, url ?? null);
      const c = el('div', { className: 'bm-icon-cell' }, el('img', { src: url ?? '' }));
      c.dataset.k = k;
      return c;
    }));
    if (!icons.length) panel.append(el('div', { className: 'bm-none', textContent: 'This file has no icons.' }));
    pick(icons.length ? Math.min(Math.max(0, chosen), icons.length - 1) : -1);
  };
  panel.addEventListener('mousedown', e => { const c = e.target.closest('[data-k]'); if (c) pick(+c.dataset.k); });
  panel.addEventListener('dblclick', e => { if (e.target.closest('[data-k]')) ok.click(); });
  panel.addEventListener('keydown', e => {
    const n = panel.querySelectorAll('[data-k]').length, perRow = Math.max(1, Math.floor(panel.clientWidth / 44));
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perRow, ArrowDown: perRow }[e.key];
    if (!step || !n) return;
    e.preventDefault();
    pick(Math.max(0, Math.min(n - 1, chosen + step)));
  });
  file.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); chosen = 0; load(); } });
  browse.addEventListener('click', async () => {
    const m = await askHost({ op: 'pickFile', at: file.value.trim(), filter: 'Icons (*.dll;*.exe;*.ico;*.icl)|*.dll;*.exe;*.ico;*.icl|All files|*.*' });
    if (m.file) {
      file.value = m.file;
      chosen = 0;
      load();
    }
  });
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'ok' && chosen >= 0 && shownFile ? `${shownFile},${chosen}` : null);
    }, { once: true });
    dialog.showModal();
    load();
    panel.focus();
  });
}
