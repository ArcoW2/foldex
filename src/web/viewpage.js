'use strict';
// The page of a tree, a list or a scrap (docs/plans/14-PLAN-floating-panes.md 3.0, stage 6; view.html): the scripts of
// a window's page (app.js and the rest), showing one pane, PanePage. It asks the host itself (post) and is answered
// here. The layout is its window's (init, layout); what this pane does that concerns the others (its focus for its
// children, executing, going to a folder, its steps, an action of the window) goes there, and what it shows (sync), so
// its stand-in there (pagedviews.js) knows it. Docked, its window's page draws its head; floating, it draws its own.
// Loaded last.

const pageFloating = parent === window;   // in a window of its own
const WindowOrigin = 'https://foldex.example';
let pageView = null;

function toWindow(msg) {
  if (pageFloating) host.postMessage({ fromPane: msg });
  else parent.postMessage({ fromPane: msg }, WindowOrigin);
}

// ---------- The layout: its window's ----------

// The window's layout; of this pane only what the window decides (WindowFields), the rest this page keeps.
function takeLayout(json, active) {
  const mine = layout.pane(PanePage);
  const panes = new Map(json.panes.map(p => [p.id, p]));
  const theirs = panes.get(PanePage);
  if (mine && theirs) {
    for (const k of WindowFields) if (k in theirs) mine[k] = theirs[k]; else delete mine[k];
    panes.set(PanePage, mine);
  }
  Object.assign(layout, { panes, root: json.root, next: json.next });
  activePane = active;
}

// The pane whole as the window has it (with a method it sends): the same object kept, its columns too when the view
// shows its pane's own.
function takeRecord(record) {
  const mine = layout.pane(PanePage);
  if (!mine || !record) return;
  for (const k of Object.keys(mine)) if (!(k in record)) delete mine[k];
  Object.assign(mine, record);
  if (pageView?.cols && !pageView.cols.set) pageView.cols = paneColumns(PanePage);
}

function init(m) {
  if (pageView) return;
  takeLayout(m.layout, m.active);
  pageView = makeView(PanePage);
  views.set(PanePage, pageView);
  $('panes').append(pageView.el);
  drawHeads();
  if (m.restore) pageView.restore();   // where the pane is: its folder read
}

// ---------- What it shows, to its window (sync) ----------

let syncFlags = null, lastSync = '';
function syncSoon(flags = {}) {
  const first = !syncFlags;
  syncFlags = { ...syncFlags, ...flags };
  if (first) queueMicrotask(flush);
}

// Its pane's own settings and state, where it is, and the items focused and selected (what the window's actions and
// ribbon read); sent when something changed, before any message that needs it.
function flush() {
  const flags = syncFlags ?? {};
  syncFlags = null;
  const v = pageView;
  if (!v) return;
  const pane = layout.pane(v.id);
  const fields = Object.fromEntries(Object.entries(pane).filter(([k]) => !WindowFields.includes(k)));
  const focus = layout.state(v.id).focus;
  const shown = v instanceof ListView ? v.entries.filter(x => v.selected.has(x.id) || same(x.id, focus)).slice(0, 2000) : [];
  const msg = { kind: 'sync', fields, location: v.location ?? null, name: v.name ?? null, title: v.el.querySelector('.title').textContent,
    message: v.message ?? null, count: v.itemCount?.() ?? 0, entries: shown, selected: [...(v.selected ?? [])], all: v.all?.length ?? 0,
    searching: !!v.searching };
  const text = JSON.stringify(msg);
  if (text === lastSync && !Object.keys(flags).length) return;
  lastSync = text;
  toWindow({ ...msg, ...flags });
}

// ---------- What goes to the window ----------

const postHere = post;
const runHere = runAction;
let screenAt = { x: 0, y: 0 };   // the screen's place of this page's top left (CSS px), from the last pointer event
for (const type of ['pointerdown', 'pointermove', 'contextmenu'])
  addEventListener(type, e => { screenAt = { x: e.screenX - e.clientX, y: e.screenY - e.clientY }; }, true);
// A place for the host (Windows' menu): on the screen, as the host does not know where this page is.
post = msg => postHere(msg.op === 'menu' && Number.isFinite(msg.x)
  ? { ...msg, x: Math.round(msg.x + screenAt.x * devicePixelRatio), y: Math.round(msg.y + screenAt.y * devicePixelRatio), screen: true } : msg);
start = () => {};   // the layout is the window's (init)
// Its own head (docked hidden: the window's page draws it there) in the colours of the layout.
drawHeads = () => {
  if (!pageView) return;
  pageView.el.classList.toggle('active', pageView.id === activePane);
  drawHead(pageView, activePane !== null && layout.pane(activePane) ? branchChain(activePane).chain : []);
};
tellLayout = () => syncSoon({ tell: true });
drawTabs = () => syncSoon({ tabs: true });
ribbonRefresh = () => syncSoon({ ribbon: true });
showLocation = () => syncSoon();
drawHiddenPanes = () => {};
tellWatched = () => { flush(); toWindow({ kind: 'watched' }); };
focusItem = (paneId, item) => {
  layout.state(paneId).focus = item ? item.id : null;
  flush();
  toWindow({ kind: 'focus', item: item ? { id: item.id, folder: item.folder } : null });
};
recordStep = () => { flush(); toWindow({ kind: 'step' }); };
execute = (paneId, item) => { flush(); toWindow({ kind: 'execute', item }); };
goTo = (paneId, path) => { flush(); toWindow({ kind: 'goTo', path }); };
showGlobal = id => toWindow({ kind: 'global', id });
status = (text, warn = false) => toWindow({ kind: 'status', text, warn });
activate = id => { if (activePane !== id) toWindow({ kind: 'activate' }); };
openPaneMenu = (id, e) => {
  e.preventDefault();
  toWindow({ kind: 'menuAsk', x: e.clientX, y: e.clientY });
};
dragToDock = () => {};
dragConnector = () => {};
showSearch = text => toWindow({ kind: 'searchShow', text });
// Typing rests with a text long enough to filter: the window's search bar takes it (search.js).
typingRests = () => {
  if (!typing || typing.text.length < SearchFilterFrom) return;
  const { text } = typing;
  typing = null;
  clearTimeout(typedClear);
  toWindow({ kind: 'typed', text });
};
// An action of the window (a key here): run there, but those that work on this pane's rows (PageActions).
runAction = (name, params = [], ctx = {}) => {
  if (ctx.from === 'window' || !actionOf(name) || PageActions.has(actionOf(name).name)) return runHere(name, params, ctx);
  flush();
  toWindow({ kind: 'action', name, params });
};

// Another pane: its methods run in the window (a preview child shown, ...); `views` iterates this one only.
const viewHere = Map.prototype.get.bind(views);
const methodNames = new Set([ListView, TreeView, ScrapView, PreviewView].flatMap(C => Object.getOwnPropertyNames(C.prototype)));
const otherPane = id => new Proxy({ id }, {
  get: (t, p) => p === 'id' ? id : typeof p === 'string' && methodNames.has(p)
    ? (...args) => toWindow({ kind: 'callPane', pane: id, method: p, args: pagedArgs(args) }) : undefined,
});
Object.defineProperties(views, {
  get: { value: id => viewHere(id) ?? (layout.pane(id) ? otherPane(id) : undefined) },
  has: { value: id => !!layout.pane(id) },
  size: { get: () => layout.panes.size },
});

// Drawn again: the window may want to know what changed.
for (const C of [ListView, TreeView]) {
  const render = C.prototype.render;
  C.prototype.render = function (...args) {
    const out = render.apply(this, args);
    if (this === pageView) syncSoon();
    return out;
  };
}

// ---------- What comes from the window ----------

function fromWindow(m) {
  switch (m.kind) {
    case 'init': return init(m);
    case 'layout':
      takeLayout(m.layout, m.active);
      return pageView && drawHeads();
    case 'call':
      takeRecord(m.record);
      return pageView?.[m.method]?.(...m.args);
    case 'action': return runAction(m.name, m.params, { from: 'window' });
    case 'event':
      events[m.msg.event]?.(m.msg);
      if (m.msg.event === 'settings') pageView?.render();   // what the settings show in it (thumbs.js)
      return;
    case 'search':
      if (m.text) paneSearch.set(PanePage, m.text);
      else paneSearch.delete(PanePage);
      return;
    case 'menu': return windowMenu(m);
    case 'away':
      windowAway = activation.away = m.on;
      return setInert(m.on && !document.hasFocus());
  }
}
addEventListener('message', e => { if (e.origin === WindowOrigin && e.data?.toPane) fromWindow(e.data.toPane); });
if (pageFloating) host.addEventListener('message', e => { if (e.data?.toPane) fromWindow(e.data.toPane); });

// Its window's menu for this pane (floating: its own right-click on its head), drawn here; a choice runs there.
function windowMenu({ x, y, items }) {
  const own = list => list.map(item => item === '-' ? '-' : {
    label: item.label, checked: item.checked, enabled: item.enabled, key: item.key,
    items: item.items ? own(item.items) : undefined, run: () => toWindow({ kind: 'menuPick', id: item.id }),
  });
  openMenu(x, y, own(items));
}

// The keyboard given to the frame: into the pane (not out of a text box of its own).
addEventListener('focus', () => setTimeout(() => {
  if (!document.activeElement || document.activeElement === document.body) pageView?.body.focus();
}));
// The click that brings the window back (app.js, ignoreActivationClick) is the window's: the keyboard going from this
// pane to another of the window is no leaving. On a blur the window says whether it is away (another program has the
// focus): only then does a press here bring it back, and is it stopped.
let windowAway = false;
addEventListener('blur', () => {
  activation.away = windowAway;
  setInert(windowAway);
  setTimeout(() => toWindow({ kind: 'blurred' }), 50);
});
addEventListener('focus', () => toWindow({ kind: 'back' }));
// A press anywhere here: its pane the active one, the window's menus closed.
addEventListener('pointerdown', () => toWindow({ kind: 'activate' }), true);
document.documentElement.toggleAttribute('data-floating', pageFloating);

// Ready once the host's hello came (the settings, the keys, ...): then the window gives the layout.
const helloHere = events.hello;
events.hello = m => {
  helloHere({ ...m, paths: [], layout: null });
  toWindow({ kind: 'ready' });
};
post({ op: 'paneReady' });
