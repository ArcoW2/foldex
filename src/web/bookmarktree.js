'use strict';
// The bookmarks as a tree (docs/plans/executed/26-PLAN-bookmarks.md, executed/27-PLAN-bookmark-folders.md): the parts
// every page that shows them uses, the window's page (bookmarks.js) and the Manage pane's page (bmmanage.js), each with
// its own ookmarks, ookmarkPaths, ookmarkExists, same and saveBookmarks. No DOM.

// Where a location is: a known folder to its path now.
const folderPath = f => bookmarkPaths?.[f] ?? f;

// A location's own name: the last part of its path (a known folder's where it is now: OneDrive's Documenten, as Explorer).
const folderName = f => folderPath(f).replace(/\\+$/, '').split('\\').pop() || f;

// The folder a location is in (shown dimmed by two shortcuts with the same name).
const folderParent = f => folderPath(f).replace(/\\+$/, '').replace(/\\[^\\]*$/, '');

// A folder of bookmarks (plan 27 3.1), not a bookmark of a folder on disk.
const isGroup = b => b?.folder != null;

// Every entry at any depth, in the order of the list, with where it is: { b, list (the array it is in), quick (its
// tab), depth, parent (the folder's id; null at the top) }.
function bookmarkPlaces(list = bookmarks, quick = null, depth = 0, parent = null, out = []) {
  for (const b of list) {
    const q = quick ?? !!b.quickAccess;
    out.push({ b, list, quick: q, depth, parent });
    if (isGroup(b)) bookmarkPlaces(b.items ?? [], q, depth + 1, b.id, out);
  }
  return out;
}
// Every bookmark (not the folders), at any depth.
const allBookmarks = () => bookmarkPlaces().filter(p => !isGroup(p.b)).map(p => p.b);

const bookmarkById = id => !!id && bookmarkPlaces().find(p => p.b.id === id)?.b || null;
// The first bookmark of a location on a tab (quick: true for quick access, false for the menu's bookmarks), at any depth.
const bookmarkAt = (f, quick) => !!f && bookmarkPlaces().find(p => p.quick === quick && !isGroup(p.b) && same(folderPath(p.b.location), folderPath(f)))?.b || null;
// A new entry's id (the host gives one to an entry without).
const newBookmarkId = () => [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, '0')).join('');
const bookmarkName = b => isGroup(b) ? b.folder : b.name || folderName(b.location);
// The top level of each tab: bookmarks and folders.
const quickAccessList = () => bookmarks.filter(b => b.quickAccess);
const menuBookmarks = () => bookmarks.filter(b => !b.quickAccess);
const bookmarkMissing = f => bookmarkExists.get(f.toLowerCase()) === false;

// ---------- Changing the list: on a copy, then saved whole (saveBookmarks) ----------

const copyBookmarks = () => structuredClone(bookmarks);

// Where an entry is in a list (a copy): { list, index, b }; null when it is not there.
function locateIn(tree, id) {
  for (const [index, b] of tree.entries()) {
    if (b.id === id) return { list: tree, index, b };
    const inside = isGroup(b) ? locateIn(b.items ?? [], id) : null;
    if (inside) return inside;
  }
  return null;
}

// Whether `id` is the folder `group` or inside it (a folder cannot go into itself).
function insideGroup(tree, group, id) {
  const g = locateIn(tree, group)?.b;
  return !!g && (g.id === id || !!locateIn(g.items ?? [], id));
}

// An entry and what it holds put on a tab.
function onTab(b, quick) {
  if (quick) b.quickAccess = true;
  else delete b.quickAccess;
  for (const c of b.items ?? []) onTab(c, quick);
  return b;
}

// An entry put into a list (a copy) at `at`: in the folder `group`, or (null) at the top of a tab, counted among that
// tab's top-level entries (past the last: after it).
function putIn(tree, b, group, quick, at) {
  onTab(b, quick);
  if (group) {
    const items = locateIn(tree, group).b.items ??= [];
    items.splice(Math.max(0, Math.min(at, items.length)), 0, b);
    return;
  }
  const tops = tree.filter(x => !!x.quickAccess === quick);
  const index = at < tops.length ? tree.indexOf(tops[Math.max(0, at)]) : tops.length ? tree.indexOf(tops.at(-1)) + 1 : tree.length;
  tree.splice(index, 0, b);
}

// An entry moved to `at` in the folder `group` (null: the top of the tab `quick`); `at` counted as the list was, so one
// moved down lands where it was dropped. A folder into itself, or into one inside it, is refused (false).
function moveBookmarkTo(id, group, quick, at) {
  const tree = copyBookmarks(), from = locateIn(tree, id);
  if (!from || group && insideGroup(tree, id, group)) return false;
  const target = group ? locateIn(tree, group).b.items ?? [] : tree.filter(x => !!x.quickAccess === quick);
  const was = target.indexOf(from.b);
  from.list.splice(from.index, 1);
  if (was >= 0 && was < at) at--;
  putIn(tree, from.b, group, quick, at);
  saveBookmarks(tree);
  return true;
}

// An entry changed in place (`change` gets a copy of it to change).
function changeBookmark(id, change) {
  const tree = copyBookmarks(), at = locateIn(tree, id);
  if (!at) return;
  change(at.b);
  saveBookmarks(tree);
}

// A folder's icon: a folder with a bookmark ribbon, drawn here (no folder on disk has it).
const GroupIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
  '<path d="M1 3.5h5l1.5 1.5H15v8.5H1z" fill="#e8b84a" stroke="#a87d1e"/><path d="M10 6.5h3v6l-1.5-1.2-1.5 1.2z" fill="#3a78d4"/></svg>');

// A copy of an entry and what it holds: every copy its own id, no keys.
function copyOfEntry(b) {
  const { key, keyNew, ...rest } = structuredClone(b);
  const c = { ...rest, id: newBookmarkId() };
  if (isGroup(c)) c.items = (c.items ?? []).map(copyOfEntry);
  return c;
}