'use strict';
// A menu of the page's own (the pane head's menu, docs/plans/executed/12-PLAN-docking-and-pane-menu.md 3.2): items with a check
// mark or a colour swatch, greyed out when not possible, submenus that open beside them. Closed by a click outside,
// Esc, or choosing. A submenu opens to the right, or to the left when there is no room; a menu whose submenus open to
// the left has its arrows at the left. Keys: Up / Down, Right opens a submenu,
// Left closes it (the other way round where it opens to the left), Enter chooses.
// Any button (or other element) whose left click opened a menu is its opener: a click on it while the menu is open
// closes the menu, and does not open it again (for every opener, whether it opens on mousedown or on click, at once
// or after an answer of the host).
//
// An item: '-' (a line) or { label, run, enabled (default true), checked, swatch (a CSS colour), items (a submenu),
// indent (steps in, for a tree), guides (its tree lines, panes.js treeGuides), icon (an <img>, in the check mark's
// column), key (shown at the right), title (its tooltip), context (items: its own menu, opened beside it as a submenu
// by a right-click on it, or the menu key or Shift+F10 while it is lit) }.

let openMenus = [];   // the menu and its open submenus, outermost first
let menuDown = null;    // the last left mousedown outside a menu: { target, time }; a menu opened soon after is its
let menuOpener = null;  // opener's (the element of that mousedown)
let menuSwallow = null; // the opener clicked to close: the click that follows does nothing
const MenuOpenerTime = 1500;   // ms from that mousedown to the menu, as for a menu that waits for the host

function closeMenus(from = 0) {
  for (const m of openMenus.splice(from)) m.el.remove();
}

function openMenu(x, y, items, level = 0, back = null) {
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
    if (item.icon) {
      check.classList.add('icon');
      check.append(item.icon);
    }
    const label = document.createElement('span');
    label.className = 'menu-label';
    label.textContent = item.label;
    if (item.indent) label.style.paddingLeft = `${item.indent * 14}px`;
    if (item.title) row.title = item.title;
    // Its tree lines over the whole row (it is positioned), so they join the rows above and below; the label starts
    // 26 px in (padding 8, the check mark 10, the gap 8).
    if (item.guides) row.append(...guideElements(item.guides, k => 30 + 14 * k, 8));
    row.append(check, label);
    if (item.key) row.append(Object.assign(document.createElement('span'), { className: 'menu-key', textContent: item.key }));
    row.addEventListener('mouseenter', () => hover(rows.indexOf(row)));
    row.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 2 && item.context) return openContext(rows.indexOf(row));
      choose(rows.indexOf(row));
    });
    row.addEventListener('contextmenu', e => e.preventDefault());
    el.append(row);
    rows.push(row);
    row.item = item;
  }
  // Over a modal dialog it goes inside that dialog (the top layer), else the dialog would cover it.
  ([...document.querySelectorAll('dialog[open]')].pop() ?? document.body).append(el);
  // Kept inside the window; a submenu that does not fit at the right goes to the left of its menu (back: that left).
  const r = el.getBoundingClientRect();
  const left = back !== null && (openMenus[level - 1].leftward || x + r.width > innerWidth - 2) ? back - r.width
    : Math.min(x, innerWidth - r.width - 2);
  el.style.left = `${Math.max(0, left)}px`;
  el.style.top = `${Math.max(0, Math.min(y, innerHeight - r.height - 2))}px`;
  // Its submenus open to the left when one as wide as this menu would not fit at its right.
  const leftward = Math.max(0, left) + 2 * r.width > innerWidth - 2;
  el.classList.toggle('leftward', leftward);
  const menu = { el, rows, at: -1, leftward };
  openMenus.push(menu);

  // An item lit; its submenu opened when `open` (the mouse; with the keys only Right and Enter open one).
  function hover(k, open = true) {
    rows.forEach((row, i) => row.classList.toggle('hot', i === k));
    menu.at = k;
    const item = rows[k]?.item;
    if (open && item?.items && item.enabled !== false) {
      const rr = rows[k].getBoundingClientRect();
      openMenu(rr.right - 2, rr.top - 4, item.items, level + 1, rr.left + 2);
    } else closeMenus(level + 1);
  }

  function choose(k) {
    const item = rows[k]?.item;
    if (!item || item.enabled === false) return;
    if (item.items) return hover(k);
    closeMenus();
    item.run?.();
  }

  // An item's own menu (its context), beside it as a submenu.
  function openContext(k) {
    const item = rows[k]?.item;
    if (!item?.context || item.enabled === false) return;
    hover(k, false);
    const rr = rows[k].getBoundingClientRect();
    openMenu(rr.right - 2, rr.top - 4, item.context, level + 1, rr.left + 2);
  }

  menu.key = e => {
    const live = rows.map((row, i) => i).filter(i => rows[i].item.enabled !== false);
    const pos = live.indexOf(menu.at);
    if (e.key === 'ArrowDown') hover(live[(pos + 1) % live.length], false);
    else if (e.key === 'ArrowUp') hover(live[(pos - 1 + live.length) % live.length], false);
    else if (e.key === (leftward ? 'ArrowLeft' : 'ArrowRight') && rows[menu.at]?.item.items) {
      hover(menu.at);
      if (openMenus.length > level + 1) openMenus.at(-1).key({ key: 'ArrowDown' });
    } else if ((e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) && rows[menu.at]?.item.context) {
      openContext(menu.at);
      if (openMenus.length > level + 1) openMenus.at(-1).key({ key: 'ArrowDown' });
    } else if (e.key === (openMenus[level - 1]?.leftward ? 'ArrowRight' : 'ArrowLeft') && level > 0) closeMenus(level);
    else if (e.key === 'Enter') choose(menu.at);
    else if (e.key === 'Escape') closeMenus(level > 0 ? level : 0);
    else return false;
    return true;
  };
  if (level === 0) {
    menuOpener = menuDown && performance.now() - menuDown.time < MenuOpenerTime ? menuDown.target : null;
    menuDown = null;
    el.focus();
  }
  return menu;
}

document.addEventListener('mousedown', e => {
  menuSwallow = null;
  if (e.target.closest('.menu')) return;
  const again = openMenus.length > 0 && e.button === 0 && menuOpener?.isConnected && menuOpener.contains(e.target);
  if (openMenus.length) closeMenus();
  if (again) {
    // Its opener again: closed, and its own handlers do not open it once more.
    e.preventDefault();
    e.stopPropagation();
    menuSwallow = menuOpener;
    menuOpener = menuDown = null;
    return;
  }
  menuDown = e.button === 0 ? { target: e.target, time: performance.now() } : null;
}, true);
document.addEventListener('click', e => {
  if (menuSwallow?.contains(e.target)) {
    e.preventDefault();
    e.stopPropagation();
  }
  menuSwallow = null;
}, true);

// The keys go to the innermost open menu, before keys.json's (a menu is modal while open).
document.addEventListener('keydown', e => {
  menuDown = null;   // a menu opened by a key has no opener
  if (!openMenus.length) return;
  if (openMenus.at(-1).key(e) !== false || e.key.length === 1) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
