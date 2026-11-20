'use strict';
// Manage macros, the page of its pane (docs/plans/executed/34-PLAN-macros.md 3.6): docked in a frame of its window's page, or
// floating, laid out as Manage filters. Its window's page sends the macros (`macros`: the tree, each macro's icon as a
// picture, what a macro may name: the actions, the steps, the system variables); a change made here is sent whole
// (`save`) and written by the window. At the left the tree as the bookmarks' (folders to any depth, in your order; a
// folder opens and closes; drag a row between rows or onto a folder; Move to folder...; Delete). At the right the macro
// chosen: its name, its two keys (a key pressed in the field; refused by the window when something has it), its icon,
// and its text in an editor coloured as the language reads it, its problems under it. New: Folder..., Macro..., Run a
// program... (a form that writes a one-line run macro, and opens again on one). Run runs it on the window's active pane.

let macros = [];
let pictures = {};       // macro id -> its icon as a picture
let check = { actions: [], steps: [], systemVars: [] };
let keyNote = '';        // why a key was refused
let focusEditor = false; // a new macro: the cursor into its text once drawn
const manage = { el: document.getElementById('manage'), at: 0, closed: new Set(), wanted: null };
const clone = x => JSON.parse(JSON.stringify(x));
const isFolder = m => typeof m?.folder === 'string';
const newId = () => [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, '0')).join('');

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children.filter(c => c != null));
  return e;
};
const button = (text, run, enabled = true, title = '') => {
  const b = el('button', { type: 'button', textContent: text, disabled: !enabled, title });
  b.addEventListener('click', run);
  return b;
};

paneHandlers.macros = m => {
  macros = m.macros ?? macros;
  pictures = m.icons ?? pictures;
  check = m.check ?? check;
  if (m.split) manage.el.style.setProperty('--cs-left', `${m.split}px`);
  draw();
};
paneHandlers.keyRefused = m => { keyNote = m.text ?? ''; draw(); };

// A name, a Yes, a file or a folder asked of the window's page: its answer.
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

// Every change goes to the window's page at once: the whole tree.
function save(tree) {
  macros = tree;
  toWindow({ kind: 'save', macros: tree });
  draw();
}

// ---------- The tree ----------

// The rows shown: { m, depth, parent (a folder's id; null at the top) }, what a closed folder holds left out.
function rows() {
  const out = [];
  const walk = (list, depth, parent) => {
    for (const m of list) {
      out.push({ m, depth, parent });
      if (isFolder(m) && !manage.closed.has(m.id)) walk(m.items ?? [], depth + 1, m.id);
    }
  };
  walk(macros, 0, null);
  return out;
}

// Where an entry is in a tree (a copy): { list, index, m }.
function locate(tree, id) {
  for (const [index, m] of tree.entries()) {
    if (m.id === id) return { list: tree, index, m };
    const inside = isFolder(m) ? locate(m.items ?? [], id) : null;
    if (inside) return inside;
  }
  return null;
}
const inside = (tree, folder, id) => { const f = locate(tree, folder)?.m; return !!f && (f.id === id || !!locate(f.items ?? [], id)); };
const listOf = (tree, folder) => folder ? (locate(tree, folder).m.items ??= []) : tree;

// An entry moved to `at` in the folder `folder` (null: the top); `at` counted as the list was. A folder into itself
// or one inside it: refused.
function moveTo(id, folder, at) {
  const tree = clone(macros), from = locate(tree, id);
  if (!from || folder && inside(tree, id, folder)) return;
  const target = listOf(tree, folder), was = target.indexOf(from.m);
  from.list.splice(from.index, 1);
  if (was >= 0 && was < at) at--;
  target.splice(Math.max(0, Math.min(at, target.length)), 0, from.m);
  manage.wanted = id;
  save(tree);
}

// Where something new goes: after the chosen row in its folder; an open folder chosen: at its top inside.
function newPlace() {
  const row = rows()[manage.at];
  if (!row) return { folder: null, at: Infinity };
  if (isFolder(row.m) && !manage.closed.has(row.m.id)) return { folder: row.m.id, at: 0 };
  return { folder: row.parent, at: listOf(clone(macros), row.parent).findIndex(m => m.id === row.m.id) + 1 };
}

function addEntry(entry) {
  const tree = clone(macros), { folder, at } = newPlace(), list = listOf(tree, folder);
  list.splice(Math.min(at, list.length), 0, entry);
  manage.wanted = entry.id;
  save(tree);
}

function changeEntry(id, change) {
  const tree = clone(macros), at = locate(tree, id);
  if (!at) return;
  change(at.m);
  macros = tree;
  toWindow({ kind: 'save', macros: tree });
}

const chosen = () => rows()[manage.at]?.m ?? null;

// A macro's icon as its window's page drew it; without one, the list of steps with Play (LexPen's Macros).
const MacroIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#3a78d4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h8M2 7h8M2 10.5h5M10.5 9.5l4 2.5-4 2.5z"/></svg>');
const FolderIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 3.5h5l1.5 1.5H15v8.5H1z" fill="#e8b84a" stroke="#a87d1e"/></svg>');
const iconOf = m => el('img', { src: isFolder(m) ? FolderIcon : pictures[m.id] || MacroIcon, className: 'mc-icon' });

function drawTree() {
  const box = manage.el.querySelector('.mc-tree'), list = rows();
  if (manage.wanted) {
    const k = list.findIndex(r => r.m.id === manage.wanted);
    if (k >= 0) manage.at = k;
    manage.wanted = null;
  }
  manage.at = Math.max(0, Math.min(manage.at, list.length - 1));
  box.replaceChildren(...list.map(({ m, depth }, k) => {
    const row = el('div', { className: 'cs-row bm-row mc-row' + (k === manage.at ? ' selected' : '') + (isFolder(m) ? ' bm-group' : '') });
    row.dataset.i = k;
    const name = el('span', { className: 'bm-cell bm-name' });
    name.style.paddingLeft = `${4 + depth * 16}px`;
    const handle = el('span', { className: 'bm-handle', title: 'Drag to move it: between rows, or onto a folder' });
    const twisty = el('span', { className: 'bm-twisty' + (isFolder(m) && m.items?.length ? manage.closed.has(m.id) ? ' shut' : ' open' : '') });
    name.append(handle, twisty, iconOf(m), el('span', { textContent: isFolder(m) ? m.folder : m.name }));
    const keys = isFolder(m) ? '' : [m.key, m.key2].filter(Boolean).join(', ');
    row.append(name, el('span', { className: 'mc-keys', textContent: keys }));
    return row;
  }));
  if (!list.length) box.append(el('div', { className: 'bm-none', textContent: 'No macros yet: New makes one.' }));
  box.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  const row = list[manage.at];
  const siblings = row ? listOf(clone(macros), row.parent).map(m => m.id) : [];
  manage.el.querySelector('.bm-arrows .up').disabled = !row || siblings.indexOf(row.m.id) <= 0;
  manage.el.querySelector('.bm-arrows .down').disabled = !row || siblings.indexOf(row.m.id) >= siblings.length - 1;
  manage.el.querySelector('.mc-treebuttons').replaceChildren(
    button('New', e => newMenu(e.currentTarget), true, 'A new folder, macro or program to run, after the chosen row'),
    button('Move to folder...', e => folderMenu(e.currentTarget), !!row, 'Put the chosen entry in a folder, or at the top'),
    button('Delete', () => remove(), !!row, 'Del'));
}

function newMenu(at) {
  const r = at.getBoundingClientRect();
  openMenu(r.left, r.bottom, [
    { label: 'Folder...', run: async () => {
      const name = await askText('Name of the new folder', '');
      if (name?.trim()) addEntry({ id: newId(), folder: name.trim(), items: [] });
    } },
    { label: 'Macro...', run: async () => {
      const name = await askText('Name of the new macro', '');
      if (!name?.trim()) return;
      focusEditor = true;
      addEntry({ id: newId(), name: name.trim(), text: '', elevation: 'step' });
    } },
    { label: 'Run a program...', run: () => runForm(null) },
  ]);
}

// Move to folder: the folders, indented as in the tree, and the top; not the entry itself or a folder inside it.
function folderMenu(at) {
  const row = rows()[manage.at];
  if (!row) return;
  const items = [{ label: '(the top)', checked: !row.parent, run: () => moveTo(row.m.id, null, Infinity) }];
  const walk = (list, depth) => {
    for (const m of list) if (isFolder(m) && m.id !== row.m.id) {
      items.push({ label: `${'    '.repeat(depth)}${m.folder}`, checked: row.parent === m.id, run: () => { manage.closed.delete(m.id); moveTo(row.m.id, m.id, Infinity); } });
      walk(m.items ?? [], depth + 1);
    }
  };
  walk(macros, 0);
  const r = at.getBoundingClientRect();
  openMenu(r.left, r.bottom, items);
}

async function remove() {
  const row = rows()[manage.at];
  if (!row) return;
  const what = isFolder(row.m) ? `the folder ${row.m.folder}${row.m.items?.length ? ' and every macro in it' : ''}` : `the macro ${row.m.name}`;
  if (isFolder(row.m) && row.m.items?.length || !isFolder(row.m) && row.m.text?.trim())
    if (!await askYes(`Delete ${what}?`)) return;
  const tree = clone(macros), at = locate(tree, row.m.id);
  at.list.splice(at.index, 1);
  save(tree);
}

function upDown(step) {
  const row = rows()[manage.at];
  if (!row) return;
  const list = listOf(clone(macros), row.parent), k = list.findIndex(m => m.id === row.m.id), to = k + step;
  if (to < 0 || to >= list.length) return;
  moveTo(row.m.id, row.parent, step < 0 ? to : to + 1);
}

// A row's handle dragged (as the bookmarks', plan 27 3.4): over a folder's middle it goes in, at its end; between rows
// it goes there, in the folder those rows are in.
function dragRow(e, from) {
  e.preventDefault();
  const box = manage.el.querySelector('.mc-tree'), list = rows(), moving = list[from].m;
  let drop = null;
  box.classList.add('bm-dragging');
  const target = ev => {
    const els = [...box.querySelectorAll('.mc-row')];
    for (const [k, rowEl] of els.entries()) {
      const r = rowEl.getBoundingClientRect();
      if (ev.clientY >= r.bottom && k < els.length - 1) continue;
      const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)), row = list[k];
      let t;
      if (isFolder(row.m) && y >= 0.25 && y <= 0.75) t = { k, where: 'into', folder: row.m.id, at: Infinity };
      else if (isFolder(row.m) && !manage.closed.has(row.m.id) && row.m.items?.length && y > 0.5) t = { k, where: 'after', folder: row.m.id, at: 0 };
      else {
        const at = listOf(clone(macros), row.parent).findIndex(m => m.id === row.m.id);
        t = { k, where: y < 0.5 ? 'before' : 'after', folder: row.parent, at: at + (y < 0.5 ? 0 : 1) };
      }
      if (row.m === moving || t.folder && inside(macros, moving.id, t.folder)) return null;
      return t;
    }
    return null;
  };
  const show = () => box.querySelectorAll('.mc-row').forEach((rowEl, k) => {
    rowEl.classList.toggle('bm-drop-before', drop?.k === k && drop.where === 'before');
    rowEl.classList.toggle('bm-drop-after', drop?.k === k && drop.where === 'after');
    rowEl.classList.toggle('bm-drop-into', drop?.k === k && drop.where === 'into');
  });
  const move = ev => { drop = target(ev); show(); };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    box.classList.remove('bm-dragging');
    if (drop) moveTo(moving.id, drop.folder, drop.at);
    else draw();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

// ---------- The macro chosen ----------

// A key of the macro: focused, it takes the next key pressed (keys.js strokeOf); Backspace or Del takes it away. The
// window refuses a key that keys.json, a bookmark, a filter set or another macro has (keyRefused).
function keyField(m, which) {
  const box = el('input', { className: 'key-field', readOnly: true, spellcheck: false, value: m[which] ?? '', placeholder: 'press a key' });
  box.addEventListener('keydown', e => {
    if (['Control', 'Shift', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    keyNote = '';
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey) return toWindow({ kind: 'setKey', id: m.id, which, key: null });
    const stroke = strokeOf(e);
    if (stroke) toWindow({ kind: 'setKey', id: m.id, which, key: stroke });
  }, true);
  return box;
}

const MacroWords = new Set([...MACRO_STATEMENTS, ...MACRO_OPERATORS, 'each', 'in', 'true', 'false', 'files', ...MACRO_RUN_WINDOWS, 'admin', 'admin_forced', 'wait', 'to', 'replace', 'noreplace']);
const MacroFunctions = new Set([...Object.keys(MACRO_BUILTINS), ...Object.keys(MACRO_VALUE_BUILTINS), ...Object.keys(MACRO_ENV_FUNCTIONS)]);

// A line in the language's colours: comments, text, variables, system variables, labels, numbers, words of the
// language, functions; the rest (actions) as it is.
function colourLine(line) {
  const out = [];
  let i = 0;
  const push = (cls, text) => out.push(cls ? el('span', { className: cls, textContent: text }) : document.createTextNode(text));
  while (i < line.length) {
    const rest = line.slice(i);
    let m;
    if (rest[0] === '#') { push('mc-comment', rest); break; }
    if (rest[0] === '"') {
      m = /^"(?:[^"]|"")*"?/.exec(rest);
      push('mc-text', m[0]);
    } else if ((m = /^\$\$[A-Za-z_]\w*/.exec(rest))) push('mc-sys', m[0]);
    else if ((m = /^\$[A-Za-z_]\w*(:[A-Za-z]+)?/.exec(rest))) push('mc-var', m[0]);
    else if ((m = /^:[A-Za-z_]\w*/.exec(rest)) && !line.slice(0, i).trim()) push('mc-label', m[0]);
    else if ((m = /^\d+(\.\d+)?/.exec(rest))) push('mc-number', m[0]);
    else if ((m = /^[A-Za-z_][\w.]*/.exec(rest))) {
      const w = m[0].toLowerCase(), call = line[i + m[0].length] === '(';
      push(MacroWords.has(w) ? 'mc-word' : call && MacroFunctions.has(w) ? 'mc-function' : line[i - 1] === '.' ? 'mc-field' : '', m[0]);
    } else { m = [rest[0]]; push('', rest[0]); }
    i += m[0].length;
  }
  return out;
}

function editor(m) {
  const wrap = el('div', { className: 'mc-editor' });
  const shown = el('pre', { className: 'mc-shown', ariaHidden: 'true' });
  const text = el('textarea', { className: 'mc-text-in', spellcheck: false, value: m.text ?? '', wrap: 'off' });
  const problems = el('div', { className: 'mc-problems' });
  const paint = () => {
    shown.replaceChildren(...text.value.split('\n').flatMap((line, k) => [...(k ? ['\n'] : []), ...colourLine(line)].map(x => typeof x === 'string' ? document.createTextNode(x) : x)), document.createTextNode('\n'));
    const found = macroProgram(text.value, {
      isAction: n => check.steps.includes(n.toLowerCase()) || check.actions.includes(n),
      systemVars: new Set(check.systemVars), macros: new Set(allNames()),
    }).problems;
    problems.replaceChildren(...found.map(p => el('div', { className: `mc-problem ${p.severity}`, textContent: `Line ${p.line}: ${p.message}` })));
    problems.hidden = !found.length;
  };
  let timer = null;
  text.addEventListener('input', () => {
    paint();
    clearTimeout(timer);
    timer = setTimeout(() => changeEntry(m.id, x => { x.text = text.value; }), 400);
  });
  text.addEventListener('blur', () => { clearTimeout(timer); if (text.value !== (locate(macros, m.id)?.m.text ?? '')) changeEntry(m.id, x => { x.text = text.value; }); });
  text.addEventListener('scroll', () => { shown.scrollTop = text.scrollTop; shown.scrollLeft = text.scrollLeft; });
  // Tab puts in two spaces (the language indents nothing itself; a block reads better indented).
  text.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    document.execCommand('insertText', false, '  ');
  });
  wrap.append(shown, text);
  paint();
  if (focusEditor) { focusEditor = false; requestAnimationFrame(() => text.focus()); }
  return [wrap, problems, text];
}

const allNames = () => { const out = []; const walk = l => l.forEach(m => isFolder(m) ? walk(m.items ?? []) : out.push(m.name.toLowerCase())); walk(macros); return out; };

function drawMacro() {
  const box = manage.el.querySelector('.mc-macro'), m = chosen();
  if (!m) return box.replaceChildren(el('div', { className: 'fl-note', textContent: 'No macro chosen. New makes one; Help tells what a macro can say.' }));
  if (isFolder(m)) {
    const name = el('input', { value: m.folder, spellcheck: false });
    name.addEventListener('change', () => { if (name.value.trim()) { changeEntry(m.id, x => { x.folder = name.value.trim(); }); draw(); } });
    return box.replaceChildren(el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Folder' }), name),
      el('div', { className: 'fl-note', textContent: `${m.items?.length ?? 0 ? 'Holds macros and folders: open it at the left.' : 'Empty: New (with this folder chosen) puts one in it, or drag one onto it.'}` }));
  }
  const name = el('input', { value: m.name, spellcheck: false });
  name.addEventListener('change', () => { if (name.value.trim()) { changeEntry(m.id, x => { x.name = name.value.trim(); }); draw(); } });
  const [edit, problems] = editor(m);
  const runLine = runLineOf(m.text ?? '');
  box.replaceChildren(
    el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Name' }), name),
    el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Keys' }), keyField(m, 'key'), keyField(m, 'key2'),
      keyNote ? el('span', { className: 'fl-warn', textContent: keyNote }) : null),
    el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Icon' }), iconOf(m),
      button('Icon...', () => toWindow({ kind: 'icon', id: m.id })), button('Default', () => { changeEntry(m.id, x => { delete x.icon; }); toWindow({ kind: 'icon', id: m.id, clear: true }); }, !!m.icon)),
    elevationRow(m),
    el('div', { className: 'fl-row mc-texthead' }, el('span', { className: 'cs-caption', textContent: 'Steps' }),
      runLine ? button('Run a program...', () => runForm(m), true, 'This macro is one run line: change it in the form') : null),
    edit, problems);
}

// Administrator rights (docs/plans/executed/39-PLAN-elevated-macros.md 3.1): when the macro asks for them, if ever.
const Elevations = [
  ['step', 'At the step elevate', 'Asked where the macro says elevate; until then it runs as you'],
  ['start', 'At the start', 'Asked before the first step; the whole macro runs as administrator'],
  ['never', 'Never', 'Never asked: elevate and run ... admin are errors, and what it starts or copies does not ask for administrator (it fails instead)'],
];
function elevationRow(m) {
  const now = Elevations.find(e => e[0] === m.elevation) ?? Elevations[0];
  const box = el('select', {}, ...Elevations.map(([value, text, hint]) => el('option', { value, textContent: text, title: hint, selected: value === now[0] })));
  const note = el('span', { className: 'fl-note', textContent: now[2] });
  box.addEventListener('change', () => {
    changeEntry(m.id, x => { x.elevation = box.value; });
    note.textContent = Elevations.find(e => e[0] === box.value)[2];
  });
  return el('div', { className: 'fl-row' }, el('span', { className: 'cs-caption', textContent: 'Administrator rights' }), box, note);
}

function draw() {
  drawTree();
  drawMacro();
  manage.el.querySelector('.mc-bottom').replaceChildren(
    button('Run', () => { const m = chosen(); if (m && !isFolder(m)) toWindow({ kind: 'run', name: m.name, text: m.text ?? '', elevation: m.elevation }); },
      !!chosen() && !isFolder(chosen()), 'The macro chosen, on the active pane of the window'),
    el('span', { className: 'find-gap' }),
    button('Help', () => toWindow({ kind: 'help' }), true, 'The guide to the macro language: every statement, variable, field and function'),
    button('Close', () => toWindow({ kind: 'close' })));
}

// ---------- Run a program (3.6) ----------

// A text with system variables in it ("--verbose $$focused") as an expression of the language, each variable quoted
// ("--verbose " & quoted($$focused); the program's and the folder's not quoted: Windows takes a path as it is); and back. A part
// written otherwise: null (the form cannot show it).
const VarPart = /\$\$[A-Za-z_]\w*(?:\[\d+\])?(?:\.[A-Za-z]+)?/g;
function exprOfTemplate(t, quote = true) {
  const parts = [];
  let at = 0;
  for (const m of t.matchAll(VarPart)) {
    if (m.index > at) parts.push(`"${t.slice(at, m.index).replace(/"/g, '""')}"`);
    parts.push(quote ? `quoted(${m[0]})` : m[0]);
    at = m.index + m[0].length;
  }
  if (at < t.length || !parts.length) parts.push(`"${t.slice(at).replace(/"/g, '""')}"`);
  return parts.join(' & ');
}
function templateOf(e) {
  if (!e) return '';
  switch (e.k) {
    case 'lit': return e.s;
    case 'sys': return `$$${e.name}`;
    case 'index': { const a = templateOf(e.a); return a !== null && e.i.k === 'lit' ? `${a}[${e.i.s}]` : null; }
    case 'field': { const a = templateOf(e.a); return a !== null ? `${a}.${e.name}` : null; }
    case 'call': return e.name.toLowerCase() === 'quoted' && e.args.length === 1 && e.args[0].k !== 'lit' ? templateOf(e.args[0]) : null;
    case 'cat': { const a = templateOf(e.a), b = templateOf(e.b); return a !== null && b !== null ? a + b : null; }
  }
  return null;
}

// A macro that is one run line the form can show: its parts as the form has them; else null.
function runLineOf(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
  if (lines.length !== 1) return null;
  const p = macroProgram(lines[0], {});
  const step = p.problems.length ? null : p.main.code[0];
  if (step?.op !== 'run') return null;
  const parts = { program: templateOf(step.what), params: templateOf(step.params), folder: templateOf(step.folder),
    window: step.window, admin: step.admin, wait: step.wait };
  return parts.program === null || parts.params === null || parts.folder === null ? null : parts;
}

// The form: Program (Browse...), Parameters (a variable put in at the cursor), Start in (the pane's folder, or one
// chosen), Window, Run as administrator, Wait until it ends. OK writes the run line: a new macro (named after the
// program), or the macro it was opened on.
function runForm(m) {
  const start = (m && runLineOf(m.text ?? '')) ?? { program: '', params: '', folder: '', window: 'normal', admin: false, wait: false };
  const row = (label, ...kids) => el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: label }), ...kids);
  const dialog = el('dialog', { className: 'find mc-run' });
  const form = el('form', { method: 'dialog' });
  const program = el('input', { value: start.program, spellcheck: false, placeholder: 'a program, a document or a URL' });
  const params = el('input', { value: start.params, spellcheck: false, placeholder: 'fixed text, and variables: $$focused' });
  const inFolder = el('input', { value: start.folder, spellcheck: false, placeholder: 'empty: the folder of the active pane' });
  const windowBox = el('select', {}, ...[['normal', 'Normal'], ['minimized', 'Minimized'], ['maximized', 'Maximized'], ['hidden', 'Hidden']]
    .map(([v, t]) => el('option', { value: v, textContent: t, selected: v === start.window })));
  const admin = el('input', { type: 'checkbox', checked: start.admin }), wait = el('input', { type: 'checkbox', checked: start.wait });
  const browse = (field, what) => button('Browse...', async () => {
    const got = await askWindowPage({ what, at: field.value.trim() });
    if (got) field.value = got;
    field.focus();
  });
  // A variable put in at the cursor of Parameters (or Start in).
  const insert = field => button('Variable...', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const put = v => { field.setRangeText(v, field.selectionStart, field.selectionEnd, 'end'); field.focus(); };
    openMenu(r.left, r.bottom, [['$$focused', 'The focused item'], ['$$selected', 'The selected items'], ['$$selected[1]', 'The first selected item'],
      ['$$location', 'The folder of the active pane'], ['$$other', 'The folder of the other pane'], ['$$focused.path', 'The folder the focused item is in'],
      ['$$focused.name', 'The focused item\'s name, without its extension']].map(([v, label]) => ({ label: `${label}   ${v}`, run: () => put(v) })));
  });
  const ok = el('button', { value: 'ok', textContent: 'OK' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });
  form.append(row('Program', program, browse(program, 'file')), row('Parameters', params, insert(params)),
    row('Start in', inFolder, browse(inFolder, 'folder'), insert(inFolder)), row('Window', windowBox),
    el('div', { className: 'find-row find-checks' }, el('label', {}, admin, ' Run as administrator'), el('label', {}, wait, ' Wait until it ends')),
    el('div', { className: 'fl-note', textContent: 'A variable stands for its path, quoted when it holds a space. The macro is an ordinary macro from then on: its steps can be changed.' }),
    el('div', { className: 'ask-buttons' }, el('span', { className: 'find-gap' }), ok, cancel));
  dialog.append(el('div', { className: 'find-title', textContent: m ? `Run a program: ${m.name}` : 'Run a program' }), form);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (dialog.returnValue !== 'ok' || !program.value.trim()) return;
    const line = ['run', exprOfTemplate(program.value.trim(), false), ...(params.value.trim() ? [exprOfTemplate(params.value.trim())] : []),
      ...(inFolder.value.trim() ? ['in', exprOfTemplate(inFolder.value.trim(), false)] : []),
      ...(windowBox.value !== 'normal' ? [windowBox.value] : []), ...(admin.checked ? ['admin'] : []), ...(wait.checked ? ['wait'] : [])].join(' ');
    if (m) { changeEntry(m.id, x => { x.text = line; }); draw(); }
    else addEntry({ id: newId(), name: macroPathParts(program.value.trim()).name || 'Run', text: line });
  }, { once: true });
  dialog.showModal();
  program.focus();
}

// ---------- Keys and mouse ----------

const tree = manage.el.querySelector('.mc-tree');
tree.addEventListener('mousedown', e => {
  const r = e.target.closest('[data-i]');
  if (!r) return;
  manage.at = +r.dataset.i;
  const row = rows()[manage.at];
  if (e.target.closest('.bm-twisty') && isFolder(row?.m)) {
    manage.closed.has(row.m.id) ? manage.closed.delete(row.m.id) : manage.closed.add(row.m.id);
    keyNote = '';
    return draw();
  }
  keyNote = '';
  draw();
  if (e.button === 0 && e.target.closest('.bm-handle')) dragRow(e, manage.at);
});
tree.addEventListener('dblclick', e => {
  const row = rows()[manage.at];
  if (!e.target.closest('[data-i]') || !row) return;
  if (isFolder(row.m)) { manage.closed.has(row.m.id) ? manage.closed.delete(row.m.id) : manage.closed.add(row.m.id); draw(); }
  else manage.el.querySelector('.mc-text-in')?.focus();
});
tree.addEventListener('keydown', e => {
  const key = (e.ctrlKey ? 'Ctrl+' : '') + e.key, list = rows(), row = list[manage.at];
  if (key === 'Ctrl+ArrowUp' || key === 'Ctrl+ArrowDown') { e.preventDefault(); return upDown(key === 'Ctrl+ArrowUp' ? -1 : 1); }
  if (key === 'Delete') { e.preventDefault(); return remove(); }
  if (key === 'F2') { e.preventDefault(); return manage.el.querySelector('.mc-macro input')?.select(); }
  if (key === 'Enter' && row && !isFolder(row.m)) { e.preventDefault(); return toWindow({ kind: 'run', name: row.m.name, text: row.m.text ?? '', elevation: row.m.elevation }); }
  if (key === 'ArrowRight' && isFolder(row?.m)) { e.preventDefault(); manage.closed.delete(row.m.id); return draw(); }
  if (key === 'ArrowLeft' && row) {
    e.preventDefault();
    if (isFolder(row.m) && !manage.closed.has(row.m.id) && row.m.items?.length) manage.closed.add(row.m.id);
    else if (row.parent) manage.at = list.findIndex(r => r.m.id === row.parent);
    return draw();
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    e.preventDefault();
    manage.at = Math.max(0, Math.min(list.length - 1, manage.at + (key === 'ArrowDown' ? 1 : -1)));
    keyNote = '';
    draw();
  }
});
manage.el.querySelector('.bm-arrows .up').addEventListener('click', () => upDown(-1));
manage.el.querySelector('.bm-arrows .down').addEventListener('click', () => upDown(1));
manage.el.querySelector('.bm-arrows').addEventListener('mousedown', e => e.preventDefault());
manage.el.querySelector('.cs-split').addEventListener('mousedown', e => {
  e.preventDefault();
  const left = manage.el.querySelector('.cs-sets'), x0 = e.clientX, w0 = left.getBoundingClientRect().width;
  const width = x => Math.round(Math.max(180, Math.min(manage.el.clientWidth - 320, w0 + x - x0)));
  const move = m => manage.el.style.setProperty('--cs-left', `${width(m.clientX)}px`);
  const up = m => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    toWindow({ kind: 'split', at: width(m.clientX) });
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
});

draw();
