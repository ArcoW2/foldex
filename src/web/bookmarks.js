'use strict';
// Bookmarks, quick access among them (docs/plans/executed/26-PLAN-bookmarks.md). The host keeps one list (bookmarks.json;
// Bookmarks.cs) for every window and tells each page when it changes ("bookmarks"). An entry with quickAccess is a
// shortcut of the Quick access area at the top of a tree without a parent (TreeView, app.js: its head and shortcuts are
// rows of the tree); the others are the Bookmarks menu (the ribbon's Bookmarks). Each has a location (a folder, or an
// item: a file), a name, an icon, two keys and a way of opening (Regular or Root). Added and taken off by Foldex's own
// items in Windows' right-click menu (the host), by the menu and by Manage; changed in Edit. Every entry stands on its
// own, known by its id: a location can be on both tabs, or twice on one, each with its own name, icon and keys.
// Folders of bookmarks (docs/plans/executed/27-PLAN-bookmark-folders.md): an entry { id, folder: name, quickAccess, items } holds
// bookmarks and folders, to any depth; what it holds is on its tab. A submenu in the menu, a row in a tree's Quick access
// area and in Manage; nothing on disk.

let bookmarks = [];                // the entries, in your order: { id, location, item, quickAccess, name, icon, key, keyNew, root }, or folders
let bookmarkPaths = {};            // a known folder's shell name (shell:Personal) -> its path now (the host tells)
let bookmarkExists = new Map();    // lower-case location -> whether it was there when last asked
const bookmarkEntries = new Map(); // lower-case location -> the host's entry for it (its own icon), once asked
const fileIcons = new Map();       // "file,index" -> a picture (a data URL), or null when the file has none there
let qaDragging = null;             // the id of a quick access shortcut being dragged (app.js TreeView): a drop in the area moves it

const QaHeadId = '::foldex-quick-access', QaHintId = '::foldex-quick-access-hint';
const DefaultIconFile = '%SystemRoot%\\System32\\SHELL32.dll';


// An entry taken off. A folder that holds something asks (plan 27 3.6): Remove all, Move up (what it holds to where the
// folder was), or Cancel.
async function removeBookmark(id) {
  const tree = copyBookmarks(), at = locateIn(tree, id);
  if (!at) return;
  if (isGroup(at.b) && at.b.items?.length) {
    const held = bookmarkPlaces(at.b.items).length;
    const m = await askHost({ op: 'choose', text: `Remove the folder "${at.b.folder}"?`, lines: [`It holds ${held} ${held === 1 ? 'entry' : 'entries'}.`],
      buttons: [['all', 'Remove all'], ['up', 'Move up'], [null, 'Cancel']] });
    activeView()?.body.focus();
    if (m.choice === 'up') {
      const quick = !!bookmarkPlaces(tree).find(p => p.b.id === id).quick;
      at.list.splice(at.index, 1, ...at.b.items.map(c => onTab(c, quick)));
      return saveBookmarks(tree);
    }
    if (m.choice !== 'all') return;
  }
  at.list.splice(at.index, 1);
  saveBookmarks(tree);
}

// A new folder's name asked; put in by `place` (tree => void), or at the end of the tab. Its id, or null.
async function newBookmarkFolder(quick, place = null) {
  const name = await askText(quick ? 'Name of the new quick access folder' : 'Name of the new bookmark folder', '', 'Empty: New folder');
  if (name === null) return null;
  const tree = copyBookmarks(), g = { id: newBookmarkId(), folder: name || 'New folder', items: [] };
  if (place) place(tree, g);
  else putIn(tree, g, null, quick, Infinity);
  saveBookmarks(tree);
  return g.id;
}

// A folder renamed (its name asked; empty keeps it).
async function renameBookmarkFolder(id) {
  const g = bookmarkById(id);
  if (!isGroup(g)) return;
  const name = await askText('Name of the folder', g.folder, '');
  if (name) changeBookmark(id, b => { b.folder = name; });
}

// A folder's own small menu (the Bookmarks menu's right-click, a tree's Quick access area).
const bookmarkGroupMenu = id => [
  { label: 'Rename...', run: () => renameBookmarkFolder(id) },
  { label: 'Remove', run: () => removeBookmark(id) },
];

function bookmarksCame(m) {
  bookmarks = m.bookmarks ?? [];
  bookmarkPaths = m.paths ?? {};
  buildKeys();
  for (const b of allBookmarks()) if (b.icon && b.icon !== 'plain') askFileIcon(b.icon);
  for (const v of views.values()) if (v instanceof TreeView) v.quickAccessChanged();
  askBookmarksExist();
  askBookmarkEntries();
  ribbonRefresh();
  bookmarksPane?.render();
}

// Whether the locations are there (the host asks off its window's thread, each with a time limit).
async function askBookmarksExist() {
  const m = await askHost({ op: 'bookmarksExist' });
  bookmarkExists = new Map(Object.entries(m.exists ?? {}).map(([f, on]) => [f.toLowerCase(), on]));
  for (const v of views.values()) if (v instanceof TreeView && v.qaHead) v.render();
  bookmarksPane?.render();
}

// The host's entry of every location (its own icon), once each.
async function askBookmarkEntries() {
  // Not asked yet, or asked before Windows had its icons ready (an icon of -1, at the start): asked (again).
  const wanted = allBookmarks().filter(b => !(bookmarkEntries.get(b.location.toLowerCase())?.icon >= 0));
  await Promise.all(wanted.map(async b => {
    const [e] = (await askHost({ op: 'entries', ids: [b.location] })).entries ?? [];
    bookmarkEntries.set(b.location.toLowerCase(), e ?? null);
  }));
  if (wanted.length) bookmarksPane?.render();
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
  bookmarksPane?.render();
}

// A bookmark's icon as an <img>: Plain is an empty one (the room kept), Custom its picture (one that is gone falls back
// to Default), Default the location's own (the host's entry, `entry` when given).
function bookmarkIcon(b, entry = null) {
  if (isGroup(b)) return Object.assign(document.createElement('img'), { src: GroupIcon, className: 'bm-group-icon' });
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
    // A quick access folder: a row of its own, what it holds under it (plan 27 3.3).
    if (isGroup(b)) return { id: `::foldex-bmgroup:${b.id}`, bm: b.id, bmGroup: b.id, name: b.folder, folder: true, items: await quickAccessEntries(b.items ?? []) };
    const f = b.location;
    const [e] = (await askHost({ op: 'entries', ids: [f] })).entries ?? [];
    // `bm`: the entry's id, so two shortcuts of one location are two rows (TreeView.add).
    const row = e ? { ...e, id: f, bm: b.id, name: bookmarkName(b), folder: !b.item } : { id: f, bm: b.id, name: bookmarkName(b), folder: !b.item, missing: true };
    if (b.item) row.files = row.subs = false;   // an item: no expander
    return row;
  }));
}

// F2 on a quick access shortcut (3.10): its entry's name in the rename box; empty, or the location's own name, drops it.
// A quick access folder: its name (empty keeps it).
function renameBookmarkInPlace(tree, node) {
  startRename(tree, node.id, { at: tree.flat.indexOf(node), done: name => changeBookmark(node.bm, b => {
    if (isGroup(b)) b.folder = name || b.folder;
    else if (name && name !== folderName(b.location)) b.name = name;
    else delete b.name;
  }) });
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
  // A folder (plan 27 3.2): a submenu with what it holds (greyed out when empty); its right-click Rename... and Remove.
  if (isGroup(b)) return {
    label: b.folder, icon: bookmarkIcon(b), items: (b.items ?? []).map(bookmarkMenuItem), enabled: !!b.items?.length,
    context: bookmarkGroupMenu(b.id),
  };
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
      { label: 'Remove', run: () => removeBookmark(b.id) },
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

// Remove current folder: its every bookmark of the menu, in folders too (quick access keeps its shortcuts).
function toggleCurrentBookmark() {
  const current = currentFolder();
  if (!current) return;
  if (!inBookmarks(current)) return post({ op: 'bookmarkAdd', location: current });
  const tree = copyBookmarks();
  const gone = b => !isGroup(b) && same(folderPath(b.location), folderPath(current));
  const strip = list => list.filter(b => !gone(b)).map(b => isGroup(b) ? { ...b, items: strip(b.items ?? []) } : b);
  saveBookmarks(tree.map(b => b.quickAccess ? b : gone(b) ? null : isGroup(b) ? { ...b, items: strip(b.items ?? []) } : b).filter(Boolean));
}

async function pickFolder(at = '') { return (await askHost({ op: 'pickFolder', at })).folder ?? null; }

// ---------- Manage (plan 26 3.3; plan 27 3.4): a pane of a page of its own (plan 14 3.0, 3.7) ----------

// Its screen is its page's (bookmarks.html, bmmanage.js): docked in a frame, or floating, both as any pane of a page
// can be. This page sends it the bookmarks with what it shows (their paths, whether each is there, each one's icon as
// a picture) and does for it what needs this page: saving the list it changed, Edit, a new folder's name, removing,
// closing it. Opened again it comes forward; opened after it was closed, where it was last (docked at its place, or
// floating where its window was); the first time floating beside the window.
let bookmarksPane = null;
let bookmarksPaneHome = null;   // where it was when last closed: { floating, place, bounds }

// What the Manage page is sent (BookmarksView, app.js).
function bookmarksForPage() {
  return { kind: 'bookmarks', bookmarks, paths: bookmarkPaths, exists: Object.fromEntries(bookmarkExists),
    icons: Object.fromEntries(bookmarkPlaces().filter(p => !isGroup(p.b)).map(p => [p.b.id, bookmarkPicture(p.b)])) };
}

// What the Manage page asks of this page.
async function bookmarksPageAsks(view, m) {
  const placeOf = (quick, place) => place ? (tree, entry) => putIn(tree, entry, place.group, quick, place.at) : null;
  const made = id => view.send({ kind: 'made', id: id ?? null });
  switch (m.kind) {
    case 'save': return saveBookmarks(m.bookmarks);
    case 'remove': return removeBookmark(m.id);
    case 'newFolder': return made(await newBookmarkFolder(m.quick, placeOf(m.quick, m.place)));
    case 'newBookmark': return made((await editBookmark(null, { quickAccess: m.quick }, placeOf(m.quick, m.place)))?.id);
    case 'edit':
      await editBookmark(m.id);
      return made(m.id);
    case 'rename':
      await renameBookmarkFolder(m.id);
      return made(m.id);
    case 'close': return closePane(view.id);
  }
}

// A bookmark's icon as a picture, for the Manage page: its Custom picture, its location's own (the system's, asked
// when not here yet: the page gets it once it came), or none for Plain.
function bookmarkPicture(b) {
  if (b.icon === 'plain') return '';
  if (b.icon && fileIcons.get(b.icon)) return fileIcons.get(b.icon);
  const e = bookmarkEntries.get(b.location.toLowerCase());
  if (!e || e.icon < 0) return '';
  const missing = [], src = iconImage(e, missing).getAttribute('src') ?? '';
  askIcons(missing, []);
  return src;
}

function manageBookmarks() {
  askBookmarkEntries();   // icons that were not there at the start
  if (bookmarksPane) {
    if (bookmarksPane.channel.floating) return bookmarksPane.channel.float();
    return showPane(bookmarksPane.id);
  }
  const id = layout.add({ kind: 'bookmarks' });
  const view = bookmarksPane = new BookmarksView(id);
  views.set(id, view);
  const home = bookmarksPaneHome ?? { floating: true, place: { area: 'right' } };
  if (home.floating) {
    layout.pane(id).floating = { place: home.place ?? { area: 'right' }, bounds: home.bounds ?? null };
    view.channel.float(home.bounds ?? null);
    drawHeads();
    tellLayout();
  } else {
    placeView(view, home.place?.pane != null && docks.find(home.place.pane) ? home.place : { area: home.place?.area ?? 'right' });
    showPane(id);
  }
}

// The Manage pane closed: where it was, for when it opens again.
function bookmarksPaneClosed(id) {
  const pane = layout.pane(id);
  bookmarksPaneHome = pane?.floating ? { floating: true, place: pane.floating.place, bounds: pane.floating.bounds }
    : { floating: false, place: docks.placeOf(id) ?? { area: 'right' }, bounds: pane?.floatBounds ?? null };
  bookmarksPane = null;
}

// Every change goes to the host at once: the whole list.
function saveBookmarks(list) {
  bookmarks = list;
  post({ op: 'bookmarksSet', bookmarks: list });
  bookmarksPane?.render();
}

// ---------- Edit (3.4): one bookmark, all of it ----------

// Edit for the entry with the id, or (null) a new one, its Browse... opened at once, starting with `start` (Manage's
// Quick access tab: quickAccess). Resolves to the entry kept, or null for Cancel.
// `place` (tree, entry): where a new one goes (Manage: after the selected row); without, at the end of its tab.
function editBookmark(id, start = {}, place = null) {
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
      }, { where, key, keyNew }, place);
      if (!entry) return;
      kept = entry;
      dialog.close('ok');
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(kept);
      activeView()?.body.focus();
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
async function editChecked(old, b, fields, place = null) {
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
  // Its keys taken from every other bookmark that had them, at any depth.
  const tree = copyBookmarks();
  for (const { b: x } of bookmarkPlaces(tree))
    if (x.id !== entry.id) for (const p of ['key', 'keyNew']) if (x[p] && [entry.key, entry.keyNew].includes(x[p])) delete x[p];
  const was = old ? locateIn(tree, old.id) : null;
  const wasQuick = was && bookmarkPlaces(tree).find(p => p.b.id === old.id).quick;
  if (was && !!wasQuick === !!entry.quickAccess) {
    // In its place, on its tab.
    was.list[was.index] = onTab(entry, !!wasQuick);
  } else if (was) {
    // Quick access switched: an entry at the top keeps its place, one in a folder goes to the other tab's top (plan 27 3.5).
    const top = tree.includes(was.b);
    was.list.splice(was.index, 1, ...(top ? [onTab(entry, !!entry.quickAccess)] : []));
    if (!top) putIn(tree, entry, null, !!entry.quickAccess, Infinity);
  } else if (place) place(tree, entry);
  else putIn(tree, entry, null, !!entry.quickAccess, Infinity);
  saveBookmarks(tree);
  return entry;
}

// ---------- Keys (3.6): two per bookmark, in the key set after keys.json ----------

// The bookmarks' keys for the key set (keys.js buildKeys): [key, call].
const bookmarkBindings = () => allBookmarks().flatMap(b => [
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
