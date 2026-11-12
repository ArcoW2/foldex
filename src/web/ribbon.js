'use strict';
// The ribbon (as LexPen's, docs/plans/01-PLAN-foundation.md 3.3): tabs of named groups of buttons, each button an
// action (ribbon.json: yours, else the shipped one; RibbonFile.cs). A button is large (the full height) or small (a
// third of it); up to three small ones stack in a column (ribbonColumns, ribbonmodel.js). Not yet from LexPen: icons,
// split buttons and drop-down lists, key tips, the change mode, collapsing.

const rb = { model: null, tab: null };

function setRibbon({ ribbon, problems }) {
  rb.model = ribbon;
  rb.tab = ribbon.tabs[0]?.name ?? null;
  if (problems.length) status('ribbon.json: ' + problems.join('; '), true);
  renderRibbon();
}

function renderRibbon() {
  const el = document.getElementById('ribbon');
  if (!rb.model?.tabs.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const tabs = document.createElement('div');
  tabs.className = 'rb-tabs';
  for (const t of rb.model.tabs) {
    const b = document.createElement('button');
    b.textContent = t.name;
    b.className = t.name === rb.tab ? 'on' : '';
    b.addEventListener('click', () => { rb.tab = t.name; renderRibbon(); });
    tabs.append(b);
  }
  const groups = document.createElement('div');
  groups.className = 'rb-groups';
  const tab = rb.model.tabs.find(t => t.name === rb.tab) ?? rb.model.tabs[0];
  for (const g of tab.groups) {
    const items = g.items.filter(it => it === 'divider' || isAction(it.action));   // an unknown action is left out
    const group = document.createElement('div');
    group.className = 'rb-group';
    const cols = document.createElement('div');
    cols.className = 'rb-cols';
    for (const col of ribbonColumns(items)) {
      const c = document.createElement('div');
      c.className = `rb-col ${col.kind}`;
      if (col.kind !== 'divider') for (const { item } of col.items) c.append(ribbonButton(item));
      cols.append(c);
    }
    const name = document.createElement('div');
    name.className = 'rb-name';
    name.textContent = g.name;
    group.append(cols, name);
    groups.append(group);
  }
  el.replaceChildren(tabs, groups);
  ribbonRefresh();
}

function ribbonButton(item) {
  const b = document.createElement('button');
  b.className = `rb-button ${item.size === 'large' ? 'large' : 'small'}`;
  const params = item.params ?? [];
  b.dataset.call = JSON.stringify([item.action, ...params]);
  b.textContent = item.label ?? actionTitle(item.action, params);
  b.title = withKey(actionTitle(item.action, params), item.action, ...params) + (actionDef(item.action)?.hint ? `: ${actionDef(item.action).hint}` : '');
  // The focus stays in the pane: the action works on what is selected there.
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', () => runAction(item.action, params, { from: 'ribbon', el: b }));
  return b;
}

// Greyed out and lit as the actions say now: after every action, a pane activated, a selection.
function ribbonRefresh() {
  for (const b of document.querySelectorAll('#ribbon .rb-button')) {
    const [name, ...params] = JSON.parse(b.dataset.call);
    b.disabled = !actionEnabled(name, params);
    b.classList.toggle('on', !!actionDef(name)?.checked?.(params));
  }
}
