'use strict';
// A menu of the page's own (the pane head's menu, docs/plans/executed/12-PLAN-docking-and-pane-menu.md 3.2): items with a check
// mark or a colour swatch, greyed out when not possible, submenus that open beside them. Closed by a click outside,
// Esc, or choosing. Keys: Up / Down, Right opens a submenu, Left closes it, Enter chooses.
//
// An item: '-' (a line) or { label, run, enabled (default true), checked, swatch (a CSS colour), items (a submenu) }.

let openMenus = [];   // the menu and its open submenus, outermost first

function closeMenus(from = 0) {
  for (const m of openMenus.splice(from)) m.el.remove();
}

function openMenu(x, y, items, level = 0) {
  closeMenus(level);
  const el = document.createElement('div');
  el.className = 'menu';
  el.tabIndex = -1;
  const rows = [];
  for (const item of items) {
    if (item === '-') {
      el.append(Object.assign(document.createElement('div'), { className: 'menu-line' }));
      continue;
    }
    const row = document.createElement('div');
    row.className = 'menu-item' + (item.enabled === false ? ' off' : '') + (item.items ? ' sub' : '');
    const check = document.createElement('span');
    check.className = 'menu-check';
    if (item.swatch) {
      check.classList.add('swatch');
      check.style.background = item.swatch;
    }
    if (item.checked) check.classList.add('on');
    const label = document.createElement('span');
    label.className = 'menu-label';
    label.textContent = item.label;
    row.append(check, label);
    row.addEventListener('mouseenter', () => hover(rows.indexOf(row)));
    row.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      choose(rows.indexOf(row));
    });
    el.append(row);
    rows.push(row);
    row.item = item;
  }
  document.body.append(el);
  // Kept inside the window.
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(0, Math.min(x, innerWidth - r.width - 2))}px`;
  el.style.top = `${Math.max(0, Math.min(y, innerHeight - r.height - 2))}px`;
  const menu = { el, rows, at: -1 };
  openMenus.push(menu);

  // An item lit; its submenu opened when `open` (the mouse; with the keys only Right and Enter open one).
  function hover(k, open = true) {
    rows.forEach((row, i) => row.classList.toggle('hot', i === k));
    menu.at = k;
    const item = rows[k]?.item;
    if (open && item?.items && item.enabled !== false) {
      const rr = rows[k].getBoundingClientRect();
      openMenu(rr.right - 2, rr.top - 4, item.items, level + 1);
    } else closeMenus(level + 1);
  }

  function choose(k) {
    const item = rows[k]?.item;
    if (!item || item.enabled === false) return;
    if (item.items) return hover(k);
    closeMenus();
    item.run?.();
  }

  menu.key = e => {
    const live = rows.map((row, i) => i).filter(i => rows[i].item.enabled !== false);
    const pos = live.indexOf(menu.at);
    if (e.key === 'ArrowDown') hover(live[(pos + 1) % live.length], false);
    else if (e.key === 'ArrowUp') hover(live[(pos - 1 + live.length) % live.length], false);
    else if (e.key === 'ArrowRight' && rows[menu.at]?.item.items) {
      hover(menu.at);
      if (openMenus.length > level + 1) openMenus.at(-1).key({ key: 'ArrowDown' });
    } else if (e.key === 'ArrowLeft' && level > 0) closeMenus(level);
    else if (e.key === 'Enter') choose(menu.at);
    else if (e.key === 'Escape') closeMenus(level > 0 ? level : 0);
    else return false;
    return true;
  };
  if (level === 0) el.focus();
  return menu;
}

document.addEventListener('mousedown', e => {
  if (openMenus.length && !e.target.closest('.menu')) closeMenus();
}, true);

// The keys go to the innermost open menu, before keys.json's (a menu is modal while open).
document.addEventListener('keydown', e => {
  if (!openMenus.length) return;
  if (openMenus.at(-1).key(e) !== false || e.key.length === 1) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
