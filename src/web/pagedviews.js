'use strict';
// A tree, a list or a scrap whose code runs in a page of its own (docs/plans/executed/14-PLAN-floating-panes.md 3.0, stage 6):
// view.html, with the same scripts as this page, showing that one pane (viewpage.js); it asks the host itself. Here
// are its head and tab, its frame docked (its window floating, PaneForm) and a stand-in this page uses as it uses a
// view of its own: what the stand-in knows (where it is, the focused and selected items, its pane's own settings) its
// page tells (sync); a method that draws or reads a folder runs there (sent, without an answer). This page keeps the
// layout: its page gets it whole when it changes, and with every method sent its pane as this page has it. Loaded after
// app.js.

// The kinds of pane whose views are pages of their own.
const PagedKinds = new Set(['tree', 'list', 'scrap']);
// What of a pane this page decides (its connections, its place, its history, its name); the rest its page does.
const WindowFields = ['id', 'source', 'colour', 'pinned', 'activeKey', 'lastKey', 'lastChild', 'away', 'floating', 'floatBounds',
  'histories', 'recall', 'kind', 'fixed', 'info', 'path', 'name'];
// The actions that run in the page of the active pane: they work on its rows themselves.
const PageActions = new Set(['item.rename', 'folder.new', 'file.new']);
// The methods of a stand-in answered here, from what its page told: they read the layout and that only.
const PagedHere = new Set(['ids', 'content', 'iconsView', 'thumbsView', 'shows', 'tabTitle', 'folderTitle', 'showsFiles', 'quickAccessShown', 'topFolder']);
// The events of the host every pane's page gets as well: what they change is used there too.
const PageEvents = new Set(['settings', 'columnSets', 'bookmarks', 'searches', 'renames', 'filters', 'propList', 'fileOp', 'folderChanged',
  'filterStale', 'folderSizes', 'linkSource', 'helper']);

const isPaged = v => !!v?.paged;

// While this page waits for its hello, a hidden pane's page of no pane loads the scripts in the panes' process, so the
// pages of the layout's panes load faster; gone once one of them is ready.
let warmFrame = null;
if (!PanePage) {
  warmFrame = Object.assign(document.createElement('iframe'), { src: `${PaneOrigin}/view.html?pane=warm`, hidden: true });
  document.body.append(warmFrame);
}

// The stand-in of a pane of a kind in PagedKinds: an object of its view's class (instanceof works as for a view here),
// without its rows.
function pagedView(id) {
  const kind = layout.pane(id).kind;
  const Base = kind === 'tree' ? TreeView : kind === 'scrap' ? ScrapView : ListView;
  const v = Object.create(Base.prototype);
  Object.assign(v, { id, paged: true, entries: [], all: [], selected: new Set(), location: null, name: null, message: null, count: 0,
    answers: new Map() });
  v.el = paneElement(id, kind, '');
  v.el.classList.add('page');
  v.body = v.el.querySelector('.body');
  v.rows = v.el.querySelector('.rows');
  v.rows.replaceChildren();
  v.channel = paneChannel({ id, page: `view.html?pane=${id}`, title: kind, view: () => v.rows,
    // Its page shows the pane's state, unless methods sent before it was ready say what (they come after this).
    state: () => new Map([['init', { kind: 'init', hello: pageHello, layout: layout.toJSON(), active: activePane, record: layout.pane(id),
      restore: ![...(v.channel.floating ? v.channel.floatQueue : v.channel.queue).keys()].some(k => k.startsWith('call:')) }]]),
    receive: m => pagedReceive(v, m), menu: () => paneMenu(id) });
  v.channel.frameEl();
  v.body.addEventListener('focus', () => v.channel.focus());
  v.itemCount = () => v.count;
  v.locationText = () => v.text ?? '';
  // A tree: whether it shows its parent's folder, and of its rows what this page asks (the focused one, which are open).
  if (kind === 'tree') {
    Object.assign(v, { folder: layout.pane(id).source !== null, root: null, flat: [], open: new Set(), focusNode: null, qa: null });
    v.node = nid => nid != null && v.focusNode && same(v.focusNode.id, nid) ? v.focusNode : null;
    v.place = nid => nid == null ? null : v.node(nid) ?? (v.open.has(nid.toLowerCase()) ? { id: nid, expanded: true } : null);
    v.placesOf = nid => v.node(nid) ? [v.node(nid)] : [];
    v.focused = () => v.focusNode;
    v.quickAccessShortcut = () => v.qa;
  }
  // A scrap's head: Stop while it searches, and its X (ScrapView).
  if (kind === 'scrap') {
    v.el.classList.add('scrap');
    const button = (cls, html, title, run) => Object.assign(document.createElement('button'), { className: `scrap-button ${cls}`, innerHTML: html, title, onclick: run });
    v.stopButton = button('scrap-stop', 'Stop', 'Stop the search', () => views.get(id)?.stop());
    v.stopButton.hidden = true;
    v.el.querySelector('.marks').before(v.stopButton, button('scrap-close', '<svg viewBox="0 0 16 16"><path d="M4 3l4 4 4-4 1 1-4 4 4 4-1 1-4-4-4 4-1-1 4-4-4-4z"/></svg>',
      'Close this scrap (nothing on disk changes)', () => closePane(id)));
  }
  // Floating, its window goes (closePane, applyPreset).
  v.close = () => { if (v.channel.floating) post({ op: 'paneDock', pane: id }); };
  v.moved = () => {};
  let calls = 0;
  return new Proxy(v, {
    get(t, p, r) {
      if (typeof p !== 'string' || Object.hasOwn(t, p) || PagedHere.has(p)) return Reflect.get(t, p, r);
      const f = t[p];
      if (typeof f !== 'function') return f;
      // A method of the view: in its page, with the pane as this page has it now (before the page is ready, kept until it is;
      // then without the pane: the page starts on it as it is then, init). Its answer comes as a promise.
      return (...args) => {
        const ready = t.channel.floating ? t.channel.floatReady : t.channel.ready;
        const req = ++calls;
        t.channel.send({ kind: 'call', key: `call:${req}`, req, method: p, args: pagedArgs(args), record: ready ? layout.pane(id) : undefined });
        return new Promise(done => t.answers.set(req, done));
      };
    },
  });
}

// What can go in a message of the arguments of a method (an event: its keys only).
const pagedArgs = args => args.map(a => a instanceof Event ? { shiftKey: a.shiftKey, ctrlKey: a.ctrlKey, altKey: a.altKey } : a);

// What its page says.
function pagedReceive(v, m) {
  const id = v.id;
  warmFrame?.remove();
  warmFrame = null;
  switch (m.kind) {
    case 'sync': {
      const pane = layout.pane(id);
      if (!pane) return;
      for (const [k, value] of Object.entries(m.fields)) if (!WindowFields.includes(k)) pane[k] = value;
      // What it holds: a scrap's ids (its watched folders, a search in it), else how many.
      Object.assign(v, { location: m.location, name: m.name, message: m.message, count: m.count, entries: m.entries, text: m.text,
        selected: new Set(m.selected), all: m.allIds ? m.allIds.map(x => ({ id: x })) : new Array(m.all), searching: m.searching, watch: m.watch });
      headTitle(v.el, m.title, m.crumbs);
      if (v.stopButton) v.stopButton.hidden = !m.searching;
      if (m.tree) Object.assign(v, { folder: m.tree.folder, root: m.tree.root, focusNode: m.tree.focus, open: new Set(m.tree.open), qa: m.tree.qa });
      // The widths it shows its columns at: Manage column sets opened from it shows them.
      if (JSON.stringify(m.widths ?? null) !== JSON.stringify(v.widths ?? null)) {
        v.widths = m.widths ?? null;
        columnsFitted(v);
      }
      if (m.tell) tellLayout();
      if (m.tabs) drawTabs();
      if (m.ribbon) ribbonRefresh();
      if (activePane === id) showLocation(v.locationText());
      return;
    }
    // Typing in it (search.js): the search bar shows it; resting with a text long enough, the bar filters it.
    case 'searchShow': return activePane === id && showSearch(m.text ?? undefined);
    case 'typed':
      typing = { id, text: m.text };
      return typingRests();
    case 'callDone':
      v.answers.get(m.req)?.(m.value);
      return v.answers.delete(m.req);
    case 'focus': return focusItem(id, m.item);
    case 'step': return recordStep();
    case 'execute': return execute(id, m.item);
    case 'goTo': return goTo(id, m.path);
    case 'global': return activePane === id && showGlobal(m.id);
    case 'status': return status(m.text, m.warn, m.detail);
    case 'ribbon': return ribbonRefresh();
    case 'watched': return tellWatched();
    case 'action':
      activate(id);
      return runAction(m.name, m.params, { from: 'page' });
    case 'callPane': return views.get(m.pane)?.[m.method]?.(...m.args);
    case 'followNow': return followNow(id, m.item);
    case 'windowFn': return globalThis[m.fn]?.(...m.args);   // a function of this page asked there (viewpage.js WindowFunctions)
    // Its page lost the focus: whether Foldex is away is the host's word (app.js windowActiveCame), not a page's
    // focus, so nothing. It has it again: the window answers the mouse.
    case 'blurred': return;
    case 'back':
      setInert(false);
      return tellPagesAway(false);
  }
}

function tellPagesAway(on) {
  for (const v of views.values()) if (isPaged(v)) v.channel.send({ kind: 'away', key: 'away', on });
}
addEventListener('focus', () => { if (!PanePage) tellPagesAway(false); });

// The layout changed (drawHeads): every pane's page gets it.
function sendPagedLayout() {
  for (const v of views.values()) if (isPaged(v)) v.channel.send({ kind: 'layout', layout: layout.toJSON(), active: activePane });
}

// An action of PageActions while such a pane is the active one: run in its page. Its search text set here (the search
// bar): there too.
if (!PanePage) {
  const setSearchHere = setSearch;
  setSearch = (id, text) => {
    if (isPaged(views.get(id))) views.get(id).channel.send({ kind: 'search', key: 'search', text });
    setSearchHere(id, text);
  };
  const runHere = runAction;
  let sent = 0;
  runAction = (name, params = [], ctx = {}) => {
    const v = activeView();
    if (!isPaged(v) || !PageActions.has(actionOf(name)?.name)) return runHere(name, params, ctx);
    if (!actionEnabled(name, params)) return ctx.from === 'key' ? PASS : undefined;
    v.channel.send({ kind: 'action', key: `action:${++sent}`, name, params });
  };
}

// Functions of this page that work on a view's rows themselves (its header, its scroll position): for such a pane, run
// in its page, on the pane as this page has it. What they change of the pane is changed here too at once (PageRecord),
// else a method or the layout sent before its page tells it back would take the pane back to what it was (Views >
// River drawn as details).
const PageRecord = {
  setPaneView: (pane, view) => { pane.view = paneViewOf(view); },
  thumbZoom: (pane, step) => { pane.thumbSize = zoomedThumbSize(pane, step); },
};
if (!PanePage) {
  let runs = 0;
  for (const name of Object.keys(PageRecord)) {
    const here = globalThis[name];
    globalThis[name] = (id, ...args) => {
      const v = views.get(id);
      if (!isPaged(v)) return here(id, ...args);
      // The pane as it was (a copy: a message kept until the page is ready must not get the change made here).
      v.channel.send({ kind: 'run', key: `run:${++runs}`, fn: name, args, record: structuredClone(layout.pane(id)) });
      PageRecord[name](layout.pane(id), ...args);
    };
  }
}

// An item of a bookmark opened (bookmarks.js): focused by the list that lists its folder, in its page too.
if (!PanePage) {
  const focusWhenListedHere = focusItemWhenListed;
  focusItemWhenListed = (folder, item) => {
    for (const v of views.values()) if (isPaged(v) && v instanceof ListView) v.channel.send({ kind: 'global', key: 'focusWhenListed', fn: 'focusItemWhenListed', args: [folder, item] });
    focusWhenListedHere(folder, item);
  };
}

// What a pane's page starts with: the host's hello to this page (without its paths and layout), kept as the host's events
// change it; so a page asks the host nothing to start.
const pageHello = {};
if (!PanePage) {
  const helloHere = events.hello;
  events.hello = m => {
    const { paths, layout: saved, ...rest } = m;
    Object.assign(pageHello, rest, { ops: [] });
    helloHere(m);
  };
}
function keepForPages(m) {
  if (m.event === 'settings') Object.assign(pageHello, { settings: m.settings, themes: m.themes });
  else if (m.event === 'columnSets') pageHello.columnSets = m.columnSets;
  else if (m.event === 'bookmarks') pageHello.bookmarks = m;
  else if (m.event === 'searches') pageHello.searches = m.searches;
  else if (m.event === 'renames') pageHello.renames = m.renames;
  else if (m.event === 'filters') pageHello.filters = m.filters;
  else if (m.event === 'linkSource') pageHello.linkSource = m.kind ? { kind: m.kind, path: m.path } : null;
  else if (m.event === 'helper') pageHello.helper = m.running;
  else if (m.event === 'bars') pageHello.bars = m.bars;
  else if (m.event === 'project') pageHello.project = m.project;
}

// An event of the host for the panes' pages too (PageEvents).
function sendPagedEvent(m) {
  keepForPages(m);
  if (!PageEvents.has(m.event)) return;
  for (const v of views.values()) if (isPaged(v)) v.channel.send({ kind: 'event', key: `event:${m.event}:${m.op?.id ?? ''}:${m.folder ?? ''}`, msg: m });
}
