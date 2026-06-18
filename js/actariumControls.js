(() => {
  const API = () => String(window.ACTARIUM_API || '');
  const MOBILE_KEY = 'actarium.mobileView';
  const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  let data = null;
  let restoreMobileDone = false;
  let queued = false;
  let lastOpened = null;
  let managerMode = 'routine';

  function val(row, ...names) {
    const keys = Object.keys(row || {});
    for (const name of names) {
      const key = keys.find(candidate => candidate.toLowerCase() === String(name).toLowerCase());
      if (key && String(row[key] ?? '').trim() !== '') return row[key];
    }
    return '';
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function asDate(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(value || Date.now());
  }

  function iso(value) {
    const date = asDate(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(value, days) {
    const output = asDate(value);
    output.setDate(output.getDate() + days);
    return output;
  }

  function displayDate(value) {
    const date = asDate(value);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
  }

  function pageDate() {
    const text = String(document.querySelector('.day-date')?.textContent || '').trim();
    const long = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (long) return iso(new Date(`${long[2]} ${long[1]}, ${long[3]}`));
    const short = text.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (short) return `20${short[3]}-${short[2]}-${short[1]}`;
    return iso(new Date());
  }

  async function getBootstrap() {
    const url = `${API()}?action=bootstrap`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.success === false) throw new Error(payload.error || 'Backend rejected request');
    data = payload;
    return payload;
  }

  async function post(action, payload = {}) {
    const response = await fetch(API(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
    const result = await response.json();
    if (result.success === false) throw new Error(result.error || 'Backend rejected request');
    return result;
  }

  function active(item) {
    const status = String(val(item, 'status')).toLowerCase();
    return !/done|cancelled|deleted/.test(status) && !val(item, 'completed_at', 'completedAt');
  }

  function recurrenceDate(item, anchor) {
    const original = val(item, 'start_date', 'startDate', 'due_date', 'dueDate', 'date');
    const recurrence = String(val(item, 'recurrence') || 'None');
    if (!original || recurrence === 'None') return original;
    const until = val(item, 'repeat_until', 'repeatUntil');
    const floor = asDate(anchor);
    let next = asDate(original);
    const originalDay = next.getDate();

    for (let guard = 0; guard < 7300 && next < floor; guard += 1) {
      if (recurrence === 'Daily') next = addDays(next, 1);
      else if (recurrence === 'Weekly') next = addDays(next, 7);
      else if (recurrence === 'Weekdays') {
        next = addDays(next, 1);
        while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
      } else if (recurrence === 'Monthly') {
        const candidate = new Date(next.getFullYear(), next.getMonth() + 1, 1);
        candidate.setDate(Math.min(originalDay, new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()));
        next = candidate;
      } else return original;
    }

    const result = iso(next);
    return until && result > iso(until) ? '' : result;
  }

  function inRange(item, start, end) {
    const next = recurrenceDate(item, start);
    return Boolean(next && next >= start && next <= end);
  }

  function isWork(item) {
    return /work|zalando|nike|office/i.test(`${val(item, 'task_type', 'taskType')} ${val(item, 'project', 'area')} ${val(item, 'source')} ${val(item, 'title')} ${val(item, 'notes')}`);
  }

  function selectedWindow(anchor) {
    const reminders = (data?.reminders || []).filter(active);
    const weekEnd = iso(addDays(anchor, 6));
    const monthEnd = iso(addDays(anchor, 29));
    if (reminders.some(item => inRange(item, anchor, anchor))) return { title: 'Today', start: anchor, end: anchor };
    if (reminders.some(item => inRange(item, anchor, weekEnd))) return { title: 'Next 7 days', start: anchor, end: weekEnd };
    return { title: 'Next 30 days', start: anchor, end: monthEnd };
  }

  function arrangeDesktopButtons() {
    if (!window.matchMedia('(min-width: 901px)').matches) return;
    const tabs = document.querySelector('.desktop-tabs');
    const actions = document.querySelector('.day-bottom .actions');
    if (!tabs || !actions || !tabs.children.length) return;
    const buttons = [...tabs.querySelectorAll('button')];
    buttons.forEach(button => button.classList.add('actarium-uniform-control'));
    actions.prepend(...buttons);
    tabs.hidden = true;
  }

  function removeGenericWorkDay() {
    const pill = document.querySelector('.context-pill');
    if (pill && /^\s*(?:💼\s*)?Work day\s*$/i.test(pill.textContent || '')) pill.remove();
  }

  function formatDates() {
    const date = document.querySelector('.day-date');
    const text = String(date?.textContent || '').trim();
    const long = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (date && long && !date.dataset.compact) {
      date.textContent = displayDate(new Date(`${long[2]} ${long[1]}, ${long[3]}`));
      date.dataset.compact = 'true';
    }
    document.querySelectorAll('.task-detail p').forEach(node => {
      if (node.dataset.compact) return;
      node.textContent = node.textContent.replace(/\b\d{4}-\d{2}-\d{2}\b/g, value => displayDate(value));
      node.dataset.compact = 'true';
    });
  }

  function mobileKey(button) {
    const text = String(button.textContent || '').toLowerCase();
    if (text.includes('chrisfit')) return 'chrisfit';
    if (text.includes('viaticum')) return 'viaticum';
    if (text.includes('task')) return 'tasks';
    return 'all';
  }

  function persistMobileTab(event) {
    const button = event.target.closest('.mobile-tabs button');
    if (button) localStorage.setItem(MOBILE_KEY, mobileKey(button));
  }

  function restoreMobileTab() {
    if (restoreMobileDone || !window.matchMedia('(max-width: 900px)').matches) return;
    const saved = localStorage.getItem(MOBILE_KEY) || 'all';
    const buttons = [...document.querySelectorAll('.mobile-tabs button')];
    if (!buttons.length) return;
    restoreMobileDone = true;
    const wanted = buttons.find(button => mobileKey(button) === saved);
    if (wanted && !wanted.classList.contains('active')) wanted.click();
  }

  function rollingCard(item, kind, anchor) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'actarium-rolling-card';
    const icon = kind === 'reminder' ? '🔔' : (isWork(item) ? '💼' : '🏠');
    card.innerHTML = `<strong>${icon} ${esc(val(item, 'title') || 'Untitled item')}</strong><span>${esc(val(item, 'project', 'area') || 'General')} · ${esc(displayDate(recurrenceDate(item, anchor)))}</span>`;
    card.onclick = () => openQuickItem(item, kind);
    return card;
  }

  function renderMobileRolling() {
    if (!data || !window.matchMedia('(max-width: 900px)').matches) return;
    const section = [...document.querySelectorAll('.viewer-section')].find(node => /Tasks\s*&\s*reminders/i.test(node.querySelector('h3')?.textContent || ''));
    const original = section?.querySelector('.tasks-body');
    if (!section || !original) return;

    const anchor = pageDate();
    const windowData = selectedWindow(anchor);
    const signature = `${anchor}:${windowData.title}:${(data.tasks || []).length}:${(data.reminders || []).length}`;
    if (section.dataset.rollingSignature === signature) return;
    section.dataset.rollingSignature = signature;
    original.hidden = true;
    section.querySelector('.actarium-mobile-rolling')?.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'actarium-mobile-rolling';
    wrapper.innerHTML = `<div class="actarium-window-label">${esc(windowData.title)}</div>`;

    const filters = document.createElement('div');
    filters.className = 'actarium-mobile-filters';
    let filter = 'all';
    const tasksList = document.createElement('div');
    const remindersList = document.createElement('div');

    function draw() {
      tasksList.replaceChildren();
      remindersList.replaceChildren();
      const tasks = (data.tasks || []).filter(active).filter(item => inRange(item, windowData.start, windowData.end));
      const reminders = (data.reminders || []).filter(active).filter(item => inRange(item, windowData.start, windowData.end));
      const shown = filter === 'work' ? tasks.filter(isWork) : filter === 'personal' ? tasks.filter(item => !isWork(item)) : tasks;

      const tasksHead = document.createElement('h4');
      tasksHead.textContent = `✅ Tasks · ${windowData.title}`;
      tasksList.append(tasksHead);
      if (shown.length) shown.forEach(item => tasksList.append(rollingCard(item, 'task', windowData.start)));
      else tasksList.insertAdjacentHTML('beforeend', '<p class="actarium-empty">No tasks in this window.</p>');

      const remindersHead = document.createElement('h4');
      remindersHead.textContent = `🔔 Reminders · ${windowData.title}`;
      remindersList.append(remindersHead);
      if (reminders.length) reminders.forEach(item => remindersList.append(rollingCard(item, 'reminder', windowData.start)));
      else remindersList.insertAdjacentHTML('beforeend', '<p class="actarium-empty">No reminders in this window.</p>');

      [...filters.querySelectorAll('button')].forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
    }

    [['all', '🌐 All'], ['personal', '🏠 Personal'], ['work', '💼 Work']].forEach(([key, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = key;
      button.textContent = label;
      button.onclick = () => { filter = key; draw(); };
      filters.append(button);
    });

    wrapper.append(filters, tasksList, remindersList);
    section.append(wrapper);
    draw();
  }

  function injectDeleteButton() {
    const modal = document.querySelector('.modal');
    const actions = modal?.querySelector('.editor-actions');
    const title = modal?.querySelector('.modal-head h2')?.textContent || '';
    if (!modal || !actions || !/Edit item/i.test(title) || actions.querySelector('.actarium-delete-item')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'save actarium-delete-item';
    button.textContent = '🗑 Delete';
    button.onclick = async () => {
      if (!lastOpened) {
        alert('Open the item again, then choose Delete.');
        return;
      }
      if (!confirm('Are you sure you want to remove this?')) return;
      try {
        await post(lastOpened.kind === 'reminder' ? 'deleteReminder' : 'deleteTask', { id: lastOpened.id });
        window.location.reload();
      } catch (error) {
        alert(`Could not remove the item: ${error.message}`);
      }
    };
    actions.append(button);
  }

  function captureOpenedItem(event) {
    const detail = event.target.closest('.task-detail');
    if (!detail || !data) return;
    const title = String(detail.querySelector('h3')?.textContent || '').replace(/^✅\s*/, '').replace(/^[^\w]+\s*/, '').trim();
    const info = String(detail.querySelector('p')?.textContent || '');
    const [project, visibleDate] = info.split(' · ').map(value => value.trim());
    const kind = /^🔔/.test(String(detail.querySelector('h3')?.textContent || '')) ? 'reminder' : 'task';
    const records = kind === 'reminder' ? data.reminders || [] : data.tasks || [];
    const candidates = records.filter(item => String(val(item, 'title')) === title && String(val(item, 'project', 'area') || 'General') === project);
    const byDate = candidates.find(item => displayDate(recurrenceDate(item, pageDate())) === visibleDate || displayDate(val(item, 'start_date', 'due_date', 'date')) === visibleDate);
    lastOpened = { kind, ...(byDate || candidates[0] || {}) };
  }

  function closeOverlay() {
    document.querySelector('.actarium-overlay')?.remove();
  }

  function overlay(title) {
    closeOverlay();
    const back = document.createElement('div');
    back.className = 'actarium-overlay';
    const panel = document.createElement('section');
    panel.className = 'actarium-panel';
    back.append(panel);
    back.onclick = event => { if (event.target === back) closeOverlay(); };
    const head = document.createElement('div');
    head.className = 'actarium-panel-head';
    head.innerHTML = `<h2>${esc(title)}</h2>`;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.onclick = closeOverlay;
    head.append(close);
    panel.append(head);
    document.body.append(back);
    return panel;
  }

  function formInput(label, value = '', type = 'text') {
    const wrap = document.createElement('label');
    wrap.className = 'actarium-field';
    wrap.innerHTML = `<span>${esc(label)}</span>`;
    const input = document.createElement('input');
    input.type = type;
    input.value = value || '';
    wrap.append(input);
    return { wrap, input };
  }

  function formTextarea(label, value = '') {
    const wrap = document.createElement('label');
    wrap.className = 'actarium-field actarium-wide';
    wrap.innerHTML = `<span>${esc(label)}</span>`;
    const textarea = document.createElement('textarea');
    textarea.value = value || '';
    wrap.append(textarea);
    return { wrap, textarea };
  }

  function formSelect(label, value, choices) {
    const wrap = document.createElement('label');
    wrap.className = 'actarium-field';
    wrap.innerHTML = `<span>${esc(label)}</span>`;
    const select = document.createElement('select');
    choices.forEach(choice => {
      const option = document.createElement('option');
      option.value = choice;
      option.textContent = choice;
      option.selected = choice === value;
      select.append(option);
    });
    wrap.append(select);
    return { wrap, select };
  }

  function openQuickItem(item, kind) {
    const panel = overlay(kind === 'reminder' ? 'Edit reminder' : 'Edit task');
    const body = document.createElement('div');
    body.className = 'actarium-panel-body';
    const title = formInput('Title', val(item, 'title'));
    const project = formInput('Project', val(item, 'project', 'area') || 'General');
    const date = formInput(kind === 'reminder' ? 'Reminder date' : 'Start date', recurrenceDate(item, pageDate()) || val(item, 'start_date', 'due_date', 'date'), 'date');
    const recurrence = formSelect('Repeat', val(item, 'recurrence') || 'None', ['None', 'Daily', 'Weekly', 'Weekdays', 'Monthly']);
    const notes = formTextarea('Notes', val(item, 'notes'));
    const grid = document.createElement('div');
    grid.className = 'actarium-form-grid';
    grid.append(title.wrap, project.wrap, date.wrap, recurrence.wrap, notes.wrap);
    body.append(grid);

    const actions = document.createElement('div');
    actions.className = 'actarium-panel-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = '💾 Save';
    save.onclick = async () => {
      const payload = { ...item, title: title.input.value, project: project.input.value, start: date.input.value, due: date.input.value, recurrence: recurrence.select.value, notes: notes.textarea.value };
      try {
        await post(kind === 'reminder' ? 'saveReminder' : 'saveTask', { [kind === 'reminder' ? 'reminder' : 'task']: payload });
        window.location.reload();
      } catch (error) {
        alert(`Could not save the item: ${error.message}`);
      }
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '🗑 Delete';
    remove.onclick = async () => {
      if (!confirm('Are you sure you want to remove this?')) return;
      try {
        await post(kind === 'reminder' ? 'deleteReminder' : 'deleteTask', { id: val(item, 'id') });
        window.location.reload();
      } catch (error) {
        alert(`Could not remove the item: ${error.message}`);
      }
    };
    actions.append(save, remove);
    body.append(actions);
    panel.append(body);
  }

  function addSettingsEntry() {
    const modal = document.querySelector('.modal');
    const body = modal?.querySelector('.modal-body');
    const title = modal?.querySelector('.modal-head h2')?.textContent || '';
    if (!body || !/Settings/i.test(title) || body.querySelector('.actarium-schedule-entry')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'actarium-schedule-entry';
    button.textContent = '🗓 Edit schedules & routines';
    button.onclick = () => openScheduleRoutineManager();
    body.append(button);
  }

  async function openScheduleRoutineManager() {
    try {
      await getBootstrap();
    } catch (error) {
      alert(`Could not load schedules and routines: ${error.message}`);
      return;
    }
    const panel = overlay('Schedules & routines');
    const body = document.createElement('div');
    body.className = 'actarium-panel-body';
    panel.append(body);

    function renderManager() {
      body.replaceChildren();
      const tabs = document.createElement('div');
      tabs.className = 'actarium-manager-tabs';
      [['routine', '🗓 Routines'], ['schedule', '⏱ Schedules']].forEach(([key, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = key === managerMode ? 'active' : '';
        button.textContent = label;
        button.onclick = () => { managerMode = key; renderManager(); };
        tabs.append(button);
      });
      body.append(tabs);
      if (managerMode === 'routine') renderRoutineManager(body, renderManager);
      else renderScheduleManager(body, renderManager);
    }

    renderManager();
  }

  function renderRoutineManager(body, rerender) {
    const add = document.createElement('section');
    add.className = 'actarium-manager-add';
    add.innerHTML = '<h3>Add new routine</h3>';
    const fields = routineFields({ label: '', emoji: '🗓️' });
    add.append(fields.grid);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '➕ Add routine';
    button.onclick = async () => {
      try {
        await post('saveRoutine', { routine: fields.read() });
        await getBootstrap();
        rerender();
      } catch (error) { alert(`Could not add routine: ${error.message}`); }
    };
    add.append(button);
    body.append(add);

    const list = document.createElement('section');
    list.className = 'actarium-manager-list';
    list.innerHTML = '<h3>Current routines</h3>';
    (data.routine || []).forEach(record => {
      const row = document.createElement('article');
      row.className = 'actarium-manager-row';
      const fields = routineFields(record);
      row.append(fields.grid, managerActions('saveRoutine', 'deleteRoutine', record, fields.read, rerender));
      list.append(row);
    });
    body.append(list);
  }

  function routineFields(record) {
    const grid = document.createElement('div');
    grid.className = 'actarium-form-grid actarium-routine-grid';
    const label = formInput('Label', val(record, 'label') || 'Routine');
    const emoji = formInput('Emoji', val(record, 'emoji') || '🗓️');
    grid.append(label.wrap, emoji.wrap);
    const dayInputs = {};
    DAY_NAMES.forEach(day => {
      const field = formInput(day[0].toUpperCase() + day.slice(1), val(record, day));
      dayInputs[day] = field.input;
      grid.append(field.wrap);
    });
    return { grid, read: () => ({ id: val(record, 'id'), label: label.input.value, emoji: emoji.input.value, ...Object.fromEntries(DAY_NAMES.map(day => [day, dayInputs[day].value])) }) };
  }

  function renderScheduleManager(body, rerender) {
    const add = document.createElement('section');
    add.className = 'actarium-manager-add';
    add.innerHTML = '<h3>Add new schedule</h3>';
    const fields = scheduleFields({ title: '', emoji: '🗓️', type: 'Weekly' });
    add.append(fields.grid);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '➕ Add schedule';
    button.onclick = async () => {
      try {
        await post('saveSchedule', { schedule: fields.read() });
        await getBootstrap();
        rerender();
      } catch (error) { alert(`Could not add schedule: ${error.message}`); }
    };
    add.append(button);
    body.append(add);

    const list = document.createElement('section');
    list.className = 'actarium-manager-list';
    list.innerHTML = '<h3>Current schedules</h3>';
    (data.schedule || []).forEach(record => {
      const row = document.createElement('article');
      row.className = 'actarium-manager-row';
      const fields = scheduleFields(record);
      row.append(fields.grid, managerActions('saveSchedule', 'deleteSchedule', record, fields.read, rerender));
      list.append(row);
    });
    body.append(list);
  }

  function scheduleFields(record) {
    const grid = document.createElement('div');
    grid.className = 'actarium-form-grid';
    const title = formInput('Title', val(record, 'title', 'label'));
    const emoji = formInput('Emoji', val(record, 'emoji') || '🗓️');
    const days = formInput('Days', val(record, 'days'));
    const type = formInput('Type', val(record, 'type') || 'Weekly');
    const start = formInput('Start time', val(record, 'start_time', 'startTime'));
    const end = formInput('End time', val(record, 'end_time', 'endTime'));
    grid.append(title.wrap, emoji.wrap, days.wrap, type.wrap, start.wrap, end.wrap);
    return { grid, read: () => ({ id: val(record, 'id'), title: title.input.value, emoji: emoji.input.value, days: days.input.value, type: type.input.value, start_time: start.input.value, end_time: end.input.value }) };
  }

  function managerActions(saveAction, deleteAction, record, read, rerender) {
    const actions = document.createElement('div');
    actions.className = 'actarium-panel-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = '💾 Save';
    save.onclick = async () => {
      try {
        const key = saveAction === 'saveRoutine' ? 'routine' : 'schedule';
        await post(saveAction, { [key]: read() });
        await getBootstrap();
        rerender();
      } catch (error) { alert(`Could not save: ${error.message}`); }
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '🗑 Delete';
    remove.onclick = async () => {
      if (!confirm('Are you sure you want to remove this?')) return;
      try {
        await post(deleteAction, { id: val(record, 'id') });
        await getBootstrap();
        rerender();
      } catch (error) { alert(`Could not remove: ${error.message}`); }
    };
    actions.append(save, remove);
    return actions;
  }

  function refresh() {
    queued = false;
    try { arrangeDesktopButtons(); } catch (error) { console.warn(error); }
    try { removeGenericWorkDay(); } catch (error) { console.warn(error); }
    try { formatDates(); } catch (error) { console.warn(error); }
    try { restoreMobileTab(); } catch (error) { console.warn(error); }
    try { injectDeleteButton(); } catch (error) { console.warn(error); }
    try { addSettingsEntry(); } catch (error) { console.warn(error); }
    try { renderMobileRolling(); } catch (error) { console.warn(error); }
  }

  function scheduleRefresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  document.addEventListener('click', persistMobileTab, true);
  document.addEventListener('click', captureOpenedItem, true);
  new MutationObserver(scheduleRefresh).observe(document.documentElement, { childList: true, subtree: true });
  getBootstrap().catch(error => console.warn('Actarium controls data unavailable:', error)).finally(scheduleRefresh);
  scheduleRefresh();
})();
