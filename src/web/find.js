'use strict';
// The Find dialog (docs/plans/executed/06-PLAN-search-and-scrap.md 3.3, after xplorer2's "Find files or folders"): where and
// what to look for, and the scrap the results go into. Nothing opens until OK: then a new scrap (or the one chosen
// under Into) becomes the active pane and the results stream into it (ScrapView.search, app.js). A scrap keeps its
// search, so Search again opens this with it, into that scrap, cleared first.

let searches = { predefined: {}, lookIn: [], named: [] };   // searches.json (SearchesFile.cs): kept for every project
const SearchListMax = 20;   // earlier folders and names offered (chosen, not measured)

// `again`: a scrap whose search is opened again.
function openFind({ again = null } = {}) {
  const active = activeView();
  const saved = again ? layout.pane(again.id).search ?? {} : {};
  const start = { ...SearchDefaults, ...saved };
  // Look in: the active pane's folder, or the active scrap (a search in its items); Search again: what it had.
  let lookScrap = again ? views.get(saved.lookInScrap) ?? null : active instanceof ScrapView ? active : null;
  if (!again) start.lookIn = lookScrap ? '' : currentFolder() ?? searches.lookIn[0] ?? '';
  const scrapLabel = v => `Scrap: ${v.tabTitle()}`;

  const dialog = document.createElement('dialog');
  dialog.className = 'find';
  const form = document.createElement('form');
  form.method = 'dialog';
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const check = (label, on) => {
    const box = el('input', { type: 'checkbox', checked: on });
    return [box, el('label', {}, box, ` ${label}`)];
  };
  const list = (id, values) => el('datalist', { id }, ...values.map(v => el('option', { value: v })));
  // In the order of the Tab key (3.3): Files, Folders, Regular expression and Fuzzy before Named, Containing text
  // (plan 20) right after it.
  const lookIn = el('input', { value: lookScrap ? scrapLabel(lookScrap) : start.lookIn, spellcheck: false });
  lookIn.setAttribute('list', 'find-lookin');
  const [subfolders, subfoldersLabel] = check('Search subfolders', start.subfolders);
  const depth = el('input', { type: 'radio', name: 'order', checked: start.depthFirst });
  const breadth = el('input', { type: 'radio', name: 'order', checked: !start.depthFirst });
  const [useIndex, useIndexLabel] = check('Use search index', start.useIndex);
  useIndexLabel.title = 'Everything or the Windows Search index where they have the folder; off: Foldex walks the folders';
  const [files, filesLabel] = check('Files', start.files);
  const [folders, foldersLabel] = check('Folders', start.folders);
  const [regex, regexLabel] = check('Regular expression', start.regex);
  const fuzzy = el('input', { type: 'number', min: 0, max: 100, value: start.fuzzy, className: 'find-fuzzy',
    title: 'How closely a name must hold Named: 100 exactly; lower finds names with a few letters different' });
  const named = el('input', { value: start.named, spellcheck: false, className: 'find-named' });
  named.setAttribute('list', 'find-named');
  const predefined = el('select', {}, el('option', { value: '', textContent: '' }),
    ...Object.keys(searches.predefined).sort(collator.compare).map(n => el('option', { value: n, textContent: n })));
  const save = el('button', { type: 'button', textContent: 'Save' });
  const into = el('select', {}, el('option', { value: '', textContent: 'New scrap' }),
    ...scrapViews().map(v => el('option', { value: v.id, textContent: v.tabTitle() })));
  into.value = again?.id ?? '';
  const [clearFirst, clearFirstLabel] = check('Clear the scrap first', !!again);
  const clearButton = el('button', { type: 'button', textContent: 'Clear' });
  const ok = el('button', { value: 'ok', textContent: 'OK' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });

  const syncFuzzy = () => { fuzzy.disabled = regex.checked; };
  const syncClear = () => { clearFirst.disabled = !into.value; };
  regex.addEventListener('change', syncFuzzy);
  into.addEventListener('change', () => {
    clearFirst.checked = !!again && into.value === again.id;   // on for the scrap's own search again, else off
    syncClear();
  });
  lookIn.addEventListener('input', () => { if (lookScrap && lookIn.value !== scrapLabel(lookScrap)) lookScrap = null; });
  const fill = o => {
    subfolders.checked = o.subfolders;
    depth.checked = o.depthFirst;
    breadth.checked = !o.depthFirst;
    useIndex.checked = o.useIndex;
    files.checked = o.files;
    folders.checked = o.folders;
    regex.checked = o.regex;
    fuzzy.value = o.fuzzy;
    named.value = o.named;
    syncFuzzy();
  };
  predefined.addEventListener('change', () => {
    const o = searches.predefined[predefined.value];
    if (!o) return;
    fill({ ...SearchDefaults, ...o });
    if (o.lookIn) {
      lookIn.value = o.lookIn;
      lookScrap = null;
    }
  });
  const options = () => ({
    lookIn: lookScrap ? null : lookIn.value.trim(), lookInScrap: lookScrap?.id ?? null,
    subfolders: subfolders.checked, depthFirst: depth.checked, useIndex: useIndex.checked, files: files.checked,
    folders: folders.checked, regex: regex.checked, fuzzy: Math.min(100, Math.max(0, Number(fuzzy.value) || 0)), named: named.value.trim(),
  });
  save.addEventListener('click', async () => {
    const name = await askTextOver(dialog, 'Name of this search', predefined.value);
    if (!name) return;
    const o = options();
    delete o.lookInScrap;
    if (lookScrap) delete o.lookIn;
    searches.predefined = { ...searches.predefined, [name]: o };
    post({ op: 'searchesSave', searches });
    if (![...predefined.options].some(x => x.value === name)) predefined.append(el('option', { value: name, textContent: name }));
    predefined.value = name;
  });
  clearButton.addEventListener('click', () => {
    fill(SearchDefaults);
    predefined.value = '';
    named.focus();
  });

  form.append(
    el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: 'Look in' }), lookIn),
    el('div', { className: 'find-row find-checks' }, subfoldersLabel, el('label', {}, depth, ' Go depth first'),
      el('label', {}, breadth, ' Breadth first'), useIndexLabel),
    el('div', { className: 'find-row find-checks' }, filesLabel, foldersLabel, regexLabel,
      el('label', { className: 'find-fuzzy-label' }, 'Fuzzy ', fuzzy)),
    el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: 'Named' }), named),
    el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: 'Predefined' }), predefined, save),
    el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: 'Into' }), into, clearFirstLabel),
    el('div', { className: 'ask-buttons' }, clearButton, el('span', { className: 'find-gap' }), ok, cancel),
    list('find-lookin', searches.lookIn), list('find-named', searches.named));
  dialog.append(el('div', { className: 'find-title', textContent: 'Find files or folders' }), form);
  document.body.append(dialog);
  syncFuzzy();
  syncClear();
  dialog.showModal();
  named.select();   // the keyboard in Named (3.3)

  form.addEventListener('submit', e => {
    if (e.submitter !== ok) return;
    const o = options();
    if (!o.files && !o.folders) {
      e.preventDefault();
      return status('Find: Files, Folders or both.', true);
    }
    if (!lookScrap && !o.lookIn) {
      e.preventDefault();
      lookIn.focus();
      return status('Find: a folder to look in.', true);
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (dialog.returnValue !== 'ok') return activeView()?.body.focus();
    const o = options();
    remember(o);
    runSearch(o, lookScrap, into.value ? views.get(into.value) : null, clearFirst.checked);
  }, { once: true });
}

// The folder and the name go to the front of their lists.
function remember(o) {
  const front = (list, value) => value ? [value, ...list.filter(v => v.toLowerCase() !== value.toLowerCase())].slice(0, SearchListMax) : list;
  searches = { ...searches, lookIn: front(searches.lookIn, o.lookIn), named: front(searches.named, o.named) };
  post({ op: 'searchesSave', searches });
}

// The search runs (3.4): into a new scrap at the right of the active pane in the center (or of the center's first
// pane: one docked at a side has no room), or into the one chosen (cleared first when asked); that scrap becomes the
// active pane. A search in a scrap tests only that scrap's items.
function runSearch(o, lookScrap, target, clearFirst) {
  const within = lookScrap ? lookScrap.all.map(x => x.id) : null;
  const beside = docks.areaOf(activePane) === 'center' ? activePane : docks.panes().find(p => docks.areaOf(p) === 'center' && docks.visible(p));
  const scrap = target ?? newScrap(o.named || 'Search', beside ? { pane: beside, side: 'right' } : { area: 'center' });
  if (target) {
    showPane(target.id);
    if (clearFirst) target.clear();
  }
  scrap.search({ ...o, within });
}

async function renameScrap(view) {
  const name = await askText('Name of this scrap', view.tabTitle());
  if (!name) return;
  layout.pane(view.id).name = scrapName(name, scrapViews().filter(v => v !== view).map(v => v.tabTitle()));
  view.showName();
  tellLayout();
}

// A name asked while the Find dialog is open: the small dialog on top of it.
function askTextOver(dialog, title, value) {
  return askText(title, value).then(name => {
    dialog.querySelector('.find-named')?.focus();
    return name;
  });
}
