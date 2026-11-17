'use strict';
// F1's page (palette.html; as LexPen's commands-pane.js): every action with its keys, by group, searchable, as its
// window's page sends them (`rows`, palette.js). Not modal: it stays open while actions run, on the window's active
// pane (F1 itself never becomes that pane). What is done here goes there: a row run (`run`: Enter, a double click),
// Esc on an empty search (`close`), and the focus coming back (`refresh`: the active pane may have changed, and with
// it which actions work). Up / Down, PgUp / PgDn move the selection; a click selects.

const pal = {
  el: document.getElementById('palette'),
  input: document.querySelector('#palette .filter'),
  body: document.querySelector('#palette tbody'),
  list: document.querySelector('#palette .palette-list'),
  ribbonButton: document.querySelector('#palette .palette-ribbon'),
  rows: [],
  changing: false,   // the ribbon is being changed: rows are dragged onto it
};

// The rows again (each time this page gets the focus: which actions work may have changed). The same actions as shown:
// only their marks are set (greyed out, draggable), the rows themselves stay, so a click whose press brought the focus
// here still lands on the row it pressed (a row drawn anew under it would take no click).
paneHandlers.rows = m => {
  const same = JSON.stringify((m.rows ?? []).map(r => r.call)) === JSON.stringify(pal.rows.map(r => r.call));
  pal.rows = m.rows ?? [];
  pal.changing = !!m.ribbon;
  pal.ribbonButton.textContent = pal.changing ? 'Done changing the ribbon' : 'Change the ribbon';
  pal.ribbonButton.classList.toggle('on', pal.changing);
  pal.el.querySelector('.about').textContent = `Foldex ${m.version ?? ''}`;   // the name and version (plan 10 3.2)
  if (!same) return fill(false);
  const byCall = new Map(pal.rows.map(r => [JSON.stringify(r.call), r]));
  for (const tr of rowEls()) mark(tr, byCall.get(tr.dataset.call));
};
// A row's marks: greyed out when it does not work on the active pane now, draggable while the ribbon is changed.
function mark(tr, r) {
  tr.draggable = pal.changing && floating;   // floating: the browser's drag, between windows (docked: below)
  tr.classList.toggle('draggable', pal.changing);
  tr.classList.toggle('disabled', !!r?.off);
}
paneHandlers.focus = () => { pal.input.focus(); pal.input.select(); };

// The rows the search finds; a new search starts at its first row, the same one keeps the selection.
function fill(searched = true) {
  const words = pal.input.value.toLowerCase().split(/\s+/).filter(Boolean);
  const at = searched ? 0 : Math.max(0, rowEls().findIndex(r => r.classList.contains('selected')));
  const shown = pal.rows.filter(r => words.every(w => `${r.title} ${r.hint} ${r.keys} ${r.group} ${r.call[0]}`.toLowerCase().includes(w)));
  pal.body.replaceChildren(...shown.map(r => {
    const tr = document.createElement('tr');
    tr.dataset.call = JSON.stringify(r.call);
    mark(tr, r);
    for (const text of [r.group, r.title, r.keys]) tr.insertCell().textContent = text;
    tr.title = r.hint;
    return tr;
  }));
  select(Math.min(at, shown.length - 1));
}
const rowEls = () => [...pal.body.rows];
function select(i) {
  const rows = rowEls();
  rows.forEach((r, k) => r.classList.toggle('selected', k === i));
  rows[i]?.scrollIntoView({ block: 'nearest' });
}
const run = row => { if (row) toWindow({ kind: 'run', call: JSON.parse(row.dataset.call) }); };

pal.input.addEventListener('input', () => fill());
// Its own keys, before the window gets the ones it does not use (pane.js).
addEventListener('keydown', e => {
  const rows = rowEls(), at = rows.findIndex(r => r.classList.contains('selected'));
  const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[e.key];
  if (step) select(Math.max(0, Math.min(rows.length - 1, at + step)));
  else if (e.key === 'Enter') run(rows[at]);
  else if (e.key === 'Escape') {   // a row's drag ends first, then the search goes, then the pane
    if (rowDrag?.dragging()) rowDrag.cancel();
    else if (pal.input.value) { pal.input.value = ''; fill(); }
    else toWindow({ kind: 'close' });
  } else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
pal.body.addEventListener('click', e => {
  const row = e.target.closest('tr');
  if (row) select(rowEls().indexOf(row));
  pal.input.focus();
});
pal.body.addEventListener('dblclick', e => run(e.target.closest('tr')));

// The ribbon (plan 19 3.10): its change mode on or off; while on, a row dragged onto it adds its action.
pal.ribbonButton.addEventListener('click', () => toWindow({ kind: 'ribbonChange' }));
// Floating: the browser's drag, between windows.
pal.body.addEventListener('dragstart', e => {
  const row = e.target.closest('tr');
  if (!row || !pal.changing) return e.preventDefault();
  e.dataTransfer.setData('text/plain', 'foldex-call:' + row.dataset.call);
  e.dataTransfer.effectAllowed = 'copyMove';
});
// Docked (a frame of another site): the browser lets no drag from here drop in the window around it, so a row goes to
// the ribbon with the pointer: it starts here (ribbonDragStart); the moves and the release over this frame are told
// from here (ribbonDragMove, ribbonDragEnd: the point in this frame), those over the rest of the window the window sees
// itself (ribbon.js rbCallDragStart). Esc: it ends, nothing added.
let rowDrag = null;
pal.body.addEventListener('pointerdown', e => {
  rowDrag?.end();
  const row = e.target.closest('tr');
  if (floating || !pal.changing || !row || e.button !== 0) return;
  const call = JSON.parse(row.dataset.call), x0 = e.clientX, y0 = e.clientY;
  let dragging = false;
  const move = ev => {
    if (!(ev.buttons & 1)) return rowDrag?.end();   // let go outside this frame: the window ended it
    if (!dragging) {
      if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 6) return;
      dragging = true;
      toWindow({ kind: 'ribbonDragStart', call });
    }
    toWindow({ kind: 'ribbonDragMove', x: ev.clientX, y: ev.clientY });
  };
  const up = ev => {
    if (dragging) toWindow({ kind: 'ribbonDragEnd', drop: true, x: ev.clientX, y: ev.clientY });
    rowDrag?.end();
  };
  rowDrag = {
    dragging: () => dragging,
    cancel: () => { toWindow({ kind: 'ribbonDragEnd', drop: false }); rowDrag.end(); },
    end: () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      rowDrag = null;
    },
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
});
paneHandlers.ribbonDragDone = () => rowDrag?.end();   // the window ended it (let go there, or Esc)
addEventListener('focus', () => toWindow({ kind: 'refresh' }));
