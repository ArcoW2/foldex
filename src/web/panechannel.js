'use strict';
// A pane's page and this window's page (docs/plans/executed/14-PLAN-floating-panes.md 3.0; as LexPen's panechannel.js): the pane
// is a frame from the panes' site in its view here (a process of its own), or floats in a window of its own
// (PaneForm.cs, its messages through the host). Until the page it is shown in says it is ready, the last message of
// each kind waits (a message with a `key` under that key); when it says so, it gets everything it shows (`state()`), as
// a frame loads again when it moves. What its page sends goes to `receive(m)`; the channel itself does the common part:
// ready, a press there (the pane active, this window's menus closed), a key it does not use (this window's), its menu
// asked for while floating and a choice in it. Loaded after menu.js, before app.js.

const PaneOrigin = 'https://foldex-panes.example';
const paneChannels = new Map();   // pane id -> channel

// `id`: the pane's id in the layout; `page`: its page; `view()`: the element its frame goes in; `state()`: a Map of
// kind -> message of what it shows; `menu(x, y)`: its menu's items, floating (drawn by its page).
function paneChannel({ id, page, title, view, state, receive, menu }) {
  const ch = { id, page, title, frame: null, ready: false, queue: new Map(), floating: false, floatReady: false, floatQueue: new Map(), runs: null };

  ch.frameEl = () => {
    if (ch.frame) return ch.frame;
    const frame = document.createElement('iframe');
    frame.allow = 'clipboard-read; clipboard-write';   // a text field's Paste (menu.js fieldMenu), as the window's
    frame.className = 'pane-frame';
    frame.title = title;
    frame.name = id;   // the host knows the frame by it (MainForm FrameCreated)
    frame.src = `${PaneOrigin}/${page}`;
    ch.frame = frame;
    view().append(frame);
    return frame;
  };

  ch.send = msg => {
    const key = msg.key ?? msg.kind;
    if (ch.floating) {
      if (!ch.floatReady) return void ch.floatQueue.set(key, msg);
      return void post({ op: 'paneSend', pane: id, msg });
    }
    ch.frameEl();
    if (!ch.ready) return void ch.queue.set(key, msg);
    ch.frame.contentWindow.postMessage({ toPane: msg }, PaneOrigin);
  };

  ch.focus = () => {
    if (ch.floating) return false;
    ch.frameEl().focus();
    return true;
  };

  // Into a window of its own, where it was last (`bounds`, kept with the layout). Its page there says when it is
  // ready; then it gets everything it shows. `size`: [w, h] in CSS px for a first time (no `bounds`), in the middle of
  // the window; without it, narrow beside the window's right edge. `beside`: the first time outside the window (on
  // another screen when there is one).
  ch.float = (bounds, size = null, { beside = false } = {}) => {
    if (ch.floating) return post({ op: 'paneFloat', pane: id, page, title: ch.title });
    ch.floating = true;
    ch.floatReady = false;
    ch.floatQueue = new Map();
    post({ op: 'paneFloat', pane: id, page, title: ch.title, bounds, size, beside });
  };

  // Its title now (a preview: the file it shows): its window's title bar too while it floats, and when it floats later.
  ch.retitle = text => {
    ch.title = text;
    if (ch.floating) post({ op: 'paneTitle', pane: id, title: text });
  };

  // Back in this window (Dock, or its window dragged onto this one): in its frame again, showing what
  // it shows now.
  ch.docked = () => {
    if (!ch.floating) return;
    ch.floating = false;
    post({ op: 'paneDock', pane: id });
    for (const msg of [paneLook(), ...state().values()]) ch.send(msg);
  };

  // A menu of this page (its items as menu.js has them) drawn by the floating page: a choice runs here.
  ch.menuThere = (items, x, y) => {
    const runs = [];
    const flat = list => list.map(item => item === '-' ? '-' : {
      label: item.label, checked: !!item.checked, enabled: item.enabled !== false, key: item.key,
      items: item.items ? flat(item.items) : undefined, id: item.items ? undefined : (runs.push(item.run), runs.length - 1),
    });
    const sent = flat(items);
    ch.runs = runs;
    ch.send({ kind: 'menu', key: 'menu', x, y, items: sent });
  };

  ch.receive = (m, from) => {
    if ((from === 'float') !== ch.floating) return;   // not the one shown now
    if (m.kind === 'ready') {
      const waiting = new Map([['look', paneLook()], ...state(), ...(from === 'float' ? ch.floatQueue : ch.queue)]);
      waiting.delete('menu');
      if (from === 'float') { ch.floatReady = true; ch.floatQueue = new Map(); }
      else { ch.ready = true; ch.queue = new Map(); }
      for (const msg of waiting.values()) ch.send(msg);
      // The active pane's page ready while the window has the keyboard and nothing in it is focused (the start): the
      // keyboard to it (app.js, the focus).
      if (from !== 'float' && id === activePane && document.hasFocus() && (!document.activeElement || document.activeElement === document.body)) ch.focus();
      return;
    }
    switch (m.kind) {
      case 'activate':   // a press in its page: its pane the active one, this window's menus closed
        closeMenus();
        rbSlide(false);   // the ribbon slid down (only when wanted) goes up
        rbTipsOff();
        return views.has(id) && activate(id);   // a dialog's window has no pane here
      case 'menusClose':   // a press or a menu in its page: every other menu of this window closed (menu.js)
        closeMenus();
        return closePanesMenus(ch);
      case 'menuPick': return ch.runs?.[m.id]?.();
      // Ctrl+F4 or Alt+F4 in a floating pane's window (pane.js, viewpage.js): that window's pane closed, nothing else.
      case 'closeFloating': return ch.floating && views.has(id) && closePane(id);
      case 'ribbonAlt': return rbAlt(m.letter);   // Alt alone or Alt+a free letter there: the ribbon's key tips
      case 'menuAsk': return menu && ch.menuThere(menu(), m.x, m.y);
      case 'key':   // a key the pane does not use: this window's (keys.js), as if pressed here
        activate(id);
        return document.dispatchEvent(new KeyboardEvent('keydown', { key: m.key, code: m.code, ctrlKey: m.ctrlKey,
          shiftKey: m.shiftKey, altKey: m.altKey, metaKey: m.metaKey, bubbles: true, cancelable: true }));
      default: return receive?.(m);
    }
  };

  paneChannels.set(id, ch);
  return ch;
}

// A modal floating window (plan 14 3.7): a dialog's page (dialog.html, dialogpage.js) in a window of its own over this
// one, which waits for it. `args` say which dialog and what it needs from here; what it asks of the host meanwhile goes
// through here (askHost, post, status), and its answer comes back when it closes (null: cancelled). What it asks of this
// page itself (askWindow there: a change it makes here, what only this page knows) `calls` answers. The keyboard back
// in the active pane after. `modal` false: a floating window that is not modal, this window usable meanwhile (the
// Size of a bar). `opened` gets its channel, for what this page tells it while it is open.
let dialogWindows = 0;
async function dialogWindow(title, args, calls = null, modal = true, opened = null) {
  const id = `dialog:${PanePage ? `${PanePage}:` : ''}${++dialogWindows}`;   // a pane's page's own (plan 14 stage 6) apart
  const ch = paneChannel({ id, page: 'dialog.html', title, view: () => document.body, state: () => new Map([['args', { ...args, kind: 'args' }]]),
    receive: async m => {
      if (m.kind === 'host') ch.send({ kind: 'answer', key: `answer:${m.req}`, req: m.req, value: await askHost(m.msg) });
      else if (m.kind === 'call') ch.send({ kind: 'answer', key: `answer:${m.req}`, req: m.req, value: await calls?.(m.msg) });
      else if (m.kind === 'post') post(m.msg);
      else if (m.kind === 'status') status(m.text, m.warn, m.detail);
    } });
  Object.assign(ch, { floating: true, floatReady: false, floatQueue: new Map() });
  opened?.(ch);
  const m = await askHost({ op: 'dialogOpen', pane: id, page: 'dialog.html', title, modal });
  paneChannels.delete(id);
  activeView()?.body.focus();
  return m.value ?? null;
}

// The look of this window for every pane's page (applyTheme, app.js): its root's own values and marks.
function paneLook() {
  const root = document.documentElement;
  // The dates' format too (dates.js), for a page without the settings (the preview's).
  return { kind: 'look', css: root.style.cssText, data: { ...root.dataset },
    dates: typeof systemDate === 'undefined' || typeof settings === 'undefined' ? undefined
      : { format: settings?.dateFormat ?? '', system: systemDate } };
}
function sendPaneLooks() {
  for (const ch of paneChannels.values()) ch.send(paneLook());
}

// The messages of the panes' pages in frames of this page.
addEventListener('message', e => {
  if (e.origin !== PaneOrigin || !e.data?.fromPane) return;
  for (const ch of paneChannels.values())
    if (ch.frame && ch.frame.contentWindow === e.source) return void ch.receive(e.data.fromPane, 'frame');
});
