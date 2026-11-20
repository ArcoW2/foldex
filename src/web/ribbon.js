'use strict';
// The ribbon (docs/plans/executed/19-PLAN-ribbon-change-mode.md; LexPen's ribbon.js taken over, with Foldex's names):
// tabs of named groups of buttons, each button an action (ribbon.json: yours, else the shipped one; RibbonFile.cs). Its
// tab names in a row of their own above its buttons (Foldex has no menu bar). A button is large (icon above its label,
// the full height) or small (icon and label, a third of it); up to three small ones stack in a column, or one above or
// under a large one (that a row shorter). A group may have an action in each bottom corner. An action with variants or
// a list (dropDown) is a split button: its arrow (and its right-click) lists them. Alt shows key tips. The ribbon
// changes only in its change mode: dragging (also from F1's list), right-click, "New...", Ctrl+Z; every change is
// written to your ribbon.json at once. Per window (kept with its layout, plan 15): the tab shown, the height and only
// when wanted (rbWin).

// ---------- State ----------
const rb = {
  model: null,        // { tabs: [{ name, groups: [{ name, corners: { left, right }, items }] }] }
  user: false,        // your ribbon.json is in use
  tab: null,          // the tab shown: its name
  changing: false,    // change mode
  customizing: null,  // the Customize window's channel while it is open
  resetting: false,   // Reset asked: the ribbon the host sends next is taken, also while changing
  undo: [],           // the model before each change (change mode, Customize)
  tips: 0,            // key tips: 0 off, 1 the tabs', 2 the shown tab's buttons'
  typed: '',          // the first letter of a two-letter tip
  altAlone: false,    // Alt pressed with no other key yet
  down: false,        // only when wanted: slid down
  els: null,
};
// This window's own (its layout keeps them, app.js windowLayout): the tab shown, the row height, always or only when
// wanted.
const rbWin = { tab: null, row: RB_ROW_FULL, show: 'always' };
// A pane's page (view.html?pane=...) loads this file too: no ribbon there, only its Alt told to the window.
const rbInPane = new URLSearchParams(location.search).has('pane');

const rbCall = item => [item.action, ...(item.params ?? [])];
const rbShown = () => !rbInPane && !!rb.model?.tabs.length && !!rb.els;
const rbTabIndex = () => Math.max(0, rb.model?.tabs.findIndex(t => t.name === rb.tab) ?? 0);
const ribbonChanging = () => rb.changing;
const rbEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The ribbon from the host: at the start (hello) and when a window changed it (the event ribbon). While this window
// changes it, its own is the one (it sent it), unless Reset asked for the shipped one.
function setRibbon({ ribbon, user, problems }) {
  if (rbInPane) return;
  if (rb.resetting) {
    rb.resetting = false;
    if (rb.changing || rb.customizing) rb.undo.push(structuredClone(rb.model));
    status('The shipped ribbon' + (rb.changing || rb.customizing ? ' (Ctrl+Z takes it back).' : '.'));
  } else if (rb.model && (rb.changing || rb.customizing)) return;
  rb.model = ribbon;
  rb.user = !!user;
  if (problems?.length) status('ribbon.json: ' + problems.join('; '), true);
  renderRibbon();
  rbcRefill();
}

// This window's ribbon state from its layout (app.js start), and kept there when it changes.
// The tab: the one shown when the window closed with the setting ribbonRememberTab, else Home (the first tab when there
// is none named so).
function rbWindow(saved) {
  Object.assign(rbWin, { tab: null, row: RB_ROW_FULL, show: 'always' }, saved ?? {});
  if (settings.ribbonRememberTab !== true) rbWin.tab = 'Home';
  rb.tab = rbWin.tab;
  if (rb.model) renderRibbon();
}
function rbSetWindow(name, value) {
  rbWin[name] = value;
  if (typeof tellLayout === 'function') tellLayout();
  if (name === 'row') rbApplyHeight();
  if (name === 'show') { rbApplyShow(); rbOverflow(); }
}

// The ribbon's elements in #ribbon: its tab names, its tabs' bodies, the grip under them.
function rbElements() {
  if (rb.els) return rb.els;
  const el = document.getElementById('ribbon');
  el.className = 'ribbon';
  el.tabIndex = -1;   // the keys while key tips show (rbTipsFocus)
  el.innerHTML = '<div class="rb-tabs"></div><div class="rb-bodies"></div>' +
    '<div class="rb-grip-h" title="Drag: the ribbon lower or higher (up past its lowest: only when wanted); double click: the full height"></div>';
  rb.els = { el, row: el.querySelector('.rb-tabs'), bodies: el.querySelector('.rb-bodies') };
  const grip = el.querySelector('.rb-grip-h');
  grip.addEventListener('pointerdown', rbGripDown);
  grip.addEventListener('dblclick', () => { rbSetWindow('row', RB_ROW_FULL); rbOverflow(); });
  rb.els.row.addEventListener('pointerdown', rbTabsDown);
  el.addEventListener('mousedown', e => { if (!rb.changing && e.target.closest('button')) e.preventDefault(); });   // the keyboard stays in the pane
  el.addEventListener('click', rbClick);
  el.addEventListener('contextmenu', rbContext);
  el.addEventListener('dragstart', rbDragStart);
  el.addEventListener('dragover', rbDragOver);
  el.addEventListener('dragleave', e => { if (!e.currentTarget.contains(e.relatedTarget)) rbMarkDrop(null); });
  el.addEventListener('drop', rbDrop);
  el.addEventListener('dragend', rbDragEnd);
  new ResizeObserver(() => rbOverflow()).observe(el);
  return rb.els;
}

// ---------- Drawing ----------
// The shield of the elevated helper (plan 31 3.3; app.js showHelper): shown while it runs.
const helperShown = () => typeof helperRunning !== 'undefined' && helperRunning;
function drawHelperShield(on) {
  const b = document.querySelector('#ribbon .rb-shield');
  if (b) b.hidden = !on;
}

function renderRibbon() {
  if (rbInPane) return;
  const box = document.getElementById('ribbon');
  if (!rb.model?.tabs.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const { el, row, bodies } = rbElements();
  document.body.classList.toggle('rb-changing', rb.changing);
  el.classList.toggle('rb-names', settings.ribbonGroupNames !== false);
  el.style.setProperty('--rb-ch', (Number(settings.ribbonLabelWidth) || 24) + 'ch');
  const tabs = rb.model.tabs;
  if (!tabs.some(t => t.name === rb.tab)) rb.tab = tabs.some(t => t.name === rbWin.tab) ? rbWin.tab : tabs[0]?.name ?? null;
  row.innerHTML = tabs.map((t, ti) => `<button class="rb-tab${t.name === rb.tab ? ' on' : ''}" data-tab="${ti}"${rb.changing ? ' draggable="true"' : ''} tabindex="-1">${rbEsc(t.name)}</button>`).join('') +
    (rb.changing ? '<button class="rb-tab rb-new" data-new-tab tabindex="-1">New...</button>' : '') +
    // The elevated helper runs (plan 31 3.3): a shield in the warning colour; a click ends it.
    `<button class="rb-shield" tabindex="-1"${helperShown() ? '' : ' hidden'} title="Administrator rights: the elevated helper runs (Windows asked once). A click ends it; the next task that needs it asks again.">` +
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5l5.5 2v4c0 3.5-2.4 6-5.5 7-3.1-1-5.5-3.5-5.5-7v-4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 4.5v4.5M8 11.3h0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
  // Every tab's groups (one shown): a tab name dragged over shows its tab without taking away the dragged button.
  bodies.innerHTML = tabs.map((t, ti) => `<div class="rb-body" data-body="${ti}"${t.name === rb.tab ? '' : ' hidden'}>` +
    t.groups.map((g, gi) => rbGroupHtml(ti, gi, g)).join('') +
    (rb.changing ? `<div class="rb-group rb-new-group" data-new-group="${ti}"><div class="rb-cols"><i>New...</i></div></div>` : '') +
    '</div>').join('') +
    '<button class="rb-more" hidden tabindex="-1" title="The groups that do not fit">&gt;&gt;</button>' +
    (rb.changing ? '<button class="rb-done" tabindex="-1" title="End changing the ribbon (Esc); Ctrl+Z takes the last change back">Done</button>' : '') +
    '<button class="rb-collapse" tabindex="-1"></button>';
  rbApplyHeight();
  rbApplyShow();
  if (rb.tips) rbShowTips();
  ribbonRefresh();
  rbOverflow();
}

function rbGroupHtml(ti, gi, g) {
  const cols = ribbonColumns(g.items).map(c => {
    if (c.kind === 'divider') return `<div class="rb-div" data-path="${ti}.${gi}.${c.i}"${rb.changing ? ' draggable="true"' : ''}></div>`;
    if (c.kind === 'large') {   // alone, or with a small one above or under it
      const html = c.items.map(({ item, i }) => rbButtonHtml(`${ti}.${gi}.${i}`, item, item.size === 'large' ? 'large' : 'small')).join('');
      return c.items.length > 1 ? `<div class="rb-col rb-col-large">${html}</div>` : html;
    }
    return `<div class="rb-col">${c.items.map(({ item, i }) => rbButtonHtml(`${ti}.${gi}.${i}`, item, 'small')).join('')}</div>`;
  }).join('');
  const corner = side => {
    const k = ribbonCorner(g.corners?.[side]), c = k?.call;
    if (!c && !rb.changing) return '';
    if (c && !actionDef(c[0]) && !rb.changing) return '';
    const title = c ? rbTip(c, rbDropDown(c[0], k.open)) : `The ${side} corner: drop an action here`;
    return `<button class="rb-corner rb-${side}${c ? '' : ' rb-empty'}${c && rbDropDown(c[0], k.open) ? ' rb-drop-down' : ''}" data-corner="${ti}.${gi}.${side}"${c && rb.changing ? ' draggable="true"' : ''} title="${rbEsc(title)}" tabindex="-1"></button>`;
  };
  return `<div class="rb-group" data-group="${ti}.${gi}" title="${settings.ribbonGroupNames === false ? rbEsc(g.name) : ''}">` +
    (rb.changing ? `<span class="rb-grip" draggable="true" data-grip="${ti}.${gi}" title="Drag the group; right-click: rename, remove"></span>` : '') +
    `<div class="rb-cols">${cols}</div><div class="rb-name">${corner('left')}<span>${rbEsc(g.name)}</span>${corner('right')}</div></div>`;
}

// The icon has a drawing for the parameter itself (a preset, a bar's kind): no mark on it.
const rbOwnDrawing = call => !!RIBBON_ICONS.buttons[call.join(' ')];

// A button's or corner's tooltip: its title and key, and on a line under it what it does (the action's hint); one
// that opens a drop-down says so.
function rbTip(call, dropDown = false) {
  const hint = actionDef(call[0])?.hint;
  return withKey(actionTitle(call[0], call.slice(1)), ...call) + (dropDown ? ' (drop-down)' : '') + (hint ? '\n' + hint : '');
}

function rbButtonHtml(path, item, size) {
  const call = rbCall(item), def = actionDef(item.action);
  if (!def) return rb.changing ? `<button class="rb-btn rb-${size} rb-missing" data-path="${path}" draggable="true" title="No action ${rbEsc(item.action)} (drag it off to remove it)" tabindex="-1">?</button>` : '';
  const title = actionTitle(item.action, item.params ?? []), label = item.label || title;
  const icon = ribbonIcon(call, size) ?? `<span class="rb-letter">${rbEsc(label.trim()[0] ?? '?')}</span>`;
  const list = rbHasList(item), arrow = '<span class="rb-arrow" data-arrow title="Its list"></span>';
  const mark = item.params?.length && !rbOwnDrawing(call) ? `<span class="rb-mark">${rbEsc(String(item.params[0]))}</span>` : '';
  return `<button class="rb-btn rb-${size}" data-path="${path}" data-call="${rbEsc(JSON.stringify(call))}"${rb.changing ? ' draggable="true"' : ''} title="${rbEsc(rbTip(call, rbDropDown(item.action, item.open)))}" tabindex="-1">` +
    `<span class="rb-icon">${icon}${mark}</span>` +
    // With a list, a split button: the arrow a part of its own that opens it (a large button's: a row under the label).
    `<span class="rb-text"><span class="rb-label">${rbEsc(size === 'large' ? label : label.replace(/\n/g, ' '))}</span>${list && size !== 'large' ? arrow : ''}</span>${list && size === 'large' ? arrow : ''}</button>`;
}

// ---------- State of the buttons: lit, greyed out ----------
// As the actions say now: after every action (actions.js runAction), soon after a press, a key, the focus moving.
let rbRefreshFrame = 0;
const rbRefreshSoon = () => { if (rbShown() && !rbRefreshFrame) rbRefreshFrame = requestAnimationFrame(() => { rbRefreshFrame = 0; ribbonRefresh(); }); };
function ribbonRefresh() {
  if (!rbShown()) return;
  const body = rb.els.bodies.querySelector(`[data-body="${rbTabIndex()}"]`);
  for (const b of body?.querySelectorAll('.rb-btn[data-call]') ?? []) {
    const [name, ...params] = JSON.parse(b.dataset.call), def = actionDef(name);
    b.classList.toggle('on', !!def?.checked?.(params));
    b.classList.toggle('off', !rb.changing && !actionEnabled(name, params) && !rbListOnly({ action: name, params }));
  }
}
for (const type of ['focusin', 'mouseup', 'keyup']) addEventListener(type, rbRefreshSoon, true);

// ---------- The height, and only when wanted (plan 19 3.13; LexPen's PLAN-ribbon-height-and-collapse.md) ----------
// The row height as the sizes CSS reads (ribbonmodel.js ribbonSizes).
function rbApplyHeight(row = rbWin.row) {
  if (!rb.els) return;
  const s = ribbonSizes(row), st = rb.els.el.style;
  for (const [k, v] of [['--rb-r', s.row], ['--rb-sp', s.sp], ['--rb-f', s.f], ['--rb-lh', s.lineHeight], ['--rb-ar', s.arrowRow], ['--rb-li', s.largeIcon], ['--rb-li2', s.sharedIcon]])
    st.setProperty(k, v);
}
// The grip dragged: the height live, kept when let go; up past the lowest (20 px more): only when wanted, the height
// as it was before the drag.
function rbGripDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const grip = e.currentTarget, y0 = e.clientY, row0 = ribbonSizes(rbWin.row).row;
  let row = row0, past = false;
  grip.setPointerCapture(e.pointerId);
  grip.classList.add('on');
  const move = ev => {
    const want = row0 + (ev.clientY - y0) / 3;
    past = want < RB_ROW_LOWEST - 20 / 3;
    row = ribbonSizes(want).row;
    rbApplyHeight(row);
    rbOverflow();
  };
  const up = () => {
    for (const [t, f] of [['pointermove', move], ['pointerup', up], ['pointercancel', up]]) grip.removeEventListener(t, f);
    grip.classList.remove('on');
    if (past) { rbApplyHeight(row0); rbSetWindow('show', 'onDemand'); }
    else if (row !== row0) rbSetWindow('row', row);
  };
  for (const [t, f] of [['pointermove', move], ['pointerup', up], ['pointercancel', up]]) grip.addEventListener(t, f);
}

// Only when wanted (rbWin.show "onDemand"): the tab names stay, the buttons slide down over the panes when wanted
// (rbSlide). Not while the ribbon is changed (change mode, Customize): then always.
const rbOnDemand = () => rbWin.show === 'onDemand' && !rb.changing && !rb.customizing;
const RB_CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10l4.5-4.5 4.5 4.5"/></svg>';
const RB_PIN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h4M7 2v4.5L4.5 9.5h7L9 6.5V2M8 9.5V14"/></svg>';
function rbApplyShow() {
  if (!rb.els) return;
  const on = rbOnDemand();
  if (!on) rb.down = false;
  rb.els.el.classList.toggle('rb-on-demand', on);
  rb.els.el.classList.toggle('rb-down', on && rb.down);
  const b = rb.els.bodies.querySelector('.rb-collapse');
  if (b) {
    b.innerHTML = on ? RB_PIN : RB_CHEVRON;
    b.title = withKey(on ? 'Always show the ribbon' : 'Show the ribbon only when wanted', 'ribbon.onDemand');
  }
}
function rbSlide(down) {
  if (!rbOnDemand() || rb.down === down) return;
  rb.down = down;
  rbApplyShow();
  if (down) { ribbonRefresh(); rbOverflow(); }
}
// A drag down from the tab names: that tab (or the one shown) slides down; the click that ends the press is not a
// click on the tab then.
function rbTabsDown(e) {
  rb.skipTabClick = false;
  if (e.button !== 0 || !rbOnDemand() || rb.down) return;
  const y0 = e.clientY, tab = e.target.closest('[data-tab]');
  const move = ev => {
    if (ev.clientY - y0 < 6) return;
    off();
    if (tab) rbShowTab(+tab.dataset.tab);
    rbSlide(true);
    rb.skipTabClick = true;
  };
  const off = () => { removeEventListener('pointermove', move, true); removeEventListener('pointerup', off, true); };
  addEventListener('pointermove', move, true);
  addEventListener('pointerup', off, true);
}
// Slid down, it goes up again: a choice made in a list from it, Esc, a press outside it (in a pane too: its page
// tells this one, app.js activate), a key typed.
addEventListener('pointerdown', e => {
  if (rb.down && e.target instanceof Element && !e.target.closest('#ribbon, .menu')) rbSlide(false);
}, true);
addEventListener('click', e => {
  if (rb.down && e.target instanceof Element && e.target.closest('.menu'))
    setTimeout(() => { if (!openMenus.length) rbSlide(false); }, 50);   // a submenu opened: still choosing
}, true);
addEventListener('keydown', e => {
  if (!rb.down || rb.tips || openMenus.length || ['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;
  rbSlide(false);
}, true);

// ---------- Overflow: the groups that do not fit go into ">>" ----------
function rbOverflow() {
  if (!rbShown() || rb.changing) return;
  const body = rb.els.bodies.querySelector(`[data-body="${rbTabIndex()}"]`), more = rb.els.bodies.querySelector('.rb-more');
  if (!body || !more) return;
  const groups = [...body.querySelectorAll('.rb-group')];
  for (const g of groups) g.hidden = false;
  more.hidden = true;
  const collapse = rb.els.bodies.querySelector('.rb-collapse');
  const room = () => rb.els.bodies.clientWidth - (more.hidden ? 0 : more.offsetWidth + 4) - (collapse ? collapse.offsetWidth + 8 : 0);
  const used = () => groups.filter(g => !g.hidden).reduce((w, g) => w + g.offsetWidth, 0);
  for (let i = groups.length - 1; i > 0 && used() > room(); i--) { groups[i].hidden = true; more.hidden = false; }
}

// The groups left out, each a submenu of its buttons.
function rbOverflowItems() {
  const ti = rbTabIndex(), tab = rb.model.tabs[ti];
  const body = rb.els.bodies.querySelector(`[data-body="${ti}"]`);
  return [...body.querySelectorAll('.rb-group[hidden]')].map(el => {
    const g = tab.groups[+el.dataset.group.split('.')[1]];
    return { label: g.name, items: g.items.filter(it => it !== 'divider' && actionDef(it.action))
      .map(it => rbAct((it.label || actionTitle(it.action, it.params ?? [])).replace(/\n/g, ' '), it.action, it.params ?? [])) };
  });
}

// An action as a menu item: its key, lit and greyed out as it says, run as from the ribbon.
const rbAct = (label, action, params = []) => ({ label, key: keyText(action, ...params), checked: !!actionDef(action)?.checked?.(params),
  enabled: actionEnabled(action, params), run: () => runAction(action, params, { from: 'ribbon' }) });

// ---------- Split buttons: an action's variants or its list ----------
// A button lists: its action's list (dropDown), or its variants (without a parameter of its own). Only a list: an
// action that is its list (dropDownOnly), or one whose every variant has a parameter and none is given: a click lists.
function rbHasList(item) {
  if (rbDropDown(item.action, item.open)) return true;
  if (item.params?.length) return false;
  const v = actionDef(item.action)?.variants;
  return Array.isArray(v) && v.filter(p => p.length).length > 1;
}
const rbListOnly = item => rbDropDown(item.action, item.open) || !item.params?.length &&
  Array.isArray(actionDef(item.action)?.variants) && !actionDef(item.action).variants.some(p => !p.length);

async function rbListItems(item) {
  if (rbDropDown(item.action, item.open)) return rbDropDownItems([item.action, ...(item.params ?? [])]);
  return actionDef(item.action).variants.filter(p => p.length).map(p => rbAct(actionTitle(item.action, p), item.action, p));
}

async function rbOpenList(el, item) {
  const items = await rbListItems(item), r = el.getBoundingClientRect();
  openMenu(r.left, r.bottom, items);
}

// Drop-down (LexPen's PLAN-ribbon-drop-down-lists.md): a button or corner with "open": "dropDown" whose action has a
// list (its dropDown()) opens that list under it; the list ends with the action itself (its window or pane). An action
// that is its list (dropDownOnly: Bookmarks, Views, Projects, Drives) opens it so always, and its list does not end with
// it.
const rbDropDown = (action, open) => (open === 'dropDown' || !!actionDef(action)?.dropDownOnly) && typeof actionDef(action)?.dropDown === 'function';
async function rbDropDownItems([action, ...params]) {
  const items = await actionDef(action).dropDown(params);
  if (actionDef(action).dropDownOnly) return items;
  return [...items, ...(items.length ? ['-'] : []), rbAct(actionTitle(action, params), action, params)];
}
// The right-click's choice for an action with a list and a window: what a click opens (`set`: "dropDown", or
// undefined: its window or pane).
const rbOpensItems = (action, open, set) => typeof actionDef(action)?.dropDown !== 'function' || actionDef(action).dropDownOnly ? [] : [{ label: 'Opens', items: [
  { label: 'Window or pane', checked: open !== 'dropDown', run: () => set(undefined) },
  { label: 'Drop-down', checked: open === 'dropDown', run: () => set('dropDown') }] }];
const rbCornerAt = el => { const [t, g, side] = rbPath(el.dataset.corner); return ribbonCorner(rb.model.tabs[t]?.groups[g]?.corners?.[side]); };

// ---------- Clicks ----------
// What opens a list (a split button's arrow, a list-only button, a drop-down corner, ">>") is a menu's opener: a click
// on it while its list is open closes the list (menu.js).
const rbPath = s => s.split('.').map(x => /^-?\d+$/.test(x) ? +x : x);
const rbItemAt = ([t, g, i]) => rb.model.tabs[t]?.groups[g]?.items[i];

function rbShowTab(ti) {
  const tab = rb.model.tabs[ti];
  if (!tab) return;
  rb.tab = tab.name;
  if (!rb.changing && rbWin.tab !== tab.name) rbSetWindow('tab', tab.name);
  for (const b of rb.els.row.querySelectorAll('[data-tab]')) b.classList.toggle('on', +b.dataset.tab === ti);
  for (const body of rb.els.bodies.querySelectorAll('[data-body]')) body.hidden = +body.dataset.body !== ti;
  ribbonRefresh();
  rbOverflow();
}

async function rbClick(e) {
  const el = e.target.closest('button');
  if (!el) return;
  rbTipsOff(false);   // slid down by Alt: it stays for what this click does
  if (el.matches('[data-tab]')) {
    if (rb.skipTabClick) { rb.skipTabClick = false; return; }   // the end of a drag down from it
    // Only when wanted: a click slides that tab down; on the tab shown while down, up again.
    if (rbOnDemand() && rb.down && rbTabIndex() === +el.dataset.tab) return rbSlide(false);
    rbShowTab(+el.dataset.tab);
    return rbSlide(true);
  }
  if (el.matches('.rb-collapse')) return runAction('ribbon.onDemand', [], { from: 'ribbon' });
  if (el.matches('.rb-shield')) return runAction('helper.end', [], { from: 'ribbon' });
  if (el.matches('[data-new-tab]')) return rbNewTab();
  if (el.matches('.rb-done')) return rbChangeMode(false);
  if (el.matches('.rb-more')) { const r = el.getBoundingClientRect(); return openMenu(r.left, r.bottom, rbOverflowItems()); }
  if (rb.changing) return;   // in change mode the buttons do not run
  if (el.matches('[data-corner]')) {
    const c = rbCornerAt(el), call = c?.call;
    if (call && rbDropDown(call[0], c.open)) { const items = await rbDropDownItems(call), r = el.getBoundingClientRect(); return openMenu(r.left, r.bottom, items); }
    if (call) runAction(call[0], call.slice(1), { from: 'ribbon', el });
    rbSlide(false);
    return rbRefreshSoon();
  }
  if (el.matches('[data-path]')) {
    const item = rbItemAt(rbPath(el.dataset.path));
    // Whether it runs asked now, not from how it was drawn (greyed out before the panes were there, at the start).
    if (!item || !actionEnabled(item.action, item.params ?? []) && !rbListOnly(item)) return rbRefreshSoon();
    if (e.target.closest('[data-arrow]') || rbListOnly(item)) return rbOpenList(el, item);
    await runAction(item.action, item.params ?? [], { from: 'ribbon', el });
    rbSlide(false);
    rbRefreshSoon();
  }
}

// ---------- The right-click ----------
function rbContext(e) {
  e.preventDefault();
  if (rb.changing) return rbEditMenu(e);
  const el = e.target.closest('.rb-btn[data-path]');
  const item = el && rbItemAt(rbPath(el.dataset.path));
  if (item && rbHasList(item)) return rbOpenList(el, item);
  openMenu(e.clientX, e.clientY, rbMenuItems());
}

// The ribbon's own: change it, the Customize window, Reset, only when wanted.
const rbMenuItems = () => [rbAct('Change the ribbon', 'ribbon.change'), rbAct('Customize...', 'ribbon.customize'),
  rbAct('Reset to the shipped ribbon', 'ribbon.reset'), '-', rbAct('Ribbon only when wanted', 'ribbon.onDemand')];

// ---------- Key tips (plan 19 3.12) ----------
// Alt alone shows a letter per tab name; its letter opens that tab and shows a letter per button and corner; a button's
// letter runs it. Alt+a letter no key of keys.json has goes to that tab at once. In a pane's page (a frame) the Alt is
// told here (ribbonAlt; ribbon.js there, pane.js); the keyboard comes to this page while the tips show, and goes back
// to the active pane after.
const rbTipsWanted = () => rbShown() && !rb.changing;

function rbTipTargets() {
  if (rb.tips === 1) {
    const els = [...rb.els.row.querySelectorAll('[data-tab]')];
    return { els, tips: ribbonTips(els.map(b => b.textContent)) };
  }
  const ti = rbTabIndex(), body = rb.els.bodies.querySelector(`[data-body="${ti}"]`);
  const els = [...body.querySelectorAll('.rb-btn[data-path], .rb-corner:not(.rb-empty)')].filter(b => !b.closest('[hidden]'));
  const names = els.map(b => b.matches('[data-corner]') ? b.title.split('\n')[0] : b.querySelector('.rb-label').textContent);
  const own = els.map(b => b.matches('[data-path]') ? rbItemAt(rbPath(b.dataset.path))?.tip : '');
  return { els, tips: ribbonTips(names, own) };
}

function rbShowTips() {
  for (const t of document.querySelectorAll('.rb-tip')) t.remove();
  if (!rb.tips) return;
  rbSlide(true);   // only when wanted: down with its tips
  const { els, tips } = rbTipTargets();
  els.forEach((el, i) => el.append(Object.assign(document.createElement('span'), { className: 'rb-tip', textContent: tips[i] })));
}
// slideUp false: a tip or a click on the ribbon goes on with it (only when wanted: it stays down for that).
function rbTipsOff(slideUp = true) {
  if (!rb.tips) return;
  rb.tips = 0;
  rb.typed = '';
  rbShowTips();
  if (slideUp) rbSlide(false);
  if (document.activeElement === rb.els?.el) activeView()?.body.focus();   // the keyboard back to the pane
}
// The tips on: the keys to this page (a pane's frame had them).
const rbTipsFocus = () => { if (!rb.els.el.contains(document.activeElement)) rb.els.el.focus({ preventScroll: true }); };

// Alt alone or Alt+a letter in a pane's page (ribbonAlt), or in this page (the listeners below). True: it was the
// ribbon's.
function rbAlt(letter = null) {
  if (!rbTipsWanted()) return false;
  if (!letter) {
    if (rb.tips) return rbTipsOff(), true;
    rb.tips = 1;
    rb.typed = '';
    rbShowTips();
    rbTipsFocus();
    return true;
  }
  rb.tips = 1;
  rb.typed = '';
  if (!rbTipKey(letter)) { rb.tips = 0; return false; }
  rbShowTips();
  rbTipsFocus();
  return true;
}

if (!rbInPane) {
  addEventListener('keydown', e => {
    if (e.key === 'Alt') { rb.altAlone = !e.repeat && rbShown(); return; }
    rb.altAlone = false;
    if (rb.changing && rbShown()) return rbChangeKey(e);
    if (!rb.tips) {
      // Alt+letter: the tab of that tip at once, when keys.json binds nothing to it (a key of yours keeps its meaning).
      if (e.altKey && !e.ctrlKey && !e.shiftKey && /^Key[A-Z]$/.test(e.code) && !openMenus.length && !keys.bindings.has(strokeOf(e)) && rbAlt(e.code[3])) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { if (rb.tips === 2) { rb.tips = 1; rb.typed = ''; rbShowTips(); } else rbTipsOff(); return; }
    const c = /^Key[A-Z]$|^Digit\d$/.test(e.code) ? e.code.at(-1) : '';
    if (!c || !rbTipKey(c)) rbTipsOff();
  }, true);
  addEventListener('keyup', e => {
    if (e.key !== 'Alt' || !rb.altAlone) return;
    rb.altAlone = false;
    e.preventDefault();
    rbAlt();
  }, true);
  addEventListener('mousedown', e => { if (rb.tips && !e.target.closest('.rb-tip')) rbTipsOff(!e.target.closest('#ribbon')); }, true);
  addEventListener('blur', () => rbTipsOff());
} else {
  // A pane's page: Alt alone, or Alt+a letter keys.json leaves free, is the window's (its key tips).
  let alone = false;
  addEventListener('keydown', e => {
    if (e.key === 'Alt') { alone = !e.repeat; return; }
    alone = false;
    if (e.altKey && !e.ctrlKey && !e.shiftKey && /^Key[A-Z]$/.test(e.code) && !keys.bindings.has(strokeOf(e)) && !openMenus.length) {
      e.preventDefault();
      toWindow({ kind: 'ribbonAlt', letter: e.code[3] });
    }
  }, true);
  addEventListener('keyup', e => {
    if (e.key !== 'Alt' || !alone) return;
    alone = false;
    e.preventDefault();
    toWindow({ kind: 'ribbonAlt' });
  }, true);
}

// A letter typed while the tips show: a tab opened (its buttons' tips then), a button run; two-letter tips wait for
// their second letter. True: it was one.
function rbTipKey(c) {
  const { els, tips } = rbTipTargets(), typed = rb.typed + c;
  const hit = tips.findIndex(t => t === typed);
  if (hit < 0) {
    if (tips.some(t => t.length === 2 && t.startsWith(typed))) { rb.typed = typed; return true; }
    return false;
  }
  rb.typed = '';
  const el = els[hit];
  if (rb.tips === 1) { rbShowTab(+el.dataset.tab); rb.tips = 2; rbShowTips(); return true; }
  rbTipsOff(false);
  if (document.activeElement === rb.els.el) activeView()?.body.focus();   // what it runs works on the active pane
  el.click();
  return true;
}

// ---------- Change mode ----------
function rbChangeMode(on) {
  if (rb.changing === on) return;
  rb.changing = on;
  rb.undo = [];
  rbTipsOff();
  renderRibbon();
  paneOfKind('palette')?.render();   // F1's rows draggable or not, its button
  if (on && !paneOfKind('palette')) openPalette();
}

function rbChangeKey(e) {
  if (document.querySelector('dialog[open]') || openMenus.length) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return rbChangeMode(false); }
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ') { e.preventDefault(); e.stopImmediatePropagation(); rbUndo(); }
}

// Every change: the model before it kept for Ctrl+Z, then written to your ribbon.json and drawn again.
function rbChange(edit) {
  const before = structuredClone(rb.model);
  if (edit(rb.model) === false) return false;
  rb.undo.push(before);
  rbSave();
  return true;
}
function rbSave() {
  rb.user = true;
  post({ op: 'ribbonSave', ribbon: rb.model });
  renderRibbon();
  rbcRefill();
}
function rbUndo() {
  const before = rb.undo.pop();
  if (!before) return status('Nothing to take back.', true);
  rb.model = before;
  rbSave();
}
// The shipped ribbon: your ribbon.json removed; the host sends every window the shipped one (setRibbon).
function rbReset() {
  rb.resetting = true;
  post({ op: 'ribbonReset' });
}

async function rbNewTab() {
  const name = await askText('New tab', '', 'Its name');
  if (!name?.trim()) return;
  rbChange(m => { m.tabs.push({ name: name.trim(), groups: [] }); });
  rbShowTab(rb.model.tabs.length - 1);
}

// A button's label as the text box shows it: a line break as \n (typed so, it is one).
const rbLabelText = label => (label ?? '').replace(/\n/g, '\\n');
const rbLabelOf = text => text.trim().replace(/\\n/g, '\n');

// ---------- Dragging (change mode) ----------
// What is dragged, as text: "foldex-ribbon:" and { kind: item | divider | group | corner | tab, path }, or from F1
// (floating: the browser's drag between windows) "foldex-call:" and an action's call. Dropped off the ribbon: removed.
let rbDragging = null;
function rbDragStart(e) {
  if (!rb.changing) return e.preventDefault();
  const el = e.target.closest('[data-path], [data-grip], [data-corner], [data-tab]');
  if (!el) return;
  const what = el.matches('[data-grip]') ? { kind: 'group', path: rbPath(el.dataset.grip) }
    : el.matches('[data-corner]') ? { kind: 'corner', path: rbPath(el.dataset.corner) }
    : el.matches('[data-tab]') ? { kind: 'tab', path: [+el.dataset.tab] }
    : { kind: el.matches('.rb-div') ? 'divider' : 'item', path: rbPath(el.dataset.path) };
  rbDragging = { ...what, dropped: false };
  e.dataTransfer.setData('text/plain', 'foldex-ribbon:' + JSON.stringify(what));
  e.dataTransfer.effectAllowed = 'move';
}

// Where a drop lands: { at: [t, g, i] and how: before | after | under }, a group's end, a corner, a tab, a new group.
function rbDropTarget(e) {
  const btn = e.target.closest('.rb-btn[data-path], .rb-div[data-path]');
  if (btn) {
    const r = btn.getBoundingClientRect(), small = btn.classList.contains('rb-small');
    const how = e.clientY > r.top + r.height * (small ? 0.6 : 0.8) ? 'under' : e.clientX < r.left + r.width / 2 ? 'before' : 'after';
    return { kind: 'item', el: btn, path: rbPath(btn.dataset.path), how };
  }
  const corner = e.target.closest('[data-corner]');
  if (corner) return { kind: 'corner', el: corner, path: rbPath(corner.dataset.corner) };
  const tab = e.target.closest('[data-tab]');
  if (tab) return { kind: 'tab', el: tab, path: [+tab.dataset.tab] };
  const newGroup = e.target.closest('[data-new-group]');
  if (newGroup) return { kind: 'newGroup', el: newGroup, path: [+newGroup.dataset.newGroup] };
  const group = e.target.closest('[data-group]');
  if (group) return { kind: 'group', el: group, path: rbPath(group.dataset.group) };
  return null;
}
function rbMarkDrop(target) {
  for (const el of document.querySelectorAll('.rb-drop')) el.classList.remove('rb-drop', 'rb-before', 'rb-after', 'rb-under');
  if (target?.el) target.el.classList.add('rb-drop', ...(target.how ? ['rb-' + target.how] : []));
}
let rbTabTimer = 0;
function rbDragOver(e) {
  if (!rb.changing) return;
  const target = rbDropTarget(e);
  if (!target) return rbMarkDrop(null);
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  rbMarkDrop(target);
  rbOverTab(target);
}
// Over a tab name: that tab shows, so the button can go there.
function rbOverTab(target) {
  if (target?.kind === 'tab' && rbTabIndex() !== target.path[0] && !rbTabTimer)
    rbTabTimer = setTimeout(() => { rbTabTimer = 0; rbShowTab(target.path[0]); }, 400);
}

// A row of F1 docked (a frame of another site: the browser lets no drag from it drop here) comes with the pointer: the
// moves over F1's frame come from it (palettePageAsks), those over the rest of the window are seen here. Let go on the
// ribbon: placed as a drop; elsewhere or Esc: nothing.
let rbCallDrag = null;
function rbCallDragStart(call) {
  rbCallDragEnd();
  if (!rb.changing) return;
  const move = e => { if (e.buttons & 1) rbCallDragAt(e.clientX, e.clientY); else rbCallDragEnd(); };
  const up = e => rbCallDragAt(e.clientX, e.clientY, true);
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); rbCallDragEnd(); } };
  // Its drag image: the action's name beside the pointer.
  const ghost = document.createElement('div');
  ghost.className = 'rb-ghost';
  ghost.textContent = actionTitle(call[0], call.slice(1));
  ghost.hidden = true;
  document.body.append(ghost);
  rbCallDrag = { call, ghost, off: () => { removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('keydown', key, true); } };
  addEventListener('pointermove', move, true);
  addEventListener('pointerup', up, true);
  addEventListener('keydown', key, true);
  document.body.style.cursor = 'copy';
}
function rbCallDragEnd() {
  if (!rbCallDrag) return;
  rbCallDrag.off();
  rbCallDrag.ghost.remove();
  paneOfKind('palette')?.send({ kind: 'ribbonDragDone', key: 'ribbonDragDone' });   // F1 sees no release outside its frame
  rbCallDrag = null;
  document.body.style.cursor = '';
  clearTimeout(rbTabTimer);
  rbTabTimer = 0;
  rbMarkDrop(null);
}
// The pointer at x, y in this window; `drop`: let go there.
function rbCallDragAt(x, y, drop = false) {
  if (!rbCallDrag) return;
  Object.assign(rbCallDrag.ghost.style, { left: x + 12 + 'px', top: y + 14 + 'px' });
  rbCallDrag.ghost.hidden = false;
  const el = document.elementFromPoint(x, y);
  const target = rb.changing && el && rb.els.el.contains(el) ? rbDropTarget({ target: el, clientX: x, clientY: y }) : null;
  if (!drop) { rbMarkDrop(target); return rbOverTab(target); }
  const call = rbCallDrag.call;
  rbCallDragEnd();
  if (target) rbPlace({ kind: 'call', call }, target);
}

function rbDragged(e) {
  const text = e.dataTransfer.getData('text/plain') || '';
  try {
    if (text.startsWith('foldex-ribbon:')) return JSON.parse(text.slice('foldex-ribbon:'.length));
    if (text.startsWith('foldex-call:')) return { kind: 'call', call: JSON.parse(text.slice('foldex-call:'.length)) };
  } catch { }
  return null;
}

function rbDrop(e) {
  if (!rb.changing) return;
  const what = rbDragged(e), target = rbDropTarget(e);
  rbMarkDrop(null);
  if (!what || !target) return;
  e.preventDefault();
  if (rbDragging) rbDragging.dropped = true;
  rbPlace(what, target);
}

// What is dragged put where it is dropped.
function rbPlace(what, target) {
  if (target.kind === 'newGroup') {
    const taken = what.kind === 'group' || what.kind === 'tab' ? null : rbTake(structuredClone(rb.model), what);
    if (!taken) return;
    const make = async () => {
      const name = await askText('New group', '', 'Its name');
      if (!name?.trim()) return;
      const before = structuredClone(rb.model);
      const m = structuredClone(rb.model), t = rbTake(m, what);
      m.tabs[target.path[0]].groups.push({ name: name.trim(), items: [{ ...t.item, stack: false }] });
      rb.undo.push(before);
      rb.model = m;
      rbSave();
    };
    return make();
  }
  rbChange(m => rbPlaceIn(m, what, target));
}

// Dropped outside the ribbon: removed.
function rbDragEnd(e) {
  clearTimeout(rbTabTimer);
  rbTabTimer = 0;
  rbMarkDrop(null);
  const what = rbDragging;
  rbDragging = null;
  if (!rb.changing || !what || what.dropped) return;
  const r = rb.els.el.getBoundingClientRect();
  if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
  rbRemove(what);
}
function rbRemove(what) {
  return rbChange(m => rbRemoveIn(m, what));
}
// ---------- The right-click in change mode ----------
function rbEditMenu(e) {
  const el = e.target.closest('[data-path], [data-corner], [data-grip], [data-group], [data-tab]');
  let items = [];
  if (el?.matches('.rb-btn[data-path]')) {
    const path = rbPath(el.dataset.path), [t, g, i] = path, item = rbItemAt(path), def = actionDef(item.action);
    const set = fn => () => rbChange(m => { const it = m.tabs[t].groups[g].items[i]; if (it === 'divider') return false; fn(it, m.tabs[t].groups[g].items); });
    const variants = def?.variants?.filter(p => p.length) ?? [];
    items = [
      { label: 'Large', checked: item.size === 'large', run: set(it => { it.size = 'large'; delete it.stack; }) },
      { label: 'Small', checked: item.size !== 'large', run: set(it => { delete it.size; }) },
      { label: 'Stacked under the one above', checked: !!item.stack, run: set(it => { it.stack = !it.stack; }) },
      ...(variants.length ? [{ label: 'Parameter', items: [
        { label: 'None (the action itself, its list)', checked: !item.params?.length, run: set(it => { delete it.params; }) },
        ...variants.map(p => ({ label: actionTitle(item.action, p), checked: JSON.stringify(item.params ?? []) === JSON.stringify(p), run: set(it => { it.params = p; }) }))] }] : []),
      { label: 'Rename...', run: async () => {
        const v = await askText('Label (empty: the action\'s title; \\n: a line break)', rbLabelText(item.label), actionTitle(item.action, item.params ?? []));
        if (v !== null) set(it => { if (v.trim()) it.label = rbLabelOf(v); else delete it.label; })();
      } },
      { label: 'Key tip...', run: async () => {
        const v = await askText('Key tip (one or two letters; empty: from the label)', item.tip ?? '', 'A letter');
        if (v === null) return;
        const tip = v.trim().slice(0, 2).toUpperCase();
        // No tip on this tab may start another ("P" and "PF": the P would run before the F is typed).
        const clash = rb.model.tabs[t].groups.flatMap(gr => gr.items).find(it => it !== item && it.tip && tip && (it.tip.startsWith(tip) || tip.startsWith(it.tip)));
        if (clash) return status(`Key tip ${tip} clashes with ${clash.tip} (${clash.label || actionTitle(clash.action, clash.params ?? [])}): one may not start the other.`, true);
        set(it => { if (tip) it.tip = tip; else delete it.tip; })();
      } },
      { label: 'Divider before it', checked: rb.model.tabs[t].groups[g].items[i - 1] === 'divider',
        run: () => rbChange(m => { const its = m.tabs[t].groups[g].items; if (its[i - 1] === 'divider') its.splice(i - 1, 1); else its.splice(i, 0, 'divider'); }) },
      '-',
      ...rbOpensItems(item.action, item.open, open => set(it => { if (open) it.open = open; else delete it.open; })()),
      { label: 'Into the left corner', run: () => rbChange(m => { const grp = m.tabs[t].groups[g], [it] = grp.items.splice(i, 1); grp.corners = { ...(grp.corners ?? {}), left: ribbonCornerOf(it) }; }) },
      { label: 'Into the right corner', run: () => rbChange(m => { const grp = m.tabs[t].groups[g], [it] = grp.items.splice(i, 1); grp.corners = { ...(grp.corners ?? {}), right: ribbonCornerOf(it) }; }) },
      '-', { label: 'Remove', run: () => rbRemove({ kind: 'item', path }) }];
  } else if (el?.matches('.rb-div[data-path]')) {
    items = [{ label: 'Remove the divider', run: () => rbRemove({ kind: 'divider', path: rbPath(el.dataset.path) }) }];
  } else if (el?.matches('[data-corner]')) {
    const path = rbPath(el.dataset.corner), [t, g, side] = path, c = ribbonCorner(rb.model.tabs[t].groups[g].corners?.[side]), has = !!c;
    items = [...(c ? rbOpensItems(c.call[0], c.open, open => rbChange(m => {
      const grp = m.tabs[t].groups[g], it = ribbonItemOf(grp.corners[side]);
      if (open) it.open = open; else delete it.open;
      grp.corners[side] = ribbonCornerOf(it);
    })) : []),
      { label: 'Make it a button', enabled: has, run: () => rbChange(m => { const taken = rbTake(m, { kind: 'corner', path }); if (!taken) return false; m.tabs[t].groups[g].items.push(taken.item); }) },
      { label: 'Remove from the corner', enabled: has, run: () => rbRemove({ kind: 'corner', path }) }];
  } else if (el?.matches('[data-grip], [data-group]')) {
    const [t, g] = rbPath(el.dataset.grip ?? el.dataset.group), grp = rb.model.tabs[t].groups[g];
    items = [{ label: 'Rename the group...', run: async () => { const v = await askText('Group name', grp.name, 'Its name'); if (v?.trim()) rbChange(m => { m.tabs[t].groups[g].name = v.trim(); }); } },
      { label: 'Remove the group', run: () => rbRemove({ kind: 'group', path: [t, g] }) }];
  } else if (el?.matches('[data-tab]')) {
    const t = +el.dataset.tab, tab = rb.model.tabs[t];
    items = [{ label: 'Rename the tab...', run: async () => { const v = await askText('Tab name', tab.name, 'Its name'); if (v?.trim()) rbChange(m => { if (rb.tab === m.tabs[t].name) rb.tab = v.trim(); m.tabs[t].name = v.trim(); }); } },
      { label: 'Move left', enabled: t > 0, run: () => rbChange(m => { m.tabs.splice(t - 1, 0, ...m.tabs.splice(t, 1)); }) },
      { label: 'Move right', enabled: t < rb.model.tabs.length - 1, run: () => rbChange(m => { m.tabs.splice(t + 1, 0, ...m.tabs.splice(t, 1)); }) },
      { label: 'Remove the tab', run: () => rbRemove({ kind: 'tab', path: [t] }) }];
  }
  items.push(...(items.length ? ['-'] : []), rbAct('Customize...', 'ribbon.customize'), rbAct('Reset to the shipped ribbon', 'ribbon.reset'),
    { label: 'Done', run: () => rbChangeMode(false) });
  openMenu(e.clientX, e.clientY, items);
}

// ---------- The Customize window (the ribbon's right-click > Customize...; plan 19 3.9) ----------
// A floating window, not modal (dialog.html, dialogpage.js customizeHere), so the ribbon stays usable while it is open:
// another tab clicked, the change mode beside it. At the left every action (F1's, with its search),
// at the right the ribbon's tabs, groups, buttons, dividers and corners in order. Each change it makes is asked here
// (rbcDo), through the same change, undo and saving as the change mode; the line it has chosen is outlined on the
// ribbon (its tab shown).
async function rbCustomize() {
  if (!rb.model || rb.customizing) return;
  rbApplyShow();
  const actionsList = ACTION_GROUPS.map(([group, label]) => [label, paletteRows().filter(r => actionDef(r.call[0])?.group === group).map(r => ({ title: r.title, call: r.call }))])
    .filter(([, list]) => list.length);
  await dialogWindow('Customize the ribbon', { what: 'customize', actions: actionsList, lines: rbcLines() }, msg => rbcDo(msg), false, ch => {
    rb.customizing = ch;
    rbApplyShow();
  });
  rb.customizing = null;
  rbcShow(null);
  rbApplyShow();
}

// The lines at the right: { path, kind (tab | group | item | divider | corner), text, name (a tab's, a group's, a
// button's label: \n a line break) }.
function rbcLines() {
  const lines = [];
  rb.model.tabs.forEach((t, ti) => {
    lines.push({ kind: 'tab', path: [ti], text: `${t.name}`, name: t.name });
    t.groups.forEach((g, gi) => {
      lines.push({ kind: 'group', path: [ti, gi], text: `   ${g.name}`, name: g.name });
      for (const side of ['left', 'right']) if (g.corners?.[side]) {
        const k = ribbonCorner(g.corners[side]), c = k.call;
        lines.push({ kind: 'corner', path: [ti, gi, side], text: `      corner ${side}: ${actionTitle(c[0], c.slice(1))}${rbDropDown(c[0], k.open) ? ' (drop-down)' : ''}` });
      }
      g.items.forEach((it, i) => lines.push(it === 'divider'
        ? { kind: 'divider', path: [ti, gi, i], text: '      ----' }
        : { kind: 'item', path: [ti, gi, i], name: rbLabelText(it.label), title: actionTitle(it.action, it.params ?? []),
          text: `      ${it.stack ? '  + ' : ''}${(it.label || actionTitle(it.action, it.params ?? [])).replace(/\n/g, ' ')}${it.size === 'large' ? ' (large)' : ''}${rbDropDown(it.action, it.open) ? ' (drop-down)' : ''}` }));
    });
  });
  return lines;
}
// The ribbon changed while the window is open (by it, Ctrl+Z, Reset, another window): its lines again.
function rbcRefill() {
  rb.customizing?.send({ kind: 'rbcLines', key: 'rbcLines', lines: rbcLines() });
}

// The line chosen there shown on the ribbon: its tab opened, the tab, group, corner or button outlined.
function rbcShow(line) {
  for (const x of document.querySelectorAll('.rb-picked')) x.classList.remove('rb-picked');
  if (!line || !rb.els) return;
  rbShowTab(line.path[0]);
  const p = line.path.join('.'), attr = { tab: 'data-tab', group: 'data-group', corner: 'data-corner' }[line.kind] ?? 'data-path';
  for (const x of rb.els.el.querySelectorAll(`[${attr}="${p}"]`)) x.classList.add('rb-picked');
}
const rbcSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What the Customize window asks: { op, line (its index), call (an action at the left), name (asked there) }. Its
// answer: the lines now and the one to choose.
function rbcDo({ op, line: at, call, name }) {
  const lines = rbcLines(), line = lines[at];
  const answer = (path = line?.path) => {
    const now = rbcLines(), n = path ? now.findIndex(l => rbcSame(l.path, path)) : -1;
    const select = n < 0 ? Math.max(0, Math.min(at ?? 0, now.length - 1)) : n;
    rbcShow(now[select]);
    return { lines: now, select };
  };
  if (op === 'show') { rbcShow(line); return null; }
  if (op === 'undo') { rbUndo(); return answer(); }
  if (op === 'reset') { rbReset(); return answer([0]); }
  if (op === 'newTab') {
    if (!name?.trim()) return answer();
    rbChange(m => { m.tabs.push({ name: name.trim(), groups: [] }); });
    return answer([rb.model.tabs.length - 1]);
  }
  if (!line) return answer();
  const [t, g, i] = line.path;
  if (op === 'add') {
    if (!call) return answer();
    const [action, ...params] = call, item = params.length ? { action, params } : { action };
    let to = null;
    rbChange(m => {
      const tab = m.tabs[t];
      if (line.kind === 'tab') { if (!tab.groups.length) tab.groups.push({ name: tab.name, items: [] }); to = [t, tab.groups.length - 1, tab.groups.at(-1).items.push(item) - 1]; return; }
      const items = tab.groups[g].items;
      if (line.kind === 'group' || line.kind === 'corner') { to = [t, g, items.push(item) - 1]; return; }
      items.splice(i + 1, 0, item);
      to = [t, g, i + 1];
    });
    return answer(to);
  }
  if (op === 'newGroup') {
    if (!name?.trim()) return answer();
    const at2 = g === undefined ? rb.model.tabs[t].groups.length : g + 1;
    rbChange(m => { m.tabs[t].groups.splice(at2, 0, { name: name.trim(), items: [] }); });
    return answer([t, at2]);
  }
  if (op === 'rename') {
    if (name == null) return answer();
    if (line.kind === 'tab' || line.kind === 'group') {
      if (!name.trim()) return answer();
      const old = line.kind === 'tab' ? rb.model.tabs[t].name : rb.model.tabs[t].groups[g].name;
      rbChange(m => { if (line.kind === 'tab') { if (rb.tab === old) rb.tab = name.trim(); m.tabs[t].name = name.trim(); } else m.tabs[t].groups[g].name = name.trim(); });
    } else if (line.kind === 'item') rbChange(m => { const x = m.tabs[t].groups[g].items[i]; if (name.trim()) x.label = rbLabelOf(name); else delete x.label; });
    return answer(line.path);
  }
  if (op === 'remove') { rbRemove({ kind: line.kind, path: line.path }); return answer(null); }
  if (op === 'up' || op === 'down') {
    const d = op === 'up' ? -1 : 1;
    let to = line.path;
    rbChange(m => {
      const list = line.kind === 'tab' ? m.tabs : line.kind === 'group' ? m.tabs[t].groups : line.kind === 'corner' ? null : m.tabs[t].groups[g].items;
      if (!list) return false;
      const pos = line.path.at(-1), next = pos + d;
      if (next < 0 || next >= list.length) return false;
      [list[pos], list[next]] = [list[next], list[pos]];
      to = [...line.path.slice(0, -1), next];
    });
    return answer(to);
  }
  if (op === 'dropDown') {   // a button or a corner: its action's list under it, or its window
    rbChange(m => {
      const grp = m.tabs[t].groups[g], it = line.kind === 'corner' ? ribbonItemOf(grp.corners?.[i]) : line.kind === 'item' ? grp.items[i] : null;
      if (!it || it === 'divider' || typeof actionDef(it.action)?.dropDown !== 'function' || actionDef(it.action).dropDownOnly) return false;
      if (it.open) delete it.open; else it.open = 'dropDown';
      if (line.kind === 'corner') grp.corners[i] = ribbonCornerOf(it);
    });
    return answer(line.path);
  }
  if (op === 'divider') {
    if (g === undefined) return answer();
    rbChange(m => { const its = m.tabs[t].groups[g].items; its.splice((i ?? its.length - 1) + 1, 0, 'divider'); });
    return answer([t, g, (i ?? 0) + 1]);
  }
  if (line.kind !== 'item') return answer();
  if (op === 'size') rbChange(m => { const it = m.tabs[t].groups[g].items[i]; if (it.size === 'large') delete it.size; else { it.size = 'large'; delete it.stack; } });
  if (op === 'stack') rbChange(m => { const it = m.tabs[t].groups[g].items[i]; it.stack = !it.stack; });
  return answer(line.path);
}
