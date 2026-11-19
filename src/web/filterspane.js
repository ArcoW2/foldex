'use strict';
// Manage filters, the page of its pane (docs/plans/executed/32-PLAN-filter-sets.md 3.3 - 3.5, 3.8): docked in a frame of
// its window's page, or floating, laid out as Manage column sets (colsmanage.js). Its window's page sends the kept sets,
// the one temporary filter, the fields there are and, opened by Filter..., the pane it was opened for with its set
// (`filters`). At the left the filters: on top the temporary one, "(temp)" in italic, then the kept sets, each with its
// key and its default marks. At the right the filter chosen: its name (editable; the temporary one's empty: typing a
// name saves it under that name), its lines (And / Or, brackets, Not, what it tests), under them the line chosen with its
// field and only the conditions of that field's kind (filters.js). Every change is written (`save`), and the panes using
// that filter follow at once.

let filterSets = { sets: [], temp: { lines: [] }, rootDefault: null, childDefault: null };
let fields = [];         // [{ id, title, kind (filters.js filterKind), slow }]
let pane = null;         // { id, title, set, before }: the pane it was opened for, its set now and when it opened
let chosen = null;       // the filter chosen: a kept one's name, or TempEntry (the temporary one)
let chosenLine = 0;
let keyNote = '';        // why a key was refused
let focusName = false;   // New: the cursor into the name once drawn

const TempEntry = ':temp';
const manageEl = document.getElementById('manage');
const keptNamed = name => filterSets.sets.find(s => s.name.toLowerCase() === String(name ?? '').toLowerCase());
const fieldOf = id => fields.find(f => f.id === id) ?? { id, title: id.split('.').pop(), kind: 'text', slow: slowField(id) };
const titleOf = id => fieldOf(id).title;
const kindOf = id => fieldOf(id).kind;
const clone = x => JSON.parse(JSON.stringify(x));
const saveFilters = (next, tempNamed = null, renamed = null) => toWindow({ kind: 'save', filters: next, tempNamed, renamed });

paneHandlers.filters = m => {
  filterSets = m.filters ?? filterSets;
  filterSets.temp ??= { lines: [] };
  fields = m.fields ?? fields;
  if (m.pane !== undefined) {
    pane = m.pane;
    // Opened for a pane: the filter it uses chosen (a kept one by its name), else the temporary one.
    if (m.pane && m.paneFirst) chosen = pane.set?.name && keptNamed(pane.set.name) ? keptNamed(pane.set.name).name : TempEntry;
  }
  if (m.split) manageEl.style.setProperty('--cs-left', `${m.split}px`);
  if (chosen !== TempEntry && !keptNamed(chosen)) chosen = TempEntry;
  draw();
};
paneHandlers.keyRefused = m => { keyNote = m.text ?? ''; draw(); };

// A name or a Yes asked of the window's page: its answer.
let asks = 0;
const asked = new Map();
function askWindowPage(m) {
  const req = ++asks;
  toWindow({ kind: 'ask', req, ...m });
  return new Promise(resolve => asked.set(req, resolve));
}
paneHandlers.answer = m => { asked.get(m.req)?.(m.value ?? null); asked.delete(m.req); };
const askText = (title, value) => askWindowPage({ what: 'text', title, value });
const askYes = async title => !!await askWindowPage({ what: 'yes', title });

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children.filter(c => c != null));
  return e;
};
const button = (text, run, enabled = true, title = '') => {
  const b = el('button', { textContent: text, disabled: !enabled, title });
  b.addEventListener('click', run);
  return b;
};
const select = (options, value, change, title = '') => {
  const s = el('select', { title });
  s.append(...options.map(([v, t]) => new Option(t, v)));
  s.value = value;
  s.addEventListener('change', () => change(s.value));
  return s;
};
const check = (text, checked, change, title = '') => {
  const box = el('input', { type: 'checkbox', checked });
  box.addEventListener('change', () => change(box.checked));
  return el('label', { className: 'fl-check', title }, box, ' ' + text);
};

// The filter the right part shows: the temporary one, or a kept one.
const chosenSet = () => chosen === TempEntry ? filterSets.temp : keptNamed(chosen);

// A change of the filter chosen, written: the temporary one's lines, or the kept one's; the panes using it follow.
function change(edit) {
  const set = clone(chosenSet() ?? { lines: [] });
  edit(set);
  chosenLine = Math.max(0, Math.min(chosenLine, set.lines.length - 1));
  if (chosen === TempEntry) return saveFilters({ ...filterSets, temp: { lines: set.lines } });
  saveFilters({ ...filterSets, sets: filterSets.sets.map(s => s.name === chosen ? { ...s, lines: set.lines } : s) });
}
const changeLine = edit => change(set => { if (set.lines[chosenLine]) edit(set.lines[chosenLine]); });

function draw() {
  drawSets();
  drawLines();
  drawEditor();
  drawBottom();
}

// ---------- The filters ----------

function drawSets() {
  const list = manageEl.querySelector('.cs-setlist');
  const temp = filterSets.temp?.lines ?? [];
  // The temporary filter: always on top, "(temp)" in italic, until it is saved under a name.
  const tempRow = el('div', { className: 'cs-row cs-setrow fl-temprow' + (chosen === TempEntry ? ' selected' : ''),
    title: 'The temporary filter: give it a name at the right to save it' },
    el('span', { className: 'cs-name', textContent: '(temp)' }),
    el('span', { className: 'fl-marks', textContent: temp.length ? `${temp.length} line${temp.length > 1 ? 's' : ''}` : 'empty' }));
  tempRow.addEventListener('click', () => { chosen = TempEntry; chosenLine = 0; keyNote = ''; draw(); });
  const rows = [tempRow];
  filterSets.sets.forEach((s, k) => {
    const marks = [s.name === filterSets.rootDefault ? 'root default' : '', s.name === filterSets.childDefault ? 'child default' : ''].filter(Boolean);
    const row = el('div', { className: 'cs-row cs-setrow' + (s.name === chosen ? ' selected' : '') },
      el('span', { className: 'cs-name', textContent: s.name }),
      s.key ? el('span', { className: 'fl-key', textContent: s.key }) : null,
      marks.length ? el('span', { className: 'fl-marks', textContent: marks.join(', ') }) : null);
    row.dataset.i = k;
    row.addEventListener('click', () => { chosen = s.name; chosenLine = 0; keyNote = ''; draw(); });
    rows.push(row);
  });
  list.replaceChildren(...rows);
  const at = filterSets.sets.findIndex(s => s.name === chosen);
  manageEl.querySelector('.cs-sets .up').disabled = at <= 0;
  manageEl.querySelector('.cs-sets .down').disabled = at < 0 || at >= filterSets.sets.length - 1;
  const set = chosen !== TempEntry && keptNamed(chosen);
  const others = name => filterSets.sets.filter(s => s.name.toLowerCase() !== name.toLowerCase());
  manageEl.querySelector('.cs-setbuttons').replaceChildren(
    // New: the temporary filter empty, chosen, the cursor in its name (empty: it stays the temporary one).
    button('New', async () => {
      if (temp.length && !await askYes('The temporary filter has lines that are not saved. Start a new one in its place?')) return;
      chosen = TempEntry;
      chosenLine = 0;
      focusName = true;
      saveFilters({ ...filterSets, temp: { lines: [] } });
    }, true, 'A new filter: the temporary one, empty; give it a name to save it'),
    button('Duplicate...', async () => {
      const name = (await askText('Name of the copy', `${set.name} (2)`))?.trim();
      if (!name || keptNamed(name)) return;
      chosen = name;
      saveFilters({ ...filterSets, sets: [...filterSets.sets, { name, lines: clone(set.lines) }] });
    }, !!set),
    button('Delete...', async () => {
      if (!await askYes(`Delete the filter set ${set.name}? Panes filtered by it keep its lines.`)) return;
      chosen = TempEntry;
      saveFilters({ ...filterSets, ...renamedDefaults(set.name, null), sets: others(set.name) });
    }, !!set));
  // A kept set: its key, the defaults.
  const extra = manageEl.querySelector('.fl-setextra');
  if (!set) return extra.replaceChildren();
  extra.replaceChildren(
    el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Key' }), keyField(set), keyNote ? el('span', { className: 'fl-note', textContent: keyNote }) : null),
    el('div', { className: 'fl-row' }, check('Default for a new root pane', filterSets.rootDefault === set.name,
      on => saveFilters({ ...filterSets, rootDefault: on ? set.name : null }), 'A new pane without a parent (New pane, a preset\'s tree) starts filtered by this set')),
    el('div', { className: 'fl-row' }, check('Default for a new child pane (a tab too)', filterSets.childDefault === set.name,
      on => saveFilters({ ...filterSets, childDefault: on ? set.name : null }), 'A new child pane or tab starts filtered by this set')));
}
const renamedDefaults = (from, to) => ({ rootDefault: filterSets.rootDefault === from ? to : filterSets.rootDefault,
  childDefault: filterSets.childDefault === from ? to : filterSets.childDefault });

// The name of the filter chosen, at the top of the right part. The temporary filter's is empty ("(temp)" in italic):
// a name typed (Enter, or leaving the box) saves it under that name, the temporary one empty again, the panes using it
// using the name now. A kept set's: a name typed renames it; empty, or one another set has: as it was.
function nameField() {
  const set = chosenSet(), temp = chosen === TempEntry;
  const box = el('input', { className: 'fl-name' + (temp ? ' fl-tempname' : ''), value: temp ? '' : set?.name ?? '', spellcheck: false,
    placeholder: '(temp)', title: temp ? 'Type a name and press Enter to save this filter under it' : 'The name of this filter set' });
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    const name = box.value.trim();
    if (temp) {
      if (!name) return;
      if (keptNamed(name) && !await askYes(`Replace the filter set ${name}?`)) { done = false; return box.select(); }
      chosen = name;
      saveFilters({ ...filterSets, temp: { lines: [] },
        sets: [...filterSets.sets.filter(s => s.name.toLowerCase() !== name.toLowerCase()), { name, lines: clone(filterSets.temp.lines) }] }, name);
      return;
    }
    if (!name || name === set.name || keptNamed(name)) { box.value = set.name; done = false; return; }
    chosen = name;
    saveFilters({ ...filterSets, ...renamedDefaults(set.name, name), sets: filterSets.sets.map(s => s === set ? { ...s, name } : s) }, null, [set.name, name]);
  };
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); box.value = temp ? '' : set?.name ?? ''; box.blur(); }
  });
  box.addEventListener('blur', commit);
  return box;
}

// A set's key: focused, it takes the next key pressed (keys.js strokeOf); Backspace or Del takes the key away. The window
// refuses a key that keys.json or a bookmark has (keyRefused).
function keyField(set) {
  const box = el('input', { className: 'key-field', readOnly: true, spellcheck: false, value: set.key ?? '', placeholder: 'press a key' });
  box.addEventListener('keydown', e => {
    if (['Control', 'Shift', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    keyNote = '';
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey) return toWindow({ kind: 'setKey', name: set.name, key: null });
    const stroke = strokeOf(e);
    if (stroke) toWindow({ kind: 'setKey', name: set.name, key: stroke });
  }, true);
  return box;
}

function moveSet(from, to) {
  const sets = [...filterSets.sets];
  sets.splice(to, 0, ...sets.splice(from, 1));
  saveFilters({ ...filterSets, sets });
}

// ---------- The lines of the set chosen ----------

const Brackets = n => [[0, ''], [1, '('], [2, '(('], [3, '(((']].map(([v, t]) => [String(v), n === 'close' ? t.replace(/\(/g, ')') : t || ' ']);

function drawLines() {
  const set = chosenSet(), list = manageEl.querySelector('.fl-lines');
  const label = manageEl.querySelector('.cs-setname');
  const name = nameField();
  label.replaceChildren(el('span', { className: 'cs-caption', textContent: 'Name' }), name);
  if (focusName) { focusName = false; requestAnimationFrame(() => name.focus()); }
  const lines = set?.lines ?? [];
  // The brackets: a line is indented one step per bracket open before it (the lines after an opening bracket, up to
  // and with the one that closes it; nested, deeper). While they do not match, the field where one is missing has a red
  // outline: more closing than opening, the first opening field that can take one more; more opening than closing, the
  // last closing field that can.
  const depth = [], opened = lines.reduce((n, l) => n + (l.open || 0), 0), closed = lines.reduce((n, l) => n + (l.close || 0), 0);
  lines.reduce((d, l, k) => { depth[k] = Math.max(0, d); return d + (l.open || 0) - (l.close || 0); }, 0);
  const wantOpen = closed > opened ? lines.findIndex(l => (l.open || 0) < 3) : -1;
  const wantClose = opened > closed ? lines.findLastIndex(l => (l.close || 0) < 3) : -1;
  list.replaceChildren(...lines.map((line, k) => {
    const row = el('div', { className: 'cs-row fl-linerow' + (k === chosenLine ? ' selected' : '') });
    row.addEventListener('mousedown', e => {
      if (e.target.closest('select, input, button') || k === chosenLine) return;
      chosenLine = k;
      drawLines();
      drawEditor();
    });
    // The first line has no And / Or: a space as wide, so every line's fields start at the same place.
    const join = k ? select([['and', 'And'], ['or', 'Or']], line.join === 'or' ? 'or' : 'and', v => change(s => { s.lines[k].join = v; }), 'How this line joins the ones before')
      : el('span');
    join.className = 'fl-join';
    const open = select(Brackets('open'), String(line.open || 0), v => change(s => { s.lines[k].open = +v; }), 'Brackets opened before this line');
    const close = select(Brackets('close'), String(line.close || 0), v => change(s => { s.lines[k].close = +v; }), 'Brackets closed after this line');
    open.className = close.className = 'fl-bracket';
    if (k === wantOpen) { open.classList.add('fl-wrong'); open.title = `${closed - opened} more closing than opening: an opening bracket is missing here or above`; }
    if (k === wantClose) { close.classList.add('fl-wrong'); close.title = `${opened - closed} more opening than closing: a closing bracket is missing here or below`; }
    const indent = el('span', { className: 'fl-indent' });
    indent.style.width = `${depth[k] * 1.6}em`;
    const not = check('Not', !!line.not, on => change(s => { s.lines[k].not = on; }), 'An exception: an item passes when it does not pass this line');
    const text = el('span', { className: 'fl-text', textContent: filterLineText(line, titleOf), title: filterLineText(line, titleOf) });
    if (fieldOf(line.field).slow) text.prepend(tortoise());
    row.append(join, indent, open, not, text, close);
    return row;
  }));
  const problem = set ? filterProblem(set) : null, p = manageEl.querySelector('.fl-problem');
  p.hidden = !problem;
  p.textContent = problem ? `${problem} Until it is right, the set filters nothing.` : '';
  manageEl.querySelector('.cs-set .up').disabled = !set || chosenLine <= 0;
  manageEl.querySelector('.cs-set .down').disabled = !set || chosenLine >= lines.length - 1;
  manageEl.querySelector('.fl-linebuttons').replaceChildren(
    button('Add', () => change(s => { s.lines.splice(Math.min(chosenLine + 1, s.lines.length), 0, newFilterLine()); chosenLine = Math.min(chosenLine + 1, s.lines.length - 1); }),
      !!set, 'A new line after the one chosen, joined with And'),
    button('Remove', () => change(s => { s.lines.splice(chosenLine, 1); }), !!lines.length, 'The line chosen out of the set'));
}

// A tortoise: a field read per item after the listing, slow in a large folder (plan 32 3.1).
function tortoise() {
  const span = el('span', { className: 'fl-slow', title: 'Read per item: slow in a large folder' });
  span.innerHTML = TortoiseSvg;
  return span;
}

// ---------- The line chosen ----------

function drawEditor() {
  const set = chosenSet(), line = set?.lines?.[chosenLine], box = manageEl.querySelector('.fl-editor');
  if (!line) return box.replaceChildren(set ? el('div', { className: 'fl-note', textContent: 'No lines: every item shows. Add makes one.' }) : '');
  const f = fieldOf(line.field), kind = f.kind, c = line.cond ?? {};
  const rows = [
    el('div', { className: 'fl-row' },
      check('Folders', line.folders !== false, on => changeLine(l => { l.folders = on; }), 'The line is for folders'),
      check('Files', line.files !== false, on => changeLine(l => { l.files = on; }), 'The line is for files')),
    el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Field' }), fieldPicker(line)),
  ];
  if (f.slow) rows.push(el('div', { className: 'fl-row fl-warn' }, tortoise(), ' Read per item after the folder is listed: slow in a large folder.'));
  // What the field's value must be, together in a box under the field: its condition, and "or <field> is empty" (an
  // item that could have the field but has no value for it passes too).
  const cond = el('div', { className: 'fl-cond' }, ...conditionRows(kind, c, line));
  if (!['has', 'none'].includes(c.op)) cond.append(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption' }),
    check(`or ${f.title} is empty`, !!line.orEmpty, on => changeLine(l => { l.orEmpty = on; }),
      `An item that could have ${f.title} but has no value for it passes too`)));
  rows.push(cond);
  // Relative by the clock: its results are not kept in the folder cache (plan 36 3.8), so every use is slow again.
  if (filterRelative(line).includes('clock'))
    rows.push(el('div', { className: 'fl-row fl-warn', textContent: 'Minutes or hours from now are not kept: every time this filter is used again '
      + '(a folder opened again, the filter switched on again, a search run again) it is tested again, as slow as the first time; '
      + 'extra slow with a slow field. Days and longer are kept until the date changes.' }));
  box.replaceChildren(...rows);
}

// The field: a box to type in, its list under it (the slow ones with a tortoise in front, the names aligned).
function fieldPicker(line) {
  const wrap = el('span', { className: 'fl-picker' });
  const input = el('input', { value: titleOf(line.field), spellcheck: false, title: 'Type to find a column' });
  const list = el('div', { className: 'fl-fieldlist', hidden: true });
  let at = 0, shown = [];
  const fill = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const all = input.dataset.typed ? fields.filter(x => words.every(w => `${x.title} ${x.id}`.toLowerCase().includes(w))) : fields;
    shown = all.slice(0, 300);
    at = Math.max(0, shown.findIndex(x => x.id === line.field));
    list.replaceChildren(...shown.map((x, k) => {
      const row = el('div', { className: 'fl-fieldrow' + (k === at ? ' hot' : ''), title: x.id },
        x.slow ? tortoise() : el('span', { className: 'fl-slow' }), el('span', { textContent: x.title }));
      row.addEventListener('mousedown', e => { e.preventDefault(); pick(x); });
      return row;
    }));
    list.hidden = false;
    list.children[at]?.scrollIntoView({ block: 'nearest' });
  };
  const pick = x => {
    list.hidden = true;
    if (x.id === line.field) return;
    const kind = x.kind;
    changeLine(l => { l.field = x.id; l.cond = defaultCond(kind); if (kind === 'flag') l.orEmpty = false; });
  };
  input.addEventListener('focus', () => { input.select(); delete input.dataset.typed; fill(); });
  input.addEventListener('input', () => { input.dataset.typed = '1'; fill(); });
  input.addEventListener('blur', () => { list.hidden = true; input.value = titleOf(line.field); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      at = Math.max(0, Math.min(shown.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
      [...list.children].forEach((r, k) => r.classList.toggle('hot', k === at));
      list.children[at]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); if (shown[at]) pick(shown[at]); }
    else if (e.key === 'Escape') { e.preventDefault(); input.blur(); }
  });
  wrap.append(input, list);
  return wrap;
}

// A field's first condition when it is chosen.
const defaultCond = kind => ({ text: { op: 'wild', text: '' }, size: { op: 'range', from: null, to: null }, number: { op: 'range', from: null, to: null },
  date: { op: 'on', day: { rel: 0 } }, bool: { op: 'true' }, attrs: { op: 'attrs', attrs: {} },
  list: { op: 'in', values: [] }, flag: { op: 'has' } })[kind] ?? { op: 'has' };

const HasNone = [['has', 'has a value'], ['none', 'has no value']];
const GitValues = ['Modified', 'Added', 'Deleted', 'Renamed', 'Untracked', 'Ignored', 'Conflict'];
const SizeUnits = [['1', 'bytes'], ['1024', 'KB'], ['1048576', 'MB'], ['1073741824', 'GB']];
const DateUnits = [['minutes', 'minutes'], ['hours', 'hours'], ['days', 'days'], ['weeks', 'weeks'], ['months', 'months'], ['years', 'years']];
const setCond = edit => changeLine(l => { l.cond = { ...(l.cond ?? {}) }; edit(l.cond); });

// The rows of a kind's conditions; only those of the field chosen.
function conditionRows(kind, c, line) {
  const op = ops => el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Condition' }),
    select(ops, c.op, v => setCond(x => { x.op = v; })));
  const text = (value, change, placeholder) => {
    const box = el('input', { value: value ?? '', spellcheck: false, placeholder });
    box.addEventListener('change', () => change(box.value));
    return box;
  };
  switch (kind) {
    case 'text': {
      const rows = [op([['wild', 'matches wildcards'], ['regex', 'matches a regex'], ['contains', 'contains'], ['is', 'is'], ...HasNone])];
      if (!['has', 'none'].includes(c.op)) rows.push(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Text' }),
        text(c.text, v => setCond(x => { x.text = v; }), c.op === 'wild' ? '*.cs;*.md' : c.op === 'regex' ? '^report.*\\.pdf$' : '')));
      return rows;
    }
    case 'size': case 'number': {
      const rows = [op([['is', 'is'], ['range', 'in a range'], ...HasNone])];
      if (c.op === 'is') rows.push(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Value' }),
        number(kind, c.value, v => setCond(x => { x.value = v; }), 'Empty: no value given yet')));
      if (c.op === 'range') rows.push(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'From' }),
        number(kind, c.from, v => setCond(x => { x.from = v; })), el('span', { className: 'cs-caption', textContent: 'to' }),
        number(kind, c.to, v => setCond(x => { x.to = v; }))));
      return rows;
    }
    case 'date': {
      const rows = [op([['on', 'is on a day'], ['range', 'in a range'], ...HasNone])];
      if (c.op === 'on') rows.push(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Day' }), dayBox(c.day, v => setCond(x => { x.day = v; }))));
      if (c.op === 'range') rows.push(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'From' }), dateBox(c.from, v => setCond(x => { x.from = v; }))),
        el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'To' }), dateBox(c.to, v => setCond(x => { x.to = v; }))));
      return rows;
    }
    case 'bool': return [op([['true', 'is yes'], ['false', 'is no'], ...HasNone])];
    case 'flag': return [op(HasNone)];
    case 'attrs': {
      const row = el('div', { className: 'fl-row fl-attrs' });
      for (const [a, name] of FilterAttributes) row.append(el('label', { className: 'fl-attr' }, name + ' ',
        select([['either', 'either'], ['has', 'has'], ['not', 'has not']], c.attrs?.[a] ?? 'either', v => setCond(x => { x.attrs = { ...(x.attrs ?? {}), [a]: v }; }))));
      return [row];
    }
    case 'list': {
      const rows = [op([['in', 'is one of'], ...HasNone])];
      if (c.op === 'in') rows.push(el('div', { className: 'fl-row' }, ...GitValues.map(v => check(v, (c.values ?? []).includes(v),
        on => setCond(x => { x.values = on ? [...(x.values ?? []), v] : (x.values ?? []).filter(w => w !== v); })))));
      return rows;
    }
  }
  return [];
}

// A number of a range, empty: no limit; a size with its unit (kept in bytes).
function number(kind, value, change, empty = 'Empty: no limit at this end of the range') {
  const wrap = el('span', { className: 'cs-size' });
  const box = el('input', { type: 'number', min: 0, step: 'any', placeholder: empty.startsWith('Empty: no limit') ? 'no limit' : '', title: empty });
  if (kind !== 'size') {
    box.value = value ?? '';
    box.addEventListener('change', () => change(box.value === '' ? null : Number(box.value)));
    wrap.append(box);
    return wrap;
  }
  const n = Number(value), unit = value == null || value === '' ? '1048576' : [...SizeUnits].reverse().find(([u]) => n % Number(u) === 0)?.[0] ?? '1';
  box.value = value == null || value === '' ? '' : n / Number(unit);
  const units = select(SizeUnits, unit, () => send());
  const send = () => change(box.value === '' ? null : Math.round(Number(box.value) * Number(units.value)));
  box.addEventListener('change', send);
  wrap.append(box, units);
  return wrap;
}

// A date of a range: no limit at that end, a day, a day and a time, or relative to now: n units ago, or n units from
// now (in the future).
function dateBox(value, change) {
  const mode = !value ? 'none' : value.rel != null ? (value.ahead ? 'ahead' : 'ago') : value.abs?.includes('T') ? 'time' : 'day';
  const wrap = el('span', { className: 'fl-date' });
  const modes = select([['none', 'no limit'], ['day', 'a day'], ['time', 'a day and time'], ['ago', 'some time ago'], ['ahead', 'some time from now']], mode,
    v => change(v === 'none' ? null : v === 'ago' || v === 'ahead' ? { rel: value?.rel ?? 7, unit: value?.unit ?? 'days', ...(v === 'ahead' ? { ahead: true } : {}) }
      : { abs: today(v === 'time') }), 'No limit: the range has no end on this side; ago and from now: counted from the moment the filter is used');
  wrap.append(modes);
  if (mode === 'day' || mode === 'time') {
    const box = el('input', { type: mode === 'day' ? 'date' : 'datetime-local', value: value.abs });
    box.addEventListener('change', () => box.value && change({ abs: box.value }));
    wrap.append(box);
  } else if (mode === 'ago' || mode === 'ahead') {
    const rel = (n, u) => ({ rel: Number(n) || 0, unit: u, ...(mode === 'ahead' ? { ahead: true } : {}) });
    const n = el('input', { type: 'number', min: 0, step: 1, value: value.rel });
    const unit = select(DateUnits, value.unit ?? 'days', u => change(rel(n.value, u)));
    n.addEventListener('change', () => change(rel(n.value, unit.value)));
    wrap.append(n, unit, mode === 'ahead' ? ' from now' : ' ago');
  }
  return wrap;
}
// The day of "is on a day": today, a day, or n days ago or from now.
function dayBox(value, change) {
  const mode = !value || value.rel != null && +value.rel === 0 ? 'today' : value.rel != null ? (value.ahead ? 'ahead' : 'ago') : 'day';
  const wrap = el('span', { className: 'fl-date' });
  wrap.append(select([['today', 'today'], ['day', 'a day'], ['ago', 'some days ago'], ['ahead', 'some days from now']], mode,
    v => change(v === 'today' ? { rel: 0 } : v === 'day' ? { abs: today(false) } : { rel: value?.rel || 1, ...(v === 'ahead' ? { ahead: true } : {}) })));
  if (mode === 'day') {
    const box = el('input', { type: 'date', value: value.abs });
    box.addEventListener('change', () => box.value && change({ abs: box.value }));
    wrap.append(box);
  } else if (mode === 'ago' || mode === 'ahead') {
    const n = el('input', { type: 'number', min: 1, step: 1, value: value.rel });
    n.addEventListener('change', () => change({ rel: Math.max(1, Number(n.value) || 1), ...(mode === 'ahead' ? { ahead: true } : {}) }));
    wrap.append(n, mode === 'ahead' ? ' days from now' : ' days ago');
  }
  return wrap;
}const today = time => {
  const d = new Date(), p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}${time ? `T${p(d.getHours())}:${p(d.getMinutes())}` : ''}`;
};

// ---------- The buttons at the bottom ----------

// Opened for a pane: the filter chosen used there, none there, or what it had when Manage filters opened for it (its
// filter without a name became the temporary one: that back too).
function drawBottom() {
  const set = chosenSet(), temp = chosen === TempEntry;
  const uses = pane && (temp ? !!pane.set?.temp : pane.set?.name === set?.name);
  manageEl.querySelector('.fl-bottom').replaceChildren(
    ...(pane ? [
      button(`Use in ${pane.title}`, () => toWindow({ kind: 'apply', id: pane.id, set: temp ? { temp: true, lines: clone(set.lines) } : { name: set.name, lines: clone(set.lines) } }),
        !!set?.lines?.length && !uses, `The pane ${pane.title} filtered by this filter`),
      button('None', () => toWindow({ kind: 'apply', id: pane.id, set: null }), !!pane.set?.lines?.length, `The pane ${pane.title} not filtered`),
      button('Cancel', () => {
        const before = pane.before;
        if (before && !before.name && !before.temp) {
          saveFilters({ ...filterSets, temp: { lines: clone(before.lines) } });
          toWindow({ kind: 'apply', id: pane.id, set: { temp: true, lines: clone(before.lines), ...(before.off ? { off: true } : {}) } });
        } else toWindow({ kind: 'apply', id: pane.id, set: before ? clone(before) : null });
      }, true, `What the pane ${pane.title} had when Manage filters opened for it, back`),
    ] : []),
    button('Close', () => toWindow({ kind: 'close' })));
}
// ---------- The arrows, the keys, the line between the parts ----------

manageEl.querySelector('.cs-sets .up').addEventListener('click', () => {
  const at = filterSets.sets.findIndex(s => s.name === chosen);
  if (at > 0) moveSet(at, at - 1);
});
manageEl.querySelector('.cs-sets .down').addEventListener('click', () => {
  const at = filterSets.sets.findIndex(s => s.name === chosen);
  if (at >= 0 && at < filterSets.sets.length - 1) moveSet(at, at + 1);
});
manageEl.querySelector('.cs-set .up').addEventListener('click', () => {
  if (chosenLine > 0) change(s => { s.lines.splice(chosenLine - 1, 0, ...s.lines.splice(chosenLine, 1)); chosenLine--; });
});
manageEl.querySelector('.cs-set .down').addEventListener('click', () => change(s => {
  if (chosenLine < s.lines.length - 1) { s.lines.splice(chosenLine + 1, 0, ...s.lines.splice(chosenLine, 1)); chosenLine++; }
}));
for (const bar of manageEl.querySelectorAll('.bm-arrows')) bar.addEventListener('mousedown', e => e.preventDefault());

manageEl.querySelector('.cs-setlist').addEventListener('keydown', e => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const names = [TempEntry, ...filterSets.sets.map(s => s.name)];
  const at = names.indexOf(chosen) + (e.key === 'ArrowUp' ? -1 : 1);
  if (at < 0 || at >= names.length) return;
  chosen = names[at];
  chosenLine = 0;
  draw();
});
manageEl.querySelector('.fl-lines').addEventListener('keydown', e => {
  if (e.target !== e.currentTarget || e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const count = chosenSet()?.lines.length ?? 0;
  chosenLine = Math.max(0, Math.min(count - 1, chosenLine + (e.key === 'ArrowUp' ? -1 : 1)));
  drawLines();
  drawEditor();
});

manageEl.querySelector('.cs-split').addEventListener('mousedown', e => {
  e.preventDefault();
  const left = manageEl.querySelector('.cs-sets'), x0 = e.clientX, w0 = left.getBoundingClientRect().width;
  const width = x => Math.round(Math.max(160, Math.min(manageEl.clientWidth - 320, w0 + x - x0)));
  const move = m => manageEl.style.setProperty('--cs-left', `${width(m.clientX)}px`);
  const up = m => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    toWindow({ kind: 'split', at: width(m.clientX) });
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
});
