'use strict';
// Macros (docs/plans/executed/34-PLAN-macros.md 3.2, 3.5, 3.7): the tree the host keeps (macros\macros.json, every window gets
// it), a macro run on the active pane against the language (macrolang.js), their keys and the Macros menu. Manage
// macros is macrospane.js. Loaded after app.js.

let macros = [];          // the tree: macros { id, name, icon, key, key2, text } and folders { id, folder, items }
let macroRunning = null;  // the macro running: { name, stop } (Esc stops it)

// The tree came (the first message, or a window saved it).
function macrosCame(list) {
  macros = Array.isArray(list) ? list : [];
  buildKeys();
  paneOfKind('macros')?.render();
}

const isMacroFolder = m => typeof m.folder === 'string';

// Every macro, with the folders it is in ("Tools / Deeper"), in the tree's order.
function allMacros(list = macros, path = []) {
  return list.flatMap(m => isMacroFolder(m) ? allMacros(m.items ?? [], [...path, m.folder]) : [{ ...m, path: path.join(' / ') }]);
}
const macroById = id => allMacros().find(m => m.id === id) ?? null;
const macroByName = name => allMacros().find(m => m.name.toLowerCase() === String(name).toLowerCase()) ?? null;
const macroTitle = m => m.path ? `${m.path} / ${m.name}` : m.name;

// Their keys (3.5): as a bookmark's, taking over what they clash with (keys.js buildKeys).
const macroBindings = () => allMacros().flatMap(m => [m.key, m.key2].filter(Boolean).map(k => [k, ['macro.run', m.id]]));

// The Macros menu (3.7): the tree, folders as submenus, then Manage macros.
function macrosMenu() {
  const items = list => list.map(m => isMacroFolder(m)
    ? { label: m.folder, items: (m.items ?? []).length ? items(m.items) : [{ label: '(empty)', enabled: false }] }
    : { label: m.name, key: m.key ?? '', run: () => runMacroById(m.id) });
  return [...(macros.length ? items(macros) : [{ label: 'No macros yet', enabled: false }]), '-',
    { label: 'Manage macros...', run: () => runAction('macros.manage') }];
}

// ---------- Running one (3.7) ----------

// The steps of panes and items (3.1) beside the actions, with the values each takes.
const MacroSteps = { go: [1], select: [1], focus: [1], pane: [1] };
const MacroSystemVars = new Set(['location', 'focused', 'selected', 'count', 'other', 'pane', 'project', 'date', 'time',
  'error', 'errortext', 'exitcode', 'newline', 'tab']);
const macroContext = () => ({
  isAction: name => !!MacroSteps[name.toLowerCase()] || isAction(name),
  arities: name => MacroSteps[name.toLowerCase()] ?? null,
  systemVars: MacroSystemVars,
  macros: new Set(allMacros().map(m => m.name.toLowerCase())),
});

async function runMacroById(id) {
  const m = macroById(id);
  if (!m) return status('That macro is not there any more.', true);
  return runMacroText(m.name, m.text);
}

async function runMacroText(name, text) {
  if (macroRunning) return status(`Macro ${macroRunning.name} is still running (Esc stops it).`, true);
  const program = macroProgram(text, macroContext());
  macroRunning = { name, stop: false };
  status(`Macro ${name} runs... (Esc stops it)`);
  let r;
  try { r = await runMacro(program, macroEnv(), { everyStep: true }); }
  finally { macroRunning = null; }
  if (!r.ok) status(`Macro ${name}, line ${r.error?.line ?? '?'}: ${r.error?.message ?? 'it stopped'}`, true);
  else if (r.reason === 'stopped') status(`Macro ${name} stopped.`, true);
  else status(`Macro ${name} done.`);
  ribbonRefresh();
  return r;
}

// Esc while a macro runs stops it, before anything else has the key.
document.addEventListener('keydown', e => {
  if (!macroRunning || e.key !== 'Escape') return;
  macroRunning.stop = true;
  e.preventDefault();
  e.stopPropagation();
}, true);

let lastTurn = 0;   // when a running macro last gave the page its turn (macroEnv step)

// What a macro reads and does: the active pane at each step (3.2).
function macroEnv() {
  const view = () => views.get(activePane) ?? null;
  const two = n => String(n).padStart(2, '0');
  const now = () => new Date();
  const listMethod = name => {
    const v = view();
    if (!(v instanceof ListView) || typeof v[name] !== 'function') throw new MacroError('the active pane is no list of a folder');
    return v;
  };
  return {
    sys: name => {
      switch (name) {
        case 'location': return currentFolder() ?? '';
        case 'focused': { const x = focusedItem(); return x ? macroItemOf(x) : ''; }
        case 'selected': {
          const v = view();
          if (v instanceof ListView) return v.entries.filter(x => v.selected.has(x.id) && !x.up).map(macroItemOf);
          const x = focusedItem();
          return x ? [macroItemOf(x)] : [];
        }
        case 'count': return selectedIds().length;
        case 'other': {
          const target = activePane && layout.pane(activePane) ? otherChildOf(activePane).target : null;
          return target ? views.get(target)?.location ?? '' : '';
        }
        case 'pane': return (activePane && layout.paneName(activePane)) ?? '';
        case 'project': return project?.display ?? '';
        case 'date': { const d = now(); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; }
        case 'time': { const d = now(); return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; }
      }
      return undefined;
    },
    files: async pattern => listMethod('macroFiles').macroFiles(pattern),
    prop: async (path, name) => {
      const m = await askHost({ op: 'props', ids: [path], names: [name] });
      const v = m.values?.[path]?.[name];
      return Array.isArray(v) ? (v[2] === true ? shownDate(v[1]) : v[0] ?? '') : v ?? '';
    },
    run: async o => askHost({ op: 'macroRun', ...o, folder: o.folder || currentFolder() || '' }),
    action: async (name, args) => {
      switch (name.toLowerCase()) {
        case 'go': {
          if (!activePane) throw new MacroError('go: there is no active pane');
          await goTo(activePane, args[0]);
          // A list: its next step once it has read the folder (a tree: once it shows it, goTo's).
          const v = view();
          if (v instanceof ListView && !(v instanceof ScrapView) && !await v.loaded(args[0])) throw new MacroError(`go: "${args[0]}" was not read`);
          return;
        }
        case 'select': {
          await listMethod('selectMatching').selectMatching(args[0]);
          return;
        }
        case 'focus': {
          if (!await listMethod('focusNamed').focusNamed(args[0])) throw new MacroError(`focus: there is no "${args[0]}" here`);
          return;
        }
        case 'pane': {
          const id = [...views.keys()].find(p => layout.paneName(p)?.toLowerCase() === String(args[0]).toLowerCase());
          if (!id) throw new MacroError(`pane: there is no pane named "${args[0]}"`);
          activate(id);
          focusPane(id);
          return;
        }
      }
      if (!isAction(name)) throw new MacroError(`Foldex has no action ${name}`);
      if (!actionEnabled(name, args)) throw new MacroError(`${name} cannot run here now`);
      await runAction(name, args, { from: 'macro' });
    },
    loadMacro: name => macroByName(name)?.text ?? null,
    // After each step: Esc pressed. A macro that never waits (a loop of its own) gives the page its turn every 50 ms, so
    // Esc and the screen get through.
    step: () => {
      if (performance.now() - lastTurn < 50) return !!macroRunning?.stop;
      return new Promise(r => setTimeout(() => { lastTurn = performance.now(); r(!!macroRunning?.stop); }, 0));
    },
  };
}

// ---------- Manage macros (3.6; its page macrospane.js) ----------

// What its page is sent: the tree, each macro's icon as a picture (one not read yet asked of the host; the page is
// drawn again when it comes), what a macro may name (for its check as it is typed), the split.
function macrosForPage(view) {
  const icons = {};
  for (const m of allMacros()) {
    if (!m.icon) continue;
    if (fileIcons.get(m.icon)) icons[m.id] = fileIcons.get(m.icon);
    else if (!fileIcons.has(m.icon)) askFileIcon(m.icon).then(() => paneOfKind('macros')?.render());
  }
  return { kind: 'macros', macros, icons, split: layout.pane(view.id)?.split,
    check: { actions: [...actions.keys()], steps: Object.keys(MacroSteps), systemVars: [...MacroSystemVars] } };
}

// The tree with one macro changed, written.
function changeMacro(id, change) {
  const tree = structuredClone(macros);
  const walk = list => list.some(m => m.id === id ? (change(m), true) : isMacroFolder(m) && walk(m.items ?? []));
  if (walk(tree)) post({ op: 'macrosSave', macros: tree });
}

// What already has a key a macro is to get (keys.json, a bookmark, a filter set, another macro): a line saying so, or ''.
function macroKeyClash(key, id) {
  const first = key.includes(', ') ? key.split(', ')[0] : null;
  for (const [k, call] of keys.bindings) {
    if (call[0] === 'macro.run' && call[1] === id) continue;
    const what = call[0] === 'macro.run' ? `the macro ${macroById(call[1])?.name ?? ''}` : call[0] === 'filters.apply' ? `the filter set ${call[1]}`
      : call[0].startsWith('bookmarks.open') ? 'a bookmark' : actionTitle(call[0], call.slice(1));
    if (k === key || first && k === first || !first && k.startsWith(key + ', ')) return `${k} is ${what}: not taken.`;
  }
  return '';
}

async function macrosPageAsks(view, m) {
  switch (m.kind) {
    case 'save': return post({ op: 'macrosSave', macros: m.macros });
    case 'run': return runMacroText(m.name, m.text);
    case 'setKey': {
      const clash = m.key && macroKeyClash(m.key, m.id);
      view.send({ kind: 'keyRefused', key: 'keyRefused', text: clash || '' });
      if (!clash) changeMacro(m.id, x => { if (m.key) x[m.which] = m.key; else delete x[m.which]; });
      return;
    }
    case 'icon': {
      if (m.clear) return;
      const icon = await dialogWindow('Change Icon', { what: 'changeIcon', current: macroById(m.id)?.icon ?? null });
      if (icon) changeMacro(m.id, x => { x.icon = icon; });
      return;
    }
    case 'help': return post({ op: 'macroHelp' });
    case 'split':
      layout.pane(view.id).split = m.at;
      return tellLayout();
    case 'close': return closePane(view.id);
    case 'ask': {
      const value = m.what === 'yes' ? await askYes(m.title) : m.what === 'text' ? await askText(m.title, m.value ?? '')
        : m.what === 'folder' ? await pickFolder(m.at ?? '')
        : m.what === 'file' ? (await askHost({ op: 'pickFile', at: m.at ?? '', filter: 'Programs (*.exe;*.cmd;*.bat;*.ps1)|*.exe;*.cmd;*.bat;*.ps1|All files|*.*' })).file ?? null
        : null;
      return view.send({ kind: 'answer', key: `answer:${m.req}`, req: m.req, value });
    }
  }
}
