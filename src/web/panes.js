// The panes of a window and how they are connected (docs/plans/03-PLAN-connected-panes.md 3.1): no DOM, so the tests
// run it under Jint. app.js draws what this decides.
//
// A pane (a child) follows at most one other (its parent; `source` here); a pane without one is a root, as the window's
// first pane. Any pane can be closed. Each connection has a branch colour: a number, the place in the theme's list of
// branch colours (docs/plans/07-PLAN-themes.md 3.2). A pane keeps a state (location, focus, selection) per colour of the
// connections leaving it ('' for a pane without followers) and shows the state of its active colour: the colour of the
// path down to the pane activated last.
'use strict';

const Branches = [0, 1, 2, 3, 4, 5];   // as many as a theme's list (ThemeFile.BranchCount)

class Layout {
  constructor() {
    this.panes = new Map();
    this.root = null;
    this.next = 1;
  }

  // A new pane; with a source (its parent) it follows that one, in `colour` or else as connect() says. `root` is the
  // window's first pane still there.
  add({ source = null, colour = null, kind = 'list', content = 'both', location = null } = {}) {
    const id = `p${this.next++}`;
    const pane = { id, source: null, colour: null, kind, content, pinned: false, activeKey: null, states: {} };
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
    if (!this.panes.has(source)) return false;
    for (let p = source; p !== null; p = this.pane(p).source) if (p === id) return false;
    const pane = this.pane(id);
    const siblings = this.followers(source).filter(f => f.id !== id);
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
    if (!this.followers(parent.id, colour).length) {
      // Its last child gone: what it showed for that branch is what it shows now, without children ('').
      if (!this.followers(parent.id).length) parent.states[''] = parent.states[colour] ?? parent.states[''];
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
    const joins = this.followers(parent.id, colour).length > 0;
    const shown = this.keyOf(parent.id) === old;
    pane.colour = colour;
    const others = this.followers(parent.id, old).length > 0;
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
    return current ? { kind: current.kind, content: current.content } : { kind: 'list', content: 'both' };
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
    for (const f of this.followers(id)) {
      f.source = gone.source;
      if (gone.source === null) f.colour = null;
    }
    this.panes.delete(id);
    if (this.root === id) this.root = [...this.panes.values()].find(p => p.source === null)?.id ?? null;
    return true;
  }

  // The panes following `id`; with `key`, only those of that colour.
  followers(id, key) {
    return [...this.panes.values()].filter(p => p.source === id && (key === undefined || p.colour === key));
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
    for (const f of this.followers(id, this.keyOf(id))) {
      if (f.pinned) continue;
      if (f.kind === 'preview') {
        updates.push({ pane: f.id, show: item ? item.id : null });
      } else if (item && item.folder) {
        const s = this.state(f.id);
        if (s.location === item.id) continue;
        s.location = item.id;
        s.focus = null;
        s.selection = [];
        updates.push({ pane: f.id, location: item.id });
        // Nothing is focused in the follower now: its own followers stay as they are, a preview empties.
        for (const g of this.followers(f.id, this.keyOf(f.id)))
          if (g.kind === 'preview' && !g.pinned) updates.push({ pane: g.id, show: null });
      }
    }
    return updates;
  }

  // Executing an item (double-click, Enter; 3.3). A file: { open }. A folder in a pane with a source: opened by that
  // source, which focuses it and shows it in its tree ({ reveal }), and the followers follow. A folder in a tree without
  // a source (or pinned): expanded in place ({ expand }) and focused; in a list without one: opened in that list
  // ({ reveal } of the list itself; plan 12 3.3).
  execute(id, item) {
    if (!item.folder) return { open: item.id, updates: [] };
    const pane = this.pane(id);
    if (pane.source === null || pane.pinned) {
      if (pane.kind === 'tree') return { expand: { pane: id, item: item.id }, updates: this.focus(id, item) };
      return { reveal: { pane: id, item: item.id }, updates: [] };
    }
    return { reveal: { pane: pane.source, item: item.id }, updates: this.focus(pane.source, item) };
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
