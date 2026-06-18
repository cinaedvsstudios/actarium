import { startReminderAlarmService, enableReminderAlarmCapability } from './reminderAlarms.js';

const CONFIG = {
  version: 'v3.12',
  api: window.ACTARIUM_API || 'https://script.google.com/macros/s/AKfycbzC47dw83euJ_T45zh0LQmtAivEHK7G_V5aHTYLYw2VhnMDAAVK0UFCF3tv5nsWM74q/exec',
  sheet: 'https://docs.google.com/spreadsheets/d/1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA/edit',
  repo: 'https://github.com/cinaedvsstudios/actarium',
  chrisFit: 'https://cinaedvsstudios.github.io/chrisfit/',
  viaticum: 'https://cinaedvsstudios.github.io/Viaticum/'
};

const state = {
  date: iso(new Date()),
  desktopView: 'today',
  mobileView: 'all',
  taskFilter: 'all',
  theme: localStorage.getItem('actarium.theme') || 'dark',
  appsOpen: false,
  modal: null,
  selected: new Set(),
  connection: 'Loading…',
  lastSync: '',
  data: { tasks: [], reminders: [], apps: [], feed: [], events: [], schedule: [] }
};

document.documentElement.dataset.theme = state.theme;
const root = document.getElementById('app');
boot();

async function boot() {
  render();
  try {
    state.data = normalise(await request('bootstrap'));
    state.connection = 'Live Sheet connection';
    markSynced();
    chooseDefaultView();
  } catch (error) {
    console.warn('Actarium backend unavailable:', error);
    state.data = demoData();
    state.connection = 'Demo / local view';
    state.lastSync = 'Offline';
  }
  startReminderAlarmService({ getReminders: () => state.data.reminders });
  render();
}

async function request(action, body) {
  if (body) {
    const response = await fetch(CONFIG.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    });
    if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.success === false) throw new Error(payload.error || 'Backend rejected request');
    return payload;
  }

  const url = new URL(CONFIG.api);
  url.searchParams.set('action', action);
  const response = await fetch(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.success === false) throw new Error(payload.error || 'Backend rejected request');
  return payload;
}

function normalise(payload) {
  return {
    tasks: (payload.tasks || []).map((row, index) => normaliseItem(row, index, 'task')),
    reminders: (payload.reminders || []).map((row, index) => normaliseItem(row, index, 'reminder')),
    apps: (payload.apps || []).map(normaliseApp).filter(app => /^active$/i.test(app.status || 'Active')).sort((a, b) => a.order - b.order),
    feed: (payload.appFeed || payload.app_feed || []).map(row => ({
      source: field(row, 'sourceApp', 'source_app', 'source'),
      payload: field(row, 'payload', 'payload_json')
    })),
    events: (payload.viaticumEvents || payload.viaticum_events || []).map(normaliseEvent),
    schedule: normaliseSchedule(payload)
  };
}

function normaliseItem(row, index, kind) {
  const due = normaliseDate(field(row, 'dueDate', 'due_date', 'startDate', 'start_date', 'date') || state.date);
  const start = normaliseDate(field(row, 'startDate', 'start_date', 'dueDate', 'due_date', 'date') || due);
  const end = normaliseDate(field(row, 'endDate', 'end_date', 'dueDate', 'due_date', 'date') || due);
  const text = `${field(row, 'project', 'area')} ${field(row, 'source')} ${field(row, 'title')} ${field(row, 'notes')}`;

  return {
    id: field(row, 'id') || `${kind === 'reminder' ? 'RMD' : 'T'}-${index + 1}`,
    kind,
    title: field(row, 'title') || 'Untitled item',
    project: field(row, 'project', 'area') || 'General',
    source: field(row, 'source') || 'Actarium',
    status: field(row, 'status') || 'Not started',
    priority: field(row, 'priority') || 'Normal',
    start, end, due,
    recurrence: field(row, 'recurrence') || 'None',
    repeatUntil: normaliseDate(field(row, 'repeatUntil', 'repeat_until')),
    notes: field(row, 'notes'),
    link: field(row, 'link'),
    completedAt: field(row, 'completedAt', 'completed_at'),
    taskType: kind === 'reminder' ? 'Reminder' : (field(row, 'taskType', 'task_type') || (/work|zalando|nike|office/i.test(text) ? 'Work' : 'Personal')),
    alarmEnabled: kind === 'reminder' && yes(field(row, 'alarmEnabled', 'alarm_enabled')),
    alarmTime: kind === 'reminder' ? field(row, 'alarmTime', 'alarm_time') : '',
    snoozeUntil: kind === 'reminder' ? field(row, 'snoozeUntil', 'snooze_until') : ''
  };
}

function normaliseApp(row, index) {
  const label = field(row, 'label') || 'Link';
  const info = `${label} ${field(row, 'notes')}`.toLowerCase();
  return {
    id: field(row, 'id') || `APP-${index + 1}`,
    label,
    emoji: field(row, 'emoji') || '🔗',
    url: field(row, 'url'),
    github: field(row, 'githubUrl', 'github_url'),
    notes: field(row, 'notes'),
    status: field(row, 'status') || 'Active',
    order: Number(field(row, 'sortOrder', 'sort_order') || 999),
    group: field(row, 'group') || (/n26|paypal|drive|gmail|github|netlify/.test(info) ? 'Admin links' : /actarium|chrisfit|viaticum|artifex|onda|organon/.test(info) ? 'My apps' : 'Creative links')
  };
}

function normaliseEvent(row) {
  return {
    date: normaliseDate(field(row, 'date', 'RealDate')),
    status: field(row, 'status', 'Status') || 'Unsure',
    statusEmoji: field(row, 'statusEmoji', 'status_emoji') || '🤔',
    location: field(row, 'location', 'Location'),
    locationEmoji: field(row, 'locationEmoji', 'location_emoji') || '📍',
    event: field(row, 'event', 'Event'),
    eventEmoji: field(row, 'eventEmoji', 'event_emoji') || '🎒',
    schedule: field(row, 'schedule', 'Schedule') || field(row, 'details', 'Details')
  };
}

function normaliseSchedule(payload) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const routine = (payload.routine || []).flatMap(row => days.map((day, index) => row[day] ? ({
    title: row[day],
    emoji: row.emoji || (index < 5 ? '💼' : '🌙'),
    days: day.slice(0, 3)
  }) : null).filter(Boolean));

  return routine.concat((payload.schedule || []).map(row => ({
    title: field(row, 'title') || 'Scheduled item',
    emoji: field(row, 'emoji') || '🗓️',
    days: field(row, 'days')
  })));
}

function render() {
  root.innerHTML = '';
  const shell = el('main', 'shell');
  shell.append(renderHeader(), renderDesktop(), renderMobile());
  root.append(shell);
  if (state.modal) root.append(renderModal());
}

function renderHeader() {
  const header = el('header', 'top');
  const dayCard = el('section', 'day-card');
  dayCard.innerHTML = `
    <div class="top-line">
      <div class="brand"><img class="logo" src="icon.png" alt="Actarium"><span class="brand-name">ACTARIUM</span><span class="version">${CONFIG.version}</span><span class="last-sync">${esc(syncLabel())}</span></div>
      <div class="utility"></div>
    </div>
    <nav class="desktop-tabs"></nav>
    <nav class="mobile-tabs"></nav>
    <div class="day-title"><button type="button" class="day-name">${esc(dayName(state.date))}</button><div class="day-date">${esc(dayDate(state.date))}</div></div>
    <div class="day-bottom"><div class="context"></div><div class="actions"></div></div>
  `;

  dayCard.querySelector('.utility').append(iconButton(state.theme === 'dark' ? '☀️' : '🌙', toggleTheme), iconButton('⚙️', () => openSimple('settings')));

  [['today', '🌅 Today'], ['week', '🗓️ Week'], ['month', '🌘 Month'], ['tasks', '✅ Tasks']].forEach(([key, label]) => {
    dayCard.querySelector('.desktop-tabs').append(labelledButton(label, `tab ${state.desktopView === key ? 'active' : ''}`, () => {
      state.desktopView = key;
      state.appsOpen = false;
      render();
    }));
  });

  [['all', '🌐 All'], ['tasks', '✅ Tasks'], ['chrisfit', '🥦 ChrisFit'], ['viaticum', '🎒 Viaticum']].forEach(([key, label]) => {
    dayCard.querySelector('.mobile-tabs').append(labelledButton(label, `tab ${state.mobileView === key ? 'active' : ''}`, () => {
      state.mobileView = key;
      state.appsOpen = false;
      render();
    }));
  });

  dayCard.querySelector('.day-name').onclick = openCalendar;
  const context = dayContext();
  const contextPill = el('span', 'context-pill');
  contextPill.textContent = `${context.emoji} ${context.title}`;
  dayCard.querySelector('.context').append(contextPill);

  dayCard.querySelector('.actions').append(
    labelledButton('🧩 Apps', 'small-btn', () => { state.appsOpen = !state.appsOpen; render(); }),
    labelledButton('🗄️ Archive', 'small-btn', () => openSimple('archive')),
    labelledButton('➕ New task', 'small-btn accent', () => openItem('task'))
  );

  header.append(dayCard);
  if (state.appsOpen) header.append(renderAppsMenu());
  return header;
}

function renderAppsMenu() {
  const menu = el('section', 'apps-menu apps-menu-simple');
  ['My apps', 'Admin links', 'Creative links'].forEach(group => {
    const column = el('div', 'apps-col');
    column.innerHTML = `<h3>${esc(group)}</h3>`;
    state.data.apps.filter(item => item.group === group).forEach(item => {
      const row = el('div', 'app-link-row');
      row.innerHTML = `<a href="${attr(item.url)}" target="_blank" rel="noreferrer">${esc(item.label)}</a>`;
      column.append(row);
    });
    menu.append(column);
  });
  return menu;
}

function renderDesktop() {
  const view = el('section', 'desktop-view');
  if (state.desktopView === 'tasks') {
    const grid = el('div', 'desktop-task-grid');
    grid.append(
      taskCard('🏠 Personal tasks', state.data.tasks.filter(item => !archived(item) && !work(item)), 'tasks'),
      taskCard('💼 Work tasks', state.data.tasks.filter(item => !archived(item) && work(item)), 'tasks'),
      taskCard('🔔 Reminders', state.data.reminders.filter(item => !archived(item)), 'rem')
    );
    view.append(grid);
    return view;
  }

  const [start, end] = state.desktopView === 'week' ? weekRange() : state.desktopView === 'month' ? monthRange() : [state.date, state.date];
  const rangeTitle = state.desktopView === 'week' ? 'Next 7 days' : state.desktopView === 'month' ? 'Next 30 days' : 'Tasks';
  const grid = el('div', 'desktop-grid');
  const left = el('div', 'stack');
  const right = el('div', 'stack');
  left.append(chrisFitCard(), viaticumCard());

  if (state.desktopView === 'today') {
    const overdue = state.data.tasks.filter(item => !archived(item) && item.recurrence === 'None' && item.start < state.date).sort((a, b) => a.start.localeCompare(b.start));
    if (overdue.length) right.append(taskCard('🚨 Outstanding', overdue, 'out'));
  }

  right.append(
    taskCard(state.desktopView === 'today' ? '✅ Tasks' : `✅ ${rangeTitle}`, state.data.tasks.filter(item => overlaps(item, start, end)), 'tasks'),
    taskCard(state.desktopView === 'today' ? '🔔 Reminders' : `🔔 ${rangeTitle}`, state.data.reminders.filter(item => overlaps(item, start, end)), 'rem')
  );
  grid.append(left, right);
  view.append(grid);
  return view;
}

function renderMobile() {
  const viewer = el('section', 'mobile-view card');
  if (state.mobileView === 'all' || state.mobileView === 'chrisfit') viewer.append(viewerSection('🥦 ChrisFit', chrisFitBody(), CONFIG.chrisFit));
  if (state.mobileView === 'all' || state.mobileView === 'viaticum') viewer.append(viewerSection('🎒 Viaticum', viaticumBody(), CONFIG.viaticum));
  if (state.mobileView === 'all' || state.mobileView === 'tasks') viewer.append(viewerSection('✅ Tasks & reminders', tasksBody()));
  return viewer;
}

function viewerSection(title, content, url = '') {
  const section = el('section', 'viewer-section');
  section.style.position = 'relative';
  section.innerHTML = `<h3>${esc(title)}</h3>`;
  if (url) {
    const open = document.createElement('a');
    open.className = 'open-link';
    open.href = url;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = '🔗 Open';
    open.style.cssText = 'position:absolute;top:10px;right:0;min-height:30px;padding:0 9px;font-size:.75rem;';
    section.append(open);
  }
  section.append(content);
  return section;
}

function chrisFitCard() {
  const card = el('article', 'card fit');
  card.append(cardHead('🥦 ChrisFit', CONFIG.chrisFit), chrisFitBody());
  return card;
}

function chrisFitBody() {
  const summary = fitness();
  const body = el('div', 'app-body');
  const grid = el('div', 'mini-grid');
  grid.append(
    mini('Daily Summary', [['🥦 Food', summary.dailyFood], ['🔥 Burn', summary.dailyBurn], ['📉 Deficit', summary.dailyDeficit]]),
    mini('Weekly Summary', [['🥦 Food', summary.weeklyFood], ['🔥 Burn', summary.weeklyBurn], ['📉 Deficit', summary.weeklyDeficit]])
  );
  const weight = el('div', 'weight');
  weight.innerHTML = `<b>⚖️ Weight</b><strong>${esc(summary.weight)}</strong>${summary.bmi ? `<span>${esc(summary.bmi)}</span>` : ''}`;
  body.append(grid, weight);
  return body;
}

function viaticumCard() {
  const card = el('article', 'card viaticum');
  card.append(cardHead('🎒 Viaticum', CONFIG.viaticum), viaticumBody());
  return card;
}

function viaticumBody() {
  const today = state.data.events.find(item => item.date === state.date) || {};
  const week = state.data.events.filter(item => inside(item.date, ...weekRange()));
  const next = week.find(item => item.date >= state.date) || {};
  const body = el('div', 'app-body');
  const grid = el('div', 'mini-grid');
  grid.append(
    mini('Daily Summary', [[today.statusEmoji || '🤔', today.status || 'Unsure'], [today.locationEmoji || '📍', today.location || '—'], [today.eventEmoji || '🎒', today.event || 'Check Viaticum']]),
    mini('Upcoming', [['🗓️ Items', String(week.length)], ['📍', locations(week) || '—'], ['➡️', next.event || next.location || '—']])
  );
  body.append(grid, info('Schedule', today.schedule || 'Open Viaticum and check schedule, maps, paid/unpaid, and codes.'));
  return body;
}

function cardHead(title, url) {
  const head = el('div', 'card-head');
  head.innerHTML = `<h2>${title}</h2>`;
  const open = document.createElement('a');
  open.className = 'open-link';
  open.href = url;
  open.target = '_blank';
  open.rel = 'noreferrer';
  open.textContent = '🔗 Open';
  head.append(open);
  return head;
}

function mini(title, rows) {
  const box = el('div', 'mini');
  box.innerHTML = `<h3>${esc(title)}</h3>`;
  rows.forEach(([label, output]) => {
    const row = el('div', 'summary');
    row.innerHTML = `<span>${esc(label)}</span><strong>${esc(output)}</strong>`;
    box.append(row);
  });
  return box;
}

function info(title, text) {
  const box = el('div', 'info');
  box.innerHTML = `<b>${esc(title)}</b><p>${esc(text)}</p>`;
  return box;
}

function tasksBody() {
  const body = el('div', 'tasks-body');
  const controls = el('div', 'task-controls');
  [['all', '🌐 All'], ['personal', '🏠 Personal'], ['work', '💼 Work']].forEach(([key, label]) => {
    controls.append(labelledButton(label, `filter ${state.taskFilter === key ? 'active' : ''}`, () => {
      state.taskFilter = key;
      render();
    }));
  });
  controls.append(iconButton('✓', markSelectedDone));

  const tasks = state.data.tasks.filter(item => overlaps(item, state.date, state.date));
  const reminders = state.data.reminders.filter(item => overlaps(item, state.date, state.date));
  body.append(controls, listSection('✅ Tasks', filtered(tasks)), listSection('🔔 Reminders', reminders));
  return body;
}

function taskCard(title, items, tone) {
  const card = el('article', `card task-card ${tone || ''}`);
  const head = el('div', 'card-head');
  head.innerHTML = `<h2>${esc(title)}</h2>`;
  const doneButton = iconButton('✓', markSelectedDone);
  doneButton.className = 'header-tick';
  doneButton.title = 'Mark selected as done';
  head.append(doneButton);
  card.append(head, taskList(items));
  return card;
}

function listSection(title, items) {
  const section = el('section', 'list-section');
  section.innerHTML = `<h4>${esc(title)}</h4>`;
  section.append(taskList(items));
  return section;
}

function taskList(items) {
  const list = el('div', 'list');
  items.forEach(item => list.append(taskRow(item)));
  if (!items.length) {
    const empty = el('p', 'empty');
    empty.textContent = 'No items here.';
    list.append(empty);
  }
  return list;
}

function taskRow(item) {
  const row = el('article', `task-row ${done(item) ? 'done' : ''}`);
  const selectedKey = `${item.kind}:${item.id}`;
  const checkbox = el('button', `check ${state.selected.has(selectedKey) ? 'selected' : ''}`);
  checkbox.type = 'button';
  checkbox.textContent = done(item) ? '✓' : '';
  checkbox.onclick = () => {
    state.selected.has(selectedKey) ? state.selected.delete(selectedKey) : state.selected.add(selectedKey);
    render();
  };

  const detail = el('button', 'task-detail');
  detail.type = 'button';
  const kindIcon = item.kind === 'reminder' ? '🔔' : (work(item) ? '💼' : '🏠');
  const date = nextItemDate(item, state.date) || item.start || item.due;
  detail.innerHTML = `<h3>${done(item) ? '✅ ' : ''}${kindIcon} ${esc(item.title)}</h3>
    <p>${esc(item.project)} · ${esc(date)}</p>
    <div class="meta"><span>${esc(done(item) ? '✅ Done' : item.status)}</span><span>${esc(item.priority)}</span>${item.kind === 'reminder' && item.alarmEnabled ? `<span>🔔 ${esc(item.alarmTime || 'Alarm')}</span>` : ''}</div>`;
  detail.onclick = () => openEdit(item);

  const inspect = iconButton('🔎', () => openEdit(item));
  inspect.className = 'more';
  row.append(checkbox, detail, inspect);
  return row;
}

function renderModal() {
  const backdrop = el('div', 'modal-back');
  const modal = el('section', 'modal');
  backdrop.append(modal);
  backdrop.onclick = event => {
    if (event.target === backdrop) closeModal();
  };

  if (state.modal.type === 'settings') settingsModal(modal);
  else if (state.modal.type === 'archive') archiveModal(modal);
  else if (state.modal.type === 'date') dateModal(modal);
  else itemModal(modal);
  return backdrop;
}

function modalHead(title) {
  const head = el('div', 'modal-head');
  head.innerHTML = `<h2>${esc(title)}</h2>`;
  head.append(iconButton('✕', closeModal));
  return head;
}

function settingsModal(modal) {
  modal.append(modalHead('⚙️ Settings'));
  const body = el('div', 'modal-body');
  [['📊 Open Actarium Sheet', CONFIG.sheet], ['🐙 Open GitHub repo', CONFIG.repo], ['🥦 Open ChrisFit', CONFIG.chrisFit], ['🎒 Open Viaticum', CONFIG.viaticum]].forEach(([label, url]) => {
    const link = document.createElement('a');
    link.className = 'settings-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = label;
    body.append(link);
  });
  body.append(info(CONFIG.version, `${state.connection}${state.lastSync && state.lastSync !== 'Offline' ? ` · ${syncLabel()}` : ''}`));
  modal.append(body);
}

function archiveModal(modal) {
  modal.append(modalHead('🗄️ Archive'));
  const body = el('div', 'modal-body');
  body.append(taskList(state.data.tasks.concat(state.data.reminders).filter(archived)));
  modal.append(body);
}

function dateModal(modal) {
  const cursor = asDate(state.modal.cursor || state.date);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;

  modal.append(modalHead('📅 Choose a date'));
  const body = el('div', 'modal-body calendar-modal');
  const navigation = el('div', 'calendar-nav');
  const previous = iconButton('‹', () => {
    state.modal.cursor = iso(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    render();
  });
  const next = iconButton('›', () => {
    state.modal.cursor = iso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    render();
  });
  const label = el('strong', 'calendar-month-label');
  label.textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  navigation.append(previous, label, next);

  const weekdays = el('div', 'calendar-weekdays');
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
    const cell = el('span');
    cell.textContent = day;
    weekdays.append(cell);
  });

  const grid = el('div', 'calendar-grid');
  for (let slot = 0; slot < offset + daysInMonth; slot += 1) {
    if (slot < offset) {
      grid.append(el('span', 'calendar-blank'));
      continue;
    }
    const day = slot - offset + 1;
    const value = iso(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    const button = el('button', `calendar-day ${value === state.date ? 'selected' : ''} ${value === iso(new Date()) ? 'today' : ''}`);
    button.type = 'button';
    button.textContent = String(day);
    button.onclick = () => {
      state.date = value;
      chooseDefaultView();
      closeModal();
    };
    grid.append(button);
  }

  body.append(navigation, weekdays, grid);
  modal.append(body);
}

function openSimple(type) {
  state.appsOpen = false;
  state.modal = { type };
  render();
}

function openCalendar() {
  state.appsOpen = false;
  state.modal = { type: 'date', cursor: iso(new Date(asDate(state.date).getFullYear(), asDate(state.date).getMonth(), 1)) };
  render();
}

function openItem(kind) {
  state.appsOpen = false;
  state.modal = { type: 'item', kind, item: null, draft: newDraft(kind) };
  render();
}

function openEdit(item) {
  state.appsOpen = false;
  state.modal = {
    type: 'item',
    kind: item.kind,
    item,
    draft: {
      title: item.title,
      project: item.project,
      start: item.start || item.due || state.date,
      end: item.end || item.start || state.date,
      priority: item.priority || 'Normal',
      status: item.status || 'Not started',
      taskType: item.taskType || 'Personal',
      recurrence: item.recurrence || 'None',
      repeatUntil: item.repeatUntil || '',
      link: item.link || '',
      notes: item.notes || '',
      alarmEnabled: Boolean(item.alarmEnabled),
      alarmTime: item.alarmTime || ''
    }
  };
  render();
}

function duplicateCurrentItem() {
  const { kind, draft } = state.modal;
  state.appsOpen = false;
  state.modal = { type: 'item', kind, item: null, draft: { ...draft } };
  render();
}

function newDraft() {
  return {
    title: '', project: 'General', start: state.date, end: state.date,
    priority: 'Normal', status: 'Not started', taskType: 'Personal',
    recurrence: 'None', repeatUntil: '', link: '', notes: '',
    alarmEnabled: false, alarmTime: ''
  };
}

function itemModal(modal) {
  const { kind, item, draft } = state.modal;
  modal.append(modalHead(item ? '✏️ Edit item' : '➕ New task'));
  const body = el('div', 'modal-body');

  const kindToggle = el('div', 'kind-toggle');
  kindToggle.append(
    labelledButton('✅ Task', `kind-option ${kind === 'task' ? 'active' : ''}`, () => switchKind('task')),
    labelledButton('🔔 Reminder', `kind-option ${kind === 'reminder' ? 'active' : ''}`, () => switchKind('reminder'))
  );

  const title = inputField('Title', draft.title);
  title.input.oninput = () => { state.modal.draft.title = title.input.value; };

  const dates = el('div', 'form-two');
  const start = inputField(kind === 'reminder' ? 'Reminder date' : 'Start date', draft.start, 'date');
  const end = inputField('End date', draft.end, 'date');
  start.input.oninput = () => {
    state.modal.draft.start = start.input.value;
    if (!end.input.value || end.input.value < start.input.value) {
      end.input.value = start.input.value;
      state.modal.draft.end = start.input.value;
    }
  };
  end.input.oninput = () => { state.modal.draft.end = end.input.value; };
  dates.append(start.wrap, end.wrap);
  body.append(kindToggle, title.wrap, dates);

  if (kind === 'reminder') body.append(alarmField());

  const project = projectField(draft.project);
  const properties = el('div', 'form-two');
  const priority = selectField('Priority', draft.priority, ['Low', 'Normal', 'High', 'Urgent']);
  const status = selectField('Status', draft.status, ['Not started', 'In progress', 'Done', 'Cancelled']);
  priority.select.onchange = () => { state.modal.draft.priority = priority.select.value; };
  status.select.onchange = () => { state.modal.draft.status = status.select.value; };
  properties.append(priority.wrap, status.wrap);

  const recurrenceRow = el('div', 'form-two');
  const recurrence = selectField('Repeat', draft.recurrence, ['None', 'Daily', 'Weekly', 'Weekdays', 'Monthly']);
  const repeatUntil = inputField('Repeat until', draft.repeatUntil, 'date');
  recurrence.select.onchange = () => { state.modal.draft.recurrence = recurrence.select.value; };
  repeatUntil.input.oninput = () => { state.modal.draft.repeatUntil = repeatUntil.input.value; };
  recurrenceRow.append(recurrence.wrap, repeatUntil.wrap);

  const link = inputField('Link', draft.link);
  link.input.oninput = () => { state.modal.draft.link = link.input.value; };
  const notes = textareaField('Notes', draft.notes);
  notes.textarea.oninput = () => { state.modal.draft.notes = notes.textarea.value; };

  const actions = el('div', 'editor-actions');
  actions.append(labelledButton('💾 Save', 'save', () => saveItem(project)));
  if (item) actions.append(labelledButton('⧉ Duplicate', 'save duplicate-action', duplicateCurrentItem));

  body.append(project.wrap, properties);
  if (kind === 'task') body.append(taskTypeField());
  body.append(recurrenceRow, link.wrap, notes.wrap, actions);
  modal.append(body);
}

function alarmField() {
  const wrap = el('div', 'field');
  wrap.innerHTML = '<span>Alarm</span>';
  const row = el('div', 'form-two');
  const toggle = el('div', 'kind-toggle');
  toggle.append(
    labelledButton('No', `kind-option ${!state.modal.draft.alarmEnabled ? 'active' : ''}`, () => { state.modal.draft.alarmEnabled = false; render(); }),
    labelledButton('Yes', `kind-option ${state.modal.draft.alarmEnabled ? 'active' : ''}`, () => { state.modal.draft.alarmEnabled = true; render(); })
  );
  const time = document.createElement('input');
  time.type = 'time';
  time.className = 'input';
  time.value = state.modal.draft.alarmTime || '';
  time.disabled = !state.modal.draft.alarmEnabled;
  time.setAttribute('aria-label', 'Alarm time');
  time.oninput = () => { state.modal.draft.alarmTime = time.value; };
  row.append(toggle, time);
  wrap.append(row);
  return wrap;
}

function taskTypeField() {
  const wrap = el('div', 'field');
  wrap.innerHTML = '<span>Task type</span>';
  const toggle = el('div', 'kind-toggle');
  toggle.append(
    labelledButton('🏠 Personal', `kind-option ${state.modal.draft.taskType !== 'Work' ? 'active' : ''}`, () => { state.modal.draft.taskType = 'Personal'; render(); }),
    labelledButton('💼 Work', `kind-option ${state.modal.draft.taskType === 'Work' ? 'active' : ''}`, () => { state.modal.draft.taskType = 'Work'; render(); })
  );
  wrap.append(toggle);
  return wrap;
}

function projectField(initialValue) {
  const wrap = el('div', 'field project-field');
  wrap.innerHTML = '<span>Project</span>';
  const row = el('div', 'project-row');
  const select = document.createElement('select');
  select.className = 'input project-select';
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Current projects';
  select.append(prompt);
  projects().forEach(project => {
    const option = document.createElement('option');
    option.value = project;
    option.textContent = project;
    if (project === initialValue) option.selected = true;
    select.append(option);
  });

  const custom = document.createElement('input');
  custom.className = 'input project-custom';
  custom.placeholder = 'New / custom project';
  custom.value = initialValue || '';
  select.onchange = () => {
    if (select.value) {
      custom.value = select.value;
      state.modal.draft.project = select.value;
    }
  };
  custom.oninput = () => {
    state.modal.draft.project = custom.value;
    if (select.value !== custom.value) select.value = '';
  };
  row.append(select, custom);
  wrap.append(row);
  return { wrap, select, custom };
}

function inputField(label, value, type = 'text') {
  const wrap = el('label', 'field');
  wrap.innerHTML = `<span>${esc(label)}</span>`;
  const input = document.createElement('input');
  input.type = type;
  input.value = value || '';
  input.className = 'input';
  wrap.append(input);
  return { wrap, input };
}

function textareaField(label, value) {
  const wrap = el('label', 'field');
  wrap.innerHTML = `<span>${esc(label)}</span>`;
  const textarea = document.createElement('textarea');
  textarea.className = 'input textarea';
  textarea.value = value || '';
  wrap.append(textarea);
  return { wrap, textarea };
}

function selectField(label, current, options) {
  const wrap = el('label', 'field');
  wrap.innerHTML = `<span>${esc(label)}</span>`;
  const select = document.createElement('select');
  select.className = 'input';
  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (value === current) option.selected = true;
    select.append(option);
  });
  wrap.append(select);
  return { wrap, select };
}

function switchKind(kind) {
  state.modal.kind = kind;
  if (kind === 'reminder') state.modal.draft.taskType = 'Reminder';
  render();
}

async function saveItem(projectControl) {
  const { kind, item: existing, draft } = state.modal;
  const project = (projectControl.custom.value || projectControl.select.value || 'General').trim();
  const output = {
    id: existing?.id || `local-${Date.now()}`,
    kind,
    title: draft.title || 'Untitled item',
    project,
    source: existing?.source || 'Actarium',
    status: draft.status || 'Not started',
    priority: draft.priority || 'Normal',
    start: draft.start || state.date,
    end: kind === 'reminder' ? (draft.start || state.date) : (draft.end || draft.start || state.date),
    due: draft.start || state.date,
    recurrence: draft.recurrence || 'None',
    repeatUntil: draft.repeatUntil || '',
    link: draft.link || '',
    notes: draft.notes || '',
    completedAt: draft.status === 'Done' ? (existing?.completedAt || new Date().toISOString()) : '',
    taskType: kind === 'reminder' ? 'Reminder' : (draft.taskType || 'Personal'),
    alarmEnabled: kind === 'reminder' && Boolean(draft.alarmEnabled),
    alarmTime: kind === 'reminder' && draft.alarmEnabled ? (draft.alarmTime || '') : ''
  };

  if (kind === 'reminder' && output.alarmEnabled) {
    if (!output.alarmTime) {
      alert('Choose an alarm time or set Alarm to No.');
      return;
    }
    const capability = await enableReminderAlarmCapability();
    if (capability.notification === 'denied') alert('The reminder will save, but notifications are blocked. Allow notifications for Actarium to receive the browser alert.');
  }

  const collection = kind === 'reminder' ? state.data.reminders : state.data.tasks;
  const index = collection.findIndex(current => String(current.id) === String(output.id));
  if (index >= 0) collection.splice(index, 1, output);
  else collection.unshift(output);
  closeModal();

  try {
    const action = kind === 'reminder' ? 'saveReminder' : 'saveTask';
    const payloadKey = kind === 'reminder' ? 'reminder' : 'task';
    const response = await request(action, { [payloadKey]: output });
    const stored = normaliseItem(response[payloadKey] || output, 0, kind);
    const storedIndex = collection.findIndex(current => String(current.id) === String(output.id));
    if (storedIndex >= 0) collection.splice(storedIndex, 1, stored);
    state.connection = 'Saved';
    markSynced();
  } catch (error) {
    console.warn(error);
    state.connection = 'Saved locally — deploy the current Apps Script code to store changes';
  }
  render();
}

async function markSelectedDone() {
  if (!state.selected.size) {
    alert('Tick one or more tasks or reminders first.');
    return;
  }

  const tasks = [];
  const reminders = [];
  state.selected.forEach(key => {
    const [kind, id] = key.split(':');
    if (kind === 'reminder') reminders.push(id);
    else tasks.push(id);
  });

  const completedAt = new Date().toISOString();
  state.data.tasks = state.data.tasks.map(item => tasks.includes(String(item.id)) ? { ...item, status: 'Done', completedAt } : item);
  state.data.reminders = state.data.reminders.map(item => reminders.includes(String(item.id)) ? { ...item, status: 'Done', completedAt } : item);
  state.selected.clear();
  render();

  try {
    const jobs = [];
    if (tasks.length) jobs.push(request('markTasksDone', { ids: tasks, completedAt }));
    if (reminders.length) jobs.push(request('markRemindersDone', { ids: reminders, completedAt }));
    await Promise.all(jobs);
    state.connection = 'Saved';
    markSynced();
  } catch (error) {
    console.warn(error);
    state.connection = 'Saved locally — deploy the current Apps Script code to store changes';
  }
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('actarium.theme', state.theme);
  document.documentElement.dataset.theme = state.theme;
  render();
}

function dayContext() {
  const event = state.data.events.find(item => item.date === state.date);
  if (event?.location && !/^(berlin|home)$/i.test(event.location)) return { emoji: '🎒', title: `Trip in progress · ${event.location}` };
  const weekday = asDate(state.date).toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase();
  return state.data.schedule.find(item => !item.days || item.days.toLowerCase().includes(weekday)) || { emoji: '💼', title: 'Work day' };
}

function chooseDefaultView() {
  const reminders = state.data.reminders.filter(item => !archived(item));
  if (reminders.some(item => overlaps(item, state.date, state.date))) {
    state.desktopView = 'today';
    return;
  }
  if (reminders.some(item => overlaps(item, ...weekRange()))) {
    state.desktopView = 'week';
    return;
  }
  if (reminders.some(item => overlaps(item, ...monthRange()))) {
    state.desktopView = 'month';
    return;
  }
  state.desktopView = 'today';
}

function fitness() {
  const entry = state.data.feed.find(item => /chrisfit/i.test(item.source));
  let payload = {};
  try { payload = JSON.parse(entry?.payload || '{}'); } catch {}
  return {
    dailyFood: payload.dailyFood || '0 / 1500',
    dailyBurn: payload.dailyBurn || '0 / 2500',
    dailyDeficit: payload.dailyDeficit || '0 / -500',
    weeklyFood: payload.weeklyFood || '— / 10500',
    weeklyBurn: payload.weeklyBurn || '— / 17500',
    weeklyDeficit: payload.weeklyDeficit || '— / -3500',
    weight: payload.weight || '— kg',
    bmi: payload.bmi || ''
  };
}

function projects() {
  return [...new Set(state.data.tasks.concat(state.data.reminders).map(item => String(item.project || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function filtered(items) {
  if (state.taskFilter === 'work') return items.filter(work);
  if (state.taskFilter === 'personal') return items.filter(item => !work(item));
  return items;
}

function done(item) {
  return /^done$/i.test(item.status || '') || Boolean(item.completedAt);
}

function archived(item) {
  return done(item) || /cancelled|deleted/i.test(item.status || '');
}

function work(item) {
  return /work/i.test(item.taskType || '') || /work|zalando|nike|office/i.test(`${item.project} ${item.source} ${item.title} ${item.notes}`);
}

function overlaps(item, start, end) {
  const itemStart = item.start || item.due;
  return itemStart <= end && start <= (item.end || item.due || itemStart);
}

function nextItemDate(item, anchor) {
  const start = item.start || item.due || '';
  if (!start || item.recurrence === 'None') return start;
  let next = asDate(start);
  const floor = asDate(anchor);
  const until = item.repeatUntil ? asDate(item.repeatUntil) : null;

  for (let safety = 0; safety < 7300 && next < floor; safety += 1) {
    if (item.recurrence === 'Daily') next.setDate(next.getDate() + 1);
    else if (item.recurrence === 'Weekly') next.setDate(next.getDate() + 7);
    else if (item.recurrence === 'Weekdays') {
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    } else if (item.recurrence === 'Monthly') {
      const originalDay = asDate(start).getDate();
      const candidate = new Date(next.getFullYear(), next.getMonth() + 1, 1);
      const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
      candidate.setDate(Math.min(originalDay, lastDay));
      next = candidate;
    } else return start;
  }

  const result = iso(next);
  return until && result > iso(until) ? '' : result;
}

function inside(value, start, end) {
  return value && value >= start && value <= end;
}

function weekRange() {
  return futureRange(7);
}

function monthRange() {
  return futureRange(30);
}

function futureRange(days) {
  return [state.date, iso(addDays(asDate(state.date), days - 1))];
}

function addDays(date, amount) {
  const output = new Date(date);
  output.setDate(output.getDate() + amount);
  return output;
}

function locations(items) {
  return [...new Set(items.map(item => item.location).filter(Boolean))].slice(0, 2).join(', ');
}

function markSynced() {
  state.lastSync = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

function syncLabel() {
  if (!state.lastSync) return 'Syncing…';
  if (state.lastSync === 'Offline') return 'Offline';
  return `Synced ${state.lastSync}`;
}

function dayName(value) {
  return asDate(value).toLocaleDateString('en-GB', { weekday: 'long' });
}

function dayDate(value) {
  return asDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function normaliseDate(value) {
  return value ? iso(value) : '';
}

function iso(value) {
  const date = asDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function asDate(value) {
  if (value instanceof Date) return value;
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

function field(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function yes(value) {
  return value === true || /^(yes|true|1|on)$/i.test(String(value || ''));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function attr(value) {
  return esc(value).replace(/`/g, '');
}

function el(tag, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function labelledButton(label, className, handler) {
  const button = el('button', className);
  button.type = 'button';
  const parts = String(label).match(/^(\S+)\s*(.*)$/);
  button.innerHTML = `<span class="emoji">${esc(parts?.[1] || '')}</span>${parts?.[2] ? `<span>${esc(parts[2])}</span>` : ''}`;
  button.onclick = handler;
  return button;
}

function iconButton(label, handler) {
  const button = el('button', 'icon');
  button.type = 'button';
  button.textContent = label;
  button.onclick = handler;
  return button;
}

function demoData() {
  return normalise({
    tasks: [
      { id: 'T-0001', title: 'Wire Actarium app to this Google Sheet', project: 'Apps', priority: 'High', date: state.date },
      { id: 'T-0002', title: 'Review Nike PO confirmations', project: 'Zalando', task_type: 'Work', priority: 'High', date: state.date }
    ],
    reminders: [
      { id: 'RMD-0001', title: 'Check Actarium after deployment', project: 'Apps', date: state.date, alarm_enabled: 'No' }
    ],
    apps: [
      { label: 'Actarium', emoji: '📋', url: 'https://cinaedvsstudios.github.io/actarium/', group: 'My apps', status: 'Active' },
      { label: 'ChrisFit', emoji: '⚖️', url: CONFIG.chrisFit, group: 'My apps', status: 'Active' },
      { label: 'Viaticum', emoji: '🎒', url: CONFIG.viaticum, group: 'My apps', status: 'Active' }
    ],
    routine: [{ emoji: '💼', monday: 'Work day', tuesday: 'Work day', wednesday: 'Work day', thursday: 'Work day', friday: 'Work day' }],
    viaticumEvents: [{ date: state.date, status: 'Unsure', location: 'Berlin', event: 'Check Viaticum', schedule: 'Open Viaticum and check schedule, maps, paid/unpaid, and codes.' }]
  });
}
