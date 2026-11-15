'use strict';
// The buttons at the bottom of every dialog of a page (a question, a name asked, Find, the size of a bar, the column
// sets): Left and Right go from one to the next, each has a letter (underlined) that presses it at once (with Alt
// while a text box has the keyboard, so typing still types), the button with the keyboard has an outline
// (its text stays plain: bold would make it wider and move the buttons beside it), and the one Enter presses
// (the default) its border in the accent colour. Their look is here too, so every
// page that loads this file gets the same.

const DialogButtons = 'dialog .ask-buttons button, dialog .buttons button';

// The buttons of a dialog's row, in their order.
const rowButtons = dialog => [...dialog.querySelectorAll(':scope .ask-buttons button, :scope .buttons button')].filter(b => !b.hidden);

// Each button's letter: the first of its text no button before it in the row has; underlined. Again each time the
// dialog opens (a button's text may have changed: OK or Yes).
function markButtons(dialog) {
  const taken = new Set();
  for (const b of rowButtons(dialog)) {
    const text = b.dataset.text ?? b.textContent;
    b.dataset.text = text;
    const i = [...text].findIndex(c => /[a-z0-9]/i.test(c) && !taken.has(c.toLowerCase()));
    if (i < 0) {
      b.textContent = text;
      delete b.dataset.key;
      continue;
    }
    const key = text[i].toLowerCase();
    taken.add(key);
    b.dataset.key = key;
    b.replaceChildren(text.slice(0, i), Object.assign(document.createElement('u'), { textContent: text[i] }), text.slice(i + 1));
  }
}

if (typeof document !== 'undefined') {
  // A dialog opened (shown, or added already open): its buttons marked.
  new MutationObserver(changes => {
    for (const c of changes) {
      const nodes = c.type === 'attributes' ? [c.target] : [...c.addedNodes];
      for (const n of nodes) if (n instanceof HTMLDialogElement && n.open) markButtons(n);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });

  document.addEventListener('keydown', e => {
    const dialog = [...document.querySelectorAll('dialog[open]')].pop();
    // A key field (bookmarks.js keyField) takes every key itself, Alt with a letter too.
    if (!dialog || e.ctrlKey || e.metaKey || document.activeElement?.matches('.key-field')) return;
    const buttons = rowButtons(dialog);
    if (!buttons.length) return;
    const at = buttons.indexOf(document.activeElement);
    const typing = !!document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea, select');
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && at >= 0 && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      buttons[(at + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length].focus();
      return;
    }
    if (e.key.length !== 1 || (typing && !e.altKey)) return;
    const b = buttons.find(x => x.dataset.key === e.key.toLowerCase() && !x.disabled);
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    b.focus();
    b.click();
  }, true);

  const all = suffix => DialogButtons.split(', ').map(s => s + suffix).join(', ');
  const style = document.createElement('style');
  style.textContent = `
    ${DialogButtons} {
      color: var(--fg);
      background: color-mix(in srgb, var(--fg) 10%, var(--bg-bar, var(--bg)));
      border: 1px solid color-mix(in srgb, var(--fg) 40%, transparent);
      border-radius: 4px;
      padding: 3px 14px;
      font: inherit;
      cursor: pointer;
    }
    ${all(':hover')} {
      background: color-mix(in srgb, var(--fg) 18%, var(--bg-bar, var(--bg)));
    }
    ${all('[value=ok]')}, ${all('.ok')} {
      border-color: var(--accent);
    }
    ${all(':focus')} {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
      border-color: var(--accent);
    }
    ${all(' u')} {
      text-decoration: underline;
      text-underline-offset: 2px;
    }`;
  document.head.append(style);
}
