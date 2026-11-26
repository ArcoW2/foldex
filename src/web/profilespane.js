'use strict';
// The Manage profiles pane's page (profiles.html), docs/plans/executed/41-PLAN-profiles.md 3.5, as Manage projects
// (projects.js): every profile in one list, Default first, then by name: its name with the lock mark, open or closed,
// never open by itself, created and last opened. The buttons and a row's context menu are the Profiles menu's commands
// for the row with the focus; the host does the work and asks the passwords (AppHost.ProfileCommand, ProfileUnlock).
// Profiles open and close in their own processes, which tell nobody: the list is read again every few seconds.
// Never open by itself is a checkbox in its row. Keys: Up / Down / Home / End move, Enter opens, F2 renames, Space
// switches Never open by itself, Del deletes, Esc goes back.

const $ = s => document.querySelector(s);

// ---------- Host bridge, as projects.js ----------
const pending = new Map(), events = {};
let lastId = 0;
function host(op, args) {
  return new Promise((resolve, reject) => {
    pending.set(++lastId, { resolve, reject });
    paneHost.postMessage({ ...args, id: lastId, op });
  });
}
paneHost.addEventListener('message', e => {
  if (e.data.event) return events[e.data.event]?.(e.data);
  const { id, result, error } = e.data;
  const call = pending.get(id);
  pending.delete(id);
  error ? call?.reject(new Error(error)) : call?.resolve(result);
});

const view = { list: [], el: $('.pv-list'), count: $('.pv-count'), focus: null, busy: false };
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byNumber = n => view.list.find(p => p.number === n);
const focused = () => byNumber(view.focus) ?? null;

// ---------- Drawing ----------
const pad = n => String(n).padStart(2, '0');
function dateText(iso, time) {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` + (time ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : '');
}
const LOCK = '<svg viewBox="0 0 16 16" class="lock-mark"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/>'
  + '<path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

function rowHtml(p) {
  const cls = ['pv-row', 'pv-grid', 'pf-grid', view.focus === p.number && 'pv-focus'].filter(Boolean).join(' ');
  const state = p.current ? 'this window' : p.open ? 'open' : 'closed';
  return `<div class="${cls}" data-number="${p.number}">` +
    `<span class="pv-name pf-name" title="${escapeHtml(p.name)}${p.locked ? ' (it has a password)' : ''}">${escapeHtml(p.name)}${p.locked ? LOCK : ''}</span>` +
    `<span class="pv-state${p.open ? ' pv-open-now' : ''}">${state}</span>` +
    `<span class="pf-never"><input type="checkbox" class="pf-never-box" tabindex="-1"${p.neverOpen ? ' checked' : ''}${view.busy ? ' disabled' : ''} ` +
    `title="Never open by itself: at start it does not come back; it opens only when chosen"></span>` +
    `<span class="pv-date">${dateText(p.created, false)}</span>` +
    `<span class="pv-date">${dateText(p.opened, true)}</span></div>`;
}

function draw() {
  const top = view.el.scrollTop;
  view.el.innerHTML = view.list.map(rowHtml).join('');
  view.el.scrollTop = top;
  view.count.textContent = `${view.list.length} profile${view.list.length === 1 ? '' : 's'}`;
  const p = focused(), off = view.busy || !p;
  $('.pf-open').disabled = off || p.current;
  $('.pf-open').textContent = p?.open ? 'Show' : 'Open';
  $('.pf-copy').disabled = off;
  $('.pf-rename').disabled = off || p.isDefault;
  $('.pf-password').disabled = off || p.isDefault;
  $('.pf-close').disabled = off || !p.open;
  $('.pf-delete').disabled = off || p.isDefault;
}

// ---------- The commands (the Profiles menu's, projectmenu.js profileCommands) ----------
async function busy(work) {
  view.busy = true;
  draw();
  try { await work(); } finally { view.busy = false; await refresh(); }
}
const command = (p, kind, args = {}) => host('command', { kind, profile: p.number, ...args });
// A closed profile with a password asks it first; Copy and Delete always (3.4).
const unlock = async (p, always = false) => !p.locked || !!(await host('unlock', { profile: p.number, always }));
async function askName(title, value = '') {
  const name = await host('askName', { title, value, placeholder: '' });
  view.el.focus();
  return name;
}
const then = (kind, always = false) => p => busy(async () => { if (await unlock(p, always)) await command(p, kind); });

const COMMANDS = {
  open: p => command(p, 'open'),
  copy: p => busy(async () => {
    if (!await unlock(p, true)) return;
    const name = await askName('Name of the new profile', `Copy of ${p.name}`);
    if (name !== null) await command(p, 'copy', { name });
  }),
  rename: p => busy(async () => {
    if (!await unlock(p)) return;
    const name = await askName('Name of the profile', p.name);
    if (name) await command(p, 'rename', { name });
  }),
  password: then('password'),
  removePassword: then('removePassword'),
  neverOpen: then('neverOpen'),
  close: p => busy(() => command(p, 'close')),
  delete: p => busy(() => command(p, 'delete')),
};
function run(id) {
  const p = focused();
  if (p && !view.busy) COMMANDS[id](p);
}

// A row's context menu: the same commands as its submenu in the Profiles menu.
function menuItems(p) {
  const go = id => () => COMMANDS[id](p);
  return [
    { label: p.open ? 'Show' : 'Open', enabled: !p.current, run: go('open') },
    { label: 'Copy to a new profile...', run: go('copy') },
    { label: 'Rename...', enabled: !p.isDefault, run: go('rename') },
    ...(p.isDefault ? [] : p.locked
      ? [{ label: 'Change password...', run: go('password') }, { label: 'Remove password', run: go('removePassword') }]
      : [{ label: 'Set password...', run: go('password') }]),
    { label: 'Never open by itself', checked: p.neverOpen, run: go('neverOpen') },
    ...(p.open ? [{ label: 'Close', run: go('close') }] : []),
    ...(p.isDefault ? [] : ['-', { label: 'Delete...', run: go('delete') }]),
  ];
}

// ---------- Mouse ----------
const rowOf = e => e.target.closest('.pv-row');
view.el.addEventListener('mousedown', e => {
  const row = rowOf(e);
  if (!row) return;
  view.focus = +row.dataset.number;
  // Its Never open by itself box: switched for that row (its password first when it is closed and has one).
  if (e.button === 0 && e.target.closest('.pf-never-box')) { e.preventDefault(); return run('neverOpen'); }
  draw();
});
view.el.addEventListener('dblclick', e => { if (rowOf(e) && !e.target.closest('.pf-never-box')) run('open'); });
// The box is drawn again from the list once switched, not by the click.
view.el.addEventListener('click', e => { if (e.target.closest('.pf-never-box')) e.preventDefault(); });
view.el.addEventListener('contextmenu', e => {
  const row = rowOf(e);
  if (!row) return;
  e.preventDefault();
  view.focus = +row.dataset.number;
  draw();
  if (!view.busy) openMenu(e.clientX, e.clientY, menuItems(focused()));
});
$('.pf-open').addEventListener('click', () => run('open'));
$('.pf-copy').addEventListener('click', () => run('copy'));
$('.pf-rename').addEventListener('click', () => run('rename'));
$('.pf-close').addEventListener('click', () => run('close'));
$('.pf-delete').addEventListener('click', () => run('delete'));
// Password...: set it, or change or remove it when there is one (a small menu).
$('.pf-password').addEventListener('click', e => {
  const p = focused();
  if (!p || view.busy) return;
  if (!p.locked) return run('password');
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(r.left, r.top, [{ label: 'Change password...', run: () => run('password') }, { label: 'Remove password', run: () => run('removePassword') }]);
  const m = document.querySelector('.menu');
  if (m) m.style.top = `${Math.max(0, r.top - m.offsetHeight - 2)}px`;
});

// ---------- Keys ----------
function moveFocus(d) {
  if (!view.list.length) return;
  const at = view.list.findIndex(p => p.number === view.focus);
  view.focus = view.list[at < 0 ? 0 : Math.max(0, Math.min(view.list.length - 1, at + d))].number;
  draw();
  view.el.querySelector('.pv-focus')?.scrollIntoView({ block: 'nearest' });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') host('back');
  else if (e.key === 'ArrowDown') moveFocus(1);
  else if (e.key === 'ArrowUp') moveFocus(-1);
  else if (e.key === 'Home') moveFocus(-1e9);
  else if (e.key === 'End') moveFocus(1e9);
  else if (e.key === 'Enter') run('open');
  else if (e.key === 'F2') { if (!focused()?.isDefault) run('rename'); }
  else if (e.key === ' ') run('neverOpen');
  else if (e.key === 'Delete') { if (!focused()?.isDefault) run('delete'); }
  else return;
  e.preventDefault();
});

// ---------- Host events ----------
async function refresh() {
  view.list = await host('list');
  if (!byNumber(view.focus)) view.focus = view.list.find(p => p.current)?.number ?? null;
  draw();
}
events.profiles = () => { clearTimeout(view.refreshTimer); view.refreshTimer = setTimeout(refresh, 300); };
events.settings = m => applyLook(m.settings.values, m.themes.themes);
setInterval(() => { if (!view.busy && document.visibilityState === 'visible') refresh(); }, 3000);

(async () => {
  const init = await host('init');
  applyLook(init.look.settings.values, init.look.themes.themes);
  view.list = init.list ?? [];
  view.focus = view.list.find(p => p.current)?.number ?? null;
  draw();
  view.el.focus();
})();
