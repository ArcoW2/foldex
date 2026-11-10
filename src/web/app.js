// The page of a Foldex window. It asks the host ({ op, ... }) and is told ({ event, ... }); see MainForm.cs.
// For now the plan 02 spike (docs/plans/02-PLAN-ui-technology.md 3.7): one list with virtual scrolling, the shell's
// icons and menu, dragging both ways, a preview area for Windows' preview handlers, the file operations.
'use strict';

const host = window.chrome.webview;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const ThisPC = '::{20D04FE0-3AEA-1069-A2D8-08002B30309D}';
const $ = id => document.getElementById(id);
let settings = {};

// What the spike measured, for the test copy to read over the debugging port.
window.__spike = { lists: [], events: [] };

function post(msg) {
  host.postMessage(msg);
}

// Light or dark: as Windows is (followWindows), else the theme setting.
function applyTheme() {
  const dark = settings.followWindows ? darkQuery.matches : settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function status(text, warn = false) {
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
}

// ---------- The list ----------

const list = $('list');
const rows = $('rows');
const rowHeight = 22;
let here = '';
let entries = [];
let selected = new Set();
let anchor = -1;
let req = 0;
const sent = new Map();   // req -> time asked
const icons = new Map();  // icon index -> data URL
const iconsAsked = new Set();

function go(where) {
  here = where;
  $('location').value = where;
  $('elevated').hidden = true;
  sent.set(++req, performance.now());
  post({ op: 'list', location: where, req });
}

// Folders first, then by name as Explorer sorts (numbers by value). A Collator: much faster than localeCompare on a large
// folder.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortEntries(a, b) {
  return (b.folder - a.folder) || collator.compare(a.name, b.name);
}

function formatSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

// Only the rows in view are in the document.
function render() {
  rows.style.height = `${entries.length * rowHeight}px`;
  const first = Math.max(0, Math.floor(list.scrollTop / rowHeight) - 5);
  const last = Math.min(entries.length, Math.ceil((list.scrollTop + list.clientHeight) / rowHeight) + 5);
  const nodes = [];
  const missing = [];
  const own = [];
  for (let i = first; i < last; i++) {
    const e = entries[i];
    if (e.own) { own.push(e.id); e.own = false; }   // its own icon asked once, when in view
    const row = document.createElement('div');
    row.className = 'row' + (selected.has(i) ? ' selected' : '') + (e.hidden ? ' hidden' : '');
    row.style.top = `${i * rowHeight}px`;
    row.dataset.index = i;
    row.draggable = true;
    const img = document.createElement('img');
    if (icons.has(e.icon)) img.src = icons.get(e.icon);
    else if (e.icon >= 0 && !iconsAsked.has(e.icon)) missing.push(e.icon);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = e.name;
    const size = document.createElement('span');
    size.className = 'size';
    size.textContent = formatSize(e.size);
    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = e.modified ? dateFormat.format(e.modified) : '';
    row.append(img, name, size, date);
    nodes.push(row);
  }
  rows.replaceChildren(...nodes);
  if (missing.length) {
    const unique = [...new Set(missing)];
    unique.forEach(i => iconsAsked.add(i));
    post({ op: 'icons', indexes: unique });
  }
  if (own.length) post({ op: 'ownIcons', ids: own });
}

list.addEventListener('scroll', render);
new ResizeObserver(() => { render(); placePreview(); }).observe(list);

function indexOf(target) {
  const row = target.closest('.row');
  return row ? Number(row.dataset.index) : -1;
}

function select(i, e) {
  if (e.shiftKey && anchor >= 0) {
    const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)];
    if (!e.ctrlKey) selected.clear();
    for (let k = a; k <= b; k++) selected.add(k);
  } else if (e.ctrlKey) {
    selected.has(i) ? selected.delete(i) : selected.add(i);
    anchor = i;
  } else {
    selected = new Set([i]);
    anchor = i;
  }
  render();
  focused(i);
}

function selectedIds() {
  return [...selected].sort((a, b) => a - b).map(i => entries[i].id);
}

list.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const i = indexOf(e.target);
  if (i < 0) return;
  if (!selected.has(i) || e.ctrlKey || e.shiftKey) select(i, e);
});

list.addEventListener('dblclick', e => {
  const i = indexOf(e.target);
  if (i >= 0 && entries[i].folder) go(entries[i].id);
});

// Explorer's own menu (Shift: its extended verbs).
list.addEventListener('contextmenu', e => {
  e.preventDefault();
  const i = indexOf(e.target);
  if (i < 0) return;
  if (!selected.has(i)) select(i, e);
  post({ op: 'menu', ids: selectedIds(), x: e.clientX * devicePixelRatio, y: e.clientY * devicePixelRatio, extended: e.shiftKey });
});

list.addEventListener('keydown', e => {
  if (e.key === 'Delete' && selected.size) {
    const ids = selectedIds();
    if (confirm(`Move ${ids.length === 1 ? entries[[...selected][0]].name : `these ${ids.length} items`} to the Recycle Bin?`))
      post({ op: 'fileOp', kind: 'delete', ids, confirmed: true });
  } else if (e.key === 'Backspace') {
    up();
  } else if (e.key === 'F5') {
    go(here);
  }
});

// Dragging out: the host starts the shell's own drag (plan 02 3.6).
list.addEventListener('dragstart', e => {
  e.preventDefault();
  const i = indexOf(e.target);
  if (i >= 0 && !selected.has(i)) select(i, e);
  window.__spike.events.push({ dragStart: selectedIds().length });
  post({ op: 'dragOut', ids: selectedIds() });
});

// Dropping in: the files go to the host with their paths; what else came along is reported (Outlook mails).
list.addEventListener('dragover', e => e.preventDefault());
list.addEventListener('drop', e => {
  e.preventDefault();
  const i = indexOf(e.target);
  const target = i >= 0 && entries[i].folder ? entries[i].id : here;
  host.postMessageWithAdditionalObjects({ op: 'drop', target, types: [...e.dataTransfer.types] }, e.dataTransfer.files);
});

function up() {
  if (/^[A-Za-z]:\\?$/.test(here) || !/^[A-Za-z]:\\|^\\\\/.test(here)) return go(ThisPC);
  const parent = here.replace(/\\[^\\]+\\?$/, '');
  go(/^[A-Za-z]:$/.test(parent) ? parent + '\\' : parent);
}

$('up').addEventListener('click', up);
$('location').addEventListener('keydown', e => { if (e.key === 'Enter') go($('location').value.trim()); });
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('elevated').addEventListener('click', () => {
  sent.set(++req, performance.now());
  status('Asking for administrator rights...');
  post({ op: 'listElevated', location: here, req });
});

// ---------- Preview ----------

const previewArea = $('preview');
let previewPath = null;

function areaRect() {
  const r = previewArea.getBoundingClientRect();
  const d = devicePixelRatio;
  return { x: r.left * d, y: r.top * d, width: r.width * d, height: r.height * d };
}

function focused(i) {
  const e = entries[i];
  if (!e || e.folder || selected.size !== 1) return;
  previewPath = e.id;
  clearTimeout(focused.timer);
  focused.timer = setTimeout(() => post({ op: 'preview', path: e.id, rect: areaRect() }), 150);
}

function placePreview() {
  if (previewPath) post({ op: 'previewMove', rect: areaRect() });
}

// A popup over the preview area: a snapshot of the native window stands in for it while the popup is open.
$('popup').addEventListener('click', () => {
  if (!$('menu').hidden) return closePopup();
  if (previewPath) post({ op: 'previewSnapshot' });
  else $('menu').hidden = false;
});

function closePopup() {
  $('menu').hidden = true;
  previewArea.style.backgroundImage = '';
  if (previewPath) post({ op: 'previewRestore' });
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('menu').hidden) closePopup(); });

// ---------- File operations ----------

const ops = new Map();

function showOps() {
  $('ops').replaceChildren(...[...ops.values()].reverse().map(o => {
    const li = document.createElement('li');
    const pct = o.total ? Math.round(o.done * 100 / o.total) : 0;
    li.textContent = `#${o.id} ${o.kind} ${o.items} item(s): ` +
      (o.error ? `failed: ${o.error}` : o.finished ? (o.aborted ? 'stopped' : 'done') : `${pct}%`);
    return li;
  }));
}

// ---------- Events ----------

// The entries of a listing's part: the first part of a request replaces what was shown.
let taken = 0;

function take(m) {
  if (taken !== m.req) {
    taken = m.req;
    entries = [];
    selected = new Set();
    anchor = -1;
    list.scrollTop = 0;
  }
  entries = entries.concat(m.entries).sort(sortEntries);
  render();
}

const events = {
  hello(m) {
    settings = m.settings.values;
    applyTheme();
    $('version').textContent = m.version + (m.commit ? ` (${m.commit})` : '');
    for (const o of m.ops) ops.set(o.id, o);
    showOps();
    if (m.settings.problems.length) status(m.settings.problems.join(' '), true);
    go(m.paths[0] ?? ThisPC);
  },
  open(m) {
    go(m.paths[0]);
  },
  // A part of a slow location, while it is read.
  listing(m) {
    if (m.req !== req) return;
    take(m);
    status(`${entries.length} items so far...`);
  },
  listed(m) {
    if (m.req !== req) return;   // an answer for a location left already
    const received = performance.now();
    take(m);
    $('elevated').hidden = !m.denied || m.elevated;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const shown = performance.now();
      const t = {
        location: m.location, kind: m.kind, count: entries.length, enumMs: m.enumMs, iconMs: m.iconMs, hostMs: m.hostMs,
        roundTripMs: Math.round(received - sent.get(m.req)), renderMs: Math.round(shown - received),
        totalMs: Math.round(shown - sent.get(m.req)),
      };
      window.__spike.lists.push(t);
      if (m.error) status(`${m.name}: ${m.error}`, true);
      else status(`${m.name}${m.elevated ? ' (as administrator)' : ''}: ${t.count} items, listed in ${t.enumMs} ms, shown in ${t.totalMs} ms`);
    }));
  },
  icons(m) {
    for (const [i, url] of Object.entries(m.icons)) if (url) icons.set(Number(i), url);
    render();
  },
  ownIcons(m) {
    const byId = new Map(entries.map(e => [e.id, e]));
    for (const [id, icon] of Object.entries(m.icons)) if (byId.has(id) && icon >= 0) byId.get(id).icon = icon;
    render();
  },
  menuDone(m) {
    window.__spike.events.push({ menuDone: m.verb ?? null, error: m.error ?? null });
    if (m.error) status(m.error, true);
    else if (m.verb === 'rename') status('Rename: comes with plan 03.');
    else if (m.verb) setTimeout(() => go(here), 300);
  },
  menuTexts(m) { window.__spike.events.push({ menuTexts: m.texts, error: m.error }); },
  verbDone(m) { window.__spike.events.push({ verbDone: m.ok, error: m.error }); setTimeout(() => go(here), 300); },
  dragDone(m) {
    window.__spike.events.push({ dragDone: m.effect, error: m.error, source: m.source });
    if (m.error) status(m.error, true);
    else if (m.effect === 2) go(here);
  },
  dropped(m) {
    window.__spike.events.push({ dropped: m.count, types: m.types });
    if (!m.count) status(`Nothing to copy came with the drop (${m.types.join(', ')})`, true);
  },
  fileOp(m) {
    ops.set(m.op.id, m.op);
    showOps();
    if (m.op.finished) go(here);
  },
  previewShown(m) {
    window.__spike.events.push({ previewShown: m.path, handler: m.handler, error: m.error });
    $('previewText').textContent = m.error ? `No Windows preview: ${m.error}` : '';
  },
  previewSnapshot(m) {
    if (m.url) previewArea.style.backgroundImage = `url(${m.url})`;
    $('menu').hidden = false;
  },
  nativeListed(m) { window.__spike.events.push({ nativeListed: m }); },
};

host.addEventListener('message', e => events[e.data.event]?.(e.data));
darkQuery.addEventListener('change', applyTheme);
post({ op: 'ready' });
