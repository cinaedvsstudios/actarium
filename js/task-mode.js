const ACTARIUM_TASK_MODE = (() => {
  const API = window.ACTARIUM_API;
  const root = document.getElementById('app');
  const state = {
    active: false,
    loading: false,
    saving: false,
    data: { tasks: [], reminders: [] },
    quickAdd: {
      open: false,
      start: berlinDate(),
      end: berlinDate(),
      time: '20:00',
      text: '',
      drafts: [],
      message: ''
    }
  };

  function berlinDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).reduce((out, part) => {
      if (part.type !== 'literal') out[part.type] = part.value;
      return out;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function localDate(value) {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
    const raw = String(value);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(raw);
    return Number.isNaN(parsed.valueOf()) ? '' : parsed.toISOString().slice(0, 10);
  }

  function field(row, ...keys) {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
      const found = Object.keys(row || {}).find(candidate => candidate.toLowerCase() === key.toLowerCase());
      if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') return row[found];
    }
    return '';
  }

  function yes(value) {
    return /^(yes|true|1|on)$/i.test(String(value || '').trim());
  }

  function normaliseItem(row, index, kind) {
    const due = localDate(field(row, 'dueDate', 'due_date', 'startDate', 'start_date', 'date')) || berlinDate();
    const start = localDate(field(row, 'startDate', 'start_date', 'dueDate', 'due_date', 'date')) || due;
    const end = localDate(field(row, 'endDate', 'end_date', 'dueDate', 'due_date', 'date')) || due;
    return {
      id: String(field(row, 'id') || `${kind === 'reminder' ? 'RMD' : 'T'}-${index + 1}`),
      kind,
      title: String(field(row, 'title') || 'Untitled item'),
      project: String(field(row, 'project', 'area') || 'General'),
      status: String(field(row, 'status') || 'Not started'),
      priority: String(field(row, 'priority') || 'Normal'),
      start,
      end,
      due,
      taskType: kind === 'reminder' ? 'Reminder' : String(field(row, 'taskType', 'task_type') || 'Personal'),
      emoji: String(field(row, 'emoji') || ''),
      notes: String(field(row, 'notes') || ''),
      link: String(field(row, 'link') || ''),
      completedAt: field(row, 'completedAt', 'completed_at'),
      alarmEnabled: kind === 'reminder' && yes(field(row, 'alarmEnabled', 'alarm_enabled')),
      alarmTime: kind === 'reminder' ? String(field(row, 'alarmTime', 'alarm_time') || '') : ''
    };
  }

  async function request(action, body) {
    if (!API) throw new Error('The Actarium API address is missing.');
    if (body) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...body })
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.error || `Backend HTTP ${response.status}`);
      return payload;
    }
    const url = new URL(API);
    url.searchParams.set('action', action);
    const response = await fetch(url.href, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.error || `Backend HTTP ${response.status}`);
    return payload;
  }

  async function refresh() {
    state.loading = true;
    paint();
    try {
      const payload = await request('bootstrap');
      state.data = {
        tasks: (payload.tasks || []).map((row, index) => normaliseItem(row, index, 'task')),
        reminders: (payload.reminders || []).map((row, index) => normaliseItem(row, index, 'reminder'))
      };
    } catch (error) {
      state.quickAdd.message = `Could not load tasks: ${error.message}`;
    } finally {
      state.loading = false;
      paint();
    }
  }

  function setTasksButton(active) {
    root?.querySelectorAll('.actarium-action-row button, .actarium-mobile-tabs button').forEach(buttonNode => {
      if (/\bTasks\b/i.test(buttonNode.textContent || '')) buttonNode.classList.toggle('active', active);
    });
  }

  function activate() {
    state.active = true;
    state.quickAdd.message = '';
    setTasksButton(true);
    paint();
    refresh();
  }

  function deactivate() {
    state.active = false;
    state.quickAdd.open = false;
    setTasksButton(false);
    const shell = root?.querySelector('.actarium-shell');
    shell?.classList.remove('task-mode-active');
    root?.querySelector('.actarium-task-mode')?.remove();
    root?.querySelector('.actarium-quick-add-backdrop')?.remove();
  }

  function isCompleted(item) {
    return /^(done|completed|cancelled)$/i.test(item.status) || Boolean(item.completedAt);
  }

  function effectiveEnd(item) {
    return item.kind === 'task' ? (item.end || item.start || item.due) : (item.start || item.due);
  }

  function isToday(item, today) {
    if (item.kind === 'reminder') return (item.start || item.due) === today;
    return (item.start || item.due) <= today && effectiveEnd(item) >= today;
  }

  function groupItems() {
    const today = berlinDate();
    const all = state.data.tasks.concat(state.data.reminders);
    const groups = { overdue: [], today: [], open: [], completed: [] };
    all.forEach(item => {
      if (isCompleted(item)) groups.completed.push(item);
      else if (effectiveEnd(item) && effectiveEnd(item) < today) groups.overdue.push(item);
      else if (isToday(item, today)) groups.today.push(item);
      else groups.open.push(item);
    });
    const dateSort = (a, b) => {
      const aDate = a.kind === 'task' ? effectiveEnd(a) : a.start;
      const bDate = b.kind === 'task' ? effectiveEnd(b) : b.start;
      return String(aDate || '9999-12-31').localeCompare(String(bDate || '9999-12-31')) || a.title.localeCompare(b.title);
    };
    groups.overdue.sort(dateSort);
    groups.today.sort((a, b) => {
      const aTime = a.kind === 'reminder' ? (a.alarmTime || '99:99') : '99:98';
      const bTime = b.kind === 'reminder' ? (b.alarmTime || '99:99') : '99:98';
      return aTime.localeCompare(bTime) || a.title.localeCompare(b.title);
    });
    groups.open.sort(dateSort);
    groups.completed.sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')) || b.title.localeCompare(a.title));
    return groups;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function button(text, className, handler) {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }

  function formatDate(value) {
    if (!value) return 'No date';
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return String(value);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
  }

  function itemDateLabel(item) {
    if (item.kind === 'reminder') {
      const when = formatDate(item.start || item.due);
      return item.alarmTime ? `${when} · ${item.alarmTime}` : when;
    }
    const start = item.start || item.due;
    const end = effectiveEnd(item);
    return start && end && start !== end ? `${formatDate(start)} → ${formatDate(end)}` : formatDate(start);
  }

  function taskCard(item, group) {
    const card = el('article', `actarium-task-mode-card ${group}`);
    const top = el('div', 'actarium-task-mode-card-top');
    const title = el('h3', 'actarium-task-mode-title');
    if (item.emoji) title.append(el('span', 'actarium-task-mode-emoji', item.emoji));
    title.append(document.createTextNode(item.title));
    const type = el('span', 'actarium-task-mode-type', item.kind === 'reminder' ? 'Reminder' : item.taskType || 'Task');
    top.append(title, type);

    const meta = el('div', 'actarium-task-mode-meta');
    meta.append(el('span', '', item.project || 'General'), el('span', '', itemDateLabel(item)));

    const foot = el('div', 'actarium-task-mode-foot');
    const status = el('span', `actarium-task-mode-pill status-${String(item.status).toLowerCase().replace(/[^a-z]+/g, '-')}`, item.status);
    const priority = el('span', `actarium-task-mode-pill priority-${String(item.priority).toLowerCase()}`, item.priority);
    foot.append(status, priority);
    if (!isCompleted(item)) foot.append(button('✓ Done', 'actarium-task-mode-done', () => complete(item)));

    card.append(top, meta, foot);
    return card;
  }

  function groupSection(key, label, items) {
    const section = el('section', `actarium-task-mode-section ${key}`);
    const heading = el('div', 'actarium-task-mode-section-head');
    heading.append(el('h2', '', label), el('span', 'actarium-task-mode-count', String(items.length)));
    section.append(heading);
    if (!items.length) {
      section.append(el('p', 'actarium-task-mode-empty', key === 'completed' ? 'Nothing completed yet.' : 'Nothing here.'));
      return section;
    }
    const grid = el('div', 'actarium-task-mode-grid');
    items.forEach(item => grid.append(taskCard(item, key)));
    section.append(grid);
    return section;
  }

  function board() {
    const node = el('section', 'actarium-task-mode');
    const header = el('div', 'actarium-task-mode-bar');
    const copy = el('div', 'actarium-task-mode-intro');
    copy.append(el('h1', '', 'Task mode'), el('p', '', state.loading ? 'Refreshing your tasks…' : 'Everything that needs your attention, in due-date order.'));
    const actions = el('div', 'actarium-task-mode-actions');
    actions.append(button('↻ Refresh', 'actarium-task-mode-secondary', refresh), button('⚡ Quick add', 'actarium-task-mode-primary', openQuickAdd));
    header.append(copy, actions);
    node.append(header);

    if (state.quickAdd.message && !state.quickAdd.open) node.append(el('p', 'actarium-task-mode-message error', state.quickAdd.message));

    const groups = groupItems();
    node.append(groupSection('overdue', 'Overdue', groups.overdue));
    node.append(groupSection('today', 'Today', groups.today));
    node.append(groupSection('open', 'Open', groups.open));
    node.append(el('hr', 'actarium-task-mode-divider'));
    node.append(groupSection('completed', 'Completed', groups.completed));
    return node;
  }

  function paint() {
    if (!state.active || !root) return;
    const shell = root.querySelector('.actarium-shell');
    if (!shell) return;
    shell.classList.add('task-mode-active');
    setTasksButton(true);
    const oldBoard = shell.querySelector('.actarium-task-mode');
    const newBoard = board();
    if (oldBoard) oldBoard.replaceWith(newBoard);
    else {
      const anchor = shell.querySelector('.actarium-apps-panel') || shell.querySelector('.actarium-header');
      anchor?.insertAdjacentElement('afterend', newBoard);
    }
    renderQuickAdd();
  }

  function openQuickAdd() {
    const today = berlinDate();
    if (!state.quickAdd.start) state.quickAdd.start = today;
    if (!state.quickAdd.end) state.quickAdd.end = state.quickAdd.start;
    state.quickAdd.open = true;
    state.quickAdd.message = '';
    paint();
  }

  function closeQuickAdd() {
    state.quickAdd.open = false;
    state.quickAdd.message = '';
    renderQuickAdd();
  }

  function syncDraftsFromInputs(backdrop) {
    const start = backdrop.querySelector('[name="quick-start"]');
    const end = backdrop.querySelector('[name="quick-end"]');
    const time = backdrop.querySelector('[name="quick-time"]');
    const text = backdrop.querySelector('[name="quick-text"]');
    if (start) state.quickAdd.start = start.value || berlinDate();
    if (end) state.quickAdd.end = end.value || state.quickAdd.start;
    if (time) state.quickAdd.time = time.value || '20:00';
    if (text) state.quickAdd.text = text.value;
  }

  function processLines(backdrop) {
    syncDraftsFromInputs(backdrop);
    const accepted = [];
    const leftover = [];
    state.quickAdd.text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (/\*\*\s*$/.test(trimmed)) {
        const title = trimmed.replace(/\*\*\s*$/, '').trim();
        if (title) accepted.push(title);
        else leftover.push(line);
      } else leftover.push(line);
    });
    state.quickAdd.drafts = accepted;
    state.quickAdd.text = leftover.join('\n');
    state.quickAdd.message = accepted.length ? `${accepted.length} item${accepted.length === 1 ? '' : 's'} ready to convert.` : 'Add ** to the end of at least one line, then process it.';
    renderQuickAdd();
  }

  function restoreText(backdrop) {
    syncDraftsFromInputs(backdrop);
    const processed = state.quickAdd.drafts.map(title => `${title}**`);
    state.quickAdd.text = [...processed, state.quickAdd.text].filter(Boolean).join(state.quickAdd.text && processed.length ? '\n' : '');
    state.quickAdd.drafts = [];
    state.quickAdd.message = 'Back in the text box for editing.';
    renderQuickAdd();
  }

  function quickPayload(title, kind) {
    const base = {
      title,
      project: 'General',
      source: 'Actarium',
      status: 'Not started',
      priority: 'Normal',
      recurrence: 'None',
      emoji: ''
    };
    if (kind === 'reminder') {
      return {
        ...base,
        start: state.quickAdd.start,
        due: state.quickAdd.start,
        alarmEnabled: true,
        alarmTime: state.quickAdd.time
      };
    }
    return {
      ...base,
      start: state.quickAdd.start,
      end: state.quickAdd.end || state.quickAdd.start,
      due: state.quickAdd.start,
      taskType: 'Personal'
    };
  }

  async function convert(kind, backdrop) {
    syncDraftsFromInputs(backdrop);
    if (!state.quickAdd.drafts.length) {
      state.quickAdd.message = 'Process the lines first so there is something to convert.';
      renderQuickAdd();
      return;
    }
    if (state.quickAdd.end < state.quickAdd.start) {
      state.quickAdd.message = 'End date cannot be earlier than start date.';
      renderQuickAdd();
      return;
    }
    state.saving = true;
    state.quickAdd.message = `Creating ${state.quickAdd.drafts.length} ${kind}${state.quickAdd.drafts.length === 1 ? '' : 's'}…`;
    renderQuickAdd();
    try {
      for (const title of state.quickAdd.drafts) {
        const action = kind === 'reminder' ? 'saveReminder' : 'saveTask';
        await request(action, { [kind]: quickPayload(title, kind) });
      }
      const count = state.quickAdd.drafts.length;
      state.quickAdd.drafts = [];
      state.quickAdd.text = '';
      state.quickAdd.message = `${count} ${kind}${count === 1 ? '' : 's'} created.`;
      state.quickAdd.open = false;
      await refresh();
    } catch (error) {
      state.quickAdd.message = `Nothing else was created after the error: ${error.message}`;
    } finally {
      state.saving = false;
      renderQuickAdd();
      paint();
    }
  }

  async function complete(item) {
    try {
      const action = item.kind === 'reminder' ? 'markRemindersDone' : 'markTasksDone';
      await request(action, { ids: [item.id], completedAt: new Date().toISOString() });
      await refresh();
    } catch (error) {
      state.quickAdd.message = `Could not mark “${item.title}” as done: ${error.message}`;
      paint();
    }
  }

  function inputField(label, name, type, value) {
    const wrap = el('label', 'actarium-quick-add-field');
    wrap.append(el('span', '', label));
    const input = document.createElement('input');
    input.name = name;
    input.type = type;
    input.value = value;
    if (type === 'date') input.addEventListener('change', event => {
      if (name === 'quick-start') {
        const end = event.currentTarget.closest('.actarium-quick-add')?.querySelector('[name="quick-end"]');
        if (end && (!end.value || end.value < event.currentTarget.value)) end.value = event.currentTarget.value;
      }
    });
    wrap.append(input);
    return wrap;
  }

  function renderQuickAdd() {
    root?.querySelector('.actarium-quick-add-backdrop')?.remove();
    if (!state.active || !state.quickAdd.open || !root) return;
    const backdrop = el('div', 'actarium-quick-add-backdrop');
    const modal = el('section', 'actarium-quick-add');
    backdrop.append(modal);

    const head = el('div', 'actarium-quick-add-head');
    head.append(el('h2', '', 'Quick add'), button('✕', 'actarium-quick-add-close', closeQuickAdd));
    modal.append(head);

    const body = el('div', 'actarium-quick-add-body');
    const dates = el('div', 'actarium-quick-add-dates');
    dates.append(
      inputField('Start date', 'quick-start', 'date', state.quickAdd.start),
      inputField('End date', 'quick-end', 'date', state.quickAdd.end),
      inputField('Reminder time', 'quick-time', 'time', state.quickAdd.time)
    );
    body.append(dates);

    if (!state.quickAdd.drafts.length) {
      const guide = el('p', 'actarium-quick-add-guide', 'Paste one item per line and end each item with **. Unfinished lines stay in the text box.');
      const textarea = document.createElement('textarea');
      textarea.name = 'quick-text';
      textarea.placeholder = 'Buy contact lens solution**\nReply to Nike email**\nBook dentist appointment**';
      textarea.value = state.quickAdd.text;
      body.append(guide, textarea);
    } else {
      body.append(el('p', 'actarium-quick-add-guide', 'Check the items below. Edit text returns them to the text box with ** added back.'));
      const list = el('div', 'actarium-quick-add-drafts');
      state.quickAdd.drafts.forEach((title, index) => {
        const pill = el('label', 'actarium-quick-add-pill');
        const input = document.createElement('input');
        input.value = title;
        input.setAttribute('aria-label', `Quick add item ${index + 1}`);
        input.addEventListener('input', event => { state.quickAdd.drafts[index] = event.currentTarget.value; });
        pill.append(el('span', '', '•'), input);
        list.append(pill);
      });
      body.append(list);
      const hiddenText = document.createElement('textarea');
      hiddenText.name = 'quick-text';
      hiddenText.hidden = true;
      hiddenText.value = state.quickAdd.text;
      body.append(hiddenText);
    }

    if (state.quickAdd.message) body.append(el('p', `actarium-quick-add-message ${/error|cannot|add \*\*/i.test(state.quickAdd.message) ? 'error' : ''}`, state.quickAdd.message));

    const actions = el('div', 'actarium-quick-add-actions');
    if (!state.quickAdd.drafts.length) {
      actions.append(button('Process', 'actarium-task-mode-primary', () => processLines(backdrop)));
    } else {
      actions.append(
        button('Edit text', 'actarium-task-mode-secondary', () => restoreText(backdrop)),
        button('Convert to tasks', 'actarium-task-mode-primary', () => convert('task', backdrop)),
        button('Convert to reminders', 'actarium-task-mode-primary', () => convert('reminder', backdrop))
      );
    }
    actions.querySelectorAll('button').forEach(node => { node.disabled = state.saving; });
    body.append(actions);
    modal.append(body);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeQuickAdd();
    });
    root.append(backdrop);
  }

  function isTasksButton(target) {
    const buttonNode = target.closest('button');
    if (!buttonNode) return false;
    const inDesktop = buttonNode.closest('.actarium-action-row');
    const inMobile = buttonNode.closest('.actarium-mobile-tabs');
    return Boolean(inDesktop || inMobile) && /\bTasks\b/i.test(buttonNode.textContent || '');
  }

  function isNavigationButton(target) {
    const buttonNode = target.closest('button');
    return Boolean(buttonNode?.closest('.actarium-action-row, .actarium-mobile-tabs'));
  }

  document.addEventListener('click', event => {
    if (isTasksButton(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activate();
      return;
    }
    if (state.active && isNavigationButton(event.target)) deactivate();
  }, true);

  const observer = new MutationObserver(() => {
    if (!state.active) return;
    const shell = root?.querySelector('.actarium-shell');
    if (shell && !shell.querySelector('.actarium-task-mode')) paint();
  });
  if (root) observer.observe(root, { childList: true, subtree: true });

  return { activate, refresh };
})();