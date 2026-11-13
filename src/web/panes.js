// The panes of a window and how they are connected (docs/plans/executed/03-PLAN-connected-panes.md 3.1): no DOM, so the tests
// run it under Jint. app.js draws what this decides.
//
// A pane (a child) follows at most one other (its parent; `source` here); a pane without one is a root, as the window's
// first pane. Any pane can be closed. Each connection has a branch colour: a number, the place in the theme's list of
// branch colours (docs/plans/executed/07-PLAN-themes.md 3.2). A pane keeps a state (location, focus, selection) per colour of the
// connections leaving it ('' for a pane without followers) and shows the state of its active colour: the colour of the
// path down to the pane activated last.
'use strict';

const Branches = [0, 1, 2, 3, 4, 5];   // as many as a theme's list (ThemeFile.BranchCount)
const HistoryMax = 100;                 // steps per history

// The folder a step shows: a tree's focused folder, a list's location.
const placeOf = (kind, s) => ((kind === 'tree' ? s.focus : s.location) ?? '').toLowerCase();

class Layout {
  constructor() {
    this.panes = new Map();
    this.root = null;
    this.next = 1;
  }

  // A new pane; with a source (its parent) it follows that one, in `colour` or else as connect() says. `root` is the
  // window's first pane still there.
  add({ source = null, colour = null, kind = 'list', content = 'both', location = null, columns = null } = {}) {
    const id = `p${this.next++}`;
    const pane = { id, source: null, colour: null, kind, content, pinned: false, activeKey: null, states: {} };
    if (columns) pane.columns = JSON.parse(JSON.stringify(columns));   // its own copy (plan 11 3.2)
    this.panes.set(id, pane);
    if (this.root === null) this.root = id;
    if (source !== null) this.connect(id, source, colour);
    this.state(id).location = location;
    return id;
  }

  pane(id) { return this.panes.get(id); }

  // Connects a pane to a parent; false (and nothing changed) when that would make a cycle. Without a colour: a child's
  // first child continues its branch; a root's first child and a further child start a new branch, in the colour used
  // least in the window (so the children of two roots differ).
  connect(id, source, colour = null) {
    if (!this.panes.has(source) || this.pane(id).kind === 'scrap') return false;   // a scrap is never a child (plan 06 3.1)
    for (let p = source; p !== null; p = this.pane(p).source) if (p === id) return false;
    const pane = this.pane(id);
    const siblings = this.followers(source, undefined, true).filter(f => f.id !== id);
    pane.source = source;
    pane.colour = colour ?? (siblings.length ? null : this.pane(source).colour) ?? this.newColour();
    return true;
  }

  // A child no longer follows (plan 12 3.2, Detach): it becomes a root on what it shows; its own children stay. Its
  // parent forgets the state of that branch when no other child is in it.
  detach(id) {
    const pane = this.pane(id);
    if (!pane || pane.source === null) return false;
    const parent = this.pane(pane.source), colour = pane.colour;
    pane.source = null;
    pane.colour = null;
    if (!this.followers(parent.id, colour, true).length) {
      // Its last child gone: what it showed for that branch is what it shows now, without children ('').
      if (!this.followers(parent.id, undefined, true).length) parent.states[''] = parent.states[colour] ?? parent.states[''];
      delete parent.states[colour];
      if (parent.activeKey === colour) parent.activeKey = null;
      if (parent.lastKey === colour) parent.lastKey = null;
    }
    return true;
  }

  // Connects a pane to another (Attach to): detached from its parent first; false (nothing changed) on a cycle.
  attach(id, source) {
    for (let p = source; p !== null; p = this.pane(p).source) if (p === id) return false;
    this.detach(id);
    return this.connect(id, source);
  }

  // Another branch colour for a child (Branch colour): a free one starts a new branch from the parent's state for the
  // old one; a sibling's colour joins that branch. The parent's state of the old colour goes when no child is left in
  // it. What the child shows now: [{ pane, location }] to follow, as focus() gives.
  setColour(id, colour) {
    const pane = this.pane(id);
    if (!pane || pane.source === null || pane.colour === colour) return [];
    const parent = this.pane(pane.source), old = pane.colour;
    const joins = this.followers(parent.id, colour, true).length > 0;
    const shown = this.keyOf(parent.id) === old;
    pane.colour = colour;
    const others = this.followers(parent.id, old, true).length > 0;
    if (!joins && parent.states[old]) parent.states[colour] = others ? { ...parent.states[old], selection: [...parent.states[old].selection] } : parent.states[old];
    if (!others) delete parent.states[old];
    if (shown) parent.activeKey = colour;
    if (parent.lastKey === old && !others) parent.lastKey = colour;
    const focus = parent.states[colour]?.focus;
    return focus && joins ? this.follow(parent.id, { id: focus, folder: true }).filter(u => u.pane === id) : [];
  }

  // The settings a new child of `source` starts with: those of its current child (the one in its active branch, not a
  // preview), else the defaults.
  childSettings(source) {
    const current = this.followers(source, this.keyOf(source)).find(f => f.kind !== 'preview');
    return current ? { kind: current.kind, content: current.content, ...(current.columns ? { columns: current.columns } : {}) }
      : { kind: 'list', content: 'both' };
  }

  // A colour no connection has yet; with all taken, the one used least.
  newColour() {
    const used = [...this.panes.values()].map(p => p.colour).filter(c => c !== null);
    const count = c => used.filter(u => u === c).length;
    return Branches.reduce((best, c) => count(c) < count(best) ? c : best);
  }

  // Closes a pane (any pane, 3.4): its children get its parent, in their own colours; a root's children become roots.
  remove(id) {
    if (!this.panes.has(id)) return false;
    const gone = this.pane(id);
    for (const f of this.followers(id, undefined, true)) {
      f.source = gone.source;
      if (gone.source === null) f.colour = null;
    }
    this.panes.delete(id);
    if (this.root === id) this.root = [...this.panes.values()].find(p => p.source === null)?.id ?? null;
    return true;
  }

  // The panes following `id`; with `key`, only those of that colour. A hidden pane (Ctrl+O, `away`) only with `all`: it
  // keeps its connection and its state, but follows nothing and is no step on a branch until it is shown again.
  followers(id, key, all = false) {
    return [...this.panes.values()].filter(p => p.source === id && (key === undefined || p.colour === key) && (all || !p.away));
  }

  // A pane and the panes below it (hidden ones too), the pane first.
  subtree(id) {
    const found = [id];
    for (let k = 0; k < found.length; k++) found.push(...this.followers(found[k], undefined, true).map(f => f.id));
    return found;
  }

  // The hidden panes on top of what was hidden at once (a pane hidden with its children: that pane), the last hidden first.
  hiddenTops() {
    return [...this.panes.values()].filter(p => p.away && !this.pane(p.source)?.away).sort((a, b) => b.away.at - a.away.at);
  }

  // What Ctrl+O does from a pane, as Xplorer2's: { hide: [ids] }, { show: id } or { newChild: parent, beside: id }.
  // Its children count, not a preview. A pane with children: of two or more shown it keeps the one focused last and
  // hides the others; else it shows its child hidden last; else it gets one more child (beside the one it has). A
  // child without children: its parent's other shown children hidden; else the parent's child hidden last shown; else
  // a sibling beside it. A pane without either: a child.
  toggle(id) {
    const kids = p => this.followers(p, undefined, true).filter(f => f.kind !== 'preview');
    const hidden = p => kids(p).filter(f => f.away).sort((a, b) => b.away.at - a.away.at);
    const pane = this.pane(id);
    const shown = kids(id).filter(f => !f.away);
    if (shown.length || hidden(id).length) {
      if (shown.length > 1) {
        const keep = shown.find(f => f.id === pane.lastChild) ?? shown.find(f => f.colour === this.keyOf(id)) ?? shown[0];
        return { hide: shown.filter(f => f !== keep).map(f => f.id) };
      }
      if (hidden(id).length) return { show: hidden(id)[0].id };
      return { newChild: id, beside: shown[0].id };
    }
    if (pane.source === null) return { newChild: id, beside: id };
    const siblings = kids(pane.source).filter(f => !f.away && f.id !== id);
    if (siblings.length) return { hide: siblings.map(f => f.id) };
    if (hidden(pane.source).length) return { show: hidden(pane.source)[0].id };
    return { newChild: pane.source, beside: id };
  }

  // The colour a pane is drawn in: that of the end of the path it serves, down the branch each pane shows (not into a
  // preview), so a parent takes its active descendant's colour; a pane without followers its own (a root: the first
  // branch, 0).
  pathColour(id) {
    let p = this.pane(id);
    for (;;) {
      const next = this.followers(p.id, this.keyOf(p.id)).find(f => f.kind !== 'preview');
      if (!next) return p.colour ?? 0;   // a root without children: the first branch (plan 13 3.4)
      p = next;
    }
  }

  // The colour whose state a pane shows: the one made active last, else that of its first follower, else ''.
  keyOf(id) {
    const pane = this.pane(id);
    const colours = this.followers(id).map(f => f.colour);
    if (pane.activeKey !== null && colours.includes(pane.activeKey)) return pane.activeKey;
    return colours[0] ?? '';
  }

  // The state a pane shows now; a colour it has no state for yet starts as a copy of the one it showed before.
  state(id) {
    const pane = this.pane(id);
    const key = this.keyOf(id);
    if (!pane.states[key]) {
      const before = pane.states[pane.lastKey ?? ''] ?? Object.values(pane.states)[0];
      pane.states[key] = before ? { ...before, selection: [...before.selection] } : { location: null, focus: null, selection: [] };
    }
    pane.lastKey = key;
    return pane.states[key];
  }

  // A pane activated (a click in it): every pane above it shows the state of the colour leading down to it. The panes
  // whose colour changed, to be drawn again with their state.
  activate(id) {
    const changed = [];
    for (let c = id, p = this.pane(id).source; p !== null; c = p, p = this.pane(p).source) {
      const key = this.pane(c).colour;
      this.pane(p).lastChild = c;   // for Ctrl+O (toggle): the child a parent keeps
      if (this.keyOf(p) !== key) {
        this.pane(p).activeKey = key;
        changed.push(p);
      } else {
        this.pane(p).activeKey = key;
      }
      this.state(p);
    }
    return changed;
  }

  // The item focused in a pane ({ id, folder } or null). What its followers in the active colour show now:
  // [{ pane, location }] for those that list a folder, [{ pane, show }] for a preview.
  focus(id, item) {
    const state = this.state(id);
    state.focus = item ? item.id : null;
    return this.follow(id, item);
  }

  follow(id, item) {
    const updates = [];
    // After Back or Forward (go): a follower gets back what it had selected in that folder, and passes that on.
    const recall = this.pane(id).recall;
    delete this.pane(id).recall;
    for (const f of this.followers(id, this.keyOf(id))) {
      if (f.pinned) continue;
      if (f.kind === 'preview') {
        updates.push({ pane: f.id, show: item ? item.id : null });
      } else if (item && item.folder) {
        const s = this.state(f.id);
        if ((s.location ?? '').toLowerCase() === item.id.toLowerCase()) continue;   // the same folder, whatever case Windows gives it
        s.location = item.id;
        s.focus = null;
        s.selection = [];
        const was = recall ? this.lastStepIn(f.id, item.id) : null;
        if (was) {
          s.focus = was.focus;
          s.selection = [...was.selection];
          f.recall = true;
        }
        updates.push(was ? { pane: f.id, location: item.id, recalled: true } : { pane: f.id, location: item.id });
        // Nothing is focused in the follower now: its own followers stay as they are, a preview empties.
        for (const g of this.followers(f.id, this.keyOf(f.id)))
          if (g.kind === 'preview' && !g.pinned) updates.push({ pane: g.id, show: null });
      }
    }
    return updates;
  }

  // Whether a pane goes its own way: without a parent, pinned, or a child of a scrap, which has no folder to open one
  // in (docs/plans/executed/06-PLAN-search-and-scrap.md 3.1).
  ownWay(id) {
    const pane = this.pane(id);
    return pane.source === null || pane.pinned || this.pane(pane.source)?.kind === 'scrap';
  }

  // Executing an item (double-click, Enter; 3.3). A file: { open }. A folder in a pane with a source: opened by that
  // source, which focuses it and shows it in its tree ({ reveal }), and the followers follow. A folder in a tree without
  // a source (or pinned): expanded in place ({ expand }) and focused; in a list without one: opened in that list
  // ({ reveal } of the list itself; plan 12 3.3).
  execute(id, item) {
    if (!item.folder) return { open: item.id, updates: [] };
    const pane = this.pane(id);
    if (this.ownWay(id)) {
      if (pane.kind === 'tree') return { expand: { pane: id, item: item.id }, updates: this.focus(id, item) };
      return { reveal: { pane: id, item: item.id }, updates: [] };
    }
    return { reveal: { pane: pane.source, item: item.id }, updates: this.focus(pane.source, item) };
  }

  // ---------- History per pane (docs/plans/executed/17-PLAN-history-per-pane.md) ----------

  // A pane's history for the branch it shows now: { steps: [{ location, focus, selection }], at }. Kept on the pane, so
  // it goes with the layout into the project.
  history(id) {
    const pane = this.pane(id);
    pane.histories ??= {};
    return pane.histories[this.keyOf(id)] ??= { steps: [], at: -1 };
  }

  // The pane's state now into its history: a new step when the folder it shows changed (whatever changed it: a click,
  // a typed path, its parent), else the current step updated (a selection made there is kept with it). A new step
  // after going back drops the steps ahead. True when a step was added.
  record(id) {
    const pane = this.pane(id);
    if (!pane || pane.kind === 'preview') return false;
    const s = this.state(id), h = this.history(id);
    const step = { location: s.location, focus: s.focus, selection: [...s.selection] };
    const place = placeOf(pane.kind, step);
    if (!place) return false;
    if (h.at >= 0 && placeOf(pane.kind, h.steps[h.at]) === place) {
      h.steps[h.at] = step;
      return false;
    }
    h.steps.splice(h.at + 1, Infinity, step);
    if (h.steps.length > HistoryMax) h.steps.shift();
    h.at = h.steps.length - 1;
    return true;
  }

  // Whose history Back and Forward use from a pane: its own without a parent, while pinned or below a scrap (ownWay);
  // in a child that follows, its parent's, up to the first pane that goes its own way.
  historyPane(id) {
    let p = id;
    while (!this.ownWay(p)) p = this.pane(p).source;
    return p;
  }

  canGo(id, step) {
    const h = this.history(this.historyPane(id));
    return h.at + step >= 0 && h.at + step < h.steps.length;
  }

  // One step back (-1) or forward (1) from a pane: the history pane's state set to that step, which is no new step.
  // The pane whose state changed, or null.
  go(id, step) {
    if (!this.canGo(id, step)) return null;
    const p = this.historyPane(id), h = this.history(p);
    h.at += step;
    const to = h.steps[h.at];
    Object.assign(this.state(p), { location: to.location, focus: to.focus, selection: [...to.selection] });
    this.pane(p).recall = true;
    return p;
  }

  // The last step of a pane's history in a folder, or null.
  lastStepIn(id, folder) {
    const steps = this.history(id).steps, kind = this.pane(id).kind;
    for (let i = steps.length - 1; i >= 0; i--) if (placeOf(kind, steps[i]) === folder.toLowerCase()) return steps[i];
    return null;
  }

  // What is kept with the project (3.7).
  toJSON() {
    return { root: this.root, next: this.next, panes: [...this.panes.values()] };
  }

  static fromJSON(o) {
    const layout = new Layout();
    layout.root = o.root;
    layout.next = o.next;
    for (const p of o.panes) layout.panes.set(p.id, p);
    return layout;
  }
}

// The tree lines of rows in a tree (docs/plans/16-PLAN-tree-look.md 3.2), from their depths in the order shown: per row,
// per level above it, 'pass' (an ancestor's line goes on below), 'mid' (its own joint, more siblings below), 'end' (its
// own joint, the last child) or '' (an ancestor's line has ended); and down: an open node whose children follow.
function treeGuides(depths) {
  // The line of level k (an ancestor at depth k) goes on below row i when a later row at depth k + 1 comes before one
  // at depth k or less. One pass from the bottom up keeps that per level for the rows below (a tree of many thousand
  // rows must not take a look ahead per row and level).
  const goesOn = [];
  const guides = new Array(depths.length);
  for (let i = depths.length - 1; i >= 0; i--) {
    const d = depths[i];
    guides[i] = {
      levels: Array.from({ length: d }, (_, k) => k === d - 1 ? (goesOn[k] ? 'mid' : 'end') : goesOn[k] ? 'pass' : ''),
      down: (depths[i + 1] ?? -1) > d,
    };
    // This row ends the lines of its own level and deeper for the rows above it, and carries on its parent's.
    goesOn.length = Math.min(goesOn.length, d);
    if (d > 0) goesOn[d - 1] = true;
  }
  return guides;
}

// The pieces of line of one row (treeGuides) as elements: level k at `x(k)` px, its joint `joint` px long; a row that
// is positioned (relative or absolute) holds them. Shown as the setting treeLines says (app.css).
function guideElements({ levels, down }, x, joint) {
  const pieces = levels.map((kind, k) => kind && Object.assign(document.createElement('span'),
    { className: `guide ${kind}`, style: `left: ${x(k)}px; width: ${joint}px` })).filter(Boolean);
  if (down) pieces.push(Object.assign(document.createElement('span'), { className: 'guide down', style: `left: ${x(levels.length)}px` }));
  return pieces;
}
