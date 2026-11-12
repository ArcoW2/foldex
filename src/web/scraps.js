'use strict';
// Scraps (docs/plans/executed/06-PLAN-search-and-scrap.md): what a scrap holds and keeps, without the DOM, so the tests run it
// under Jint. app.js draws a scrap (ScrapView), find.js asks for a search.

const ScrapSides = ['left', 'right', 'top', 'bottom'];   // a scrap in one of these areas is docked (3.2)

const lower = id => id.toLowerCase();

// Entries added to a scrap's (3.2): each item once (by its id, case not counting), in the scrap's own order.
function scrapMerge(have, add, compare = null) {
  const seen = new Set(have.map(x => lower(x.id)));
  const out = [...have];
  for (const x of add) {
    if (seen.has(lower(x.id))) continue;
    seen.add(lower(x.id));
    out.push(x);
  }
  return compare ? out.sort(compare) : out;
}

// A scrap's ids after items moved or were renamed ([old, new], 3.1): the item itself, or an item inside a folder that
// moved.
function scrapFollow(ids, moved) {
  return ids.map(id => {
    for (const [from, to] of moved) {
      if (lower(id) === lower(from)) return to;
      const base = from.replace(/\\+$/, '') + '\\';
      if (lower(id).startsWith(lower(base))) return to.replace(/\\+$/, '') + '\\' + id.slice(base.length);
    }
    return id;
  });
}

// A name no other scrap has (3.1): the one wanted, else with (2), (3), ...
function scrapName(wanted, taken) {
  const used = new Set(taken.map(lower));
  if (!used.has(lower(wanted))) return wanted;
  for (let n = 2; ; n++) if (!used.has(lower(`${wanted} (${n})`))) return `${wanted} (${n})`;
}

// The name of a scrap opened empty: Scrap 1, Scrap 2, ... the first one free.
function newScrapName(taken) {
  const used = new Set(taken.map(lower));
  for (let n = 1; ; n++) if (!used.has(`scrap ${n}`)) return `Scrap ${n}`;
}

// The folder an item is in; for a drive, the drive.
function folderOf(id) {
  const parent = id.replace(/\\+$/, '').replace(/\\[^\\]*$/, '');
  return /^[A-Za-z]:$/.test(parent) ? parent + '\\' : parent;
}

// Whether items are all in one folder: then Explorer's own menu works for them (3.5).
function oneFolder(ids) {
  return ids.length > 0 && ids.every(id => lower(folderOf(id)) === lower(folderOf(ids[0])));
}

// A saved layout opened by another run of Foldex (it started again since, 3.2): the scraps in the panes go, a docked
// one stays, empty. `panes`: the layout's panes; `areaOf(id)`: where the docks have a pane.
function scrapsAfterRestart(panes, areaOf) {
  const scraps = panes.filter(p => p.kind === 'scrap');
  return {
    remove: scraps.filter(p => !ScrapSides.includes(areaOf(p.id))).map(p => p.id),
    empty: scraps.filter(p => ScrapSides.includes(areaOf(p.id))).map(p => p.id),
  };
}

// The Find dialog's fields as they start (3.3).
const SearchDefaults = { lookIn: '', subfolders: true, depthFirst: true, useIndex: true, files: true, folders: true,
  regex: false, fuzzy: 100, named: '' };
