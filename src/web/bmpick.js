'use strict';
// Move to folder... (docs/plans/executed/27-PLAN-bookmark-folders.md 3.4), shown in a modal floating window of its own
// (plan 14 3.7; dialogpage.js). Its rows from the bookmarks it was given (bookmarktree.js).

// Move to folder... (plan 27 3.4): the tab's folders as a tree, the tab itself at the top (the top level). Resolves to
// the folder's id, null for the top, undefined for Cancel. The folder it is in now is selected; the entry itself and
// the folders inside it are greyed out.
function pickBookmarkFolder(row, quick) {
  const choices = [{ id: null, name: quick ? 'Quick access' : 'Bookmarks', depth: 0, off: false }];
  const walk = (list, depth, off) => {
    for (const b of list) if (isGroup(b)) {
      const no = off || b.id === row.b.id;
      choices.push({ id: b.id, name: b.folder, depth, off: no });
      walk(b.items ?? [], depth + 1, no);
    }
  };
  walk(bookmarks.filter(b => !!b.quickAccess === quick), 1, false);
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const dialog = el('dialog', { className: 'find bm-pick' });
  const form = el('form', { method: 'dialog' });
  const list = el('div', { className: 'bm-pick-list', tabIndex: 0 });
  let at = Math.max(0, choices.findIndex(c => c.id === row.parent));
  const draw = () => list.replaceChildren(...choices.map((c, k) => {
    const r = el('div', { className: 'bm-pick-row' + (k === at ? ' selected' : '') + (c.off ? ' off' : '') },
      el('img', { src: c.id ? GroupIcon : '', className: c.id ? 'bm-group-icon' : 'bm-plain' }), el('span', { textContent: c.name }));
    r.style.paddingLeft = `${8 + c.depth * 16}px`;
    r.dataset.k = k;
    return r;
  }));
  const ok = el('button', { value: 'ok', textContent: 'OK' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });
  form.append(list, el('div', { className: 'ask-buttons' }, el('span', { className: 'find-gap' }), ok, cancel));
  dialog.append(el('div', { className: 'find-title', textContent: `Move "${bookmarkName(row.b)}" to` }), form);
  document.body.append(dialog);
  const pick = k => { if (choices[k] && !choices[k].off) { at = k; draw(); } };
  list.addEventListener('mousedown', e => { const r = e.target.closest('[data-k]'); if (r) pick(+r.dataset.k); });
  list.addEventListener('dblclick', e => { if (e.target.closest('[data-k]') && !choices[at].off) ok.click(); });
  list.addEventListener('keydown', e => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    for (let k = at + step; k >= 0 && k < choices.length; k += step) if (!choices[k].off) return pick(k);
  });
  draw();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'ok' && !choices[at].off ? choices[at].id : undefined);
    }, { once: true });
    dialog.showModal();
    list.focus();
  });
}
