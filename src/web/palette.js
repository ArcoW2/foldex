'use strict';
// F1 (as LexPen's): every action with its keys, in groups, searchable; Enter or a click runs one.

function paletteRows() {
  const rows = [];
  for (const [group, groupTitle] of ACTION_GROUPS)
    for (const def of actions.values()) {
      if (def.group !== group) continue;
      for (const params of def.variants ?? [[]])
        rows.push({ call: [def.name, ...params], title: actionTitle(def.name, params), hint: def.hint ?? '', group: groupTitle,
          keys: keysOf(def.name, ...params).join(', ') });
    }
  return rows;
}

function openPalette() {
  let dialog = document.getElementById('palette');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'palette';
    dialog.innerHTML = '<div class="about"></div><input class="filter" spellcheck="false" placeholder="Type to find an action or a key">' +
      '<table><tbody></tbody></table>';
    document.body.append(dialog);
    dialog.querySelector('.filter').addEventListener('input', () => fill());
    dialog.addEventListener('keydown', e => {
      const rows = [...dialog.querySelectorAll('tbody tr')];
      const at = rows.findIndex(r => r.classList.contains('selected'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))];
        rows.forEach(r => r.classList.toggle('selected', r === next));
        next?.scrollIntoView({ block: 'nearest' });
        e.preventDefault();
      } else if (e.key === 'Enter' && rows[at]) {
        e.preventDefault();
        run(rows[at]);
      }
    });
    dialog.addEventListener('click', e => { const row = e.target.closest('tr'); if (row) run(row); });
  }
  const run = row => {
    dialog.close();
    const call = JSON.parse(row.dataset.call);
    runAction(call[0], call.slice(1), { from: 'palette' });
  };
  dialog.querySelector('.about').textContent = `Foldex ${version}`;   // the name and version (plan 10 3.2)
  const fill = () => {
    const words = dialog.querySelector('.filter').value.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = paletteRows().filter(r => words.every(w => `${r.title} ${r.hint} ${r.keys} ${r.group} ${r.call[0]}`.toLowerCase().includes(w)));
    dialog.querySelector('tbody').replaceChildren(...rows.map((r, i) => {
      const tr = document.createElement('tr');
      tr.dataset.call = JSON.stringify(r.call);
      if (i === 0) tr.classList.add('selected');
      if (!actionEnabled(r.call[0], r.call.slice(1))) tr.classList.add('disabled');
      for (const text of [r.group, r.title, r.keys]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      tr.title = r.hint;
      return tr;
    }));
  };
  dialog.querySelector('.filter').value = '';
  fill();
  dialog.showModal();
  dialog.querySelector('.filter').focus();
}
