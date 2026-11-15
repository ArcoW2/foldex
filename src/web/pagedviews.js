'use strict';
// A tree, a list or a scrap whose code runs in a page of its own (docs/plans/14-PLAN-floating-panes.md 3.0, stage 6):
// view.html, with the same scripts as this page, showing that one pane (viewpage.js); it asks the host itself. Here
// are its head and tab, its frame docked (its window floating, PaneForm) and a stand-in this page uses as it uses a
// view of its own: what the stand-in knows (where it is, the focused and selected items, its pane's own settings) its
// page tells (sync); a method that draws or reads a folder runs there (sent, without an answer). This page keeps the
// layout: its page gets it whole when it changes, and with every method sent its pane as this page has it. Loaded after
// app.js.

// The kinds of pane whose views are pages of their own.
const PagedKinds = new Set(['list']);
// What of a pane this page decides (its connections, its place, its history); the rest its page does.
const WindowFields = ['id', 'source', 'colour', 'pinned', 'activeKey', 'lastKey', 'lastChild', 'away', 'floating', 'floatBounds',
  'histories', 'recall', 'kind', 'fixed', 'info', 'path'];
// The actions that run in the page of the active pane: they work on its rows themselves.
const PageActions = new Set(['item.rename', 'folder.new', 'file.new']);
// The methods of a stand-in answered here, from what its page told: they read the layout and that only.
const PagedHere = new Set(['ids', 'content', 'iconsView', 'thumbsView', 'shows', 'tabTitle', 'locationText']);
// The events of the host every pane's page gets as well: what they change is used there too.
const PageEvents = new Set(['settings', 'columnSets', 'bookmarks', 'searches', 'renames', 'propList', 'fileOp', 'folderChanged']);

const isPaged = v => !!v?.paged;

// The stand-in of a pane of a kind in PagedKinds: an object of its view's class (instanceof works as for a view here),
// without its rows.
function pagedView(id) {
  const kind = layout.pane(id).kind;
  const Base = kind === 'tree' ? TreeView : kind === 'scrap' ? ScrapView : ListView;
  const v = Object.create(Base.prototype);
  Object.assign(v, { id, paged: true, entries: [], all: [], selected: new Set(), location: null, name: null, message: null, count: 0 });
  v.el = paneElement(id, kind, '');
  v.el.classList.add('page');
  v.body = v.el.querySelector('.body');
  v.rows = v.el.querySelector('.rows');
  v.rows.replaceChildren();
  v.channel = paneChannel({ id, page: `view.html?pane=${id}`, title: kind, view: () => v.rows,
    // Its page shows the pane's state, unless methods sent before it was ready say what (they come after this).
    state: () => new Map([['init', { kind: 'init', layout: layout.toJSON(), active: activePane, record: layout.pane(id),
      restore: ![...(v.channel.floating ? v.channel.floatQueue : v.channel.queue).keys()].some(k => k.startsWith('call:')) }]]),
    receive: m => pagedReceive(v, m), menu: () => paneMenu(id) });
  v.channel.frameEl();
  v.body.addEventListener('focus', () => v.channel.focus());
  v.itemCount = () => v.count;
  // Floating, its window goes (closePane, applyPreset).
  v.close = () => { if (v.channel.floating) post({ op: 'paneDock', pane: id }); };
  v.moved = () => {};
  let calls = 0;
  return new Proxy(v, {
    get(t, p, r) {
      if (typeof p !== 'string' || Object.hasOwn(t, p) || PagedHere.has(p)) return Reflect.get(t, p, r);
      const f = t[p];
      if (typeof f !== 'function') return f;
      // A method of the view: in its page, with the pane as this page has it now (before the page is ready, kept until it is).
      // Kept until then, it goes without the pane: the page starts on it as it is then (init).
      return (...args) => {
        const ready = t.channel.floating ? t.channel.floatReady : t.channel.ready;
        t.channel.send({ kind: 'call', key: `call:${++calls}`, method: p, args: pagedArgs(args), record: ready ? layout.pane(id) : undefined });
      };
    },
  });
}

// What can go in a message of the arguments of a method (an event: its keys only).
const pagedArgs = args => args.map(a => a instanceof Event ? { shiftKey: a.shiftKey, ctrlKey: a.ctrlKey, altKey: a.altKey } : a);

// What its page says.
function pagedReceive(v, m) {
  const id = v.id;
  switch (m.kind) {
    case 'sync': {
      const pane = layout.pane(id);
      if (!pane) return;
      for (const [k, value] of Object.entries(m.fields)) if (!WindowFields.includes(k)) pane[k] = value;
      Object.assign(v, { location: m.location, name: m.name, message: m.message, count: m.count, entries: m.entries,
        selected: new Set(m.selected), all: new Array(m.all), searching: m.searching });
      v.el.querySelector('.title').textContent = m.title;
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
    case 'focus': return focusItem(id, m.item);
    case 'step': return recordStep();
    case 'execute': return execute(id, m.item);
    case 'goTo': return goTo(id, m.path);
    case 'global': return activePane === id && showGlobal(m.id);
    case 'status': return status(m.text, m.warn);
    case 'ribbon': return ribbonRefresh();
    case 'watched': return tellWatched();
    case 'action':
      activate(id);
      return runAction(m.name, m.params, { from: 'page' });
    case 'callPane': return views.get(m.pane)?.[m.method]?.(...m.args);
    // Its page lost the focus: to this page or another pane's (nothing), or to another program (the window away, its
    // next press only brings it back: app.js ignoreActivationClick). It has it again: the window is back.
    case 'blurred': {
      if (document.hasFocus()) return;
      activation.away = true;
      setInert(true);
      return tellPagesAway(true);
    }
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

// An event of the host for the panes' pages too (PageEvents).
function sendPagedEvent(m) {
  if (!PageEvents.has(m.event)) return;
  for (const v of views.values()) if (isPaged(v)) v.channel.send({ kind: 'event', key: `event:${m.event}:${m.op?.id ?? ''}:${m.folder ?? ''}`, msg: m });
}
