'use strict';
// A pane's page (docs/plans/14-PLAN-floating-panes.md 3.0; as LexPen's pane.js): a frame in its window's page, from the
// panes' site, so it runs in a process of its own; or floating, a window of its own (PaneForm.cs), where the host passes
// its messages. Either way it talks to its window's page only: what it shows comes from there (paneHandlers), what is
// done in it goes there (toWindow). The window gives it its look, and gets every key the pane does not use itself, so
// the window's keys (F1, Alt+P, ...) work here too. Floating, a right-click asks the window for the pane's menu, which
// this page draws (menu.js): a choice goes back as menuPick.

const APP_ORIGIN = 'https://foldex.example';
const floating = parent === window;   // a window of its own
const paneHandlers = {};   // kind -> what the window's message does here

function toWindow(msg) {
  if (floating) chrome.webview.postMessage({ fromPane: msg });
  else parent.postMessage({ fromPane: msg }, APP_ORIGIN);
}

function fromWindow(m) {
  if (m.kind === 'look') return applyPaneLook(m);
  if (m.kind === 'menu') return paneMenu(m);
  paneHandlers[m.kind]?.(m);
}
addEventListener('message', e => { if (e.origin === APP_ORIGIN && e.data?.toPane) fromWindow(e.data.toPane); });
if (floating) chrome.webview.addEventListener('message', e => { if (e.data?.toPane) fromWindow(e.data.toPane); });

// The window's look: its root's own values (the theme's colours, the fonts) and its marks (data-theme, ...).
function applyPaneLook({ css, data }) {
  const root = document.documentElement;
  root.style.cssText = css ?? '';
  for (const name of Object.keys(root.dataset)) delete root.dataset[name];
  Object.assign(root.dataset, data ?? {});
  document.body?.toggleAttribute('data-floating', floating);
}

// A menu of the window's page drawn here ({ x, y, items: [{ label, checked, enabled, key, id, items } | '-'] }); a
// choice goes back as menuPick.
function paneMenu({ x, y, items }) {
  const own = list => list.map(item => item === '-' ? '-' : {
    label: item.label, checked: item.checked, enabled: item.enabled, key: item.key,
    items: item.items ? own(item.items) : undefined, run: () => toWindow({ kind: 'menuPick', id: item.id }),
  });
  openMenu(x, y, own(items));
}

// In a text field its editing keys stay there: typing, the arrows, Ctrl+C / V / X / Z / Y / A, Ctrl+arrows.
const fieldKey = e => e.target.matches?.('input, textarea, select') && !/^F\d+$/.test(e.key) &&
  (!(e.ctrlKey || e.altKey || e.metaKey) || (e.ctrlKey && !e.altKey && !e.metaKey &&
    /^(a|c|v|x|z|y|arrowleft|arrowright|arrowup|arrowdown|home|end|backspace|delete|insert)$/i.test(e.key)));
addEventListener('keydown', e => {
  if (e.defaultPrevented || ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key) || document.querySelector('.menu') || fieldKey(e)
    || document.querySelector('dialog[open]')) return;
  const { key, code, ctrlKey, shiftKey, altKey, metaKey } = e;
  toWindow({ kind: 'key', key, code, ctrlKey, shiftKey, altKey, metaKey });
  if (ctrlKey || altKey || metaKey || /^F\d+$/.test(key)) e.preventDefault();   // the window's, not the browser's
});

// A press anywhere in the pane: its window's pane becomes the active one, as a press in the page does.
addEventListener('pointerdown', () => toWindow({ kind: 'activate' }), true);

// Floating, its right-click (not on a text field): the pane's menu (Dock, Close, ...), as its head's when docked.
addEventListener('contextmenu', e => {
  if (!floating || e.target.matches?.('input, textarea')) return;
  e.preventDefault();
  toWindow({ kind: 'menuAsk', x: e.clientX, y: e.clientY });
});

// Ready once every script of the page has run (the pane's own comes after this one; deferred scripts run before
// DOMContentLoaded, while the page is already "interactive"): a message before that would find no handler.
if (document.readyState !== 'complete') addEventListener('DOMContentLoaded', () => toWindow({ kind: 'ready' }));
else toWindow({ kind: 'ready' });
