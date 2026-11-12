'use strict';
// Quick access and favourite folders (docs/plans/executed/23-PLAN-quick-access-and-favourites.md). The host keeps both lists
// (quickaccess.json, favourite-folders.json; FolderLists.cs) for every window and tells each page when one changes
// ("folderLists"). Quick access is an area at the top of a tree without a parent (TreeView, app.js: its head and
// shortcuts are rows of the tree); favourite folders are a menu (the ribbon's Favourites) with Manage. Folders are
// added and taken off by Foldex's own items in Windows' right-click menu (the host), by the menu and by Manage.

let folderLists = { quickAccess: [], favourites: [], paths: {} };
let folderExists = new Map();   // lower-case folder -> whether it was there when last asked

const QaHeadId = '::foldex-quick-access', QaHintId = '::foldex-quick-access-hint';

// Where a folder of the lists is: a known folder's shell name (shell:Personal) to its path now (the host tells).
const folderPath = f => folderLists.paths?.[f] ?? f;

// A folder's name: the last part of its path (a known folder's where it is now: OneDrive's Documenten, as Explorer).
const folderName = f => folderPath(f).replace(/\\+$/, '').split('\\').pop() || f;

// The folder a folder of the lists is in (shown dimmed by two shortcuts with the same name).
const folderParent = f => folderPath(f).replace(/\\+$/, '').replace(/\\[^\\]*$/, '');

function folderListsCame(lists) {
  folderLists = { quickAccess: lists.quickAccess ?? [], favourites: lists.favourites ?? [], paths: lists.paths ?? {} };
  for (const v of views.values()) if (v instanceof TreeView) v.quickAccessChanged();
  askFolderExists();
  ribbonRefresh();
}

// Whether the folders of both lists are there (the host asks off its window's thread, each with a time limit).
async function askFolderExists() {
  const m = await askHost({ op: 'folderListsExist' });
  folderExists = new Map(Object.entries(m.exists ?? {}).map(([f, on]) => [f.toLowerCase(), on]));
  for (const v of views.values()) if (v instanceof TreeView && v.qaHead) v.render();
}
const folderMissing = f => folderExists.get(f.toLowerCase()) === false;

// The shortcut rows of a tree's Quick access area: one per folder of the list, made from the host's entries (a folder
// that is not there: a row of its own, marked missing).
async function quickAccessEntries(list) {
  return Promise.all(list.map(async f => {
    const [e] = (await askHost({ op: 'entries', ids: [f] })).entries ?? [];
    return e ? { ...e, id: f, name: folderName(f), folder: true } : { id: f, name: folderName(f), folder: true, missing: true };
  }));
}

// A folder of a list that is gone: said, and offered to take it off.
async function missingFolder(kind, f) {
  if (await askYes(`${f} is not there (any more). Take it off ${kind === 'quickaccess' ? 'quick access' : 'the favourite folders'}?`))
    post({ op: 'folderListRemove', kind, folder: f });
}

// ---------- Favourite folders: the menu (the ribbon's Favourites) ----------

// The pane a favourite opens in: the active one when it shows folders, else the one-folder pane following it, else the
// first one-folder pane.
function favouritePane() {
  const v = activeView();
  if (v instanceof TreeView || (v instanceof ListView && !(v instanceof ScrapView))) return activePane;
  const list = [...views.values()].find(x => x instanceof ListView && !(x instanceof ScrapView));
  return list?.id ?? null;
}

function openFavourite(f) {
  if (folderMissing(f)) return missingFolder('favourites', f);
  const id = favouritePane();
  if (id) goTo(id, f);
}

const inList = (kind, f) => !!f && folderLists[kind === 'quickaccess' ? 'quickAccess' : 'favourites'].some(x => same(x, f));

function favouritesMenu() {
  const current = currentFolder();
  const items = folderLists.favourites.map(f => ({
    label: folderName(f), enabled: true, title: f, missing: folderMissing(f),
    run: () => openFavourite(f),
  }));
  return [
    ...items.map(i => ({ ...i, label: i.missing ? `${i.label} (not there)` : i.label })),
    ...(items.length ? ['-'] : []),
    { label: current && inList('favourites', current) ? 'Remove current folder' : 'Add current folder', enabled: !!current,
      run: () => post({ op: inList('favourites', current) ? 'folderListRemove' : 'folderListAdd', kind: 'favourites', folder: current }) },
    { label: 'Add a folder...', run: async () => { const f = await pickFolder(); if (f) post({ op: 'folderListAdd', kind: 'favourites', folder: f }); } },
    { label: 'Manage...', run: () => manageFavourites() },
  ];
}

async function pickFolder(at = '') { return (await askHost({ op: 'pickFolder', at })).folder ?? null; }

// ---------- Manage: the favourite folders in order, added, changed, deleted (as LexPen's) ----------

const favManage = { el: null, list: [], at: 0 };

function manageFavourites() {
  if (!favManage.el) buildFavManage();
  favManage.list = [...folderLists.favourites];
  favManage.at = 0;
  drawFavManage();
  favManage.el.showModal();
  favManage.el.querySelector('.fav-list').focus();
}

function buildFavManage() {
  const el = favManage.el = document.createElement('dialog');
  el.className = 'ask fav-manage';
  el.innerHTML = `<div class="ask-line">Favourite folders</div>
    <div class="fav-list" tabindex="0"></div>
    <div class="ask-buttons">
      <button data-do="up" title="Ctrl+Up">Up</button><button data-do="down" title="Ctrl+Down">Down</button>
      <button data-do="add">Add...</button><button data-do="change" title="Enter, double click">Change...</button>
      <button data-do="delete" title="Del">Delete</button><button data-do="close">Close</button>
    </div>`;
  document.body.append(el);
  const list = el.querySelector('.fav-list');
  list.addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (r) { favManage.at = +r.dataset.i; drawFavManage(); } });
  list.addEventListener('dblclick', e => { if (e.target.closest('[data-i]')) favDo('change'); });
  el.querySelector('.ask-buttons').addEventListener('click', e => { const b = e.target.closest('[data-do]'); if (b) favDo(b.dataset.do); });
  el.addEventListener('keydown', e => {
    const key = (e.ctrlKey ? 'Ctrl+' : '') + e.key;
    const what = { 'Ctrl+ArrowUp': 'up', 'Ctrl+ArrowDown': 'down', Delete: 'delete', ArrowUp: 'prev', ArrowDown: 'next', Enter: 'change' }[key];
    if (!what || e.target.closest('button') && e.key === 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (what === 'prev' || what === 'next') {
      favManage.at = Math.max(0, Math.min(favManage.list.length - 1, favManage.at + (what === 'next' ? 1 : -1)));
      drawFavManage();
    } else favDo(what);
  });
  el.addEventListener('close', () => views.get(activePane)?.body.focus());
}

function drawFavManage() {
  const box = favManage.el.querySelector('.fav-list');
  box.replaceChildren(...favManage.list.map((f, i) => {
    const row = document.createElement('div');
    row.className = 'fav-row' + (i === favManage.at ? ' selected' : '') + (folderMissing(f) ? ' missing' : '');
    row.dataset.i = i;
    row.title = f;
    row.append(Object.assign(document.createElement('span'), { className: 'fav-name', textContent: folderName(f) }),
      Object.assign(document.createElement('span'), { className: 'fav-dir', textContent: folderParent(f) }));
    return row;
  }));
  if (!favManage.list.length) box.append(Object.assign(document.createElement('div'), { className: 'fav-none', textContent: 'No favourite folders yet: Add... picks one.' }));
  box.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  for (const b of favManage.el.querySelectorAll('[data-do=up], [data-do=down], [data-do=change], [data-do=delete]')) b.disabled = !favManage.list.length;
}

// Every change goes to the host at once: the whole list in its new order.
function saveFavManage() {
  post({ op: 'folderListSet', kind: 'favourites', folders: favManage.list });
  drawFavManage();
}

async function favDo(what) {
  const list = favManage.list, at = favManage.at;
  switch (what) {
    case 'close': return favManage.el.close();
    case 'up': case 'down': {
      const to = at + (what === 'up' ? -1 : 1);
      if (to < 0 || to >= list.length) return;
      [list[at], list[to]] = [list[to], list[at]];
      favManage.at = to;
      return saveFavManage();
    }
    case 'delete':
      if (!list.length) return;
      list.splice(at, 1);
      favManage.at = Math.max(0, Math.min(at, list.length - 1));
      return saveFavManage();
    case 'add': {
      const f = await pickFolder();
      if (!f || list.some(x => same(x, f))) return;
      list.push(f);
      favManage.at = list.length - 1;
      return saveFavManage();
    }
    case 'change': {
      if (!list.length) return;
      const f = await pickFolder(list[at]);
      if (!f) return;
      list[at] = f;
      favManage.list = list.filter((x, i) => i === at || !same(x, f));
      favManage.at = favManage.list.indexOf(f);
      return saveFavManage();
    }
  }
}
