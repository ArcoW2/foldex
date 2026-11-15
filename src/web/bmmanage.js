'use strict';
// Manage the bookmarks, the page of its pane (docs/plans/14-PLAN-floating-panes.md 3.0, 3.7; the screen of
// docs/plans/executed/26-PLAN-bookmarks.md 3.3 and executed/27-PLAN-bookmark-folders.md 3.4): docked in a frame of its
// window's page, or floating. Its window's page sends the bookmarks with what they show (their paths, whether each is
// there, each one's icon as a picture); a change made here is saved whole by that page (`save`). What needs that page
// (Edit, a new folder's name, removing a folder that holds something, closing the pane) is asked of it, which answers
// with the entry it made (`made`), so the row is selected here.
//
// Two tabs: the bookmarks of the menu and the quick access shortcuts, each entry on one of them. A folder is a row that
// opens and closes (Left, Right, a double click, its expander), what it holds under it. The button To quick access (on
// Bookmarks) or To bookmarks (on Quick access) opens a menu: Move to takes the selected entry to the other tab, Copy to
// puts a copy of it there (without its keys: a key opens one entry). New opens a menu: Folder..., Bookmark...; Move to
// folder... picks the folder it goes in. `at` counts the rows shown.

let bookmarks = [];
let bookmarkPaths = {};
let bookmarkExists = new Map();
let bookmarkPictures = {};   // entry id -> its icon as a picture ('' for Plain)
const same = (a, b) => a != null && b != null && a.toLowerCase() === b.toLowerCase();

const bmManage = { el: document.getElementById('manage'), tab: 'bookmarks', at: 0, widths: [240, 300], closed: new Set(), wanted: null };

// Every change goes to the window's page at once: the whole list.
function saveBookmarks(list) {
  bookmarks = list;
  toWindow({ kind: 'save', bookmarks: list });
  drawBookmarkManage();
}

paneHandlers.bookmarks = m => {
  bookmarks = m.bookmarks ?? [];
  bookmarkPaths = m.paths ?? {};
  bookmarkExists = new Map(Object.entries(m.exists ?? {}));
  bookmarkPictures = m.icons ?? {};
  drawBookmarkManage();
};
// The entry the window made or changed for a request of here: its row selected.
paneHandlers.made = m => {
  if (m.id) bmManage.wanted = m.id;
  reselect();
};

function reselect() {
  const id = bmManage.wanted;
  if (id) {
    const k = manageRows().findIndex(r => r.b.id === id);
    if (k >= 0) {
      bmManage.at = k;
      bmManage.wanted = null;
    }
  }
  drawBookmarkManage();
  bmManage.el.querySelector('.bm-list').focus();
}

// An entry's icon, as its window's page drew it.
function bookmarkIcon(b) {
  const img = document.createElement('img');
  const src = isGroup(b) ? GroupIcon : bookmarkPictures[b.id];
  if (src) img.src = src;
  else img.className = 'bm-plain';
  if (isGroup(b)) img.className = 'bm-group-icon';
  return img;
}

// The rows shown on the tab: { b, depth, parent } in list order, what a closed folder holds left out.
function manageRows() {
  const quick = bmManage.tab === 'quick', rows = [];
  const walk = (list, depth, parent) => {
    for (const b of list) {
      rows.push({ b, depth, parent });
      if (isGroup(b) && !bmManage.closed.has(b.id)) walk(b.items ?? [], depth + 1, b.id);
    }
  };
  walk(bookmarks.filter(b => !!b.quickAccess === quick), 0, null);
  return rows;
}

// A row's place for moving: the folder it is in (null: the tab's top) and its place there (at the top counted among
// the tab's top-level entries, as putIn and moveBookmarkTo count).
function rowPlace(row) {
  const quick = bmManage.tab === 'quick';
  const list = row.parent ? bookmarkById(row.parent).items : bookmarks.filter(b => !!b.quickAccess === quick);
  return { group: row.parent, at: list.indexOf(row.b) };
}

function buildBookmarkManage() {
  const el = bmManage.el;
  el.innerHTML = `<div class="bm-tabs"><button type="button" data-tab="bookmarks">Bookmarks</button><button type="button" data-tab="quick">Quick access</button></div>
    <div class="bm-body">
      <div class="bm-arrows">
        <button data-do="up" tabindex="-1" title="Up (Ctrl+Up)"><svg viewBox="0 0 10 10"><path d="M1.5 6.5L5 3l3.5 3.5"/></svg></button>
        <button data-do="down" tabindex="-1" title="Down (Ctrl+Down)"><svg viewBox="0 0 10 10"><path d="M1.5 3.5L5 7l3.5-3.5"/></svg></button>
      </div>
      <div class="bm-list" tabindex="0"><div class="bm-head"></div><div class="bm-rows"></div></div>
    </div>
    <div class="ask-buttons">
      <button data-do="new" class="bm-menu-button" title="A new folder or bookmark, after the selected row">New</button>
      <button data-do="edit" title="Enter, F2, double click">Edit...</button>
      <button data-do="to" class="bm-menu-button"></button>
      <button data-do="folder" title="Put the selected entry in a folder, or at the top">Move to folder...</button>
      <button data-do="delete" title="Del">Delete</button><button data-do="close" title="Close the pane">Close</button>
    </div>`;
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
    if (e.target.closest('.bm-twisty')) return bookmarkManageDo('fold');
    drawBookmarkManage();
    if (e.button === 0 && e.target.closest('.bm-handle')) dragManageRow(e, +r.dataset.i);
  });
  list.addEventListener('dblclick', e => {
    if (!e.target.closest('[data-i]') || e.target.closest('.bm-twisty')) return;
    bookmarkManageDo(isGroup(manageRows()[bmManage.at]?.b) ? 'fold' : 'edit');
  });
  for (const bar of el.querySelectorAll('.ask-buttons, .bm-arrows'))
    bar.addEventListener('click', e => { const b = e.target.closest('[data-do]'); if (b) bookmarkManageDo(b.dataset.do); });
  // The arrows keep the keyboard in the list.
  el.querySelector('.bm-arrows').addEventListener('mousedown', e => e.preventDefault());
  el.addEventListener('keydown', e => {
    if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const key = (e.ctrlKey ? 'Ctrl+' : '') + e.key;
    const what = { 'Ctrl+ArrowUp': 'up', 'Ctrl+ArrowDown': 'down', Delete: 'delete', ArrowUp: 'prev', ArrowDown: 'next',
      ArrowLeft: 'shut', ArrowRight: 'open', Enter: 'edit', F2: 'edit', ' ': 'move' }[key];
    if (!what) return;
    e.preventDefault();
    if (what === 'prev' || what === 'next') {
      bmManage.at = Math.max(0, Math.min(manageRows().length - 1, bmManage.at + (what === 'next' ? 1 : -1)));
      drawBookmarkManage();
    } else bookmarkManageDo(what);
  });
}

function drawBookmarkWidths() {
  bmManage.el.style.setProperty('--bm-cols', bmManage.widths.map(w => `${w}px`).join(' '));
}

function drawBookmarkManage() {
  drawBookmarkWidths();
  const el = bmManage.el, quick = bmManage.tab === 'quick', rows = manageRows();
  for (const t of el.querySelectorAll('[data-tab]')) t.classList.toggle('on', t.dataset.tab === bmManage.tab);
  const to = el.querySelector('[data-do=to]');
  to.textContent = quick ? 'To bookmarks' : 'To quick access';
  to.title = quick ? 'Move or copy the selected entry to Bookmarks (Space: move)' : 'Move or copy the selected entry to Quick access (Space: move)';
  const box = el.querySelector('.bm-rows');
  bmManage.at = Math.max(0, Math.min(bmManage.at, rows.length - 1));
  box.replaceChildren(...rows.map(({ b, depth }, k) => {
    const row = document.createElement('div');
    row.className = 'bm-row' + (k === bmManage.at ? ' selected' : '') + (!isGroup(b) && bookmarkMissing(b.location) ? ' missing' : '')
      + (isGroup(b) ? ' bm-group' : '');
    row.dataset.i = k;
    const name = Object.assign(document.createElement('span'), { className: 'bm-cell bm-name' });
    name.style.paddingLeft = `${8 + depth * 16}px`;
    const handle = Object.assign(document.createElement('span'), { className: 'bm-handle', title: 'Drag to move it: between rows, or onto a folder' });
    // A folder's expander; a bookmark keeps the room, so the names line up.
    const twisty = Object.assign(document.createElement('span'), { className: 'bm-twisty' + (isGroup(b) && b.items?.length ? bmManage.closed.has(b.id) ? ' shut' : ' open' : '') });
    name.append(handle, twisty, bookmarkIcon(b), Object.assign(document.createElement('span'), { textContent: bookmarkName(b) }));
    const place = isGroup(b) ? '' : folderPath(b.location);
    const where = Object.assign(document.createElement('span'), { className: 'bm-cell bm-where', textContent: place, title: place });
    row.append(name, where);
    return row;
  }));
  if (!rows.length) box.append(Object.assign(document.createElement('div'), { className: 'bm-none',
    textContent: quick ? 'No quick access yet: New, or To quick access on the Bookmarks tab.' : 'No bookmarks yet: New makes one.' }));
  box.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  for (const b of el.querySelectorAll('[data-do=up], [data-do=down], [data-do=edit], [data-do=to], [data-do=folder], [data-do=delete]')) b.disabled = !rows.length;
  // The arrows: not past the first or last entry of its folder.
  const sel = rows[bmManage.at];
  if (sel) {
    const siblings = sel.parent ? bookmarkById(sel.parent).items : bookmarks.filter(b => !!b.quickAccess === quick), k = siblings.indexOf(sel.b);
    el.querySelector('[data-do=up]').disabled = k <= 0;
    el.querySelector('[data-do=down]').disabled = k >= siblings.length - 1;
  }
}

// A row's handle dragged (plan 27 3.4): over a folder's middle the folder is lit and the entry goes in, at its end;
// between rows a line, and it goes there, in the folder those rows are in (an open folder's lower part: at its top
// inside). A folder into itself or one inside it: nothing shown, nothing done.
function dragManageRow(e, from) {
  e.preventDefault();
  const box = bmManage.el.querySelector('.bm-rows'), list = bmManage.el.querySelector('.bm-list');
  const rows = manageRows(), moving = rows[from].b, quick = bmManage.tab === 'quick';
  let drop = null;   // { k, where: before / after / into, group, at }
  box.classList.add('bm-dragging');
  const target = ev => {
    const els = [...box.querySelectorAll('.bm-row')];
    for (const [k, el] of els.entries()) {
      const r = el.getBoundingClientRect();
      if (ev.clientY >= r.bottom && k < els.length - 1) continue;
      const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)), row = rows[k];
      const open = isGroup(row.b) && !bmManage.closed.has(row.b.id) && !!row.b.items?.length;
      let t;
      if (isGroup(row.b) && y >= 0.25 && y <= 0.75) t = { k, where: 'into', group: row.b.id, at: Infinity };
      else if (open && y > 0.5) t = { k, where: 'after', group: row.b.id, at: 0 };   // under an open folder: at its top inside
      else {
        const p = rowPlace(row);
        t = { k, where: y < 0.5 ? 'before' : 'after', group: p.group, at: p.at + (y < 0.5 ? 0 : 1) };
      }
      if (row.b === moving || t.group && insideGroup(bookmarks, moving.id, t.group)) return null;
      return t;
    }
    return null;
  };
  const show = () => box.querySelectorAll('.bm-row').forEach((el, k) => {
    el.classList.toggle('bm-drop-before', drop?.k === k && drop.where === 'before');
    el.classList.toggle('bm-drop-after', drop?.k === k && drop.where === 'after');
    el.classList.toggle('bm-drop-into', drop?.k === k && drop.where === 'into');
  });
  const move = ev => {
    // Near the list's top or bottom edge it scrolls.
    const r = list.getBoundingClientRect();
    if (ev.clientY < r.top + 20) list.scrollTop -= 8;
    else if (ev.clientY > r.bottom - 20) list.scrollTop += 8;
    drop = target(ev);
    show();
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    box.classList.remove('bm-dragging');
    if (!drop) return drawBookmarkManage();
    moveBookmarkTo(moving.id, drop.group, quick, drop.at);
    bmManage.at = Math.max(0, manageRows().findIndex(r => r.b.id === moving.id));
    drawBookmarkManage();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

async function bookmarkManageDo(what) {
  const rows = manageRows(), row = rows[bmManage.at], quick = bmManage.tab === 'quick';
  const focusList = () => bmManage.el.querySelector('.bm-list').focus();
  // Where something new goes: after the selected row in its folder; an open folder selected: at its top inside.
  const place = () => {
    if (!row) return { group: null, at: 1e9 };
    if (isGroup(row.b) && !bmManage.closed.has(row.b.id)) return { group: row.b.id, at: 0 };
    const p = rowPlace(row);
    return { group: p.group, at: p.at + 1 };
  };
  switch (what) {
    case 'fold': case 'open':
      // A folder opened or closed (a click on its expander, a double click, Right).
      if (!row || !isGroup(row.b)) return;
      if (what === 'open' && !bmManage.closed.has(row.b.id)) return;
      if (bmManage.closed.has(row.b.id)) bmManage.closed.delete(row.b.id);
      else bmManage.closed.add(row.b.id);
      return drawBookmarkManage();
    case 'shut':
      // Left: an open folder closed, else to the folder it is in.
      if (!row) return;
      if (isGroup(row.b) && !bmManage.closed.has(row.b.id) && row.b.items?.length) bmManage.closed.add(row.b.id);
      else if (row.parent) bmManage.at = rows.findIndex(r => r.b.id === row.parent);
      return drawBookmarkManage();
    case 'close':
      return toWindow({ kind: 'close' });
    case 'up': case 'down': {
      // Past its neighbour within its own folder; never into or out of a folder.
      if (!row) return;
      const p = rowPlace(row), to = p.at + (what === 'up' ? -1 : 1);
      const siblings = row.parent ? bookmarkById(row.parent).items : bookmarks.filter(b => !!b.quickAccess === quick);
      if (to < 0 || to >= siblings.length) return;
      moveBookmarkTo(row.b.id, p.group, quick, what === 'up' ? to : to + 1);
      bmManage.wanted = row.b.id;
      return reselect();
    }
    case 'delete':
      // By the window's page: a folder that holds something asks there (plan 27 3.6).
      if (row) toWindow({ kind: 'remove', id: row.b.id });
      return;
    case 'to': {
      if (!row) return;
      const r = bmManage.el.querySelector('[data-do=to]').getBoundingClientRect();
      return openMenu(r.left, r.bottom, [
        { label: 'Move to', run: () => bookmarkManageDo('move') },
        { label: 'Copy to', run: () => bookmarkManageDo('copy') },
      ]);
    }
    case 'move':
      // To the other tab: an entry at the top in place (its place in the list kept); one inside a folder to the other
      // tab's top, at the end (plan 27 3.5).
      if (!row) return;
      if (!row.parent) changeBookmark(row.b.id, b => onTab(b, !quick));
      else moveBookmarkTo(row.b.id, null, !quick, Infinity);
      return focusList();
    case 'copy': {
      // A copy on the other tab: beside it in the list (one at the top), else at the other tab's top, at the end.
      if (!row) return;
      const tree = copyBookmarks(), c = onTab(copyOfEntry(row.b), !quick);
      if (!row.parent) {
        const at = locateIn(tree, row.b.id);
        at.list.splice(at.index + 1, 0, c);
      } else putIn(tree, c, null, !quick, Infinity);
      saveBookmarks(tree);
      return focusList();
    }
    case 'new': {
      const r = bmManage.el.querySelector('[data-do=new]').getBoundingClientRect();
      return openMenu(r.left, r.bottom, [
        { label: quick ? 'Quick access folder...' : 'Folder...', run: () => toWindow({ kind: 'newFolder', quick, place: place() }) },
        { label: quick ? 'Quick access shortcut...' : 'Bookmark...', run: () => toWindow({ kind: 'newBookmark', quick, place: place() }) },
      ]);
    }
    case 'edit':
      if (!row) return;
      bmManage.wanted = row.b.id;
      return toWindow({ kind: isGroup(row.b) ? 'rename' : 'edit', id: row.b.id });
    case 'folder': {
      if (!row) return;
      const to = await pickBookmarkFolder(row);
      if (to === undefined) return focusList();
      moveBookmarkTo(row.b.id, to, quick, Infinity);
      if (to) bmManage.closed.delete(to);
      bmManage.wanted = row.b.id;
      return reselect();
    }
  }
}

// Move to folder... (plan 27 3.4): the tab's folders as a tree, the tab itself at the top (the top level). Resolves to
// the folder's id, null for the top, undefined for Cancel. The folder it is in now is selected; the entry itself and
// the folders inside it are greyed out.
function pickBookmarkFolder(row) {
  const quick = bmManage.tab === 'quick';
  const choices = [{ id: null, name: quick ? 'Quick access' : 'Bookmarks', depth: 0, off: false }];
  const walk = (list, depth, off) => {
    for (const b of list) if (isGroup(b)) {
      const no = off || b.id === row.b.id;
      choices.push({ id: b.id, name: b.folder, depth, off: no });
      walk(b.items ?? [], depth + 1, no);
    }
  };
  walk(bookmarks.filter(b => !!b.quickAccess === quick), 1, false);
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const dialog = el('dialog', { className: 'find bm-pick' });
  const form = el('form', { method: 'dialog' });
  const list = el('div', { className: 'bm-pick-list', tabIndex: 0 });
  let at = Math.max(0, choices.findIndex(c => c.id === row.parent));
  const draw = () => list.replaceChildren(...choices.map((c, k) => {
    const r = el('div', { className: 'bm-pick-row' + (k === at ? ' selected' : '') + (c.off ? ' off' : '') },
      el('img', { src: c.id ? GroupIcon : '', className: c.id ? 'bm-group-icon' : 'bm-plain' }), el('span', { textContent: c.name }));
    r.style.paddingLeft = `${8 + c.depth * 16}px`;
    r.dataset.k = k;
    return r;
  }));
  const ok = el('button', { value: 'ok', textContent: 'OK' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });
  form.append(list, el('div', { className: 'ask-buttons' }, el('span', { className: 'find-gap' }), ok, cancel));
  dialog.append(el('div', { className: 'find-title', textContent: `Move "${bookmarkName(row.b)}" to` }), form);
  document.body.append(dialog);
  const pick = k => { if (choices[k] && !choices[k].off) { at = k; draw(); } };
  list.addEventListener('mousedown', e => { const r = e.target.closest('[data-k]'); if (r) pick(+r.dataset.k); });
  list.addEventListener('dblclick', e => { if (e.target.closest('[data-k]') && !choices[at].off) ok.click(); });
  list.addEventListener('keydown', e => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    for (let k = at + step; k >= 0 && k < choices.length; k += step) if (!choices[k].off) return pick(k);
  });
  draw();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'ok' && !choices[at].off ? choices[at].id : undefined);
    }, { once: true });
    dialog.showModal();
    list.focus();
  });
}

buildBookmarkManage();
drawBookmarkManage();
