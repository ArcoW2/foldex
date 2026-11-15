'use strict';
// A modal floating window's page (docs/plans/14-PLAN-floating-panes.md 3.7): a dialog of the window's page in a window
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

// The window as large as what is open: the dialog, and one opened over it.
function fitWindow() {
  let w = 0, h = 0;
  for (const d of document.querySelectorAll('dialog[open]')) {
    const inline = d.classList.contains('inline');
    w = Math.max(w, inline ? d.offsetWidth : d.offsetWidth + 32);
    h = Math.max(h, inline ? d.offsetHeight : d.offsetHeight + 32);
  }
  if (w && h) toWindow({ kind: 'size', w, h });
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

// More columns (columns.js moreColumns): every property, `shown` the pane's columns; a click adds or takes one away in
// the pane at once. Close closes it.
function moreColumnsHere(list, shown) {
  shown = new Set(shown);
  const dialog = document.createElement('dialog');
  dialog.className = 'ask more-columns';
  dialog.innerHTML = '<p>More columns: every property Windows has. A click adds or removes one.</p>' +
    '<input class="filter" spellcheck="false" placeholder="Type to find a property"><div class="props"></div>' +
    '<div class="buttons"><button class="ok">Close</button></div>';
  const fill = () => {
    const words = dialog.querySelector('.filter').value.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = list.filter(p => words.every(w => `${p.title} ${p.name}`.toLowerCase().includes(w))).slice(0, 300);
    dialog.querySelector('.props').replaceChildren(...rows.map(p => {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = shown.has(p.name);
      box.addEventListener('change', () => {
        if (box.checked) shown.add(p.name); else shown.delete(p.name);
        askWindow({ name: p.name, on: box.checked });
      });
      label.append(box, ` ${p.title}`);
      label.title = p.name;
      return label;
    }));
  };
  dialog.querySelector('.filter').addEventListener('input', fill);
  dialog.querySelector('.ok').addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  fill();
  dialog.showModal();
  dialog.querySelector('.filter').focus();
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

// What to show, from the window's page: which dialog, and what it needs.
paneHandlers.args = async m => {
  if (m.what === 'about') return done(await aboutHere(m.info ?? {}));
  if (m.what === 'askText') return done(await askTextHere(m.title, m.value, m.placeholder));
  if (m.what === 'find') return done(await findHere(m));
  if (m.what === 'barSize') return done(await sizeHere(m));
  if (m.what === 'rename') return done(await renameHere(m));
  if (m.what === 'moreColumns') return done(await moreColumnsHere(m.list ?? [], m.shown ?? []));
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
