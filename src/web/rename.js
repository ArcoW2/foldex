'use strict';
// Renaming in place (F2), a new folder (F8) and a new file (F7), and the menu of a pane's empty space. A name is
// edited in a box over its row: the name selected without its extension, the extension in the box too; Enter or
// leaving the box renames (a changed extension asks first, as Explorer does), Esc cancels. A file's companions (the
// files beside it with the same name and another extension: photo.xmp beside photo.jpg) are renamed along when the
// name changes, as the setting renameCompanions says; Shift+Enter does the other. While the name is edited the
// companions that would go along are highlighted (holding Shift shows what Shift+Enter would do). A new folder or file is made
// by Windows ("New folder", "New file.txt", numbered when taken), then renamed in place.

let renaming = null;   // { view, item, input, asking, companions, shift }
let pendingNew = null; // a new folder or file asked for: { pane, folder }, renamed once it is there

const diskId = id => /^[A-Za-z]:\\|^\\\\/.test(id ?? '');
const extensionOf = (item, name) => item.folder ? '' : name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';

// The rename box over an item's name (a list's row or tile, a tree's row). `own`: a name of Foldex's own, not the
// item's on disk ({ at: the row, done: name => ... }; a quick access shortcut, plan 26 3.10): Enter gives it the name.
function startRename(view, id, own = null) {
  const items = view.flat ?? view.entries;
  if (!items) return;
  const i = own?.at ?? items.findIndex(x => same(x.id, id));
  const item = items[i];
  if (!item) return;
  if (!own && (!diskId(item.id) || isDrive(item))) return status('Only files and folders on disk can be renamed.', true);
  endRename();
  if (view.scrollTo) view.scrollTo(i);
  else scrollIntoView(view.body, i);
  view.render();
  const name = view.rows.querySelector(`[data-index="${i}"] .name`);
  if (!name) return;
  const at = name.getBoundingClientRect(), body = view.body.getBoundingClientRect();
  const cell = name.closest('.cell, .tile').getBoundingClientRect();
  const input = Object.assign(document.createElement('input'), { className: 'rename', value: item.name, spellcheck: false });
  Object.assign(input.style, {
    left: `${at.left - body.left + view.body.scrollLeft - 3}px`, top: `${at.top - body.top + view.body.scrollTop - 2}px`,
    width: `${Math.max(160, cell.right - at.left + 6)}px`, height: `${at.height + 4}px`,
  });
  view.body.append(input);
  renaming = { view, item, input, asking: false, companions: own ? [] : companionsOf(view, item), shift: false, own };
  view.render();   // the companions highlighted
  selectName(input, own ? { folder: true } : item);
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

// The name selected without its extension (a folder: all of it).
function selectName(input, item) {
  input.focus();
  const dot = item.folder ? -1 : input.value.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
}

function endRename() {
  if (!renaming) return;
  const { view, input } = renaming;
  renaming = null;
  input.remove();
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
    endRename();
    if (name !== r.item.name) r.own.done(name);
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

// F8, F7: a new folder or file in the active pane's folder, renamed in place once it is there.
function newItem(kind) {
  const folder = currentFolder();
  if (!folder) return;
  pendingNew = { pane: activePane, folder };
  post({ op: 'fileOp', kind: kind === 'file' ? 'newFile' : 'newFolder', ids: [], target: folder });
}

// A file operation done: a new item renamed where it was asked for; a tree focused on a renamed item under its new
// name (a list keeps its selection and focus itself, ListView.reread).
function fileOpDone(op) {
  if (op.created && pendingNew && same(folderOf(op.created), pendingNew.folder)) {
    const view = views.get(pendingNew.pane);
    pendingNew = null;
    if (view instanceof TreeView) treeShows(view, op.created, true);
    else if (view instanceof ListView && same(view.location, folderOf(op.created))) view.renameOnLoad = op.created;
  }
  if (op.kind === 'rename' && op.moved?.length) {
    const [from, to] = op.moved[0];
    for (const v of views.values()) if (v instanceof TreeView && v.node(from)) treeShows(v, to, false);
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
  ];
}
