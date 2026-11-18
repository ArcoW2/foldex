'use strict';
// The Rename dialog (docs/plans/executed/21-PLAN-multi-rename.md 3.1): F2 with more than one item selected. What changes (the
// name, the extension or both) and how (renamer.js: a pattern, a part, find and replace, the date in the name, the
// case), the tokens picked from a list, and the preview: every item with its new name, live, the ones that would go
// wrong marked; nothing is renamed before Rename. Companions (the files beside one with the same name and another
// extension) go along as the setting renameCompanions says. Saved renames are kept for every project (renames.json).
// The dialog is in a modal floating window of its own (plan 14 3.7, renameHere); the preview and the tokens' examples
// are made here, where the items are, and asked for by the window.

let renames = { predefined: {} };   // renames.json (RenamesFile.cs)

const RenameDefaults = { mode: 'pattern', target: 'name', template: '$B', match: '', regex: false, matchCase: false,
  from: 1, length: 1, fromEnd: false, dateFrom: 'found', dateFormat: 'yyyy-MM-dd', shiftDays: 0, shiftHours: 0, caseTo: '',
  counter: { start: 1, step: 1, digits: 1 }, companions: true };

// A column by the title its header shows (Date taken, Size, ...): its id (Foldex's own or Windows' property).
function columnByTitle(title) {
  const t = title.toLowerCase();
  return OwnColumns.find(c => c.title.toLowerCase() === t)?.id ?? propList?.find(p => p.title.toLowerCase() === t)?.name ?? null;
}

// An entry as renamer.js takes it.
function renameItem(x) {
  const parts = x.id.replace(/\\+$/, '').split('\\');
  const raw = id => {
    if (!id) return null;
    if (!id.includes('.')) return typeof x[id] === 'number' ? x[id] : null;
    const v = x.props?.[id]?.[1];
    return typeof v === 'number' ? v : null;
  };
  return {
    id: x.id, name: x.name, folder: !!x.folder, parent: parts.at(-2) ?? '', grandparent: parts.at(-3) ?? '',
    value: (column, format) => {
      const id = columnByTitle(column) ?? column;
      const ms = raw(id);
      if (format && ms != null && (columnInfo(id).kind === 'date' || id.includes('Date'))) return formatDate(ms, format);
      return columnText(x, id) || '';
    },
    raw: which => raw({ taken: 'System.Photo.DateTaken', modified: 'modified', created: 'created' }[which]),
  };
}

// The tokens of the syntax in use, for the list: [label, token]; dates with a format of their own.
function renameTokens(syntax) {
  const tc = syntax === 'bracket';
  const col = (name, format) => tc ? `[=${name}${format ? ':' + format : ''}]` : `\${${name}${format ? ':' + format : ''}}`;
  const dates = name => DateFormats.map(f => [`${name} as ${f}`, col(name, f)]);
  return [
    ['Name (without the extension)', tc ? '[N]' : '$B'], ['Extension', tc ? '[E]' : '$E'], ['Whole name', tc ? '[N].[E]' : '$N'],
    ['Parent folder', tc ? '[P]' : '$P'], ['Folder above that', tc ? '[G]' : '$G'],
    ['Counter', tc ? '[C]' : '$001'], ['First three characters of the name', tc ? '[N1-3]' : '$[1:3]'],
    ['Last three characters of the name', tc ? '[N-3,3]' : '$[-3:3]'],
    ['Date taken', dates('Date taken')], ['Date modified', dates('Date modified')], ['Date created', dates('Date created')],
    ['Author', col('Authors')], ['Title', col('Title')], ['Camera model', col('Camera model')], ['Dimensions', col('Dimensions')],
    [tc ? 'A [' : 'A $', tc ? '[[' : '$$'],
  ];
}

async function openRenameMany(view, ids) {
  const entries = view.entries.filter(x => ids.some(id => same(id, x.id)));
  if (entries.length < 2) return;
  await askPropList();
  const syntax = settings.renameTokens === 'bracket' ? 'bracket' : 'dollar';
  const o = { ...RenameDefaults, syntax, template: syntax === 'bracket' ? '[N]' : '$B', companions: settings.renameCompanions !== false };

  // The names in each folder now (for "exists in that folder"): the pane's own items for its folder; for items of
  // other folders (a scrap) what the host says is there.
  const existing = new Map();
  const folderKey = id => id.replace(/\\[^\\]*$/, '').toLowerCase();
  if (view.location) existing.set(view.location.replace(/\\+$/, '').toLowerCase(), new Set(view.all.map(x => x.name.toLowerCase())));

  // The values the tokens and the date ask for, read for every item once; the preview waits for them.
  const wanted = ['System.Photo.DateTaken', 'System.Author', 'System.Title', 'System.Photo.CameraModel', 'System.Image.Dimensions'];
  const lacking = entries.filter(x => wanted.some(n => !(x.props && n in x.props)));
  const propsRead = lacking.length ? view.askProps(lacking, wanted) : null;

  // Every item with its new name for the settings `s`.
  const previewOf = s => {
    const preview = renamePreview(entries.map(renameItem), s, existing);
    // Companions along: the files beside a file whose name before the extension changes, with that name (3.5).
    if (s.companions) {
      const chosen = new Set(entries.map(x => x.id.toLowerCase()));
      for (const r of [...preview]) {
        const x = entries.find(e => e.id === r.id);
        if (!r.changed || r.problem || x.folder || s.target === 'ext') continue;
        const before = splitName(x.name).base, after = splitName(r.to).base;
        if (before === after) continue;
        for (const c of view.all ?? view.entries)
          if (!c.folder && !chosen.has(c.id.toLowerCase()) && folderKey(c.id) === folderKey(x.id) && splitName(c.name).base.toLowerCase() === before.toLowerCase()) {
            const to = `${after}.${splitName(c.name).ext}`;
            preview.push({ id: c.id, name: c.name, to, changed: true, companion: true,
              problem: existing.get(folderKey(c.id))?.has(to.toLowerCase()) && to.toLowerCase() !== c.name.toLowerCase() ? 'exists in that folder' : null });
          }
      }
    }
    return preview;
  };
  // The token list, each token with what it gives for the first item.
  const tokensOf = s => {
    const first = renameItem(entries[0]);
    const token = (label, t) => ({ label, token: t, sample: expandTokens(t, first, 0, s) });
    return renameTokens(syntax).map(([label, t]) => Array.isArray(t) ? { label, items: t.map(([l, x]) => token(l, x)) } : token(label, t));
  };

  const r = await dialogWindow(`Rename ${entries.length} items`, { what: 'rename', o, sample: entries[0].name, renames }, async m => {
    if (m.renames) {
      renames = m.renames;
      return void post({ op: 'renamesSave', renames });
    }
    if (propsRead) await propsRead;
    return { preview: previewOf(m.settings), tokens: tokensOf(m.settings) };
  });
  if (!r) return;
  const todo = previewOf(r.settings).filter(x => x.changed && !x.problem);
  // A changed extension asks first, once for all (as the rename in place).
  if (todo.some(x => !entries.find(e => e.id === x.id)?.folder && splitName(x.to).ext.toLowerCase() !== splitName(x.name).ext.toLowerCase())
    && !await askYes('If you change a file name extension, the file might become unusable. Are you sure you want to change it?'))
    return view.body.focus();
  post({ op: 'renameMany', renames: todo.map(x => [x.id, x.to]) });
  status(`Renaming ${todo.length} items...`);
  view.body.focus();
}

// The dialog itself (dialogpage.js, in its window): `a` from openRenameMany. Its answer: { settings }, or null for
// Cancel.
function renameHere(a) {
  renames = a.renames;
  const o = a.o, syntax = o.syntax;
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const select = (options, value) => {
    const s = el('select', {}, ...Object.entries(options).map(([v, label]) => el('option', { value: v, textContent: label })));
    s.value = value;
    return s;
  };
  const check = (label, on) => {
    const box = el('input', { type: 'checkbox', checked: on });
    return [box, el('label', {}, box, ` ${label}`)];
  };
  const num = (value, width = '4.5em') => Object.assign(el('input', { type: 'number', value }), { style: `width: ${width}` });

  const dialog = el('dialog', { className: 'find rename-many' });
  const form = el('form', { method: 'dialog' });
  const mode = select(RenameModes, o.mode), target = select(RenameTargets, o.target);
  const template = el('input', { value: o.template, spellcheck: false, className: 'rn-template' });
  // The token list: a drop-down (a menu of the page would open under the dialog), each token with what it gives for
  // the first item; choosing one puts it in at the cursor (3.3).
  const tokens = el('select', { className: 'rn-tokens', title: 'Pick a token to put in at the cursor' });
  const match = el('input', { value: '', spellcheck: false });
  const [regex, regexLabel] = check('Regular expression', false), [matchCase, caseLabel] = check('Case counts', false);
  // A part: marked in the first item's name, or by position.
  const sample = el('input', { value: a.sample, readOnly: true, spellcheck: false, title: 'Mark the part to change, with the mouse or Shift and the arrows' });
  const from = num(1), length = num(1), [fromEnd, fromEndLabel] = check('From the end', false);
  const dateFrom = select({ found: 'The date found in the name', taken: 'The date taken', modified: 'The date modified', created: 'The date created' }, 'found');
  const dateFormat = el('input', { value: 'yyyy-MM-dd', spellcheck: false, style: 'width: 12em' });
  dateFormat.setAttribute('list', 'rn-formats');
  const shiftDays = num(0), shiftHours = num(0);
  const caseTo = select(RenameCases, '');
  const counterStart = num(1), counterStep = num(1), counterDigits = num(1);
  const [companions, companionsLabel] = check('Rename companions along (same name, another extension)', o.companions);
  const predefined = el('select', {}, el('option', { value: '', textContent: '' }),
    ...Object.keys(renames.predefined).sort(collator.compare).map(n => el('option', { value: n, textContent: n })));
  const save = el('button', { type: 'button', textContent: 'Save' });
  const count = el('span', { className: 'rn-count' });
  const list = el('div', { className: 'rn-list' });
  const ok = el('button', { value: 'ok', textContent: 'Rename' });
  const cancel = el('button', { value: 'cancel', textContent: 'Cancel', formNoValidate: true });

  const row = (label, ...kids) => el('div', { className: 'find-row' }, el('span', { className: 'find-label', textContent: label }), ...kids);
  const rows = {
    template: row('New name', template, tokens),
    match: row('Find', match, regexLabel, caseLabel),
    part: el('div', {}, row('The part', sample), row('', el('span', { textContent: 'From ' }), from, el('span', { textContent: ' length ' }), length, fromEndLabel)),
    date: el('div', {}, row('The date', dateFrom), row('Written as', dateFormat, el('span', { textContent: ' shifted ' }), shiftDays,
      el('span', { textContent: ' days ' }), shiftHours, el('span', { textContent: ' hours' }))),
    counter: row('Counter', el('span', { textContent: 'start ' }), counterStart, el('span', { textContent: ' step ' }), counterStep,
      el('span', { textContent: ' digits ' }), counterDigits),
  };
  form.append(
    row('Change', target), row('How', mode), rows.template, rows.match, rows.part, rows.date, rows.counter,
    row('Then the case', caseTo), el('div', { className: 'find-row find-checks' }, companionsLabel),
    row('Predefined', predefined, save),
    el('div', { className: 'find-row' }, count), list,
    el('div', { className: 'ask-buttons' }, el('span', { className: 'find-gap' }), ok, cancel),
    el('datalist', { id: 'rn-formats' }, ...DateFormats.map(f => el('option', { value: f }))));
  dialog.append(el('div', { className: 'find-title', textContent: 'Rename' }), form);
  document.body.append(dialog);

  // The settings as the fields have them.
  const settingsNow = () => ({
    mode: mode.value, target: target.value, template: template.value, match: match.value, regex: regex.checked,
    matchCase: matchCase.checked, from: Number(from.value) || 1, length: Math.max(0, Number(length.value) || 0), fromEnd: fromEnd.checked,
    dateFrom: dateFrom.value, dateFormat: dateFormat.value, shiftDays: Number(shiftDays.value) || 0, shiftHours: Number(shiftHours.value) || 0,
    caseTo: caseTo.value, counter: { start: Number(counterStart.value) || 0, step: Number(counterStep.value) || 1, digits: Math.max(1, Number(counterDigits.value) || 1) },
    syntax, companions: companions.checked,
  });
  const fill = s => {
    mode.value = s.mode; target.value = s.target; template.value = s.template; match.value = s.match; regex.checked = s.regex;
    matchCase.checked = s.matchCase; from.value = s.from; length.value = s.length; fromEnd.checked = s.fromEnd; dateFrom.value = s.dateFrom;
    dateFormat.value = s.dateFormat; shiftDays.value = s.shiftDays; shiftHours.value = s.shiftHours; caseTo.value = s.caseTo;
    counterStart.value = s.counter.start; counterStep.value = s.counter.step; counterDigits.value = s.counter.digits; companions.checked = s.companions;
  };

  // The preview and the tokens' examples, from the window's page; only the last one asked is shown.
  let asked = 0;
  const update = async () => {
    const s = settingsNow();
    for (const [name, el] of Object.entries(rows)) el.hidden = !({
      template: ['pattern', 'part', 'replace', 'replaceAll'], match: ['replace', 'replaceAll'], part: ['part'], date: ['date'],
      counter: syntax === 'bracket' ? ['pattern', 'part', 'replace', 'replaceAll'] : [] }[name].includes(s.mode));
    rows.template.querySelector('.find-label').textContent = s.mode === 'pattern' ? 'New name' : 'Put in';
    const n = ++asked;
    const got = await askWindow({ settings: s });
    if (n !== asked) return;
    const preview = got.preview ?? [];
    const changed = preview.filter(r => r.changed), wrong = preview.filter(r => r.problem);
    count.textContent = `${changed.length} of ${preview.length} renamed` + (wrong.length ? `; ${wrong.length} cannot be: see the marked lines` : '');
    ok.disabled = !changed.length || wrong.length > 0;
    list.replaceChildren(el('div', { className: 'rn-head' }, el('span', { textContent: 'Now' }), el('span', { textContent: 'New name' })),
      ...preview.map(r => el('div', { className: 'rn-row' + (r.changed ? '' : ' same') + (r.problem ? ' wrong' : '') + (r.companion ? ' companion' : ''),
        title: r.problem ? `Cannot be: ${r.problem}` : r.companion ? 'A companion: renamed along' : '' },
        el('span', { textContent: r.name }), el('span', { textContent: r.to + (r.problem ? `  (${r.problem})` : '') }))));
    const option = t => el('option', { value: t.token, textContent: `${t.label}   ${t.token}   ${t.sample}` });
    tokens.replaceChildren(el('option', { value: '', textContent: 'Tokens...' }), ...(got.tokens ?? []).map(t => t.items
      ? el('optgroup', { label: t.label }, ...t.items.map(option)) : option(t)));
  };
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(update, 80); };
  form.addEventListener('input', later);
  form.addEventListener('change', later);
  // A part marked in the first name: its place and length.
  const marked = () => {
    if (sample.selectionEnd <= sample.selectionStart) return;
    const subject = target.value === 'ext' ? splitName(sample.value).ext : target.value === 'whole' ? sample.value : splitName(sample.value).base;
    const offset = target.value === 'ext' ? sample.value.length - subject.length : 0;
    const start = Math.max(0, sample.selectionStart - offset), end = Math.min(subject.length, sample.selectionEnd - offset);
    if (end <= start) return;
    fromEnd.checked = false;
    from.value = start + 1;
    length.value = end - start;
    if (mode.value !== 'part') mode.value = 'part';
    later();
  };
  sample.addEventListener('select', marked);
  sample.addEventListener('mouseup', marked);
  sample.addEventListener('keyup', marked);

  // The cursor's place in the pattern kept for the token list.
  let cursor = null;
  template.addEventListener('blur', () => { cursor = [template.selectionStart, template.selectionEnd]; });
  tokens.addEventListener('change', () => {
    const token = tokens.value;
    tokens.value = '';
    if (!token) return;
    const [at, end] = cursor ?? [template.value.length, template.value.length];
    template.value = template.value.slice(0, at) + token + template.value.slice(end);
    template.focus();
    template.setSelectionRange(at + token.length, at + token.length);
    later();
  });

  predefined.addEventListener('change', () => {
    const s = renames.predefined[predefined.value];
    if (s) fill({ ...RenameDefaults, ...s, counter: { ...RenameDefaults.counter, ...s.counter } });
    update();
  });
  save.addEventListener('click', async () => {
    const name = await askText('Name of this rename', predefined.value);
    template.focus();
    if (!name) return;
    const s = settingsNow();
    delete s.syntax;
    renames = { predefined: { ...renames.predefined, [name]: s } };
    askWindow({ renames });
    if (![...predefined.options].some(x => x.value === name)) predefined.append(el('option', { value: name, textContent: name }));
    predefined.value = name;
  });

  ok.disabled = true;
  update();
  dialog.showModal();
  template.select();

  form.addEventListener('submit', e => {
    if (e.submitter === ok && ok.disabled) e.preventDefault();
  });
  return new Promise(resolve => dialog.addEventListener('close', () => {
    dialog.remove();
    resolve(dialog.returnValue === 'ok' ? { settings: settingsNow() } : null);
  }, { once: true }));
}
