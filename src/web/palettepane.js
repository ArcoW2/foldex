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
  rows: [],
};

paneHandlers.rows = m => {
  pal.rows = m.rows ?? [];
  pal.el.querySelector('.about').textContent = `Foldex ${m.version ?? ''}`;   // the name and version (plan 10 3.2)
  fill(false);
};
paneHandlers.focus = () => { pal.input.focus(); pal.input.select(); };

// The rows the search finds; a new search starts at its first row, the same one keeps the selection.
function fill(searched = true) {
  const words = pal.input.value.toLowerCase().split(/\s+/).filter(Boolean);
  const at = searched ? 0 : Math.max(0, rowEls().findIndex(r => r.classList.contains('selected')));
  const shown = pal.rows.filter(r => words.every(w => `${r.title} ${r.hint} ${r.keys} ${r.group} ${r.call[0]}`.toLowerCase().includes(w)));
  pal.body.replaceChildren(...shown.map(r => {
    const tr = document.createElement('tr');
    tr.dataset.call = JSON.stringify(r.call);
    if (r.off) tr.classList.add('disabled');
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
  else if (e.key === 'Escape') {   // the search goes first, then the pane
    if (pal.input.value) { pal.input.value = ''; fill(); }
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
addEventListener('focus', () => toWindow({ kind: 'refresh' }));
