'use strict';
// The rows of the settings window (docs/plans/07-PLAN-themes.md 3.5), described once: settings.js draws them, the tests
// check that each names a setting of defaults\settings.json. A row: { group, name, title, hint, kind } with kind
// "toggle" (true / false), "choice" (options: [value, label]), "theme" (every theme, from the host), "font" (the
// installed fonts, from the host; "" the default), "size" (points, 4 to 36) or "range" (a slider: range [min, max,
// step], unit after the value).

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
  { group: 'Fonts', name: 'appSize', kind: 'size', title: 'Window font size', hint: 'In points, 4 to 36.' },
  { group: 'Fonts', name: 'paneFont', kind: 'font', title: 'Pane font', hint: 'The rows of every tree and list.' },
  { group: 'Fonts', name: 'paneSize', kind: 'size', title: 'Pane font size',
    hint: 'In points, 4 to 36. Also Ctrl+mouse wheel over a pane: every pane alike.' },
  { group: 'Panes', name: 'showHidden', kind: 'toggle', title: 'Hidden items',
    hint: 'Hidden and system files and folders shown (Ctrl+H, View > Hidden items).' },
  { group: 'Panes', name: 'paneBgFocused', kind: 'range', range: [0, 200, 5], unit: '%', title: 'Background of the focused pane',
    hint: '100% is the theme colour; lower is darker (0% black), higher is lighter (200% white).' },
  { group: 'Panes', name: 'paneBgBranch', kind: 'range', range: [0, 200, 5], unit: '%',
    title: 'Background of the panes in its branch',
    hint: 'The same way, for the parents of the focused pane and its children in that branch.' },
  { group: 'Panes', name: 'paneBgOther', kind: 'range', range: [0, 200, 5], unit: '%', title: 'Background of the other panes',
    hint: 'The same way, for the panes in no branch of the focused pane.' },
  { group: 'Panes', name: 'treeExpanders', kind: 'choice', title: 'Tree expanders',
    options: [['plus', '+ and -'], ['chevron', '> and v']], hint: 'Before a folder with folders in it, in every tree.' },
  { group: 'Panes', name: 'treeLines', kind: 'choice', title: 'Tree lines',
    options: [['dotted', 'Dotted'], ['solid', 'Solid'], ['none', 'None']],
    hint: 'The lines joining each folder to the one above it, in every tree and in the Projects menu.' },
  { group: 'Panes', name: 'paneThemeIntensity', kind: 'range', range: [0, 200, 5], unit: '%', title: 'Branch colour intensity',
    hint: 'Every branch colour: 100% the colour of the theme; lower fainter, higher stronger. The two mixes below start from it.' },
  { group: 'Panes', name: 'paneHeadMix', kind: 'range', range: [0, 100, 5], unit: '%', title: 'Pane headers colour mix',
    hint: 'Pane heads and tabs: 0% the window colours, 100% the branch colour at the intensity above.' },
  { group: 'Panes', name: 'paneThemeMix', kind: 'range', range: [0, 100, 1], unit: '%', title: 'Branch colour in the pane',
    hint: 'Background, selection and hover inside a pane: 0% the window colours, 100% the branch colour at the intensity above.' },
];
