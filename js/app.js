const CONFIG = {
  version: 'v3.9',
  api: 'https://script.google.com/macros/s/AKfycbwiM61R-bfvWbbkciZBDYorbx9F3hgOXU85f5lyuC78kB1zJe1B4MmmHLw6eVk-XDeS/exec',
  sheet: 'https://docs.google.com/spreadsheets/d/1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA/edit',
  repo: 'https://github.com/cinaedvsstudios/actarium',
  chrisFit: 'https://cinaedvsstudios.github.io/chrisfit/',
  viaticum: 'https://cinaedvsstudios.github.io/Viaticum/'
};

const state = {
  date: toIso(new Date()),
  desktopView: 'today',
  mobileView: 'all',
  taskFilter: 'all',
  theme: localStorage.getItem('actarium.theme') || 'dark',
  appsOpen: false,
  modal: null,
  selected: new Set(),
  connection: 'Loading…',
  data: { tasks: [], reminders: [], apps: [], feed: [], events: [], schedule: [] }
};

document.documentElement.dataset.theme = state.theme;
const app = document.getElementById('app');
boot();

async function boot() {
  render();
  try {
    state.data = normalise(await apiRequest('bootstrap'));
    state.connection = 'Live Sheet connection';
  } catch (error) {
    console.warn('Actarium backend unavailable:', error);
    state.data = demoData();
    state.connection = 'Demo / local view';
  }
  render();
}

async function apiRequest(action, body) {
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
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.success === false) throw new Error(payload.error || 'Backend rejected request');
  return payload;
}

function normalise(payload) {
  return {
    tasks: (payload.tasks || []).map((row, index) => normaliseItem(row, index, 'task')),
    reminders: (payload.reminders || []).map((row, index) => normaliseItem(row, index, 'reminder')),
    apps: (payload.apps || [])
      .map((row, index) => normaliseApp(row, index))
      .filter(item => /^active$/i.test(item.status || 'Active'))
      .sort((a, b) => a.order - b.order),
    feed: (payload.appFeed || payload.app_feed || []).map(row => ({
      source: getValue(row, 'sourceApp', 'source_app', 'source'),
      payload: getValue(row, 'payload', 'payload_json')
    })),
    events: (payload.viaticumEvents || payload.viaticum_events || []).map(normaliseEvent),
    schedule: normaliseSchedule(payload)
  };
}

function normaliseItem(row, index, kind) {
  const due = normaliseDate(getValue(row, 'dueDate', 'due_date', 'startDate', 'start_date', 'date') || state.date);
  const start = normaliseDate(getValue(row, 'startDate', 'start_date', 'dueDate', 'due_date', 'date') || due);
  const end = normaliseDate(getValue(row, 'endDate', 'end_date', 'dueDate', 'due_date', 'date') || due);
  const text = `${getValue(row, 'project', 'area')} ${getValue(row, 'source')} ${getValue(row, 'title')} ${getValue(row, 'notes')}`;

  return {
    id: getValue(row, 'id') || `${kind === 'reminder' ? 'RMD' : 'T'}-${index + 1}`,
    kind,
    title: getValue(row, 'title') || 'Untitled item',
    project: getValue(row, 'project', 'area') || 'General',
    source: getValue(row, 'source') || 'Actarium',
    status: getValue(row, 'status') || 'Not started',
    priority: getValue(row, 'priority') || 'Normal',
    start,
    end,
    due,
    notes: getValue(row, 'notes'),
    link: getValue(row, 'link'),
    completedAt: getValue(row, 'completedAt', 'completed_at'),
    taskType: kind === 'reminder'
      ? 'Reminder'
      : (getValue(row, 'taskType', 'task_type') || (/work|zalando|nike|office/i.test(text) ? 'Work' : 'Personal'))
  };
}

function normaliseApp(row, index) {
  const label = getValue(row, 'label') || 'Link';
  const meta = `${label} ${getValue(row, 'notes')}`.toLowerCase();
  return {
    id: getValue(row, 'id') || `APP-${index + 1}`,
    label,
    emoji: getValue(row, 'emoji') || '🔗',
    url: getValue(row, 'url'),
    github: getValue(row, 'githubUrl', 'github_url'),
    notes: getValue(row, 'notes'),
    status: getValue(row, 'status') || 'Active',
    order: Number(getValue(row, 'sortOrder', 'sort_order') || 999),
    group: getValue(row, 'group') || (
      /n26|paypal|drive|gmail|github|netlify/.test(meta)
        ? 'Admin links'
        : /actarium|chrisfit|viaticum|artifex|onda|organon/.test(meta)
          ? 'My apps'
          : 'Creative links'
    )
  };
}

function normaliseEvent(row) {
  return {
    date: normaliseDate(getValue(row, 'date', 'RealDate')),
    status: getValue(row, 'status', 'Status') || 'Unsure',
    statusEmoji: getValue(row, 'statusEmoji', 'status_emoji') || '🤔',
    location: getValue(row, 'location', 'Location'),
    locationEmoji: getValue(row, 'locationEmoji', 'location_emoji') || '📍',
    event: getValue(row, 'event', 'Event'),
    eventEmoji: getValue(row, 'eventEmoji', 'event_emoji') || '🎒',
    schedule: getValue(row, 'schedule', 'Schedule') || getValue(row, 'details', 'Details')
  };
}

function normaliseSchedule(payload) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const routine = (payload.routine || []).flatMap(row => days
    .map((day, index) => row[day]
      ? { title: row[day], emoji: row.emoji || (index < 5 ? '💼' : '🌙'), days: day.slice(0, 3) }
      : null)
    .filter(Boolean));

  return routine.concat((payload.schedule || []).map(row => ({
    title: getValue(row, 'title') || 'Scheduled item',
    emoji: getValue(row, 'emoji') || '🗓️',
    days: getValue(row, 'days')
  })));
}

function render() {
  app.innerHTML = '';
  const shell = createElement('main', 'shell');
  shell.append(renderHeader(), renderDesktop(), renderMobile());
  app.append(shell);
  if (state.modal) app.append(renderModal());
}

function renderHeader() {
  const header = createElement('header', 'top');
  const dayCard = createElement('section', 'day-card');
  dayCard.innerHTML = `
    <div class="top-line">
      <div class="brand">
        <img class="logo" src="icon.png" alt="Actarium">
        <span class="brand-name">ACTARIUM</span>
        <span class="version">${CONFIG.version}</span>
      </div>
      <div class="utility"></div>
    </div>
    <nav class="desktop-tabs"></nav>
    <nav class="mobile-tabs"></nav>
    <div class="day-title">
      <button type="button" class="day-name">${escapeHtml(displayDayName(state.date))}</button>
      <div class="day-date">${escapeHtml(displayDate(state.date))}</div>
    </div>
    <div class="day-bottom">
      <div class="context"></div>
      <div class="actions"></div>
    </div>
  `;

  dayCard.querySelector('.utility').append(
    iconButton(state.theme === 'dark' ? '☀️' : '🌙', toggleTheme),
    iconButton('⚙️', () => openSimpleModal('settings'))
  );

  [
    ['today', '🌅 Today'],
    ['week', '🗓️ Week'],
    ['month', '🌘 Month'],
    ['tasks', '✅ Tasks']
  ].forEach(([key, label]) => {
    dayCard.querySelector('.desktop-tabs').append(
      labelledButton(label, `tab ${state.desktopView === key ? 'active' : ''}`, () => {
        state.desktopView = key;
        state.appsOpen = false;
        render();
      })
    );
  });

  [
    ['all', '🌐 All'],
    ['tasks', '✅ Tasks'],
    ['chrisfit', '🥦 ChrisFit'],
    ['viaticum', '🎒 Viaticum']
  ].forEach(([key, label]) => {
    dayCard.querySelector('.mobile-tabs').append(
      labelledButton(label, `tab ${state.mobileView === key ? 'active' : ''}`, () => {
        state.mobileView = key;
        state.appsOpen = false;
        render();
      })
    );
  });

  dayCard.querySelector('.day-name').onclick = () => openSimpleModal('date');

  const context = getDayContext();
  const contextPill = createElement('span', 'context-pill');
  contextPill.textContent = `${context.emoji} ${context.title}`;
  dayCard.querySelector('.context').append(contextPill);

  dayCard.querySelector('.actions').append(
    labelledButton('🧩 Apps', 'small-btn', () => {
      state.appsOpen = !state.appsOpen;
      render();
    }),
    labelledButton('🗄️ Archive', 'small-btn', () => openSimpleModal('archive')),
    labelledButton('➕ New task', 'small-btn accent', () => openItemModal('task'))
  );

  header.append(dayCard);
  if (state.appsOpen) header.append(renderAppsMenu());
  return header;
}

function renderAppsMenu() {
  const menu = createElement('section', 'apps-menu');
  ['My apps', 'Admin links', 'Creative links'].forEach(group => {
    const column = createElement('div', 'apps-col');
    column.innerHTML = `<h3>${escapeHtml(group)}</h3>`;
    state.data.apps.filter(item => item.group === group).forEach(item => {
      const row = createElement('div', 'app-link-row');
      row.innerHTML = `
        <a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">
          <span>${escapeHtml(item.emoji)}</span>
          <span><b>${escapeHtml(item.label)}</b>${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ''}</span>
        </a>
        ${item.github ? `<a class="github" href="${escapeAttribute(item.github)}" target="_blank" rel="noreferrer">🐙</a>` : ''}
      `;
      column.append(row);
    });
    menu.append(column);
  });
  return menu;
}

function renderDesktop() {
  const view = createElement('section', 'desktop-view');

  if (state.desktopView === 'tasks') {
    const grid = createElement('div', 'desktop-task-grid');
    grid.append(
      renderTaskCard('🏠 Personal tasks', state.data.tasks.filter(item => !isArchived(item) && !isWork(item)), 'tasks'),
      renderTaskCard('💼 Work tasks', state.data.tasks.filter(item => !isArchived(item) && isWork(item)), 'tasks'),
      renderTaskCard('🔔 Reminders', state.data.reminders.filter(item => !isArchived(item)), 'rem')
    );
    view.append(grid);
    return view;
  }

  const [start, end] = state.desktopView === 'week'
    ? currentWeekRange()
    : state.desktopView === 'month'
      ? currentMonthRange()
      : [state.date, state.date];

  const grid = createElement('div', 'desktop-grid');
  const left = createElement('div', 'stack');
  const right = createElement('div', 'stack');
  left.append(renderChrisFitCard(), renderViaticumCard());

  if (state.desktopView === 'today') {
    const outstanding = state.data.tasks
      .filter(item => !isArchived(item) && item.start < state.date)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (outstanding.length) right.append(renderTaskCard('🚨 Outstanding', outstanding, 'out'));
  }

  right.append(
    renderTaskCard(state.desktopView === 'today' ? '✅ Tasks' : `✅ ${state.desktopView} tasks`, state.data.tasks.filter(item => overlaps(item, start, end)), 'tasks'),
    renderTaskCard('🔔 Reminders', state.data.reminders.filter(item => overlaps(item, start, end)), 'rem')
  );

  grid.append(left, right);
  view.append(grid);
  return view;
}

function renderMobile() {
  const viewer = createElement('section', 'mobile-view card');

  if (state.mobileView === 'all' || state.mobileView === 'chrisfit') {
    viewer.append(renderViewerSection('🥦 ChrisFit', renderChrisFitBody(), CONFIG.chrisFit));
  }
  if (state.mobileView === 'all' || state.mobileView === 'viaticum') {
    viewer.append(renderViewerSection('🎒 Viaticum', renderViaticumBody(), CONFIG.viaticum));
  }
  if (state.mobileView === 'all' || state.mobileView === 'tasks') {
    viewer.append(renderViewerSection('✅ Tasks & reminders', renderTasksBody()));
  }

  return viewer;
}

function renderViewerSection(title, content, openUrl = '') {
  const section = createElement('section', 'viewer-section');
  section.style.position = 'relative';
  section.innerHTML = `<h3>${escapeHtml(title)}</h3>`;

  if (openUrl) {
    const open = document.createElement('a');
    open.className = 'open-link';
    open.href = openUrl;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = '🔗 Open';
    open.style.cssText = 'position:absolute;top:10px;right:0;min-height:30px;padding:0 9px;font-size:.75rem;';
    section.append(open);
  }

  section.append(content);
  return section;
}

function renderChrisFitCard() {
  const card = createElement('article', 'card fit');
  card.append(renderCardHead('🥦 ChrisFit', CONFIG.chrisFit), renderChrisFitBody());
  return card;
}

function renderChrisFitBody() {
  const summary = getFitnessSummary();
  const body = createElement('div', 'app-body');
  const grid = createElement('div', 'mini-grid');
  grid.append(
    renderMini('Daily Summary', [['🥦 Food', summary.dailyFood], ['🔥 Burn', summary.dailyBurn], ['📉 Deficit', summary.dailyDeficit]]),
    renderMini('Weekly Summary', [['🥦 Food', summary.weeklyFood], ['🔥 Burn', summary.weeklyBurn], ['📉 Deficit', summary.weeklyDeficit]])
  );
  const weight = createElement('div', 'weight');
  weight.innerHTML = `<b>⚖️ Weight</b><strong>${escapeHtml(summary.weight)}</strong>${summary.bmi ? `<span>${escapeHtml(summary.bmi)}</span>` : ''}`;
  body.append(grid, weight);
  return body;
}

function renderViaticumCard() {
  const card = createElement('article', 'card viaticum');
  card.append(renderCardHead('🎒 Viaticum', CONFIG.viaticum), renderViaticumBody());
  return card;
}

function renderViaticumBody() {
  const today = state.data.events.find(item => item.date === state.date) || {};
  const week = state.data.events.filter(item => inRange(item.date, ...currentWeekRange()));
  const next = week.find(item => item.date >= state.date) || {};
  const body = createElement('div', 'app-body');
  const grid = createElement('div', 'mini-grid');
  grid.append(
    renderMini('Daily Summary', [
      [today.statusEmoji || '🤔', today.status || 'Unsure'],
      [today.locationEmoji || '📍', today.location || '—'],
      [today.eventEmoji || '🎒', today.event || 'Check Viaticum']
    ]),
    renderMini('Weekly Summary', [
      ['🗓️ Items', String(week.length)],
      ['📍', uniqueLocations(week) || '—'],
      ['➡️', next.event || next.location || '—']
    ])
  );
  body.append(grid, renderInfo('Schedule', today.schedule || 'Open Viaticum and check schedule, maps, paid/unpaid, and codes.'));
  return body;
}

function renderCardHead(title, url) {
  const head = createElement('div', 'card-head');
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

function renderMini(title, rows) {
  const mini = createElement('div', 'mini');
  mini.innerHTML = `<h3>${escapeHtml(title)}</h3>`;
  rows.forEach(([label, output]) => {
    const row = createElement('div', 'summary');
    row.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(output)}</strong>`;
    mini.append(row);
  });
  return mini;
}

function renderInfo(title, text) {
  const info = createElement('div', 'info');
  info.innerHTML = `<b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p>`;
  return info;
}

function renderTasksBody() {
  const body = createElement('div', 'tasks-body');
  const controls = createElement('div', 'task-controls');
  [
    ['all', '🌐 All'],
    ['personal', '🏠 Personal'],
    ['work', '💼 Work']
  ].forEach(([key, label]) => {
    controls.append(labelledButton(label, `filter ${state.taskFilter === key ? 'active' : ''}`, () => {
      state.taskFilter = key;
      render();
    }));
  });
  controls.append(iconButton('✓', markSelectedDone));

  const todayTasks = state.data.tasks.filter(item => overlaps(item, state.date, state.date));
  const todayReminders = state.data.reminders.filter(item => overlaps(item, state.date, state.date));
  body.append(
    controls,
    renderListSection('✅ Tasks', filterTasks(todayTasks)),
    renderListSection('🔔 Reminders', todayReminders)
  );
  return body;
}

function renderTaskCard(title, items, tone) {
  const card = createElement('article', `card task-card ${tone || ''}`);
  const head = createElement('div', 'card-head');
  head.innerHTML = `<h2>${escapeHtml(title)}</h2>`;
  const done = iconButton('✓', markSelectedDone);
  done.className = 'header-tick';
  done.title = 'Mark selected as done';
  head.append(done);
  card.append(head, renderTaskList(items));
  return card;
}

function renderListSection(title, items) {
  const section = createElement('section', 'list-section');
  section.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
  section.append(renderTaskList(items));
  return section;
}

function renderTaskList(items) {
  const list = createElement('div', 'list');
  items.forEach(item => list.append(renderTaskRow(item)));
  if (!items.length) {
    const empty = createElement('p', 'empty');
    empty.textContent = 'No items here.';
    list.append(empty);
  }
  return list;
}

function renderTaskRow(item) {
  const row = createElement('article', `task-row ${isDone(item) ? 'done' : ''}`);
  const selectionKey = `${item.kind}:${item.id}`;
  const check = createElement('button', `check ${state.selected.has(selectionKey) ? 'selected' : ''}`);
  check.type = 'button';
  check.textContent = isDone(item) ? '✓' : '';
  check.onclick = () => {
    state.selected.has(selectionKey) ? state.selected.delete(selectionKey) : state.selected.add(selectionKey);
    render();
  };

  const detail = createElement('button', 'task-detail');
  detail.type = 'button';
  const kindIcon = item.kind === 'reminder' ? '🔔' : (isWork(item) ? '💼' : '🏠');
  detail.innerHTML = `
    <h3>${isDone(item) ? '✅ ' : ''}${kindIcon} ${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.project)} · ${escapeHtml(item.start || item.due)}</p>
    <div class="meta"><span>${escapeHtml(isDone(item) ? '✅ Done' : item.status)}</span><span>${escapeHtml(item.priority)}</span></div>
  `;
  detail.onclick = () => openEditItem(item);

  const inspect = iconButton('🔎', () => openEditItem(item));
  inspect.className = 'more';
  row.append(check, detail, inspect);
  return row;
}

function renderModal() {
  const backdrop = createElement('div', 'modal-back');
  const modal = createElement('section', 'modal');
  backdrop.append(modal);
  backdrop.onclick = event => {
    if (event.target === backdrop) closeModal();
  };

  if (state.modal.type === 'settings') renderSettingsModal(modal);
  else if (state.modal.type === 'archive') renderArchiveModal(modal);
  else if (state.modal.type === 'date') renderDateModal(modal);
  else renderItemModal(modal);

  return backdrop;
}

function renderModalHead(title) {
  const head = createElement('div', 'modal-head');
  head.innerHTML = `<h2>${escapeHtml(title)}</h2>`;
  head.append(iconButton('✕', closeModal));
  return head;
}

function renderSettingsModal(modal) {
  modal.append(renderModalHead('⚙️ Settings'));
  const body = createElement('div', 'modal-body');
  [
    ['📊 Open Actarium Sheet', CONFIG.sheet],
    ['🐙 Open GitHub repo', CONFIG.repo],
    ['🥦 Open ChrisFit', CONFIG.chrisFit],
    ['🎒 Open Viaticum', CONFIG.viaticum]
  ].forEach(([label, url]) => {
    const link = document.createElement('a');
    link.className = 'settings-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = label;
    body.append(link);
  });
  body.append(renderInfo(CONFIG.version, state.connection));
  modal.append(body);
}

function renderArchiveModal(modal) {
  modal.append(renderModalHead('🗄️ Archive'));
  const body = createElement('div', 'modal-body');
  body.append(renderTaskList(state.data.tasks.concat(state.data.reminders).filter(isArchived)));
  modal.append(body);
}

function renderDateModal(modal) {
  modal.append(renderModalHead('📅 Pick date'));
  const body = createElement('div', 'modal-body');
  const date = document.createElement('input');
  date.type = 'date';
  date.className = 'input';
  date.value = state.date;
  body.append(date, labelledButton('💾 Save', 'save', () => {
    state.date = date.value || state.date;
    closeModal();
  }));
  modal.append(body);
}

function openItemModal(kind) {
  state.appsOpen = false;
  state.modal = {
    type: 'item',
    kind,
    item: null,
    draft: {
      title: '',
      project: 'General',
      start: state.date,
      end: state.date,
      priority: 'Normal',
      status: 'Not started',
      notes: ''
    }
  };
  render();
}

function openEditItem(item) {
  state.appsOpen = false;
  state.modal = {
    type: 'item',
    kind: item.kind || 'task',
    item,
    draft: {
      title: item.title,
      project: item.project,
      start: item.start || item.due || state.date,
      end: item.end || item.start || state.date,
      priority: item.priority || 'Normal',
      status: item.status || 'Not started',
      notes: item.notes || ''
    }
  };
  render();
}

function renderItemModal(modal) {
  const { kind, item, draft } = state.modal;
  modal.append(renderModalHead(item ? '✏️ Edit item' : '➕ New task'));
  const body = createElement('div', 'modal-body');

  const kindToggle = createElement('div', 'kind-toggle');
  kindToggle.append(
    labelledButton('✅ Task', `kind-option ${kind === 'task' ? 'active' : ''}`, () => switchKind('task')),
    labelledButton('🔔 Reminder', `kind-option ${kind === 'reminder' ? 'active' : ''}`, () => switchKind('reminder'))
  );

  const title = inputField('Title', draft.title);
  title.input.oninput = () => { state.modal.draft.title = title.input.value; };

  const dateRow = createElement('div', 'form-two');
  const start = inputField(kind === 'reminder' ? 'Reminder date' : 'Start date', draft.start, 'date');
  const end = inputField('End date', draft.end, 'date');
  start.input.oninput = () => { state.modal.draft.start = start.input.value; };
  end.input.oninput = () => { state.modal.draft.end = end.input.value; };
  dateRow.append(start.wrap, end.wrap);

  const project = projectField(draft.project);
  const properties = createElement('div', 'form-two');
  const priority = selectField('Priority', draft.priority, ['Low', 'Normal', 'High', 'Urgent']);
  const status = selectField('Status', draft.status, ['Not started', 'In progress', 'Done', 'Cancelled']);
  priority.select.onchange = () => { state.modal.draft.priority = priority.select.value; };
  status.select.onchange = () => { state.modal.draft.status = status.select.value; };
  properties.append(priority.wrap, status.wrap);

  const notes = textareaField('Notes', draft.notes);
  notes.textarea.oninput = () => { state.modal.draft.notes = notes.textarea.value; };

  body.append(
    kindToggle,
    title.wrap,
    dateRow,
    project.wrap,
    properties,
    notes.wrap,
    labelledButton('💾 Save', 'save', () => saveItem(project))
  );
  modal.append(body);
}

function switchKind(kind) {
  state.modal.kind = kind;
  render();
}

function projectField(initialValue) {
  const wrap = createElement('div', 'field project-field');
  wrap.innerHTML = '<span>Project</span>';
  const row = createElement('div', 'project-row');

  const select = document.createElement('select');
  select.className = 'input project-select';
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Current projects';
  select.append(prompt);
  getProjects().forEach(project => {
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

function inputField(label, initialValue, type = 'text') {
  const wrap = createElement('label', 'field');
  wrap.innerHTML = `<span>${escapeHtml(label)}</span>`;
  const input = document.createElement('input');
  input.type = type;
  input.value = initialValue || '';
  input.className = 'input';
  wrap.append(input);
  return { wrap, input };
}

function textareaField(label, initialValue) {
  const wrap = createElement('label', 'field');
  wrap.innerHTML = `<span>${escapeHtml(label)}</span>`;
  const textarea = document.createElement('textarea');
  textarea.className = 'input textarea';
  textarea.value = initialValue || '';
  wrap.append(textarea);
  return { wrap, textarea };
}

function selectField(label, initialValue, options) {
  const wrap = createElement('label', 'field');
  wrap.innerHTML = `<span>${escapeHtml(label)}</span>`;
  const select = document.createElement('select');
  select.className = 'input';
  options.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === initialValue) option.selected = true;
    select.append(option);
  });
  wrap.append(select);
  return { wrap, select };
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
    end: draft.end || draft.start || state.date,
    due: draft.start || state.date,
    notes: draft.notes || '',
    link: existing?.link || '',
    completedAt: draft.status === 'Done' ? (existing?.completedAt || new Date().toISOString()) : '',
    taskType: kind === 'reminder' ? 'Reminder' : (existing?.taskType || 'Personal')
  };

  const collection = kind === 'reminder' ? state.data.reminders : state.data.tasks;
  const index = collection.findIndex(current => String(current.id) === String(output.id));
  if (index >= 0) collection.splice(index, 1, output);
  else collection.unshift(output);
  closeModal();

  try {
    const action = kind === 'reminder' ? 'saveReminder' : 'saveTask';
    const payloadKey = kind === 'reminder' ? 'reminder' : 'task';
    const response = await apiRequest(action, { [payloadKey]: output });
    const returned = response[payloadKey] || output;
    const normalised = normaliseItem(returned, 0, kind);
    const savedIndex = collection.findIndex(current => String(current.id) === String(output.id));
    if (savedIndex >= 0) collection.splice(savedIndex, 1, normalised);
    state.connection = 'Saved';
  } catch (error) {
    console.warn(error);
    state.connection = kind === 'reminder'
      ? 'Saved locally — Apps Script reminder deployment needed'
      : 'Saved locally — backend retry needed';
  }
  render();
}

async function markSelectedDone() {
  if (!state.selected.size) {
    alert('Tick one or more tasks or reminders first.');
    return;
  }

  const taskIds = [];
  const reminderIds = [];
  state.selected.forEach(key => {
    const [kind, id] = key.split(':');
    if (kind === 'reminder') reminderIds.push(id);
    else taskIds.push(id);
  });

  const completedAt = new Date().toISOString();
  state.data.tasks = state.data.tasks.map(item => taskIds.includes(String(item.id)) ? { ...item, status: 'Done', completedAt } : item);
  state.data.reminders = state.data.reminders.map(item => reminderIds.includes(String(item.id)) ? { ...item, status: 'Done', completedAt } : item);
  state.selected.clear();
  render();

  try {
    const calls = [];
    if (taskIds.length) calls.push(apiRequest('markTasksDone', { ids: taskIds, completedAt }));
    if (reminderIds.length) calls.push(apiRequest('markRemindersDone', { ids: reminderIds, completedAt }));
    await Promise.all(calls);
    state.connection = 'Saved';
  } catch (error) {
    console.warn(error);
    state.connection = reminderIds.length
      ? 'Saved locally — Apps Script reminder deployment needed'
      : 'Saved locally — backend retry needed';
  }
  render();
}

function openSimpleModal(type) {
  state.appsOpen = false;
  state.modal = { type };
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

function getDayContext() {
  const event = state.data.events.find(item => item.date === state.date);
  if (event?.location && !/^(berlin|home)$/i.test(event.location)) {
    return { emoji: '🎒', title: `Trip in progress · ${event.location}` };
  }

  const weekday = asDate(state.date).toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase();
  return state.data.schedule.find(item => !item.days || item.days.toLowerCase().includes(weekday))
    || { emoji: '💼', title: 'Work day' };
}

function getFitnessSummary() {
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

function getProjects() {
  return [...new Set(state.data.tasks.concat(state.data.reminders)
    .map(item => String(item.project || '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function filterTasks(items) {
  if (state.taskFilter === 'work') return items.filter(isWork);
  if (state.taskFilter === 'personal') return items.filter(item => !isWork(item));
  return items;
}

function isDone(item) {
  return /^done$/i.test(item.status || '') || Boolean(item.completedAt);
}

function isArchived(item) {
  return isDone(item) || /cancelled|deleted/i.test(item.status || '');
}

function isWork(item) {
  return /work/i.test(item.taskType || '') || /work|zalando|nike|office/i.test(`${item.project} ${item.source} ${item.title} ${item.notes}`);
}

function overlaps(item, start, end) {
  return (item.start || item.due) <= end && start <= (item.end || item.due || item.start);
}

function inRange(value, start, end) {
  return value && value >= start && value <= end;
}

function currentWeekRange() {
  const selected = asDate(state.date);
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [toIso(monday), toIso(sunday)];
}

function currentMonthRange() {
  const selected = asDate(state.date);
  return [toIso(new Date(selected.getFullYear(), selected.getMonth(), 1)), toIso(new Date(selected.getFullYear(), selected.getMonth() + 1, 0))];
}

function uniqueLocations(items) {
  return [...new Set(items.map(item => item.location).filter(Boolean))].slice(0, 2).join(', ');
}

function displayDayName(value) {
  return asDate(value).toLocaleDateString('en-GB', { weekday: 'long' });
}

function displayDate(value) {
  return asDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function normaliseDate(value) {
  return value ? toIso(value) : '';
}

function toIso(value) {
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

function getValue(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '');
}

function createElement(tag, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function labelledButton(label, className, handler) {
  const button = createElement('button', className);
  button.type = 'button';
  const parts = String(label).match(/^(\S+)\s*(.*)$/);
  button.innerHTML = `<span class="emoji">${escapeHtml(parts?.[1] || '')}</span>${parts?.[2] ? `<span>${escapeHtml(parts[2])}</span>` : ''}`;
  button.onclick = handler;
  return button;
}

function iconButton(label, handler) {
  const button = createElement('button', 'icon');
  button.type = 'button';
  button.textContent = label;
  button.onclick = handler;
  return button;
}

function demoData() {
  return normalise({
    tasks: [
      { id: 'T-1', title: 'Connect Actarium to the Sheet backend', project: 'Apps', priority: 'High', date: state.date },
      { id: 'T-2', title: 'Review Nike PO confirmations', project: 'Zalando', task_type: 'Work', priority: 'High', date: state.date }
    ],
    reminders: [
      { id: 'RMD-1', title: 'Check Actarium after deployment', project: 'Apps', date: state.date }
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
