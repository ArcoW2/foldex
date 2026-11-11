// The page of a Foldex window. It asks the host ({ op, ... }) and is told ({ event, ... }); see MainForm.cs.
// The panes of plan 03 (docs/plans/executed/03-PLAN-connected-panes.md): panes.js decides what each pane shows, this file draws
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
let version = '';  // Foldex's, for F1 (palette.js)

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
  // The columns' widths are in em of the pane font (plan 11 3.4): the headers follow a new font size.
  for (const v of views.values()) if (v.colhead) v.drawHeader();
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

// Icons grow with the rows (docs/plans/executed/08-PLAN-fonts.md 3.4): drawn at a size that follows the row height, from the
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

function iconImage(entry, missing, source = iconSource) {
  const img = document.createElement('img');
  const key = `${source}:${entry.icon}`;
  const stand = icons.get(key) ?? IconSources.map(s => icons.get(`${s}:${entry.icon}`)).find(u => u);
  if (stand) img.src = stand;
  if (!icons.has(key) && entry.icon >= 0 && !iconsAsked.has(key)) { iconsAsked.add(key); missing.push(entry.icon); }
  return img;
}

function askIcons(missing, own, source = iconSource) {
  if (missing.length) post({ op: 'icons', indexes: missing, size: source });
  if (own.length) post({ op: 'ownIcons', ids: own });
}

// ---------- Listings: per channel (a pane, a tree node); a new one on a channel replaces the old ----------

let lastReq = 0;
const listeners = new Map();

// `tree`: a tree's listing, whose folders say whether they have subfolders and files (their expanders, plan 18 3.4).
function list(channel, location, foldersOnly, onPart, onDone, elevated = false, tree = false) {
  const req = ++lastReq;
  listeners.set(channel, { req, onPart, onDone, sent: performance.now() });
  post({ op: elevated ? 'listElevated' : 'list', channel, location, foldersOnly, tree, req });
}

// A pane's own view settings (plan 03 3.1). Hidden items: its own choice, else the setting showHidden. A filter:
// wildcards for files ("*.cs;*.md"), folders always shown.
const showsHidden = id => layout.pane(id)?.hidden ?? !!settings.showHidden;

function filterTest(pattern) {
  const parts = (pattern ?? '').split(/[;,]/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return () => true;
  const res = parts.map(p => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'));
  return x => x.folder !== false || res.some(re => re.test(x.name));
}

// The view of a pane as its kind says: a tree, a list or a preview.
function makeView(id) {
  const kind = layout.pane(id).kind;
  return kind === 'tree' ? new TreeView(id) : kind === 'preview' ? new PreviewView(id) : new ListView(id);
}

// ---------- Rows in view only ----------

let RowHeight = 22;   // follows the pane font (look.js paneRowHeight; docs/plans/executed/08-PLAN-fonts.md 3.4)

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
  // A child's own round (the pin) left of the name; at the right only the marks of the branches it feeds.
  el.innerHTML = '<div class="head"><span class="connector" title="Drag onto another pane to follow it"></span>' +
    '<button class="pin" title="Pin: stop following the parent"></button><span class="title"></span><span class="marks"></span></div>' +
    '<div class="body" tabindex="0"><div class="rows"></div></div>';
  el.querySelector('.title').textContent = title;
  el.querySelector('.connector').addEventListener('mousedown', e => { activate(id); dragConnector(id, e); });
  el.querySelector('.pin').addEventListener('click', () => togglePin(id));
  // The head dragged: the pane moves to another dock place (not from the connector, the pin or the branch marks).
  el.querySelector('.head').addEventListener('mousedown', e => {
    if (!e.target.closest('.connector, .pin, .marks span')) dragToDock(id, e);
  });
  el.querySelector('.head').addEventListener('contextmenu', e => openPaneMenu(id, e));
  el.addEventListener('mousedown', e => { if (e.button < 3) activate(id); }, true);   // not the mouse's back and forward
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
  drawHeads();   // and the tabs (drawTabs): the active pane's tab is the bright one
  showLocation(views.get(id)?.locationText() ?? '');
}

// Each head in the colour of the path it serves (Layout.pathColour); a parent has a mark per branch it feeds, in the order the branches were made (the
// first rightmost, app.css), so a mark keeps its place; the active one full and larger. A click switches to one.
function drawHeads() {
  tellLayout();
  // The panes of the active pane's branch (its parents and the children down that branch), for their background.
  const branch = activePane !== null && layout.pane(activePane) ? branchChain(activePane).chain : [];
  for (const v of views.values()) {
    const pane = layout.pane(v.id);
    v.el.classList.toggle('in-branch', v.id !== activePane && branch.includes(v.id));
    const key = layout.pathColour(v.id);
    v.el.style.setProperty('--branch', key !== null ? `var(--branch-${key})` : '');
    // Its pane theme inside it (plan 13 3.4): the page's own variables, so every rule in the pane follows.
    for (const name of ['bg', 'bg-side', 'select', 'hover', 'accent', 'text'])
      v.el.style.setProperty(name === 'text' ? '--branch-text' : `--${name}`, key !== null ? `var(--branch-${key}-${name})` : '');
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

// Followers take what a pane focused once the cursor rests (3.3, debounce): followDelay ms, 0 to 1000.
const followDelay = () => Math.min(1000, Math.max(0, Number(settings.followDelay ?? 150) || 0));
const focusTimers = new Map();

function focusItem(paneId, item) {
  layout.state(paneId).focus = item ? item.id : null;
  clearTimeout(focusTimers.get(paneId));
  focusTimers.set(paneId, setTimeout(() => apply(layout.focus(paneId, item)), followDelay()));
}

function apply(updates) {
  for (const u of updates) {
    const v = views.get(u.pane);
    if (!v) continue;
    if ('location' in u) {
      if (u.recalled) v.back = { selection: [...layout.state(u.pane).selection] };   // after Back: its selection too
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

// ---------- A tree (3.5; plan 18): of folders, or folders and files, with the columns of a list ----------

// A pane's tree. Without a parent: the tree's tops (your profile folder, This PC, Network, the Recycle Bin). As a child
// (plan 18 3.3): the items of the folder its parent focuses, without a row for that folder (its head names it); the
// lines start at the head and every row is one level in. Show (plan 18 3.2): folders, or folders and files; a file is a
// row without an expander.
class TreeView {
  constructor(id) {
    this.id = id;
    this.nodes = new Map();   // lower-case id -> node
    this.top = [];
    this.flat = [];
    this.folder = layout.pane(id).source !== null;   // a child: its parent's folder
    this.root = null;                                  // that folder
    this.el = paneElement(id, 'tree', 'Folders');
    this.body = this.el.querySelector('.body');
    this.rows = this.el.querySelector('.rows');
    // The columns, as a list's (plan 11; plan 18 3.3): the pane's generic ones, the tree in the first.
    this.colhead = document.createElement('div');
    this.colhead.className = 'colhead';
    this.body.before(this.colhead);
    this.colhead.addEventListener('contextmenu', e => {
      e.preventDefault();
      openMenu(e.clientX, e.clientY, columnHeaderMenu(this));
    });
    this.cols = paneColumns(id);
    this.drawHeader();
    this.body.addEventListener('scroll', () => {
      this.colhead.firstChild?.style.setProperty('transform', `translateX(${-this.body.scrollLeft}px)`);
      this.render();
    });
    this.body.addEventListener('mousedown', e => this.click(e));
    this.body.addEventListener('dblclick', e => {
      const n = this.nodeAt(e.target);
      if (!n || e.target.classList.contains('twisty')) return;
      if (n.folder === false) return execute(this.id, { id: n.id, folder: false });   // a file opens
      // Opened in the tree itself as well as in its children; a child tree opens it only in itself (its parent stays).
      if (this.folder) return this.expand(n, !n.expanded);
      if (!n.expanded) this.expand(n);
      execute(this.id, { id: n.id, folder: true });
    });
    this.body.addEventListener('keydown', e => this.key(e));
    this.body.addEventListener('contextmenu', e => {
      e.preventDefault();
      const n = this.nodeAt(e.target);
      if (n) post({ op: 'menu', ids: [n.id], x: e.clientX * devicePixelRatio, y: e.clientY * devicePixelRatio, extended: e.shiftKey });
    });
    dropTarget(this.body, e => { const n = this.nodeAt(e.target); return n?.folder === false ? n.parent?.id ?? this.root : n?.id ?? this.root; });
    iconUsers.add(this);
    // Made shorter (the ribbon or the status line coming in, the window resized): the focused folder, in view at the
    // old height, stays in view.
    let height = 0;
    new ResizeObserver(() => {
      const before = height;
      height = this.body.clientHeight;
      if (this.cols.fit && this.flat.length) this.fitColumns();
      if (height >= before) return;
      const i = this.flat.findIndex(x => same(x.id, layout.state(this.id).focus));
      const top = i * RowHeight - this.body.scrollTop;
      if (i >= 0 && top >= 0 && top + RowHeight <= before) scrollIntoView(this.body, i);
    }).observe(this.body);
  }

  // Files shown (plan 18 3.2): Folders and files; Files alone is not for a tree.
  showsFiles() { return layout.pane(this.id).content !== 'folders'; }

  node(id) { return id == null ? undefined : this.nodes.get(id.toLowerCase()); }

  add(entry, parent) {
    const known = this.node(entry.id);
    if (known) {
      if (!known.children) Object.assign(known, { subs: entry.subs, files: entry.files });   // it may have got or lost some
      return known;
    }
    const n = { ...entry, parent, children: null, expanded: false, depth: parent ? parent.depth + 1 : this.folder ? 1 : 0 };
    this.nodes.set(entry.id.toLowerCase(), n);
    return n;
  }

  // Ready to show: the tops, or (a child) its folder.
  init() {
    if (this.folder) return this.load(layout.state(this.id).location);
    return new Promise(done => {
      described.set(++lastReq, entries => {
        this.top = entries.map(e => this.add(e, null));
        this.flatten();
        done();
      });
      post({ op: 'describe', ids: TreeTop, req: lastReq });
    });
  }

  // A child tree on a folder (following its parent, as a list loads one): its items as the top rows, its focus back
  // when it is there.
  load(location) {
    this.root = location;
    this.nodes.clear();
    this.top = [];
    this.flatten();
    this.el.querySelector('.title').textContent = location ?? '';
    if (activePane === this.id) showLocation(this.locationText());
    if (!location) return Promise.resolve();
    return new Promise(done => {
      const kids = [];
      list(`tree:${this.id}:`, location, !this.showsFiles(), part => kids.push(...part), m => {
        if (this.root !== location) return done();
        this.top = kids.concat(m.entries).sort(this.comparer()).map(e => this.add(e, null));
        this.name = m.name;
        this.el.querySelector('.title').textContent = m.name;
        if (m.error) status(`${m.name}: ${m.error}`, true);
        this.flatten();
        drawTabs();
        this.askColumnValues();
        const focus = layout.state(this.id).focus;
        (focus ? this.reveal(focus, true) : Promise.resolve()).then(done);
      }, false, true);
    });
  }

  // Loads a node's items (once); resolves when they are there.
  loadNode(n) {
    if (n.children) return Promise.resolve();
    if (n.loading) return n.loading;
    n.loading = new Promise(done => {
      const kids = [];
      list(`tree:${this.id}:${n.id}`, n.id, !this.showsFiles(), part => kids.push(...part), m => {
        n.children = kids.concat(m.entries).sort(this.comparer()).map(e => this.add(e, n));
        n.error = m.error;
        n.loading = null;
        this.flatten();
        this.askColumnValues();
        done();
      }, false, true);
    });
    return n.loading;
  }

  // A folder changed on disk (3.8): its items read again beside the ones shown, put in only when the names differ (a
  // folder's own date changing, as a watcher also reports, changes nothing); the focused row stays where it is on
  // screen. `n` null: a child tree's own folder.
  reread(n) {
    const kids = [];
    const at = n ? n.id : this.root;
    if (!at) return;
    list(`tree:${this.id}:${n ? n.id : ''}`, at, !this.showsFiles(), part => kids.push(...part), m => {
      if (m.error) return;
      const parent = n ?? null;
      const shown = n ? n.children : this.top;
      const next = kids.concat(m.entries).sort(this.comparer()).map(e => this.add(e, parent));
      if (shown && next.length === shown.length && next.every((c, k) => c === shown[k])) return;
      const focus = this.node(layout.state(this.id).focus);
      const offset = focus ? this.flat.indexOf(focus) * RowHeight - this.body.scrollTop : 0;
      for (const gone of shown ?? []) if (!next.includes(gone)) this.nodes.delete(gone.id.toLowerCase());
      if (n) n.children = next;
      else this.top = next;
      this.flatten();
      const i = focus ? this.flat.indexOf(focus) : -1;
      if (i >= 0) {
        this.body.scrollTop = i * RowHeight - offset;
        this.render();
      }
    }, false, true);
  }

  async expand(n, open = true) {
    if (n.folder === false) return;
    if (open) await this.loadNode(n);
    n.expanded = open;
    this.flatten();
  }

  toggle(id) {
    const n = this.node(id);
    if (n) this.expand(n, !n.expanded);
  }

  flatten() {
    this.flat = [];
    const hidden = showsHidden(this.id), filter = filterTest(layout.pane(this.id).filter);
    const walk = list => {
      for (const n of list) {
        if (n.hidden && !hidden && n.depth > 0) continue;
        if (!filter(n)) continue;
        this.flat.push(n);
        if (n.expanded && n.children) walk(n.children);
      }
    };
    walk(this.top);
    const guides = treeGuides(this.flat.map(n => n.depth));
    this.flat.forEach((n, i) => { n.guides = guides[i]; });
    this.render();
    tellWatched();
  }

  // Whether a node gets an expander: a folder with something to show (plan 16; plan 18 3.4): its items once read, else
  // what the listing said (subs, and with files shown files: true, 'hidden' or false; absent, as for the tops: unknown,
  // so it gets one).
  hasItems(n) {
    if (n.folder === false) return false;
    const hidden = showsHidden(this.id);
    if (n.children) return n.children.some(c => hidden || !c.hidden);
    const some = v => v === undefined || v === true || (v === 'hidden' && hidden);
    return some(n.subs) || (this.showsFiles() && n.files !== null && some(n.files));
  }

  render() {
    const fontPx = this.fontPx();
    const cols = this.cols.columns.map(c => ({ ...columnInfo(c.id), width: (c.width ?? columnInfo(c.id).width) * fontPx }));
    this.rows.style.height = `${this.flat.length * RowHeight}px`;
    this.rows.style.width = `${cols.reduce((a, c) => a + c.width, 0)}px`;
    const [first, last] = visibleRange(this.body, this.flat.length);
    const focus = layout.state(this.id).focus;
    const missing = [], nodes = [], noProps = [];
    const propNames = cols.filter(c => c.id.includes('.')).map(c => c.id);
    for (let i = first; i < last; i++) {
      const n = this.flat[i];
      if (propNames.length && propNames.some(p => !(n.props && p in n.props)) && !n.propsAsked && /^[A-Za-z]:\\|^\\\\/.test(n.id)) {
        n.propsAsked = true;
        noProps.push(n);
      }
      const row = document.createElement('div');
      row.className = 'row cols' + (same(n.id, focus) ? ' selected focused' : '') + (n.hidden ? ' hidden' : '') + (i % 2 ? ' odd' : '');
      row.style.top = `${i * RowHeight}px`;
      row.dataset.index = i;
      cols.forEach((c, k) => {
        const cell = document.createElement('span');
        cell.className = k === 0 ? 'cell first' : 'cell' + (RightAligned.has(c.kind) ? ' right' : '') + (c.id === 'git' && n.git ? ` git-${n.git === '!' ? 'conflict' : n.git}` : '');
        cell.style.width = `${c.width}px`;
        if (k > 0) cell.textContent = columnText(n, c.id);
        else {
          cell.style.paddingLeft = `${8 + n.depth * 14}px`;
          const twisty = document.createElement('span');
          const leaf = !this.hasItems(n);
          // The expanders as the setting treeExpanders says (plan 16 3.1): + and -, or a chevron drawn by app.css.
          if (settings.treeExpanders === 'chevron') twisty.className = 'twisty' + (leaf ? '' : n.expanded ? ' chev open' : ' chev');
          else {
            twisty.className = 'twisty';
            twisty.textContent = leaf ? '' : n.expanded ? '-' : '+';
          }
          const name = document.createElement('span');
          name.className = 'name';
          name.textContent = n.name;
          cell.append(twisty, iconImage(n, missing), name);
          if (n.link) {
            const link = document.createElement('span');
            link.className = 'link';
            link.textContent = 'link';
            cell.append(link);
          }
        }
        row.append(cell);
      });
      // Its tree lines: the expander of level k is centred at 14 + 14k px (padding 8 + 14 per level, 12 wide).
      if (n.guides) row.append(...guideElements(n.guides, k => 14 + 14 * k, 8));
      nodes.push(row);
    }
    this.rows.replaceChildren(...nodes);
    askIcons(missing, []);
    if (noProps.length) this.askProps(noProps, propNames);
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

  // A row focused: its children follow it (a folder: they show it; a file: a preview shows it).
  select(id, quiet = false) {
    const n = this.node(id);
    if (!n) return;
    if (quiet) layout.state(this.id).focus = n.id;
    else {
      focusItem(this.id, { id: n.id, folder: n.folder !== false });
      recordStep();
    }
    const i = this.flat.indexOf(n);
    if (i >= 0) scrollIntoView(this.body, i);
    this.render();
    if (activePane === this.id) showLocation(this.locationText());
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

  // Shows an item in the tree: expanded down to it and focused (`quiet`: without its children following). Paths on disk
  // are found from This PC down (a child tree: from its folder down); other places only when the tree has them already.
  async reveal(path, quiet = false) {
    const base = this.root?.replace(/\\+$/, '');
    if (!this.node(path) && this.folder && base && path.toLowerCase().startsWith(base.toLowerCase() + '\\')) {
      const parts = path.slice(base.length + 1).split('\\');
      for (let k = 0, at = base; k < parts.length - 1; k++) {
        at += '\\' + parts[k];
        const here = this.node(at);
        if (!here) break;
        await this.expand(here);
      }
    } else if (!this.node(path) && !this.folder && /^[A-Za-z]:\\/.test(path)) {
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
    this.select(path, quiet);
  }

  // Back on this pane's state for the branch now active (plan 03 3.1); from history (`back`, plan 17): its folder (a
  // child tree) and its focus, which its children follow.
  restore(back = false) {
    const s = layout.state(this.id);
    if (this.folder && !same(s.location, this.root)) {
      this.load(s.location).then(() => { if (back && s.focus) this.reveal(s.focus); });
    } else if (back && s.focus) this.reveal(s.focus);
    else this.render();
  }

  up() {
    const n = this.node(layout.state(this.id).focus);
    if (n?.parent) this.select(n.parent.id);
    else if (this.folder && this.root) goTo(this.id, parentOf(this.root));
  }

  // The focused folder's items read again (a child tree on nothing focused: its folder).
  refresh() {
    const n = this.node(layout.state(this.id).focus);
    if (!n || n.folder === false) {
      if (this.folder) this.load(this.root);
      return;
    }
    n.children = null;
    this.expand(n, n.expanded);
  }

  // Show changed (plan 18 3.2): read again, the focus kept.
  reshow() {
    const focus = layout.state(this.id).focus;
    if (this.folder) return this.load(this.root);
    this.nodes.clear();
    this.top = [];
    this.ready = this.init().then(() => focus ? this.reveal(focus, true) : null);
  }

  locationText() { return layout.state(this.id).focus ?? this.root ?? ''; }

  tabTitle() { return this.folder ? this.name ?? (this.root ?? '').split('\\').filter(x => x).pop() ?? 'Folders' : 'Folders'; }

  // ---------- Columns (plan 11; plan 18 3.3): the pane's generic ones; no set per folder for a tree ----------

  fontPx() { return parseFloat(getComputedStyle(this.body).fontSize) || 13; }

  chooseColumns() { }

  drawHeader() { drawColumnHeader(this); }

  columnsChanged() {
    this.drawHeader();
    this.askColumnValues();
    this.render();
    tellLayout();
  }

  comparer() {
    const sort = this.cols.sort;
    return sort ? columnComparer(sort.id, columnInfo(sort.id).kind, sort.desc) : byName;
  }

  // Sorted again: every level read so far.
  async sortEntries() {
    const sort = this.cols.sort;
    if (sort?.id.includes('.')) {
      const missing = [...this.nodes.values()].filter(n => !(n.props && sort.id in n.props) && /^[A-Za-z]:\\|^\\\\/.test(n.id));
      if (missing.length) await this.askProps(missing, [sort.id]);
    }
    const compare = this.comparer();
    if (this.folder) this.top.sort(compare);
    for (const n of this.nodes.values()) n.children?.sort(compare);
    this.flatten();
  }

  // The Git status of the folders read so far (once each), when the Git column is there.
  askColumnValues() {
    if (!this.cols.columns.some(c => c.id === 'git')) return;
    const top = this.folder && this.root && this.gitRootAsked !== this.root ? [{ id: this.root, top: true }] : [];
    for (const f of [...top, ...[...this.nodes.values()].filter(n => n.children)]) {
      if (f.gitAsked || !/^[A-Za-z]:\\|^\\\\/.test(f.id)) continue;
      f.gitAsked = true;
      if (f.top) this.gitRootAsked = this.root;
      askHost({ op: 'git', folder: f.id }).then(m => {
        if (!m.status) return;
        for (const c of f.top ? this.top : f.children ?? []) c.git = m.status[c.name] ?? null;
        this.render();
      });
    }
  }

  askProps(items, names) { return ListView.prototype.askProps.call(this, items, names); }

  // Fit columns (Ctrl+R): as a list's, the name column counting each row's indent and expander.
  fitColumns() {
    const measure = document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(this.body);
    measure.font = `${style.fontSize} ${style.fontFamily}`;
    const fontPx = this.fontPx(), pad = 14;
    const rows = this.flat.slice(0, 5000);
    const needs = this.cols.columns.map((col, k) => {
      let widest = measure.measureText(columnInfo(col.id).title).width + 16;
      for (const n of rows) widest = Math.max(widest, k === 0
        ? measure.measureText(n.name).width + n.depth * 14 + 12 + iconSize + 12 + (n.link ? measure.measureText(' link').width : 0)
        : measure.measureText(columnText(n, col.id)).width);
      return widest + pad;
    });
    const widths = fitWidths(needs, this.body.clientWidth - 2, NameMinEm * fontPx);
    this.cols.columns.forEach((col, k) => { col.width = Math.round(widths[k] / fontPx * 10) / 10; });
    this.drawHeader();
    this.render();
    tellLayout();
  }
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
    // The columns' header above the rows (plan 11 3.4), moving along when the rows scroll sideways.
    this.colhead = document.createElement('div');
    this.colhead.className = 'colhead';
    this.body.before(this.colhead);
    this.colhead.addEventListener('contextmenu', e => {
      e.preventDefault();
      openMenu(e.clientX, e.clientY, columnHeaderMenu(this));
    });
    this.cols = paneColumns(id);
    this.drawHeader();
    this.colhead.hidden = this.iconsView();
    this.body.addEventListener('scroll', () => {
      this.colhead.firstChild?.style.setProperty('transform', `translateX(${-this.body.scrollLeft}px)`);
      this.render();
    });
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
    new ResizeObserver(() => {
      this.render();
      if (this.cols.fit && this.entries.length) this.fitColumns();
    }).observe(this.body);
    iconUsers.add(this);
  }

  ids() { return this.entries.filter(x => this.selected.has(x.id)).map(x => x.id); }

  // ---------- Columns (plan 11) ----------

  fontPx() { return parseFloat(getComputedStyle(this.body).fontSize) || 13; }

  // The columns for where it is (3.2): a folder's set when it (or a folder above it, with its subfolders) has one,
  // else the pane's own generic columns. `again`: the sets changed; a set shown is taken fresh.
  chooseColumns(again = false) {
    const choice = setFor(columnSets.folders, this.location);
    const set = choice && setNamed(choice.set);
    const before = this.cols;
    if (set) {
      if (again || before.set !== set.name) this.cols = { ...copyColumns(set), set: set.name };
    } else this.cols = paneColumns(this.id);
    if (this.cols !== before) {
      this.drawHeader();
      if (again) {
        this.askColumnValues();
        this.sortEntries();
      }
    }
  }

  drawHeader() { drawColumnHeader(this); }

  // A change in the header: drawn again; the pane's generic columns (not a folder's set) go with the layout.
  columnsChanged() {
    this.drawHeader();
    this.askColumnValues();
    this.render();
    if (!this.cols.set) tellLayout();
  }

  comparer() {
    const sort = this.cols.sort;
    return sort ? columnComparer(sort.id, columnInfo(sort.id).kind, sort.desc) : byName;
  }

  // Sorted again (a click on a title): by a property of Windows, its value is read for every item first.
  async sortEntries() {
    const sort = this.cols.sort;
    if (sort?.id.includes('.')) {
      const missing = this.entries.filter(x => !(x.props && sort.id in x.props) && !x.propsAll);
      if (missing.length) {
        status(`Reading ${columnInfo(sort.id).title} of ${missing.length} items to sort by it...`);
        await this.askProps(missing, [sort.id]);
        for (const x of missing) x.propsAll = true;
        status(`${this.name ?? ''}: ${this.entries.length} items`);
      }
    }
    this.entries.sort(this.comparer());
    this.render();
  }

  // The values that are not in the listing: the Git status of the folder's items, Windows' properties for the rows in
  // view (as they come).
  askColumnValues() {
    if (this.cols.columns.some(c => c.id === 'git') && this.location && !this.gitAsked && /^[A-Za-z]:\\|^\\\\/.test(this.location)) {
      this.gitAsked = true;
      const at = this.location;
      askHost({ op: 'git', folder: at }).then(m => {
        if (this.location !== at || !m.status) return;
        for (const x of this.entries) x.git = m.status[x.name] ?? null;
        if (this.cols.sort?.id === 'git') this.entries.sort(this.comparer());
        this.render();
      });
    }
  }

  askProps(items, names) {
    const ids = items.map(x => x.id);
    const byId = new Map(items.map(x => [x.id, x]));
    const batches = [];
    for (let k = 0; k < ids.length; k += 100) batches.push(askHost({ op: 'props', ids: ids.slice(k, k + 100), names }).then(m => {
      for (const [id, values] of Object.entries(m.values)) {
        const x = byId.get(id);
        if (x) x.props = { ...x.props, ...Object.fromEntries(names.map(n => [n, values[n] ?? null])) };
      }
      this.render();
    }));
    return Promise.all(batches);
  }

  // Fit columns (3.4, Ctrl+R): each column as wide as its widest value here; too wide, the name gives way first.
  fitColumns() {
    const measure = document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(this.body);
    measure.font = `${style.fontSize} ${style.fontFamily}`;
    const fontPx = this.fontPx(), pad = 14;
    const entries = this.entries.slice(0, 5000);
    const needs = this.cols.columns.map((col, k) => {
      let widest = measure.measureText(columnInfo(col.id).title).width + 16;
      for (const x of entries) widest = Math.max(widest, measure.measureText(k === 0 ? x.name : columnText(x, col.id)).width);
      return widest + pad + (k === 0 ? iconSize + 14 + measure.measureText(' link').width : 0);
    });
    const widths = fitWidths(needs, this.body.clientWidth - 2, NameMinEm * fontPx);
    this.cols.columns.forEach((col, k) => { col.width = Math.round(widths[k] / fontPx * 10) / 10; });
    this.drawHeader();
    this.render();
    if (!this.cols.set) tellLayout();
  }

  load(location, elevated = false) {
    this.location = location;
    this.entries = [];
    this.selected = new Set();
    this.anchor = null;
    this.message = null;
    this.body.scrollTop = 0;
    this.gitAsked = false;
    this.chooseColumns();
    this.el.querySelector('.title').textContent = location ?? '';
    if (activePane === this.id) showLocation(location ?? '');
    this.render();
    tellWatched();
    if (!location) return;
    let first = true;
    list(this.id, location, this.content() === 'folders', part => this.take(part, first && !(first = false)), m => this.done(m, first), elevated);
  }

  // Show (plan 18 3.2): folders, files or both.
  content() { return layout.pane(this.id).content ?? 'both'; }

  // The view (plan 03 3.1): details (the columns) or icons (tiles of large icons, in rows as wide as the pane).
  iconsView() { return layout.pane(this.id).view === 'icons'; }

  tile() {
    const fontPx = this.fontPx();
    const width = Math.max(80, Math.round(fontPx * 7.5));
    return { width, height: 48 + 14 + Math.round(fontPx * 2.7), perRow: Math.max(1, Math.floor(this.body.clientWidth / width)) };
  }

  // An item in view: its row of tiles, or its row.
  scrollTo(index) {
    if (!this.iconsView()) return scrollIntoView(this.body, index);
    const { height, perRow } = this.tile(), top = Math.floor(index / perRow) * height;
    if (top < this.body.scrollTop) this.body.scrollTop = top;
    else if (top + height > this.body.scrollTop + this.body.clientHeight) this.body.scrollTop = top + height - this.body.clientHeight;
  }

  renderIcons() {
    const { width, height, perRow } = this.tile();
    this.rows.style.height = `${Math.ceil(this.entries.length / perRow) * height}px`;
    this.rows.style.width = '';
    const firstRow = Math.max(0, Math.floor(this.body.scrollTop / height) - 2);
    const lastRow = Math.ceil((this.body.scrollTop + this.body.clientHeight) / height) + 2;
    const focus = layout.state(this.id).focus;
    const missing = [], own = [], nodes = [];
    for (let i = firstRow * perRow; i < Math.min(this.entries.length, lastRow * perRow); i++) {
      const x = this.entries[i];
      if (x.own) { own.push(x.id); x.own = false; }
      const tile = document.createElement('div');
      tile.className = 'tile' + (this.selected.has(x.id) ? ' selected' : '') + (same(x.id, focus) ? ' focused' : '') + (x.hidden ? ' hidden' : '');
      Object.assign(tile.style, { left: `${(i % perRow) * width}px`, top: `${Math.floor(i / perRow) * height}px`,
        width: `${width}px`, height: `${height}px` });
      tile.dataset.index = i;
      tile.draggable = true;
      tile.title = x.name;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = x.name;
      tile.append(iconImage(x, missing, 48), name);
      nodes.push(tile);
    }
    this.rows.replaceChildren(...nodes);
    askIcons(missing, own, 48);
  }

  shows(x) {
    const content = this.content();
    return content === 'files' ? !x.folder : content === 'folders' ? x.folder : true;
  }

  // Show changed: read again where it is.
  reshow() { if (this.location) this.load(this.location); }

  // The folder changed on disk (3.8): read again where it is, the selection and the scroll position kept.
  reread() {
    if (!this.location || this.message) return;
    const keep = new Set(this.selected), top = this.body.scrollTop;
    let first = true;
    this.gitAsked = false;
    list(this.id, this.location, this.content() === 'folders', part => this.take(part, first && !(first = false)), m => {
      this.done(m, first);
      this.selected = new Set([...keep].filter(id => this.entries.some(x => x.id === id)));
      layout.state(this.id).selection = [...this.selected];
      this.body.scrollTop = top;
      this.render();
    });
  }

  take(entries, reset) {
    if (reset) this.entries = [];
    const hidden = showsHidden(this.id), filter = filterTest(layout.pane(this.id).filter);
    this.entries = this.entries.concat(entries.filter(x => (hidden || !x.hidden) && this.shows(x) && filter(x))).sort(this.comparer());
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
    this.backDone();
    this.askColumnValues();
    if (this.cols.sort?.id.includes('.')) this.sortEntries();
    if (this.cols.fit) this.fitColumns();
    ribbonRefresh();
  }

  render() {
    if (this.iconsView() && !(this.message && !this.entries.length)) return this.renderIcons();
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
    // The rows as wide as the columns (a scroll bar sideways when wider than the pane), each column a cell at its
    // width; the first holds the icon, the name and a link's mark.
    const fontPx = this.fontPx();
    const cols = this.cols.columns.map(c => ({ ...columnInfo(c.id), width: (c.width ?? columnInfo(c.id).width) * fontPx }));
    this.rows.style.height = `${this.entries.length * RowHeight}px`;
    this.rows.style.width = `${cols.reduce((a, c) => a + c.width, 0)}px`;
    const [first, last] = visibleRange(this.body, this.entries.length);
    const focus = layout.state(this.id).focus;
    const missing = [], own = [], nodes = [], noProps = [];
    const propNames = cols.filter(c => c.id.includes('.')).map(c => c.id);
    for (let i = first; i < last; i++) {
      const x = this.entries[i];
      if (x.own) { own.push(x.id); x.own = false; }   // its own icon asked once, when in view
      if (propNames.length && propNames.some(n => !(x.props && n in x.props)) && !x.propsAsked) {
        x.propsAsked = true;
        noProps.push(x);
      }
      const row = document.createElement('div');
      row.className = 'row cols' + (this.selected.has(x.id) ? ' selected' : '') + (same(x.id, focus) ? ' focused' : '')
        + (x.hidden ? ' hidden' : '') + (i % 2 ? ' odd' : '');
      row.style.top = `${i * RowHeight}px`;
      row.dataset.index = i;
      row.draggable = true;
      cols.forEach((c, k) => {
        const cell = document.createElement('span');
        cell.className = k === 0 ? 'cell first' : 'cell' + (RightAligned.has(c.kind) ? ' right' : '') + (c.id === 'git' && x.git ? ` git-${x.git === '!' ? 'conflict' : x.git}` : '');
        cell.style.width = `${c.width}px`;
        if (k === 0) {
          const name = document.createElement('span');
          name.className = 'name';
          name.textContent = x.name;
          cell.append(iconImage(x, missing), name);
          if (x.link) {
            const link = document.createElement('span');
            link.className = 'link';
            link.textContent = 'link';
            cell.append(link);
          }
        } else cell.textContent = columnText(x, c.id);
        row.append(cell);
      });
      nodes.push(row);
    }
    this.rows.replaceChildren(...nodes);
    askIcons(missing, own);
    if (noProps.length) this.askProps(noProps, propNames);
  }

  entryAt(target) {
    const row = target.closest('.row, .tile');
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
    this.scrollTo(index);
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
    if (this.iconsView()) {
      // Tiles: left and right one, up and down a row of them.
      const { height, perRow } = this.tile();
      const page = perRow * Math.max(1, Math.floor(this.body.clientHeight / height) - 1);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perRow, ArrowDown: perRow, PageUp: -page, PageDown: page }[e.key];
      if (step) to(i < 0 ? 0 : i + step);
      else if (e.key === 'Home') to(0);
      else if (e.key === 'End') to(this.entries.length - 1);
      return;
    }
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

  // Back on this pane's state for the branch now active (3.1). From history (`back`, plan 17): its selection comes back
  // too, and its children follow its focused item.
  restore(back = false) {
    const s = layout.state(this.id);
    if (back) this.back = { selection: [...s.selection] };
    if (!same(s.location, this.location)) this.load(s.location);
    else {
      this.selected = new Set(s.selection);
      this.render();
      if (back) this.backDone();
    }
  }

  // After a step from history is loaded: its selection, and its children on its focused item.
  backDone() {
    const back = this.back, s = layout.state(this.id);
    this.back = null;
    if (!back) return;
    this.selected = new Set(back.selection.filter(id => this.entries.some(x => same(x.id, id))));
    s.selection = [...this.selected];
    this.render();
    const x = s.focus && this.entries.find(e => same(e.id, s.focus));
    if (x) focusItem(this.id, { id: x.id, folder: x.folder });
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
  tellLayout();
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
      tab.className = 'dock-tab' + (id === shown ? ' on' : '') + (id === activePane ? ' active' : '');
      tab.textContent = views.get(id).tabTitle();
      const pane = layout.pane(id);
      const key = layout.pathColour(id);
      tab.style.setProperty('--branch', key !== null ? `var(--branch-${key})` : '');
      tab.style.setProperty('--branch-text', key !== null ? `var(--branch-${key}-text)` : '');
      tab.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        showPane(id);
        dragToDock(id, e);
      });
      tab.addEventListener('contextmenu', e => openPaneMenu(id, e));
      return tab;
    }));
  }
}

// Moving a pane by dragging its head or its tab (plan 12 3.1): near an edge of the window, that side's area; over a
// group, its outer quarter at a side puts the pane beside it there, its middle makes it a tab in it; over an empty
// center, the center. A block shows where it lands. It starts once the mouse has moved a few pixels, so a click stays
// a click.
function dragToDock(id, e) {
  if (e.button !== 0) return;
  const x0 = e.clientX, y0 = e.clientY;
  let mark = null, place = null;
  const placeAt = (x, y) => {
    const panes = $('panes').getBoundingClientRect();
    const edge = 28;
    if (x < panes.left || x > panes.right || y < panes.top || y > panes.bottom) return null;
    if (x - panes.left < edge) return { place: { area: 'left' }, rect: [panes.left, panes.top, 120, panes.height] };
    if (panes.right - x < edge) return { place: { area: 'right' }, rect: [panes.right - 120, panes.top, 120, panes.height] };
    if (y - panes.top < edge) return { place: { area: 'top' }, rect: [panes.left, panes.top, panes.width, 100] };
    if (panes.bottom - y < edge) return { place: { area: 'bottom' }, rect: [panes.left, panes.bottom - 100, panes.width, 100] };
    const el = document.elementFromPoint(x, y);
    if (el?.closest('.dock-empty')) {
      const r = el.closest('.dock-empty').getBoundingClientRect();
      return { place: { area: 'center' }, rect: [r.left, r.top, r.width, r.height] };
    }
    const groupEl = el?.closest('.dock-group');
    const target = groupEl && [...groupEl.querySelectorAll(':scope > .pane')].map(p => p.dataset.pane).find(p => views.get(p));
    if (!target) return null;
    const own = docks.find(id)?.group;
    if (own && own.panes.includes(target) && own.panes.length === 1) return null;   // onto itself, alone: nothing to do
    const r = groupEl.getBoundingClientRect();
    const fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
    const shown = docks.find(target).group.shown ?? target;
    // The nearest edge wins (low in a group near its right side is below, not right of it); its outer quarter only.
    const near = [['left', fx], ['right', 1 - fx], ['top', fy], ['bottom', 1 - fy]].sort((a, b) => a[1] - b[1])[0];
    const rects = {
      left: [r.left, r.top, r.width / 2, r.height], right: [r.left + r.width / 2, r.top, r.width / 2, r.height],
      top: [r.left, r.top, r.width, r.height / 2], bottom: [r.left, r.top + r.height / 2, r.width, r.height / 2],
    };
    if (near[1] < 0.25) return { place: { pane: shown, side: near[0] }, rect: rects[near[0]] };
    if (own?.panes.includes(target)) return null;   // a tab into its own group: it is there already
    return { place: { pane: shown, side: 'tab' }, rect: [r.left, r.top, r.width, r.height] };
  };
  const move = m => {
    if (!mark) {
      if (Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) < 6) return;
      mark = document.createElement('div');
      mark.className = 'dock-mark';
      document.body.append(mark);
      document.body.classList.add('docking');
    }
    const at = placeAt(m.clientX, m.clientY);
    place = at?.place ?? null;
    mark.hidden = !at;
    if (at) Object.assign(mark.style, { left: `${at.rect[0]}px`, top: `${at.rect[1]}px`, width: `${at.rect[2]}px`, height: `${at.rect[3]}px` });
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    if (!mark) return;
    mark.remove();
    document.body.classList.remove('docking');
    if (!place) return;
    docks.add(id, place);
    renderDock();
    showPane(id);
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

// New tab (plan 12 3.2): a copy of the pane as a tab in its group: the same kind and settings, the same parent, in a
// new branch, so it starts on the same folder and then goes its own way. A tab of a root is a new root on its folder.
function newTab(id) {
  const pane = layout.pane(id), view = views.get(id);
  if (!pane || view instanceof PreviewView) return;
  const place = { pane: id, side: 'tab' };
  if (pane.source !== null) {
    const tab = layout.add({ source: pane.source, colour: layout.newColour(), kind: pane.kind, content: pane.content, columns: pane.columns });
    placeView(makeView(tab), place);
    activate(tab);   // its branch active: the parent's state for it starts as a copy of the one shown
    followParent(tab);
    drawHeads();
    return views.get(tab).body.focus();
  }
  if (view instanceof TreeView) return newRootPane(layout.state(id).focus, place);
  const root = layout.add({ kind: pane.kind, content: pane.content });
  placeView(new ListView(root), place);
  activate(root);
  views.get(root).reveal(view.location);
  drawHeads();
}

// The pane head's menu (plan 12 3.2), on a right-click on a head or a tab.
function paneMenu(id) {
  const pane = layout.pane(id);
  const child = pane.source !== null;
  const title = p => `${views.get(p)?.tabTitle() ?? p}${layout.pane(p).kind === 'tree' ? ' (tree)' : ''}`;
  const colourOf = p => {
    const k = layout.pane(p).source === null ? layout.keyOf(p) : layout.pane(p).colour;
    return k !== '' && k !== null ? `var(--branch-${k})` : 'var(--branch-0)';   // a root without children: the first
  };
  // The panes it can follow: not itself, not one below it (a cycle), not a preview, not its parent now.
  const below = p => { for (let q = p; q !== null; q = layout.pane(q).source) if (q === id) return true; return false; };
  const parents = docks.panes().filter(p => views.get(p) && !below(p) && layout.pane(p).kind !== 'preview' && p !== pane.source);
  const free = Branches.filter(b => !layout.followers(pane.source ?? '').some(f => f.colour === b && f.id !== id));
  return [
    { label: 'New child pane', enabled: !(views.get(id) instanceof PreviewView), items: [
      { label: 'At the right', run: () => newChildPane(id, 'right') },
      { label: 'Below', run: () => newChildPane(id, 'below') } ] },
    { label: 'New tab', enabled: !(views.get(id) instanceof PreviewView), run: () => newTab(id) },
    '-',
    { label: 'Branch', items: [
      { label: 'Detach from parent', enabled: child, run: () => detachPane(id) },
      { label: 'Attach to', enabled: parents.length > 0, items: parents.map(p => ({ label: title(p), swatch: colourOf(p), run: () => attachPane(id, p) })) },
      { label: 'Branch colour', enabled: child, items: Branches.map(b => ({
        label: `Branch ${b + 1}${free.includes(b) ? '' : ' (with a sibling)'}`, swatch: `var(--branch-${b})`, checked: pane.colour === b,
        run: () => setBranchColour(id, b) })) } ] },
    { label: 'Pin', enabled: child, checked: pane.pinned, run: () => togglePin(id) },
    '-',
    { label: 'Show', enabled: pane.kind !== 'preview', items: [['folders', 'Folders'], ['files', 'Files'], ['both', 'Folders and files']]
      .map(([content, label]) => ({ label, checked: (pane.content ?? 'both') === content,
        enabled: !(pane.kind === 'tree' && content === 'files'), run: () => setPaneContent(id, content) })) },
    { label: 'Shape', enabled: pane.kind !== 'preview', items: [['tree', 'Tree'], ['list', 'One folder']]
      .map(([kind, label]) => ({ label, checked: pane.kind === kind, run: () => setPaneShape(id, kind) })) },
    { label: 'View', enabled: pane.kind === 'list', items: [['details', 'Details'], ['icons', 'Icons']]
      .map(([view, label]) => ({ label, checked: (pane.view ?? 'details') === view, run: () => setPaneView(id, view) })) },
    { label: 'Hidden items', enabled: pane.kind !== 'preview', checked: pane.kind !== 'preview' && showsHidden(id),
      run: () => setPaneHidden(id, !showsHidden(id)) },
    { label: pane.filter ? `Filter: ${pane.filter}...` : 'Filter...', enabled: pane.kind !== 'preview', run: () => askPaneFilter(id) },
    '-',
    { label: 'Close pane', run: () => closePane(id) },
  ];
}

// The view of a one-folder pane (plan 03 3.1): details (its columns) or icons.
function setPaneView(id, view) {
  const pane = layout.pane(id), v = views.get(id);
  if (!pane || !(v instanceof ListView)) return;
  pane.view = view === 'icons' ? 'icons' : undefined;
  v.colhead.hidden = v.iconsView();
  v.body.scrollTop = 0;
  v.render();
  const i = v.entries.findIndex(x => same(x.id, layout.state(id).focus));
  if (i >= 0) v.scrollTo(i);
  tellLayout();
}

// Hidden items and a filter for one pane (plan 03 3.1): it reads or draws again.
function setPaneHidden(id, on) {
  const pane = layout.pane(id), v = views.get(id);
  if (!pane || !v || v instanceof PreviewView) return;
  pane.hidden = on;
  if (v instanceof TreeView) v.flatten();
  else v.reshow();
  drawHeads();
  tellLayout();
}

async function askPaneFilter(id) {
  const pane = layout.pane(id), v = views.get(id);
  if (!pane || !v || v instanceof PreviewView) return;
  const pattern = await askText('Filter: the files to show, as wildcards (*.cs;*.md). Empty: all of them.', pane.filter ?? '');
  if (pattern === null) return;
  pane.filter = pattern.trim() || undefined;
  if (v instanceof TreeView) v.flatten();
  else v.reshow();
  drawHeads();
  tellLayout();
}

// Show (plan 18 3.2): folders, files or both; Files is not for a tree (it needs folders to open).
function setPaneContent(id, content) {
  const pane = layout.pane(id);
  if (!pane || pane.kind === 'preview' || (pane.kind === 'tree' && content === 'files') || pane.content === content) return;
  pane.content = content;
  views.get(id)?.reshow();
  tellLayout();
}

// Shape (plan 18 3.3): a tree or one folder. A new view for the pane, the same id, connections and states; it keeps
// its place: a tree without a parent made one folder shows the folder it focused; one folder made a tree opens the
// tree down to the folder it showed. A tree showing Files shows Folders and files.
function setPaneShape(id, kind) {
  const pane = layout.pane(id), old = views.get(id);
  if (!pane || !old || pane.kind === kind || pane.kind === 'preview') return;
  const s = layout.state(id);
  const shown = old instanceof ListView ? old.location : null;
  if (kind === 'tree' && pane.content === 'files') pane.content = 'both';
  if (kind === 'list' && pane.source === null && s.focus && old.node?.(s.focus)?.folder !== false) {
    s.location = s.focus;
    s.focus = null;
  }
  pane.kind = kind;
  iconUsers.delete(old);
  const view = makeView(id);
  views.set(id, view);
  renderDock();
  if (view instanceof ListView) view.load(s.location);
  else if (view.folder) view.ready = view.init();
  else view.ready = view.init().then(() => shown ? view.reveal(shown) : s.focus ? view.reveal(s.focus) : view.select(ThisPC));
  drawHeads();
  if (activePane === id) view.body.focus();
  tellLayout();
}

function openPaneMenu(id, e) {
  e.preventDefault();
  activate(id);
  openMenu(e.clientX, e.clientY, paneMenu(id));
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

async function start(paths, saved) {
  if (saved && restoreLayout(saved, paths[0])) return;
  const tree = newRootPane(paths[0]);
  const list = newChildPane(tree.id, 'right', { area: 'center' });
  await tree.ready;
  list.body.focus();
}

// ---------- The layout kept (plan 12 3.4): told to the host, the window's session in its project (plan 15) ----------

let layoutTimer = 0;
// With each pane's name as its head and tab show it (tabTitle), for the Projects menu (plan 15 3.6).
const windowLayout = () => JSON.parse(JSON.stringify({ panes: layout.toJSON(), docks: docks.toJSON(), active: activePane,
  names: Object.fromEntries([...views].map(([id, v]) => [id, v.tabTitle()])) }));
function tellLayout() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => post({ op: 'layout', layout: windowLayout() }), 800);
}

// View > Projects > Save layout as default (plan 15 3.6): this window's panes and docks become defaultLayout in your
// settings.json, the layout a new project starts with.
function saveLayoutAsDefault() {
  const kept = windowLayout();
  for (const p of kept.panes.panes) delete p.histories;   // a new project starts without this window's history
  setSetting('defaultLayout', kept);
  status('The layout of this window is now the default for new projects (Reset layout puts a window back on it).');
}

// The panes, their connections and branch states, and the docks, as they were: a view per pane, each back on what it
// showed (a tree reveals its folder, a list loads its own). A path given on the command line goes to the first tree.
// False (nothing made) when the saved layout has no pane the docks place.
function restoreLayout(saved, path) {
  try {
    const panes = Layout.fromJSON(saved.panes);
    const placed = Docks.fromJSON(saved.docks);
    const ids = placed.panes().filter(id => panes.pane(id));
    if (!ids.length) return false;
    Object.assign(layout, { panes: panes.panes, root: panes.root, next: panes.next });
    Object.assign(docks, { areas: placed.areas, sizes: placed.sizes });
    for (const id of placed.panes()) if (!layout.pane(id)) docks.remove(id);
    for (const id of [...layout.panes.keys()]) if (!docks.find(id)) layout.remove(id);
    for (const id of docks.panes()) {
      const view = makeView(id);
      views.set(id, view);
      if (view instanceof PreviewView) preview = view;
    }
    renderDock();
    let firstTree = path ? null : true;
    for (const [id, view] of views) {
      if (view instanceof TreeView && view.folder) view.ready = view.init();
      else if (view instanceof TreeView) {
        const focus = firstTree === null ? path : layout.state(id).focus;
        firstTree = true;
        view.ready = view.init().then(() => focus ? view.reveal(focus) : view.select(ThisPC));
      } else if (view instanceof ListView) {
        const s = layout.state(id);
        if (s.location) view.load(s.location);
      }
    }
    const active = views.has(saved.active) ? saved.active : docks.panes()[0];
    activate(active);
    drawHeads();
    views.get(active)?.body.focus();
    return true;
  } catch (e) {
    status(`The saved layout could not be used: ${e.message}`, true);
    return false;
  }
}

// The presets (3.5): the window's panes made again, at the folder shown now. default: the root tree and its list;
// dual: the root drives two lists in two colours; columns: a chain of lists, each following the one before (as
// Finder's column view); preview: the default with a preview following the list.
function applyPreset(name) {
  const at = currentFolder();
  if (preview) {
    preview.close();
    preview = null;
  }
  for (const v of views.values()) {
    v.el.remove();
    iconUsers.delete(v);
  }
  views.clear();
  Object.assign(layout, new Layout());
  Object.assign(docks, new Docks());
  activePane = null;
  const tree = newRootPane(at);
  const first = newChildPane(tree.id, 'right', { area: 'center' });
  if (name === 'dual') newChildPane(tree.id, 'below', { pane: first.id, side: 'bottom' });
  if (name === 'columns') {
    let last = first;
    for (let k = 0; k < 2; k++) last = newChildPane(last.id, 'right');
  }
  if (name === 'preview') {
    activate(first.id);
    togglePreview();
  }
  // Once the tree is on its folder, each of its children shows it (a child made before that, in another branch than
  // the active one, would stay empty).
  tree.ready.then(() => {
    const focus = layout.state(tree.id).focus;
    for (const f of layout.followers(tree.id)) if (f.kind !== 'preview') {
      activate(f.id);
      const state = layout.state(tree.id);   // the tree's state for that branch: copied before it had a folder
      if (!state.focus) state.focus = focus;
      followParent(f.id);
    }
    activate(first.id);
    drawHeads();
  });
  activate(first.id);
  drawHeads();
  first.body.focus();
  tellLayout();
  status(`Preset ${Presets[name]}: the window's panes made again${at ? `, at ${at}` : ''}.`);
}

// A new root: a tree of folders (3.4, New pane), in the left area (or at `place`), on `path` or else This PC.
function newRootPane(path, place = { area: 'left' }) {
  const id = layout.add({ kind: 'tree', content: 'folders' });
  const tree = placeView(new TreeView(id), place);
  activate(id);
  tree.ready = tree.init().then(() => path ? tree.reveal(path) : tree.select(ThisPC));
  return tree;
}

// A new child of a pane (3.4, New child pane; plan 12 3.2): directly at the right of that pane, or below it (`where`),
// or at `place` (the default layout puts the first list in the center); with the settings of the parent's current child;
// it shows what the parent focuses. A tab is New tab, not a child.
function newChildPane(parentId, where = 'right', place = null) {
  const id = layout.add({ source: parentId, ...layout.childSettings(parentId) });
  const view = placeView(makeView(id), place ?? { pane: parentId, side: where === 'below' ? 'bottom' : 'right' });
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
      if (v instanceof TreeView) {
        if (v.folder && v.root) folders.add(v.root);
        for (const n of v.flat) if (n.expanded) folders.add(n.id);
      }
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
      if (v.folder && same(v.root, folder)) v.reread(null);
      const n = v.node(folder);
      if (n?.children) v.reread(n);
    }
  }
}

// ---------- Between panes (3.6), and back and forward per pane (plan 17) ----------

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

// Back and forward per pane (docs/plans/executed/17-PLAN-history-per-pane.md): once things rest, every pane's state goes into
// its own history (Layout.record): what it showed, whatever made it change, also following its parent.
let recordTimer = 0;

function recordStep() {
  tellLayout();
  clearTimeout(recordTimer);
  recordTimer = setTimeout(() => {
    for (const id of layout.panes.keys()) if (views.get(id)) layout.record(id);
    tellLayout();
    ribbonRefresh();
  }, 400);
}

const canGo = step => activePane !== null && !!layout.pane(activePane) && layout.canGo(activePane, step);

// One step back or forward from the active pane: the pane whose history it is (itself, or the parent it follows, up)
// goes there; its children follow it as on any change.
function goHistory(step) {
  if (!canGo(step)) return;
  const id = layout.go(activePane, step);
  views.get(id)?.restore(true);
  recordStep();
  ribbonRefresh();
}

// To the parent, to the child in the active branch, to the next branch of the parent (the keys of 3.6).
function focusPane(id) {
  if (id && views.get(id)) views.get(id).body.focus();
}

// Along the active pane's branch (Tab, Shift+Tab): from its root down through the children of the branch shown, round.
function alongBranch(step) {
  const { chain } = branchChain(activePane);
  if (chain.length < 2) return;
  focusPane(chain[(chain.indexOf(activePane) + step + chain.length) % chain.length]);
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
    for (const v of views.values()) if (layout.pane(v.id)?.hidden === undefined) if (v instanceof TreeView) v.flatten(); else v.refresh();
  } else if (before.treeExpanders !== settings.treeExpanders) {
    for (const v of views.values()) if (v instanceof TreeView) v.render();
  }
  ribbonRefresh();
}

// The settings' and the themes' problems in the status line.
function settingsProblems(m) {
  const problems = [...m.settings.problems, ...m.themes.problems];
  if (problems.length) status(problems.join(' '), true);
}


// The mouse's back and forward buttons (plan 17 3.3): Back and Forward on the pane with the focus, not the browser's
// own (the page has no history to go to).
for (const type of ['mousedown', 'mouseup', 'auxclick'])
  document.addEventListener(type, e => {
    if (e.button !== 3 && e.button !== 4) return;
    e.preventDefault();
    e.stopPropagation();
    if (type === 'mouseup') runAction(e.button === 3 ? 'history.back' : 'history.forward');
  }, true);

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
    version = m.version + (m.commit ? ` (${m.commit})` : '');
    setBars(m.bars);
    setColumnSets(m.columnSets);
    post({ op: 'drives' });
    for (const o of m.ops) ops.set(o.id, o);
    showOps();
    settingsProblems(m);
    showProject(m.project);
    start(m.paths, m.layout);
  },
  // Bars changed in a window (plan 10 3.3), and the drives there are now (3.2).
  bars(m) { setBars(m.bars); },
  barsFailed(m) { status(`The bars could not be written: ${m.error}`, true); },
  drives(m) { setDrives(m.drives); },
  // Columns (plan 11): the sets changed, Windows' properties for columns, the Git status and property values asked.
  columnSets(m) { setColumnSets(m.columnSets); },
  columnsFailed(m) { status(`The column sets could not be written: ${m.error}`, true); },
  propList(m) { propListCame(m.list); },
  git(m) { columnReply(m); },
  props(m) { columnReply(m); },
  // The window's project renamed, or the window moved to another (plan 15 3.6).
  project(m) { showProject(m.project); },
  // A pane chosen in the Projects menu (plan 15 3.6): the focus to it, its tab shown.
  focusPane(m) { if (views.has(m.pane)) focusPane(m.pane); },
  projectList(m) { projectListCame(m.list); },
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
