'use strict';
// Renaming in place (F2), a new folder (F8) and a new file (F7), and the menu of a pane's empty space. A name is
// edited in a box over its row: the name selected without its extension, the extension in the box too; Enter or
// leaving the box renames (a changed extension asks first, as Explorer does), Esc cancels. A file's companions (the
// files beside it with the same name and another extension: photo.xmp beside photo.jpg) are renamed along when the
// name changes, as the setting renameCompanions says; Shift+Enter does the other. While the name is edited the
// companions that would go along are highlighted (holding Shift shows what Shift+Enter would do). A new folder or file gets
// its name first, in a row of its own, and is made with it (newItem).

let renaming = null;   // { view, item, input, asking, companions, shift, own, watch }
let pendingNew = null; // a new folder or file asked of the host: { pane, folder }, focused once it is there

const diskId = id => /^[A-Za-z]:\\|^\\\\/.test(id ?? '');
const extensionOf = (item, name) => item.folder ? '' : name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
const renameItems = view => view.flat ?? view.entries;

// The rename box over an item's name (a list's row or tile, a tree's row). `own`: a name of Foldex's own, not the
// item's on disk: { at: the row, or item: the row's item; done: name => ..., check: name => a problem or null,
// end: () => ... when the box goes }; a quick access shortcut (plan 26 3.10), a new folder or file (newItem).
function startRename(view, id, own = null) {
  const items = renameItems(view);
  if (!items) return;
  const i = own?.item ? items.indexOf(own.item) : own?.at ?? items.findIndex(x => same(x.id, id));
  const item = items[i];
  if (!item) return;
  if (!own && (!diskId(item.id) || isDrive(item))) return status('Only files and folders on disk can be renamed.', true);
  if (!own && (view.iconsView?.() || view.thumbsView?.())) return renameInWindow(view, item);
  endRename();
  if (view.scrollTo) view.scrollTo(i);
  else scrollIntoView(view.body, i);
  view.render();
  const input = Object.assign(document.createElement('input'), { className: 'rename', value: item.name, spellcheck: false });
  view.body.append(input);
  // The box follows its item when the pane draws its rows again (the folder read again, items come and go, scrolled):
  // at its row when that is drawn; gone when the item is (renamed or deleted elsewhere).
  const watch = new MutationObserver(() => placeRename());
  watch.observe(view.rows, { childList: true });
  renaming = { view, item, input, asking: false, companions: own ? [] : companionsOf(view, item), shift: false, own, watch };
  if (!placeRename()) return;
  view.render();   // the companions highlighted
  selectName(input, own?.item ?? (own ? { folder: true } : item));
  // Its keys are its own: no action, no typing into the pane, no row clicked.
  const shift = on => {
    if (renaming?.input !== input || renaming.shift === on) return;
    renaming.shift = on;
    view.render();   // the highlight shows what Enter does now
  };
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Shift') shift(true);
    if (e.key === 'Enter') {
      e.preventDefault();
      shift(e.shiftKey);
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      endRename();
    }
  });
  input.addEventListener('keyup', e => { if (e.key === 'Shift') shift(false); });
  input.addEventListener('mousedown', e => e.stopPropagation());
  input.addEventListener('dblclick', e => e.stopPropagation());
  input.addEventListener('blur', () => {
    if (renaming?.input !== input || renaming.asking) return;
    renaming.shift = false;   // left with the mouse: as the setting says
    commitRename();
  });
}

// Icons and thumbnails: the name asked in a small window of its own (a box over a tile or an image looked out of
// place), its name without the extension selected as in the box; what it gives renamed as the box's would be: the same
// checks, its companions along. A name that cannot be used is said in the status line.
async function renameInWindow(view, item) {
  endRename();
  const dot = item.folder || settings.renameSelect === 'all' ? -1 : item.name.lastIndexOf('.');
  const name = await askText(`Rename ${item.name}`, item.name, '', [0, dot > 0 ? dot : item.name.length]);
  if (name === null) return;
  const input = Object.assign(document.createElement('input'), { value: name });
  renaming = { view, item, input, asking: false, companions: companionsOf(view, item), shift: false, own: null, watch: { disconnect() {} } };
  await commitRename();
  if (renaming?.input === input) endRename();   // not renamed (a name not allowed, the extension kept): nothing left open
}

// The rename box over its item's name, where that row is drawn now. False (and the box gone) when the item is no
// longer in the pane.
function placeRename() {
  const r = renaming;
  if (!r) return false;
  const { view, input } = r;
  const items = renameItems(view) ?? [];
  let i = items.indexOf(r.item);
  if (i < 0 && !r.own) {
    i = items.findIndex(x => same(x.id, r.item.id));   // read again: the same item, a new object
    if (i >= 0) r.item = items[i];
  }
  if (i < 0) {
    endRename();
    return false;
  }
  const name = view.rows.querySelector(`[data-index="${i}"] .name`);
  if (!name) return true;   // its row is not drawn (scrolled away): the box stays where it was
  const at = name.getBoundingClientRect(), body = view.body.getBoundingClientRect();
  const cell = name.closest('.cell, .tile').getBoundingClientRect();
  Object.assign(input.style, {
    left: `${at.left - body.left + view.body.scrollLeft - 3}px`, top: `${at.top - body.top + view.body.scrollTop - 2}px`,
    width: `${Math.max(160, cell.right - at.left + 6)}px`, height: `${at.height + 4}px`,
  });
  return true;
}

// The name selected as the setting renameSelect says: without its extension, or all of it (a folder: all of it).
function selectName(input, item) {
  input.focus();
  const dot = item.folder || settings.renameSelect === 'all' ? -1 : input.value.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
}

function endRename() {
  if (!renaming) return;
  const { view, input, watch, own } = renaming;
  renaming = null;
  watch.disconnect();
  input.remove();
  own?.end?.();
  view.render();
  if (activePane === view.id) view.body.focus();
}

// The name without its extension (all of a folder's name), case not counting.
const baseOf = (item, name = item.name) => (item.folder || name.lastIndexOf('.') <= 0 ? name : name.slice(0, name.lastIndexOf('.'))).toLowerCase();

// A file's companions in the pane: the other files of its folder with the same name before the extension.
function companionsOf(view, item) {
  if (item.folder) return [];
  const items = view.flat ?? view.all ?? view.entries ?? [];
  return items.filter(x => x !== item && !x.folder && same(folderOf(x.id), folderOf(item.id)) && baseOf(x) === baseOf(item)
    && x.name.toLowerCase() !== item.name.toLowerCase());
}

// Whether the companions go along: the setting, the other way round with Shift.
const companionsAlong = r => (settings.renameCompanions !== false) !== r.shift;

// Whether a row is a companion that goes along with the item being renamed (highlighted, app.css).
const isCompanion = (view, id) => renaming?.view === view && companionsAlong(renaming) && renaming.companions.some(x => same(x.id, id));

async function commitRename() {
  const r = renaming;
  if (!r || r.asking) return;
  const name = r.input.value.trim();
  if (r.own) {
    const problem = name && r.own.check?.(name);
    if (problem) {
      status(problem, true);
      return selectName(r.input, r.own.item ?? { folder: true });
    }
    endRename();
    if (r.own.item ? name : name !== r.item.name) r.own.done(name);
    return;
  }
  if (!name || name === r.item.name) return endRename();
  if (/[\\/:*?"<>|]/.test(name)) {
    status('A name cannot hold \\ / : * ? " < > |', true);
    return selectName(r.input, r.item);
  }
  if (extensionOf(r.item, name) !== extensionOf(r.item, r.item.name)) {
    r.asking = true;
    const yes = await askYes('If you change a file name extension, the file might become unusable. Are you sure you want to change it?');
    r.asking = false;
    if (renaming !== r) return;
    if (!yes) return r.input.focus();   // back to renaming, the text as typed
  }
  const along = companionsAlong(r);
  endRename();
  post({ op: 'fileOp', kind: 'rename', ids: [r.item.id], target: name, confirmed: true });
  if (!along) return;
  // Its companions along, each keeping its own extension, when the name before the extension changed; one whose new
  // name is taken stays as it is.
  const stem = n => n.slice(0, n.length - extensionOf(r.item, n).length);
  const base = stem(name);
  if (base === stem(r.item.name)) return;
  const folder = folderOf(r.item.id);
  const taken = new Set((r.view.flat ?? r.view.all ?? r.view.entries ?? []).filter(x => same(folderOf(x.id), folder)).map(x => x.name.toLowerCase()));
  const moved = [], left = [];
  for (const c of r.companions) {
    const to = base + c.name.slice(c.name.lastIndexOf('.'));
    if (taken.has(to.toLowerCase()) && to.toLowerCase() !== c.name.toLowerCase()) left.push(c.name);   // a change of case is no clash
    else {
      moved.push(c.name);
      post({ op: 'fileOp', kind: 'rename', ids: [c.id], target: to, confirmed: true });
    }
  }
  if (moved.length || left.length)
    status(`Renamed along: ${moved.join(', ') || 'none'}${left.length ? `; not renamed (the new name is taken): ${left.join(', ')}` : ''}.`, left.length > 0);
}

// F8, F7: a new folder or file in the active pane's folder. Its name first: a row of its own ("New folder", "New
// file.txt") with the name box, at the top of a list or as the first child of the tree's folder; nothing is made yet.
// Enter (or leaving the box) makes it with the name typed; Esc, or an empty name, makes nothing.
function newItem(kind) {
  const folder = currentFolder();
  const view = views.get(activePane);
  if (!folder || !(view instanceof ListView || view instanceof TreeView)) return;
  const isFolder = kind !== 'file';
  const name = isFolder ? 'New folder' : 'New file.txt';
  const like = (view.flat ?? view.all ?? []).find(x => !x.up && !x.qa && (isFolder ? x.folder : /\.txt$/i.test(x.name ?? '')));
  const parent = view instanceof TreeView ? view.focused() : null;
  const row = { id: `${folder}\\${name}`, name, folder: isFolder, icon: like?.icon ?? -1, newItem: true, subs: false, files: false,
    depth: parent ? parent.depth + 1 : 0, parent };
  // The names there now: a name taken is refused, as Explorer does.
  const taken = () => new Set((parent ? parent.children ?? [] : view.all ?? []).filter(x => !x.up).map(x => x.name.toLowerCase()));
  view.newRow = row;
  if (parent && !parent.expanded) view.toggle(parent.id);
  view.render();
  startRename(view, row.id, {
    item: row,
    check: n => /[\\/:*?"<>|]/.test(n) ? 'A name cannot hold \\ / : * ? " < > |'
      : taken().has(n.toLowerCase()) ? `There is already an item named "${n}" here.` : null,
    end: () => {
      if (view.newRow === row) view.newRow = null;
      const items = renameItems(view);
      if (items?.includes(row)) items.splice(items.indexOf(row), 1);
    },
    done: n => {
      pendingNew = { pane: view.id, folder };
      post({ op: 'fileOp', kind: isFolder ? 'newFolder' : 'newFile', ids: [], target: folder, name: n });
    },
  });
}

// The new item's row in a pane's rows while its name is asked (newItem): in a list where the focused item is (that one
// a row down), else at the top (after ".."); as the first child of the tree's folder (under its row). Put back each
// time the rows are drawn, as the folder may be read again meanwhile.
function placeNewRow(view, items) {
  const row = view.newRow;
  if (!row || items.includes(row)) return;
  if (row.parent) {
    const at = items.indexOf(row.parent);
    if (at >= 0) items.splice(at + 1, 0, row);
  } else {
    const focus = layout.state(view.id)?.focus;
    const here = focus ? items.findIndex(x => !x.up && same(x.id, focus)) : -1;
    const at = here >= 0 ? here : items.findIndex(x => !x.up);
    items.splice(at < 0 ? items.length : at, 0, row);
  }
}

// A file operation done: a new item focused where it was asked for (a list focuses what arrived itself, ListView.reread);
// a tree focused on a renamed item under its new name (a list keeps its selection and focus itself).
function fileOpDone(op) {
  if (op.created && pendingNew && same(folderOf(op.created), pendingNew.folder)) {
    const view = views.get(pendingNew.pane);
    pendingNew = null;
    if (view instanceof TreeView) treeShows(view, op.created, false);
  }
  if (op.kind === 'rename' && op.moved?.length) {
    const [from, to] = op.moved[0];
    for (const v of views.values()) if (v instanceof TreeView && !isPaged(v) && v.node(from)) treeShows(v, to, false);   // a tree's page: its own
  }
}

// A tree with a new or renamed item: its folder read again, the item focused (and renamed when new).
async function treeShows(tree, id, rename) {
  const parent = tree.node(folderOf(id));
  if (parent) {
    parent.children = null;
    await tree.expand(parent, true);
  } else if (tree.folder && same(tree.root, folderOf(id))) await tree.load(tree.root);
  if (!tree.node(id)) return;
  tree.select(id);
  if (rename) startRename(tree, id);
}

// The menu of a pane's empty space: a new folder or file there.
function emptyMenu() {
  const can = !!currentFolder();
  return [
    { label: withKey('New folder', 'folder.new'), enabled: can, run: () => newItem('folder') },
    { label: withKey('New file', 'file.new'), enabled: can, run: () => newItem('file') },
    // The clipboard's link source pasted here (plan 31 3.2): its kind and item in the text.
    ...(clipboardLink ? ['-', { label: withKey(pasteLinkTitle(), 'link.paste'), enabled: can, run: () => runAction('link.paste') }] : []),
  ];
}
