'use strict';
// F1 (as LexPen's): every action with its keys, in groups, searchable; Enter or a double click runs one. A pane of its
// own (palette.html, palettepane.js; plan 14 3.7), docked or floating, not modal: it stays open while actions run, on
// the active pane (F1 never becomes it: PaletteView.passive).

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

// What F1's page is sent: the rows, each marked when it does not work on the active pane now.
function paletteForPage() {
  return { kind: 'rows', version, rows: paletteRows().map(r => ({ ...r, off: !actionEnabled(r.call[0], r.call.slice(1)) })) };
}

// F1 pressed: the pane comes (where it was last; the first time floating), its search gets the keyboard.
function openPalette() {
  openOnePane('palette');
  const view = paneOfKind('palette');
  view.render();
  view.channel.focus();
  view.send({ kind: 'focus', key: 'focus' });
}

// What F1's page asks of this page.
function palettePageAsks(view, m) {
  switch (m.kind) {
    case 'run': return runAction(m.call[0], m.call.slice(1), { from: 'palette' });
    case 'refresh': return view.render();
    case 'close': return closePane(view.id);
  }
}
