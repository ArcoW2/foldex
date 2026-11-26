'use strict';
// Projects in a window (docs/plans/executed/15-PLAN-projects.md 3.6, as LexPen's): the window's project at the left of the bottom
// bar; a click there (or the action projects.menu) opens the Projects menu (menu.js): Manage projects, New project,
// Rename this project, then every project, each with the panes of its window by name as a tree (roots, their children
// indented). The host keeps the projects (AppHost, ProjectStore); a name is asked in a small dialog of the page
// (askText). Loaded after menu.js, before app.js.

let project = { id: null, name: '', display: '' };
let projectMenuAt = null;   // where the menu asked for opens: { x, y }; null: at the bottom bar

function showProject(p) {
  project = p ?? project;
  const el = document.getElementById('project');
  el.textContent = project.display;
  el.title = `This window's project: ${project.display}. Click for the Projects menu.`;
}

// The menu at the bottom bar (or `at`): the host sends the list first ('projectList').
function projectsMenu(at = null) {
  projectMenuAt = at;
  post({ op: 'projects' });
}

const projectCommand = (kind, args = {}) => post({ op: 'projectCommand', kind, ...args });

function projectMenuItems(list) {
  const mine = list.find(p => p.mine);
  const projectItem = p => {
    const open = () => projectCommand('open', { project: p.id });
    return {
      label: p.display + (p.mine ? '  (this window)' : ''), checked: p.open,
      items: [
        { label: p.open ? 'Show project' : 'Open project', run: open, enabled: !p.mine },
        ...(p.panes.length ? ['-'] : []),
        // Its window's panes: a root, then its children a step in, with tree lines; a click opens (or shows) the
        // project with the focus on that pane.
        ...p.panes.map((pane, i, all) => ({
          label: pane.name, indent: pane.depth, guides: treeGuides(all.map(x => x.depth))[i],
          run: () => projectCommand('open', { project: p.id, pane: pane.id }),
        })),
        '-',
        { label: 'Delete project...', enabled: !p.open, run: async () => {
          if (await askYes(`Delete the project "${p.display}"? Folders and files are not touched.`)) projectCommand('delete', { project: p.id });
        } },
      ],
    };
  };
  // As LexPen's: Manage, New, Rename, then the projects.
  return [
    { label: 'Manage projects...', run: () => openOnePane('projects') },
    { label: 'New project...', run: async () => {
      const name = await askText('Name of the new project', '', 'Empty: a number');
      if (name !== null) projectCommand('new', { name });
    } },
    { label: 'Rename this project...', enabled: !!mine, run: renameProject },
    '-',
    ...list.map(projectItem),
  ];
}

async function renameProject() {
  const name = await askText('Name of this window\'s project', project.name, `Empty: Project ${project.id}`);
  if (name !== null) projectCommand('rename', { name });
}

// The menu's items, for the ribbon's Projects button (its list under it; plan 19 3.11).
let projectListWaiting = null;
function projectListItems() {
  return new Promise(resolve => {
    projectListWaiting = resolve;
    post({ op: 'projects' });
  });
}

// The list came: the menu opens (at the bottom bar, above the project's name), or the ribbon's list gets its items.
function projectListCame(list) {
  if (projectListWaiting) {
    const resolve = projectListWaiting;
    projectListWaiting = null;
    return resolve(projectMenuItems(list));
  }
  const r = document.getElementById('project').getBoundingClientRect();
  const at = projectMenuAt ?? { x: r.left, y: r.top };
  openMenu(at.x, at.y, projectMenuItems(list));
  // From the bottom bar it opens upward: moved up by its own height, kept inside the window.
  if (!projectMenuAt) {
    const el = document.querySelector('.menu');
    if (el) el.style.top = `${Math.max(0, r.top - el.offsetHeight - 2)}px`;
  }
  document.querySelector('.menu')?.focus();
}

// ---------- Profiles (docs/plans/executed/41-PLAN-profiles.md 3.5) ----------

// The window's profile left of its project; a click there (or the action profiles.menu) opens the Profiles menu:
// every profile with a submenu of its commands, nothing of what one holds. The host keeps them (AppHost,
// ProfileStore) and asks the passwords itself (AskForm); a name is asked here (askText).

let profile = { number: 0, name: 'Default', locked: false };
let profileMenuAt = null;
let profileListWaiting = null;

// A small lock: a profile with a password.
function lockMark() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('class', 'lock-mark');
  s.innerHTML = '<rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/>'
    + '<path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/>';
  return s;
}

function showProfile(p) {
  profile = p ?? profile;
  const el = document.getElementById('profile');
  if (!el) return;
  el.replaceChildren(document.createTextNode(profile.name), ...(profile.locked ? [lockMark()] : []));
  el.title = `This window's profile: ${profile.name}${profile.locked ? ' (it has a password)' : ''}. Click for the Profiles menu.`;
}

function profilesMenu(at = null) {
  profileMenuAt = at;
  post({ op: 'profiles' });
}

function profileListItems() {
  return new Promise(resolve => {
    profileListWaiting = resolve;
    post({ op: 'profiles' });
  });
}

const profileCommand = (p, kind, args = {}) => post({ op: 'profileCommand', kind, profile: p.number, ...args });

// The host asks the password of a closed profile that has one (always: also when it is open, for Copy; 3.4).
async function profileUnlock(p, always = false) {
  if (!p.locked) return true;
  return !!(await askHost({ op: 'profileUnlock', profile: p.number, always })).yes;
}

// A profile's commands (its submenu); `id`: what the actions run (runProfileItem).
function profileCommands(p) {
  const then = (kind, always = false) => async () => { if (await profileUnlock(p, always)) profileCommand(p, kind); };
  return [
    { id: 'open', label: p.open ? 'Show' : 'Open', enabled: !p.current, run: () => profileCommand(p, 'open') },
    { id: 'copy', label: 'Copy to a new profile...', run: async () => {
      if (!await profileUnlock(p, true)) return;
      const name = await askText('Name of the new profile', `Copy of ${p.name}`);
      if (name !== null) profileCommand(p, 'copy', { name });
    } },
    { id: 'rename', label: 'Rename...', enabled: !p.isDefault, run: async () => {
      if (!await profileUnlock(p)) return;
      const name = await askText('Name of the profile', p.name);
      if (name) profileCommand(p, 'rename', { name });
    } },
    ...(p.isDefault ? [] : p.locked
      ? [{ id: 'password', label: 'Change password...', run: then('password') }, { id: 'removePassword', label: 'Remove password', run: then('removePassword') }]
      : [{ id: 'password', label: 'Set password...', run: then('password') }]),
    { id: 'neverOpen', label: 'Never open by itself', checked: p.neverOpen, run: then('neverOpen') },
    ...(p.open ? [{ id: 'close', label: 'Close', run: () => profileCommand(p, 'close') }] : []),
    ...(p.isDefault ? [] : ['-', { id: 'delete', label: 'Delete...', run: () => profileCommand(p, 'delete') }]),
  ];
}

function profileMenuItems(list) {
  return list.map(p => ({
    label: p.name + (p.current ? '  (this window)' : ''), checked: p.open, mark: p.locked ? lockMark() : null,
    items: profileCommands(p),
  }));
}

// A command of this window's profile, for the actions (actions.js profile.*).
let profileRawWaiting = null;
async function runProfileItem(id) {
  const list = await new Promise(resolve => { profileRawWaiting = resolve; post({ op: 'profiles' }); });
  const mine = list.find(p => p.current);
  if (mine) profileCommands(mine).find(c => c.id === id && c.enabled !== false)?.run();
}
// The list came: the menu opens (at the bottom bar, upward, above the profile's name), or the ribbon's list gets it.
function profileListCame(list) {
  if (profileRawWaiting) {
    const resolve = profileRawWaiting;
    profileRawWaiting = null;
    return resolve(list);
  }
  if (profileListWaiting) {
    const resolve = profileListWaiting;
    profileListWaiting = null;
    return resolve(profileMenuItems(list));
  }
  const r = document.getElementById('profile').getBoundingClientRect();
  const at = profileMenuAt ?? { x: r.left, y: r.top };
  openMenu(at.x, at.y, profileMenuItems(list));
  if (!profileMenuAt) {
    const el = document.querySelector('.menu');
    if (el) el.style.top = `${Math.max(0, r.top - el.offsetHeight - 2)}px`;
  }
  document.querySelector('.menu')?.focus();
}

document.getElementById('profile')?.addEventListener('mousedown', e => {
  e.preventDefault();
  profilesMenu();
});

// ---------- A small dialog of the page: a text, or yes / no ----------

// A text, or null for Cancel / Esc. Asked in a modal floating window of its own (plan 14 3.7), so it can be moved.
// `select`: [start, end] of the text selected at first (a name without its extension), else all of it.
function askText(title, value = '', placeholder = '', select = null) {
  return dialogWindow(title, { what: 'askText', title, value, placeholder, select });
}

// True for Yes. `lines`: shown under the question (the folders of a delete, plan 06 3.5). Asked in Foldex's own window
// (AskForm.cs, as LexPen's), so it is never behind Windows' preview; the keyboard back in the active pane after.
async function askYes(title, lines = []) {
  const m = await askHost({ op: 'confirm', text: title, lines });
  activeView()?.body.focus();
  return !!m.yes;
}

function ask(title, input, lines = []) {
  const dialog = document.createElement('dialog');
  dialog.className = 'ask';
  const form = document.createElement('form');
  form.method = 'dialog';
  const label = Object.assign(document.createElement('label'), { textContent: title });
  form.append(label);
  for (const line of lines) form.append(Object.assign(document.createElement('div'), { className: 'ask-line', textContent: line }));
  let box = null;
  if (input) {
    box = Object.assign(document.createElement('input'), { value: input.value, placeholder: input.placeholder, spellcheck: false });
    form.append(box);
  }
  const buttons = document.createElement('div');
  buttons.className = 'ask-buttons';
  // A question is answered Yes or No (y, n: buttons.js), a text OK or Cancel.
  buttons.append(Object.assign(document.createElement('button'), { value: 'ok', textContent: input ? 'OK' : 'Yes' }),
    Object.assign(document.createElement('button'), { value: 'cancel', textContent: input ? 'Cancel' : 'No', formNoValidate: true }));
  form.append(buttons);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  if (box) box.select(); else buttons.firstChild.focus();
  return new Promise(resolve => dialog.addEventListener('close', () => {
    resolve(dialog.returnValue === 'ok' ? (box ? box.value.trim() : '') : null);
    dialog.remove();
    activeView()?.body.focus();
  }, { once: true }));
}

document.getElementById('project').addEventListener('mousedown', e => {
  e.preventDefault();
  projectsMenu();
});
