'use strict';
// Filter sets (docs/plans/executed/32-PLAN-filter-sets.md): a set of lines, each testing one field of an item (any
// column, by its kind's conditions) for folders, files or both; lines joined by and / or, grouped by brackets, a line
// an exception (not). The rules without a page: the tests run this file under Jint; app.js applies a set to a pane,
// filterspane.js edits one.
//
// A set: { name (when kept), temp (the temporary filter: true), lines: [line], off (switched off in its pane) }.
// A line: { join: 'and' | 'or' (the first line's is not used), open, close (brackets before and after it, counts),
//   not, folders, files (checks), field (a column's id), cond, orEmpty }.
// A cond by the field's kind (filterKind):
//   text:  { op: 'wild' | 'regex' | 'contains' | 'is' | 'has' | 'none', text }
//   size, number: { op: 'range' | 'is' | 'has' | 'none', from, to, value }
//          (numbers; a size in bytes; from or to null: no limit at that end)
//   date:  { op: 'range' | 'on' | 'has' | 'none', from, to, day }
//          (from, to: { abs: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' } or { rel: n, unit: 'minutes' ... 'years', ahead }: n
//          units ago, or from now when ahead; null: no limit at that end. day: { abs: 'YYYY-MM-DD' } or { rel: n days,
//          ahead }; 0 days: today)
//   bool:  { op: 'true' | 'false' | 'has' | 'none' }
//   attrs: { op: 'attrs', attrs: { R: 'has' | 'not', ... } }   (a letter of the Attributes column: R H S A C E L O)
//   list:  { op: 'in' | 'has' | 'none', values: [...] }       (Git status: its words)
//   flag:  { op: 'has' | 'none' }                             (GPS)

// The attributes as the Attributes column writes them (ShellListing.Attributes), with their names.
const FilterAttributes = [['R', 'Read-only'], ['H', 'Hidden'], ['S', 'System'], ['A', 'Archive'], ['C', 'Compressed'],
  ['E', 'Encrypted'], ['L', 'Link'], ['O', 'Offline']];
const FilterUnits = { minutes: 60e3, hours: 3600e3, days: 86400e3, weeks: 7 * 86400e3 };
// Fields read per item after the listing (Windows' properties, the Git status, GPS, a file's contents): slow in a large
// folder; Contents slower than any (docs/plans/executed/20-PLAN-extended-search.md 3.2).
const slowField = id => id.includes('.') || id === 'git' || id === 'gps' || id === 'gpsLocation' || id === 'contents';
// Their mark in a list of fields or columns: a tortoise, on the 16-unit grid of the ribbon's icons, stroked in the text
// colour (app.css .fl-slow).
const TortoiseSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 10.5a5.5 4.6 0 0 1 11 0zM5.5 6.3l2 2 2-2M7.5 8.3v2.2M4 10.5v2M11 10.5v2M2 10.5l-1.2 1"/><circle cx="14" cy="8.7" r="1.3"/></svg>';
// Fields only a drive has.
const DriveFields = new Set(['total', 'free']);

// The kind of a field for its conditions, from its column's kind (columns.js columnInfo; Windows' properties: text,
// number, date, bool).
function filterKind(id, columnKind) {
  if (id === 'contents') return 'contents';
  if (id === 'attributes') return 'attrs';
  if (id === 'git') return 'list';
  if (id === 'gps') return 'flag';
  if (columnKind === 'size') return 'size';
  if (['number', 'date', 'bool'].includes(columnKind)) return columnKind;
  return 'text';
}

// A new line: And, files and folders, the name matching wildcards (none yet).
const newFilterLine = (join = 'and') => ({ join, open: 0, close: 0, not: false, folders: true, files: true, field: 'name',
  cond: { op: 'wild', text: '' }, orEmpty: false });
// The set of a filter of before plan 32 (wildcards for files, every folder shown): "Folders" Or "Files, Name matches"
// them.
const filterOfPattern = pattern => ({ lines: [{ ...newFilterLine(), files: false, cond: { op: 'has' } },
  { ...newFilterLine('or'), folders: false, cond: { op: 'wild', text: pattern } }] });

// Wildcards (`*.cs;*.md`) as one test of a name; empty: none (null).
function wildTest(text) {
  const parts = (text ?? '').split(/[;,]/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const res = parts.map(p => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'));
  return name => res.some(re => re.test(name));
}

// A day as the ms of its start: an absolute one ('YYYY-MM-DD'), or relative to today (n days ago, or from now when
// ahead; 0: today); null: none.
function filterDay(d, now) {
  if (!d) return null;
  if (d.rel != null) {
    const t = new Date(now);
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + (Number(d.rel) || 0) * (d.ahead ? 1 : -1));
    return t.getTime();
  }
  return filterDate({ abs: (d.abs ?? '').slice(0, 10) }, false, now);
}

// A date of a range as ms: an absolute one (a day without a time: its start for `from`, its end for `to`) or one
// relative to now: n units ago, or from now (ahead); null: no limit.
function filterDate(d, end, now) {
  if (!d) return null;
  if (d.rel != null) {
    const n = (Number(d.rel) || 0) * (d.ahead ? -1 : 1);
    if (d.unit === 'months' || d.unit === 'years') {
      const t = new Date(now);
      if (d.unit === 'months') t.setMonth(t.getMonth() - n); else t.setFullYear(t.getFullYear() - n);
      return t.getTime();
    }
    return now - n * (FilterUnits[d.unit] ?? FilterUnits.days);
  }
  if (!d.abs) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(d.abs);
  if (!m) return null;
  const [, y, mo, da, h, mi] = m;
  if (h != null) return new Date(+y, mo - 1, +da, +h, +mi, end ? 59 : 0, end ? 999 : 0).getTime();
  return end ? new Date(+y, mo - 1, +da, 23, 59, 59, 999).getTime() : new Date(+y, mo - 1, +da).getTime();
}

// An item's value of a field for a filter: { applies: false } (the field is not an item's of this sort: a drive's for
// a file, one a folder has no value for), { wait: true } (a value not read yet), or { value } (null: none). `kind`: the
// field's filter kind.
function filterValue(x, id, kind) {
  let v;
  // Windows' properties are read for files (app.js askProps): a folder has none of them.
  if (x.folder && (id.includes('.') || id === 'gps' || id === 'gpsLocation') && !(x.props && id in x.props)) return { applies: false };
  if (id.includes('.')) {
    if (!x.props || !(id in x.props)) return { wait: true };
    const p = x.props[id];
    v = p == null ? null : kind === 'text' ? p[0] : kind === 'bool' ? (p[1] != null ? !!p[1] : p[0] ?? null) : p[1] ?? null;
  } else if (id === 'git') {
    if (x.git === undefined) return { wait: true };
    v = x.git ? GitWordsOf(x.git) : null;
  } else if (id === 'gps' || id === 'gpsLocation') {
    if (!x.props || !('System.GPS.LatitudeDecimal' in x.props)) return { wait: true };
    v = x.props['System.GPS.LatitudeDecimal'] ? true : null;
  } else v = x[id];
  if (v === undefined || v === '') v = null;
  if (DriveFields.has(id) && v == null) return { applies: false };
  if (x.folder && v == null && id !== 'name' && id !== 'git' && id !== 'attributes') return { applies: false };
  return { value: v };
}
// Git's letters as the column's words (columns.js GitWords), here without the page.
const GitWordsOf = s => ({ M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', U: 'Untracked', I: 'Ignored', '!': 'Conflict' })[s] ?? s;

// One line's test of an item: true, false, null (left out: its field is not the item's) or 'wait' (a value not read
// yet). `kindOf(field)`: the field's filter kind. Throws on a regex that is no regex (the set's check says so first).
function filterLine(line, x, kindOf, now) {
  if (x.folder ? !line.folders : !line.files) return line.not ? true : false;
  const kind = kindOf(line.field), c = line.cond ?? {};
  // Contents (plan 20 3.2): whether the file holds the text, as the host found it (x.contents, by the condition's key);
  // a folder has none: the line left out.
  if (line.field === 'contents') {
    if (x.folder) return null;
    const v = x.contents?.[filterContentsKey(c)];
    if (v === undefined) return 'wait';
    return line.not ? !v : v;
  }
  const got = filterValue(x, line.field, kind);
  if (got.wait) return 'wait';
  if (got.applies === false) return null;
  const v = got.value;
  let pass;
  if (c.op === 'has') pass = v != null;
  else if (c.op === 'none') pass = v == null;
  else if (v == null) pass = !!line.orEmpty;
  else pass = filterCond(kind, c, v, now);
  return line.not ? !pass : pass;
}

// A condition on a value there is.
function filterCond(kind, c, v, now) {
  switch (kind) {
    case 'text': {
      const s = String(v), t = c.text ?? '';
      if (c.op === 'wild') return wildTest(t)?.(s) ?? true;
      if (c.op === 'regex') return t ? new RegExp(t, 'i').test(s) : true;
      if (c.op === 'contains') return s.toLowerCase().includes(t.toLowerCase());
      if (c.op === 'is') return s.toLowerCase() === t.toLowerCase();
      return true;
    }
    case 'size': case 'number': {
      const n = Number(v);
      if (c.op === 'is') return c.value != null && c.value !== '' && n === Number(c.value);
      return (c.from == null || c.from === '' || n >= Number(c.from)) && (c.to == null || c.to === '' || n <= Number(c.to));
    }
    case 'date': {
      if (c.op === 'on') {   // on a day: from its start to its end
        const day = filterDay(c.day, now);
        return day != null && v >= day && v < new Date(new Date(day).setDate(new Date(day).getDate() + 1)).getTime();
      }
      const from = filterDate(c.from, false, now), to = filterDate(c.to, true, now);
      return (from == null || v >= from) && (to == null || v <= to);
    }
    case 'bool': return c.op === 'true' ? v === true || /^(yes|true|1|ja|oui|si|-1)$/i.test(String(v)) : !(v === true || /^(yes|true|1|ja|oui|si|-1)$/i.test(String(v)));
    case 'attrs': {
      const letters = String(v);
      return Object.entries(c.attrs ?? {}).every(([a, want]) => want === 'has' ? letters.includes(a) : want === 'not' ? !letters.includes(a) : true);
    }
    case 'list': return !(c.values ?? []).length || (c.values ?? []).some(w => String(w).toLowerCase() === String(v).toLowerCase());
    default: return true;
  }
}

// What is wrong with a set, or null: brackets that do not match, a regex that is no regex.
function filterProblem(set) {
  let depth = 0;
  for (const [k, line] of (set?.lines ?? []).entries()) {
    depth += line.open || 0;
    depth -= line.close || 0;
    if (depth < 0) return `Line ${k + 1} closes a bracket that was not opened.`;
    if (line.cond?.op === 'regex' && line.cond.text) {
      try { new RegExp(line.cond.text); } catch (e) { return `Line ${k + 1}: ${e.message}`; }
    }
  }
  return depth ? `${depth} bracket${depth > 1 ? 's are' : ' is'} not closed.` : null;
}

// A set as a test of items: x => true (shown), false (not), or 'wait' (a value not read yet: not shown until it is).
// No lines, switched off, or a problem: every item. Worked out as usual: Not on its line, And before Or, brackets
// first; a line left out for an item (null) as if it were not there.
function filterTestOf(set, kindOf, now = Date.now()) {
  const lines = set?.lines ?? [];
  if (!lines.length || set.off || filterProblem(set)) return () => true;
  return x => {
    const values = lines.map(line => filterLine(line, x, kindOf, now));
    if (values.includes('wait')) return 'wait';
    // Tokens: brackets, values, and / or; parsed as or of ands.
    const tokens = [];
    lines.forEach((line, k) => {
      if (k) tokens.push(line.join === 'or' ? 'or' : 'and');
      for (let i = 0; i < (line.open || 0); i++) tokens.push('(');
      tokens.push({ v: values[k] });
      for (let i = 0; i < (line.close || 0); i++) tokens.push(')');
    });
    let at = 0;
    // A value: true, false or null (left out); and / or with a left-out side give the other side.
    const both = (a, b, op) => a === null ? b : b === null ? a : op === 'and' ? a && b : a || b;
    const primary = () => {
      const t = tokens[at++];
      if (t === '(') { const v = orExpr(); at++; return v; }
      return t?.v ?? null;
    };
    const andExpr = () => { let v = primary(); while (tokens[at] === 'and') { at++; v = both(v, primary(), 'and'); } return v; };
    const orExpr = () => { let v = andExpr(); while (tokens[at] === 'or') { at++; v = both(v, andExpr(), 'or'); } return v; };
    const v = orExpr();
    return v === null ? true : v;
  };
}

// The regular expression a text is searched with in a file (Find's Containing text and a Contents line; plan 20 3.1),
// built here as LexPen's page builds its FolderSearch's, so the host (.NET) and the preview's find bar (JavaScript)
// agree on what matches; null: no text. `mode`: "normal" (a filter's wildcards: * any run, ? one character, ; between
// alternatives; within one line), "verbatim" (every character itself) or "regex". `word`: whole words only.
function filterTextPattern(text, mode = 'normal', word = false) {
  if (!text) return null;
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let body;
  if (mode === 'regex') body = text;
  else if (mode === 'verbatim') body = escape(text);
  else {
    const parts = text.split(';').filter(p => p !== '');
    if (!parts.length) return null;
    body = parts.map(p => escape(p).replace(/\\\*/g, '[^\\r\\n]*').replace(/\\\?/g, '[^\\r\\n]')).join('|');
  }
  return word ? `\\b(?:${body})\\b` : `(?:${body})`;
}

// A Contents line's condition as the key of its answer on an item (x.contents), and the lines the host reads files
// for: their key, expression (contains: verbatim; matches wildcards: normal; matches a regex), encoding ('' automatic)
// and whether all files or the known ones (plan 20 3.2).
const filterContentsKey = c => JSON.stringify([c.op ?? 'contains', c.text ?? '', c.encoding ?? '', !!c.allFiles]);
function filterContentsLines(set) {
  return (set?.lines ?? []).filter(l => l.field === 'contents' && l.cond?.text).map(l => ({
    key: filterContentsKey(l.cond),
    pattern: filterTextPattern(l.cond.text, l.cond.op === 'regex' ? 'regex' : l.cond.op === 'wild' ? 'normal' : 'verbatim'),
    encoding: l.cond.encoding ?? '', allFiles: !!l.cond.allFiles,
  }));
}

// A set's id and the key its results are kept under in the host's folder cache (docs/plans/executed/36-PLAN-filter-results-in-cache.md
// 3.1, 3.8): the id follows the lines (lines changed: another id; the same lines again: the same id); the key is the
// id, with today's date for a set relative by the date, and null for one relative by the clock (minutes, hours), whose
// results are not kept.
function filterKey(set, now = Date.now()) {
  const lines = set?.lines ?? [];
  const text = JSON.stringify(lines);
  let a = 0x811c9dc5, b = 0x9e3779b9 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b ^ c, 2246822519) >>> 0;
  }
  const filter = a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  const relative = lines.flatMap(filterRelative);
  if (relative.includes('clock')) return { filter, key: null };
  if (!relative.includes('date')) return { filter, key: filter };
  const d = new Date(now), two = n => String(n).padStart(2, '0');
  return { filter, key: `${filter}@${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}` };
}

// How a line depends on now: 'clock' (minutes or hours ago or from now), 'date' (a day, days and longer), or not.
function filterRelative(line) {
  const c = line.cond ?? {}, out = [];
  const one = d => { if (d && typeof d === 'object' && d.rel != null) out.push(['minutes', 'hours'].includes(d.unit) ? 'clock' : 'date'); };
  if (c.op === 'on') one(c.day);
  if (c.op === 'range') { one(c.from); one(c.to); }
  return out;
}

// A line as it reads in short: "Files, Name matches *.tmp", for the editor's list and the head.
function filterLineText(line, titleOf) {
  const who = line.folders && line.files ? '' : line.folders ? 'Folders, ' : line.files ? 'Files, ' : 'Nothing, ';
  const c = line.cond ?? {}, f = titleOf(line.field);
  const date = d => !d ? '' : d.rel != null ? `${d.rel} ${d.unit ?? 'days'} ${d.ahead ? 'from now' : 'ago'}` : (d.abs ?? '').replace('T', ' ');
  if (line.field === 'contents')
    return `${line.not ? 'Not ' : ''}${who}${f} ${c.op === 'regex' ? `matches /${c.text ?? ''}/` : c.op === 'wild' ? `matches ${c.text ?? ''}` : `contains ${c.text ?? ''}`}`
      + `${c.encoding ? `, ${c.encoding}` : ''}${c.allFiles ? ', all files' : ''}`;
  const what = c.op === 'has' ? `${f} has a value` : c.op === 'none' ? `${f} has no value`
    : c.op === 'wild' ? `${f} matches ${c.text || '*'}` : c.op === 'regex' ? `${f} matches /${c.text ?? ''}/`
    : c.op === 'contains' ? `${f} contains ${c.text ?? ''}` : c.op === 'is' && c.value == null ? `${f} is ${c.text ?? ''}`
    : c.op === 'true' ? `${f} is yes` : c.op === 'false' ? `${f} is no`
    : c.op === 'in' ? `${f} is ${(c.values ?? []).join(' or ') || 'any'}`
    : c.op === 'attrs' ? `${f}: ${Object.entries(c.attrs ?? {}).filter(([, w]) => w !== 'either').map(([a, w]) => (w === 'not' ? 'not ' : '') + (FilterAttributes.find(x => x[0] === a)?.[1] ?? a)).join(', ') || 'any'}`
    : c.op === 'on' ? `${f} is ${!c.day ? '?' : c.day.rel != null ? (+c.day.rel === 0 ? 'today' : `${c.day.rel} days ${c.day.ahead ? 'from now' : 'ago'}`) : c.day.abs}`
    : c.op === 'is' && c.value != null ? `${f} is ${c.value}`
    : c.op === 'range' ? [f, c.from != null && c.from !== '' ? `from ${typeof c.from === 'object' ? date(c.from) : c.from}` : '',
      c.to != null && c.to !== '' ? `to ${typeof c.to === 'object' ? date(c.to) : c.to}` : ''].filter(Boolean).join(' ')
    : f;
  return `${line.not ? 'Not ' : ''}${who}${what}${line.orEmpty && !['has', 'none'].includes(c.op) ? ', or empty' : ''}`;
}

// What a pane's head shows of its set: the kept name, "temp" for the temporary filter, or the name's wildcards of a
// one-line set, else "Filter".
function filterHeadText(set) {
  if (!set?.lines?.length) return '';
  if (set.name) return set.name;
  if (set.temp) return 'temp';
  const [line] = set.lines;
  return set.lines.length === 1 && line.field === 'name' && line.cond?.op === 'wild' && !line.not ? line.cond.text || 'Filter' : 'Filter';
}
