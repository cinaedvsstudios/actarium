const CONFIG = {
  version: 'v3.14',
  api: window.ACTARIUM_API || 'https://script.google.com/macros/s/AKfycbzC47dw83euJ_T45zh0LQmtAivEHK7G_V5aHTYLYw2VhnMDAAVK0UFCF3tv5nsWM74q/exec',
  sheet: 'https://docs.google.com/spreadsheets/d/1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA/edit',
  repo: 'https://github.com/cinaedvsstudios/actarium',
  chrisFit: 'https://cinaedvsstudios.github.io/chrisfit/',
  viaticum: 'https://cinaedvsstudios.github.io/Viaticum/'
};

const state = {
  date: iso(new Date()),
  desktopView: 'today',
  mobileView: localStorage.getItem('actarium.mobileView') || 'all',
  taskFilter: 'all',
  theme: localStorage.getItem('actarium.theme') || 'dark',
  appsOpen: false,
  modal: null,
  selected: new Set(),
  lastSync: '',
  connection: 'Loading…',
  data: { tasks: [], reminders: [], routine: [], schedule: [], apps: [], feed: [], events: [] }
};

document.documentElement.dataset.theme = state.theme;
const root = document.getElementById('app');
boot();

async function boot() {
  render();
  try {
    await refreshData();
    chooseDefaultView();
  } catch (error) {
    console.warn('Actarium bootstrap failed:', error);
    state.data = demoData();
    state.connection = 'Offline preview';
    state.lastSync = 'Offline';
  }
  render();
}

async function refreshData() {
  state.data = normalise(await request('bootstrap'));
  state.connection = 'Live Sheet connection';
  state.lastSync = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

async function request(action, body) {
  if (body) {
    const response = await fetch(CONFIG.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.error || `Backend HTTP ${response.status}`);
    return payload;
  }

  const url = new URL(CONFIG.api);
  url.searchParams.set('action', action);
  const response = await fetch(url.href, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new Error(payload.error || `Backend HTTP ${response.status}`);
  return payload;
}

function normalise(payload) {
  return {
    tasks: (payload.tasks || []).map((row, index) => normaliseItem(row, index, 'task')),
    reminders: (payload.reminders || []).map((row, index) => normaliseItem(row, index, 'reminder')),
    routine: payload.routine || [],
    schedule: payload.schedule || [],
    apps: (payload.apps || []).map(normaliseApp).filter(app => /^active$/i.test(app.status || 'Active')).sort((a, b) => a.order - b.order),
    feed: (payload.appFeed || payload.app_feed || []).map(row => ({ source: field(row, 'sourceApp', 'source_app', 'source'), payload: field(row, 'payload', 'payload_json') })),
    events: (payload.viaticumEvents || payload.viaticum_events || []).map(normaliseEvent)
  };
}

function normaliseItem(row, index, kind) {
  const due = normaliseDate(field(row, 'dueDate', 'due_date', 'startDate', 'start_date', 'date') || state.date);
  const start = normaliseDate(field(row, 'startDate', 'start_date', 'dueDate', 'due_date', 'date') || due);
  const end = normaliseDate(field(row, 'endDate', 'end_date', 'dueDate', 'due_date', 'date') || due);
  return {
    id: field(row, 'id') || `${kind === 'reminder' ? 'RMD' : 'T'}-${index + 1}`,
    kind,
    title: field(row, 'title') || 'Untitled item',
    project: field(row, 'project', 'area') || 'General',
    source: field(row, 'source') || 'Actarium',
    status: field(row, 'status') || 'Not started',
    priority: field(row, 'priority') || 'Normal',
    start,
    end,
    due,
    recurrence: field(row, 'recurrence') || 'None',
    repeatUntil: normaliseDate(field(row, 'repeatUntil', 'repeat_until')),
    notes: field(row, 'notes'),
    link: field(row, 'link'),
    completedAt: field(row, 'completedAt', 'completed_at'),
    taskType: kind === 'reminder' ? 'Reminder' : (field(row, 'taskType', 'task_type') || 'Personal'),
    emoji: field(row, 'emoji') || '',
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
    url: field(row, 'url'),
    status: field(row, 'status') || 'Active',
    order: Number(field(row, 'sortOrder', 'sort_order') || 999),
    group: field(row, 'group') || (/n26|paypal|drive|gmail|github|netlify/.test(info) ? 'Admin links' : /actarium|chrisfit|viaticum|artifex|onda|organon/.test(info) ? 'My apps' : 'Creative links')
  };
}

function normaliseEvent(row) {
  return {
    date: normaliseDate(field(row, 'date', 'RealDate')),
    status: field(row, 'status', 'Status') || 'Unsure',
    location: field(row, 'location', 'Location'),
    event: field(row, 'event', 'Event'),
    schedule: field(row, 'schedule', 'Schedule') || field(row, 'details', 'Details')
  };
}

function render() {
  root.replaceChildren();
  const shell = el('main', 'actarium-shell');
  shell.append(renderHeader());
  if (state.appsOpen) shell.append(renderAppsPanel());
  shell.append(renderDesktop(), renderMobile());
  root.append(shell);
  if (state.modal) root.append(renderModal());
}

function renderHeader() {
  const header = el('header', 'actarium-header');
  const top = el('div', 'actarium-head-main');
  const brand = el('div', 'actarium-brand-stack');
  brand.innerHTML = `<img class="actarium-brand-logo" src="icon.png" alt="Actarium"><span class="actarium-version">${esc(CONFIG.version)}</span>`;

  const day = el('div', 'actarium-day-block');
  const openDay = button(dayName(state.date), 'actarium-day-button', openCalendar);
  const dateLine = el('div', 'actarium-date-line');
  const dateButton = button(formatDate(state.date), 'actarium-date', openCalendar);
  const context = routineContext();
  dateLine.append(dateButton);
  if (context) {
    const routine = el('span', 'actarium-routine-pill');
    routine.textContent = `${context.emoji ? `${context.emoji} ` : ''}${context.title}`;
    dateLine.append(routine);
  }
  if (state.lastSync && state.lastSync !== 'Offline') {
    const synced = el('span', 'actarium-sync-pill');
    synced.textContent = `Synced ${state.lastSync}`;
    dateLine.append(synced);
  }
  day.append(openDay, dateLine);
  top.append(brand, day);

  const mobileTabs = el('nav', 'actarium-mobile-tabs');
  [['all', 'All'], ['tasks', 'Tasks'], ['chrisfit', 'ChrisFit'], ['viaticum', 'Viaticum']].forEach(([key, label]) => {
    mobileTabs.append(button(label, state.mobileView === key ? 'active' : '', () => {
      state.mobileView = key;
      localStorage.setItem('actarium.mobileView', key);
      state.appsOpen = false;
      render();
    }));
  });

  const actions = el('div', 'actarium-action-row');
  actions.append(
    button(state.theme === 'dark' ? '☀️' : '🌙', 'icon-only', toggleTheme),
    button('⚙️', 'icon-only', () => openModal('settings')),
    button('Today', `desktop-only ${state.desktopView === 'today' ? 'active' : ''}`, () => switchDesktop('today')),
    button('Week', `desktop-only ${state.desktopView === 'week' ? 'active' : ''}`, () => switchDesktop('week')),
    button('Month', `desktop-only ${state.desktopView === 'month' ? 'active' : ''}`, () => switchDesktop('month')),
    button('Tasks', `desktop-only ${state.desktopView === 'tasks' ? 'active' : ''}`, () => switchDesktop('tasks')),
    button('Apps', state.appsOpen ? 'active' : '', () => { state.appsOpen = !state.appsOpen; render(); }),
    button('Archive', '', () => openModal('archive')),
    button('New task', 'primary', () => openItem('task'))
  );

  header.append(top, mobileTabs, actions);
  return header;
}

function renderAppsPanel() {
  const panel = el('section', 'actarium-apps-panel');
  ['My apps', 'Admin links', 'Creative links'].forEach(group => {
    const column = el('div', 'actarium-app-group');
    const heading = el('h3');
    heading.textContent = group;
    column.append(heading);
    const apps = state.data.apps.filter(item => item.group === group);
    if (apps.length) apps.forEach(app => {
      const link = document.createElement('a');
      link.className = 'actarium-app-link';
      link.href = app.url || '#';
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = app.label;
      column.append(link);
    });
    panel.append(column);
  });
  return panel;
}

function renderDesktop() {
  const desktop = el('section', 'actarium-desktop');
  const side = el('div', 'actarium-side-grid');
  side.append(renderChrisFit(), renderViaticum());
  const main = el('div', 'actarium-main-grid');

  if (state.desktopView === 'tasks') {
    main.append(
      renderItemCard('Personal tasks', state.data.tasks.filter(item => !archived(item) && item.taskType !== 'Work'), 'task'),
      renderItemCard('Work tasks', state.data.tasks.filter(item => !archived(item) && item.taskType === 'Work'), 'task'),
      renderItemCard('Reminders', state.data.reminders.filter(item => !archived(item)), 'reminder')
    );
  } else {
    const range = viewRange(state.desktopView);
    const title = state.desktopView === 'today' ? 'Today' : state.desktopView === 'week' ? 'Next 7 days' : 'Next 30 days';
    main.append(
      renderItemCard(`Tasks · ${title}`, state.data.tasks.filter(item => active(item) && occursInRange(item, range.start, range.end)), 'task'),
      renderItemCard(`Reminders · ${title}`, state.data.reminders.filter(item => active(item) && occursInRange(item, range.start, range.end)), 'reminder')
    );
  }

  desktop.append(side, main);
  return desktop;
}

function renderMobile() {
  const mobile = el('section', 'actarium-mobile');
  if (state.mobileView === 'all' || state.mobileView === 'chrisfit') mobile.append(renderChrisFit());
  if (state.mobileView === 'all' || state.mobileView === 'viaticum') mobile.append(renderViaticum());
  if (state.mobileView === 'all' || state.mobileView === 'tasks') {
    const range = automaticRange();
    mobile.append(
      renderItemCard(`Tasks · ${range.label}`, state.data.tasks.filter(item => active(item) && occursInRange(item, range.start, range.end)), 'task', true),
      renderItemCard(`Reminders · ${range.label}`, state.data.reminders.filter(item => active(item) && occursInRange(item, range.start, range.end)), 'reminder', true)
    );
  }
  return mobile;
}

function renderChrisFit() {
  const card = el('article', 'actarium-card actarium-not-syncing');
  card.innerHTML = `<div class="actarium-card-head"><h2>ChrisFit</h2><a class="actarium-open-link" target="_blank" rel="noreferrer" href="${attr(CONFIG.chrisFit)}">Open</a></div><div class="actarium-summary-grid"><div class="actarium-summary-box"><h3>Daily summary</h3><div class="actarium-summary-row"><span>Food</span><strong>—</strong></div><div class="actarium-summary-row"><span>Burn</span><strong>—</strong></div></div><div class="actarium-summary-box"><h3>Weekly summary</h3><div class="actarium-summary-row"><span>Food</span><strong>—</strong></div><div class="actarium-summary-row"><span>Burn</span><strong>—</strong></div></div></div>`;
  return card;
}

function renderViaticum() {
  const card = el('article', 'actarium-card actarium-not-syncing');
  card.innerHTML = `<div class="actarium-card-head"><h2>Viaticum</h2><a class="actarium-open-link" target="_blank" rel="noreferrer" href="${attr(CONFIG.viaticum)}">Open</a></div><div class="actarium-summary-grid"><div class="actarium-summary-box"><h3>Daily summary</h3><div class="actarium-summary-row"><span>Location</span><strong>—</strong></div><div class="actarium-summary-row"><span>Event</span><strong>—</strong></div></div><div class="actarium-summary-box"><h3>Upcoming</h3><div class="actarium-summary-row"><span>Items</span><strong>—</strong></div><div class="actarium-summary-row"><span>Next</span><strong>—</strong></div></div></div>`;
  return card;
}

function renderItemCard(title, items, kind, mobile = false) {
  const card = el('article', 'actarium-card');
  const head = el('div', 'actarium-section-head');
  const heading = el('h2');
  heading.textContent = title;
  head.append(heading);
  if (!mobile) head.append(button('✓', '', markSelectedDone));
  card.append(head);
  const list = el('div', 'actarium-list');
  if (items.length) items.sort((a, b) => occurrence(a, state.date).localeCompare(occurrence(b, state.date))).forEach(item => list.append(renderItem(item, mobile)));
  else {
    const empty = el('p', 'actarium-empty');
    empty.textContent = 'No items here.';
    list.append(empty);
  }
  card.append(list);
  return card;
}

function renderItem(item, mobile) {
  const row = el('article', `actarium-item ${mobile ? 'mobile' : ''}`);
  if (!mobile) {
    const key = `${item.kind}:${item.id}`;
    const check = button(done(item) ? '✓' : '', `actarium-check ${state.selected.has(key) ? 'selected' : ''}`, event => {
      event.stopPropagation();
      state.selected.has(key) ? state.selected.delete(key) : state.selected.add(key);
      render();
    });
    row.append(check);
  }

  const content = el('button', 'actarium-item-content');
  content.type = 'button';
  const title = el('h3', 'actarium-item-title');
  title.textContent = item.title;
  const meta = el('div', 'actarium-item-meta');
  const left = el('span', 'actarium-item-left');
  left.textContent = `${item.project} · ${formatDate(occurrence(item, state.date))}`;
  const right = el('span', 'actarium-item-right');
  if (item.emoji) {
    const emoji = el('span', 'actarium-emoji-chip');
    emoji.textContent = item.emoji;
    right.append(emoji);
  }
  right.append(statusPill(item.status), priorityPill(item.priority));
  meta.append(left, right);
  content.append(title, meta);
  content.onclick = () => openEdit(item);
  row.append(content);
  return row;
}

function statusPill(value) {
  const normal = String(value || 'Not started').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const pill = el('span', `actarium-pill status-${normal || 'not-started'}`);
  pill.textContent = value || 'Not started';
  return pill;
}

function priorityPill(value) {
  const normal = String(value || 'Normal').toLowerCase();
  const pill = el('span', `actarium-pill priority-${normal}`);
  pill.textContent = value || 'Normal';
  return pill;
}

function renderModal() {
  const back = el('div', 'actarium-modal-backdrop');
  const modal = el('section', 'actarium-modal');
  back.append(modal);
  if (state.modal.type === 'calendar') calendarModal(modal);
  else if (state.modal.type === 'item') itemModal(modal);
  else if (state.modal.type === 'settings') settingsModal(modal);
  else if (state.modal.type === 'manager') managerModal(modal);
  else archiveModal(modal);
  return back;
}

function modalHead(title) {
  const head = el('div', 'actarium-modal-head');
  const text = el('h2');
  text.textContent = title;
  head.append(text, button('✕', '', closeModal));
  return head;
}

function calendarModal(modal) {
  const cursor = asDate(state.modal.cursor || state.date);
  modal.append(modalHead('Choose a date'));
  const body = el('div', 'actarium-modal-body');
  const nav = el('div', 'actarium-calendar-nav');
  nav.append(
    button('‹', '', () => { state.modal.cursor = iso(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); render(); }),
    elText('strong', cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
    button('›', '', () => { state.modal.cursor = iso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); render(); })
  );
  const weekdays = el('div', 'actarium-calendar-weekdays');
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => weekdays.append(elText('span', day)));
  const grid = el('div', 'actarium-calendar-grid');
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  for (let slot = 0; slot < offset + days; slot += 1) {
    if (slot < offset) { grid.append(el('span')); continue; }
    const day = slot - offset + 1;
    const value = iso(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    const cell = button(String(day), `actarium-calendar-day ${value === state.date ? 'selected' : ''}`, () => {
      state.date = value;
      chooseDefaultView();
      closeModal();
    });
    grid.append(cell);
  }
  body.append(nav, weekdays, grid);
  modal.append(body);
}

function itemModal(modal) {
  const { item, kind, draft } = state.modal;
  modal.append(modalHead(item ? `Edit ${kind === 'reminder' ? 'reminder' : 'task'}` : `New ${kind === 'reminder' ? 'reminder' : 'task'}`));
  const body = el('div', 'actarium-modal-body');
  const tabs = el('div', 'actarium-editor-tabs');
  tabs.append(
    button('Task', kind === 'task' ? 'active' : '', () => switchKind('task')),
    button('Reminder', kind === 'reminder' ? 'active' : '', () => switchKind('reminder'))
  );
  const fields = el('div', 'actarium-form-grid');
  const title = formField('Title', draft.title);
  const emoji = formField('Custom emoji', draft.emoji);
  const project = formField('Project', draft.project);
  const start = formField(kind === 'reminder' ? 'Reminder date' : 'Start date', draft.start, 'date');
  const end = formField('End date', draft.end, 'date');
  const priority = selectField('Priority', draft.priority, ['Low', 'Normal', 'High', 'Urgent']);
  const status = selectField('Status', draft.status, ['Not started', 'In progress', 'Done', 'Cancelled']);
  const type = selectField('Task type', draft.taskType, ['Personal', 'Work']);
  const recurrence = selectField('Repeat', draft.recurrence, ['None', 'Daily', 'Weekly', 'Weekdays', 'Monthly']);
  const repeatUntil = formField('Repeat until', draft.repeatUntil, 'date');
  const link = formField('Link', draft.link);
  const notes = textAreaField('Notes', draft.notes);

  [title, emoji, project, start, end, priority, status].forEach(fieldSet => fields.append(fieldSet.wrap));
  if (kind === 'task') fields.append(type.wrap);
  fields.append(recurrence.wrap, repeatUntil.wrap, link.wrap, notes.wrap);
  if (kind === 'reminder') {
    const alarm = selectField('Alarm', draft.alarmEnabled ? 'Yes' : 'No', ['No', 'Yes']);
    const alarmTime = formField('Alarm time', draft.alarmTime, 'time');
    fields.append(alarm.wrap, alarmTime.wrap);
  }

  start.input.oninput = () => {
    if (!end.input.value || end.input.value < start.input.value) end.input.value = start.input.value;
  };
  body.append(tabs, fields);

  const actions = el('div', 'actarium-form-actions');
  actions.append(button('Save', 'primary', async () => {
    const output = {
      id: item?.id || `local-${Date.now()}`,
      kind,
      title: title.input.value || 'Untitled item',
      emoji: emoji.input.value.trim(),
      project: project.input.value || 'General',
      source: item?.source || 'Actarium',
      status: status.select.value,
      priority: priority.select.value,
      start: start.input.value || state.date,
      end: kind === 'reminder' ? (start.input.value || state.date) : (end.input.value || start.input.value || state.date),
      due: start.input.value || state.date,
      taskType: kind === 'reminder' ? 'Reminder' : type.select.value,
      recurrence: recurrence.select.value,
      repeatUntil: repeatUntil.input.value,
      link: link.input.value,
      notes: notes.textarea.value,
      alarmEnabled: kind === 'reminder' && fields.querySelector('select[name="alarm"]')?.value === 'Yes',
      alarmTime: kind === 'reminder' ? fields.querySelector('input[name="alarm-time"]')?.value || '' : ''
    };
    await saveItem(output);
  }));

  if (item) {
    actions.append(
      button('Duplicate', '', () => { state.modal = { type: 'item', kind, item: null, draft: { ...draft } }; render(); }),
      button('Mark as done', 'done-action', () => completeItem(item)),
      button('Delete', 'danger', () => deleteItem(item))
    );
  }
  body.append(actions);
  modal.append(body);
}

function settingsModal(modal) {
  modal.append(modalHead('Settings'));
  const body = el('div', 'actarium-modal-body');
  const manager = button('Edit schedules & routines', 'primary', () => { state.modal = { type: 'manager', tab: 'routine' }; render(); });
  body.append(manager);
  [[CONFIG.sheet, 'Open Actarium Sheet'], [CONFIG.repo, 'Open GitHub repo'], [CONFIG.chrisFit, 'Open ChrisFit'], [CONFIG.viaticum, 'Open Viaticum']].forEach(([url, label]) => {
    const link = document.createElement('a');
    link.className = 'actarium-settings-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = label;
    body.append(link);
  });
  body.append(elText('p', `${state.connection}${state.lastSync && state.lastSync !== 'Offline' ? ` · Synced ${state.lastSync}` : ''}`));
  modal.append(body);
}

function managerModal(modal) {
  const tab = state.modal.tab || 'routine';
  modal.append(modalHead('Schedules & routines'));
  const body = el('div', 'actarium-modal-body');
  const tabs = el('div', 'actarium-manager-tabs');
  tabs.append(
    button('Routines', tab === 'routine' ? 'active' : '', () => { state.modal.tab = 'routine'; render(); }),
    button('Schedules', tab === 'schedule' ? 'active' : '', () => { state.modal.tab = 'schedule'; render(); })
  );
  body.append(tabs);
  if (tab === 'routine') body.append(renderRoutineManager());
  else body.append(renderScheduleManager());
  modal.append(body);
}

function renderRoutineManager() {
  const section = el('section', 'actarium-manager-section');
  section.append(elText('h3', 'Add new routine'));
  const add = routineFields({ emoji: '🗓️' });
  section.append(add.grid, button('Add routine', 'primary', async () => { await saveRoutine(add.read()); }));
  section.append(elText('h3', 'Current routines'));
  if (state.data.routine.length) state.data.routine.forEach(record => {
    const row = el('article', 'actarium-manager-row');
    const fields = routineFields(record);
    const actions = el('div', 'actarium-form-actions');
    actions.append(button('Save', 'primary', async () => { await saveRoutine(fields.read()); }), button('Delete', 'danger', () => deleteRoutine(record)));
    row.append(fields.grid, actions);
    section.append(row);
  });
  return section;
}

function renderScheduleManager() {
  const section = el('section', 'actarium-manager-section');
  section.append(elText('h3', 'Add new schedule'));
  const add = scheduleFields({ emoji: '🗓️', type: 'Weekly' });
  section.append(add.grid, button('Add schedule', 'primary', async () => { await saveSchedule(add.read()); }));
  section.append(elText('h3', 'Current schedules'));
  if (state.data.schedule.length) state.data.schedule.forEach(record => {
    const row = el('article', 'actarium-manager-row');
    const fields = scheduleFields(record);
    const actions = el('div', 'actarium-form-actions');
    actions.append(button('Save', 'primary', async () => { await saveSchedule(fields.read()); }), button('Delete', 'danger', () => deleteSchedule(record)));
    row.append(fields.grid, actions);
    section.append(row);
  });
  return section;
}

function routineFields(record) {
  const grid = el('div', 'actarium-form-grid');
  const label = formField('Label', field(record, 'label') || 'Routine');
  const emoji = formField('Emoji', field(record, 'emoji') || '🗓️');
  grid.append(label.wrap, emoji.wrap);
  const fields = {};
  dayKeys().forEach(day => {
    const input = formField(capitalise(day), field(record, day));
    fields[day] = input;
    grid.append(input.wrap);
  });
  return { grid, read: () => ({ id: field(record, 'id'), label: label.input.value, emoji: emoji.input.value, ...Object.fromEntries(dayKeys().map(day => [day, fields[day].input.value])) }) };
}

function scheduleFields(record) {
  const grid = el('div', 'actarium-form-grid');
  const title = formField('Title', field(record, 'title', 'label'));
  const emoji = formField('Emoji', field(record, 'emoji') || '🗓️');
  const type = formField('Type', field(record, 'type') || 'Weekly');
  const days = formField('Days', field(record, 'days'));
  const start = formField('Start time', field(record, 'start_time', 'startTime'));
  const end = formField('End time', field(record, 'end_time', 'endTime'));
  grid.append(title.wrap, emoji.wrap, type.wrap, days.wrap, start.wrap, end.wrap);
  return { grid, read: () => ({ id: field(record, 'id'), title: title.input.value, emoji: emoji.input.value, type: type.input.value, days: days.input.value, start_time: start.input.value, end_time: end.input.value }) };
}

function archiveModal(modal) {
  modal.append(modalHead('Archive'));
  const body = el('div', 'actarium-modal-body');
  const items = state.data.tasks.concat(state.data.reminders).filter(archived);
  if (items.length) {
    const list = el('div', 'actarium-list');
    items.forEach(item => list.append(renderItem(item, true)));
    body.append(list);
  } else body.append(elText('p', 'No archived items.'));
  modal.append(body);
}

function openCalendar() {
  state.appsOpen = false;
  state.modal = { type: 'calendar', cursor: iso(new Date(asDate(state.date).getFullYear(), asDate(state.date).getMonth(), 1)) };
  render();
}

function openItem(kind) {
  state.appsOpen = false;
  state.modal = { type: 'item', kind, item: null, draft: newDraft(kind) };
  render();
}

function openEdit(item) {
  state.appsOpen = false;
  state.modal = { type: 'item', kind: item.kind, item, draft: { ...item } };
  render();
}

function openModal(type) {
  state.appsOpen = false;
  state.modal = { type };
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

function switchKind(kind) {
  state.modal.kind = kind;
  state.modal.draft = { ...state.modal.draft, kind, taskType: kind === 'reminder' ? 'Reminder' : state.modal.draft.taskType || 'Personal' };
  render();
}

function newDraft(kind) {
  return { id: '', kind, title: '', emoji: '', project: 'General', source: 'Actarium', status: 'Not started', priority: 'Normal', start: state.date, end: state.date, due: state.date, taskType: kind === 'reminder' ? 'Reminder' : 'Personal', recurrence: 'None', repeatUntil: '', link: '', notes: '', alarmEnabled: false, alarmTime: '' };
}

async function saveItem(item) {
  try {
    const action = item.kind === 'reminder' ? 'saveReminder' : 'saveTask';
    const key = item.kind === 'reminder' ? 'reminder' : 'task';
    await request(action, { [key]: item });
    await refreshData();
    closeModal();
  } catch (error) {
    alert(`Could not save: ${error.message}`);
  }
}

async function deleteItem(item) {
  if (!confirm('Are you sure you want to remove this?')) return;
  try {
    await request(item.kind === 'reminder' ? 'deleteReminder' : 'deleteTask', { id: item.id });
    await refreshData();
    closeModal();
  } catch (error) {
    alert(`Could not remove the item: ${error.message}`);
  }
}

async function completeItem(item) {
  try {
    if (item.recurrence && item.recurrence !== 'None') {
      const next = nextOccurrenceAfter(item, occurrence(item, state.date));
      const output = { ...item, start: next, due: next, end: shiftEnd(item, next), status: 'Not started', completedAt: '' };
      await request(item.kind === 'reminder' ? 'saveReminder' : 'saveTask', { [item.kind === 'reminder' ? 'reminder' : 'task']: output });
    } else {
      await request(item.kind === 'reminder' ? 'markRemindersDone' : 'markTasksDone', { ids: [item.id], completedAt: new Date().toISOString() });
    }
    await refreshData();
    closeModal();
  } catch (error) {
    alert(`Could not mark as done: ${error.message}`);
  }
}

async function markSelectedDone() {
  if (!state.selected.size) {
    alert('Select one or more tasks or reminders first.');
    return;
  }
  const selected = [...state.selected].map(key => {
    const [kind, id] = key.split(':');
    return kind === 'reminder' ? state.data.reminders.find(item => item.id === id) : state.data.tasks.find(item => item.id === id);
  }).filter(Boolean);
  for (const item of selected) await completeBatchItem(item);
  state.selected.clear();
  await refreshData();
  render();
}

async function completeBatchItem(item) {
  if (item.recurrence && item.recurrence !== 'None') {
    const next = nextOccurrenceAfter(item, occurrence(item, state.date));
    const output = { ...item, start: next, due: next, end: shiftEnd(item, next), status: 'Not started', completedAt: '' };
    await request(item.kind === 'reminder' ? 'saveReminder' : 'saveTask', { [item.kind === 'reminder' ? 'reminder' : 'task']: output });
  } else {
    await request(item.kind === 'reminder' ? 'markRemindersDone' : 'markTasksDone', { ids: [item.id], completedAt: new Date().toISOString() });
  }
}

async function saveRoutine(record) {
  try { await request('saveRoutine', { routine: record }); await refreshData(); render(); } catch (error) { alert(`Could not save routine: ${error.message}`); }
}
async function deleteRoutine(record) {
  if (!confirm('Are you sure you want to remove this?')) return;
  try { await request('deleteRoutine', { id: field(record, 'id') }); await refreshData(); render(); } catch (error) { alert(`Could not remove routine: ${error.message}`); }
}
async function saveSchedule(record) {
  try { await request('saveSchedule', { schedule: record }); await refreshData(); render(); } catch (error) { alert(`Could not save schedule: ${error.message}`); }
}
async function deleteSchedule(record) {
  if (!confirm('Are you sure you want to remove this?')) return;
  try { await request('deleteSchedule', { id: field(record, 'id') }); await refreshData(); render(); } catch (error) { alert(`Could not remove schedule: ${error.message}`); }
}

function switchDesktop(view) {
  state.desktopView = view;
  state.appsOpen = false;
  render();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('actarium.theme', state.theme);
  document.documentElement.dataset.theme = state.theme;
  render();
}

function chooseDefaultView() {
  const range = automaticRange();
  state.desktopView = range.label === 'Today' ? 'today' : range.label === 'Next 7 days' ? 'week' : 'month';
}

function automaticRange() {
  const start = state.date;
  if (state.data.reminders.some(item => active(item) && occursInRange(item, start, start))) return { label: 'Today', start, end: start };
  const week = { label: 'Next 7 days', start, end: iso(addDays(asDate(start), 6)) };
  if (state.data.reminders.some(item => active(item) && occursInRange(item, week.start, week.end))) return week;
  return { label: 'Next 30 days', start, end: iso(addDays(asDate(start), 29)) };
}

function viewRange(view) {
  if (view === 'week') return { start: state.date, end: iso(addDays(asDate(state.date), 6)) };
  if (view === 'month') return { start: state.date, end: iso(addDays(asDate(state.date), 29)) };
  return { start: state.date, end: state.date };
}

function routineContext() {
  const day = dayKeys()[asDate(state.date).getDay() === 0 ? 6 : asDate(state.date).getDay() - 1];
  const routines = state.data.routine || [];
  const primary = routines.find(row => /day\s*context/i.test(field(row, 'label'))) || routines.find(row => field(row, day));
  const title = primary ? field(primary, day) : '';
  if (title) return { title, emoji: field(primary, 'emoji') || '' };
  const schedule = (state.data.schedule || []).find(row => dayMatches(field(row, 'days'), day));
  return schedule ? { title: field(schedule, 'title', 'label'), emoji: field(schedule, 'emoji') || '' } : null;
}

function dayMatches(days, day) {
  const source = String(days || '').toLowerCase();
  const short = day.slice(0, 3);
  return source.includes(day) || source.split(/[^a-z]+/).includes(short);
}

function occurrence(item, anchor) {
  const original = item.start || item.due;
  if (!original || item.recurrence === 'None') return original;
  const floor = asDate(anchor);
  let next = asDate(original);
  const originalDay = next.getDate();
  for (let guard = 0; guard < 7300 && next < floor; guard += 1) {
    if (item.recurrence === 'Daily') next = addDays(next, 1);
    else if (item.recurrence === 'Weekly') next = addDays(next, 7);
    else if (item.recurrence === 'Weekdays') {
      next = addDays(next, 1);
      while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
    } else if (item.recurrence === 'Monthly') {
      const candidate = new Date(next.getFullYear(), next.getMonth() + 1, 1);
      candidate.setDate(Math.min(originalDay, new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()));
      next = candidate;
    } else return original;
  }
  const result = iso(next);
  return item.repeatUntil && result > item.repeatUntil ? '' : result;
}

function nextOccurrenceAfter(item, base) {
  const copied = { ...item, start: base, due: base };
  const nextDay = iso(addDays(asDate(base), 1));
  return occurrence(copied, nextDay);
}

function shiftEnd(item, nextStart) {
  if (item.kind === 'reminder') return nextStart;
  const start = asDate(item.start || item.due);
  const end = asDate(item.end || item.start || item.due);
  const duration = Math.max(0, Math.round((end - start) / 86400000));
  return iso(addDays(asDate(nextStart), duration));
}

function occursInRange(item, start, end) {
  const date = occurrence(item, start);
  return Boolean(date && date >= start && date <= end);
}

function active(item) { return !done(item) && !/cancelled|deleted/i.test(item.status || ''); }
function done(item) { return /^done$/i.test(item.status || '') || Boolean(item.completedAt); }
function archived(item) { return done(item) || /cancelled|deleted/i.test(item.status || ''); }

function dayName(value) { return asDate(value).toLocaleDateString('en-GB', { weekday: 'long' }); }
function formatDate(value) { const date = asDate(value); return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`; }
function normaliseDate(value) { return value ? iso(value) : ''; }
function iso(value) { const date = asDate(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function asDate(value) { if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate()); const text = String(value || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(text)) { const [year, month, day] = text.split('-').map(Number); return new Date(year, month - 1, day); } const parsed = new Date(text); return Number.isNaN(parsed.valueOf()) ? new Date() : parsed; }
function addDays(date, amount) { const output = asDate(date); output.setDate(output.getDate() + amount); return output; }
function dayKeys() { return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']; }
function capitalise(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function field(row, ...keys) { for (const key of keys) { if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return row[key]; } return ''; }
function yes(value) { return value === true || /^(yes|true|1|on)$/i.test(String(value || '')); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function attr(value) { return esc(value).replace(/`/g, ''); }
function el(tag, className = '') { const node = document.createElement(tag); if (className) node.className = className; return node; }
function elText(tag, text, className = '') { const node = el(tag, className); node.textContent = text; return node; }
function button(label, className = '', handler = () => {}) { const node = el('button', className); node.type = 'button'; node.textContent = label; node.onclick = handler; return node; }
function formField(label, value = '', type = 'text') { const wrap = el('label', 'actarium-field'); const text = elText('span', label); const input = document.createElement('input'); input.type = type; input.value = value || ''; if (label === 'Alarm time') input.name = 'alarm-time'; wrap.append(text, input); return { wrap, input }; }
function textAreaField(label, value = '') { const wrap = el('label', 'actarium-field full'); const text = elText('span', label); const textarea = document.createElement('textarea'); textarea.value = value || ''; wrap.append(text, textarea); return { wrap, textarea }; }
function selectField(label, value, options) { const wrap = el('label', 'actarium-field'); const text = elText('span', label); const select = document.createElement('select'); if (label === 'Alarm') select.name = 'alarm'; options.forEach(optionValue => { const option = document.createElement('option'); option.value = optionValue; option.textContent = optionValue; option.selected = optionValue === value; select.append(option); }); wrap.append(text, select); return { wrap, select }; }

function demoData() {
  return normalise({
    tasks: [{ id: 'T-0001', title: 'Pack for Cologne', project: 'Travel', status: 'Not started', priority: 'High', due_date: state.date, start_date: state.date, end_date: state.date }],
    reminders: [{ id: 'RMD-0001', title: 'Check Actarium', project: 'Apps', status: 'Not started', priority: 'Normal', date: state.date }],
    routine: [], schedule: [], apps: []
  });
}
