'use strict';
// Actions (as LexPen's actions.js): what a key (keys.json), a ribbon button or F1 runs. Each has a name ("item.copy":
// what it acts on, a dot, what it does), a title, a group for F1, run(params, ctx), and may have enabled(params) (greyed
// out when false), checked(params) (lit on the ribbon), variants (the parameter lists F1 offers) with variantTitles.
// The functions the actions call are in app.js, which loads after this file.

const PASS = Symbol('pass');   // returned by an action that does not apply here: the key keeps its own meaning

const ACTION_GROUPS = [['items', 'Items'], ['scraps', 'Scraps and searching'], ['folders', 'Folders'], ['panes', 'Panes'], ['view', 'View'], ['projects', 'Projects'],
  ['app', 'Foldex']];

const actions = new Map();
const action = (name, def) => actions.set(name, { name, ...def });
// Old names still run (a ribbon.json or keys.json of your own keeps working): the action each is now.
const ActionAliases = { 'favourites.menu': 'bookmarks.menu', 'favourites.add': 'bookmarks.add', 'favourites.manage': 'bookmarks.manage' };
const actionOf = name => actions.get(ActionAliases[name] ?? name);
const isAction = name => !!actionOf(name);
const actionDef = name => actionOf(name);

function actionTitle(name, params = []) {
  const def = actionOf(name);
  return def?.variantTitles?.[params.join(' ')] ?? def?.title ?? name;
}

function actionEnabled(name, params = []) {
  const def = actionOf(name);
  return !!def && (!def.enabled || !!def.enabled(params));
}

function runAction(name, params = [], ctx = {}) {
  const def = actionOf(name);
  if (!def) {
    status(`Foldex has no action ${name}.`, true);
    return;
  }
  if (def.enabled && !def.enabled(params)) return ctx.from === 'key' ? PASS : undefined;
  const result = def.run(params, ctx);
  ribbonRefresh();
  return result;
}

// ---------- Items: what is selected in the active pane ----------

const anySelected = () => selectedIds().length > 0;
const onDisk = () => selectedIds().length > 0 && selectedIds().every(id => /^[A-Za-z]:\\|^\\\\/.test(id));

// Open is a switch for a folder: open (expanded in its tree) or not; a file has no open state.
action('item.open', { title: 'Open', hint: 'a folder open or closed in its tree', group: 'items',
  enabled: () => !!focusedItem()?.folder && !focusedItem().up, checked: () => folderOpen(focusedItem()), run: () => toggleFolder(focusedItem()) });
// As a double-click: a file starts in its program, a folder is opened by the parent (docs/plans/03 3.3).
action('item.execute', { title: 'Execute', hint: 'as a double-click: a file starts, a folder opens', group: 'items',
  enabled: () => !!focusedItem(), run: () => execute(activePane, focusedItem()) });
action('item.properties', { title: 'Properties', group: 'items', enabled: anySelected,
  run: () => post({ op: 'invokeVerb', ids: selectedIds(), verb: 'properties' }) });
// Delete (docs/plans/executed/06-PLAN-search-and-scrap.md 3.5): in a scrap it takes the items out, nothing on disk changes;
// elsewhere, and with Alt in a scrap, to the Recycle Bin; with Shift (and Alt+Shift), permanently. One question, with
// the folders the items are in when there are more.
const inScrap = () => activeView() instanceof ScrapView;
async function deleteItems(permanent) {
  const ids = selectedIds();
  if (!ids.length) return;
  const what = ids.length === 1 ? nameOf(ids[0]) : `these ${ids.length} items`;
  const folders = [...new Set(ids.map(folderOf))];
  const question = permanent ? `Delete ${what} permanently? This cannot be undone.` : `Move ${what} to the Recycle Bin?`;
  if (await askYes(question, folders.length > 1 ? ['From these folders:', ...folders] : []))
    post({ op: 'fileOp', kind: permanent ? 'deletePermanent' : 'delete', ids, confirmed: true });
}
action('item.delete', { title: 'Delete', hint: 'to the Recycle Bin; in a scrap: out of the scrap, the files stay; a quick access shortcut: off the list',
  enabled: anySelected, run: () => {
    // A shortcut in a tree's Quick access area: off the list, nothing on disk (plan 23 3.4).
    const shortcut = activeView() instanceof TreeView && activeView().quickAccessShortcut();
    if (shortcut) return removeBookmark(shortcut.bm);   // a quick access folder holding something asks (plan 27 3.6)
    return inScrap() ? activeView().takeOut(selectedIds()) : deleteItems(false);
  } });
action('item.deleteDisk', { title: 'Delete from disk', hint: 'to the Recycle Bin, also in a scrap (and out of it)', group: 'items',
  enabled: anySelected, run: () => deleteItems(false) });
action('item.deletePermanent', { title: 'Delete permanently', hint: 'not to the Recycle Bin, after a question; also in a scrap', group: 'items',
  enabled: anySelected, run: () => deleteItems(true) });
action('item.copy', { title: 'Copy', group: 'items', enabled: onDisk, run: () => post({ op: 'clipboard', kind: 'copy', ids: selectedIds() }) });
action('item.cut', { title: 'Cut', group: 'items', enabled: onDisk, run: () => post({ op: 'clipboard', kind: 'cut', ids: selectedIds() }) });
// Onto a scrap: the files on the clipboard become its entries, nothing is copied (plan 06 3.5).
action('item.paste', { title: 'Paste', group: 'items', enabled: () => !!currentFolder() || inScrap(), run: () => {
  if (!inScrap()) return post({ op: 'paste', target: currentFolder() });
  const scrap = activeView();
  askHost({ op: 'scrapPaste' }).then(m => {
    scrap.add(m.entries);
    status(`${m.entries.length} item(s) added to ${scrap.tabTitle()}.`);
  });
} });
// What was copied, said as an action's message (app.js statusAction; and so in the Log).
function copyPaths(ids, separator) {
  post({ op: 'copyText', text: ids.join(separator) });
  statusAction(ids.length > 1 ? `Copied ${ids.length} paths: ${ids.join(', ')}` : `Copied ${ids[0]}`);
}
action('item.copyPath', { title: 'Copy path', group: 'items', enabled: onDisk,
  run: () => copyPaths(selectedIds(), '\r\n') });
// The focused item's full path; with several selected, theirs on one line, comma-separated.
// The preview active: the file it shows.
const pathsOnOneLine = () => activeView() instanceof PreviewView ? (activeView().path ? [activeView().path] : [])
  : selectedIds().length > 1 ? selectedIds() : focusedItem() ? [focusedItem().id] : [];
action('item.copyPathsLine', { title: 'Copy path (on one line)', hint: 'the focused item; several selected: comma-separated', group: 'items',
  enabled: () => pathsOnOneLine().length > 0 && pathsOnOneLine().every(id => /^[A-Za-z]:\\|^\\\\/.test(id)),
  run: () => copyPaths(pathsOnOneLine(), ', ') });
action('item.selectAll', { title: 'Select all', group: 'items', enabled: () => activeView() instanceof ListView,
  run: () => activeView().selectAll() });

// ---------- Scraps and searching (docs/plans/executed/06-PLAN-search-and-scrap.md) ----------

action('find', { title: 'Find files or folders', hint: 'a search whose results fill a scrap; in a scrap: a search in its items', group: 'scraps',
  run: () => openFind() });
action('scrap.new', { title: 'New scrap', hint: 'an empty scrap, docked at the right: drop files and folders on it', group: 'scraps',
  run: () => newScrap() });
action('scrap.add', { title: 'Add to scrap', hint: 'the selected items into a scrap (the files stay where they are)', group: 'scraps',
  enabled: () => anySelected() && !inScrap(), run: () => {
    const r = activeView().el.querySelector('.head').getBoundingClientRect();
    addToScrap(selectedIds(), r.left + 20, r.bottom);
  } });
action('scrap.clear', { title: 'Clear scrap', hint: 'every item out of the scrap; the files stay', group: 'scraps',
  enabled: () => inScrap() && activeView().all.length > 0, run: () => activeView().clear() });
action('scrap.searchAgain', { title: 'Search again', hint: "the scrap's search in the Find dialog, to change and run again", group: 'scraps',
  enabled: () => inScrap() && !!layout.pane(activePane).search, run: () => openFind({ again: activeView() }) });
action('scrap.stop', { title: 'Stop the search', group: 'scraps', enabled: () => inScrap() && activeView().searching,
  run: () => activeView().stop() });

// ---------- Folders ----------

// New folder and file (rename.js): made by Windows, then renamed in place.
action('folder.new', { title: 'New folder', hint: 'in the folder of the active pane, then its name in place', group: 'folders',
  enabled: () => !!currentFolder(), run: () => newItem('folder') });
action('file.new', { title: 'New file', hint: 'New file.txt in the folder of the active pane, then its name in place', group: 'folders',
  enabled: () => !!currentFolder(), run: () => newItem('file') });
// One item: its name in place (rename.js); more selected: the Rename dialog for them all (renamedialog.js).
// A quick access shortcut: its name in Foldex, the folder on disk keeps its own (plan 26 3.10).
const renameShortcut = () => activeView() instanceof TreeView && activeView().quickAccessShortcut();
action('item.rename', { title: 'Rename', hint: "the focused item's name in place (Enter renames, Esc cancels); with more selected, the Rename dialog; a quick access shortcut: its name in Foldex", group: 'items',
  enabled: () => !!renameShortcut() || !!focusedItem() && /^[A-Za-z]:\\|^\\\\/.test(focusedItem().id), run: () => {
    const shortcut = renameShortcut();
    if (shortcut) return renameBookmarkInPlace(activeView(), shortcut);
    const ids = selectedIds();
    if (ids.length > 1 && activeView() instanceof ListView) return openRenameMany(activeView(), ids);
    startRename(activeView(), focusedItem().id);
  } });
action('folder.up', { title: 'Up', hint: 'the folder above, through the parent pane', group: 'folders', enabled: () => !!activeView(),
  run: () => activeView().up() });
// Every drive as the drives bar has them (plan 19 3.11): on the ribbon its list under the button; from F1 or a key at
// the pane. A click goes there in the active pane.
const drivesMenu = () => drives.map(d => ({ label: d.total ? `${d.name}  (${formatSize(d.free)} free of ${formatSize(d.total)})` : d.name,
  run: () => activePane && goTo(activePane, d.id) }));
action('drives.list', { title: 'Drives', hint: 'every drive: a click goes there in the active pane', group: 'folders',
  dropDownOnly: true, dropDown: () => drivesMenu(), run: () => {
    const r = (views.get(activePane)?.body ?? document.body).getBoundingClientRect();
    openMenu(r.left, r.top, drivesMenu());
  } });
action('refresh', { title: 'Refresh', group: 'folders', enabled: () => !!activeView(), run: () => activeView().refresh() });

// ---------- Panes (docs/plans/executed/03-PLAN-connected-panes.md 3.4) ----------

action('pane.new', { title: 'New pane', hint: 'a folder tree of its own, without a parent', group: 'panes', run: () => newRootPane() });
action('pane.newChild', { title: 'New child pane', group: 'panes', enabled: () => !!activeView() && !(activeView() instanceof PreviewView),
  variants: [['right'], ['below']],
  variantTitles: { right: 'New child pane at the right', below: 'New child pane below' },
  run: params => newChildPane(activePane, params[0] ?? 'right') });
action('pane.newTab', { title: 'New tab', hint: 'this pane again as a tab: the same parent, a branch of its own', group: 'panes',
  enabled: () => !!activeView() && !(activeView() instanceof PreviewView), run: () => newTab(activePane) });
action('pane.rename', { title: 'Rename pane', hint: 'a name for the task the pane is kept for, on its head and its tab; empty: none',
  group: 'panes', enabled: () => !!activeView() && !(activeView() instanceof PreviewView), run: () => renamePane(activePane) });
action('pane.toggle', { title: 'Show or hide a pane', hint: 'hides the other child of the parent, shows a hidden one again, or makes one',
  group: 'panes', enabled: () => !!activeView(), run: () => togglePane() });
action('pane.openInOther', { title: 'Open in the other pane', hint: 'the focused folder in the next other child of the parent; with none shown, one shown again or made, as Show or hide a pane',
  group: 'panes', enabled: () => !!activeView() && !(activeView() instanceof PreviewView) && !!focusedItem()?.folder, run: () => openInOther() });
action('pane.hidden', { title: 'Hidden panes', hint: 'the panes hidden with Show or hide a pane: a click shows one again', group: 'panes',
  run: (params, ctx) => {
    const r = (ctx.el ?? views.get(activePane)?.body ?? document.body).getBoundingClientRect();
    openMenu(r.left, ctx.el ? r.bottom : r.top, hiddenPanesMenu());
  } });
action('pane.close', { title: 'Close pane', group: 'panes', enabled: () => !!activeView(), run: () => closePane(activePane) });
const isChild = () => layout.pane(activePane)?.source != null;
action('pane.detach', { title: 'Detach from parent', hint: 'the pane stops following and goes its own way', group: 'panes',
  enabled: isChild, run: () => detachPane(activePane) });
action('pane.pin', { title: 'Pin', hint: 'a child stops following its parent until unpinned; a scrap comes back (empty) after a restart', group: 'panes',
  enabled: () => isChild() || inScrap(), checked: () => !!layout.pane(activePane)?.pinned, run: () => togglePin(activePane) });
action('branch.colour', { title: 'Branch colour', hint: 'a free colour: a branch of its own; a sibling\'s: that branch',
  group: 'panes', enabled: isChild, checked: params => layout.pane(activePane)?.colour === Number(params[0]) - 1,
  variants: Branches.map(b => [String(b + 1)]),
  variantTitles: Object.fromEntries(Branches.map(b => [String(b + 1), `Branch colour ${b + 1}`])),
  run: params => params[0] && setBranchColour(activePane, Number(params[0]) - 1) });
action('history.back', { title: 'Back', hint: 'the pane with the focus a folder back; in a child its parent, which the child follows', group: 'panes',
  enabled: () => canGo(-1), run: () => goHistory(-1) });
action('history.forward', { title: 'Forward', hint: 'a folder forward again, after Back', group: 'panes',
  enabled: () => canGo(1), run: () => goHistory(1) });
action('pane.toParent', { title: 'To the parent pane', group: 'panes', enabled: isChild,
  run: () => focusPane(layout.pane(activePane).source) });
action('pane.toChild', { title: 'To the child pane', hint: 'the child in the branch shown', group: 'panes',
  enabled: () => !!activePane && layout.followers(activePane, layout.keyOf(activePane)).length > 0,
  run: () => focusPane(layout.followers(activePane, layout.keyOf(activePane))[0].id) });
action('branch.down', { title: 'Down the branch', hint: 'the next pane of the branch, from the last to the first',
  group: 'panes', enabled: () => !!activePane, run: () => alongBranch(1) });
action('branch.up', { title: 'Up the branch', hint: 'the pane before in the branch, from the first to the last',
  group: 'panes', enabled: () => !!activePane, run: () => alongBranch(-1) });
action('branch.next', { title: 'Next branch', hint: 'the next child branch of the parent', group: 'panes',
  enabled: () => !!activePane, run: () => nextBranch() });
action('pane.next', { title: 'Next pane', group: 'panes', enabled: () => views.size > 1, run: () => cyclePane(1) });
action('pane.previous', { title: 'Previous pane', group: 'panes', enabled: () => views.size > 1, run: () => cyclePane(-1) });
action('pane.toSide', { title: 'To the pane at a side', hint: 'the keyboard to the nearest pane at the left, right, above or below the active one',
  group: 'panes', enabled: () => views.size > 1, variants: [['left'], ['right'], ['up'], ['down']],
  variantTitles: { left: 'To the pane at the left', right: 'To the pane at the right', up: 'To the pane above', down: 'To the pane below' },
  run: params => toSide(params[0]) });

// ---------- View ----------

// The ribbon itself (ribbon.js; docs/plans/executed/19-PLAN-ribbon-change-mode.md 3.14).
action('ribbon.change', { title: 'Change the ribbon', hint: 'its change mode: drag actions from F1 onto it, buttons, groups and tabs around and off it; right-click a button for its size, label and more; Esc or Done ends it',
  group: 'view', checked: () => rb.changing, enabled: () => !!rb.model, run: () => rbChangeMode(!rb.changing) });
action('ribbon.customize', { title: 'Customize the ribbon...', hint: 'the ribbon\'s tabs, groups and buttons as a list beside every action: add, remove, move, large or small, labels (also by keyboard)',
  group: 'view', enabled: () => !!rb.model, run: () => rbCustomize() });
action('ribbon.reset', { title: 'Reset the ribbon', hint: 'back to the ribbon Foldex ships (your ribbon.json removed)', group: 'view', run: () => rbReset() });
action('ribbon.onDemand', { title: 'Ribbon only when wanted', hint: 'only its tab names stay; Alt, a drag down from the tab names or a click on one slides it down over the panes, and it goes away after a button',
  group: 'view', checked: () => rbWin.show === 'onDemand', run: () => rbSetWindow('show', rbWin.show === 'onDemand' ? 'always' : 'onDemand') });
action('log.toggle', { title: 'Log', hint: "a pane at the bottom with the status line's messages and the file operations",
  group: 'view', checked: () => !!logPane, run: () => toggleLog() });
action('preview.toggle', { title: 'Preview', hint: 'a preview pane showing the item of the pane with the keyboard', group: 'view',
  checked: () => !!preview, run: () => togglePreview() });
action('info.toggle', { title: 'Info', hint: 'a pane with everything known of the item of the pane with the keyboard: its image, video and sound fields, its details, the file itself',
  group: 'view', checked: () => !!infoPane, run: () => toggleInfo() });
action('preview.float', { title: 'Preview in a window', hint: 'the focused item in a new floating preview window that keeps it; F3 again opens another, to compare; Esc there closes it',
  group: 'view', enabled: () => !!activePane && !(views.get(activePane) instanceof PreviewView) && !!layout.state(activePane).focus,
  run: () => floatPreview() });
action('preview.nextViewer', { title: 'Next viewer', hint: "the preview's file in the next viewer it has (Foldex, Windows, LexPen, a lister plugin), kept for its type as the bar's drop-down keeps it",
  group: 'view', enabled: () => (previewTarget()?.viewers?.length ?? 0) > 1, run: () => previewTarget().nextViewer() });
const ownPreview = info =>layout.followers(activePane ?? '').some(f => f.kind === 'preview' && !!f.info === info);
action('preview.pane', { title: 'Pane preview', hint: 'a preview of the active pane only: its child, following its focused item', group: 'view',
  enabled: () => !!activeView() && !(activeView() instanceof PreviewView), checked: () => ownPreview(false), run: () => togglePanePreview(activePane, false) });
action('info.pane', { title: 'Pane info', hint: 'an Info pane of the active pane only: its child, following its focused item', group: 'view',
  enabled: () => !!activeView() && !(activeView() instanceof PreviewView), checked: () => ownPreview(true), run: () => togglePanePreview(activePane, true) });
action('hidden.toggle', { title: 'Hidden items', hint: 'hidden and system files and folders in the active pane (its own choice; the setting is for the others)',
  group: 'view', enabled: () => !!activePane && !(views.get(activePane) instanceof PreviewView),
  checked: () => !!activePane && showsHidden(activePane), run: () => setPaneHidden(activePane, !showsHidden(activePane)) });
// Filter sets (docs/plans/executed/32-PLAN-filter-sets.md 3.7, 3.8).
const filterable = () => !!activePane && !!views.get(activePane) && !(views.get(activePane) instanceof PreviewView) && !(views.get(activePane) instanceof PageView);
action('pane.filter', { title: 'Filter...', hint: 'the active pane\'s filter set, in Manage filters: lines on any column, and / or, brackets', group: 'view',
  enabled: filterable, run: () => openManageFilters(activePane) });
const filtersMenu = () => [
  { label: 'None', checked: !paneFilterSet(activePane), enabled: filterable(), run: () => setPaneFilter(activePane, null) },
  ...(filterSets.temp?.lines?.length ? [{ label: '(temp)', checked: !!paneFilterSet(activePane)?.temp, enabled: filterable(),
    run: () => setPaneFilter(activePane, { temp: true, lines: filterSets.temp.lines }) }] : []),
  ...filterSets.sets.map(s => ({ label: s.name, key: s.key ?? '', checked: paneFilterSet(activePane)?.name === s.name, enabled: filterable(),
    run: () => setPaneFilter(activePane, { name: s.name, lines: s.lines }) })),
  '-', { label: 'Manage filters...', run: () => openManageFilters(filterable() ? activePane : null) }];
action('filters.list', { title: 'Filters', hint: 'the kept filter sets: one chosen filters the active pane', group: 'view',
  dropDownOnly: true, dropDown: () => filtersMenu(), run: () => {
    const r = (views.get(activePane)?.body ?? document.body).getBoundingClientRect();
    openMenu(r.left, r.top, filtersMenu());
  } });
action('filters.manage', { title: 'Manage filters', hint: 'the kept filter sets: make, change, name, a key, the defaults for new panes', group: 'view',
  run: () => openManageFilters(filterable() ? activePane : null) });
// Esc in a pane: the search bar's filter emptied; without one, the pane's filter switched off (as Filter on or off does
// when it is on), and on again by the next Esc when an Esc switched it off (escapedFilters: the panes whose filter it
// did); a filter switched off another way stays off.
const escapedFilters = new Set();
action('filters.escape', { title: 'Clear the filter', hint: "the search bar's filter of the active pane emptied; with none, the pane's filter switched off; the next Esc on again",
  group: 'view', enabled: () => {
    if (!activePane) return false;
    const set = paneFilterSet(activePane);
    return paneSearch.has(activePane) || filterable() && !!set && (!set.off || escapedFilters.has(activePane));
  },
  run: () => {
    if (paneSearch.has(activePane)) {
      // As the bar's own Esc: its text gone too (a bar with the keyboard keeps what it shows), the keyboard to the pane.
      setSearch(activePane, '');
      for (const box of searchBoxes()) box.value = '';
      showSearch('');
      return views.get(activePane)?.body.focus();
    }
    const set = paneFilterSet(activePane);
    if (!set) return;
    if (set.off) escapedFilters.delete(activePane);
    else escapedFilters.add(activePane);
    togglePaneFilter(activePane);
  } });
action('filters.toggle', { title: 'Filter on or off', hint: 'the active pane\'s filter switched off (every item shown) or on again', group: 'view',
  enabled: () => filterable() && !!paneFilterSet(activePane), checked: () => !!paneFilterSet(activePane) && !paneFilterSet(activePane).off,
  run: () => {
    escapedFilters.delete(activePane);   // switched by hand: Esc no longer switches it back on
    togglePaneFilter(activePane);
  } });
// A kept set's key (Manage filters): that set on the active pane.
action('filters.apply', { title: 'Filter by a kept set', group: 'view', enabled: params => filterable() && !!keptFilter(params[0]),
  variantTitles: {}, run: params => { const s = keptFilter(params[0]); if (s) setPaneFilter(activePane, { name: s.name, lines: s.lines }); } });

// ---------- Foldex ----------

// Bookmarks (docs/plans/executed/26-PLAN-bookmarks.md; bookmarks.js): the menu (the ribbon's Bookmarks), the current folder added
// or taken off, Manage; a bookmark opened by its keys (each bookmark a variant, so F1 lists them with their keys).
// On the ribbon its list under the button (dropDownOnly, plan 19 3.11); from F1 or a key at the pane.
action('bookmarks.menu', { title: 'Bookmarks', hint: 'the bookmarks; add the current folder, add one, manage them', group: 'folders',
  dropDownOnly: true, dropDown: () => bookmarksMenu(),
  run: (params, ctx) => {
    const r = (ctx.el ?? views.get(activePane)?.body ?? document.body).getBoundingClientRect();
    openMenu(r.left, ctx.el ? r.bottom : r.top, bookmarksMenu());
  } });
action('bookmarks.add', { title: 'Add the current folder to the bookmarks', hint: 'or take it off when it is one', group: 'folders',
  enabled: () => !!currentFolder(), run: () => toggleCurrentBookmark() });
action('bookmarks.manage', { title: 'Manage the bookmarks', group: 'folders', run: () => manageBookmarks() });
const bookmarkOf = params => bookmarkById(params[0]);
action('bookmarks.open', { title: 'Open a bookmark', hint: 'in the active pane', group: 'folders',
  enabled: params => !!bookmarkOf(params), run: params => openBookmark(bookmarkOf(params)) });
action('bookmarks.openNew', { title: 'Open a bookmark in a new pane with a child pane', group: 'folders',
  enabled: params => !!bookmarkOf(params), run: params => openBookmark(bookmarkOf(params), 'newChild') });
for (const [name, how] of [['bookmarks.open', 'Open'], ['bookmarks.openNew', 'Open in a new pane with a child pane:']])
  Object.defineProperties(actions.get(name), {
    variants: { get: () => allBookmarks().map(b => [b.id]) },
    variantTitles: { get: () => Object.fromEntries(allBookmarks().map(b => [b.id, `${how} ${bookmarkName(b)}${b.quickAccess ? ' (quick access)' : ''}`])) },
  });

// Views (as xplorer2's ribbon button): in one plain menu (thumbs.js viewsMenu), the view of the active one-folder pane,
// or with a tree active, of the first one-folder pane that follows it in its active branch.
const isFolderList = id => views.get(id) instanceof ListView && !(views.get(id) instanceof ScrapView);
const viewsPane = () => !activePane ? null : isFolderList(activePane) ? activePane
  : layout.followers(activePane, layout.keyOf(activePane)).map(f => f.id).find(isFolderList) ?? null;
action('view.menu', { title: 'Views', hint: 'details, icons or thumbnails, for the active pane (a tree: the pane following it)', group: 'panes',
  enabled: () => !!viewsPane(), dropDownOnly: true, dropDown: () => viewsPane() ? viewsMenu(viewsPane()) : [], run: (params, ctx) => {
    const id = viewsPane();
    const r = (ctx.el ?? views.get(id).body).getBoundingClientRect();
    openMenu(r.left, ctx.el ? r.bottom : r.top, viewsMenu(id));
  } });
action('palette', { title: 'All actions and keys', group: 'app', run: () => openPalette() });
// Links and ownership (docs/plans/executed/31-PLAN-elevated-helper-tasks.md 3.1, 3.2; app.js makeLinkTo): a link of a kind to the
// focused item in another pane or on the clipboard; the clipboard's link source pasted; the selected items' owner the
// user. A link is the file system's own; a shortcut (.lnk) is a file of its own: never called one the other.
const LinkKinds = { symlink: 'Symbolic link', junction: 'Junction', hardlink: 'Hard link', shortcut: 'Shortcut (.lnk)' };
action('link.create', { title: 'Create link', hint: 'a link to the focused item: in another pane (several: you choose), or on the clipboard for Paste link',
  group: 'items', enabled: params => !!focusedItem() && /^[A-Za-z]:\\|^\\\\/.test(focusedItem().id) && !focusedItem().up && !!LinkKinds[params[0]],
  variants: Object.keys(LinkKinds).flatMap(k => [[k, 'pane'], [k, 'clipboard']]),
  variantTitles: Object.fromEntries(Object.entries(LinkKinds).flatMap(([k, t]) => [[`${k} pane`, `${t} in other pane`], [`${k} clipboard`, `${t} to clipboard`]])),
  run: (params, ctx) => createLink(params[0], params[1], params[2], ctx) });
action('link.paste', { title: 'Paste link', hint: 'the link on the clipboard (Create link ... to clipboard) made in the folder: its kind and item in its title',
  group: 'items', enabled: () => !!clipboardLink && !!(currentFolder()),
  get variantTitles() { return { '': typeof pasteLinkTitle === 'function' ? pasteLinkTitle() : 'Paste link' }; },
  run: params => pasteLink(params[0] ?? currentFolder()) });
action('item.takeOwnership', { title: 'Take ownership', hint: 'the selected items owned by you (the elevated helper; Windows asks the first time)',
  group: 'items', enabled: () => selectedIds().some(id => /^[A-Za-z]:\\|^\\\\/.test(id)), run: () => takeOwnership() });
action('helper.end', { title: 'End administrator rights', hint: 'the elevated helper ended now: the next task that needs it asks Windows again',
  group: 'app', enabled: () => helperRunning, run: () => post({ op: 'helperEnd' }) });
// Macros (docs/plans/executed/34-PLAN-macros.md 3.7; macros.js): one run by its id (each macro a variant, so F1 lists them with
// their folders and keys, and a ribbon button can be one), the Macros menu (the tree), Manage macros.
action('macro.run', { title: 'Run a macro', group: 'app', enabled: params => typeof macroById === 'function' && !!macroById(params[0]),
  run: params => runMacroById(params[0]) });
Object.defineProperties(actions.get('macro.run'), {
  variants: { get: () => typeof allMacros === 'function' ? allMacros().map(m => [m.id]) : [] },
  variantTitles: { get: () => typeof allMacros === 'function' ? Object.fromEntries(allMacros().map(m => [m.id, `Macro: ${macroTitle(m)}`])) : {} },
});
action('macros.menu', { title: 'Macros', hint: 'every macro, in its folders; Manage macros', group: 'app',
  dropDownOnly: true, dropDown: () => macrosMenu(), run: (params, ctx) => {
    const r = (ctx.el ?? views.get(activePane)?.body ?? document.body).getBoundingClientRect();
    openMenu(r.left, ctx.el ? r.bottom : r.top, macrosMenu());
  } });
action('macros.manage', { title: 'Manage macros', hint: 'the macros in their folders: new, edit, run, keys, icons', group: 'app',
  run: () => openOnePane('macros') });
// Projects (docs/plans/executed/15-PLAN-projects.md 3.6; projectmenu.js).
action('projects.menu', { title: 'Projects', hint: 'every project and its windows, as at the project in the bottom bar', group: 'projects',
  dropDownOnly: true, dropDown: () => projectListItems(), run: () => projectsMenu() });
action('projects.manage', { title: 'Manage projects', hint: 'every project in one list: open, close, merge, rename, delete',
  group: 'projects', run: () => openOnePane('projects') });
action('project.new', { title: 'New project', hint: 'a new project in a window of its own', group: 'projects', run: async () => {
  const name = await askText('Name of the new project', '', 'Empty: a number');
  if (name !== null) projectCommand('new', { name });
} });
action('project.rename', { title: 'Rename project', hint: 'the name of the project of this window', group: 'projects', run: () => renameProject() });
action('layout.saveDefault', { title: 'Save layout as default', group: 'projects',
  hint: 'the panes and docks of this window become the layout a new project starts with', run: () => saveLayoutAsDefault() });
action('layout.resetDefault', { title: 'Reset layout to default', group: 'projects',
  hint: 'this window back to the default layout, at the folder it shows', run: () => post({ op: 'layoutReset', path: currentFolder() }) });
// Columns (docs/plans/executed/11-PLAN-columns.md 3.4): fitted to their content; the column sets.
const activeColumns = () => { const v = views.get(activePane); return v?.fitColumns ? v : null; };   // a list or a tree
// Plan 28 3.6: Ctrl+Shift+R (columns.fit) every column; Ctrl+R (columns.fitName, its id kept for keys.json and
// ribbon.json written before) the columns whose Fit is manual or auto, the name column when every one is never.
action('columns.fit', { title: 'Fit all columns', hint: 'every column as wide as its widest value here, within its minimum and maximum; the name gives way first',
  group: 'view', enabled: () => !!activeColumns(), run: () => activeColumns().fitColumns('all') });
action('columns.fitName', { title: 'Fit columns', hint: 'the columns whose Fit is manual or auto as wide as their widest value here; the name column when none is',
  group: 'view', enabled: () => !!activeColumns(), run: () => activeColumns().fitColumns('fit') });
// Folder sizes (docs/plans/executed/37-PLAN-folder-sizes.md): counted in the host, in the Size column; the setting
// folderSizesAuto does it by itself.
action('folders.size', { title: 'Folder sizes', hint: 'the size of the folders here in the Size column, counted in the background: the focused folder first, then the selected ones, then the rest; kept while Foldex runs',
  group: 'view', enabled: () => !!activeColumns(), run: () => activeColumns().countSizes() });
action('columns.manage', { title: 'Manage column sets', hint: 'rename, delete, duplicate and edit the column sets; which folders use them',
  group: 'view', run: () => openManageSets() });
// Bars (docs/plans/executed/10-PLAN-bars.md 3.3; bars.js): added from here too, so a window without bars can get one back.
action('bars.add', { title: 'Add a bar', hint: 'a bar at the top: the path or the drives', group: 'view',
  variants: [['path'], ['drives'], ['search']], variantTitles: { path: 'Add a path bar', drives: 'Add a drives bar', search: 'Add a search bar' },
  run: params => addBar(params[0] ?? 'path') });
action('search.focus', { title: 'Search bar', hint: 'the keyboard to the search bar, which filters the active pane on what you type',
  group: 'view', run: () => focusSearch() });
action('bars.change', { title: 'Change the bars', hint: 'their change mode: drag a grip to move a bar, the border after it to size it; right-click for its menu; Esc or Done ends it',
  group: 'view', checked: () => barsChanging, run: () => changeBars(!barsChanging) });
action('bars.reset', { title: 'Reset the bars', hint: 'the bars as Foldex ships them (your bars.json removed)', group: 'view',
  run: () => askYes('Put the bars back as Foldex ships them?').then(yes => yes && post({ op: 'barsReset' })) });
// The presets (docs/plans/executed/03-PLAN-connected-panes.md 3.5; app.js applyPreset).
const Presets = { default: 'Default', dual: 'Dual', columns: 'Columns', preview: 'Preview' };
action('layout.preset', { title: 'Preset', hint: 'the panes of this window made again in a preset arrangement, at the folder shown now', group: 'projects',
  variants: Object.keys(Presets).map(p => [p]), variantTitles: Object.fromEntries(Object.entries(Presets).map(([p, t]) => [p, `Preset: ${t}`])),
  run: params => applyPreset(Presets[params[0]] ? params[0] : 'default') });
action('settings.open', { title: 'Settings', hint: 'every setting, the theme included, in a window of its own', group: 'app',
  run: () => openOnePane('settings') });
// About (as LexPen's): the project, its version and what it runs on, in a modal floating window (plan 14 3.7).
action('about', { title: 'About Foldex', hint: 'the version, what it runs on, and a coffee for its maker', group: 'app',
  run: async () => dialogWindow('About Foldex', { what: 'about', info: await askHost({ op: 'about' }) }) });
