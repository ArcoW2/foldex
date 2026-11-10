// Where the panes of a window are (docs/plans/12-PLAN-docking-and-pane-menu.md 3.1): no DOM, so the tests run it under
// Jint; app.js draws what this decides. Where a pane docks has nothing to do with its connections (panes.js).
//
// Five areas: left, right, top, bottom and center. An area holds one node or nothing. A node is a group (panes as
// tabs, one of them shown) or a split (nodes side by side, 'row', or above each other, 'column', each with its share).
'use strict';

const DockAreas = ['left', 'right', 'top', 'bottom', 'center'];
const DockSides = ['left', 'right', 'top', 'bottom'];

class Docks {
  constructor() {
    this.areas = { left: null, right: null, top: null, bottom: null, center: null };
    this.sizes = { left: 280, right: 280, top: 200, bottom: 200 };   // px of the side areas
  }

  static group(id) { return { type: 'group', panes: [id], shown: id }; }

  // Every group, with where it is: [{ group, area, parent (a split or null), index }].
  groups() {
    const found = [];
    const walk = (node, area, parent, index) => {
      if (!node) return;
      if (node.type === 'group') found.push({ group: node, area, parent, index });
      else node.children.forEach((c, k) => walk(c, area, node, k));
    };
    for (const area of DockAreas) walk(this.areas[area], area, null, 0);
    return found;
  }

  find(id) { return this.groups().find(g => g.group.panes.includes(id)) ?? null; }

  areaOf(id) { return this.find(id)?.area ?? null; }

  // A pane placed: { area } (in that area: alone when empty, else beside what is there: below in the left and right
  // areas, at the right in the others) or { pane, side } (beside that pane's group: 'left', 'right', 'top', 'bottom',
  // or 'tab' in it). A pane already docked is moved.
  add(id, place) {
    if (this.find(id)) this.remove(id);
    const target = place.pane != null ? this.find(place.pane) : null;
    if (target && place.side === 'tab') {
      target.group.panes.splice(target.group.panes.indexOf(place.pane) + 1, 0, id);
      target.group.shown = id;
      return;
    }
    if (target) return this.beside(target, Docks.group(id), place.side);
    const area = DockAreas.includes(place.area) ? place.area : 'center';
    const there = this.areas[area];
    if (!there) {
      this.areas[area] = Docks.group(id);
      return;
    }
    const dir = area === 'left' || area === 'right' ? 'column' : 'row';
    if (there.type === 'split' && there.dir === dir) {
      there.children.push(Docks.group(id));
      there.shares = there.children.map(() => 1);
    } else this.areas[area] = { type: 'split', dir, children: [there, Docks.group(id)], shares: [1, 1] };
  }

  // A node put beside a group: in its split when that runs the same way, else a new split in the group's place.
  beside(target, node, side) {
    const dir = side === 'left' || side === 'right' ? 'row' : 'column';
    const after = side === 'right' || side === 'bottom';
    const { group, area, parent, index } = target;
    if (parent && parent.dir === dir) {
      parent.children.splice(index + (after ? 1 : 0), 0, node);
      parent.shares.splice(index + (after ? 1 : 0), 0, parent.shares[index] ?? 1);
      return;
    }
    const split = { type: 'split', dir, children: after ? [group, node] : [node, group], shares: [1, 1] };
    if (parent) parent.children[index] = split;
    else this.areas[area] = split;
  }

  // A pane taken out: its group shows the next tab; an empty group goes, and a split left with one node is replaced by
  // it, so an empty area is empty again.
  remove(id) {
    const at = this.find(id);
    if (!at) return false;
    const { group } = at;
    const k = group.panes.indexOf(id);
    group.panes.splice(k, 1);
    if (group.shown === id) group.shown = group.panes[Math.min(k, group.panes.length - 1)] ?? null;
    if (group.panes.length) return true;
    this.prune(at);
    return true;
  }

  prune({ area, parent, index }) {
    if (!parent) {
      this.areas[area] = null;
      return;
    }
    parent.children.splice(index, 1);
    parent.shares.splice(index, 1);
    if (parent.children.length > 1) return;
    // A split of one: that one in its place.
    const only = parent.children[0];
    const owner = this.ownerOf(parent);
    if (owner.split) owner.split.children[owner.index] = only;
    else this.areas[owner.area] = only;
  }

  // Where a split is: its parent split and index, or the area it is the top of.
  ownerOf(node) {
    for (const area of DockAreas) {
      if (this.areas[area] === node) return { area };
      const walk = split => {
        if (!split || split.type !== 'split') return null;
        for (let k = 0; k < split.children.length; k++) {
          if (split.children[k] === node) return { split, index: k };
          const deeper = walk(split.children[k]);
          if (deeper) return deeper;
        }
        return null;
      };
      const found = walk(this.areas[area]);
      if (found) return found;
    }
    return {};
  }

  // A tab shown (a click on it, or its pane activated).
  show(id) {
    const at = this.find(id);
    if (at) at.group.shown = id;
  }

  // Is the pane on screen (alone, or the shown tab of its group)?
  visible(id) { return this.find(id)?.group.shown === id; }

  panes() { return this.groups().flatMap(g => g.group.panes); }

  toJSON() { return { areas: this.areas, sizes: this.sizes }; }

  static fromJSON(o) {
    const d = new Docks();
    for (const area of DockAreas) d.areas[area] = o?.areas?.[area] ?? null;
    Object.assign(d.sizes, o?.sizes ?? {});
    return d;
  }
}
