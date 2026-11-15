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
const post = msg => toWindow({ kind: 'post', msg });
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

// What to show, from the window's page: which dialog, and what it needs.
paneHandlers.args = async m => {
  if (m.what === 'askText') return done(await askTextHere(m.title, m.value, m.placeholder));
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
