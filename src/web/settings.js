'use strict';
// The settings window (View > Foldex > Settings; SettingsForm.cs hosts it), as LexPen's cut down
// (docs/plans/executed/07-PLAN-themes.md 3.5): a row per setting of SETTING_ROWS (settingrows.js), in tabs and their
// groups (SETTING_TABS; Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PgDn / PgUp go from tab to tab, as LexPen's), filtered by the
// search box: a search looks through every tab, the tabs with a match stand out, and while typing the first tab with
// one is shown when the tab shown has none. A change goes to the host at once (setSetting); the host writes your
// settings.json and tells every window, this one included (settings). Esc empties the search; a second Esc closes the
// window.

const host = paneHost;   // hostpane.js: through the window's page (a pane, plan 14 3.7)
const $ = s => document.querySelector(s);
const ui = { search: $('.st-search'), count: $('.st-count'), problems: $('.st-problems'), tabs: $('.st-tabs'), list: $('.st-list') };
let look = null;   // { settings: { values, user, defaults, problems }, themes: { themes, problems } }
const rows = [];   // { def, el, show }
const SliderDelay = 200;   // ms a slider rests before the host gets its value
let fonts = [];    // the installed font families (Fonts.cs), asked once
let listersShown = () => { };   // the lister plugins' row: draws what the host tells of them (event listers)

const post = msg => host.postMessage(msg);

function set(name, value) {
  post({ op: 'setSetting', name, value });
}

function control(def) {
  if (def.kind === 'toggle') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => set(def.name, input.checked));
    return { el: input, show: v => input.checked = !!v };
  }
  // A size in points (docs/plans/executed/08-PLAN-fonts.md 3.2), 4 to 36; written when the box is left or Enter.
  if (def.kind === 'size') {
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', min: 4, max: 36, step: 0.5 });
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (Number.isFinite(v) && v >= 4 && v <= 36) set(def.name, v);
    });
    return { el: input, show: v => input.value = v };
  }
  // A slider (range: min, max, step) with its value, as LexPen's: the value shows while dragging, the host gets it once
  // the slider rests SliderDelay ms (each step would redraw every window), and at once on release.
  if (def.kind === 'range') {
    const [min, max, step] = def.range;
    const box = document.createElement('span');
    box.className = 'st-range';
    const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step });
    const value = document.createElement('span');
    value.className = 'st-range-value';
    let timer = 0;
    const apply = () => { clearTimeout(timer); timer = 0; set(def.name, +input.value); };
    input.addEventListener('input', () => {
      value.textContent = input.value + def.unit;
      clearTimeout(timer);
      timer = setTimeout(apply, SliderDelay);
    });
    input.addEventListener('change', () => { if (timer) apply(); });
    box.append(input, value);
    return { el: box, show: v => { input.value = v; value.textContent = input.value + def.unit; } };
  }
  // The viewer kept per type (previewViewers; docs/plans/33-PLAN-preview-plugins.md 3.1): each with Remove (back to the
  // first viewer the type has).
  if (def.kind === 'viewers') {
    const box = Object.assign(document.createElement('div'), { className: 'st-list-box' });
    const name = id => ({ foldex: 'Foldex', windows: 'Windows', lexpen: 'LexPen' })[id] ?? String(id).replace(/^lister:/, '');
    const fill = v => {
      const kept = Object.entries(v ?? {}).sort(([a], [b]) => a.localeCompare(b));
      box.replaceChildren(...kept.map(([ext, id]) => {
        const row = Object.assign(document.createElement('div'), { className: 'st-list-row' });
        const remove = Object.assign(document.createElement('button'), { textContent: 'Remove', title: 'Back to the first viewer this type has' });
        remove.addEventListener('click', () => { const next = { ...v }; delete next[ext]; set(def.name, next); });
        row.append(Object.assign(document.createElement('span'), { textContent: `${ext}: ${name(id)}` }), remove);
        return row;
      }));
      if (!kept.length) box.append(Object.assign(document.createElement('span'), { className: 'st-hint', textContent: 'None chosen.' }));
    };
    return { el: box, show: fill };
  }
  // The lister plugins (previewListers; plan 33 3.2): the plugins folder's and the ones added by path, each with its
  // name and what it takes (its detect string), or why it cannot be used; Add... picks a file (the host), Remove takes
  // one added by path away.
  if (def.kind === 'listers') {
    const box = Object.assign(document.createElement('div'), { className: 'st-list-box' });
    const list = Object.assign(document.createElement('div'));
    const add = Object.assign(document.createElement('button'), { textContent: 'Add...', title: 'Add a lister plugin (.wlx64) by its file' });
    add.addEventListener('click', () => post({ op: 'pickLister' }));
    box.append(list, add);
    let paths = [];
    listersShown = info => list.replaceChildren(...info.map(p => {
      const row = Object.assign(document.createElement('div'), { className: 'st-list-row' });
      const text = Object.assign(document.createElement('span'), { textContent: p.name, title: p.path });
      const what = Object.assign(document.createElement('span'), { className: 'st-hint',
        textContent: p.error ? `: ${p.error}` : `: ${p.detect || 'every file'}${p.inFolder ? ' (in the plugins folder)' : ''}` });
      row.append(text, what);
      if (!p.inFolder) {
        const remove = Object.assign(document.createElement('button'), { textContent: 'Remove' });
        remove.addEventListener('click', () => set(def.name, paths.filter(x => x.toLowerCase() !== p.path.toLowerCase())));
        row.append(remove);
      }
      return row;
    }));
    return { el: box, show: v => { paths = v ?? []; post({ op: 'listers' }); } };
  }
  // A text: written when the box is left or Enter.
  if (def.kind === 'text') {
    const input = Object.assign(document.createElement('input'), { type: 'text', spellcheck: false });
    input.addEventListener('change', () => set(def.name, input.value.trim()));
    return { el: input, show: v => input.value = v ?? '' };
  }
  // The dates' format (dates.js): System (Windows' short date and time), one of DatePresets, or your own, typed in the
  // box beside the list (written when it is left or Enter); each with how a date now looks.
  if (def.kind === 'dateFormat') {
    const box = Object.assign(document.createElement('span'), { className: 'st-date' });
    const select = document.createElement('select');
    const input = Object.assign(document.createElement('input'), { type: 'text', spellcheck: false, placeholder: 'Your own format' });
    const example = Object.assign(document.createElement('span'), { className: 'st-hint' });
    const now = Date.now();
    const fill = v => {
      const own = v && !DatePresets.includes(v);
      select.replaceChildren(new Option(`System (${systemDate}): ${formatDateTime(now, systemDate || 'yyyy-MM-dd HH:mm')}`, ''),
        ...DatePresets.map(p => new Option(`${p}: ${formatDateTime(now, p)}`, p)), new Option('Your own...', 'own'));
      select.value = own ? 'own' : v ?? '';
      input.value = v ?? '';
      input.hidden = !own;
      example.textContent = own ? formatDateTime(now, v) : '';
    };
    select.addEventListener('change', () => {
      if (select.value !== 'own') return set(def.name, select.value);
      input.hidden = false;
      input.focus();
    });
    input.addEventListener('input', () => { example.textContent = input.value.trim() ? formatDateTime(now, input.value) : ''; });
    input.addEventListener('change', () => set(def.name, input.value.trim()));
    box.append(select, input, example);
    return { el: box, show: fill };
  }
  // A colour of your own or the default (docs/plans/executed/28-PLAN-column-sets-window.md 3.4): '' the default (the hint says
  // which), else #rrggbb; Use this colour on takes the colour box's.
  if (def.kind === 'colour') {
    const box = document.createElement('span');
    box.className = 'st-colour';
    const own = Object.assign(document.createElement('input'), { type: 'checkbox' });
    const label = document.createElement('label');
    label.append(own, ' Use this colour');
    const input = Object.assign(document.createElement('input'), { type: 'color' });
    input.addEventListener('change', () => { own.checked = true; set(def.name, input.value); });
    own.addEventListener('change', () => set(def.name, own.checked ? input.value : ''));
    box.append(label, input);
    return { el: box, show: v => { own.checked = !!v; if (v) input.value = v; } };
  }
  const select = document.createElement('select');
  select.addEventListener('change', () => set(def.name, select.value));
  const fill = () => {
    const options = def.kind === 'theme'
      ? Object.entries(look.themes.themes).map(([id, t]) =>
          [id, `${t.name}${t.description ? ` - ${t.description}` : ''}${t.mine ? ' (yours)' : ''}`])
      : def.kind === 'font' ? [['', 'Segoe UI (default)'], ...fonts.map(f => [f, f])]
      : def.options;
    select.replaceChildren(...options.map(([value, label]) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      if (def.kind === 'font' && value) o.style.fontFamily = `"${value.replace(/["\\]/g, '')}"`;   // each in itself
      return o;
    }));
  };
  return { el: select, show: v => { fill(); select.value = v; } };
}

// ---------- Tabs ----------

let tab = null;   // the tab shown; kept for the next time the window opens
const tabNames = SETTING_TABS.map(([name]) => name);

function showTab(name) {
  tab = name;
  try { localStorage.settingsTab = name; } catch { /* no storage: the first tab next time */ }
  for (const b of ui.tabs.children) b.classList.toggle('st-on', b.dataset.tab === name);
  filter();
  ui.list.scrollTop = 0;
}

// Next / previous tab (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PgDn / PgUp).
function stepTab(dir) {
  showTab(tabNames[(tabNames.indexOf(tab) + dir + tabNames.length) % tabNames.length]);
}

function build() {
  let stored = null;
  try { stored = localStorage.settingsTab; } catch { /* no storage: the first tab */ }
  tab = tabNames.includes(stored) ? stored : tabNames[0];
  for (const name of tabNames) {
    const b = Object.assign(document.createElement('button'), { className: 'st-tab', textContent: name });
    b.dataset.tab = name;
    b.addEventListener('click', () => showTab(name));
    ui.tabs.append(b);
  }
  for (const [tabName, groups] of SETTING_TABS) for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'st-group';
    section.dataset.tab = tabName;
    section.innerHTML = '<h2></h2>';
    section.querySelector('h2').textContent = group;
    for (const def of SETTING_ROWS.filter(r => r.tab === tabName && r.group === group)) {
      const el = document.createElement('div');
      el.className = 'st-row';
      el.innerHTML = '<div class="st-text"><div class="st-title"></div><div class="st-hint"></div></div><div class="st-control"></div>' +
        '<button class="st-reset" title="Back to the default">Reset</button>';
      el.querySelector('.st-title').textContent = def.title;
      el.querySelector('.st-hint').textContent = def.hint ?? '';
      const c = control(def);
      el.querySelector('.st-control').append(c.el);
      el.querySelector('.st-reset').addEventListener('click', () => set(def.name, look.settings.defaults[def.name]));
      section.append(el);
      rows.push({ def, el, show: c.show });
    }
    ui.list.append(section);
  }
  for (const b of ui.tabs.children) b.classList.toggle('st-on', b.dataset.tab === tab);
}

function show() {
  applyLook(look.settings.values, look.themes.themes);
  for (const r of rows) {
    r.show(look.settings.values[r.def.name]);
    r.el.classList.toggle('mine', look.settings.user.includes(r.def.name));
  }
  const problems = [...look.settings.problems, ...look.themes.problems];
  ui.problems.hidden = problems.length === 0;
  ui.problems.textContent = problems.join(' ');
  filter();
}

// The rows of the tab shown; with words only those that match. The tabs with a match stand out; while typing
// (`typing`), when the tab shown has none, the first tab with one is shown.
function filter(typing = false) {
  const words = ui.search.value.toLowerCase().split(/\s+/).filter(w => w);
  const matches = r => {
    const text = `${r.def.title} ${r.def.hint ?? ''} ${r.def.name} ${r.def.group} ${r.def.tab}`.toLowerCase();
    return words.every(w => text.includes(w));
  };
  const found = new Set(rows.filter(matches).map(r => r.def.tab));
  if (typing && words.length && !found.has(tab) && found.size) {
    tab = tabNames.find(t => found.has(t));
    for (const b of ui.tabs.children) b.classList.toggle('st-on', b.dataset.tab === tab);
  }
  let shown = 0;
  for (const r of rows) {
    r.el.hidden = r.def.tab !== tab || !matches(r);
    if (!r.el.hidden) shown++;
  }
  for (const s of ui.list.querySelectorAll('.st-group')) s.hidden = !s.querySelector('.st-row:not([hidden])');
  document.body.classList.toggle('st-searching', words.length > 0);
  for (const b of ui.tabs.children) b.classList.toggle('st-has', words.length > 0 && found.has(b.dataset.tab));
  const total = rows.filter(matches).length;
  ui.count.textContent = !words.length ? '' : total === shown ? `${shown} found` : `${shown} here, ${total} in all tabs`;
}

ui.search.addEventListener('input', () => filter(true));
document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) {
    e.preventDefault();
    return stepTab(e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1);
  }
  if (e.key !== 'Escape') return;
  e.preventDefault();   // not on to the window (pane.js)
  if (ui.search.value) {
    ui.search.value = '';
    filter();
  } else post({ op: 'close' });
});
document.querySelector('[data-open=settings]').addEventListener('click', () => post({ op: 'openSettingsFile' }));
darkQuery.addEventListener('change', () => look && show());

host.addEventListener('message', e => {
  // What the folder cache holds now (plan 24 3.5): under its slider's hint, every few seconds.
  if (e.data.event === 'cacheInfo') {
    const row = rows.find(r => r.def.name === 'folderCacheMB');
    if (!row) return;
    let now = row.el.querySelector('.st-now');
    if (!now) row.el.querySelector('.st-text').append(now = Object.assign(document.createElement('div'), { className: 'st-hint st-now' }));
    now.textContent = `In use now: ${(e.data.bytes / 1048576).toFixed(1)} MB, ${e.data.folders} folder(s); read ahead so far: ${e.data.readAhead}.`;
    return;
  }
  if (e.data.event === 'listers') return listersShown(e.data.list ?? []);
  if (e.data.event === 'fonts') {
    fonts = e.data.fonts;
    if (look) show();
    return;
  }
  if (e.data.event !== 'settings') return;
  look = e.data;
  systemDate = look.settings.systemDate ?? '';
  if (!rows.length) build();
  show();
});
post({ op: 'ready' });
post({ op: 'fonts' });
ui.search.focus();
