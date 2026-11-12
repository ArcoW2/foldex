'use strict';
// Renaming in place (F2), a new folder (F8) and a new file (F7), and the menu of a pane's empty space. A name is
// edited in a box over its row: the name selected without its extension, the extension in the box too; Enter or
// leaving the box renames (a changed extension asks first, as Explorer does), Esc cancels. A new folder or file is
// made by Windows ("New folder", "New file.txt", numbered when taken), then renamed in place.

let renaming = null;   // { view, item, input, asking }
let pendingNew = null; // a new folder or file asked for: { pane, folder }, renamed once it is there

const diskId = id => /^[A-Za-z]:\\|^\\\\/.test(id ?? '');
const extensionOf = (item, name) => item.folder ? '' : name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';

// The rename box over an item's name (a list's row or tile, a tree's row).
function startRename(view, id) {
  const items = view.flat ?? view.entries;
  if (!items) return;
  const i = items.findIndex(x => same(x.id, id));
  const item = items[i];
  if (!item) return;
  if (!diskId(item.id) || isDrive(item)) return status('Only files and folders on disk can be renamed.', true);
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
  renaming = { view, item, input, asking: false };
  selectName(input, item);
  // Its keys are its own: no action, no typing into the pane, no row clicked.
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      endRename();
    }
  });
  input.addEventListener('mousedown', e => e.stopPropagation());
  input.addEventListener('dblclick', e => e.stopPropagation());
  input.addEventListener('blur', () => { if (renaming?.input === input && !renaming.asking) commitRename(); });
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
  if (activePane === view.id) view.body.focus();
}

async function commitRename() {
  const r = renaming;
  if (!r || r.asking) return;
  const name = r.input.value.trim();
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
  endRename();
  post({ op: 'fileOp', kind: 'rename', ids: [r.item.id], target: name, confirmed: true });
}

// F8, F7: a new folder or file in the active pane's folder, renamed in place once it is there.
function newItem(kind) {
  const folder = currentFolder();
  if (!folder) return;
  pendingNew = { pane: activePane, folder };
  post({ op: 'fileOp', kind: kind === 'file' ? 'newFile' : 'newFolder', ids: [], target: folder });
}

// A file operation done: a new item renamed where it was asked for; a renamed item focused under its new name.
function fileOpDone(op) {
  if (op.created && pendingNew && same(folderOf(op.created), pendingNew.folder)) {
    const view = views.get(pendingNew.pane);
    pendingNew = null;
    if (view instanceof TreeView) treeShows(view, op.created, true);
    else if (view instanceof ListView && same(view.location, folderOf(op.created))) view.renameOnLoad = op.created;
  }
  if (op.kind === 'rename' && op.moved?.length) {
    const [from, to] = op.moved[0];
    for (const v of views.values()) {
      if (v instanceof ScrapView) continue;   // it follows the move itself
      if (v instanceof ListView && same(v.location, folderOf(to)) && same(layout.state(v.id).focus, from)) {
        layout.state(v.id).focus = to;
        layout.state(v.id).selection = [to];
      }
      if (v instanceof TreeView && v.node(from)) treeShows(v, to, false);
    }
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
