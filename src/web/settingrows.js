'use strict';
// The rows of the settings window (docs/plans/07-PLAN-themes.md 3.5), described once: settings.js draws them, the tests
// check that each names a setting of defaults\settings.json. A row: { group, name, title, hint, kind } with kind
// "toggle" (true / false), "choice" (options: [value, label]), "theme" (every theme, from the host), "font" (the
// installed fonts, from the host; "" the default) or "size" (points, 0 the default).

const SETTING_GROUPS = ['General', 'Fonts', 'Panes'];

const SETTING_ROWS = [
  { group: 'General', name: 'followWindows', kind: 'toggle', title: 'Light or dark as Windows is',
    hint: 'Follows Settings > Personalization > Colors at once; off: the mode below.' },
  { group: 'General', name: 'theme', kind: 'choice', title: 'Mode', options: [['light', 'Light'], ['dark', 'Dark']],
    hint: 'Light or dark when not following Windows.' },
  { group: 'General', name: 'themeLight', kind: 'theme', title: 'Theme in light mode',
    hint: 'The colours of the window, the branch colours included. Your own themes go in themes\\ in the data folder.' },
  { group: 'General', name: 'themeDark', kind: 'theme', title: 'Theme in dark mode',
    hint: 'The colours of the window in dark mode.' },
  { group: 'Fonts', name: 'appFont', kind: 'font', title: 'Window font',
    hint: 'The ribbon, the pane heads, the location box, the status line and this window.' },
  { group: 'Fonts', name: 'appSize', kind: 'size', title: 'Window font size', hint: 'In points; 0 is 9.75.' },
  { group: 'Fonts', name: 'paneFont', kind: 'font', title: 'Pane font', hint: 'The rows of every tree and list.' },
  { group: 'Fonts', name: 'paneSize', kind: 'size', title: 'Pane font size',
    hint: 'In points; 0 is 9.75. Also Ctrl+mouse wheel over a pane: every pane alike.' },
  { group: 'Panes', name: 'showHidden', kind: 'toggle', title: 'Hidden items',
    hint: 'Hidden and system files and folders shown (Ctrl+H, View > Hidden items).' },
];
