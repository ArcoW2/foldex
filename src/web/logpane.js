'use strict';
// The Log pane's page (docs/plans/executed/14-PLAN-floating-panes.md 3.0; the log itself: app.js logStatus, logOp): a line per
// entry its window's page keeps, its time first; a warning or a failure in the warning colour. Kept at its end while it
// was at its end, so the newest stays in view.

const logBox = document.getElementById('log');

paneHandlers.entries = ({ entries }) => {
  const atEnd = logBox.scrollTop + logBox.clientHeight >= logBox.scrollHeight - 4;
  if (!entries.length) {
    logBox.replaceChildren(Object.assign(document.createElement('div'), { className: 'message', textContent: 'Nothing yet: messages and file operations come here.' }));
    return;
  }
  const time = at => new Date(at).toLocaleTimeString();
  logBox.replaceChildren(...entries.map(e => {
    const row = document.createElement('div');
    row.className = 'log-row' + (e.warn ? ' warn' : '');
    row.append(Object.assign(document.createElement('span'), { className: 'log-time', textContent: time(e.at) }),
      Object.assign(document.createElement('span'), { className: 'log-text', textContent: e.text }));
    return row;
  }));
  if (atEnd) logBox.scrollTop = logBox.scrollHeight;
};
