// The page of a Foldex window. It asks the host ({ op, ... }) and is told ({ event, ... }); see MainForm.cs.
// The panes of plan 03 (docs/plans/03-PLAN-connected-panes.md): panes.js decides what each pane shows, this file draws
// them. The default layout (3.5): the root, a tree of folders on the left; a list following it; a preview on request.
'use strict';

const host = window.chrome.webview;
const ThisPC = '::{20D04FE0-3AEA-1069-A2D8-08002B30309D}';
const Network = '::{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}';
const RecycleBin = 'shell:RecycleBinFolder';
const TreeTop = ['shell:Profile', ThisPC, Network, RecycleBin];
const $ = id => document.getElementById(id);
let settings = {};
let themes = {};   // every theme, complete (ThemeFile.cs; look.js)

// What the test copy reads over the debugging port.
window.__spike = { lists: [], events: [] };

function post(msg) {
  host.postMessage(msg);
}

// Light or dark and the theme of that mode (look.js).
function applyTheme() {
  applyLook(settings, themes);
}

function status(text, warn = false) {
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
}

const same = (a, b) => a != null && b != null && a.toLowerCase() === b.toLowerCase();

// ---------- Icons: the system's, asked once per index ----------

const icons = new Map();
const iconsAsked = new Set();
const iconUsers = new Set();   // views to draw again when icons arrive

function iconImage(entry, missing) {
  const img = document.createElement('img');
  if (icons.has(entry.icon)) img.src = icons.get(entry.icon);
  else if (entry.icon >= 0 && !iconsAsked.has(entry.icon)) { iconsAsked.add(entry.icon); missing.push(entry.icon); }
  return img;
}

function askIcons(missing, own) {
  if (missing.length) post({ op: 'icons', indexes: missing });
  if (own.length) post({ op: 'ownIcons', ids: own });
}

// ---------- Listings: per channel (a pane, a tree node); a new one on a channel replaces the old ----------

let lastReq = 0;
const listeners = new Map();

function list(channel, location, foldersOnly, onPart, onDone, elevated = false) {
  const req = ++lastReq;
  listeners.set(channel, { req, onPart, onDone, sent: performance.now() });
  post({ op: elevated ? 'listElevated' : 'list', channel, location, foldersOnly, req });
}

// ---------- Rows in view only ----------

const RowHeight = 22;

function visibleRange(body, count) {
  const first = Math.max(0, Math.floor(body.scrollTop / RowHeight) - 5);
  const last = Math.min(count, Math.ceil((body.scrollTop + body.clientHeight) / RowHeight) + 5);
  return [first, last];
}

function scrollIntoView(body, index) {
  const top = index * RowHeight;
  if (top < body.scrollTop) body.scrollTop = top;
  else if (top + RowHeight > body.scrollTop + body.clientHeight) body.scrollTop = top + RowHeight - body.clientHeight;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
// Folders first, then by name; drives (in This PC) by their letter and before the rest, as Explorer has them.
const isDrive = x => /^[A-Za-z]:\\$/.test(x.id);
const byName = (a, b) => (b.folder - a.folder) || (isDrive(b) - isDrive(a))
  || (isDrive(a) && isDrive(b) ? collator.compare(a.id, b.id) : collator.compare(a.name, b.name));

function formatSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

// ---------- The panes ----------

const layout = new Layout();
const views = new Map();
let activePane = null;

function paneElement(id, kind, title) {
  const el = document.createElement('section');
  el.className = `pane ${kind}`;
  el.dataset.pane = id;
  el.innerHTML = '<div class="head"><span class="title"></span><span class="marks"></span></div><div class="body" tabindex="0"><div class="rows"></div></div>';
  el.querySelector('.title').textContent = title;
  el.addEventListener('mousedown', () => activate(id), true);
  el.addEventListener('focusin', () => activate(id));
  return el;
}

// A pane activated: the panes above it show their state for its branch (3.1).
function activate(id) {
  if (activePane === id) return;
  activePane = id;
  queueMicrotask(ribbonRefresh);
  for (const changed of layout.activate(id)) views.get(changed)?.restore();
  for (const v of views.values()) v.el.classList.toggle('active', v.id === id);
  drawHeads();
  $('location').value = views.get(id)?.locationText() ?? '';
}

// Each head in the colour it shows; a source has marks for the other branches it feeds, a click switches to one.
function drawHeads() {
  for (const v of views.values()) {
    const pane = layout.pane(v.id);
    const key = pane.source === null ? layout.keyOf(v.id) : pane.colour;
    v.el.style.setProperty('--branch', key !== '' && key !== null ? `var(--branch-${key})` : '');
    const marks = v.el.querySelector('.marks');
    const colours = [...new Set(layout.followers(v.id).map(f => f.colour))].filter(c => c !== layout.keyOf(v.id));
    marks.replaceChildren(...colours.map(c => {
      const dot = document.createElement('span');
      dot.style.background = `var(--branch-${c})`;
      dot.title = `Switch to branch ${c + 1}`;
      dot.addEventListener('mousedown', e => {
        e.stopPropagation();
        activate(layout.followers(v.id, c)[0].id);
      });
      return dot;
    }));
  }
}

// Followers take what a pane focused once the cursor rests (3.3, debounce).
const focusTimers = new Map();

function focusItem(paneId, item) {
  layout.state(paneId).focus = item ? item.id : null;
  clearTimeout(focusTimers.get(paneId));
  focusTimers.set(paneId, setTimeout(() => apply(layout.focus(paneId, item)), 150));
}

function apply(updates) {
  for (const u of updates) {
    const v = views.get(u.pane);
    if (!v) continue;
    if ('location' in u) v.load(u.location);
    if ('show' in u) v.show(u.show);
  }
}

// Executing an item (3.3): a file opens as Windows opens it; a folder is opened by the pane's source, or expands in
// place in a pane without one.
function execute(paneId, item) {
  const r = layout.execute(paneId, item);
  if (r.open) post({ op: 'execute', ids: [r.open] });
  if (r.expand) views.get(r.expand.pane)?.toggle?.(r.expand.item);
  if (r.reveal) views.get(r.reveal.pane)?.reveal?.(r.reveal.item);
  apply(r.updates);
}

// A path typed, or Backspace in a follower: its source goes there and the follower follows (open question 7,
// suggestion); the root shows it in its tree.
function goTo(paneId, path) {
  const pane = layout.pane(paneId);
  const opener = pane.source ?? paneId;
  views.get(opener)?.reveal?.(path);
  if (opener !== paneId) apply(layout.focus(opener, { id: path, folder: true }));
}

function parentOf(path) {
  if (!/^[A-Za-z]:\\|^\\\\/.test(path) || /^[A-Za-z]:\\?$/.test(path)) return ThisPC;
  const parent = path.replace(/\\[^\\]+\\?$/, '');
  return /^[A-Za-z]:$/.test(parent) ? parent + '\\' : parent;
}

// ---------- The root: a tree of folders (3.5) ----------

class TreeView {
  constructor(id) {
    this.id = id;
    this.nodes = new Map();   // lower-case id -> node
    this.top = [];
    this.flat = [];
    this.el = paneElement(id, 'tree', 'Folders');
    this.body = this.el.querySelector('.body');
    this.rows = this.el.querySelector('.rows');
    this.body.addEventListener('scroll', () => this.render());
    this.body.addEventListener('mousedown', e => this.click(e));
    this.body.addEventListener('dblclick', e => {
      const n = this.nodeAt(e.target);
      if (n && !e.target.classList.contains('twisty')) execute(this.id, { id: n.id, folder: true });
    });
    this.body.addEventListener('keydown', e => this.key(e));
    this.body.addEventListener('contextmenu', e => {
      e.preventDefault();
      const n = this.nodeAt(e.target);
      if (n) post({ op: 'menu', ids: [n.id], x: e.clientX * devicePixelRatio, y: e.clientY * devicePixelRatio, extended: e.shiftKey });
    });
    dropTarget(this.body, e => this.nodeAt(e.target)?.id ?? null);
    iconUsers.add(this);
  }

  node(id) { return id == null ? undefined : this.nodes.get(id.toLowerCase()); }

  add(entry, parent) {
    const known = this.node(entry.id);
    if (known) return known;
    const n = { ...entry, parent, children: null, expanded: false, depth: parent ? parent.depth + 1 : 0 };
    this.nodes.set(entry.id.toLowerCase(), n);
    return n;
  }

  init() {
    return new Promise(done => {
      described.set(++lastReq, entries => {
        this.top = entries.map(e => this.add(e, null));
        this.flatten();
        done();
      });
      post({ op: 'describe', ids: TreeTop, req: lastReq });
    });
  }

  // Loads a node's subfolders (once); resolves when they are there.
  load(n) {
    if (n.children) return Promise.resolve();
    if (n.loading) return n.loading;
    n.loading = new Promise(done => {
      const kids = [];
      list(`tree:${this.id}:${n.id}`, n.id, true, part => kids.push(...part), m => {
        n.children = kids.concat(m.entries).sort(byName).map(e => this.add(e, n));
        n.error = m.error;
        n.loading = null;
        this.flatten();
        done();
      });
    });
    return n.loading;
  }

  async expand(n, open = true) {
    if (open) await this.load(n);
    n.expanded = open;
    this.flatten();
  }

  toggle(id) {
    const n = this.node(id);
    if (n) this.expand(n, !n.expanded);
  }

  flatten() {
    this.flat = [];
    const walk = list => {
      for (const n of list) {
        if (n.hidden && !settings.showHidden && n.depth > 0) continue;
        this.flat.push(n);
        if (n.expanded && n.children) walk(n.children);
      }
    };
    walk(this.top);
    this.render();
  }

  render() {
    this.rows.style.height = `${this.flat.length * RowHeight}px`;
    const [first, last] = visibleRange(this.body, this.flat.length);
    const focus = layout.state(this.id).focus;
    const missing = [], nodes = [];
    for (let i = first; i < last; i++) {
      const n = this.flat[i];
      const row = document.createElement('div');
      row.className = 'row' + (same(n.id, focus) ? ' selected focused' : '') + (n.hidden ? ' hidden' : '');
      row.style.top = `${i * RowHeight}px`;
      row.style.paddingLeft = `${8 + n.depth * 14}px`;
      row.dataset.index = i;
      const twisty = document.createElement('span');
      twisty.className = 'twisty';
      twisty.textContent = n.children && n.children.length === 0 ? '' : n.expanded ? '-' : '+';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = n.name;
      row.append(twisty, iconImage(n, missing), name);
      if (n.link) {
        const link = document.createElement('span');
        link.className = 'link';
        link.textContent = 'link';
        row.append(link);
      }
      nodes.push(row);
    }
    this.rows.replaceChildren(...nodes);
    askIcons(missing, []);
  }

  nodeAt(target) {
    const row = target.closest('.row');
    return row ? this.flat[Number(row.dataset.index)] : null;
  }

  click(e) {
    if (e.button !== 0) return;
    const n = this.nodeAt(e.target);
    if (!n) return;
    if (e.target.classList.contains('twisty')) this.expand(n, !n.expanded);
    this.select(n.id);
  }

  select(id) {
    const n = this.node(id);
    if (!n) return;
    focusItem(this.id, { id: n.id, folder: true });
    const i = this.flat.indexOf(n);
    if (i >= 0) scrollIntoView(this.body, i);
    this.render();
    if (activePane === this.id) $('location').value = this.locationText();
    ribbonRefresh();
  }

  key(e) {
    const n = this.node(layout.state(this.id).focus);
    const i = n ? this.flat.indexOf(n) : -1;
    const to = k => { if (this.flat[k]) this.select(this.flat[k].id); e.preventDefault(); };
    if (e.key === 'ArrowDown') to(i + 1);
    else if (e.key === 'ArrowUp') to(Math.max(0, i - 1));
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(this.flat.length - 1);
    else if (e.key === 'ArrowRight' && n) { if (!n.expanded) this.expand(n); else if (n.children?.[0]) this.select(n.children[0].id); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' && n) { if (n.expanded) this.expand(n, false); else if (n.parent) this.select(n.parent.id); e.preventDefault(); }
  }

  // Shows a folder in the tree: expanded down to it and selected. Paths on disk are found from This PC down; other
  // places only when the tree has them already.
  async reveal(path) {
    if (!this.node(path) && /^[A-Za-z]:\\/.test(path)) {
      const pc = this.node(ThisPC);
      if (pc) {
        await this.expand(pc);
        const parts = path.replace(/\\+$/, '').split('\\');
        let here = this.node(parts[0] + '\\');
        for (let k = 1; here && k < parts.length; k++) {
          await this.expand(here);
          here = this.node(parts.slice(0, k + 1).join('\\')) ?? here.children?.find(c => same(c.id, parts.slice(0, k + 1).join('\\')));
        }
      }
    } else if (this.node(path)?.parent) {
      for (let p = this.node(path).parent; p; p = p.parent) p.expanded = true;
      this.flatten();
    }
    this.select(path);
  }

  restore() { this.render(); }

  up() {
    const n = this.node(layout.state(this.id).focus);
    if (n?.parent) this.select(n.parent.id);
  }

  // The focused folder's subfolders read again.
  refresh() {
    const n = this.node(layout.state(this.id).focus);
    if (!n) return;
    n.children = null;
    this.expand(n, n.expanded);
  }

  locationText() { return layout.state(this.id).focus ?? ''; }
}

const described = new Map();

// ---------- A list of files and folders (a follower) ----------

class ListView {
  constructor(id) {
    this.id = id;
    this.entries = [];
    this.selected = new Set();
    this.anchor = null;
    this.location = null;
    this.el = paneElement(id, 'list', '');
    this.body = this.el.querySelector('.body');
    this.rows = this.el.querySelector('.rows');
    this.body.addEventListener('scroll', () => this.render());
    this.body.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const x = this.entryAt(e.target);
      if (x && (!this.selected.has(x.id) || e.ctrlKey || e.shiftKey)) this.select(x, e);
    });
    this.body.addEventListener('dblclick', e => {
      const x = this.entryAt(e.target);
      if (x) execute(this.id, x);
    });
    this.body.addEventListener('keydown', e => this.key(e));
    this.body.addEventListener('contextmenu', e => {
      e.preventDefault();
      const x = this.entryAt(e.target);
      if (!x) return;
      if (!this.selected.has(x.id)) this.select(x, e);
      post({ op: 'menu', ids: this.ids(), x: e.clientX * devicePixelRatio, y: e.clientY * devicePixelRatio, extended: e.shiftKey });
    });
    // Dragging out: the host starts the shell's own drag (plan 02 3.6).
    this.body.addEventListener('dragstart', e => {
      e.preventDefault();
      const x = this.entryAt(e.target);
      if (x && !this.selected.has(x.id)) this.select(x, e);
      post({ op: 'dragOut', ids: this.ids() });
    });
    dropTarget(this.body, e => {
      const x = this.entryAt(e.target);
      return x?.folder ? x.id : this.location;
    });
    new ResizeObserver(() => this.render()).observe(this.body);
    iconUsers.add(this);
  }

  ids() { return this.entries.filter(x => this.selected.has(x.id)).map(x => x.id); }

  load(location, elevated = false) {
    this.location = location;
    this.entries = [];
    this.selected = new Set();
    this.anchor = null;
    this.message = null;
    this.body.scrollTop = 0;
    this.el.querySelector('.title').textContent = location ?? '';
    if (activePane === this.id) $('location').value = location ?? '';
    this.render();
    if (!location) return;
    let first = true;
    list(this.id, location, false, part => this.take(part, first && !(first = false)), m => this.done(m, first), elevated);
  }

  take(entries, reset) {
    if (reset) this.entries = [];
    this.entries = this.entries.concat(entries.filter(x => settings.showHidden || !x.hidden)).sort(byName);
    this.render();
    status(`${this.entries.length} items so far...`);
  }

  done(m, first) {
    this.take(m.entries, first);
    // A link that may not be listed itself shows its target's contents (plan 05 3.1).
    this.el.querySelector('.title').textContent = m.target ? `${m.name} -> ${m.target}` : m.name;
    this.name = m.name;
    if (m.denied && !m.elevated) this.message = 'denied';
    else if (m.error) this.message = m.error;
    this.render();
    window.__spike.lists.push({ location: m.location, count: this.entries.length, enumMs: m.enumMs });
    if (m.error) status(`${m.name}: ${m.error}`, true);
    else status(`${m.name}${m.elevated ? ' (as administrator)' : ''}: ${this.entries.length} items`);
    // The focus of this branch, as it was left, comes back when it is still there.
    const focus = layout.state(this.id).focus;
    if (focus && this.entries.some(x => same(x.id, focus))) this.select(this.entries.find(x => same(x.id, focus)), {}, true);
    ribbonRefresh();
  }

  render() {
    if (this.message && !this.entries.length) {
      const msg = document.createElement('div');
      msg.className = 'message';
      msg.textContent = this.message === 'denied' ? 'You have no access to this folder.' : this.message;
      if (this.message === 'denied') {
        const button = document.createElement('button');
        button.textContent = 'List as administrator';
        button.addEventListener('click', () => this.load(this.location, true));
        msg.append(button);
      }
      this.rows.style.height = '';
      this.rows.replaceChildren(msg);
      return;
    }
    this.rows.style.height = `${this.entries.length * RowHeight}px`;
    const [first, last] = visibleRange(this.body, this.entries.length);
    const focus = layout.state(this.id).focus;
    const missing = [], own = [], nodes = [];
    for (let i = first; i < last; i++) {
      const x = this.entries[i];
      if (x.own) { own.push(x.id); x.own = false; }   // its own icon asked once, when in view
      const row = document.createElement('div');
      row.className = 'row' + (this.selected.has(x.id) ? ' selected' : '') + (same(x.id, focus) ? ' focused' : '') + (x.hidden ? ' hidden' : '');
      row.style.top = `${i * RowHeight}px`;
      row.dataset.index = i;
      row.draggable = true;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = x.name;
      const size = document.createElement('span');
      size.className = 'size';
      size.textContent = formatSize(x.size);
      const date = document.createElement('span');
      date.className = 'date';
      date.textContent = x.modified ? dateFormat.format(x.modified) : '';
      row.append(iconImage(x, missing), name);
      if (x.link) {
        const link = document.createElement('span');
        link.className = 'link';
        link.textContent = 'link';
        row.append(link);
      }
      row.append(size, date);
      nodes.push(row);
    }
    this.rows.replaceChildren(...nodes);
    askIcons(missing, own);
  }

  entryAt(target) {
    const row = target.closest('.row');
    return row ? this.entries[Number(row.dataset.index)] : null;
  }

  select(x, e, quiet = false) {
    const index = this.entries.indexOf(x);
    if (e.shiftKey && this.anchor) {
      const a = this.entries.findIndex(y => y.id === this.anchor);
      const [lo, hi] = [Math.min(a, index), Math.max(a, index)];
      if (!e.ctrlKey) this.selected.clear();
      for (let k = lo; k <= hi; k++) this.selected.add(this.entries[k].id);
    } else if (e.ctrlKey) {
      this.selected.has(x.id) ? this.selected.delete(x.id) : this.selected.add(x.id);
      this.anchor = x.id;
    } else {
      this.selected = new Set([x.id]);
      this.anchor = x.id;
    }
    layout.state(this.id).selection = [...this.selected];
    scrollIntoView(this.body, index);
    this.render();
    if (!quiet) focusItem(this.id, { id: x.id, folder: x.folder });
    ribbonRefresh();
  }

  key(e) {
    const focus = layout.state(this.id).focus;
    const i = this.entries.findIndex(x => same(x.id, focus));
    const to = k => { const x = this.entries[Math.max(0, Math.min(this.entries.length - 1, k))]; if (x) this.select(x, e); e.preventDefault(); };
    const page = Math.max(1, Math.floor(this.body.clientHeight / RowHeight) - 1);
    if (e.key === 'ArrowDown') to(i + 1);
    else if (e.key === 'ArrowUp') to(i - 1);
    else if (e.key === 'PageDown') to(i + page);
    else if (e.key === 'PageUp') to(i - page);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(this.entries.length - 1);
  }

  selectAll() {
    this.selected = new Set(this.entries.map(x => x.id));
    layout.state(this.id).selection = [...this.selected];
    this.render();
  }

  // Up through the parent (3.3).
  up() {
    if (this.location) goTo(this.id, parentOf(this.location));
  }

  refresh() {
    if (this.location) this.load(this.location);
  }

  // Back on this pane's state for the branch now active (3.1).
  restore() {
    const s = layout.state(this.id);
    if (!same(s.location, this.location)) this.load(s.location);
    else {
      this.selected = new Set(s.selection);
      this.render();
    }
  }

  locationText() { return this.location ?? ''; }
}

// ---------- A preview (plan 04): Windows' preview handler in the host, over this pane's area ----------

class PreviewView {
  constructor(id) {
    this.id = id;
    this.path = null;
    this.el = paneElement(id, 'preview', 'Preview');
    this.body = this.el.querySelector('.body');
    this.rows = this.el.querySelector('.rows');
    new ResizeObserver(() => { if (this.path) post({ op: 'previewMove', rect: this.rect() }); }).observe(this.body);
    this.message('Select a file to preview it.');
  }

  rect() {
    const r = this.body.getBoundingClientRect();
    const d = devicePixelRatio;
    return { x: r.left * d, y: r.top * d, width: r.width * d, height: r.height * d };
  }

  message(text) {
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = text;
    this.rows.replaceChildren(msg);
  }

  show(path) {
    const x = path && views.get(layout.pane(this.id).source)?.entries?.find(e => same(e.id, path));
    if (!path || x?.folder) {
      this.path = null;
      post({ op: 'previewClose' });
      this.message(path ? 'A folder.' : 'Select a file to preview it.');
      return;
    }
    this.path = path;
    this.el.querySelector('.title').textContent = x?.name ?? path;
    this.message('');
    post({ op: 'preview', path, rect: this.rect() });
  }

  restore() { }

  up() { }

  refresh() { if (this.path) this.show(this.path); }

  locationText() { return this.path ?? ''; }

  close() { post({ op: 'previewClose' }); }
}

// ---------- Dropping files from Explorer onto a pane ----------

function dropTarget(body, targetOf) {
  body.addEventListener('dragover', e => e.preventDefault());
  body.addEventListener('drop', e => {
    e.preventDefault();
    const target = targetOf(e);
    if (target) host.postMessageWithAdditionalObjects({ op: 'drop', target, types: [...e.dataTransfer.types] }, e.dataTransfer.files);
  });
}

// ---------- The default layout (3.5) ----------

let preview = null;

function addView(view, after) {
  views.set(view.id, view);
  const panes = $('panes');
  if (after) after.el.after(view.el); else panes.append(view.el);
  return view;
}

function splitter(left) {
  const bar = document.createElement('div');
  bar.className = 'splitter';
  bar.addEventListener('mousedown', e => {
    const start = e.clientX, width = left.el.getBoundingClientRect().width;
    const move = m => { left.el.style.width = `${Math.max(120, width + m.clientX - start)}px`; };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
    e.preventDefault();
  });
  left.el.after(bar);
}

async function start(paths) {
  const tree = newRootPane(paths[0]);
  const list = newChildPane(tree.id);
  await tree.ready;
  list.body.focus();
}

// A new root: a tree of folders (3.4, New pane), at the end of the window, on `path` or else This PC.
function newRootPane(path) {
  const id = layout.add({ kind: 'tree', content: 'folders' });
  const tree = addView(new TreeView(id));
  splitter(tree);
  activate(id);
  tree.ready = tree.init().then(() => path ? tree.reveal(path) : tree.select(ThisPC));
  return tree;
}

// A new child of a pane, after the panes already following it (3.4, New child pane), with the settings of the parent's
// current child; it shows what the parent focuses.
function newChildPane(parentId) {
  const id = layout.add({ source: parentId, ...layout.childSettings(parentId) });
  const siblings = [...views.values()].filter(v => layout.pane(v.id).source === parentId);
  const after = siblings.at(-1)?.el ?? views.get(parentId).el;
  const place = after.nextElementSibling?.classList.contains('splitter') ? after.nextElementSibling : after;
  const view = new ListView(id);
  views.set(id, view);
  place.after(view.el);
  // Its branch active first (a new one starts from a copy of the parent's state), then it shows the parent's focused
  // item when that is a folder (3.3); the other branches' children stay as they are.
  activate(id);
  const focus = layout.state(parentId).focus;
  const parent = views.get(parentId);
  const folder = parent instanceof TreeView || !!parent.entries?.find(x => same(x.id, focus))?.folder;
  if (focus && folder) apply(layout.follow(parentId, { id: focus, folder: true }));
  drawHeads();
  return view;
}

// Closes a pane (3.4): its children get its parent; with none left, New pane makes one.
function closePane(id) {
  const view = views.get(id);
  if (!view) return;
  if (view === preview) {
    preview.close();
    preview = null;
  }
  if (view.el.nextElementSibling?.classList.contains('splitter')) view.el.nextElementSibling.remove();
  view.el.remove();
  views.delete(id);
  iconUsers.delete(view);
  layout.remove(id);
  activePane = null;
  const next = [...views.values()][0];
  if (next) {
    activate(next.id);
    next.body.focus();
  } else status('No panes left: New pane (View > Panes, Ctrl+Alt+Shift+N) makes one.');
  drawHeads();
  ribbonRefresh();
}

// The preview pane (Preview on the ribbon, Alt+P): a child of the active list, or of the first list.
function togglePreview() {
  if (preview) return closePane(preview.id);
  const list = activeView() instanceof ListView ? activeView() : [...views.values()].find(v => v instanceof ListView);
  if (!list) return status('A preview follows a list: make one with New child pane.', true);
  const id = layout.add({ source: list.id, kind: 'preview' });
  preview = addView(new PreviewView(id), list);
  preview.show(layout.state(list.id).focus);
  drawHeads();
}

function cyclePane(step) {
  const order = [...document.querySelectorAll('#panes .pane')].map(el => el.dataset.pane);
  const next = order[(order.indexOf(activePane) + step + order.length) % order.length];
  views.get(next)?.body.focus();
}

// ---------- What the actions act on (actions.js) ----------

const activeView = () => views.get(activePane) ?? null;

// The ids selected in the active pane: a list's selection, a tree's focused folder.
function selectedIds() {
  const v = activeView();
  if (v instanceof ListView) return v.ids();
  if (v instanceof TreeView) return layout.state(v.id).focus ? [layout.state(v.id).focus] : [];
  return [];
}

function focusedItem() {
  const v = activeView(), focus = v && layout.state(v.id).focus;
  if (v instanceof ListView) return v.entries.find(x => same(x.id, focus)) ?? null;
  if (v instanceof TreeView && focus) return { id: focus, folder: true };
  return null;
}

// The tree that shows a pane's folders: the pane itself when it is a tree, else its parent when that is one.
function treeFor(paneId) {
  const v = views.get(paneId);
  if (v instanceof TreeView) return v;
  const parent = views.get(layout.pane(paneId)?.source);
  return parent instanceof TreeView ? parent : null;
}

// Open, the switch (actions.js): a folder is open when its tree has it expanded.
function folderOpen(item) {
  return !!item?.folder && !!treeFor(activePane)?.node(item.id)?.expanded;
}

async function toggleFolder(item) {
  if (!item?.folder) return;
  const tree = treeFor(activePane);
  if (!tree) return execute(activePane, item);   // no tree to open it in: as a double-click
  const node = tree.node(item.id);
  if (node?.expanded) await tree.expand(node, false);
  else {
    // In a child the parent opens it, and the child follows (3.3).
    if (tree.id !== activePane) {
      await tree.reveal(item.id);
      apply(layout.focus(tree.id, item));
    }
    if (tree.node(item.id)) await tree.expand(tree.node(item.id));
  }
  ribbonRefresh();
}

// The folder new things go into: the list's folder, the tree's focused folder; only folders on disk.
function currentFolder() {
  const v = activeView();
  const folder = v instanceof ListView ? v.location : v instanceof TreeView ? layout.state(v.id).focus : null;
  return folder && /^[A-Za-z]:\\|^\\\\/.test(folder) ? folder : null;
}

function nameOf(id) {
  for (const v of views.values()) {
    const x = v.entries?.find(e => e.id === id) ?? v.node?.(id);
    if (x) return x.name;
  }
  return id;
}

// A setting changed here: kept in your settings.json (the host writes it and tells every window), shown at once.
function setSetting(name, value) {
  const before = { ...settings };
  settings[name] = value;
  post({ op: 'setSetting', name, value });
  settingsChanged(before);
}

// What follows a change of settings, here, in the settings window or in settings.json by hand.
function settingsChanged(before) {
  applyTheme();
  if (before.showHidden !== settings.showHidden) {
    for (const v of views.values()) if (v instanceof TreeView) v.flatten(); else v.refresh();
  }
  ribbonRefresh();
}

// The settings' and the themes' problems in the status line.
function settingsProblems(m) {
  const problems = [...m.settings.problems, ...m.themes.problems];
  if (problems.length) status(problems.join(' '), true);
}

$('location').addEventListener('keydown', e => {
  if (e.key === 'Enter' && activePane) goTo(activePane, $('location').value.trim());
});

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

function reloadLists() {
  for (const v of views.values()) if (v instanceof ListView && v.location) v.load(v.location);
}

// ---------- Events ----------

const events = {
  hello(m) {
    settings = m.settings.values;
    themes = m.themes.themes;
    applyTheme();
    setKeys(m.keys);
    setRibbon(m.ribbon);
    $('version').textContent = m.version + (m.commit ? ` (${m.commit})` : '');
    for (const o of m.ops) ops.set(o.id, o);
    showOps();
    settingsProblems(m);
    start(m.paths);
  },
  // Settings or themes changed (the settings window, a file edited by hand): every window is told.
  settings(m) {
    const before = settings;
    settings = m.settings.values;
    themes = m.themes.themes;
    settingsChanged(before);
    settingsProblems(m);
  },
  open(m) {
    const tree = views.get(layout.root);
    if (m.paths[0] && tree instanceof TreeView) tree.reveal(m.paths[0]);
  },
  listing(m) {
    const l = listeners.get(m.channel);
    if (l && l.req === m.req) l.onPart(m.entries);
  },
  listed(m) {
    const l = listeners.get(m.channel);
    if (!l || l.req !== m.req) return;   // an answer for a location left already
    listeners.delete(m.channel);
    l.onDone(m);
  },
  described(m) {
    described.get(m.req)?.(m.entries);
    described.delete(m.req);
  },
  icons(m) {
    for (const [i, url] of Object.entries(m.icons)) if (url) icons.set(Number(i), url);
    for (const v of iconUsers) v.render();
  },
  ownIcons(m) {
    for (const v of views.values()) {
      if (!(v instanceof ListView)) continue;
      const byId = new Map(v.entries.map(x => [x.id, x]));
      for (const [id, icon] of Object.entries(m.icons)) if (byId.has(id) && icon >= 0) byId.get(id).icon = icon;
      v.render();
    }
  },
  menuDone(m) {
    window.__spike.events.push({ menuDone: m.verb ?? null, error: m.error ?? null });
    if (m.error) status(m.error, true);
    else if (m.verb === 'rename') status('Rename: not built yet.');
    else if (m.verb) setTimeout(reloadLists, 300);
  },
  menuTexts(m) { window.__spike.events.push({ menuTexts: m.texts, error: m.error }); },
  verbDone(m) { window.__spike.events.push({ verbDone: m.ok, error: m.error }); setTimeout(reloadLists, 300); },
  executeFailed(m) { status(m.error, true); },
  clipboardDone(m) { if (m.error) status(m.error, true); },
  settingFailed(m) { status(`settings.json: ${m.error}`, true); },
  dragDone(m) {
    window.__spike.events.push({ dragDone: m.effect, error: m.error, source: m.source });
    if (m.error) status(m.error, true);
    else if (m.effect === 2) reloadLists();
  },
  dropped(m) {
    window.__spike.events.push({ dropped: m.count, types: m.types });
    if (!m.count) status(`Nothing to copy came with the drop (${m.types.join(', ')})`, true);
  },
  fileOp(m) {
    ops.set(m.op.id, m.op);
    showOps();
    if (m.op.finished) reloadLists();
  },
  previewShown(m) {
    window.__spike.events.push({ previewShown: m.path, handler: m.handler, error: m.error });
    if (m.error && preview) preview.message(`No Windows preview: ${m.error}`);
  },
};

host.addEventListener('message', e => events[e.data.event]?.(e.data));
darkQuery.addEventListener('change', applyTheme);
post({ op: 'ready' });
