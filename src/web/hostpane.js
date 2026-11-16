'use strict';
// A page that was a host form's own (Settings, Manage projects) as a pane's page (docs/plans/executed/14-PLAN-floating-panes.md
// 3.7): what it sends to the host and what the host sends it go through its window's page (`host` both ways), which
// passes them to and from the host (MainForm's paneHost). `paneHost` stands where the page had chrome.webview.
// Loaded after pane.js, before the page's own script.

const paneHostListeners = [];
const paneHost = {
  postMessage: msg => toWindow({ kind: 'host', msg }),
  addEventListener: (type, fn) => { if (type === 'message') paneHostListeners.push(fn); },
};
paneHandlers.host = m => { for (const fn of paneHostListeners) fn({ data: m.msg }); };
