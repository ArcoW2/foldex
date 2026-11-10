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

// Light or dark, the theme of that mode and the fonts (look.js).
function applyTheme() {
  applyLook(settings, themes);
  setRowHeight(paneRowHeight(settings));
}

// Rows of another height: every tree and list drawn again, the same rows at the top, the focused one kept in view.
function setRowHeight(height) {
  setIconSize(height);
  if (height === RowHeight) return;
  const old = RowHeight;
  RowHeight = height;
  for (const v of views.values()) {
    if (!v.rows) continue;
    const top = v.body.scrollTop * height / old;
    v.render();   // the new height first, so the scroll position fits
    v.body.scrollTop = top;
    const items = v.flat ?? v.entries ?? [];
    const i = items.findIndex(x => same(x.id, layout.state(v.id).focus));
    if (i >= 0) scrollIntoView(v.body, i);
    v.render();
  }
}

// Ctrl+mouse wheel over a tree or a list: the pane font one point larger or smaller, every pane alike (3.3). The
// panes follow at once; the setting is written once the wheel rests.
const PaneSizes = { min: 4, max: 36, rest: 200 };
let paneSizeTimer = 0;
document.addEventListener('wheel', e => {
  if (!e.ctrlKey || !e.target.closest?.('.pane.tree, .pane.list')) return;
  e.preventDefault();
  const now = pointSize(settings.paneSize);
  const next = Math.min(PaneSizes.max, Math.max(PaneSizes.min, now + (e.deltaY < 0 ? 1 : -1)));
  if (next === now) return;
  settings.paneSize = next;
  applyFonts(settings);
  setRowHeight(paneRowHeight(settings));
  clearTimeout(paneSizeTimer);
  paneSizeTimer = setTimeout(() => post({ op: 'setSetting', name: 'paneSize', value: settings.paneSize }), PaneSizes.rest);
}, { passive: false });

function status(text, warn = false) {
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
}

const same = (a, b) => a != null && b != null && a.toLowerCase() === b.toLowerCase();

// ---------- Icons: the system's, asked once per index ----------

// Icons grow with the rows (docs/plans/08-PLAN-fonts.md 3.4): drawn at a size that follows the row height, from the
// system's 16, 32 or 48 px icon (the smallest not smaller than drawn, so the browser only scales down). Kept per
// "size:index"; while a size is on its way, the icon of another size stands in.
const IconSources = [16, 32, 48];
let iconSize = 16, iconSource = 16;
const icons = new Map();
const iconsAsked = new Set();
const iconUsers = new Set();   // views to draw again when icons arrive

function setIconSize(rowHeight) {
  const size = Math.round(rowHeight * 16 / 22);
  iconSize = size < 20 ? 16 : Math.min(48, size);   // up to 20 px the system's 16 px icon as it is: sharp
  iconSource = IconSources.find(s => s >= iconSize) ?? 48;
  document.documentElement.style.setProperty('--icon-size', `${iconSize}px`);
}

function iconImage(entry, missing) {
  const img = document.createElement('img');
  const key = `${iconSource}:${entry.icon}`;
  const stand = icons.get(key) ?? IconSources.map(s => icons.get(`${s}:${entry.icon}`)).find(u => u);
  if (stand) img.src = stand;
  if (!icons.has(key) && entry.icon >= 0 && !iconsAsked.has(key)) { iconsAsked.add(key); missing.push(entry.icon); }
  return img;
}

function askIcons(missing, own) {
  if (missing.length) post({ op: 'icons', indexes: missing, size: iconSource });
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

let RowHeight = 22;   // follows the pane font (look.js paneRowHeight; docs/plans/08-PLAN-fonts.md 3.4)

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
  el.innerHTML = '<div class="head"><span class="connector" title="Drag onto another pane to follow it"></span>' +
    '<span class="title"></span><button class="pin" title="Pin: stop following the parent"></button><span class="marks"></span></div>' +
    '<div class="body" tabindex="0"><div class="rows"></div></div>';
  el.querySelector('.title').textContent = title;
  el.querySelector('.connector').addEventListener('mousedown', e => { activate(id); dragConnector(id, e); });
  el.querySelector('.pin').addEventListener('click', () => togglePin(id));
  el.addEventListener('mousedown', () => activate(id), true);
  el.addEventListener('focusin', () => activate(id));
  return el;
}

// A pane activated: the panes above it show their state for its branch (3.1).
function activate(id) {
  if (!docks.visible(id) && docks.find(id)) {   // a pane in a tab not shown: its tab comes forward
    docks.show(id);
    renderDock();
  }
  if (activePane === id) return;
  activePane = id;
  queueMicrotask(ribbonRefresh);
  for (const changed of layout.activate(id)) views.get(changed)?.restore();
  for (const v of views.values()) v.el.classList.toggle('active', v.id === id);
  drawHeads();
  $('location').value = views.get(id)?.locationText() ?? '';
}

// Each head in the colour it shows; a parent has a mark per branch it feeds, in the order the branches were made (the
// first rightmost, app.css), so a mark keeps its place; the active one full and larger. A click switches to one.
function drawHeads() {
  for (const v of views.values()) {
    const pane = layout.pane(v.id);
    const key = pane.source === null ? layout.keyOf(v.id) : pane.colour;
    v.el.style.setProperty('--branch', key !== '' && key !== null ? `var(--branch-${key})` : '');
    v.el.classList.toggle('child', pane.source !== null);
    v.el.classList.toggle('pinned', pane.pinned);
    v.el.querySelector('.pin').title = pane.pinned ? 'Pinned: click to follow the parent again' : 'Pin: stop following the parent';
    const marks = v.el.querySelector('.marks');
    const colours = [...new Set(layout.followers(v.id).map(f => f.colour))];
    marks.replaceChildren(...colours.map(c => {
      const dot = document.createElement('span');
      dot.style.background = `var(--branch-${c})`;
      dot.classList.toggle('on', c === layout.keyOf(v.id));
      dot.title = c === layout.keyOf(v.id) ? `Branch ${c + 1}: shown now` : `Switch to branch ${c + 1}`;
      dot.addEventListener('mousedown', e => {
        e.stopPropagation();
        activate(layout.followers(v.id, c)[0].id);
      });
      return dot;
    }));
  }
  drawTabs();
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
    if ('location' in u) {
      v.load(u.location);
      recordStep();
    }
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
    // Made shorter (the ribbon or the status line coming in, the window resized): the focused folder, in view at the
    // old height, stays in view.
    let height = 0;
    new ResizeObserver(() => {
      const before = height;
      height = this.body.clientHeight;
      if (height >= before) return;
      const i = this.flat.findIndex(x => same(x.id, layout.state(this.id).focus));
      const top = i * RowHeight - this.body.scrollTop;
      if (i >= 0 && top >= 0 && top + RowHeight <= before) scrollIntoView(this.body, i);
    }).observe(this.body);
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
    tellWatched();
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
    recordStep();
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

  tabTitle() { return 'Folders'; }
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
    tellWatched();
    if (!location) return;
    let first = true;
    list(this.id, location, false, part => this.take(part, first && !(first = false)), m => this.done(m, first), elevated);
  }

  // The folder changed on disk (3.8): read again where it is, the selection and the scroll position kept.
  reread() {
    if (!this.location || this.message) return;
    const keep = new Set(this.selected), top = this.body.scrollTop;
    let first = true;
    list(this.id, this.location, false, part => this.take(part, first && !(first = false)), m => {
      this.done(m, first);
      this.selected = new Set([...keep].filter(id => this.entries.some(x => x.id === id)));
      layout.state(this.id).selection = [...this.selected];
      this.body.scrollTop = top;
      this.render();
    });
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
    drawTabs();   // the tab shows the folder's name
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
    layout.state(this.id).focus = x.id;   // before drawing: the focus outline moves with the click
    scrollIntoView(this.body, index);
    this.render();
    if (!quiet) {
      focusItem(this.id, { id: x.id, folder: x.folder });
      recordStep();   // kept with the current step (3.6)
    }
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

  // A folder opened in this list itself: a list without a parent (or pinned) goes there on its own (plan 12 3.3).
  reveal(path) {
    const s = layout.state(this.id);
    s.location = path;
    s.focus = null;
    s.selection = [];
    this.load(path);
    recordStep();
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

  tabTitle() { return this.name ?? (this.location ?? '').split('\\').filter(x => x).pop() ?? 'Files'; }
}

// ---------- A preview (plan 04): Windows' preview handler in the host, over this pane's area ----------

class PreviewView {
  constructor(id) {
    this.id = id;
    this.path = null;
    this.el = paneElement(id, 'preview', 'Preview');
    this.body = this.el.querySelector('.body');
    this.rows = this.el.querySelector('.rows');
    // Windows' preview lies over this pane's area: it moves with it, goes when the pane is a tab not shown, and comes
    // back when it is shown again.
    new ResizeObserver(() => {
      if (!this.path) return;
      const r = this.body.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        if (!this.away) post({ op: 'previewClose' });
        this.away = true;
      } else if (this.away) {
        this.away = false;
        post({ op: 'preview', path: this.path, rect: this.rect() });
      } else post({ op: 'previewMove', rect: this.rect() });
    }).observe(this.body);
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

  tabTitle() { return 'Preview'; }

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

// ---------- Docking (plan 12 3.1): the areas, groups as tabs, splits; docks.js decides, this draws ----------

const docks = new Docks();
let preview = null;

// A view docked at `place` (docks.js add) and drawn.
function placeView(view, place) {
  views.set(view.id, view);
  docks.add(view.id, place);
  renderDock();
  return view;
}

// The window's panes drawn from the dock model: top, then left | center | right, then bottom; each area its node: a
// group (its tabs when more than one, the shown pane) or a split (its nodes with splitters between). The panes' own
// elements are moved, not made again, so what they show stays; their scroll positions are put back.
function renderDock() {
  const scrolls = [...views.values()].map(v => [v, v.body.scrollTop]);
  const root = $('panes');
  const middle = document.createElement('div');
  middle.className = 'dock-middle';
  const area = name => {
    const node = docks.areas[name];
    if (!node) return null;
    const el = document.createElement('div');
    el.className = `dock-area dock-${name}`;
    if (name === 'left' || name === 'right') el.style.width = `${docks.sizes[name]}px`;
    if (name === 'top' || name === 'bottom') el.style.height = `${docks.sizes[name]}px`;
    el.append(drawNode(node));
    return el;
  };
  const [top, left, center, right, bottom] = ['top', 'left', 'center', 'right', 'bottom'].map(area);
  const centerEl = center ?? Object.assign(document.createElement('div'), { className: 'dock-area dock-center dock-empty' });
  middle.append(...[left, left && areaSplitter('left'), centerEl, right && areaSplitter('right'), right].filter(x => x));
  root.replaceChildren(...[top, top && areaSplitter('top'), middle, bottom && areaSplitter('bottom'), bottom].filter(x => x));
  for (const v of views.values()) v.el.hidden = !docks.visible(v.id);
  for (const [v, top] of scrolls) v.body.scrollTop = top;
  drawTabs();
}

function drawNode(node) {
  if (node.type === 'group') {
    const el = document.createElement('div');
    el.className = 'dock-group';
    if (node.panes.length > 1) {
      const tabs = document.createElement('div');
      tabs.className = 'dock-tabs';
      tabs.dataset.group = node.panes.join(' ');
      el.append(tabs);
    }
    for (const id of node.panes) if (views.get(id)) el.append(views.get(id).el);
    return el;
  }
  const el = document.createElement('div');
  el.className = `dock-split dock-${node.dir}`;   // not "row": that is a list row's class
  node.children.forEach((child, k) => {
    if (k > 0) el.append(splitSplitter(node, k));
    const cell = document.createElement('div');
    cell.className = 'dock-cell';
    cell.style.flexGrow = node.shares[k] ?? 1;
    cell.append(drawNode(child));
    el.append(cell);
  });
  return el;
}

// The tabs of each group: the pane's title, in its branch colour; a click shows that pane and makes it active (the
// parent then shows its state for that tab's branch, plan 03 3.1).
function drawTabs() {
  for (const strip of document.querySelectorAll('.dock-tabs')) {
    const shown = docks.find(strip.dataset.group.split(' ')[0])?.group.shown;
    strip.replaceChildren(...strip.dataset.group.split(' ').filter(id => views.get(id)).map(id => {
      const tab = document.createElement('button');
      tab.className = 'dock-tab' + (id === shown ? ' on' : '');
      tab.textContent = views.get(id).tabTitle();
      const pane = layout.pane(id);
      const key = pane.source === null ? layout.keyOf(id) : pane.colour;
      tab.style.setProperty('--branch', key !== '' && key !== null ? `var(--branch-${key})` : '');
      tab.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        showPane(id);
      });
      return tab;
    }));
  }
}

// A pane brought on screen (its tab shown), made active and given the keyboard.
function showPane(id) {
  if (!docks.visible(id)) {
    docks.show(id);
    renderDock();
  }
  activate(id);
  views.get(id)?.body.focus();
}

// The splitter of a side area: dragging it sets the area's size.
function areaSplitter(side) {
  const bar = document.createElement('div');
  bar.className = `splitter ${side === 'left' || side === 'right' ? 'splitter-col' : 'splitter-row'}`;
  bar.addEventListener('mousedown', e => {
    e.preventDefault();
    const across = side === 'left' || side === 'right';
    const start = across ? e.clientX : e.clientY, size = docks.sizes[side];
    const sign = side === 'left' || side === 'top' ? 1 : -1;
    const el = document.querySelector(`.dock-${side}`);
    const move = m => {
      docks.sizes[side] = Math.max(80, size + sign * ((across ? m.clientX : m.clientY) - start));
      el.style[across ? 'width' : 'height'] = `${docks.sizes[side]}px`;
    };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
  });
  return bar;
}

// The splitter between two nodes of a split: dragging it moves share from one to the other.
function splitSplitter(split, k) {
  const bar = document.createElement('div');
  bar.className = `splitter ${split.dir === 'row' ? 'splitter-col' : 'splitter-row'}`;
  bar.addEventListener('mousedown', e => {
    e.preventDefault();
    const row = split.dir === 'row';
    const before = bar.previousElementSibling, after = bar.nextElementSibling;
    const a = before.getBoundingClientRect(), b = after.getBoundingClientRect();
    const total = row ? a.width + b.width : a.height + b.height;
    const shares = split.shares[k - 1] + split.shares[k];
    const start = row ? e.clientX : e.clientY, first = row ? a.width : a.height;
    const move = m => {
      const size = Math.min(total - 60, Math.max(60, first + (row ? m.clientX : m.clientY) - start));
      split.shares[k - 1] = shares * size / total;
      split.shares[k] = shares - split.shares[k - 1];
      before.style.flexGrow = split.shares[k - 1];
      after.style.flexGrow = split.shares[k];
    };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
  });
  return bar;
}

async function start(paths) {
  const tree = newRootPane(paths[0]);
  const list = newChildPane(tree.id);
  await tree.ready;
  list.body.focus();
}

// A new root: a tree of folders (3.4, New pane), in the left area, on `path` or else This PC.
function newRootPane(path) {
  const id = layout.add({ kind: 'tree', content: 'folders' });
  const tree = placeView(new TreeView(id), { area: 'left' });
  activate(id);
  tree.ready = tree.init().then(() => path ? tree.reveal(path) : tree.select(ThisPC));
  return tree;
}

// Where a new child goes (plan 12 3.2): 'right' or 'below' its parent, or as a 'tab' in the parent's group. A child of
// a pane in a side area goes to the center when it is to be at the right (the default layout: tree left, list center).
function childPlace(parentId, where) {
  if (where === 'tab') return { pane: parentId, side: 'tab' };
  if (where === 'below') return { pane: parentId, side: 'bottom' };
  const area = docks.areaOf(parentId);
  if (area && area !== 'center') {
    const centerPanes = docks.groups().filter(g => g.area === 'center').flatMap(g => g.group.panes);
    return centerPanes.length ? { pane: centerPanes.at(-1), side: 'right' } : { area: 'center' };
  }
  return { pane: parentId, side: 'right' };
}

// A new child of a pane (3.4, New child pane), with the settings of the parent's current child; it shows what the
// parent focuses.
function newChildPane(parentId, where = 'right') {
  const id = layout.add({ source: parentId, ...layout.childSettings(parentId) });
  const view = placeView(new ListView(id), childPlace(parentId, where));
  // Its branch active first (a new one starts from a copy of the parent's state), then it shows the parent's focused
  // item when that is a folder (3.3); the other branches' children stay as they are.
  activate(id);
  followParent(id);
  drawHeads();
  return view;
}

// A child shows what its parent focuses, when that is a folder.
function followParent(id) {
  const parentId = layout.pane(id)?.source;
  if (parentId == null) return;
  const focus = layout.state(parentId).focus;
  const parent = views.get(parentId);
  const folder = parent instanceof TreeView || !!parent?.entries?.find(x => same(x.id, focus))?.folder;
  if (focus && folder) apply(layout.follow(parentId, { id: focus, folder: true }).filter(u => u.pane === id));
}

// Closes a pane (3.4): its children get its parent; with none left, New pane makes one.
function closePane(id) {
  const view = views.get(id);
  if (!view) return;
  if (view === preview) {
    preview.close();
    preview = null;
  }
  view.el.remove();
  views.delete(id);
  iconUsers.delete(view);
  layout.remove(id);
  docks.remove(id);
  renderDock();
  activePane = null;
  const next = docks.panes().find(p => docks.visible(p) && views.get(p));
  if (next) {
    activate(next);
    views.get(next).body.focus();
  } else status('No panes left: New pane (View > Panes, Ctrl+Alt+Shift+N) makes one.');
  drawHeads();
  ribbonRefresh();
}

// The preview pane (Preview on the ribbon, Alt+P): a child of the active list, or of the first list, at its right.
function togglePreview() {
  if (preview) return closePane(preview.id);
  const list = activeView() instanceof ListView ? activeView() : [...views.values()].find(v => v instanceof ListView);
  if (!list) return status('A preview follows a list: make one with New child pane.', true);
  const id = layout.add({ source: list.id, kind: 'preview' });
  preview = placeView(new PreviewView(id), { pane: list.id, side: 'right' });
  preview.show(layout.state(list.id).focus);
  drawHeads();
}
function cyclePane(step) {
  const order = docks.panes().filter(id => docks.visible(id) && views.get(id));
  const next = order[(order.indexOf(activePane) + step + order.length) % order.length];
  views.get(next)?.body.focus();
}

// ---------- Folders shown are watched (3.8) ----------

// The host is told which folders this window shows (every list's folder, the folders open in a tree), once that rests.
let watchTimer = 0, watchedNow = '';
function tellWatched() {
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    const folders = new Set();
    for (const v of views.values()) {
      if (v instanceof ListView && v.location) folders.add(v.location);
      if (v instanceof TreeView) for (const n of v.flat) if (n.expanded) folders.add(n.id);
    }
    const list = [...folders].sort();
    if (list.join('|') === watchedNow) return;
    watchedNow = list.join('|');
    post({ op: 'watch', folders: list });
  }, 500);
}

// A folder shown changed on disk: the lists showing it read it again where they are, a tree its subfolders.
function folderChanged(folder) {
  for (const v of views.values()) {
    if (v instanceof ListView && same(v.location, folder)) v.reread();
    if (v instanceof TreeView) {
      const n = v.node(folder);
      if (n?.children) {
        n.children = null;
        v.expand(n, n.expanded);
      }
    }
  }
}

// ---------- Between panes, and back and forward per branch (3.6) ----------

// The pane chain of the active branch: the root above the active pane, then down the active branch from there (each
// pane's first child of the colour it shows), previews left out. Its key: the root's child it goes through (each tab,
// each branch of the root, has its own history), or the root itself.
function branchChain(id) {
  let top = id;
  while (layout.pane(top)?.source != null) top = layout.pane(top).source;
  const chain = [top];
  for (let p = top; ;) {
    const next = layout.followers(p, layout.keyOf(p)).find(f => f.kind !== 'preview');
    if (!next) break;
    chain.push(next.id);
    p = next.id;
  }
  return { key: chain[1] ?? chain[0], chain };
}

const histories = new Map();   // branch key -> { steps: [snapshot], at }
let recordTimer = 0, restoring = false;

const snapshot = chain => chain.map(id => {
  const s = layout.state(id);
  return { id, location: s.location, focus: s.focus, selection: [...s.selection] };
});
// The folders of a step: where each pane is (for a tree: the folder it focuses, which its children show).
const placesOf = step => step.map(x => `${x.id}=${(views.get(x.id) instanceof TreeView ? x.focus : x.location) ?? ''}`.toLowerCase()).join('|');

// Something moved in the active branch: once things rest, the branch as it is now is its current step when the folders
// are the same (a selection made there is kept with it), else a new step (a step forward from where back left it drops
// the steps after it, as a browser does).
function recordStep() {
  if (restoring || activePane === null) return;
  clearTimeout(recordTimer);
  recordTimer = setTimeout(() => {
    const { key, chain } = branchChain(activePane);
    const h = histories.get(key) ?? { steps: [], at: -1 };
    histories.set(key, h);
    const now = snapshot(chain);
    if (h.at >= 0 && placesOf(h.steps[h.at]) === placesOf(now)) {
      h.steps[h.at] = now;
      return;
    }
    h.steps.splice(h.at + 1, Infinity, now);
    if (h.steps.length > 100) h.steps.shift();
    h.at = h.steps.length - 1;
    ribbonRefresh();
  }, 400);
}

const historyOf = () => activePane === null ? null : histories.get(branchChain(activePane).key);
const canGo = step => { const h = historyOf(); return !!h && h.at + step >= 0 && h.at + step < h.steps.length; };

// One step back or forward: every pane of the branch as it was then.
function goHistory(step) {
  const h = historyOf();
  if (!h || !canGo(step)) return;
  h.at += step;
  restoring = true;
  for (const s of h.steps[h.at]) {
    if (!layout.pane(s.id)) continue;
    Object.assign(layout.state(s.id), { location: s.location, focus: s.focus, selection: [...s.selection] });
    const v = views.get(s.id);
    if (v instanceof TreeView && s.focus) v.reveal(s.focus);
    else v?.restore();
  }
  setTimeout(() => { restoring = false; }, 600);   // the follows the restore sets off are not new steps
  ribbonRefresh();
}

// To the parent, to the child in the active branch, to the next branch of the parent (the keys of 3.6).
function focusPane(id) {
  if (id && views.get(id)) views.get(id).body.focus();
}

function nextBranch() {
  const pane = layout.pane(activePane);
  if (!pane) return;
  const parent = pane.source ?? activePane;
  const colours = [...new Set(layout.followers(parent).map(f => f.colour))];
  if (colours.length < 2) return;
  const next = colours[(colours.indexOf(layout.keyOf(parent)) + 1) % colours.length];
  focusPane(layout.followers(parent, next)[0].id);
}

// ---------- Detach, attach, branch colour, pin (plan 12 3.2; plan 03 3.4) ----------

// A child stops following: a root on what it shows; a list then opens folders in itself.
function detachPane(id) {
  if (!layout.detach(id)) return;
  activePane = null;
  activate(id);
  drawHeads();
  ribbonRefresh();
}

// A pane follows another from now on, and shows what that one focuses when it is a folder.
function attachPane(id, target) {
  if (id === target) return;
  if (!layout.attach(id, target)) return status('That would connect the pane to itself, through its children.', true);
  activePane = null;
  activate(id);
  const focus = layout.state(target).focus;
  const parent = views.get(target);
  if (focus && (parent instanceof TreeView || parent.entries?.find(x => same(x.id, focus))?.folder))
    apply(layout.follow(target, { id: focus, folder: true }));
  drawHeads();
  ribbonRefresh();
}

// Another branch colour for a child: a free one, a branch of its own; a sibling's, it joins that branch.
function setBranchColour(id, colour) {
  const pane = layout.pane(id);
  if (!pane?.source) return;
  apply(layout.setColour(id, colour));
  views.get(pane.source)?.restore();
  drawHeads();
  ribbonRefresh();
}

function togglePin(id) {
  const pane = layout.pane(id);
  if (!pane?.source) return;
  pane.pinned = !pane.pinned;
  // Unpinned: it catches up with what its parent focuses.
  const focus = layout.state(pane.source).focus;
  if (!pane.pinned && focus) apply(layout.follow(pane.source, { id: focus, folder: !!views.get(pane.source)?.node?.(focus) || !!views.get(pane.source)?.entries?.find(x => same(x.id, focus))?.folder }).filter(u => u.pane === id));
  drawHeads();
  ribbonRefresh();
}

// The connector in a child's head (or any head): dragged onto another pane, this pane becomes its child.
function dragConnector(id, e) {
  e.preventDefault();
  e.stopPropagation();
  const paneAt = m => document.elementFromPoint(m.clientX, m.clientY)?.closest('.pane')?.dataset.pane ?? null;
  let over = null;
  const mark = to => {
    if (over) views.get(over)?.el.classList.remove('drop-target');
    over = to && to !== id ? to : null;
    if (over) views.get(over)?.el.classList.add('drop-target');
  };
  const move = m => mark(paneAt(m));
  const up = m => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    const target = paneAt(m);
    mark(null);
    document.body.classList.remove('connecting');
    if (target && target !== id) attachPane(id, target);
  };
  document.body.classList.add('connecting');
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
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
    for (const [i, url] of Object.entries(m.icons)) if (url) icons.set(`${m.size ?? 16}:${i}`, url);
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
  folderChanged(m) { folderChanged(m.folder); },
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
// The focus in another window: the active pane's ring and head dimmed (app.css), as LexPen's.
addEventListener('blur', () => document.body.toggleAttribute('data-focus-away', true));
addEventListener('focus', () => document.body.toggleAttribute('data-focus-away', false));
darkQuery.addEventListener('change', applyTheme);
post({ op: 'ready' });
