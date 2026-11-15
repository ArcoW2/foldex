// The page of a Foldex window. It asks the host ({ op, ... }) and is told ({ event, ... }); see MainForm.cs.
// The panes of plan 03 (docs/plans/executed/03-PLAN-connected-panes.md): panes.js decides what each pane shows, this file draws
// them. The default layout (3.5): the root, a tree of folders on the left; a list following it; a preview on request.
'use strict';

const host = window.chrome.webview;
const ThisPC = '::{20D04FE0-3AEA-1069-A2D8-08002B30309D}';
const Network = '::{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}';
const RecycleBin = 'shell:RecycleBinFolder';
const TreeTop = ['shell:Profile', ThisPC, Network, RecycleBin];
// The ".." row of a pane with a folder as its top (plan 26 3.11): a tree's first row, a list's first item.
const UpRowId = '::foldex-up';
const isUpRow = x => !!x?.up;
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
  post({ op: 'look', look: hostLook() });   // for Foldex's own windows over this one (AskForm)
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
  // A pane in Thumbnails: its thumbnail size (docs/plans/executed/22-PLAN-thumbnails.md 3.2), not the font.
  const thumbPane = e.target.closest('.pane.list')?.dataset.pane;
  if (thumbPane && layout.pane(thumbPane)?.view === 'thumbs') return thumbZoom(thumbPane, e.deltaY < 0 ? 1 : -1);
  const now = pointSize(settings.paneSize);
  const next = Math.min(PaneSizes.max, Math.max(PaneSizes.min, now + (e.deltaY < 0 ? 1 : -1)));
  if (next === now) return;
  settings.paneSize = next;
  applyFonts(settings);
  setRowHeight(paneRowHeight(settings));
  clearTimeout(paneSizeTimer);
  paneSizeTimer = setTimeout(() => post({ op: 'setSetting', name: 'paneSize', value: settings.paneSize }), PaneSizes.rest);
}, { passive: false });

// The log (its pane and functions: LogView): declared here, as status() writes to it from the start.
const log = { entries: [], seen: 0 };
const LogMax = 1000, LogRepeat = 1500;
let logPane = null;

function status(text, warn = false) {
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
  logStatus(text, warn);
}

const same = (a, b) => a != null && b != null && a.toLowerCase() === b.toLowerCase();

// Scrollbars drawn full (app.css; the setting scrollbarsSlim): the scrolling elements under the mouse get .bars-full
// (the focused pane too is slim while the mouse is elsewhere). A class, not :hover in the stylesheet: Chromium repaints
// a scrollbar when its element's class changes, not when only its :hover does.
let barsHover = [];
const barsChain = el => {
  const chain = [];
  for (let e = el; e instanceof Element && e !== document.documentElement; e = e.parentElement)
    if (e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth) chain.push(e);
  return chain;
};
function barsUpdate() {
  const want = new Set(barsHover);
  for (const e of document.querySelectorAll('.bars-full')) if (!want.has(e)) e.classList.remove('bars-full');
  for (const e of want) e.classList.add('bars-full');
}
document.addEventListener('mouseover', e => { barsHover = barsChain(e.target); barsUpdate(); }, true);
document.addEventListener('mouseout', e => { if (!e.relatedTarget) { barsHover = []; barsUpdate(); } }, true);

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
function list(channel, location, foldersOnly, onPart, onDone, elevated = false, tree = false, fresh = false) {
  const req = ++lastReq;
  listeners.set(channel, { req, onPart, onDone, sent: performance.now(), got: 0, total: null });
  // fresh (F5): the host reads the folder from disk again, not from its cache.
  post({ op: elevated ? 'listElevated' : 'list', channel, location, foldersOnly, tree, req, ...(fresh ? { fresh } : {}) });
  setTimeout(showProgress, ProgressAfter + 10);
}

// The progress bar in the status line: while a folder takes longer than ProgressAfter ms to read. It fills up as the
// items come, against the count the host sends for a folder on disk ("listCount"); without a count (another place) a
// piece of it runs from left to right.
const ProgressAfter = 400;
const progressRun = { listings: new Set(), shown: 0 };   // the listings of this run of the bar (done ones count as full)
function showProgress() {
  const now = performance.now();
  const open = new Set(listeners.values());
  const slow = [...open].filter(l => now - l.sent > ProgressAfter && !l.cached);
  $('progress').hidden = !slow.length;
  if (!slow.length) {
    progressRun.listings.clear();
    progressRun.shown = 0;
    return;
  }
  $('progress').style.left = `${$('status').offsetLeft}px`;   // over the status text, after the project
  // It fills from the listings with a count (places other than folders on disk have none), those done since the bar
  // came counting as full, and never goes back (a count coming later makes the whole larger).
  for (const l of slow) progressRun.listings.add(l);
  const counted = [...progressRun.listings].filter(l => l.total !== null);
  const total = counted.reduce((a, l) => a + l.total, 0);
  const got = counted.reduce((a, l) => a + (open.has(l) ? Math.min(l.got, l.total) : l.total), 0);
  if (total) progressRun.shown = Math.max(progressRun.shown, got / total * 100);
  $('progress').classList.toggle('counted', counted.length > 0);
  $('progress').querySelector('.track > div').style.width = counted.length ? `${Math.min(100, progressRun.shown)}%` : '';
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
  return kind === 'tree' ? new TreeView(id) : kind === 'log' ? new LogView(id)
    : kind === 'preview' ? (layout.pane(id).info ? new InfoView(id) : new PreviewView(id))
    : kind === 'scrap' ? new ScrapView(id) : new ListView(id);
}

// ---------- Rows in view only ----------

let RowHeight = 22;   // follows the pane font (look.js paneRowHeight; docs/plans/executed/08-PLAN-fonts.md 3.4)

function visibleRange(body, count) {
  const first = Math.max(0, Math.floor(body.scrollTop / RowHeight) - 5);
  const last = Math.min(count, Math.ceil((body.scrollTop + body.clientHeight) / RowHeight) + 5);
  return [first, last];
}

// The rows kept in view above and below the cursor (the setting scrollMargin), so scrolling starts before the cursor
// reaches the edge: 1 starts it at the second row from the edge. Never more than fits: in a low pane at most as many as
// leave the cursor in the middle.
function scrollMargin(rows) {
  return Math.max(0, Math.min(Math.floor((rows - 1) / 2), Math.round(Number(settings.scrollMargin) || 0)));
}

function scrollIntoView(body, index) {
  const margin = scrollMargin(Math.floor(body.clientHeight / RowHeight));
  const top = (index - margin) * RowHeight, bottom = (index + 1 + margin) * RowHeight;
  if (top < body.scrollTop) body.scrollTop = Math.max(0, top);
  else if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = bottom - body.clientHeight;
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
    '<button class="pin" title="Pin: stop following the parent"></button><span class="title"></span>' +
    '<button class="filtered" hidden><svg viewBox="0 0 16 16"><path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z"/></svg></button>' +
    '<span class="marks"></span></div>' +
    '<div class="body" tabindex="0"><div class="rows"></div></div>';
  el.querySelector('.title').textContent = title;
  el.querySelector('.connector').addEventListener('mousedown', e => { activate(id); dragConnector(id, e); });
  el.querySelector('.pin').addEventListener('click', () => togglePin(id));
  // Filtered by the search bar (search.js): this pane active and the keyboard in the bar.
  el.querySelector('.filtered').addEventListener('click', () => { activate(id); focusSearch(); });
  // The head dragged: the pane moves to another dock place (not from the connector, the pin, the filter mark or the
  // branch marks).
  el.querySelector('.head').addEventListener('mousedown', e => {
    if (!e.target.closest('.connector, .pin, .filtered, .marks span, .scrap-button')) dragToDock(id, e);
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
  if (!(views.get(id) instanceof PreviewView)) showGlobal(layout.state(id).focus);
  showSearch();   // the search bar shows this pane's text
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
    for (const name of ['bg', 'bg-side', 'select', 'hover', 'accent', 'text', 'text-selected', 'text-focused', 'text-hover'])
      v.el.style.setProperty(name === 'text' ? '--branch-text' : `--${name}`, key !== null ? `var(--branch-${key}-${name})` : '');
    v.el.classList.toggle('child', pane.source !== null);
    v.el.classList.toggle('pinned', pane.pinned);
    v.el.querySelector('.pin').title = pane.kind === 'scrap'
      ? pane.pinned ? 'Pinned: comes back (empty) after a restart; click to unpin' : 'Pin: keep this scrap after a restart (it comes back empty)'
      : pane.pinned ? 'Pinned: click to follow the parent again' : 'Pin: stop following the parent';
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
  drawHiddenPanes();
}

// Followers take what a pane focused once the cursor rests (3.3, debounce): followDelay ms, 0 to 1000.
const followDelay = () => Math.min(1000, Math.max(0, Number(settings.followDelay ?? 150) || 0));
const focusTimers = new Map();

function focusItem(paneId, item) {
  layout.state(paneId).focus = item ? item.id : null;
  clearTimeout(focusTimers.get(paneId));
  focusTimers.set(paneId, setTimeout(() => {
    apply(layout.focus(paneId, item));
    if (paneId === activePane) showGlobal(item?.id ?? null);
  }, followDelay()));
}

// A path on disk or a share (not a shell place).
const isDiskPath = id => /^[A-Za-z]:\\|^\\\\/.test(id ?? '');

// An item a pane shows, by id (its name, whether it is a folder): in `first` when given, else in any pane; a tree's
// node is a folder.
function itemShown(id, first) {
  for (const v of [first, ...views.values()]) {
    const x = v?.entries?.find(e => same(e.id, id));
    if (x) return x;
    const n = v instanceof TreeView ? v.node(id) : null;
    if (n) return { ...n, folder: n.folder !== false };
  }
  return null;
}

// The global preview and Info pane (the ribbon's Preview and Info, Alt+P, Alt+I): the item the active pane focuses,
// whatever pane that is (a list, a scrap, a tree). A preview or Info pane that is a child of a pane follows only that
// one (Layout.follow).
function showGlobal(id) {
  for (const v of [preview, infoPane]) if (v && !same(v.path, id)) v.show(id);
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
  if (item.up) return views.get(paneId)?.up();   // "..": the folder above (plan 26 3.11)
  if (item.folder && views.get(paneId) instanceof ScrapView) return openFromScrap(paneId, item);
  const r = layout.execute(paneId, item);
  if (r.open) post({ op: 'execute', ids: [r.open] });
  if (r.expand) views.get(r.expand.pane)?.toggle?.(r.expand.item);
  if (r.reveal) views.get(r.reveal.pane)?.reveal?.(r.reveal.item);
  apply(r.updates);
}

// A path typed, or Backspace in a follower: its source goes there and the follower follows (open question 7,
// suggestion); the root shows it in its tree.
function goTo(paneId, path) {
  const opener = layout.ownWay(paneId) ? paneId : layout.pane(paneId).source;
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
    // A folder can be in the tree in more than one place (your profile at the top and under This PC > C: > Users): each
    // place is a node of its own, with its own children, depth and parent. `nodes` has per id its home place (the one
    // under its own folder, where a path leads), `places` every place, and `focusNode` the place the focus is on.
    this.nodes = new Map();   // lower-case id -> its home node
    this.places = new Map();  // lower-case id -> every node of it
    this.focusNode = null;
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
    this.body.addEventListener('keydown', e => this.key(e));
    this.body.addEventListener('contextmenu', e => {
      e.preventDefault();
      const n = this.nodeAt(e.target);
      if (n?.qa || n?.up) return;   // the Quick access head and its hint, and "..", have no menu
      // A folder or file: Windows' menu with Foldex's own items at its top (quick access, bookmarks; plan 26 3.0).
      if (n) post({ op: 'menu', ids: [n.id], own: true, item: n.folder === false, x: e.clientX * devicePixelRatio, y: e.clientY * devicePixelRatio, extended: e.shiftKey });
      else openMenu(e.clientX, e.clientY, emptyMenu());   // its empty space: a new folder or file (rename.js)
    });
    dropTarget(this.body, e => {
      const n = this.nodeAt(e.target), at = this.quickAccessDrop(e, n);
      if (at !== null) return { quickAccessAt: at };
      return n?.folder === false ? n.parent?.id ?? this.root : n?.qa || n?.up ? null : n?.id ?? this.root;
    });
    // Quick access (plan 23 3.5): where a drop would put a folder, shown by a line; a shortcut dragged is its folder (the
    // shell's drag, as a list's items), so dropped back between shortcuts it moves there.
    this.body.addEventListener('dragover', e => {
      const at = this.quickAccessDrop(e, this.nodeAt(e.target));
      if (at !== this.qaDropAt) {
        this.qaDropAt = at;
        this.render();
      }
    });
    const dropDone = () => { if (this.qaDropAt !== null) { this.qaDropAt = null; this.render(); } };
    this.body.addEventListener('dragleave', e => { if (!this.body.contains(e.relatedTarget)) dropDone(); });
    this.body.addEventListener('drop', dropDone);
    this.body.addEventListener('dragstart', e => {
      const n = this.nodeAt(e.target);
      e.preventDefault();
      if (n?.parent === this.qaHead && this.qaHead) post({ op: 'dragOut', ids: [n.id] });
    });
    this.qaHead = null;    // the Quick access area's head row, its shortcuts under it (null: not shown)
    this.qaDropAt = null;  // where a folder dragged over the area would go
    iconUsers.add(this);
    // Made shorter (the ribbon or the status line coming in, the window resized): the focused folder, in view at the
    // old height, stays in view.
    let height = 0;
    new ResizeObserver(() => {
      const before = height;
      height = this.body.clientHeight;
      if (this.cols.fit && this.flat.length) this.fitColumns();
      if (height >= before) return;
      const i = this.flat.indexOf(this.focused());
      const top = i * RowHeight - this.body.scrollTop;
      if (i >= 0 && top >= 0 && top + RowHeight <= before) scrollIntoView(this.body, i);
    }).observe(this.body);
  }

  // Files shown (plan 18 3.2): Folders and files; Files alone is not for a tree.
  showsFiles() { return layout.pane(this.id).content !== 'folders'; }

  // An item's home place (see the constructor).
  node(id) { return id == null ? undefined : this.nodes.get(id.toLowerCase()); }

  // Every place of an item.
  placesOf(id) { return id == null ? [] : this.places.get(id.toLowerCase()) ?? []; }

  // An item's place for an action by its id: the focused place when the focus is on it, else its home place.
  place(id) { return this.focusNode && same(this.focusNode.id, id) && this.placesOf(id).includes(this.focusNode) ? this.focusNode : this.node(id); }

  // The focused node: the place the focus is on.
  focused() { return this.place(layout.state(this.id).focus); }

  // A place under its own folder (a top has none above it).
  isHome(n) { return !n.parent || same(n.parent.id, folderOf(n.id)); }

  add(entry, parent) {
    const key = entry.id.toLowerCase(), places = this.places.get(key) ?? [];
    const known = places.find(n => n.parent === parent);
    if (known) {
      if (!known.children) Object.assign(known, { subs: entry.subs, files: entry.files });   // it may have got or lost some
      return known;
    }
    const n = { ...entry, parent, children: null, expanded: false, depth: parent ? parent.depth + 1 : this.folder ? 1 : 0 };
    n.inQa = !!parent && (parent.qa === 'head' || !!parent.inQa);   // in the Quick access area (its own tree colour)
    this.places.set(key, [...places, n]);
    const home = this.nodes.get(key);
    if (!home || !this.isHome(home) && this.isHome(n)) this.nodes.set(key, n);
    return n;
  }

  // A node gone (and the ones under it): out of the places, another place its item's home when it was.
  forget(n) {
    for (const c of n.children ?? []) this.forget(c);
    const key = n.id.toLowerCase(), rest = (this.places.get(key) ?? []).filter(m => m !== n);
    if (rest.length) this.places.set(key, rest);
    else this.places.delete(key);
    if (this.nodes.get(key) === n) {
      if (rest.length) this.nodes.set(key, rest.find(m => this.isHome(m)) ?? rest[0]);
      else this.nodes.delete(key);
    }
    if (this.focusNode === n) this.focusNode = null;
  }

  clear() {
    this.nodes.clear();
    this.places.clear();
    this.focusNode = null;
  }

  allNodes() { return [...this.places.values()].flat(); }

  // ---------- Quick access (plan 23 3.4): an area at the top of a tree without a parent ----------

  quickAccessShown() {
    const pane = layout.pane(this.id);
    return !this.folder && pane?.source === null && settings.quickAccess !== false && pane.quickAccess !== false && !pane.top;
  }

  // ---------- Root (plan 26 3.11): a folder as the top of a tree without a parent, a ".." row above it ----------

  topFolder() { return this.folder ? null : layout.pane(this.id)?.top ?? null; }

  // A folder as the top (null: the usual tops), kept with the pane; `focus` revealed then.
  async setTop(folder, focus = folder) {
    const pane = layout.pane(this.id);
    if (folder) pane.top = folder;
    else delete pane.top;
    tellLayout();
    this.clear();
    this.top = [];
    this.qaHead = null;
    this.ready = this.init();
    await this.ready;
    if (focus) await this.reveal(focus);
  }

  // "..": the folder above becomes the top, the one left focused; a drive's (or a share's) gives the usual tops.
  goUpTop() {
    const top = this.topFolder();
    if (!top) return;
    const up = parentOf(top);
    this.setTop(/^[A-Za-z]:\\|^\\\\[^\\]+\\[^\\]+/.test(up) ? up : null, top);
  }

  // The list changed (or the setting, or the pane's choice): the area made again, its shortcuts kept where they still
  // are (each a place of its own, so what is open under one stays open).
  async quickAccessChanged() {
    if (!this.quickAccessShown()) {
      if (!this.qaHead) return;
      for (const c of this.qaHead.children) if (!c.qa) this.forget(c);
      this.qaHead = null;
      return this.flatten();
    }
    const list = quickAccessList(), seen = JSON.stringify(list);
    const entries = await quickAccessEntries(list);
    if (seen !== JSON.stringify(quickAccessList()) || !this.quickAccessShown()) return;   // changed meanwhile
    const head = this.qaHead ??= { id: QaHeadId, name: 'Quick access', qa: 'head', folder: true, depth: 0, parent: null, children: [] };
    head.expanded = !layout.pane(this.id).qaFolded;
    const old = head.children.filter(c => !c.qa);
    // Each shortcut its entry's name (the place may be there already, under its folder's own name).
    const next = entries.map(e => Object.assign(this.add(e, head), { missing: !!e.missing, name: e.name, folder: e.folder }));
    for (const c of old) if (!next.includes(c)) this.forget(c);
    head.children = next.length ? next
      : [{ id: QaHintId, name: 'Right-click a folder: Add to quick access', qa: 'hint', folder: false, depth: 1, parent: head, children: null }];
    this.flatten();
  }

  foldQuickAccess(open) {
    if (!this.qaHead) return;
    this.qaHead.expanded = open;
    layout.pane(this.id).qaFolded = !open;
    const focus = this.focused();
    if (!open && focus?.inQa) this.select(this.top[0]?.id, false, this.top[0]);   // the focus was in the area: out of it
    this.flatten();
    tellLayout();
  }

  // Where a folder dragged over the area goes: before a shortcut (its upper part), after it (its lower part), first (the
  // head, the hint); null: not into the list (the middle of a shortcut: a drop into that folder, as anywhere).
  quickAccessDrop(e, n) {
    if (!this.qaHead || !n) return null;
    if (n.qa) return 0;
    if (n.parent !== this.qaHead) return null;
    const row = e.target.closest('.row'), r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
    const k = this.qaHead.children.indexOf(n);
    return y < 0.3 ? k : y > 0.7 ? k + 1 : null;
  }

  // The focused row when it is a shortcut of the area (Del takes it off the list, actions.js).
  quickAccessShortcut() {
    const n = this.focused();
    return n && this.qaHead && n.parent === this.qaHead ? n : null;
  }

  // Ready to show: the tops, or (a child) its folder.
  init() {
    if (this.folder) return this.load(layout.state(this.id).location);
    const top = this.topFolder();
    return new Promise(done => {
      described.set(++lastReq, entries => {
        // A top that is not there (any more): the usual tops.
        if (top && !entries.length) {
          delete layout.pane(this.id).top;
          tellLayout();
          return this.init().then(done);
        }
        this.top = entries.map(e => this.add(e, null));
        if (top) this.top.unshift({ id: UpRowId, name: '..', up: true, folder: true, depth: 0, parent: null, children: null });
        this.flatten();
        this.quickAccessChanged();
        (top ? this.expand(this.top[1]) : Promise.resolve()).then(done);
      });
      post({ op: 'describe', ids: top ? [top] : TreeTop, req: lastReq });
    });
  }

  // A child tree on a folder (following its parent, as a list loads one): its items as the top rows, its focus back
  // when it is there.
  load(location) {
    this.root = location;
    this.clear();
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
  reread(n, fresh = false) {
    const kids = [];
    const at = n ? n.id : this.root;
    if (!at) return;
    list(`tree:${this.id}:${n ? n.id : ''}`, at, !this.showsFiles(), part => kids.push(...part), m => {
      if (m.error) return;
      this.put(n, kids.concat(m.entries).sort(this.comparer()).map(e => this.add(e, n ?? null)));
    }, false, true, fresh);
  }

  // Some items of a folder open in the tree changed on disk, and the host says which (by name): only those asked
  // again; one made or gone is put in or taken out where it belongs, one changed gets its new values; the rest stays
  // as it is. Without ids (the host lost track, or too many): read again.
  patch(n, told) {
    const at = n ? n.id : this.root;
    if (!at) return;
    if (!told) return this.reread(n);
    askHost({ op: 'changedEntries', location: at, ids: told, foldersOnly: !this.showsFiles(), tree: true }).then(m => {
      const shown = n ? n.children : this.top;
      if (m.whole || !shown) return this.reread(n);
      const ids = new Set(told.map(id => id.toLowerCase()));
      const came = new Map(m.entries.map(e => [e.id.toLowerCase(), e]));
      for (const c of shown) if (came.has(c.id.toLowerCase())) Object.assign(c, came.get(c.id.toLowerCase()));
      const next = shown.filter(c => !ids.has(c.id.toLowerCase()) || came.has(c.id.toLowerCase()));
      for (const e of m.entries) if (!shown.some(c => same(c.id, e.id))) next.push(this.add(e, n ?? null));
      if (!this.put(n, next.sort(this.comparer()))) this.render();
    });
  }

  // A folder's children (or the top) as `next`: the ones gone forgotten, the focused row kept where it is on screen.
  // False when nothing changed.
  put(n, next) {
    const shown = n ? n.children : this.top;
    if (shown && next.length === shown.length && next.every((c, k) => c === shown[k])) return false;
    const focus = this.focused();
    const offset = focus ? this.flat.indexOf(focus) * RowHeight - this.body.scrollTop : 0;
    for (const gone of shown ?? []) if (!next.includes(gone)) this.forget(gone);
    if (n) n.children = next;
    else this.top = next;
    this.flatten();
    const i = focus ? this.flat.indexOf(focus) : -1;
    if (i >= 0) {
      this.body.scrollTop = i * RowHeight - offset;
      this.render();
    }
    return true;
  }

  async expand(n, open = true) {
    if (n.folder === false) return;
    if (open) await this.loadNode(n);
    n.expanded = open;
    this.flatten();
  }

  toggle(id) {
    const n = this.place(id);
    if (n) this.expand(n, !n.expanded);
  }

  flatten() {
    this.flat = [];
    const hidden = showsHidden(this.id), filter = filterTest(layout.pane(this.id).filter), search = searchTest(this.id);
    // The search text (search.js): the folders and files that match, and the folders leading to them (of what the
    // tree has read).
    const leads = new Map();
    const matches = n => {
      if (!leads.has(n)) leads.set(n, search(n) || !!n.children?.some(matches));
      return leads.get(n);
    };
    const walk = list => {
      for (const n of list) {
        const shortcut = n.qa || n.up || n.parent?.qa === 'head';   // the area's head, hint and shortcuts, and "..", always show
        if (!shortcut && n.hidden && !hidden && n.depth > 0) continue;
        if (!shortcut && (!filter(n) || paneSearch.has(this.id) && !matches(n))) continue;
        this.flat.push(n);
        if (n.expanded && n.children) walk(n.children);
      }
    };
    walk(this.qaHead ? [this.qaHead, ...this.top] : this.top);
    const guides = treeGuides(this.flat.map(n => n.depth));
    this.flat.forEach((n, i) => { n.guides = guides[i]; });
    this.render();
    tellWatched();
  }

  // Whether a node gets an expander: a folder with something to show (plan 16; plan 18 3.4): its items once read, else
  // what the listing said (subs, and with files shown files: true, 'hidden' or false; absent, as for the tops: unknown,
  // so it gets one).
  hasItems(n) {
    if (n.folder === false || n.up) return false;
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
    const focus = this.focused();
    const missing = [], nodes = [], noProps = [];
    const propNames = cols.flatMap(c => propsFor(c.id));
    for (let i = first; i < last; i++) {
      const n = this.flat[i];
      if (propNames.length && /^[A-Za-z]:\\|^\\\\/.test(n.id) && propsToAsk(n, propNames)) noProps.push(n);
      const row = document.createElement('div');
      row.className = 'row cols' + (n === focus ? ' selected focused' : '') + (n.hidden ? ' hidden' : '') + (i % 2 ? ' odd' : '')
        + (isCompanion(this, n.id) ? ' companion' : '') + (n.qa ? ` qa-${n.qa}` : '') + (n.inQa ? ' qa' : '')
        + (n.missing || n.parent === this.qaHead && this.qaHead && bookmarkMissing(n.id) ? ' missing' : '');
      if (n.parent === this.qaHead && this.qaHead) {
        row.draggable = true;
        const k = this.qaHead.children.indexOf(n);
        if (this.qaDropAt === k) row.classList.add('qa-drop-before');
        if (this.qaDropAt === k + 1 && k === this.qaHead.children.length - 1) row.classList.add('qa-drop-after');
      } else if (n.qa && this.qaDropAt !== null && (n.qa === 'hint' || n.qa === 'head' && !this.qaHead.expanded)) row.classList.add('qa-drop-after');
      row.style.top = `${i * RowHeight}px`;
      row.dataset.index = i;
      cols.forEach((c, k) => {
        const cell = document.createElement('span');
        cell.className = k === 0 ? 'cell first' : 'cell' + (RightAligned.has(c.kind) ? ' right' : '') + (c.id === 'git' && n.git ? ` git-${n.git === '!' ? 'conflict' : n.git}` : '')
          + (c.id === this.cols.sort?.id ? ' sorted' : '');
        cell.style.width = `${c.width}px`;
        if (k > 0) cell.textContent = n.qa || n.up ? '' : columnText(n, c.id);
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
          if (n.qa || n.up) cell.append(twisty, name);   // the area's head and hint, "..": no icon
          else if (n.parent === this.qaHead && this.qaHead && findBookmark(n.id)) cell.append(twisty, bookmarkIcon(findBookmark(n.id), n), name);
          else cell.append(twisty, iconImage(n, missing), name);
          // Two shortcuts with the same name: the folder each is in, dimmed after it (plan 23 3.4).
          if (n.parent === this.qaHead && this.qaHead && this.qaHead.children.some(c => c !== n && c.name.toLowerCase() === n.name.toLowerCase()))
            name.after(Object.assign(document.createElement('span'), { className: 'qa-where', textContent: folderParent(n.id) }));
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
    // The Quick access head folds the area (kept per pane); its hint does nothing; a shortcut that is gone says so.
    if (n.qa === 'head') return this.foldQuickAccess(!n.expanded);
    if (n.qa) return;
    if (n.up) return this.goUpTop();   // "..": the folder above as the top
    // A shortcut that is gone, an item, or Root: opened as its bookmark (a message when gone, the item focused, the
    // folder as the pane's top; plan 26 3.10, 3.12).
    const shortcut = n.parent === this.qaHead && this.qaHead ? findBookmark(n.id) : null;
    if (shortcut && (n.missing || bookmarkMissing(n.id) || shortcut.item || shortcut.root) && !e.target.classList.contains('twisty')) {
      this.select(n.id, true, n);
      return openBookmark(shortcut);
    }
    // A double-click is the second press (its count): each press draws the rows anew, so the browser sends no dblclick.
    if (e.detail === 2 && !e.target.classList.contains('twisty')) return this.open(n);
    if (!e.target.classList.contains('twisty')) return this.select(n.id, false, n);
    // The expander only opens or closes its folder; the focus stays, unless closing hides it: then the folder gets it.
    const focus = this.focused();
    const inside = n.expanded && focus && focus !== n && this.contains(n, focus);
    this.expand(n, !n.expanded);
    if (inside) this.select(n.id, false, n);
  }

  // A double-click: a file opens; a folder opens (or closes) in the tree itself as well as in its children; a child
  // tree opens it only in itself (its parent stays).
  open(n) {
    if (n.folder === false) return execute(this.id, { id: n.id, folder: false });
    if (this.folder) return this.expand(n, !n.expanded);
    if (!n.expanded) this.expand(n);
    execute(this.id, { id: n.id, folder: true });
  }

  contains(n, m) {
    for (let p = m.parent; p; p = p.parent) if (p === n) return true;
    return false;
  }

  // A row focused: its children follow it (a folder: they show it; a file: a preview shows it). `at`: the place (a row
  // clicked or walked to); without it the focused place when the focus is on that item, else its home place.
  select(id, quiet = false, at = null) {
    const n = at ?? this.place(id);
    if (!n) return;
    this.focusNode = n;
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

  // The search text changed (search.js): its files again.
  searchChanged() { this.flatten(); }

  // Typed (search.js): the first row from the focus on (then from the top) whose name passes the test.
  goToMatch(test) {
    const at = Math.max(0, this.flat.indexOf(this.focused()));
    const rows = [...this.flat.slice(at), ...this.flat.slice(0, at)];
    const n = rows.find(x => test(x.name));
    if (n) this.select(n.id, false, n);
  }

  key(e) {
    if (typeInPane(this, e)) return;
    const n = this.focused();
    const i = n ? this.flat.indexOf(n) : -1;
    // The Quick access head and hint, and "..", are passed over (a click folds the area, or goes up).
    const marker = x => x?.qa || x?.up;
    const to = (k, step = 1) => {
      while (marker(this.flat[k])) k += step;
      if (k < 0 || !this.flat[k]) for (k = i; this.flat[k + step] && marker(this.flat[k + step]); k += step);
      if (this.flat[k] && !marker(this.flat[k])) this.select(this.flat[k].id, false, this.flat[k]);
      e.preventDefault();
    };
    if (e.key === 'ArrowDown') to(i + 1);
    else if (e.key === 'ArrowUp') to(Math.max(0, i - 1), -1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(this.flat.length - 1, -1);
    // A page down or up moves the cursor as a list's does (not only the view).
    else if (e.key === 'PageDown' || e.key === 'PageUp') {
      const page = Math.max(1, Math.floor(this.body.clientHeight / RowHeight) - 1);
      to(Math.max(0, Math.min(this.flat.length - 1, (i < 0 ? 0 : i) + (e.key === 'PageDown' ? page : -page))), e.key === 'PageDown' ? 1 : -1);
    }
    else if (e.key === 'ArrowRight' && n) { if (!n.expanded) this.expand(n); else if (n.children?.[0]) this.select(n.children[0].id, false, n.children[0]); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' && n) { if (n.expanded) this.expand(n, false); else if (n.parent && !n.parent.qa) this.select(n.parent.id, false, n.parent); e.preventDefault(); }
  }

  // Shows an item in the tree: expanded down to it and focused (`quiet`: without its children following). Paths on disk
  // are found from This PC down (a child tree: from its folder down), so they come to their home place (the focused
  // place when the focus is on that item already); other places only when the tree has them already.
  async reveal(path, quiet = false) {
    const base = this.root?.replace(/\\+$/, '');
    const known = this.node(path), home = known && this.isHome(known) ? known : null;
    if (this.focusNode && same(this.focusNode.id, path) && this.placesOf(path).includes(this.focusNode)) {
      for (let p = this.focusNode.parent; p; p = p.parent) p.expanded = true;
      this.flatten();
      return this.select(path, quiet, this.focusNode);
    }
    // A folder as the top (plan 26 3.11): a path under it found from it down; one that is not under it gives the tree
    // its usual tops first.
    const top = this.topFolder();
    if (top && isDiskPath(path)) {
      const topBase = top.replace(/\\+$/, '');
      if (!same(path.replace(/\\+$/, ''), topBase) && !path.toLowerCase().startsWith(topBase.toLowerCase() + '\\')) return this.setTop(null, path);
      let here = this.top.find(n => !n.up);
      const parts = same(path.replace(/\\+$/, ''), topBase) ? [] : path.replace(/\\+$/, '').slice(topBase.length + 1).split('\\');
      for (let k = 0; here && k < parts.length; k++) {
        await this.expand(here);
        here = here.children?.find(c => same(c.id, `${topBase}\\${parts.slice(0, k + 1).join('\\')}`));
      }
      if (here) return this.select(path, quiet, here);
    }
    if (!home && this.folder && base && path.toLowerCase().startsWith(base.toLowerCase() + '\\')) {
      const parts = path.slice(base.length + 1).split('\\');
      for (let k = 0, at = base; k < parts.length - 1; k++) {
        at += '\\' + parts[k];
        const here = this.node(at);
        if (!here) break;
        await this.expand(here);
      }
    } else if (!home && !this.folder && /^[A-Za-z]:\\/.test(path)) {
      // Down from the drive, each step in the place just opened (not another place of the same folder).
      const pc = this.node(ThisPC);
      if (pc) {
        await this.expand(pc);
        const parts = path.replace(/\\+$/, '').split('\\');
        let here = pc.children?.find(c => same(c.id, parts[0] + '\\')) ?? this.node(parts[0] + '\\');
        for (let k = 1; here && k < parts.length; k++) {
          await this.expand(here);
          here = here.children?.find(c => same(c.id, parts.slice(0, k + 1).join('\\')));
        }
        if (here) return this.select(path, quiet, here);
      }
    } else if (!home && !this.folder && /^\\\\[^\\?]/.test(path)) {
      // A network path: down from Network, the machine, its share, then its folders. A machine Network has not found
      // (yet) is put under it, as Explorer does with one typed.
      const net = this.node(Network);
      if (net) {
        await this.expand(net);
        const parts = path.replace(/\\+$/, '').slice(2).split('\\'), server = `\\\\${parts[0]}`;
        let here = net.children?.find(c => same(c.id, server));
        if (!here && net.children) {
          const like = net.children.find(c => c.id.startsWith('\\\\'));
          here = this.add({ id: server, name: parts[0], folder: true, subs: true, icon: like?.icon ?? -1 }, net);
          net.children.push(here);
        }
        for (let k = 1; here && k < parts.length; k++) {
          await this.expand(here);
          here = here.children?.find(c => same(c.id, [server, ...parts.slice(1, k + 1)].join('\\')));
        }
        if (here) return this.select(path, quiet, here);
      }
    } else if ((home ?? known)?.parent) {
      for (let p = (home ?? known).parent; p; p = p.parent) p.expanded = true;
      this.flatten();
    }
    this.select(path, quiet, home ?? known ?? null);
  }

  // Back on this pane's state for the branch now active (plan 03 3.1); from history (`back`, plan 17): its folder (a
  // child tree) and its focus, which its children follow.
  restore(back = false) {
    const s = layout.state(this.id);
    if (this.folder && !same(s.location, this.root)) {
      this.load(s.location).then(() => { if (s.focus) this.reveal(s.focus, !back); });
    } else if (s.focus) this.reveal(s.focus, !back);   // in view, with the scroll margin (opened down to it)
    else this.render();
  }

  up() {
    const n = this.focused();
    if (n?.parent) this.select(n.parent.id, false, n.parent);
    else if (this.folder && this.root) goTo(this.id, parentOf(this.root));
    else if (this.topFolder()) this.goUpTop();   // on the top: as ".."
  }

  // The focused folder's items read again (a child tree on nothing focused: its folder).
  // F5: the focused folder's subfolders read again from disk (a child tree without a focused folder: its top), put in
  // where they are; the open folders, the focus and its place on screen stay.
  refresh() {
    const n = this.focused();
    if (!n || n.folder === false) {
      if (this.folder) this.reread(null, true);
      return;
    }
    if (n.children) this.reread(n, true);
    else this.expand(n, n.expanded);
  }

  // Show changed (plan 18 3.2): read again, the focus kept.
  reshow() {
    const focus = layout.state(this.id).focus;
    if (this.folder) return this.load(this.root);
    this.clear();
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
    if (sort && propsFor(sort.id).length) {
      const missing = this.allNodes().filter(n => !(n.props && propsFor(sort.id).every(p => p in n.props)) && /^[A-Za-z]:\\|^\\\\/.test(n.id));
      if (missing.length) await this.askProps(missing, propsFor(sort.id));
    }
    const compare = this.comparer();
    if (this.folder) this.top.sort(compare);
    for (const n of this.allNodes()) n.children?.sort(compare);
    this.flatten();
  }

  // The Git status of the folders read so far (once each), when the Git column is there.
  askColumnValues() {
    if (!this.cols.columns.some(c => c.id === 'git')) return;
    const top = this.folder && this.root && this.gitRootAsked !== this.root ? [{ id: this.root, top: true }] : [];
    for (const f of [...top, ...this.allNodes().filter(n => n.children)]) {
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

  // Fit columns: as a list's, the name column counting each row's indent and expander.
  fitColumns(nameOnly = false) {
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
    const widths = nameOnly ? [Math.ceil(needs[0])] : fitWidths(needs, this.body.clientWidth - 2, NameMinEm * fontPx);
    this.cols.columns.forEach((col, k) => { if (k < widths.length) col.width = Math.round(widths[k] / fontPx * 10) / 10; });
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
    this.all = [];   // what it read, before hidden items, Show, the filter and the search text
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
    this.colhead.hidden = this.iconsView() || this.thumbsView();
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
      if (!x) return openMenu(e.clientX, e.clientY, emptyMenu());   // its empty space: a new folder or file (rename.js)
      if (x.up) return;   // "..": no menu
      if (!this.selected.has(x.id)) this.select(x, e);
      if (this.ownMenu?.(e)) return;
      // One folder or file: Windows' menu with Foldex's own items at its top (quick access, bookmarks; plan 26 3.0).
      const one = this.ids().length === 1 ? this.entries.find(y => y.id === this.ids()[0]) : null;
      post({ op: 'menu', ids: this.ids(), own: !!one, item: !!one && !one.folder, x: e.clientX * devicePixelRatio, y: e.clientY * devicePixelRatio, extended: e.shiftKey });
    });
    // Dragging out: the host starts the shell's own drag (plan 02 3.6).
    this.body.addEventListener('dragstart', e => {
      e.preventDefault();
      const x = this.entryAt(e.target);
      if (x?.up) return;
      if (x && !this.selected.has(x.id)) this.select(x, e);
      post({ op: 'dragOut', ids: this.ids() });
    });
    dropTarget(this.body, e => this.dropAt(e));
    new ResizeObserver(() => {
      this.render();
      if (this.cols.fit && this.entries.length) this.fitColumns();
    }).observe(this.body);
    iconUsers.add(this);
  }

  ids() { return this.entries.filter(x => this.selected.has(x.id)).map(x => x.id); }

  // Where a drop lands: the folder dropped on, else the list's own.
  dropAt(e) {
    const x = this.entryAt(e.target);
    return x?.folder && !x.up ? x.id : this.location;
  }

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

  // The ".." row (plan 26 3.11) first whatever the sort.
  comparer() {
    const sort = this.cols.sort;
    const by = sort ? columnComparer(sort.id, columnInfo(sort.id).kind, sort.desc) : byName;
    return (a, b) => (isUpRow(b) - isUpRow(a)) || by(a, b);
  }

  // A list without a parent with Root (plan 26 3.11): a ".." row at the top of its items, while it is on disk.
  upRows() {
    const pane = layout.pane(this.id);
    return pane?.top && pane.source === null && isDiskPath(this.location)
      ? [{ id: UpRowId, name: '..', up: true, folder: true }] : [];
  }

  // Its items, without the ".." row.
  itemCount() { return this.entries.filter(x => !x.up).length; }

  // Sorted again (a click on a title): by a property of Windows, its value is read for every item first.
  async sortEntries() {
    const sort = this.cols.sort;
    if (sort && propsFor(sort.id).length) {
      const missing = this.entries.filter(x => !(x.props && propsFor(sort.id).every(p => p in x.props)) && !x.propsAll);
      if (missing.length) {
        status(`Reading ${columnInfo(sort.id).title} of ${missing.length} items to sort by it...`);
        await this.askProps(missing, propsFor(sort.id));
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

  // Fit columns (3.4): each column as wide as its widest value here; too wide, the name gives way first. `nameOnly`
  // (Ctrl+R): only the name column, its whole width (the pane scrolling sideways when it is wider than the pane).
  fitColumns(nameOnly = false) {
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
    const widths = nameOnly ? [Math.ceil(needs[0])] : fitWidths(needs, this.body.clientWidth - 2, NameMinEm * fontPx);
    this.cols.columns.forEach((col, k) => { if (k < widths.length) col.width = Math.round(widths[k] / fontPx * 10) / 10; });
    this.drawHeader();
    this.render();
    if (!this.cols.set) tellLayout();
  }

  load(location, elevated = false) {
    // Thumbnails still being made for the folder left: no longer (docs/plans/executed/22-PLAN-thumbnails.md 3.1).
    if (this.thumbsAsked) {
      post({ op: 'thumbs', channel: this.id, ids: [] });
      this.thumbsAsked = null;
    }
    this.location = location;
    this.entries = [];
    this.all = [];
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

  // The Thumbnails view (docs/plans/executed/22-PLAN-thumbnails.md): its layout (thumbs.js) and size per pane.
  thumbsView() { return layout.pane(this.id).view === 'thumbs'; }

  tile() {
    const fontPx = this.fontPx();
    const width = Math.max(80, Math.round(fontPx * 7.5));
    return { width, height: 48 + 14 + Math.round(fontPx * 2.7), perRow: Math.max(1, Math.floor(this.body.clientWidth / width)) };
  }

  // An item in view: its row of tiles, or its row.
  scrollTo(index) {
    if (this.thumbsView()) {
      const b = this.thumbBoxes?.[index];
      if (!b) return;
      if (b.y < this.body.scrollTop) this.body.scrollTop = b.y;
      else if (b.y + b.h > this.body.scrollTop + this.body.clientHeight) this.body.scrollTop = b.y + b.h - this.body.clientHeight;
      return;
    }
    if (!this.iconsView()) return scrollIntoView(this.body, index);
    const { height, perRow } = this.tile(), margin = scrollMargin(Math.floor(this.body.clientHeight / height));
    const row = Math.floor(index / perRow), top = (row - margin) * height, bottom = (row + 1 + margin) * height;
    if (top < this.body.scrollTop) this.body.scrollTop = Math.max(0, top);
    else if (bottom > this.body.scrollTop + this.body.clientHeight) this.body.scrollTop = bottom - this.body.clientHeight;
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
      tile.className = 'tile' + (this.selected.has(x.id) ? ' selected' : '') + (same(x.id, focus) ? ' focused' : '') + (x.hidden ? ' hidden' : '')
        + (isCompanion(this, x.id) ? ' companion' : '');
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

  // The Thumbnails view (docs/plans/executed/22-PLAN-thumbnails.md 3.3): every item placed by its layout (thumbs.js), only the
  // ones in view drawn; each its thumbnail when there (else its icon, large), its name or information, its icons.
  renderThumbs() {
    const pane = layout.pane(this.id), kind = pane.thumbLayout ?? 'grid-cut', size = pane.thumbSize ?? 160;
    const line = Math.round(this.fontPx() * 1.45), info = thumbInfo();
    const { boxes, height } = thumbLayout(kind, this.entries.map(x => thumbRatios.get(x.id.toLowerCase()) ?? 1),
      Math.max(60, this.body.clientWidth - 4), size, { line, names: pane.thumbNames !== false, info: 1 + info.length, card: 240 });
    this.thumbBoxes = boxes;
    this.rows.style.height = `${height}px`;
    this.rows.style.width = '';
    const top = this.body.scrollTop - size, bottom = this.body.scrollTop + this.body.clientHeight + size;
    const focus = layout.state(this.id).focus, bucket = thumbBucket(size, devicePixelRatio);
    const icons = thumbIcons(), missing = [], nodes = [], noProps = [], shown = [];
    const wanted = [...new Set([...info.flatMap(propsFor), ...(icons.includes('gps') ? propsFor('gps') : [])])];
    boxes.forEach((b, i) => {
      if (b.y + b.h < top || b.y > bottom) return;
      const x = this.entries[i];
      shown.push(x);
      if (wanted.length && !x.folder && propsToAsk(x, wanted)) noProps.push(x);
      const el = document.createElement('div');
      el.className = `thumb thumb-${kind}` + (this.selected.has(x.id) ? ' selected' : '') + (same(x.id, focus) ? ' focused' : '') + (x.hidden ? ' hidden' : '');
      Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      el.dataset.index = i;
      el.draggable = true;
      el.title = x.name;
      const pic = document.createElement('div');
      pic.className = 'thumb-pic';
      Object.assign(pic.style, { left: `${b.ix}px`, top: `${b.iy}px`, width: `${b.iw}px`, height: `${b.ih}px` });
      const t = thumbStore.get(`${bucket}:${x.id.toLowerCase()}`);
      if (t?.url) pic.append(Object.assign(document.createElement('img'), { src: t.url, className: 'thumb-img', draggable: false }));
      else pic.append(Object.assign(iconImage(x, missing, 48), { className: 'thumb-icon', draggable: false }));
      // Its icons (3.5): a map pin for a GPS location, RAW.
      const marks = [];
      if (icons.includes('gps') && hasGps(x)) marks.push(['gps', 'GPS', gpsText(x) ? `A GPS location: ${gpsText(x)}` : 'A GPS location']);
      if (icons.includes('raw') && !x.folder && isRaw(x.name)) marks.push(['raw', 'RAW', 'A camera RAW file']);
      if (marks.length) {
        const bar = document.createElement('div');
        bar.className = 'thumb-marks';
        for (const [cls, text, title] of marks) bar.append(Object.assign(document.createElement('span'), { className: `thumb-mark ${cls}`, textContent: text, title }));
        pic.append(bar);
      }
      el.append(pic);
      if (b.th > 0) {
        const text = document.createElement('div');
        text.className = 'thumb-text';
        Object.assign(text.style, { left: `${b.tx}px`, top: `${b.ty}px`, width: `${b.tw}px`, height: `${b.th}px` });
        text.append(Object.assign(document.createElement('div'), { className: 'thumb-name', textContent: x.name }));
        if (kind === 'details' || kind === 'cards')
          for (const n of info) {
            const v = columnText(x, n);
            text.append(Object.assign(document.createElement('div'), { className: 'thumb-info', textContent: v ? `${columnInfo(n).title}: ${v}` : '' }));
          }
        el.append(text);
      }
      nodes.push(el);
    });
    this.rows.replaceChildren(...nodes);
    askIcons(missing, [], 48);
    if (noProps.length) this.askProps(noProps, wanted);
    this.askThumbs(shown, bucket);
  }

  // Thumbnails asked for: what is in view first, then the rest of the folder, in the background (the host replaces
  // what it still had to do for this pane). Asked again when items in view are not on their way yet.
  askThumbs(shown, bucket) {
    const lacks = x => !x.folder && !thumbStore.has(`${bucket}:${x.id.toLowerCase()}`);
    const first = shown.filter(lacks);
    if (!first.length || (first.every(x => this.thumbsAsked?.has(x.id)) && this.thumbsBucket === bucket)) return;
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => {
      const rest = this.entries.filter(x => lacks(x) && !first.includes(x));
      this.thumbsAsked = new Set([...first, ...rest].map(x => x.id));
      this.thumbsBucket = bucket;
      post({ op: 'thumbs', channel: this.id, size: bucket, ids: [...first, ...rest].map(x => x.id),
        place: settings.thumbnailCache === 'folder' ? 'folder' : 'foldex', limitMB: Number(settings.thumbnailCacheMB) || 64 });
    }, 120);
  }

  shows(x) {
    const content = this.content();
    return content === 'files' ? !x.folder : content === 'folders' ? x.folder : true;
  }

  // Show changed: read again where it is.
  reshow() { if (this.location) this.load(this.location); }

  // The folder changed on disk (3.8), a file operation is done (`op`), or F5 (`fresh`: from disk, not the host's
  // cache): read again where it is, the list replaced at once when all of it came (so it does not blink). The
  // selected items stay selected (a renamed or moved one under its new name), and the focused item stays where it was
  // on screen (gone: the one now in its place). What the operation put here (pasted, dropped, moved in) becomes the
  // selection instead, the first of it focused and in view.
  reread(op = null, fresh = false) {
    if (!this.location || this.message) return;
    // The folder's watcher may read it again before this is done (and so stop it): the operation waits for that one.
    op ??= this.opPending ?? null;
    this.opPending = op;
    const moved = op?.moved ?? [];
    const now = id => moved.find(([from]) => same(from, id))?.[1] ?? id;
    const landed = op && op.kind !== 'rename' && op.kind !== 'renameMany' ? [...(op.made ?? []), ...moved.map(m => m[1]), ...(op.created ? [op.created] : [])].filter(id => same(folderOf(id), this.location)) : [];
    const keep = [...this.selected].map(now), top = this.body.scrollTop;
    const s = layout.state(this.id), focusBefore = s.focus ? now(s.focus) : null;
    const at = this.entries.findIndex(x => same(x.id, s.focus));
    const offset = at >= 0 && !this.iconsView() && !this.thumbsView() ? at * RowHeight - top : null;   // the focused row's place on screen
    const parts = [];
    this.gitAsked = false;
    list(this.id, this.location, this.content() === 'folders', part => parts.push(...part), m => {
      this.opPending = null;
      this.done({ ...m, entries: parts.concat(m.entries) }, true);
      const here = id => this.entries.find(x => same(x.id, id));
      const arrived = landed.map(here).filter(Boolean).sort((a, b) => this.entries.indexOf(a) - this.entries.indexOf(b));
      // What arrived is the selection now (an action next is meant for it); otherwise the selection as it was (nothing
      // there before: what done chose, the first item).
      const before = keep.length || focusBefore ? keep : [...this.selected];
      this.selected = new Set((arrived.length ? arrived : before.map(here)).filter(Boolean).map(x => x.id));
      s.selection = [...this.selected];
      const focus = arrived[0] ?? (focusBefore && here(focusBefore))
        ?? (focusBefore && at >= 0 && this.entries.length ? this.entries[Math.min(at, this.entries.length - 1)] : null);
      this.body.scrollTop = top;
      if (focus) {
        s.focus = focus.id;
        const i = this.entries.indexOf(focus);
        if (arrived.length || offset === null) this.scrollTo(i);
        else this.body.scrollTop = i * RowHeight - offset;
        if (arrived.length) focusItem(this.id, { id: focus.id, folder: focus.folder });   // its children follow it
      }
      this.render();
    }, false, false, fresh);
  }

  // Some items of the folder changed on disk, and the host says which (by name): only those asked again and put in
  // where they belong (gone ones taken out, changed ones replaced), without reading the folder again; the selection,
  // the focus and the focused row's place on screen stay. Without ids (the host lost track, or too many), while
  // the folder is being read, or after a file operation: read again (reread).
  patch(told) {
    if (!told || !this.location || this.message || this.opPending || listeners.has(this.id)) return this.reread();
    const at = this.location;
    askHost({ op: 'changedEntries', location: at, ids: told, foldersOnly: this.content() === 'folders' }).then(m => {
      if (this.location !== at || listeners.has(this.id)) return;
      if (m.whole) return this.reread();
      const ids = new Set(told.map(id => id.toLowerCase()));
      const s = layout.state(this.id), top = this.body.scrollTop;
      const was = this.entries.findIndex(x => same(x.id, s.focus));
      const offset = was >= 0 && !this.iconsView() && !this.thumbsView() ? was * RowHeight - top : null;
      const out = x => !ids.has(x.id.toLowerCase());
      this.all = this.all.filter(out).concat(m.entries);
      this.entries = this.entries.filter(out);
      const passes = this.passes(), compare = this.comparer();
      for (const e of m.entries.filter(passes)) {
        let lo = 0, hi = this.entries.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (compare(this.entries[mid], e) <= 0) lo = mid + 1;
          else hi = mid;
        }
        this.entries.splice(lo, 0, e);
      }
      const here = new Set(this.entries.map(x => x.id));
      this.selected = new Set([...this.selected].filter(id => here.has(id)));
      s.selection = [...this.selected];
      // The focused item gone: the one now in its place.
      let focus = s.focus && this.entries.find(x => same(x.id, s.focus));
      if (s.focus && !focus && was >= 0 && this.entries.length) {
        focus = this.entries[Math.min(was, this.entries.length - 1)];
        s.focus = focus.id;
      }
      if (focus && offset !== null) this.body.scrollTop = this.entries.indexOf(focus) * RowHeight - offset;
      this.render();
      if (activePane === this.id && $('status').textContent.startsWith(`${this.name}: `))
        status(`${this.name}: ${this.entries.length} items`);
    });
  }

  take(entries, reset) {
    if (reset) this.entries = this.all = this.upRows();
    this.all = this.all.concat(entries);
    this.entries = this.entries.concat(entries.filter(this.passes())).sort(this.comparer());
    this.render();
    status(`${this.itemCount()} items so far...`);
  }

  // What it shows of what it read: hidden items, Show, the filter and the search text (search.js); ".." always.
  passes() {
    const hidden = showsHidden(this.id), filter = filterTest(layout.pane(this.id).filter), search = searchTest(this.id);
    return x => x.up || (hidden || !x.hidden) && this.shows(x) && filter(x) && search(x);
  }

  // The search text changed: filtered again from what it read, without reading the folder again.
  searchChanged() {
    this.entries = this.all.filter(this.passes()).sort(this.comparer());
    this.selected = new Set([...this.selected].filter(id => this.entries.some(x => x.id === id)));
    this.render();
    if (paneSearch.has(this.id)) status(`${this.entries.length} of ${this.all.length} items`);
  }

  // Typed (search.js): the first item from the focus on (then from the top) whose name passes the test.
  goToMatch(test) {
    const at = Math.max(0, this.entries.findIndex(x => same(x.id, layout.state(this.id).focus)));
    const rows = [...this.entries.slice(at), ...this.entries.slice(0, at)];
    const x = rows.find(y => test(y.name));
    if (x) this.select(x, { shiftKey: false, ctrlKey: false });
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
    // A share that does not answer: what the cache had, said not to be current (plan 24 3.8).
    else if (m.offline) status(`${m.name}: ${this.itemCount()} items as last read; not current: ${m.offline}`, true);
    else status(`${m.name}${m.elevated ? ' (as administrator)' : ''}: ${this.itemCount()} items`);
    drawTabs();   // the tab shows the folder's name
    // The focus of this branch, as it was left, comes back when it is still there; nothing focused here yet (a pane
    // opened, another folder): the first item, as Down would. Its followers wait until the focus moves, but a preview
    // shows it at once (also when Foldex starts with one).
    const focus = layout.state(this.id).focus;
    const kept = focus && this.entries.find(x => same(x.id, focus));
    const firstItem = this.entries.find(x => !x.up);
    if (kept) this.select(kept, {}, true);
    else if (firstItem && !this.renameOnLoad) this.select(firstItem, {}, true);
    itemListed(this);   // an item opened as a bookmark (plan 26 3.12): selected and focused
    const now = layout.state(this.id).focus;
    for (const f of layout.followers(this.id, layout.keyOf(this.id)))
      if (f.kind === 'preview' && !f.pinned && now && !same(views.get(f.id)?.path, now)) views.get(f.id)?.show(now);
    if (this.id === activePane && now) showGlobal(now);
    this.backDone();
    this.askColumnValues();
    if (this.cols.sort && propsFor(this.cols.sort.id).length) this.sortEntries();
    if (this.cols.fit) this.fitColumns();
    // A new folder or file made here (F8, F7; rename.js): focused and renamed in place.
    const made = this.renameOnLoad && this.entries.find(x => same(x.id, this.renameOnLoad));
    if (made) {
      this.renameOnLoad = null;
      this.select(made, {});
      startRename(this, made.id);
    }
    ribbonRefresh();
  }

  render() {
    if (this.thumbsView() && !(this.message && !this.entries.length)) return this.renderThumbs();
    if (this.iconsView() && !(this.message && !this.entries.length)) return this.renderIcons();
    if (this.message && !this.entries.length) {
      const msg = document.createElement('div');
      msg.className = 'message';
      msg.textContent = this.message === 'denied' ? 'You have no access to this folder.' : this.message;
      if (this.message === 'denied' && /^\\\\[^\\?]/.test(this.location ?? '')) {
        // On the network: a user name and password for that machine or share (Windows' own prompt), then again.
        msg.textContent = 'This machine or share wants you to log on.';
        const button = document.createElement('button');
        button.textContent = 'Log on...';
        button.addEventListener('click', () => askHost({ op: 'netLogon', path: this.location }).then(m => { if (m.ok) this.load(this.location); }));
        msg.append(button);
      } else if (this.message === 'denied') {
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
    const propNames = cols.flatMap(c => propsFor(c.id));
    for (let i = first; i < last; i++) {
      const x = this.entries[i];
      if (x.own) { own.push(x.id); x.own = false; }   // its own icon asked once, when in view
      if (propNames.length && propsToAsk(x, propNames)) noProps.push(x);
      const row = document.createElement('div');
      row.className = 'row cols' + (this.selected.has(x.id) ? ' selected' : '') + (same(x.id, focus) ? ' focused' : '')
        + (x.hidden ? ' hidden' : '') + (i % 2 ? ' odd' : '') + (isCompanion(this, x.id) ? ' companion' : '');
      row.style.top = `${i * RowHeight}px`;
      row.dataset.index = i;
      row.draggable = true;
      cols.forEach((c, k) => {
        const cell = document.createElement('span');
        cell.className = k === 0 ? 'cell first' : 'cell' + (RightAligned.has(c.kind) ? ' right' : '') + (c.id === 'git' && x.git ? ` git-${x.git === '!' ? 'conflict' : x.git}` : '')
          + (c.id === this.cols.sort?.id ? ' sorted' : '');
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
    const row = target.closest('.row, .tile, .thumb');
    return row ? this.entries[Number(row.dataset.index)] : null;
  }

  select(x, e, quiet = false) {
    const index = this.entries.indexOf(x);
    // ".." (plan 26 3.11) is focused, never selected, and nothing follows it.
    if (x.up) {
      this.selected = new Set();
      layout.state(this.id).selection = [];
      layout.state(this.id).focus = x.id;
      this.scrollTo(index);
      this.render();
      return ribbonRefresh();
    }
    if (e.shiftKey && this.anchor) {
      const a = this.entries.findIndex(y => y.id === this.anchor);
      const [lo, hi] = [Math.min(a, index), Math.max(a, index)];
      if (!e.ctrlKey) this.selected.clear();
      for (let k = lo; k <= hi; k++) if (!this.entries[k].up) this.selected.add(this.entries[k].id);
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
    if (typeInPane(this, e)) return;
    const focus = layout.state(this.id).focus;
    const i = this.entries.findIndex(x => same(x.id, focus));
    const to = k => { const x = this.entries[Math.max(0, Math.min(this.entries.length - 1, k))]; if (x) this.select(x, e); e.preventDefault(); };
    if (this.thumbsView()) {
      // Thumbnails: left and right one, up and down to the nearest below or above (thumbs.js), a page a screen.
      const at = i < 0 ? 0 : i;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) to(thumbNeighbour(this.thumbBoxes ?? [], at, e.key));
      else if (e.key === 'PageDown' || e.key === 'PageUp') {
        const b = this.thumbBoxes?.[at], y = b ? b.y + (e.key === 'PageDown' ? 1 : -1) * this.body.clientHeight : 0;
        const k = (this.thumbBoxes ?? []).findIndex(c => c.y + c.h > y);
        to(k < 0 ? this.entries.length - 1 : k);
      }
      else if (e.key === 'Home') to(0);
      else if (e.key === 'End') to(this.entries.length - 1);
      return;
    }
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
    this.selected = new Set(this.entries.filter(x => !x.up).map(x => x.id));
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

  // F5: read again from disk, where it is (reread); after an error, opened again.
  refresh() {
    if (this.location && this.message) this.load(this.location);
    else if (this.location) this.reread(null, true);
  }

  // Back on this pane's state for the branch now active (3.1). From history (`back`, plan 17): its selection comes back
  // too, and its children follow its focused item.
  restore(back = false) {
    const s = layout.state(this.id);
    if (back) this.back = { selection: [...s.selection] };
    if (!same(s.location, this.location)) this.load(s.location);
    else {
      this.selected = new Set(s.selection);
      // Its focused item in view (another branch's child chosen: the item it shows), with the scroll margin.
      const i = this.entries.findIndex(x => same(x.id, s.focus));
      if (i >= 0) this.scrollTo(i);
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

// ---------- A scrap (docs/plans/executed/06-PLAN-search-and-scrap.md): files and folders from anywhere ----------

// A list of its own entries instead of a folder's (3.1): never a child, but a parent (a folder focused in it shows in
// its children); filled by drops, Add to scrap, pasting and searches (3.2). Its entries' ids, its name and its search
// go with the layout (scraps.js decides what is left of them after a restart). Its ring and the edge under its head
// are dashed (app.css), its head has Stop (while it searches) and Delete (from disk, as Alt+Delete).
class ScrapView extends ListView {
  constructor(id) {
    super(id);
    this.el.classList.add('scrap');
    this.searching = false;
    const button = (cls, html, title, run) => {
      const b = Object.assign(document.createElement('button'), { className: `scrap-button ${cls}`, innerHTML: html, title });
      b.addEventListener('click', run);
      return b;
    };
    this.stopButton = button('scrap-stop', 'Stop', 'Stop the search', () => this.stop());
    this.stopButton.hidden = true;
    // In the head an X that closes the scrap (the pane, nothing on disk); deleting from disk is a file action, in a
    // bar of its own under the head, with its name, so it is never taken for closing.
    const close = button('scrap-close', '<svg viewBox="0 0 16 16"><path d="M4 3l4 4 4-4 1 1-4 4 4 4-1 1-4-4-4 4-1-1 4-4-4-4z"/></svg>',
      'Close this scrap (nothing on disk changes)', () => closePane(id));
    this.el.querySelector('.marks').before(this.stopButton, close);
    const bin = '<svg viewBox="0 0 16 16"><path d="M6 2h4l1 1h3v1.5H2V3h3zM3.5 5.5h9l-.8 9h-7.4z"/></svg>';
    const del = Object.assign(document.createElement('button'), { className: 'scrap-delete', innerHTML: `${bin}<span>Delete from disk</span>`,
      title: 'Delete the selected items from disk: to the Recycle Bin (Alt+Del)' });
    del.addEventListener('click', () => {
      activate(id);
      runAction('item.deleteDisk');
    });
    const bar = Object.assign(document.createElement('div'), { className: 'scrap-bar' });
    bar.append(del);
    this.el.querySelector('.head').after(bar);
    this.showName();
  }

  tabTitle() { return layout.pane(this.id).name ?? 'Scrap'; }

  showName() {
    this.el.querySelector('.title').textContent = this.tabTitle();
    drawTabs();
  }

  // The path bar: the focused item, while it is in the scrap.
  locationText() {
    const focus = layout.state(this.id).focus;
    return this.all.some(x => same(x.id, focus)) ? focus : '';
  }

  // A scrap has no folder: nothing to load, read again, go up from or open in itself.
  load() { }
  reveal() { }
  up() { }

  // Show, hidden items, the filter or the search bar changed: what it shows, from what it holds.
  reshow() { this.searchChanged(); }

  searchChanged() {
    this.entries = this.all.filter(this.passes()).sort(this.comparer());
    this.selected = new Set([...this.selected].filter(id => this.entries.some(x => x.id === id)));
    layout.state(this.id).selection = [...this.selected];
    this.render();
    tellWatched();
    if (activePane === this.id) this.tellCount();
  }

  tellCount() {
    const shown = this.entries.length, all = this.all.length;
    status(`${this.tabTitle()}: ${shown === all ? `${all} items` : `${shown} of ${all} items`}${this.searching ? ', searching...' : ''}`);
  }

  // Its ids kept with the layout (they come back as long as Foldex runs).
  keep() {
    layout.pane(this.id).items = this.all.map(x => x.id);
    tellLayout();
  }

  // Entries added: each item once, in its own order; nothing on disk changes (3.2).
  add(entries) {
    this.all = scrapMerge(this.all, entries);
    this.searchChanged();
    this.keep();
  }

  // Items asked from the host by their ids (a restart of the page, a paste, Add to scrap), then added.
  async addIds(ids) {
    if (!ids.length) return;
    this.add((await askHost({ op: 'entries', ids })).entries);
  }

  // Taken out (Delete, 3.5): nothing on disk changes.
  takeOut(ids) {
    const out = new Set(ids.map(id => id.toLowerCase()));
    this.all = this.all.filter(x => !out.has(x.id.toLowerCase()));
    this.searchChanged();
    this.keep();
  }

  clear() {
    this.all = [];
    this.searchChanged();
    this.keep();
  }

  // Checked again (F5, a folder of its entries changed, a file operation done): an item that is gone is dropped (3.1),
  // the rest read fresh.
  async verify(ids = this.all.map(x => x.id)) {
    if (!ids.length) return;
    const m = await askHost({ op: 'entries', ids });
    const fresh = new Map(m.entries.map(x => [x.id.toLowerCase(), x]));
    const asked = new Set(ids.map(id => id.toLowerCase()));
    this.all = this.all.flatMap(x => {
      const k = x.id.toLowerCase();
      return !asked.has(k) ? [x] : fresh.has(k) ? [fresh.get(k)] : [];
    });
    this.searchChanged();
    this.keep();
  }

  // Items moved or renamed by Foldex ([old, new]): their entries follow (3.1).
  follow(moved) {
    const before = this.all.map(x => x.id), after = scrapFollow(before, moved);
    const changed = before.filter((id, k) => id !== after[k]);
    if (!changed.length) return;
    this.takeOut(changed);
    this.addIds(after.filter((id, k) => id !== before[k]));
  }

  refresh() { this.verify(); }
  reread() { this.verify(); }

  restore() {
    this.selected = new Set(layout.state(this.id).selection);
    this.render();
  }

  // A drop onto a scrap adds what is dropped (3.2).
  dropAt() { return { scrap: this.id }; }

  // Items of more than one folder have no Explorer menu (3.5): Foldex's own.
  ownMenu(e) {
    const ids = this.ids();
    if (oneFolder(ids) && ids.every(id => /^[A-Za-z]:\\|^\\\\/.test(id))) return false;
    openMenu(e.clientX, e.clientY, scrapItemMenu(this, ids));
    return true;
  }

  // ---------- Its search (3.4) ----------

  search(options) {
    const { within, ...kept } = options;   // its items, for a search in a scrap: not kept
    layout.pane(this.id).search = kept;
    tellLayout();
    this.searching = true;
    this.stopButton.hidden = false;
    if (activePane === this.id) this.tellCount();
    post({ op: 'search', channel: this.id, ...options });
  }

  stop() { post({ op: 'searchStop', channel: this.id }); }

  searched(m) {
    this.searching = false;
    this.stopButton.hidden = true;
    if (m.error) return status(`${this.tabTitle()}: ${m.error}`, true);
    const engine = { walk: 'Foldex walked the folders', everything: 'from Everything', windows: 'from the Windows Search index',
      scrap: 'in the scrap' }[m.engine] ?? m.engine;
    status(`${this.tabTitle()}: ${m.count} found${m.stopped ? ' (stopped)' : ''}, ${engine}, ${(m.ms / 1000).toFixed(1)} s; ${this.all.length} items in it.`);
  }
}

// A folder opened (double-click, Enter) in a scrap: the keyboard to its child, which shows it; without a child, a new
// one at its right (a scrap cannot open a folder in itself).
function openFromScrap(id, item) {
  const child = layout.followers(id, layout.keyOf(id)).find(f => f.kind !== 'preview');
  if (child) {
    apply(layout.focus(id, item));
    return focusPane(child.id);
  }
  newChildPane(id, 'right');
}

const scrapViews = () => [...views.values()].filter(v => v instanceof ScrapView);

// A new scrap (3.2): empty, docked at the right (New scrap), or for a search beside the active pane; with its own
// colour and the folder column after the name.
function newScrap(name = null, place = { area: 'right' }) {
  const taken = scrapViews().map(v => v.tabTitle());
  const id = layout.add({ kind: 'scrap' });
  const pane = layout.pane(id);
  pane.colour = layout.newColour();
  pane.name = name ? scrapName(name, taken) : newScrapName(taken);
  pane.items = [];
  const cols = genericColumns();
  if (!cols.columns.some(c => c.id === 'path')) cols.columns.splice(1, 0, { id: 'path', width: columnInfo('path').width });
  pane.columns = cols;
  const view = placeView(new ScrapView(id), place);
  activate(id);
  drawHeads();
  view.body.focus();
  return view;
}

// Add to scrap (3.2): the selection of the active pane into a scrap: the only one, or the one chosen; with none, a
// new one.
function addToScrap(ids, x, y) {
  const scraps = scrapViews().filter(v => v.id !== activePane);
  const into = v => v.addIds(ids).then(() => status(`${ids.length} item(s) added to ${v.tabTitle()}.`));
  if (!scraps.length) return into(newScrap());
  if (scraps.length === 1) return into(scraps[0]);
  openMenu(x, y, [...scraps.map(v => ({ label: v.tabTitle(), run: () => into(v) })), '-',
    { label: 'New scrap', run: () => into(newScrap()) }]);
}

// The menu of items of more than one folder in a scrap (3.5).
function scrapItemMenu(view, ids) {
  const each = (op, extra = {}) => { for (const id of ids) post({ op, ids: [id], ...extra }); };
  return [
    { label: 'Open', run: () => each('execute') },
    '-',
    { label: 'Copy', run: () => runAction('item.copy') },
    { label: 'Cut', run: () => runAction('item.cut') },
    { label: 'Copy path', run: () => runAction('item.copyPath') },
    '-',
    { label: 'Take out of the scrap', run: () => view.takeOut(ids) },
    { label: 'Delete (Recycle Bin)', run: () => runAction('item.deleteDisk') },
    { label: 'Delete permanently...', run: () => runAction('item.deletePermanent') },
    '-',
    { label: 'Properties', run: () => each('invokeVerb', { verb: 'properties' }) },
  ];
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
      if (!this.path || this.info) return;   // the Info pane has no Windows preview to move
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
    this.native = false;   // until the host says Windows shows it (previewShown)
    const x = path && itemShown(path, views.get(layout.pane(this.id).source));
    if (!path || x?.folder || !isDiskPath(path)) {
      this.path = null;
      post({ op: 'previewClose' });
      this.message(path ? x?.folder || !isDiskPath(path) ? 'A folder.' : '' : 'Select a file to preview it.');
      return;
    }
    this.path = path;
    this.el.querySelector('.title').textContent = x?.name ?? path;
    this.message('');
    post({ op: 'preview', path, rect: this.rect() });
  }

  // Foldex's own preview, when Windows has none for the file (Shell/OwnPreview.cs): an image (a GIF moving), a video
  // or a sound in the page's own players, text as text.
  showOwn(own) {
    const kind = own.kind;
    const el = document.createElement(kind === 'image' ? 'img' : kind === 'text' ? 'pre' : kind);
    el.className = `own own-${kind}`;
    if (kind === 'text') el.textContent = own.text + (own.cut ? '\n\n[Only the start of the file is shown.]' : '');
    else {
      el.src = own.url;
      el.addEventListener('error', () => kind === 'image' ? this.message('This item cannot be previewed.') : this.still(own));
      // A video whose sound plays but whose picture the player cannot decode (no error, no width): the still, its
      // player kept under it for the sound.
      if (kind === 'video') el.addEventListener('loadedmetadata', () => { if (!el.videoWidth) this.still(own, el); });
      if (kind !== 'image') {
        el.controls = true;
        el.preload = 'metadata';
      }
    }
    this.rows.replaceChildren(el);
  }

  // A video or sound the page's player cannot play (a codec it lacks): the picture Windows makes of it (a frame of a
  // video), said to be a still, else that it cannot be previewed.
  still(own, player = null) {
    const path = this.path;
    askHost({ op: 'previewPicture', path }).then(m => {
      if (!same(this.path, path)) return;
      if (!m.url && !player) return this.message('This item cannot be previewed.');
      const note = Object.assign(document.createElement('div'), { className: 'own-note',
        textContent: player ? 'The picture of this video cannot be played here; a still of it, and its sound.'
          : `This ${own.kind === 'video' ? 'video' : 'sound'} cannot be played here; a still of it.` });
      const img = m.url ? Object.assign(document.createElement('img'), { className: 'own own-image', src: m.url }) : null;
      if (player) player.classList.add('own-sound');
      this.rows.replaceChildren(...[note, img, player].filter(Boolean));
    });
  }

  restore() { }

  up() { }

  refresh() { if (this.path) this.show(this.path); }

  locationText() { return this.path ?? ''; }

  tabTitle() { return 'Preview'; }

  close() { post({ op: 'previewClose' }); }
}

// Windows' preview is a window of its own lying over the page, so a dialog or a menu of the page would be hidden behind
// it. While a dialog is open, or a menu lies over the preview, the preview is a picture of itself (the host's
// snapshot, the window hidden); when they are gone the window is shown again.
const previewCover = { on: false, img: null };
const nativePreview = () => [...views.values()].find(v => v instanceof PreviewView && v.native && v.path);

function previewCoverCheck() {
  const v = nativePreview();
  const r = v?.body.getBoundingClientRect();
  const over = !!v && [...document.querySelectorAll('dialog[open], .menu')].some(e => {
    if (e.tagName === 'DIALOG') return true;   // modal: over the whole window
    const b = e.getBoundingClientRect();
    return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
  });
  if (over === previewCover.on) return;
  previewCover.on = over;
  if (over) return post({ op: 'previewSnapshot' });
  previewCover.img?.remove();
  previewCover.img = null;
  post({ op: 'previewRestore' });
}
new MutationObserver(previewCoverCheck).observe(document.body, { childList: true });   // menus and dialogs come and go here
new MutationObserver(previewCoverCheck).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });

// ---------- The Info pane: everything Windows knows of an item (Shell/FileDetails.cs) ----------

// A preview pane of its own kind: it follows the list's focused item as the preview does, and lists its properties
// in groups (the image's, the video's and sound's, the other details, the file itself), a line between them.
class InfoView extends PreviewView {
  constructor(id) {
    super(id);
    this.info = true;
    this.el.classList.add('info');
    this.el.querySelector('.title').textContent = 'Info';
    this.message('Select an item to see what is known of it.');
  }

  show(path) {
    this.path = path || null;
    if (!path) return this.message('Select an item to see what is known of it.');
    const x = itemShown(path, views.get(layout.pane(this.id).source));
    this.el.querySelector('.title').textContent = x?.name ?? path;
    if (!isDiskPath(path)) return this.message('Nothing is known of this item.');
    askHost({ op: 'fileInfo', path }).then(m => {
      if (!same(this.path, path)) return;   // another item meanwhile
      if (!m.groups?.length) return this.message(m.error ?? 'Nothing is known of this item.');
      const list = Object.assign(document.createElement('div'), { className: 'info-list' });
      m.groups.forEach((g, k) => {
        if (k) list.append(Object.assign(document.createElement('hr'), { className: 'info-split' }));
        list.append(Object.assign(document.createElement('div'), { className: 'info-group', textContent: g.title }));
        for (const [name, value] of g.rows) {
          const row = Object.assign(document.createElement('div'), { className: 'info-row' });
          row.append(Object.assign(document.createElement('span'), { className: 'info-name', textContent: name, title: name }),
            Object.assign(document.createElement('span'), { className: 'info-value', textContent: value }));
          list.append(row);
        }
      });
      this.rows.replaceChildren(list);
    });
  }

  tabTitle() { return 'Info'; }

  close() { }   // no Windows preview to close
}

// ---------- The log: the status line's messages and the file operations, kept ----------

// Every message of the status line and every file operation (copy, move, delete, new; their state kept up to date in
// their own line), oldest first, for as long as the window is open; the host keeps the operations of all windows and
// tells a new page (hello). Shown in the Log pane (LogView), docked at the bottom and hidden until the status bar's Log
// button (or the action log.toggle) shows it. A message that follows one that is not a warning within LogRepeat ms
// takes its line (a count that runs: "Scrap: 120 items, searching..."), so the log is not flooded.
function logStatus(text, warn) {
  if (!text) return;
  const last = log.entries.at(-1), now = Date.now();
  if (last?.kind === 'status' && !last.warn && !warn && now - last.at < LogRepeat) Object.assign(last, { text, at: now });
  else log.entries.push({ kind: 'status', text, warn, at: now });
  logChanged();
}

// A file operation came or changed (fileOp, hello): its line, made once and kept up to date.
function logOp(op) {
  const had = log.entries.find(e => e.kind === 'op' && e.op.id === op.id);
  if (had) had.op = op;
  else log.entries.push({ kind: 'op', op, at: Date.now() });
  logChanged();
}

// An operation's line: "#3 Copy 2 items: done" (a new folder or file has no items to count).
const OpNames = { copy: 'Copy', move: 'Move', delete: 'Delete', deletePermanent: 'Delete from disk', rename: 'Rename',
  renameMany: 'Rename', newFolder: 'New folder', newFile: 'New file' };
const opText = o => `#${o.id} ${OpNames[o.kind] ?? o.kind}${o.items ? ` ${o.items} item${o.items === 1 ? '' : 's'}` : ''}: ` +
  (o.error ? `failed: ${o.error}` : o.finished ? (o.aborted ? 'stopped' : 'done') : `${o.total ? Math.round(o.done * 100 / o.total) : 0}%`);

function logChanged() {
  if (log.entries.length > LogMax) {
    const over = log.entries.length - LogMax;
    log.entries.splice(0, over);
    log.seen = Math.max(0, log.seen - over);
  }
  if (logPane) log.seen = log.entries.length;
  drawLogButton();
  logPane?.render();
}

// The status bar's Log button: lit while the pane is shown; marked when a warning or a failed operation came that
// the pane has not shown yet.
function drawLogButton() {
  const button = $('log-button');
  if (!button) return;
  button.classList.toggle('on', !!logPane);
  button.classList.toggle('warn', log.entries.slice(log.seen).some(e => e.warn || e.op?.error));
  const running = log.entries.filter(e => e.kind === 'op' && !e.op.finished).length;
  button.textContent = running ? `Log (${running} running)` : 'Log';
}

function toggleLog() {
  if (logPane) return closePane(logPane.id);
  const id = layout.add({ kind: 'log' });
  logPane = placeView(new LogView(id), { area: 'bottom' });
  logChanged();
  drawHeads();
  views.get(activePane)?.body.focus();   // the keyboard stays in the pane that had it
}

// The Log pane: a line per entry, its time first; a warning or a failure in the warning colour. Kept at its end
// while it was at its end, so the newest stays in view.
class LogView extends PreviewView {
  constructor(id) {
    super(id);
    this.el.classList.add('log');
    this.el.querySelector('.title').textContent = 'Log';
    this.render();
  }

  show() { }

  render() {
    const atEnd = this.body.scrollTop + this.body.clientHeight >= this.body.scrollHeight - 4;
    if (!log.entries.length) return this.message('Nothing yet: messages and file operations come here.');
    const time = at => new Date(at).toLocaleTimeString();
    this.rows.replaceChildren(...log.entries.map(e => {
      const row = document.createElement('div');
      row.className = 'log-row' + (e.warn || e.op?.error ? ' warn' : '');
      row.append(Object.assign(document.createElement('span'), { className: 'log-time', textContent: time(e.at) }),
        Object.assign(document.createElement('span'), { className: 'log-text', textContent: e.kind === 'op' ? opText(e.op) : e.text }));
      return row;
    }));
    if (atEnd) this.body.scrollTop = this.body.scrollHeight;
  }

  refresh() { this.render(); }

  locationText() { return ''; }

  tabTitle() { return 'Log'; }

  close() { }   // no Windows preview to close
}

// ---------- Dropping files from Explorer onto a pane ----------

// A target of { scrap } is a scrap: what is dropped becomes its entries, nothing is copied or moved (plan 06 3.2), so
// the drag is told it is a link, whatever keys are held.
function dropTarget(body, targetOf) {
  body.addEventListener('dragover', e => {
    e.preventDefault();
    if (targetOf(e)?.scrap) e.dataTransfer.dropEffect = 'link';
  });
  body.addEventListener('drop', e => {
    e.preventDefault();
    const target = targetOf(e);
    if (target?.scrap) {
      const files = e.dataTransfer.files;
      askHost({ op: 'drop', scrap: true, types: [...e.dataTransfer.types] }, m => host.postMessageWithAdditionalObjects(m, files))
        .then(m => {
          views.get(target.scrap)?.add(m.entries);
          status(`${m.entries.length} item(s) added to ${views.get(target.scrap)?.tabTitle() ?? 'the scrap'}.`);
        });
    } else if (target?.quickAccessAt !== undefined) {
      host.postMessageWithAdditionalObjects({ op: 'drop', quickAccessAt: target.quickAccessAt, types: [...e.dataTransfer.types] }, e.dataTransfer.files);
    } else if (target) host.postMessageWithAdditionalObjects({ op: 'drop', target, types: [...e.dataTransfer.types] }, e.dataTransfer.files);
  });
}

// ---------- Docking (plan 12 3.1): the areas, groups as tabs, splits; docks.js decides, this draws ----------

const docks = new Docks();
let preview = null;
let infoPane = null;   // the Info pane (InfoView), as `preview` the preview

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
  // Nothing in the center (its pane closed, hidden or moved): a side area takes the room instead, the right one, else
  // the left, else the bottom, else the top (its own size is kept for when the center has a pane again). No pane at
  // all: the empty center.
  const fill = el => { el.style.width = el.style.height = ''; el.classList.add('dock-fill'); return el; };
  if (center) {
    middle.append(...[left, left && areaSplitter('left'), center, right && areaSplitter('right'), right].filter(x => x));
    root.replaceChildren(...[top, top && areaSplitter('top'), middle, bottom && areaSplitter('bottom'), bottom].filter(x => x));
  } else if (left || right) {
    middle.append(...(right ? [left, left && areaSplitter('left'), fill(right)] : [fill(left)]).filter(x => x));
    root.replaceChildren(...[top, top && areaSplitter('top'), middle, bottom && areaSplitter('bottom'), bottom].filter(x => x));
  } else if (top || bottom) {
    root.replaceChildren(...(bottom ? [top, top && areaSplitter('top'), fill(bottom)] : [fill(top)]).filter(x => x));
  } else {
    middle.append(Object.assign(document.createElement('div'), { className: 'dock-area dock-center dock-empty' }));
    root.replaceChildren(middle);
  }
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
  if (view instanceof ScrapView) return newScrap(null, place);   // a scrap's tab: a new, empty scrap
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
  const scrap = views.get(id) instanceof ScrapView ? views.get(id) : null;
  // A scrap's own (plan 06 3.1, 3.4): rename, clear, its search again or stopped.
  const scrapItems = scrap ? [
    { label: 'Rename scrap...', run: () => renameScrap(scrap) },
    { label: 'Clear scrap', enabled: scrap.all.length > 0, run: () => scrap.clear() },
    { label: 'Search again...', enabled: !!pane.search, run: () => openFind({ again: scrap }) },
    { label: 'Stop the search', enabled: scrap.searching, run: () => scrap.stop() },
    '-' ] : [];
  return [
    ...scrapItems,
    { label: 'New child pane', enabled: !(views.get(id) instanceof PreviewView), items: [
      { label: 'At the right', run: () => newChildPane(id, 'right') },
      { label: 'Below', run: () => newChildPane(id, 'below') },
      '-',
      { label: 'Preview', checked: layout.followers(id).some(f => f.kind === 'preview' && !f.info), run: () => togglePanePreview(id, false) },
      { label: 'Info', checked: layout.followers(id).some(f => f.kind === 'preview' && f.info), run: () => togglePanePreview(id, true) } ] },
    { label: 'New tab', enabled: !(views.get(id) instanceof PreviewView), run: () => newTab(id) },
    { label: 'Hidden panes', enabled: layout.hiddenTops().length > 0, items: hiddenPanesMenu() },
    '-',
    { label: 'Branch', items: [
      { label: 'Detach from parent', enabled: child, run: () => detachPane(id) },
      { label: 'Attach to', enabled: parents.length > 0 && !scrap, items: parents.map(p => ({ label: title(p), swatch: colourOf(p), run: () => attachPane(id, p) })) },
      { label: 'Branch colour', enabled: child, items: Branches.map(b => ({
        label: `Branch ${b + 1}${free.includes(b) ? '' : ' (with a sibling)'}`, swatch: `var(--branch-${b})`, checked: pane.colour === b,
        run: () => setBranchColour(id, b) })) } ] },
    { label: 'Pin', enabled: child || !!scrap, checked: pane.pinned, run: () => togglePin(id) },
    '-',
    { label: 'Show', enabled: pane.kind !== 'preview', items: [['folders', 'Folders'], ['files', 'Files'], ['both', 'Folders and files']]
      .map(([content, label]) => ({ label, checked: (pane.content ?? 'both') === content,
        enabled: !(pane.kind === 'tree' && content === 'files'), run: () => setPaneContent(id, content) }))
      .concat(pane.kind === 'tree' && pane.source === null ? ['-', { label: 'Quick access', checked: pane.quickAccess !== false,
        enabled: settings.quickAccess !== false, run: () => setPaneQuickAccess(id, pane.quickAccess === false) }] : []) },
    { label: 'Shape', enabled: pane.kind !== 'preview' && !scrap, items: [['tree', 'Tree'], ['list', 'One folder']]
      .map(([kind, label]) => ({ label, checked: pane.kind === kind, run: () => setPaneShape(id, kind) })) },
    { label: 'Hidden items', enabled: pane.kind !== 'preview', checked: pane.kind !== 'preview' && showsHidden(id),
      run: () => setPaneHidden(id, !showsHidden(id)) },
    { label: pane.filter ? `Filter: ${pane.filter}...` : 'Filter...', enabled: pane.kind !== 'preview', run: () => askPaneFilter(id) },
    '-',
    { label: 'Close pane', run: () => closePane(id) },
  ];
}

// A top tree's Quick access area shown or not (plan 23 3.4), from its pane menu.
function setPaneQuickAccess(id, on) {
  layout.pane(id).quickAccess = on ? undefined : false;
  views.get(id)?.quickAccessChanged();
  tellLayout();
}

// The view of a one-folder pane (plan 03 3.1): details (its columns) or icons.
function setPaneView(id, view) {
  const pane = layout.pane(id), v = views.get(id);
  if (!pane || !(v instanceof ListView)) return;
  pane.view = view === 'icons' || view === 'thumbs' ? view : undefined;
  v.colhead.hidden = v.iconsView() || v.thumbsView();
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
let runId = '';   // this run of Foldex (AppHost.RunId): kept with the layout, for its scraps (plan 06 3.2)
const windowLayout = () => JSON.parse(JSON.stringify({ panes: layout.toJSON(), docks: docks.toJSON(), active: activePane, run: runId,
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
    // Foldex started again since (plan 06 3.2): its scraps in the panes go, a docked one comes back empty.
    if (saved.run !== runId) {
      const after = scrapsAfterRestart([...panes.panes.values()], id => placed.areaOf(id));
      for (const id of after.remove) {
        panes.remove(id);
        placed.remove(id);
      }
      for (const id of after.empty) panes.pane(id).items = [];
    }
    const ids = placed.panes().filter(id => panes.pane(id));
    if (!ids.length) return false;
    Object.assign(layout, { panes: panes.panes, root: panes.root, next: panes.next });
    Object.assign(docks, { areas: placed.areas, sizes: placed.sizes });
    for (const id of placed.panes()) if (!layout.pane(id)) docks.remove(id);
    for (const id of [...layout.panes.keys()]) if (!docks.find(id) && !layout.pane(id).away) layout.remove(id);
    for (const id of docks.panes()) {
      const view = makeView(id);
      views.set(id, view);
      if (view instanceof LogView) logPane = view;
      else if (view instanceof PreviewView && layout.pane(id).source === null) {
        if (view instanceof InfoView) infoPane = view;
        else preview = view;
      }
    }
    renderDock();
    let firstTree = path ? null : true;
    for (const [id, view] of views) {
      if (view instanceof TreeView && view.folder) view.ready = view.init();
      else if (view instanceof TreeView) {
        const focus = firstTree === null ? path : layout.state(id).focus;
        firstTree = true;
        view.ready = view.init().then(() => focus ? view.reveal(focus) : view.select(ThisPC));
      } else if (view instanceof ScrapView) view.addIds(layout.pane(id).items ?? []);
      else if (view instanceof ListView) {
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
  infoPane = null;
  logPane = null;
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

// A new root: a tree of folders (3.4, New pane), in the left area (or at `place`), on `path` or else This PC; `top`:
// that folder as its top (Root, plan 26 3.11), focused.
function newRootPane(path, place = { area: 'left' }, top = null) {
  // Its own colour, not one another root is drawn in (a root without one is drawn in the first branch's).
  const drawn = [...layout.panes.values()].filter(p => p.source === null && p.colour === null).map(p => layout.pathColour(p.id));
  const id = layout.add({ kind: 'tree', content: 'folders' });
  layout.pane(id).colour = layout.newColour(drawn);
  if (top) layout.pane(id).top = top;
  const tree = placeView(new TreeView(id), place);
  activate(id);
  tree.body.focus();   // the keyboard in it (the arrows, Page Up / Down are the pane's own)
  tree.ready = tree.init().then(() => top ? tree.reveal(top) : path ? tree.reveal(path) : tree.select(ThisPC));
  return tree;
}

// Root in an existing pane without a parent (plan 26 3.11): a tree gets the folder as its top; a list shows ".." from
// now on and goes there.
function setPaneTop(id, folder) {
  const v = views.get(id);
  if (v instanceof TreeView) return v.setTop(folder);
  layout.pane(id).top = true;
  goTo(id, folder);
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
  if (view === infoPane) infoPane = null;
  if (view === logPane) {
    logPane = null;
    queueMicrotask(drawLogButton);
  }
  view.el.remove();
  views.delete(id);
  iconUsers.delete(view);
  layout.remove(id);
  docks.remove(id);
  renderDock();
  // The keyboard stays in the active pane when another one closed (the preview off with Alt+P); else the first.
  const kept = activePane !== id && views.has(activePane) ? activePane : null;
  activePane = null;
  const next = kept ?? docks.panes().find(p => docks.visible(p) && views.get(p));
  if (next) {
    activate(next);
    views.get(next).body.focus();
  } else status('No panes left: New pane (View > Panes, Ctrl+Alt+Shift+N) makes one.');
  drawHeads();
  ribbonRefresh();
}

// Ctrl+O (Layout.toggle, as Xplorer2's): hides the other child of a parent, shows a hidden one again, or makes a new
// one. A pane hidden goes with the panes below it; each keeps its connection, its state and where it was docked
// (Docks.placeOf), its view goes; it is in Hidden panes (View > Panes, the pane menu, the status bar) until shown.
function togglePane() {
  if (!layout.pane(activePane) || views.get(activePane) instanceof PreviewView) return;
  const r = layout.toggle(activePane);
  if (r.hide) {
    for (const id of r.hide) hidePane(id);
    renderDock();
    drawHeads();
    ribbonRefresh();
    views.get(activePane)?.body.focus();
  } else if (r.show) unhidePane(r.show);
  else {
    const view = newChildPane(r.newChild, 'right', { pane: r.beside, side: 'right' });
    view.body.focus();
  }
}

function hidePane(id) {
  const at = Date.now();
  for (const p of layout.subtree(id).reverse()) {
    const pane = layout.pane(p), view = views.get(p);
    if (pane.away || !view) continue;
    pane.away = { place: docks.placeOf(p) ?? { area: 'center' }, at, title: view.tabTitle() };
    if (view === preview) {
      preview.close();
      preview = null;
    }
    if (view === infoPane) infoPane = null;
    if (view === logPane) {
      logPane = null;
      queueMicrotask(drawLogButton);
    }
    view.el.remove();
    views.delete(p);
    iconUsers.delete(view);
    docks.remove(p);
  }
}

// A hidden pane shown again where it was (beside the pane it was next to, else in its area), with the panes hidden
// with it; each on what it showed, a child on what its parent shows when it is in the branch shown. The keyboard
// stays where it is.
function unhidePane(id) {
  const shown = [];
  for (const p of layout.subtree(id)) {
    const pane = layout.pane(p);
    if (!pane?.away) continue;
    const { place } = pane.away;
    delete pane.away;
    const view = makeView(p);
    if (view instanceof LogView) logPane ??= view;
    else if (view instanceof InfoView && pane.source === null) infoPane ??= view;
    else if (view instanceof PreviewView && pane.source === null && !preview) preview = view;
    placeView(view, place.pane != null && docks.find(place.pane) ? place : { area: place.area ?? 'center' });
    shown.push(view);
  }
  for (const view of shown) {
    const s = layout.state(view.id);
    if (view instanceof TreeView) view.ready = view.folder ? view.init() : view.init().then(() => s.focus ? view.reveal(s.focus) : view.select(ThisPC));
    else if (view instanceof PreviewView) view.show(layout.state(layout.pane(view.id).source).focus);
    else if (view instanceof ScrapView) view.addIds(layout.pane(view.id).items ?? []);
    else if (view instanceof ListView && s.location) view.load(s.location);
  }
  followParent(id);
  for (const v of views.values()) v.el.classList.toggle('active', v.id === activePane);
  drawHeads();
  ribbonRefresh();
  views.get(activePane)?.body.focus();
}

// The hidden panes, the last hidden first: a click shows one again.
function hiddenPanesMenu() {
  const tops = layout.hiddenTops();
  if (!tops.length) return [{ label: 'No hidden panes', enabled: false }];
  const titleOf = id => views.get(id)?.tabTitle() ?? layout.pane(id)?.away?.title ?? id;
  return tops.map(p => ({ label: p.source !== null ? `${p.away.title} (child of ${titleOf(p.source)})` : p.away.title, run: () => unhidePane(p.id) }));
}

// On the status bar while panes are hidden: how many; a click opens Hidden panes, upward.
function drawHiddenPanes() {
  const el = $('hidden-panes'), n = layout.hiddenTops().length;
  el.hidden = !n;
  el.textContent = n === 1 ? '1 hidden pane' : `${n} hidden panes`;
}
$('log-button').addEventListener('click', () => toggleLog());
$('hidden-panes').addEventListener('mousedown', e => {
  e.preventDefault();
  const r = $('hidden-panes').getBoundingClientRect();
  openMenu(r.left, r.top, hiddenPanesMenu());
  const el = document.querySelector('.menu');
  if (el) el.style.top = `${Math.max(0, r.top - el.offsetHeight - 2)}px`;
});

// The preview pane (Preview on the ribbon, Alt+P): a child of the active list, or of the first list, at its right.
// The Info pane (Alt+I): everything Windows knows of the item a list focuses; a child of the active list, or of the
// first list, below the preview when there is one, else at the list's right.
function toggleInfo() {
  if (infoPane) return closePane(infoPane.id);
  infoPane = globalPane(true);
}

// The global preview (Alt+P): a pane without a parent, in the right area (below the global Info pane when there is
// one), showing the item the active pane focuses (showGlobal).
function togglePreview() {
  if (preview) return closePane(preview.id);
  preview = globalPane(false);
}

function globalPane(info) {
  const id = layout.add({ kind: 'preview' });
  if (info) layout.pane(id).info = true;
  const other = info ? preview : infoPane;
  const view = placeView(info ? new InfoView(id) : new PreviewView(id), other ? { pane: other.id, side: info ? 'bottom' : 'top' } : { area: 'right' });
  view.show(activePane && !(views.get(activePane) instanceof PreviewView) ? layout.state(activePane).focus : null);
  drawHeads();
  views.get(activePane)?.body.focus();   // the keyboard stays in the pane that had it
  return view;
}

// A preview or Info pane of one pane (the pane menu's New child pane, the ribbon's Pane preview and Pane info): its
// child at its right, in the branch it shows, following only its focus. A second time: that one closed.
function togglePanePreview(id, info) {
  const pane = layout.pane(id);
  if (!pane || views.get(id) instanceof PreviewView) return;
  const had = layout.followers(id).find(f => f.kind === 'preview' && !!f.info === info);
  if (had) return closePane(had.id);
  const child = layout.add({ source: id, kind: 'preview', colour: layout.followers(id).length ? layout.keyOf(id) : null });
  if (info) layout.pane(child).info = true;
  const view = placeView(info ? new InfoView(child) : new PreviewView(child), { pane: id, side: 'right' });
  view.show(layout.state(id).focus);
  drawHeads();
  views.get(activePane)?.body.focus();   // the keyboard stays in the pane that had it
}
// Ctrl+Alt+arrow keys: the keyboard to the pane at that side of the active one, as they are on screen (docks.js
// paneOnSide); only panes shown (no tab behind another, no hidden pane).
function toSide(side) {
  const rect = id => { const r = views.get(id).el.getBoundingClientRect(); return { id, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const shown = docks.panes().filter(id => docks.visible(id) && views.get(id));
  if (!shown.includes(activePane)) return;
  focusPane(paneOnSide(rect(activePane), shown.map(rect), side));
}

function cyclePane(step) {
  const order = docks.panes().filter(id => docks.visible(id) && views.get(id));
  const next = order[(order.indexOf(activePane) + step + order.length) % order.length];
  views.get(next)?.body.focus();
}

// ---------- Folders shown are watched (3.8) ----------

// The host is told which folders this window shows (every list's folder, the folders open in a tree, the folders of a
// scrap's entries), once that rests.
let watchTimer = 0, watchedNow = '';
const ScrapWatchMax = 100;   // folders watched for all scraps of a window: a watcher each (chosen, not measured)
function tellWatched() {
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    const folders = new Set();
    let scrapFolders = 0;
    for (const v of views.values()) {
      if (v instanceof ListView && v.location) folders.add(v.location);
      // A scrap: the folders its entries are in, up to ScrapWatchMax of them (plan 06 3.1); the rest are checked on F5
      // and after Foldex's own file operations.
      if (v instanceof ScrapView) for (const x of v.all) {
        if (scrapFolders >= ScrapWatchMax) break;
        if (!folders.has(folderOf(x.id))) scrapFolders++;
        folders.add(folderOf(x.id));
      }
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

// A folder or place shown changed: the lists showing it put in the items that changed (`ids`, from the folder cache or
// the place cache) where they are, or read it again (no ids: changes lost, or too many), a tree its subfolders.
function folderChanged(folder, ids = null) {
  for (const v of views.values()) {
    if (v instanceof ScrapView) {
      const there = v.all.filter(x => same(folderOf(x.id), folder)).map(x => x.id);
      if (there.length) v.verify(there);
    }
    if (v instanceof ListView && same(v.location, folder)) v.patch(ids);
    if (v instanceof TreeView) {
      if (v.folder && same(v.root, folder)) v.patch(null, ids);
      for (const n of v.placesOf(folder)) if (n.children) v.patch(n, ids);
    }
  }
}

// ---------- The click that brings the window back (setting ignoreActivationClick; as LexPen) ----------

// It only brings the window to the front. After the window lost the focus, the next press that comes with the focus
// back (before it, or just after it) goes no further: its press, release and click are stopped before anything sees
// them (on the window, in the capture phase). The title bar is Windows' own and works at once. A double click to
// bring the window back: every press, release, click and dblclick until Windows' double-click time has passed after
// the last of them is stopped as well, so it does not act as a click or a double click (opening an item); a click
// after that acts at once. Back by the keys (Alt+Tab) is no click.
const activation = { away: false, back: 0, until: 0, double: 500 };
addEventListener('blur', () => { activation.away = true; });
addEventListener('focus', () => { activation.back = performance.now(); });
addEventListener('keydown', () => { activation.away = false; activation.until = 0; }, true);
const activationEating = () => performance.now() < activation.until;
// Not in front, with the setting: the page answers no mouse at all, not even hovering (no hover colours, tooltips or
// wheel; app.css body[data-inert]); the click that brings it back still reaches the window (above). A drag from
// another program still lands: while it is over the window, the page answers again.
const setInert = on => document.body.toggleAttribute('data-inert', on && settings.ignoreActivationClick !== false);
addEventListener('blur', () => setInert(true));
addEventListener('focus', () => setInert(false));
addEventListener('dragenter', () => setInert(false), true);
addEventListener('dragleave', e => { if (!e.relatedTarget && !document.hasFocus()) setInert(true); }, true);
addEventListener('drop', () => setTimeout(() => setInert(!document.hasFocus())), true);
addEventListener('pointerdown', e => {
  const now = performance.now();
  const first = activation.away && (!document.hasFocus() || now - activation.back < 500);
  activation.away = false;
  if ((!first && !activationEating()) || settings.ignoreActivationClick === false) return;
  activation.until = now + activation.double;
  e.preventDefault();   // no mousedown, mouseup after it
  e.stopImmediatePropagation();
}, true);
for (const type of ['mousedown', 'mouseup', 'pointerup', 'click', 'dblclick', 'auxclick', 'contextmenu'])
  addEventListener(type, e => {
    if (!activationEating()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (type === 'pointerup') activation.until = performance.now() + activation.double;   // a next press may follow
  }, true);

// With the setting ignorePaneActivationClick: a press in the body of a pane that is not the active one only makes it the
// active pane (the keyboard to it); it selects, opens or presses nothing there, a double click included (stopped as
// above). Its head (title, menu, close) acts at once. Nor does the mouse light anything in such a pane (no hover colours
// or tooltips; app.css body[data-pane-inert]): only its body itself answers the mouse, so it still scrolls and the press
// still lands.
const setPaneInert = (on = true) => document.body.toggleAttribute('data-pane-inert', on && !!settings.ignorePaneActivationClick);
// A drag answers in every pane (a drop on a folder row of a pane that is not active).
addEventListener('dragenter', () => setPaneInert(false), true);
addEventListener('dragleave', e => { if (!e.relatedTarget) setPaneInert(); }, true);
addEventListener('drop', () => setPaneInert(), true);
addEventListener('dragend', () => setPaneInert(), true);
addEventListener('pointerdown', e => {
  if (!settings.ignorePaneActivationClick || e.button !== 0) return;
  const el = e.target.closest?.('.pane[data-pane]');
  const id = el?.dataset.pane;
  if (!id || id === activePane || !e.target.closest('.body') || !views.has(id)) return;
  activation.until = performance.now() + activation.double;
  e.preventDefault();
  e.stopImmediatePropagation();
  views.get(id).body.focus();
}, true);

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
  if (views.get(id) instanceof ScrapView) return status('A scrap follows no other pane.', true);
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

// A child stops following its parent; a scrap (never a child) is kept after a restart (plan 06 3.2).
function togglePin(id) {
  const pane = layout.pane(id);
  if (pane?.kind === 'scrap') {
    pane.pinned = !pane.pinned;
    drawHeads();
    return ribbonRefresh();
  }
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
  return !!item?.folder && !!treeFor(activePane)?.place(item.id)?.expanded;
}

async function toggleFolder(item) {
  if (!item?.folder) return;
  const tree = treeFor(activePane);
  if (!tree) return execute(activePane, item);   // no tree to open it in: as a double-click
  const node = tree.place(item.id);
  if (node?.expanded) await tree.expand(node, false);
  else {
    // In a child the parent opens it, and the child follows (3.3).
    if (tree.id !== activePane) {
      await tree.reveal(item.id);
      apply(layout.focus(tree.id, item));
    }
    if (tree.place(item.id)) await tree.expand(tree.place(item.id));
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
  if (before.quickAccess !== settings.quickAccess) for (const v of views.values()) if (v instanceof TreeView) v.quickAccessChanged();
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

// ---------- File operations (their lines: the log, logOp) ----------

// Every list read again after something changed files (a file operation `op`, a verb of Explorer's menu): its
// selection and focus kept, what the operation put there selected (ListView.reread).
function reloadLists(op = null) {
  for (const v of views.values()) if (v instanceof ListView && v.location) v.message ? v.load(v.location) : v.reread(op);
}

// ---------- Events ----------

const events = {
  hello(m) {
    settings = m.settings.values;
    themes = m.themes.themes;
    applyTheme();
    setPaneInert();
    setKeys(m.keys);
    setRibbon(m.ribbon);
    version = m.version + (m.commit ? ` (${m.commit})` : '');
    if (m.doubleClickTime > 0) activation.double = m.doubleClickTime;
    setBars(m.bars);
    setColumnSets(m.columnSets);
    post({ op: 'drives' });
    for (const o of m.ops) logOp(o);
    settingsProblems(m);
    showProject(m.project);
    runId = m.run;
    searches = m.searches;
    renames = m.renames ?? renames;
    bookmarksCame(m.bookmarks);
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
    setPaneInert();
    settingsProblems(m);
  },
  open(m) {
    const tree = views.get(layout.root);
    if (m.paths[0] && tree instanceof TreeView) tree.reveal(m.paths[0]);
  },
  listing(m) {
    const l = listeners.get(m.channel);
    if (!l || l.req !== m.req) return;
    l.got += m.entries.length;
    l.onPart(m.entries);
    showProgress();
  },
  listCount(m) {
    const l = listeners.get(m.channel);
    if (!l || l.req !== m.req) return;
    l.total = m.count;
    l.cached = !!m.cached;   // from the folder cache: no progress bar (plan 24 3.9)
    showProgress();
  },
  listed(m) {
    const l = listeners.get(m.channel);
    if (!l || l.req !== m.req) return;   // an answer for a location left already
    listeners.delete(m.channel);
    l.onDone(m);
    showProgress();
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
    else if (m.verb === 'rename') startRename(activeView(), layout.state(activePane).focus);   // Explorer's Rename: in place
    else if (m.verb) setTimeout(() => {
      reloadLists();
      for (const v of scrapViews()) v.verify(v.ids());   // a scrap's own items, deleted from Explorer's menu
    }, 300);
  },
  menuTexts(m) { window.__spike.events.push({ menuTexts: m.texts, error: m.error }); },
  verbDone(m) { window.__spike.events.push({ verbDone: m.ok, error: m.error }); setTimeout(reloadLists, 300); },
  executeFailed(m) { status(m.error, true); },
  folderChanged(m) { folderChanged(m.folder, m.ids ?? null); },
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
    logOp(m.op);
    if (!m.op.finished) return;
    fileOpDone(m.op);   // a new item renamed (rename.js)
    reloadLists(m.op);
    // A scrap's entries follow what moved and drop what was deleted (plan 06 3.1).
    for (const v of scrapViews()) {
      if (m.op.moved?.length) v.follow(m.op.moved);
      if (m.op.ids?.length) v.verify(v.all.map(x => x.id).filter(id => m.op.ids.some(o => same(o, id))));
    }
  },
  // Thumbnails made (docs/plans/executed/22-PLAN-thumbnails.md 3.1).
  thumbs(m) { thumbsCame(m); },
  // A search for a scrap (plan 06 3.4): what it found so far, and its end.
  found(m) { views.get(m.channel)?.add?.(m.entries); },
  searched(m) { views.get(m.channel)?.searched?.(m); },
  entries(m) { columnReply(m); },
  searches(m) { searches = m.searches; },
  // The bookmarks changed (in any window; plan 26 3.1); Edit asked from Windows' menu (3.8); answers to plain questions.
  bookmarks(m) { bookmarksCame(m); },
  bookmarkEdit(m) { editBookmark(m.location); },
  answer(m) { columnReply(m); },
  renames(m) { renames = m.renames; },
  previewShown(m) {
    window.__spike.events.push({ previewShown: m.path, handler: m.handler, error: m.error });
    // Every preview showing that file (another file meanwhile: nothing).
    for (const v of views.values()) {
      if (!(v instanceof PreviewView) || v instanceof InfoView || !same(m.path, v.path)) continue;
      v.native = !!m.handler && !m.error;   // Windows' own window over the pane (previewCoverCheck)
      if (m.own) v.showOwn(m.own);
      else if (m.error) v.message('This item cannot be previewed.');
    }
    // Another file shown while covered: its window came up over the dialog; a picture of it instead.
    if (previewCover.on && m.handler && !m.error) post({ op: 'previewSnapshot' });
    previewCoverCheck();
  },
  // The picture of Windows' preview while a dialog or menu is over it (previewCoverCheck).
  previewSnapshot(m) {
    const v = nativePreview();
    if (!previewCover.on || !m.url || !v) return;
    previewCover.img?.remove();
    previewCover.img = Object.assign(document.createElement('img'), { className: 'preview-cover', src: m.url });
    v.body.append(previewCover.img);
  },
};

host.addEventListener('message', e => events[e.data.event]?.(e.data));
// The focus in another window: the active pane's ring and head dimmed (app.css), as LexPen's.
addEventListener('blur', () => document.body.toggleAttribute('data-focus-away', true));
addEventListener('focus', () => document.body.toggleAttribute('data-focus-away', false));
darkQuery.addEventListener('change', applyTheme);
post({ op: 'ready' });
