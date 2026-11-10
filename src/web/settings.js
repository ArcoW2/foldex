'use strict';
// The settings window (View > Foldex > Settings; SettingsForm.cs hosts it), as LexPen's cut down
// (docs/plans/07-PLAN-themes.md 3.5): a row per setting of SETTING_ROWS (settingrows.js), in groups, filtered by the
// search box. A change goes to the host at once (setSetting); the host writes your settings.json and tells every
// window, this one included (settings). Esc empties the search; a second Esc closes the window.

const host = window.chrome.webview;
const $ = s => document.querySelector(s);
const ui = { search: $('.st-search'), problems: $('.st-problems'), list: $('.st-list') };
let look = null;   // { settings: { values, user, defaults, problems }, themes: { themes, problems } }
const rows = [];   // { def, el, show }
let fonts = [];    // the installed font families (Fonts.cs), asked once

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
  // A size in points (docs/plans/08-PLAN-fonts.md 3.2), 4 to 36, or a percentage, 0 to 200; written when the box is
  // left or Enter.
  if (def.kind === 'size' || def.kind === 'percent') {
    const [min, max, step] = def.kind === 'size' ? [4, 36, 0.5] : [0, 200, 5];
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', min, max, step });
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (Number.isFinite(v) && v >= min && v <= max) set(def.name, v);
    });
    return { el: input, show: v => input.value = v };
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

function build() {
  for (const group of SETTING_GROUPS) {
    const section = document.createElement('section');
    section.className = 'st-group';
    section.innerHTML = '<h2></h2>';
    section.querySelector('h2').textContent = group;
    for (const def of SETTING_ROWS.filter(r => r.group === group)) {
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

function filter() {
  const words = ui.search.value.toLowerCase().split(/\s+/).filter(w => w);
  for (const r of rows) {
    const text = `${r.def.title} ${r.def.hint ?? ''} ${r.def.name} ${r.def.group}`.toLowerCase();
    r.el.hidden = !words.every(w => text.includes(w));
  }
  for (const s of ui.list.querySelectorAll('.st-group')) s.hidden = !s.querySelector('.st-row:not([hidden])');
}

ui.search.addEventListener('input', filter);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (ui.search.value) {
    ui.search.value = '';
    filter();
  } else post({ op: 'close' });
});
document.querySelector('[data-open=settings]').addEventListener('click', () => post({ op: 'openSettingsFile' }));
darkQuery.addEventListener('change', () => look && show());

host.addEventListener('message', e => {
  if (e.data.event === 'fonts') {
    fonts = e.data.fonts;
    if (look) show();
    return;
  }
  if (e.data.event !== 'settings') return;
  look = e.data;
  if (!rows.length) build();
  show();
});
post({ op: 'ready' });
post({ op: 'fonts' });
ui.search.focus();
