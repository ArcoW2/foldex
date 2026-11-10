// The panes of a window and how they are connected (docs/plans/03-PLAN-connected-panes.md 3.1): no DOM, so the tests
// run it under Jint. app.js draws what this decides.
//
// A pane (a child) follows at most one other (its parent; `source` here); a pane without one is a root, as the window's
// first pane. Any pane can be closed. Each connection has a branch colour. A pane keeps a state (location, focus, selection) per colour of the connections
// leaving it ('' for a pane without followers) and shows the state of its active colour: the colour of the path down
// to the pane activated last.
'use strict';

const Branches = ['blue', 'red', 'green', 'orange', 'purple', 'teal'];

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

  // Connects a pane to a parent; false (and nothing changed) when that would make a cycle. Without a colour: the
  // parent's first child continues the parent's branch; a further child starts a new branch, in a colour not yet used
  // in the window.
  connect(id, source, colour = null) {
    if (!this.panes.has(source)) return false;
    for (let p = source; p !== null; p = this.pane(p).source) if (p === id) return false;
    const pane = this.pane(id);
    const siblings = this.followers(source).filter(f => f.id !== id);
    pane.source = source;
    pane.colour = colour ?? (siblings.length ? this.newColour() : this.pane(source).colour ?? Branches[0]);
    return true;
  }

  // A colour no connection has yet; with all taken, the one used least.
  newColour() {
    const used = [...this.panes.values()].map(p => p.colour).filter(c => c);
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
  // source, which focuses it and shows it in its tree ({ reveal }), and the followers follow. A folder in a pane without
  // a source (the root): expanded in place, as in a tree ({ expand }), and focused.
  execute(id, item) {
    if (!item.folder) return { open: item.id, updates: [] };
    const pane = this.pane(id);
    if (pane.source === null || pane.pinned) return { expand: { pane: id, item: item.id }, updates: this.focus(id, item) };
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
