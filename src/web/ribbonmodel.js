'use strict';
// The ribbon's rules without a page (ribbon.js draws it; the tests run this file under Jint): a group's items as its
// columns, the changes of the change mode, the corners, the key tips of one level and the sizes at a height. Copied
// from LexPen (docs/plans/executed/PLAN-ribbon.md there).

const RB_STACK = 3;   // small buttons in one column at most

// ---------- The model: plain functions (the tests run them under Jint) ----------
// A group's items as its columns, in order: { kind: 'large', items: [{ item, i }] }, { kind: 'small', items: [up to
// three] }, { kind: 'divider', i }. A small item with stack goes under the small column before it while that has room;
// else, and without stack, it starts a column of its own. A large one and one small one can share a column (the large
// one a row shorter), items top to bottom: a small one with stack under a large one alone, a large one with stack
// under a small one alone.
function ribbonColumns(items) {
  const cols = [];
  (items ?? []).forEach((item, i) => {
    if (item === 'divider') return cols.push({ kind: 'divider', i });
    const last = cols.at(-1), large = item?.size === 'large';
    if (item?.stack && last?.items?.length === 1 && last.kind === (large ? 'small' : 'large')) {
      last.kind = 'large';
      return last.items.push({ item, i });
    }
    if (large) return cols.push({ kind: 'large', items: [{ item, i }] });
    if (item?.stack && last?.kind === 'small' && last.items.length < RB_STACK) last.items.push({ item, i });
    else cols.push({ kind: 'small', items: [{ item, i }] });
  });
  return cols;
}

// ---------- Changes of the model (plan 19 3.7; ribbon.js rbChange runs them on the ribbon) ----------
// The item being moved, taken out of where it was (its place given back for an index fix), or made from a call.
function rbTake(m, what) {
  if (what.kind === 'call') {
    const [action, ...params] = what.call;
    return { item: params.length ? { action, params } : { action } };
  }
  if (what.kind === 'corner') {
    const [t, g, side] = what.path, corners = m.tabs[t].groups[g].corners, item = ribbonItemOf(corners?.[side]);
    if (!item) return null;
    delete corners[side];
    return { item };
  }
  if (what.kind === 'item' || what.kind === 'divider') {
    const [t, g, i] = what.path, items = m.tabs[t].groups[g].items, item = items[i];
    items.splice(i, 1);
    // The one under it in its column now starts it.
    if (item !== 'divider' && !item.stack && items[i] && items[i] !== 'divider' && items[i].stack) items[i] = { ...items[i], stack: false };
    return { item, from: [t, g, i] };
  }
  return null;
}

// The model change of a drop (the tests run it under Jint). False: nothing changed.
function rbPlaceIn(m, what, target) {
  if (what.kind === 'tab') {   // a tab moved: before the one it is dropped on
    if (target.kind !== 'tab') return false;
    const [from] = what.path, [to] = target.path;
    if (from === to) return false;
    const [tab] = m.tabs.splice(from, 1);
    m.tabs.splice(to, 0, tab);
    return;
  }
  if (what.kind === 'group') {   // a group moved: before the group (or the button's group) it is dropped on, or to a tab
    if (target.kind === 'newGroup' || target.kind === 'corner') return false;
    const [ft, fg] = what.path, [g] = m.tabs[ft].groups.splice(fg, 1);
    if (target.kind === 'tab') { m.tabs[target.path[0]].groups.push(g); return; }
    const [tt, tg] = target.path;
    const at = tt === ft && tg > fg ? tg - 1 : tg;
    m.tabs[tt].groups.splice(target.kind === 'item' && target.how === 'after' ? at + 1 : at, 0, g);
    return;
  }
  if (what.kind === 'divider' && target.kind === 'corner') return false;   // refused before it is taken out
  // A target's path before the item is taken out of the same group: one less after it.
  let tpath = target.path;
  const taken = rbTake(m, what);
  if (!taken) return false;
  const item = taken.item;
  if (taken.from && target.kind === 'item' && taken.from[0] === tpath[0] && taken.from[1] === tpath[1] && taken.from[2] < tpath[2])
    tpath = [tpath[0], tpath[1], tpath[2] - 1];
  if (target.kind === 'corner') {
    if (item === 'divider') return false;
    const [t, g, side] = tpath, grp = m.tabs[t].groups[g];
    grp.corners = { ...(grp.corners ?? {}), [side]: ribbonCornerOf(item) };
    return;
  }
  if (target.kind === 'tab') {
    const tab = m.tabs[tpath[0]];
    if (!tab.groups.length) tab.groups.push({ name: tab.name, items: [] });
    tab.groups.at(-1).items.push(item === 'divider' ? item : { ...item, stack: false });
    return;
  }
  if (target.kind === 'group') { m.tabs[tpath[0]].groups[tpath[1]].items.push(item === 'divider' ? item : { ...item, stack: false }); return; }
  const [t, g, i] = tpath, items = m.tabs[t].groups[g].items;
  if (item === 'divider') { items.splice(target.how === 'before' ? i : i + 1, 0, item); return; }
  if (target.how === 'under') items.splice(i + 1, 0, { ...item, size: undefined, stack: true });
  else if (target.how === 'before') items.splice(i, 0, { ...item, stack: false });
  else items.splice(i + 1, 0, { ...item, stack: false });
}

// A part removed (dropped off the ribbon, Remove). False: nothing changed.
function rbRemoveIn(m, what) {
  if (what.kind === 'tab') { m.tabs.splice(what.path[0], 1); return; }
  if (what.kind === 'group') { m.tabs[what.path[0]].groups.splice(what.path[1], 1); return; }
  if (!rbTake(m, what)) return false;
}

// ---------- Corners ----------
// A group's corner as kept in ribbon.json: an action, [action, ...params], or { action, params, open } (open:
// "dropDown", docs/plans/executed/PLAN-ribbon-drop-down-lists.md). As one shape: { call: [action, ...params], open };
// null: none.
function ribbonCorner(c) {
  if (typeof c === 'string') return c ? { call: [c] } : null;
  if (Array.isArray(c)) return c.length ? { call: c } : null;
  if (!c?.action) return null;
  return { call: [c.action, ...(c.params ?? [])], ...(c.open ? { open: c.open } : {}) };
}
// A button's item as a corner, in the plainest form that keeps it: no `open`, an action or [action, ...params].
function ribbonCornerOf(item) {
  const params = item.params ?? [];
  if (item.open) return { action: item.action, ...(params.length ? { params } : {}), open: item.open };
  return params.length ? [item.action, ...params] : item.action;
}
// A corner as a button's item; null: none.
function ribbonItemOf(corner) {
  const c = ribbonCorner(corner);
  return c && { action: c.call[0], ...(c.call.length > 1 ? { params: c.call.slice(1) } : {}), ...(c.open ? { open: c.open } : {}) };
}

// The key tips of one level (the tab names; a tab's buttons and corners): per name a letter no other one at that level
// has: its own tip first (when free), else the first letter of its words, else any letter of it, else two letters.
// Upper case. No tip starts another (a "P" beside a "PF" would run at the P), so a letter typed never waits.
function ribbonTips(names, own = []) {
  const used = new Set(), tips = Array(names.length).fill('');
  const take = (i, t) => { if (!t || [...used].some(u => u.startsWith(t) || t.startsWith(u))) return false; used.add(t); tips[i] = t; return true; };
  names.forEach((_, i) => { if (own[i]) take(i, String(own[i]).toUpperCase().slice(0, 2)); });
  const letters = name => [...String(name).toUpperCase()].filter(c => /[A-Z0-9]/.test(c));
  const starts = name => String(name).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).map(w => w[0]);
  names.forEach((name, i) => {
    if (tips[i]) return;
    if (starts(name).some(c => take(i, c))) return;
    if (letters(name).some(c => take(i, c))) return;
  });
  names.forEach((name, i) => {
    if (tips[i]) return;
    const l = letters(name), abc = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    for (const first of [...l, ...abc]) for (const c of [...l.slice(1), ...abc]) if (take(i, first + c)) return;
  });
  return tips;
}

// ---------- Height (docs/plans/executed/PLAN-ribbon-height-and-collapse.md) ----------
// A row's height (px at UI scale 1; three rows of buttons): 30 as LexPen ships it, down to 50 / 3 (50 px for the three).
// Lower, the spacing goes first (sp from 1 to 0 between 30 and 22 px), then the text and the icons with it (f from 1 to
// 3/4 between 22 px and the lowest). A large button's icon takes what its two label lines, a split's arrow row and the
// padding leave of three rows (32 at the full height); one sharing its column with a small button what two rows leave.
const RB_ROW_FULL = 30, RB_ROW_SPACED = 22, RB_ROW_LOWEST = 50 / 3;
function ribbonSizes(row) {
  row = Math.min(RB_ROW_FULL, Math.max(RB_ROW_LOWEST, Number(row) || RB_ROW_FULL));
  const sp = Math.min(1, Math.max(0, (row - RB_ROW_SPACED) / (RB_ROW_FULL - RB_ROW_SPACED)));
  const f = Math.min(1, Math.max(0.75, 0.75 + 0.25 * (row - RB_ROW_LOWEST) / (RB_ROW_SPACED - RB_ROW_LOWEST)));
  const lineHeight = 1.05 + 0.25 * sp, arrowRow = Math.round(6 + 10 * sp);
  // 5: the button's border, two gaps and the arrow row's line; 3 of them back at the full height (32, as LexPen ships
  // it). A large button without an arrow has the arrow row's room for its icon too (app.css).
  const largeIcon = Math.min(32, Math.floor(3 * row - 2 * 13 * f * lineHeight - 6 * sp - 5 + 3 * sp - arrowRow));
  // One sharing its column with a small one: two rows, one line of label.
  const sharedIcon = Math.min(largeIcon, Math.floor(2 * row - 13 * f * lineHeight - 6 * sp - 5 + 3 * sp - arrowRow));
  const r3 = x => Math.round(x * 1000) / 1000;
  return { row: r3(row), sp: r3(sp), f: r3(f), lineHeight: r3(lineHeight), arrowRow, largeIcon, sharedIcon };
}
