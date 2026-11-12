'use strict';
// Renaming many at once (docs/plans/executed/21-PLAN-multi-rename.md): the new names, without the DOM, so the tests run them
// under Jint. The Rename dialog (renamedialog.js) shows them as its preview and renames them.
//
// An item: { id, name, folder (bool), parent (its folder's name), grandparent, value(column, format) (a column's value
// as text, a date in `format` when given) }. The settings `o`: { mode, target, template, match, regex, matchCase,
// from, length, fromEnd, dateFrom, dateFormat, shiftDays, shiftHours, caseTo, counter: { start, step, digits },
// syntax }.

const RenameModes = { pattern: 'A new name from a pattern', part: 'Change a part', replace: 'Replace the first match',
  replaceAll: 'Replace every match', date: 'The date in the name', case: 'Change the case' };
const RenameTargets = { name: 'The name, not the extension', ext: 'The extension', whole: 'The whole name' };
const RenameCases = { '': 'As it is', lower: 'lower case', upper: 'UPPER CASE', title: 'First Letters Up' };
const DateFormats = ['yyyy-MM-dd', 'yyyyMMdd', 'dd-MM-yyyy', 'yyyy-MM-dd HH.mm', 'yyyyMMdd_HHmmss', 'yyyy-MM', 'HHmm'];

// A name as its name and extension (a folder, or a name without a dot after its first character: no extension).
function splitName(name, folder = false) {
  const dot = folder ? -1 : name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot + 1) } : { base: name, ext: '' };
}

const pad = (n, digits) => String(n).padStart(digits, '0');

// A date (ms since 1970, local time) as `format` says: yyyy, yy, MM, M, dd, d, HH, H, mm, ss; other text as it is.
function formatDate(ms, format) {
  const d = new Date(ms);
  const parts = { yyyy: d.getFullYear(), yy: pad(d.getFullYear() % 100, 2), MM: pad(d.getMonth() + 1, 2), M: d.getMonth() + 1,
    dd: pad(d.getDate(), 2), d: d.getDate(), HH: pad(d.getHours(), 2), H: d.getHours(), mm: pad(d.getMinutes(), 2), ss: pad(d.getSeconds(), 2) };
  return format.replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|ss/g, t => String(parts[t]));
}

// The first date in a text (3.3): year first (2026-11-12, 2026_11_12, 2026.11.12, 20261112) or day first (12-11-2026),
// perhaps with a time after it (14.30, 14:30:05, 143005). { start, end, ms } or null.
function findDate(text) {
  const time = '(?:[ _T-](\\d{2})[.:-]?(\\d{2})(?:[.:-]?(\\d{2}))?)?';
  const forms = [
    [new RegExp(`(?<!\\d)(\\d{4})([-_.]?)(\\d{2})\\2(\\d{2})${time}(?!\\d)`, 'g'), m => [m[1], m[3], m[4]]],
    [new RegExp(`(?<!\\d)(\\d{2})([-_.])(\\d{2})\\2(\\d{4})${time}(?!\\d)`, 'g'), m => [m[4], m[3], m[1]]],
  ];
  let best = null;
  for (const [re, ymd] of forms)
    for (const m of text.matchAll(re)) {
      const [y, mo, d] = ymd(m).map(Number);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      const ms = new Date(y, mo - 1, d, Number(m[5] ?? 0), Number(m[6] ?? 0), Number(m[7] ?? 0)).getTime();
      if (!best || m.index < best.start) best = { start: m.index, end: m.index + m[0].length, ms };
      break;
    }
  return best;
}

function caseOf(text, how) {
  if (how === 'lower') return text.toLowerCase();
  if (how === 'upper') return text.toUpperCase();
  if (how === 'title') return text.toLowerCase().replace(/(^|[\s_\-.(\[])(\p{L})/gu, (m, before, letter) => before + letter.toUpperCase());
  return text;
}

// Characters `from` (1 first; below 0 counted from the end) for `length` of a text.
function partOf(text, from, length) {
  const start = from < 0 ? Math.max(0, text.length + from) : Math.max(0, from - 1);
  return [start, Math.min(text.length, start + Math.max(0, length))];
}

// A pattern's tokens filled in for an item, the index-th (0 first) of those renamed. xplorer2's syntax: $B the name,
// $E the extension, $N the whole name, $P the parent folder, $G the one above it, $1 / $003 a counter (its start
// and digits as written), $[first:length] a part of the name, ${Column} or ${Column:format} a column's value, $$ a $.
// Total Commander's: [N], [E], [P], [G], [C] (the counter's start, step and digits from o.counter), [N2-5] or [N2,4]
// a part of the name, [Y] [M] [D] [h] [m] [s] the date modified, [=Column] or [=Column:format], [[ a [.
function expandTokens(template, item, index, o) {
  const { base, ext } = splitName(item.name, item.folder);
  const part = (from, length) => base.slice(...partOf(base, from, length));
  if (o.syntax === 'totalcommander') {
    const c = o.counter ?? { start: 1, step: 1, digits: 1 };
    const modified = format => item.value('modified', format);
    return template.replace(/\[\[|\[N(-?\d+)(?:([-,])(-?\d+))?\]|\[=([^\]:]+)(?::([^\]]+))?\]|\[([NEPGCYMDhms])\]/g, (t, from, sep, to, col, fmt, one) => {
      if (t === '[[') return '[';
      // A group that did not take part comes as undefined (as the standard says) or '': either is "not there".
      if (from) {
        const f = Number(from);
        if (sep === ',') return part(f, Number(to));
        if (sep === '-') return part(f, Number(to) - f + 1);
        return part(f, 1);
      }
      if (col) return item.value(col.trim(), fmt || undefined);
      return { N: base, E: ext, P: item.parent ?? '', G: item.grandparent ?? '', C: pad(c.start + index * c.step, c.digits),
        Y: modified('yyyy'), M: modified('MM'), D: modified('dd'), h: modified('HH'), m: modified('mm'), s: modified('ss') }[one];
    });
  }
  return template.replace(/\$\$|\$\[(-?\d+):(\d+)\]|\$\{([^}:]+)(?::([^}]+))?\}|\$(\d+)|\$([BENPG])/g, (t, from, length, col, fmt, counter, one) => {
    if (t === '$$') return '$';
    if (from) return part(Number(from), Number(length));
    if (col) return item.value(col.trim(), fmt || undefined);
    if (counter) return pad(Number(counter) + index, counter.length);
    return { B: base, E: ext, N: item.name, P: item.parent ?? '', G: item.grandparent ?? '' }[one];
  });
}

// The new name of an item (3.2, 3.3): what changes (the name, the extension or both) changed by the mode, then the
// case when one is chosen.
function renameOne(item, index, o) {
  const { base, ext } = splitName(item.name, item.folder);
  const subject = o.target === 'ext' ? ext : o.target === 'whole' || item.folder && o.target === 'ext' ? item.name : base;
  let out = subject;
  if (o.mode === 'pattern') out = expandTokens(o.template ?? '', item, index, o);
  else if (o.mode === 'part') {
    const [a, b] = partOf(subject, o.fromEnd ? -Math.max(1, o.from) : o.from, o.length);
    out = subject.slice(0, a) + expandTokens(o.template ?? '', item, index, o) + subject.slice(b);
  } else if (o.mode === 'replace' || o.mode === 'replaceAll') {
    if (o.match) {
      if (o.regex) {
        try {
          const re = new RegExp(o.match, (o.matchCase ? '' : 'i') + (o.mode === 'replaceAll' ? 'g' : ''));
          out = subject.replace(re, o.template ?? '');
        } catch { out = subject; }
      } else {
        const with_ = expandTokens(o.template ?? '', item, index, o);
        const find = o.matchCase ? subject : subject.toLowerCase(), what = o.matchCase ? o.match : o.match.toLowerCase();
        let at = find.indexOf(what), from = 0, built = '';
        while (at >= 0) {
          built += subject.slice(from, at) + with_;
          from = at + what.length;
          if (o.mode === 'replace') break;
          at = find.indexOf(what, from);
        }
        out = built + subject.slice(from);
      }
    }
  } else if (o.mode === 'date') {
    const found = findDate(subject);
    const source = o.dateFrom && o.dateFrom !== 'found' ? item.raw?.(o.dateFrom) : found?.ms;
    if (found && source != null) {
      const ms = source + ((Number(o.shiftDays) || 0) * 24 + (Number(o.shiftHours) || 0)) * 3600000;
      out = subject.slice(0, found.start) + formatDate(ms, o.dateFormat || 'yyyy-MM-dd') + subject.slice(found.end);
    }
  } else if (o.mode === 'case') out = caseOf(subject, o.caseTo);
  if (o.mode !== 'case' && o.caseTo) out = caseOf(out, o.caseTo);
  if (o.target === 'ext') return out ? `${base}.${out}` : base;
  if (o.target === 'whole' || item.folder) return out;
  return ext ? `${out}.${ext}` : out;
}

// Why a name cannot be: Windows refuses it, or it is empty. Null when it can.
function nameRefusal(name) {
  if (!name.trim()) return 'empty';
  if (/[\\/:*?"<>|]/.test(name)) return 'holds \\ / : * ? " < > |';
  if (/[. ]$/.test(name)) return 'ends with a dot or a space';
  return null;
}

// The preview (3.1): per item its new name and what is wrong with it: a name Windows refuses, the same new name for
// two items of one folder, or a name an item of that folder has that is not renamed away (`existing`: folder ->
// names there, lower case). { id, name, to, changed, problem }.
function renamePreview(items, o, existing = new Map()) {
  const rows = items.map((item, i) => {
    const to = renameOne(item, i, o);
    return { id: item.id, name: item.name, to, changed: to !== item.name, problem: to !== item.name ? nameRefusal(to) : null };
  });
  const folder = id => id.replace(/\\[^\\]*$/, '').toLowerCase();
  const leaving = new Set(rows.filter(r => r.changed).map(r => r.id.toLowerCase()));
  const taken = new Map();
  for (const r of rows) {
    const key = `${folder(r.id)}\\${r.to.toLowerCase()}`;
    taken.set(key, (taken.get(key) ?? 0) + 1);
  }
  for (const r of rows) {
    if (!r.changed || r.problem) continue;
    const key = `${folder(r.id)}\\${r.to.toLowerCase()}`;
    if (taken.get(key) > 1) r.problem = 'the same name as another';
    else if (r.to.toLowerCase() !== r.name.toLowerCase() && existing.get(folder(r.id))?.has(r.to.toLowerCase())
      && !leaving.has(key)) r.problem = 'exists in that folder';
  }
  return rows;
}
