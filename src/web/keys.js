'use strict';
// Keys (from LexPen's keys.js): which key runs which action (keys.json, merged with the user's own by the host, see
// KeysFile.cs), and the key presses: chords ("Ctrl+K, K"). The actions are in actions.js. Moving the cursor in a pane
// (arrows, Page Up / Down, Home, End) is the pane's own, not in keys.json.

// KeyboardEvent.code -> the name keys.json uses. By the physical key, so a dead key (` on US-International)
// or another layout gives the same name.
const KEY_NAMES = {
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
  Quote: "'", Period: '.', Comma: 'Comma', Slash: '/', Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Esc', Space: 'Space',
  Backspace: 'Backspace', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', NumpadAdd: 'NumPlus', NumpadSubtract: 'NumMinus',
};

function altGrText(e) {
  if (!e.getModifierState?.('AltGraph') || e.key.length !== 1) return false;
  const own = /^Key[A-Z]$/.test(e.code) ? e.code[3] : /^Digit\d$/.test(e.code) ? e.code[5] : null;
  return own !== null && e.key.toUpperCase() !== own;
}

// A key press as keys.json writes it ("Ctrl+Shift+S"); null for a key it has no name for.
function strokeOf(e, shift = e.shiftKey) {
  const c = e.code;
  const name = /^Key[A-Z]$/.test(c) ? c[3] : /^Digit\d$/.test(c) ? c[5] : /^Numpad\d$/.test(c) ? 'Num' + c[6]
    : /^F\d{1,2}$/.test(c) ? c : KEY_NAMES[c];
  if (!name) return null;
  // AltGr is Ctrl+Alt to Windows (left Ctrl+Alt is AltGr on a layout that has one, as US-International), but the
  // browser reports it as AltGraph with Ctrl and Alt off: counted as Ctrl+Alt, so Ctrl+Alt+C is Ctrl+Alt+C.
  const altGr = !!e.getModifierState?.('AltGraph');
  return (e.ctrlKey || altGr ? 'Ctrl+' : '') + (e.altKey || altGr ? 'Alt+' : '') + (shift ? 'Shift+' : '') + name;
}

const keys = {
  bindings: new Map(),   // "F5", "Ctrl+K, K" -> [action, ...parameters]
  prefixes: new Set(),   // the first keys of chords
  byAction: new Map(),   // "pane.newChild right" -> ["Ctrl+Alt+N"]: for the ribbon's tooltips and F1
  pending: null,         // the first key of a chord, waiting for the second
  file: { keys: {}, order: [] },   // keys.json as the host merged it
};

// An action's id for its keys: an old name (favourites.menu) as the action it is now.
const callId = call => [ActionAliases[call[0]] ?? call[0], ...call.slice(1)].join(' ');

// The merged set from the host: { keys, order, problems }.
function setKeys({ keys: map, order, problems }) {
  keys.file = { keys: map, order };
  buildKeys();
  const unknown = [...new Set([...keys.bindings.values()].map(c => c[0]))].filter(name => !isAction(name));
  if (unknown.length) problems = [...problems, 'unknown action ' + unknown.join(', ')];
  if (problems.length) status('keys.json: ' + problems.join('; '), true);
}

// The key set: keys.json's, then the bookmarks' (docs/plans/executed/26-PLAN-bookmarks.md 3.6) and the kept filter sets'. A bookmark's key takes over
// what it clashes with: the same key, the chords a single key starts, a single key a chord starts with.
function buildKeys() {
  keys.bindings.clear();
  for (const key of keys.file.order) {
    const value = keys.file.keys[key];
    keys.bindings.set(key, Array.isArray(value) ? value : [value]);
  }
  // Then the kept filter sets' keys (plan 32 3.8), as the bookmarks'.
  const filterKeys = typeof filterSets !== 'undefined' ? filterSets.sets.filter(s => s.key).map(s => [s.key, ['filters.apply', s.name]]) : [];
  // And the macros' (plan 34 3.5), as the bookmarks'.
  const macroKeys = typeof macroBindings === 'function' ? macroBindings() : [];
  for (const [key, call] of [...(typeof bookmarkBindings === 'function' ? bookmarkBindings() : []), ...filterKeys, ...macroKeys]) {
    const first = key.includes(', ') ? key.split(', ')[0] : null;
    for (const k of [...keys.bindings.keys()]) if (k === key || k === first || !first && k.startsWith(key + ', ')) keys.bindings.delete(k);
    keys.bindings.set(key, call);
  }
  keys.prefixes.clear();
  keys.byAction.clear();
  for (const [key, call] of keys.bindings) {
    if (key.includes(', ')) keys.prefixes.add(key.split(', ')[0]);
    const id = callId(call);
    if (!keys.byAction.has(id)) keys.byAction.set(id, []);
    keys.byAction.get(id).push(key);
  }
}

// The keys of an action: all of them, or the first one for a tooltip ('' without a key).
const keysOf = (name, ...params) => keys.byAction.get(callId([name, ...params])) ?? [];
const keyText = (name, ...params) => keysOf(name, ...params)[0] ?? '';
// A title with its key, for tooltips: "Copy (Ctrl+C)".
const withKey = (title, name, ...params) => keyText(name, ...params) ? `${title} (${keyText(name, ...params)})` : title;

// In a text box the keys that edit text are its own, and Esc, which ends its editing (a rename cancelled, not the
// filter cleared): only keys with Alt, function keys and Ctrl keys other than the editing ones run actions there.
const TEXT_KEYS = /^(Shift\+)?(Backspace|Del|Enter|Esc|Home|End|Left|Right|Up|Down|Space|Tab)$|^Ctrl\+(Shift\+)?[ACVXYZ]$|^Ctrl\+(Left|Right|Backspace|Del)$/;
const inTextField = () => !!document.activeElement?.matches('input, textarea, [contenteditable]:not([contenteditable=false])');
// Keys a text box takes for itself besides those (its data-own-keys, as "F2"): the rename box's F2 (rename.js).
const ownKey = stroke => inTextField() && (document.activeElement.dataset.ownKeys ?? '').split(' ').includes(stroke);

function setPending(stroke) {
  keys.pending = stroke;
  if (stroke) status(`${stroke}, ...`, false, 'verbose');
}

document.addEventListener('keydown', e => {
  if (e.isComposing || ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return;
  // A modal window (F1) handles its own keys.
  if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
  // AltGr types its character (US-International: AltGr+C is (c)) in a text box, and where keys.json binds nothing to
  // that key; elsewhere a bound one runs (Ctrl+Alt+C).
  if (!keys.pending && altGrText(e) && (inTextField() || !keys.bindings.has(strokeOf(e)))) return;
  const stroke = strokeOf(e);
  if (keys.pending) {
    const first = keys.pending;
    setPending(null);
    e.preventDefault();   // the second key of a chord never types
    e.stopPropagation();
    if (stroke && stroke !== 'Esc') runKey(`${first}, ${stroke}`, e);
    return;
  }
  if (!stroke || inTextField() && TEXT_KEYS.test(stroke) && !e.altKey || ownKey(stroke)) return;
  if (keys.prefixes.has(stroke)) {
    e.preventDefault();
    e.stopPropagation();
    return setPending(stroke);
  }
  runKey(stroke, e);
}, true);

// Runs the key's action; a key without one does what it does.
function runKey(key, e) {
  const call = keys.bindings.get(key);
  if (!call) {
    if (key.includes(', ')) status(`${key} is not a key.`, true);
    return;
  }
  if (runAction(call[0], call.slice(1), { from: 'key' }) === PASS) return;
  e.preventDefault();
  e.stopPropagation();
}
