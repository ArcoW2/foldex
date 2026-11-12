'use strict';
// The bars (docs/plans/executed/10-PLAN-bars.md): strips of one kind each (the path, the drives) docked at the top, bottom, left
// or right of the panes, in lines. bars.json (BarsFile.cs) holds them per side, a list of lines, a line a list of bars;
// changing a bar in the window (dragging, its menu, the Size window) writes your copy and every window follows.
// The bars change only in their change mode (as LexPen's ribbon): their grips (drag: move) and splitters (the border
// after a bar; drag: its normal size) show, their content does not respond, a right-click anywhere on a bar opens its
// menu; Done or Esc ends it, Ctrl+Z takes the last change back. Outside it a right-click offers Change the bars.

// ---------- Sizes (3.1): no DOM, so the tests run them under Jint ----------

// A bar's sizes in px. For a bar of buttons (the drives) a size counts buttons: `overhead` (its grip and padding) plus
// that many buttons of `unit` px, and the >> button (`more` px) when its content has more buttons than that. Other bars
// (the path) are sized in px as they are. `count`: the buttons it has.
function barPx(bar, { unit = 1, overhead = 0, count = 0, more = 0, buttons = false } = {}) {
  const px = n => n == null ? null : buttons ? overhead + n * unit + (count > n ? more : 0) : n;
  return { normal: px(bar.normal) ?? 0, min: px(bar.min), max: px(bar.max), content: buttons ? overhead + count * unit : 0 };
}

// The length of each bar of a line. Each bar: { normal, min, max, content (px), maxShare (%), fill }. `length`: the
// line's; `windowLength`: the window's in the line's direction (for maxShare). A bar that does not fill is the larger
// of its normal size and its content, at most its max (no max above normal: it does not grow) and its share (which
// takes it back to its normal size, not below), at least its min. Bars that fill share what the others leave by their
// normal sizes, each between its min and max. A line too
// short: the bars that fill give way first, down to their min, then the others, down to theirs; what still does not
// fit is hidden from the end (the line's >>). Returns { lengths, hidden: [index] }.
function lineLengths(bars, length, windowLength) {
  const cap = b => {
    const share = b.maxShare != null ? windowLength * b.maxShare / 100 : Infinity;
    if (b.fill) return Math.min(b.max ?? Infinity, share);
    // Below its normal size only a line too short shrinks it (after the bars that fill are at their min).
    return Math.min(b.max != null && b.max > b.normal ? b.max : b.normal, Math.max(share, b.normal));
  };
  const lo = b => b.min ?? 0;
  const lengths = bars.map(b => b.fill ? 0 : Math.max(lo(b), Math.min(Math.max(b.normal, b.content ?? 0), cap(b))));
  const fills = bars.map((b, i) => i).filter(i => bars[i].fill);
  let rest = length - lengths.reduce((a, x) => a + x, 0);
  // The rest by the normal sizes, as water fills: a bar below its min or above its max is set there, and the others
  // share again what is left.
  const open = new Set(fills);
  let left = rest;
  for (;;) {
    const weight = [...open].reduce((a, i) => a + (bars[i].normal || 1), 0);
    if (!open.size) break;
    const share = i => left * (bars[i].normal || 1) / weight;
    const under = [...open].filter(i => share(i) < lo(bars[i]));
    const over = under.length ? [] : [...open].filter(i => share(i) > cap(bars[i]));
    const fixed = under.length ? under : over;
    if (!fixed.length) {
      for (const i of open) lengths[i] = share(i);
      break;
    }
    for (const i of fixed) {
      lengths[i] = under.length ? lo(bars[i]) : cap(bars[i]);
      left -= lengths[i];
      open.delete(i);
    }
  }
  // Still too long: the others down towards their min, each by its share of the room it has above it.
  let over = lengths.reduce((a, x) => a + x, 0) - length;
  if (over > 0) {
    const others = bars.map((b, i) => i).filter(i => !bars[i].fill);
    const slack = others.reduce((a, i) => a + lengths[i] - lo(bars[i]), 0);
    const take = Math.min(over, slack);
    if (slack > 0) for (const i of others) lengths[i] -= take * (lengths[i] - lo(bars[i])) / slack;
    over -= take;
  }
  const hidden = [];
  for (let i = bars.length - 1; over > 0.5 && i > 0; i--) {
    hidden.unshift(i);
    over -= lengths[i];
    lengths[i] = 0;
  }
  return { lengths: lengths.map(x => Math.max(0, Math.floor(x))), hidden };
}

// How many of a bar's `count` buttons of `unit` px show in `room` px; with less room than all of them, the >> button
// (`more` px) takes its place at the end.
function fitItems(count, unit, room, more) {
  if (count * unit <= room) return count;
  return Math.max(0, Math.floor((room - more) / unit));
}

// ---------- The bars in the window ----------

const BarSides = ['top', 'bottom', 'left', 'right'];
const BarKinds = { path: 'Path', drives: 'Drives' };
const BarDefaults = { path: { normal: 300, min: 120 }, drives: { normal: 4, min: 2 } };
const MoreLength = 24;   // the >> button

let bars = { top: [], bottom: [], left: [], right: [] };
let drives = [];
let barLocation = '';
let sizing = null;   // the Size window's bar while it is open: { bar, marks }
let barsChanging = false;   // the change mode
let barsUndo = [];          // the bars before each change in the change mode
let barsBefore = null;      // the bars as last saved, for barsUndo

const across = side => side === 'top' || side === 'bottom';   // a row: the bars' length is their width
const buttonBar = bar => bar.kind === 'drives';

// The bars from bars.json (BarsFile.Load): drawn, and its problems said.
function setBars(m) {
  bars = m.bars;
  if (m.problems?.length) status(m.problems.join(' '), true);
  drawBars();
}

function saveBars() {
  if (barsChanging) {
    barsUndo.push(barsBefore);
    barsBefore = structuredClone(bars);
  }
  post({ op: 'barsSave', bars });
  drawBars();
}

// The change mode on or off (the action bars.change, Done, Esc).
function changeBars(on) {
  if (barsChanging === on) return;
  barsChanging = on;
  barsUndo = [];
  barsBefore = on ? structuredClone(bars) : null;
  if (!on) closeMenus();
  document.body.classList.toggle('bars-changing', on);
  let done = document.querySelector('.bars-done');
  if (on && !done) {
    done = document.createElement('div');
    done.className = 'bars-done';
    done.innerHTML = '<span>Changing the bars: drag a grip to move a bar, the border after it to size it; right-click a ' +
      'bar for its menu. Ctrl+Z takes a change back.</span><button>Done</button>';
    done.querySelector('button').addEventListener('click', () => changeBars(false));
    document.body.append(done);
  } else if (!on) done?.remove();
  ribbonRefresh();
}

function undoBars() {
  if (!barsUndo.length) return status('Nothing to take back.');
  bars = barsUndo.pop();
  barsBefore = structuredClone(bars);
  post({ op: 'barsSave', bars });
  drawBars();
}

// Esc and Ctrl+Z in the change mode (not while a menu or a dialog has them).
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (!barsChanging || document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') changeBars(false);
  else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ') undoBars();
  else return;
  e.preventDefault();
  e.stopPropagation();
}, true);

function drawBars() {
  for (const side of BarSides) {
    const host = $(`bars-${side}`);
    host.replaceChildren(...bars[side].map((line, l) => {
      const el = document.createElement('div');
      el.className = 'bar-line';
      el.append(...line.map((bar, b) => drawBar(bar, side, l, b)));
      return el;
    }));
  }
  fitBars();
}

function drawBar(bar, side, l, b) {
  const el = document.createElement('div');
  el.className = `bar bar-${bar.kind}`;
  el.dataset.side = side;
  el.dataset.line = l;
  el.dataset.index = b;
  const grip = document.createElement('span');
  grip.className = 'bar-grip';
  grip.title = 'Drag to move the bar';
  grip.addEventListener('mousedown', e => { if (e.button === 0) dragBar(e, bar, side); });
  const body = document.createElement('div');
  body.className = 'bar-body';
  const end = document.createElement('span');
  end.className = 'bar-end';
  end.title = 'Drag to set its normal size (larger than its maximum: that grows with it; smaller than its minimum: that follows)';
  end.addEventListener('mousedown', e => { if (e.button === 0) resizeBar(e, bar, el, side); });
  el.append(grip, body, end);
  el.addEventListener('contextmenu', e => {
    if (!barsChanging && e.target.closest('input')) return;   // the text box's own menu
    e.preventDefault();
    openMenu(e.clientX, e.clientY, barsChanging ? barMenu(bar, side) : [
      { label: 'Change the bars', run: () => changeBars(true) },
      { label: 'Reset the bars...', run: () => runAction('bars.reset') },
    ]);
  });
  el.bar = bar;
  fillBar(el, bar, side);
  return el;
}

// The content of a bar, all of it; fitBars then hides what does not fit behind >> (or lets it scroll).
function fillBar(el, bar, side) {
  const body = el.querySelector('.bar-body');
  const items = bar.kind === 'drives' ? drives.map(d => driveButton(d, bar))
    : across(side) ? [pathBox()] : pathSegments().map(s => segmentButton(s));
  body.replaceChildren(...items);
  if (bar.overflow === 'scroll') {
    body.classList.add('scrolls');
    body.addEventListener('wheel', e => {
      body[across(side) ? 'scrollLeft' : 'scrollTop'] += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  }
}

function driveButton(d, bar) {
  const button = document.createElement('button');
  button.className = 'bar-item drive';
  button.dataset.id = d.id;
  button.textContent = `${d.letter}:`;
  button.dataset.label = d.name;
  const free = d.total ? ` - ${formatSize(d.free)} free of ${formatSize(d.total)}` : '';
  button.title = d.name + free;
  if (bar.freeSpace !== false && d.total) {
    const used = document.createElement('span');
    used.className = 'used';
    used.style.setProperty('--used', `${Math.round(100 * (d.total - d.free) / d.total)}%`);
    button.append(used);
  }
  button.classList.toggle('current', same(d.id, driveOf(barLocation)));
  button.addEventListener('click', () => { if (activePane) goTo(activePane, d.id); });
  return button;
}

const driveOf = path => /^[A-Za-z]:/.test(path ?? '') ? path.slice(0, 2).toUpperCase() + '\\' : null;

// The path in a row: the location box (Enter goes there through the parent, plan 03 3.3).
function pathBox() {
  const input = document.createElement('input');
  input.className = 'bar-path';
  input.spellcheck = false;
  input.title = 'The folder of the active pane; Enter goes there';
  input.value = barLocation;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && activePane) goTo(activePane, input.value.trim());
  });
  return input;
}

// The path in a column: its folders one under the other, each a button to go there.
function pathSegments() {
  const parts = barLocation.split('\\').filter(x => x);
  return parts.map((name, k) => ({ name, id: k === 0 && /^[A-Za-z]:$/.test(name) ? name + '\\' : parts.slice(0, k + 1).join('\\') }));
}

function segmentButton(s) {
  const button = document.createElement('button');
  button.className = 'bar-item segment';
  button.textContent = s.name;
  button.dataset.label = s.id;
  button.title = s.id;
  button.addEventListener('click', () => { if (activePane) goTo(activePane, s.id); });
  return button;
}

// The active pane's folder (app.js): every path bar shows it, the drives bar marks its drive.
function showLocation(text) {
  barLocation = text ?? '';
  for (const input of document.querySelectorAll('.bar-path')) if (document.activeElement !== input) input.value = barLocation;
  let column = false;
  for (const el of document.querySelectorAll('.bar')) {
    if (el.bar.kind === 'path' && !across(el.dataset.side)) {
      fillBar(el, el.bar, el.dataset.side);
      column = true;
    }
    if (el.bar.kind === 'drives')
      for (const button of el.querySelectorAll('.drive')) button.classList.toggle('current', same(button.dataset.id, driveOf(barLocation)));
  }
  if (column) fitBars();
}

function setDrives(list) {
  drives = list;
  drawBars();
}

// A bar's button step (a button and the gap after it) and its overhead (grip, padding, the end), in px along its line.
function barMeasure(el, row) {
  const items = [...el.querySelectorAll('.bar-item')].filter(x => !x.hidden);
  const at = x => row ? x.offsetLeft : x.offsetTop;
  const size = x => row ? x.offsetWidth : x.offsetHeight;
  const unit = items.length > 1 ? at(items[1]) - at(items[0]) : items.length ? size(items[0]) + 2 : (row ? 30 : 22);
  const body = el.querySelector('.bar-body');
  const overhead = (row ? el.offsetWidth - body.clientWidth : el.offsetHeight - body.clientHeight) || 12;
  return { unit: unit || 24, overhead };
}

// Every line's bars at their lengths (3.1), and in each bar what fits; again when the window is resized.
function fitBars() {
  const windowLength = side => across(side) ? document.documentElement.clientWidth : document.documentElement.clientHeight;
  for (const line of document.querySelectorAll('.bar-line')) {
    const els = [...line.children];
    if (!els.length) continue;
    const side = els[0].dataset.side, row = across(side);
    for (const el of els) {
      el.style.flex = '';
      el.style.display = '';
      for (const item of el.querySelectorAll('.bar-item')) item.hidden = false;
      el.querySelector('.bar-more')?.remove();
    }
    const measured = els.map(el => {
      const items = [...el.querySelectorAll('.bar-item')];
      const { unit, overhead } = barMeasure(el, row);
      const buttons = buttonBar(el.bar) || (!row && el.bar.kind === 'path');
      // A path in a column is sized in px, and its content is its folders.
      const more = row ? MoreLength : unit;   // the >> of a row; in a column it is a button high
      const px = buttonBar(el.bar) ? barPx(el.bar, { unit, overhead, count: items.length, more, buttons: true })
        : { ...barPx(el.bar), content: buttons ? overhead + items.length * unit : 0 };
      return { el, unit, overhead, more, items, ...px, maxShare: el.bar.maxShare, fill: !!el.bar.fill };
    });
    const length = row ? line.clientWidth : line.clientHeight;
    const { lengths, hidden } = lineLengths(measured, length, windowLength(side));
    measured.forEach((m, i) => {
      if (hidden.includes(i)) {
        m.el.style.display = 'none';
        return;
      }
      m.el.style.flex = `0 0 ${lengths[i]}px`;
      if (m.el.bar.overflow === 'scroll' || !m.items.length) return;
      const shown = fitItems(m.items.length, m.unit, lengths[i] - m.overhead, m.more);
      if (shown >= m.items.length) return;
      m.items.forEach((item, k) => { item.hidden = k >= shown; });
      const more = document.createElement('button');
      more.className = 'bar-more';
      more.textContent = row ? '>>' : 'v';
      more.title = 'The rest';
      more.addEventListener('click', () => {
        const r = more.getBoundingClientRect();
        openMenu(r.left, r.bottom, m.items.slice(shown).map(item => ({ label: item.dataset.label, run: () => item.click() })));
      });
      m.el.querySelector('.bar-body').append(more);
    });
    // The line's own >>: the bars that do not fit at all.
    line.querySelector('.line-more')?.remove();
    if (hidden.length) {
      const more = document.createElement('button');
      more.className = 'line-more';
      more.textContent = row ? '>>' : 'v';
      more.title = 'Bars that do not fit';
      more.addEventListener('click', () => {
        const r = more.getBoundingClientRect();
        openMenu(r.left, r.bottom, hidden.flatMap(i => measured[i].el.bar.kind === 'drives'
          ? drives.map(d => ({ label: d.name, run: () => activePane && goTo(activePane, d.id) }))
          : [{ label: 'Go to a folder...', run: async () => { const to = await askText('Go to', barLocation); if (to && activePane) goTo(activePane, to); } }]));
      });
      line.append(more);
    }
  }
  if (sizing) drawSizeMarks();
}

// ---------- Changing bars in the window (3.3) ----------

// Where a bar is in the model.
function barPlace(bar) {
  for (const side of BarSides)
    for (let l = 0; l < bars[side].length; l++) {
      const b = bars[side][l].indexOf(bar);
      if (b >= 0) return { side, l, b };
    }
  return null;
}

function removeBar(bar) {
  const at = barPlace(bar);
  if (!at) return;
  bars[at.side][at.l].splice(at.b, 1);
  if (!bars[at.side][at.l].length) bars[at.side].splice(at.l, 1);   // an empty line goes away
}

// Into a side: in line `l` before bar `b`, or (b null) as a new line before line `l`.
function placeBar(bar, side, l, b) {
  if (b === null) bars[side].splice(Math.min(l, bars[side].length), 0, [bar]);
  else bars[side][l].splice(Math.min(b, bars[side][l].length), 0, bar);
}

function addBar(kind, side = 'top') {
  const bar = { kind, ...BarDefaults[kind], ...(kind === 'path' ? { fill: true } : { overflow: 'more', freeSpace: true }) };
  if (bars[side].length) bars[side][0].push(bar);
  else bars[side].push([bar]);
  saveBars();
}

// The bar's menu; where it sits is changed by dragging its grip.
function barMenu(bar, side) {
  const set = changes => { Object.assign(bar, changes); saveBars(); };
  return [
    { label: 'Size...', run: () => openSizeWindow(bar) },
    { label: 'Fill the rest', checked: !!bar.fill, run: () => set({ fill: !bar.fill }) },
    { label: 'Overflow', items: [
      { label: 'A >> button', checked: bar.overflow !== 'scroll', run: () => set({ overflow: 'more' }) },
      { label: 'Scroll', checked: bar.overflow === 'scroll', run: () => set({ overflow: 'scroll' }) } ] },
    ...(bar.kind === 'drives' ? [{ label: 'Free space', checked: bar.freeSpace !== false, run: () => set({ freeSpace: bar.freeSpace === false }) }] : []),
    '-',
    { label: 'Add a bar', items: Object.entries(BarKinds).map(([kind, title]) => ({ label: title, run: () => addBar(kind, side) })) },
    { label: 'Remove this bar', run: () => { removeBar(bar); saveBars(); } },
    '-',
    { label: 'Done', run: () => changeBars(false) },   // as LexPen's change mode menu
  ];
}

// Dragging a bar by its grip: the place it would land is marked (before or after a bar, or a new line at a side);
// let go there, it moves.
function dragBar(e, bar, from) {
  e.preventDefault();
  document.body.classList.add('bar-dragging');
  fitBars();
  const mark = document.createElement('div');
  mark.className = 'bar-drop';
  document.body.append(mark);
  let target = null;
  const move = m => {
    target = barDropAt(m.clientX, m.clientY, bar);
    mark.hidden = !target;
    if (target) Object.assign(mark.style, { left: `${target.rect.left}px`, top: `${target.rect.top}px`,
      width: `${target.rect.width}px`, height: `${target.rect.height}px` });
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    mark.remove();
    document.body.classList.remove('bar-dragging');
    if (target) {
      // Indexes from before the bar left its place: a later bar in its own line, or a later line, moves up by one.
      const at = barPlace(bar);
      let { side, l, b } = target;
      const lineGone = at && bars[at.side][at.l].length === 1;
      if (at && at.side === side && b !== null && at.l === l && at.b < b) b--;
      if (at && at.side === side && lineGone && at.l < l) l--;
      removeBar(bar);
      placeBar(bar, side, l, b);
      saveBars();
    } else fitBars();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

// The place under the mouse: over a bar, before or after it in its line; else over a side, a new line (at its start or
// end, whichever is nearer). With the mark's rectangle.
function barDropAt(x, y, bar) {
  const el = document.elementFromPoint(x, y);
  const over = el?.closest('.bar');
  if (over && over.bar !== bar) {
    const r = over.getBoundingClientRect(), row = across(over.dataset.side);
    const after = row ? x > r.left + r.width / 2 : y > r.top + r.height / 2;
    const thin = row ? { left: after ? r.right - 2 : r.left - 1, top: r.top, width: 3, height: r.height }
      : { left: r.left, top: after ? r.bottom - 2 : r.top - 1, width: r.width, height: 3 };
    return { side: over.dataset.side, l: Number(over.dataset.line), b: Number(over.dataset.index) + (after ? 1 : 0), rect: thin };
  }
  const host = el?.closest('.bars');
  if (!host) return null;
  const side = host.id.replace('bars-', ''), r = host.getBoundingClientRect(), row = across(side);
  const atEnd = row ? y > r.top + r.height / 2 : x > r.left + r.width / 2;
  const rect = row ? { left: r.left, top: atEnd ? r.bottom - 3 : r.top, width: r.width, height: 3 }
    : { left: atEnd ? r.right - 3 : r.left, top: r.top, width: 3, height: r.height };
  return { side, l: atEnd ? bars[side].length : 0, b: null, rect };
}

// Dragging a bar's end: its normal size (in buttons for the drives).
function resizeBar(e, bar, el, side) {
  e.preventDefault();
  e.stopPropagation();
  const row = across(side), start = row ? e.clientX : e.clientY;
  const from = row ? el.offsetWidth : el.offsetHeight;
  const { unit, overhead } = barMeasure(el, row);
  const move = m => {
    const length = Math.max(20, from + (row ? m.clientX : m.clientY) - start);
    bar.normal = buttonBar(bar) ? Math.max(1, Math.round((length - overhead) / unit)) : Math.round(length);
    if (!bar.fill) {
      if (bar.min != null && bar.normal < bar.min) bar.min = bar.normal;
      if (bar.max != null && bar.max < bar.normal) bar.max = bar.normal;
    }
    fitBars();
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    saveBars();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

// ---------- The Size window (3.3) ----------

const SizeFields = [
  ['min', 'Minimum', 'var(--branch-0)'],
  ['normal', 'Normal', 'var(--branch-2)'],
  ['max', 'Maximum', 'var(--branch-1)'],
  ['maxShare', 'Maximum % of the window', 'var(--branch-3)'],
];

function openSizeWindow(bar) {
  const before = { ...bar };
  const dialog = document.createElement('dialog');
  dialog.className = 'ask size-window';
  const unit = buttonBar(bar) ? 'drives' : 'px';
  dialog.innerHTML = `<p>The size of the ${BarKinds[bar.kind].toLowerCase()} bar. Empty: not set.</p><div class="fields"></div>` +
    '<div class="buttons"><button class="ok">OK</button><button class="cancel">Cancel</button></div>';
  for (const [name, title, colour] of SizeFields) {
    const label = document.createElement('label');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = colour;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = name === 'maxShare' ? 1 : 0;
    if (name === 'maxShare') input.max = 100;
    input.value = bar[name] ?? '';
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (input.value === '' || !(v > 0)) delete bar[name];
      else bar[name] = name === 'maxShare' ? Math.min(100, v) : v;
      if (name === 'normal' && bar.normal == null) bar.normal = BarDefaults[bar.kind].normal;
      fitBars();
    });
    label.append(swatch, title, input, name === 'maxShare' ? '%' : unit);
    dialog.querySelector('.fields').append(label);
  }
  const close = keep => {
    if (!keep) {
      for (const key of Object.keys(bar)) delete bar[key];
      Object.assign(bar, before);
    }
    sizing = null;
    document.querySelectorAll('.size-mark').forEach(x => x.remove());
    dialog.close();
    dialog.remove();
    if (keep) saveBars();
    else fitBars();
  };
  dialog.querySelector('.ok').addEventListener('click', () => close(true));
  dialog.querySelector('.cancel').addEventListener('click', () => close(false));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(false); });
  document.body.append(dialog);
  dialog.show();   // not modal: the window can be resized while it is open, the marks follow
  sizing = { bar };
  drawSizeMarks();
}

// The limits as marks on the bar's line, each in its field's colour: where the bar would end at that size (the %
// mark at its place for the window's size now).
function drawSizeMarks() {
  document.querySelectorAll('.size-mark').forEach(x => x.remove());
  const el = [...document.querySelectorAll('.bar')].find(x => x.bar === sizing.bar);
  if (!el) return;
  const side = el.dataset.side, row = across(side), r = el.getBoundingClientRect();
  const { unit, overhead } = barMeasure(el, row);
  const px = n => buttonBar(sizing.bar) ? overhead + n * unit : n;
  const windowLength = row ? document.documentElement.clientWidth : document.documentElement.clientHeight;
  for (const [name, , colour] of SizeFields) {
    const v = sizing.bar[name];
    if (v == null) continue;
    const at = name === 'maxShare' ? windowLength * v / 100 : px(v);
    const mark = document.createElement('div');
    mark.className = 'size-mark';
    mark.style.background = colour;
    mark.title = name;
    Object.assign(mark.style, row ? { left: `${r.left + at - 1}px`, top: `${r.top - 3}px`, width: '3px', height: `${r.height + 6}px` }
      : { left: `${r.left - 3}px`, top: `${r.top + at - 1}px`, width: `${r.width + 6}px`, height: '3px' });
    document.body.append(mark);
  }
}

// The window resized, or the ribbon or the status line coming and going (the columns at the left and right change
// height).
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitBars()).observe(document.body);
