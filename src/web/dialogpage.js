'use strict';
// A modal floating window's page (docs/plans/executed/14-PLAN-floating-panes.md 3.7): a dialog of the window's page in a window
// of its own (PaneForm, modal), so it can be moved anywhere and what it covers seen. The dialog's own code runs here
// (bookmarks.js editBookmarkHere, ...), with what it needs from the window's page as it was when it opened (`args`).
// What that code asks of the host or tells the page goes through the window's page (askHost, post, status: the same
// names as there), which answers. The window takes the dialog's size; its answer (`done`) closes it.
// Loaded after pane.js, before the dialogs' own files.

const views = new Map();   // no panes here (code shared with the window's page looks at them)
const same = (a, b) => a != null && b != null && a.toLowerCase() === b.toLowerCase();
const activeView = () => null;
const paneOfKind = () => null;
const ribbonRefresh = () => {};

// The host, through the window's page: a request and its answer.
let dialogReq = 0;
const dialogAnswers = new Map();
function askHost(msg) {
  const req = ++dialogReq;
  toWindow({ kind: 'host', req, msg });
  return new Promise(resolve => dialogAnswers.set(req, resolve));
}
paneHandlers.answer = m => { dialogAnswers.get(m.req)?.(m.value ?? {}); dialogAnswers.delete(m.req); };
// The window's page itself (its dialogWindow's `calls`): a change made there, what only it knows.
function askWindow(msg) {
  const req = ++dialogReq;
  toWindow({ kind: 'call', req, msg });
  return new Promise(resolve => dialogAnswers.set(req, resolve));
}
const post = msg => toWindow({ kind: 'post', msg });
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });   // as app.js
const status = (text, warn = false) => toWindow({ kind: 'status', text, warn });
const askYes = async (title, lines = []) => !!(await askHost({ op: 'confirm', text: title, lines })).yes;

// The icons the dialog shows: the ones the window's page sent (by their index here), none for the others.
const dialogPictures = {};
function iconImage(entry) {
  const img = document.createElement('img');
  if (dialogPictures[entry?.icon]) img.src = dialogPictures[entry.icon];
  return img;
}
const askIcons = () => {};

// The dialog shown: the first one fills the window (shown in place, not modal over a page: the window itself is the
// modal one); one it opens itself is modal inside it, as over the page. Esc cancels the first one (a dialog shown in
// place does not close on Esc by itself).
const showModalOver = HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.showModal = function () {
  if (document.querySelector('dialog.inline[open]')) return showModalOver.call(this);
  this.classList.add('inline');
  this.show();
  fitWindow();
};
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const open = [...document.querySelectorAll('dialog[open]')];
  if (open.length === 1 && open[0].classList.contains('inline')) {
    e.preventDefault();
    open[0].close('cancel');
  }
});

// The window as large as what is open: the dialog, and one opened over it. A dialog marked `resizable` (Select
// columns): its own size once, then the window is yours to resize and the dialog fills it (dialog.css .fills).
function fitWindow() {
  const resizable = document.querySelector('dialog.inline.resizable[open]');
  if (resizable?.classList.contains('fills')) return;
  let w = 0, h = 0;
  for (const d of document.querySelectorAll('dialog[open]')) {
    const inline = d.classList.contains('inline');
    w = Math.max(w, inline ? d.offsetWidth : d.offsetWidth + 32);
    h = Math.max(h, inline ? d.offsetHeight : d.offsetHeight + 32);
  }
  if (!w || !h) return;
  toWindow({ kind: 'size', w, h, resizable: !!resizable });
  resizable?.classList.add('fills');
}
new ResizeObserver(fitWindow).observe(document.documentElement);
new MutationObserver(() => requestAnimationFrame(fitWindow)).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });

const done = value => toWindow({ kind: 'done', value: value ?? null });

// A name asked (projectmenu.js askText in the window's page): its title, a text box, OK and Cancel. The text, or null.
function askTextHere(title, value = '', placeholder = '') {
  const dialog = document.createElement('dialog');
  dialog.className = 'ask';
  const form = document.createElement('form');
  form.method = 'dialog';
  const box = Object.assign(document.createElement('input'), { value, placeholder, spellcheck: false });
  const buttons = document.createElement('div');
  buttons.className = 'ask-buttons';
  buttons.append(Object.assign(document.createElement('button'), { value: 'ok', textContent: 'OK' }),
    Object.assign(document.createElement('button'), { value: 'cancel', textContent: 'Cancel', formNoValidate: true }));
  form.append(Object.assign(document.createElement('label'), { textContent: title }), box, buttons);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  box.select();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok' ? box.value.trim() : null), { once: true }));
}
const askText = askTextHere;   // a name asked over a dialog here (Find's Save, ...)

// About (as LexPen's): what Foldex is, by whom, a coffee for him, this build and what it runs on. OK closes it.
function aboutHere(info) {
  const text = (tag, className, value) => Object.assign(document.createElement(tag), { className, textContent: value });
  const dialog = document.createElement('dialog');
  dialog.className = 'about';
  const coffee = text('p', 'about-coffee', '');
  coffee.append(Object.assign(document.createElement('a'), { href: 'https://ko-fi.com/arcowitter', target: '_blank', textContent: 'Buy me a coffee' }));
  const built = info.built ? new Date(info.built).toLocaleString() : 'unknown';
  const table = document.createElement('table');
  const section = (title, rows) => {
    const head = table.insertRow();
    head.append(Object.assign(document.createElement('th'), { colSpan: 2, textContent: title }));
    for (const [name, value] of rows) {
      const row = table.insertRow();
      row.insertCell().textContent = name;
      row.insertCell().textContent = value ?? '';
    }
  };
  section('Needed to run (installed)', [['Windows 10 or 11, x64', info.os], ['.NET 10 Desktop Runtime', info.dotnet],
    ['Microsoft Edge WebView2 Runtime', info.webView2]]);
  section('Included', [['WebView2 SDK', info.webView2Sdk]]);
  const form = Object.assign(document.createElement('form'), { method: 'dialog' });
  const buttons = Object.assign(document.createElement('div'), { className: 'ask-buttons' });
  buttons.append(Object.assign(document.createElement('button'), { value: 'ok', textContent: 'OK' }));
  form.append(buttons);
  dialog.append(text('h1', '', 'Foldex'),
    text('p', 'about-line', 'A file explorer for Windows, with panes that connect into branches.'),
    text('p', 'about-created', 'Created by Arco Witter'), coffee,
    text('p', 'about-version', `Version ${info.version}${info.commit ? ` (${info.commit})` : ''}, built ${built}`), table, form);
  document.body.append(dialog);
  dialog.showModal();
  form.querySelector('button').focus();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(null), { once: true }));
}

// Select columns (columns.js selectColumns; plan 28 3.7): the columns not shown at the left, the "Selected" ones at the
// right, -> and <- between them. Above the left list the set's filter: on, only the set's columns not shown; off (or
// without a set), every column there is, with a search box. Each move changes the pane at once; Close closes it.
function selectColumnsHere(a) {
  const titles = new Map([...a.all, ...a.shown].map(c => [c.id, c.title]));
  let shown = a.shown.map(c => c.id);
  const dialog = document.createElement('dialog');
  dialog.className = 'ask select-columns resizable';
  dialog.innerHTML = '<div class="sc-lists"><div class="sc-side"><label class="sc-filter"><input type="checkbox"> <span></span></label>' +
    '<input class="sc-search" spellcheck="false" placeholder="Type to find a column"><select class="sc-left" multiple></select></div>' +
    '<div class="sc-arrows"><button class="sc-show" title="Show the columns selected at the left">-&gt;</button>' +
    '<button class="sc-hide" title="Hide the columns selected at the right">&lt;-</button></div>' +
    '<div class="sc-side"><div class="sc-label">Selected</div><select class="sc-right" multiple></select></div></div>' +
    '<div class="ask-buttons"><button class="ok">Close</button></div>';
  const filter = dialog.querySelector('.sc-filter input'), search = dialog.querySelector('.sc-search');
  const left = dialog.querySelector('.sc-left'), right = dialog.querySelector('.sc-right');
  dialog.querySelector('.sc-filter span').textContent = `Columns of set ${a.setName ?? ''}`;
  dialog.querySelector('.sc-filter').hidden = !a.setIds;
  filter.checked = !!a.setIds;
  const option = id => Object.assign(new Option(titles.get(id) ?? id, id), { title: id });
  const fill = () => {
    const onlySet = filter.checked && a.setIds;
    search.hidden = !!onlySet;
    const words = onlySet ? [] : search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const ids = (onlySet ? a.setIds : [...titles.keys()]).filter(id => !shown.includes(id))
      .filter(id => words.every(w => `${titles.get(id)} ${id}`.toLowerCase().includes(w))).slice(0, 400);
    left.replaceChildren(...ids.map(option));
    right.replaceChildren(...shown.map(option));
    for (const o of right.options) o.disabled = o.value === 'name';   // the name column is always shown
  };
  const moved = async change => {
    shown = await askWindow(change) ?? shown;
    fill();
  };
  dialog.querySelector('.sc-show').addEventListener('click', () => moved({ show: [...left.selectedOptions].map(o => o.value) }));
  dialog.querySelector('.sc-hide').addEventListener('click', () => moved({ hide: [...right.selectedOptions].map(o => o.value) }));
  left.addEventListener('dblclick', () => moved({ show: [...left.selectedOptions].map(o => o.value) }));
  right.addEventListener('dblclick', () => moved({ hide: [...right.selectedOptions].map(o => o.value) }));
  filter.addEventListener('change', fill);
  search.addEventListener('input', fill);
  dialog.querySelector('.ok').addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  fill();
  dialog.showModal();
  left.focus();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(null), { once: true }));
}

// The Sort window (columns.js openSortWindow; plan 28 3.5): a line per column of the pane's sort, in its order: a grip
// to drag it, its direction (a click turns it), Remove. The last line removed: "Name, ascending" in its place. As the
// set (when the pane uses one) and Remove all change the sort and close it; each other change sorts the pane at once.
function sortHere(a) {
  let sort = a.sort.length ? a.sort.map(s => ({ ...s })) : [{ id: 'name', desc: false }];
  const dialog = document.createElement('dialog');
  dialog.className = 'ask sort-window';
  dialog.innerHTML = '<p>Sorted by, in this order:</p><div class="sort-lines"></div>' +
    '<div class="ask-buttons"><button class="sort-set">As the set</button><button class="sort-none">Remove all</button>' +
    '<button class="ok">Close</button></div>';
  const lines = dialog.querySelector('.sort-lines');
  const apply = () => { askWindow({ sort }); draw(); };
  const draw = () => lines.replaceChildren(...sort.map((s, k) => {
    const line = document.createElement('div');
    line.className = 'sort-line';
    const grip = Object.assign(document.createElement('span'), { className: 'bm-handle', title: 'Drag to another place' });
    grip.addEventListener('mousedown', e => dragLine(e, k));
    const turn = Object.assign(document.createElement('button'), { className: 'sort-dir', textContent: s.desc ? 'v' : '^',
      title: s.desc ? 'Descending; a click: ascending' : 'Ascending; a click: descending' });
    turn.addEventListener('click', () => { s.desc = !s.desc; apply(); });
    const remove = Object.assign(document.createElement('button'), { textContent: 'Remove' });
    remove.addEventListener('click', () => {
      sort.splice(k, 1);
      if (!sort.length) sort = [{ id: 'name', desc: false }];
      apply();
    });
    line.append(grip, Object.assign(document.createElement('span'), { className: 'sort-title', textContent: `${k + 1}. ${a.titles[s.id] ?? s.id}` }), turn, remove);
    return line;
  }));
  // A line dragged by its grip: it goes before the line whose middle is below the mouse when let go.
  const dragLine = (e, k) => {
    e.preventDefault();
    const rows = [...lines.children];
    rows[k].classList.add('dragging');
    const up = m => {
      removeEventListener('mouseup', up);
      rows[k].classList.remove('dragging');
      let to = rows.findIndex(r => { const b = r.getBoundingClientRect(); return m.clientY < b.top + b.height / 2; });
      if (to < 0) to = rows.length;
      if (to === k || to === k + 1) return;
      const [s] = sort.splice(k, 1);
      sort.splice(to > k ? to - 1 : to, 0, s);
      apply();
    };
    addEventListener('mouseup', up);
  };
  const setButton = dialog.querySelector('.sort-set');
  setButton.hidden = !a.setSort;
  setButton.addEventListener('click', () => { askWindow({ sort: a.setSort }); dialog.close(); });
  dialog.querySelector('.sort-none').addEventListener('click', () => { askWindow({ sort: [] }); dialog.close(); });
  dialog.querySelector('.ok').addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  draw();
  dialog.showModal();
  dialog.querySelector('.ok').focus();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(null), { once: true }));
}

// The Size of a bar (bars.js openSizeWindow; not modal): its limits, each in its colour as its mark on the bar; a
// change sizes the bar at once. { keep } for OK, null for Cancel.
function sizeHere(a) {
  const dialog = document.createElement('dialog');
  dialog.className = 'ask size-window';
  dialog.innerHTML = `<p>The size of the ${a.barKind} bar. Empty: not set.</p><div class="fields"></div>` +
    '<div class="buttons"><button class="ok">OK</button><button class="cancel">Cancel</button></div>';
  for (const [name, title, colour] of a.fields) {
    const label = document.createElement('label');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = colour;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = name === 'maxShare' ? 1 : 0;
    if (name === 'maxShare') input.max = 100;
    input.value = a.values[name] ?? '';
    input.addEventListener('input', () => askWindow({ name, value: input.value }));
    // Maximum %: the bar's share of the window now beside it, as the window's page tells it.
    const caption = document.createElement('span');
    caption.textContent = title;
    if (name === 'maxShare') caption.append(' ', Object.assign(document.createElement('span'), { className: 'size-share' }));
    label.append(swatch, caption, input, name === 'maxShare' ? '%' : a.unit);
    dialog.querySelector('.fields').append(label);
  }
  let keep = false;
  dialog.querySelector('.ok').addEventListener('click', () => { keep = true; dialog.close(); });
  dialog.querySelector('.cancel').addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('input').select();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(keep ? { keep } : null), { once: true }));
}

paneHandlers.share = m => {
  const at = document.querySelector('.size-share');
  if (at) at.textContent = `(now ${m.share}%)`;
};

// Customize the ribbon (ribbon.js rbCustomize; docs/plans/executed/19-PLAN-ribbon-change-mode.md 3.9; as LexPen's): at
// the left every action by group with a search, at the right the ribbon as lines. Each change is the window's page's
// (askWindow: its rbcDo), which answers with the lines now and the one to choose; the line chosen is outlined on the
// ribbon. Enter or a double click in the left list adds the action after the line chosen at the right; Del removes the
// line; Alt+Up / Alt+Down move it; Ctrl+Z takes the last change back; Esc closes.
function customizeHere(a) {
  let lines = a.lines;
  const dialog = document.createElement('dialog');
  dialog.className = 'ask rb-customize';
  dialog.innerHTML = `<div class="rbc-lists">
      <div class="rbc-side"><input class="rbc-search" type="text" spellcheck="false" placeholder="Search an action">
        <select class="rbc-actions" size="20"></select></div>
      <div class="rbc-mid"><button data-rbc="add" title="After the line chosen at the right (Enter in the left list)">Add &gt;</button></div>
      <div class="rbc-side"><select class="rbc-ribbon" size="21"></select></div>
      <div class="rbc-buttons">
        <button data-rbc="up" title="Alt+Up">Up</button><button data-rbc="down" title="Alt+Down">Down</button>
        <button data-rbc="remove" title="Del">Remove</button><hr>
        <button data-rbc="size">Large / small</button><button data-rbc="stack">Stacked</button>
        <button data-rbc="dropDown" title="A button or corner whose action has a list and a window: that list under it, or its window">Drop-down</button>
        <button data-rbc="divider">Divider</button><button data-rbc="rename" title="A tab, a group, or a button (its label)">Rename...</button><hr>
        <button data-rbc="newTab">New tab...</button><button data-rbc="newGroup">New group...</button><hr>
        <button data-rbc="reset">Reset</button><button data-rbc="close">Close</button></div>
    </div>`;
  const $q = s => dialog.querySelector(s), search = $q('.rbc-search'), actionList = $q('.rbc-actions'), list = $q('.rbc-ribbon');
  const fillActions = () => {
    const q = search.value.trim().toLowerCase();
    actionList.replaceChildren(...a.actions.map(([label, rows]) => {
      const shown = rows.filter(r => !q || `${r.title} ${r.call[0]}`.toLowerCase().includes(q));
      if (!shown.length) return null;
      const group = Object.assign(document.createElement('optgroup'), { label });
      group.append(...shown.map(r => Object.assign(document.createElement('option'), { value: JSON.stringify(r.call), textContent: r.title })));
      return group;
    }).filter(Boolean));
    actionList.selectedIndex = 0;
  };
  const fillLines = select => {
    list.replaceChildren(...lines.map((l, n) => Object.assign(document.createElement('option'), { value: n, className: `rbc-${l.kind}`, textContent: l.text })));
    list.selectedIndex = Math.max(0, Math.min(select, lines.length - 1));
  };
  const took = r => { if (r?.lines) { lines = r.lines; fillLines(r.select); } };
  const run = async what => {
    if (what === 'close') return dialog.close();
    const line = lines[list.selectedIndex];
    let name;
    if (what === 'newTab') name = await askTextHere('New tab', '', 'Its name');
    else if (what === 'newGroup') name = await askTextHere('New group', '', 'Its name');
    else if (what === 'rename') {
      if (!['tab', 'group', 'item'].includes(line?.kind)) return;
      name = await askTextHere(line.kind === 'item' ? 'Label (empty: the action\'s title; \\n: a line break)' : line.kind === 'tab' ? 'Tab name' : 'Group name',
        line.name ?? '', line.title ?? 'Its name');
    }
    if (name === null) return;
    const call = what === 'add' && actionList.value ? JSON.parse(actionList.value) : undefined;
    took(await askWindow({ op: what, line: list.selectedIndex, call, name }));
    if (what === 'add') actionList.focus();
  };
  search.addEventListener('input', fillActions);
  search.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); actionList.focus(); } });
  actionList.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run('add'); } });
  actionList.addEventListener('dblclick', () => run('add'));
  list.addEventListener('keydown', e => {
    if (e.key === 'Delete') { e.preventDefault(); run('remove'); }
    else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); run(e.key === 'ArrowUp' ? 'up' : 'down'); }
  });
  list.addEventListener('change', () => askWindow({ op: 'show', line: list.selectedIndex }));
  dialog.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ' && !e.target.matches('input')) { e.preventDefault(); run('undo'); }
  });
  dialog.addEventListener('click', e => { const b = e.target.closest('[data-rbc]'); if (b) run(b.dataset.rbc); });
  // The ribbon changed meanwhile (Ctrl+Z, Reset, another window): its lines again, the same one chosen.
  paneHandlers.rbcLines = m => { lines = m.lines; fillLines(list.selectedIndex); };
  document.body.append(dialog);
  fillActions();
  fillLines(0);
  dialog.showModal();
  askWindow({ op: 'show', line: 0 });
  search.focus();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(null), { once: true }));
}

// What to show, from the window's page: which dialog, and what it needs.
paneHandlers.args = async m => {
  if (m.what === 'customize') return done(await customizeHere(m));
  if (m.what === 'about') return done(await aboutHere(m.info ?? {}));
  if (m.what === 'askText') return done(await askTextHere(m.title, m.value, m.placeholder));
  if (m.what === 'find') return done(await findHere(m));
  if (m.what === 'barSize') return done(await sizeHere(m));
  if (m.what === 'rename') return done(await renameHere(m));
  if (m.what === 'selectColumns') return done(await selectColumnsHere(m));
  if (m.what === 'sort') return done(await sortHere(m));
  if (m.what === 'pickFolder') {
    // Move to folder... (bmpick.js): { folder } (null: the tab's top), or nothing for Cancel.
    bookmarks = m.bookmarks ?? [];
    const row = bookmarkPlaces().find(p => p.b.id === m.id);
    const to = row ? await pickBookmarkFolder({ b: row.b, parent: m.parent }, !!m.quick) : undefined;
    return done(to === undefined ? null : { folder: to });
  }
  if (m.what === 'editBookmark') {
    bookmarks = m.bookmarks ?? [];
    bookmarkPaths = m.paths ?? {};
    keys.file = m.keysFile ?? { keys: {}, order: [] };
    buildKeys();
    Object.entries(m.pictures ?? {}).forEach(([location, url], k) => {
      if (!url) return;
      bookmarkEntries.set(location, { icon: k });
      dialogPictures[k] = url;
    });
    const p = m.place;
    const place = p ? (tree, entry) => putIn(tree, entry, p.group, !!p.quick, p.at) : null;
    const kept = await editBookmarkHere(m.id, m.start ?? {}, place);
    return done(kept?.id ?? null);
  }
  done(null);
};
