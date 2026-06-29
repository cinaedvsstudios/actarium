const ACTARIUM_TASK_MODE = (() => {
  const API = window.ACTARIUM_API;
  const root = document.getElementById('app');
  const allowedViews = new Set(['list', 'thumbnail', 'preview']);
  const state = {
    active: false,
    loading: false,
    saving: false,
    view: allowedViews.has(localStorage.getItem('actarium.taskModeView')) ? localStorage.getItem('actarium.taskModeView') : 'thumbnail',
    notice: '',
    data: { tasks: [], reminders: [] },
    preview: null,
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
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const raw = String(value);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(raw);
    return Number.isNaN(parsed.valueOf()) ? '' : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  function normaliseTime(value) {
    const raw = String(value || '').trim();
    const full = raw.match(/(?:T|\s)(\d{2}:\d{2})(?::\d{2})?/);
    if (full) return full[1];
    const plain = raw.match(/^(\d{1,2}):(\d{2})/);
    if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
    return '';
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
    return value === true || /^(yes|true|1|on)$/i.test(String(value || '').trim());
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
      source: String(field(row, 'source') || 'Actarium'),
      status: String(field(row, 'status') || 'Not started'),
      priority: String(field(row, 'priority') || 'Normal'),
      start,
      end,
      due,
      recurrence: String(field(row, 'recurrence') || 'None'),
      taskType: kind === 'reminder' ? 'Reminder' : String(field(row, 'taskType', 'task_type') || 'Personal'),
      emoji: String(field(row, 'emoji') || ''),
      notes: String(field(row, 'notes') || ''),
      link: String(field(row, 'link') || ''),
      completedAt: field(row, 'completedAt', 'completed_at'),
      alarmEnabled: kind === 'reminder' && yes(field(row, 'alarmEnabled', 'alarm_enabled')),
      alarmTime: kind === 'reminder' ? normaliseTime(field(row, 'alarmTime', 'alarm_time')) : ''
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
      state.notice = '';
    } catch (error) {
      state.notice = `Could not load tasks: ${error.message}`;
    } finally {
      state.loading = false;
      paint();
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function button(text, className, handler, title) {
    const node = el('button', className, text);
    node.type = 'button';
    if (title) node.title = title;
    node.addEventListener('click', handler);
    return node;
  }

  function setTasksButton(active) {
    root?.querySelectorAll('.actarium-action-row button, .actarium-mobile-tabs button').forEach(buttonNode => {
      if (/\bTasks\b/i.test(buttonNode.textContent || '')) buttonNode.classList.toggle('active', active);
    });
  }

  function activate() {
    state.active = true;
    state.notice = '';
    setTasksButton(true);
    paint();
    refresh();
  }

  function deactivate() {
    state.active = false;
    state.preview = null;
    state.quickAdd.open = false;
    setTasksButton(false);
    root?.querySelector('.actarium-shell')?.classList.remove('task-mode-active');
    root?.querySelector('.actarium-task-mode')?.remove();
    clearOverlays();
  }

  function clearOverlays() {
    root?.querySelector('.actarium-quick-add-backdrop')?.remove();
    root?.querySelector('.actarium-task-preview-backdrop')?.remove();
  }

  function isCompleted(item) {
    return /^(done|completed|cancelled)$/i.test(item.status) || Boolean(item.completedAt);
  }

  function effectiveEnd(item) {
    return item.kind === 'task' ? (item.end || item.start || item.due) : (item.start || item.due);
  }

  function groupFor(item) {
    const today = berlinDate();
    if (isCompleted(item)) return 'completed';
    if (effectiveEnd(item) && effectiveEnd(item) < today) return 'overdue';
    if (item.kind === 'reminder') return (item.start || item.due) === today ? 'today' : 'open';
    return (item.start || item.due) <= today && effectiveEnd(item) >= today ? 'today' : 'open';
  }

  function orderedItems() {
    const rank = { overdue: 0, today: 1, open: 2, completed: 3 };
    return state.data.tasks.concat(state.data.reminders).sort((a, b) => {
      const groupDifference = rank[groupFor(a)] - rank[groupFor(b)];
      if (groupDifference) return groupDifference;
      if (groupFor(a) === 'today') {
        const aTime = a.kind === 'reminder' ? (a.alarmTime || '99:99') : '99:98';
        const bTime = b.kind === 'reminder' ? (b.alarmTime || '99:99') : '99:98';
        if (aTime !== bTime) return aTime.localeCompare(bTime);
      }
      if (groupFor(a) === 'completed') return String(b.completedAt || '').localeCompare(String(a.completedAt || '')) || a.title.localeCompare(b.title);
      return String(effectiveEnd(a) || '9999-12-31').localeCompare(String(effectiveEnd(b) || '9999-12-31')) || a.title.localeCompare(b.title);
    });
  }

  function formatDate(value) {
    if (!value) return 'No date';
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return String(value);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
  }

  function formatDateTime(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) return '';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(parsed);
  }

  function itemDateLabel(item) {
    if (item.kind === 'reminder') {
      const date = formatDate(item.start || item.due);
      return item.alarmEnabled && item.alarmTime ? `${date} · ${item.alarmTime}` : date;
    }
    const start = item.start || item.due;
    const end = effectiveEnd(item);
    return start && end && start !== end ? `${formatDate(start)} → ${formatDate(end)}` : formatDate(start);
  }

  function pill(value, type) {
    return el('span', `actarium-task-mode-pill ${type || ''}`, value || '—');
  }

  function card(item, size) {
    const group = groupFor(item);
    const node = el('article', `actarium-task-mode-card ${group}${size === 'preview' ? ' preview' : ''}`);
    node.addEventListener('click', () => openPreview(item));

    const top = el('div', 'actarium-task-mode-card-top');
    const title = el('h3', 'actarium-task-mode-title');
    if (item.emoji) title.append(el('span', 'actarium-task-mode-emoji', item.emoji));
    title.append(document.createTextNode(item.title));
    top.append(title, el('span', 'actarium-task-mode-type', item.kind === 'reminder' ? 'Reminder' : item.taskType || 'Task'));

    const meta = el('div', 'actarium-task-mode-meta');
    meta.append(el('span', '', item.project || 'General'), el('span', '', itemDateLabel(item)));
    if (size === 'preview') {
      if (item.notes) meta.append(el('p', 'actarium-task-mode-notes', item.notes));
      if (item.link) {
        const link = document.createElement('a');
        link.className = 'actarium-task-mode-link';
        link.href = item.link;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = item.link;
        link.addEventListener('click', event => event.stopPropagation());
        meta.append(link);
      }
    }

    const foot = el('div', 'actarium-task-mode-foot');
    foot.append(pill(item.status, `status-${item.status.toLowerCase().replace(/[^a-z]+/g, '-')}`), pill(item.priority, `priority-${item.priority.toLowerCase()}`));
    if (!isCompleted(item)) {
      const doneButton = button('✓ Done', 'actarium-task-mode-done', event => {
        event.stopPropagation();
        complete(item);
      });
      foot.append(doneButton);
    }
    node.append(top, meta, foot);
    return node;
  }

  function listRow(item) {
    const group = groupFor(item);
    const row = el('article', `actarium-task-mode-list-row ${group}`);
    row.addEventListener('click', () => openPreview(item));
    const left = el('div');
    const title = el('h3', 'actarium-task-mode-list-title');
    if (item.emoji) title.append(el('span', 'actarium-task-mode-emoji', `${item.emoji} `));
    title.append(document.createTextNode(item.title));
    left.append(title, el('div', 'actarium-task-mode-list-meta', `${item.kind === 'reminder' ? 'Reminder' : item.taskType} · ${item.project} · ${itemDateLabel(item)}`));
    const right = el('div', 'actarium-task-mode-list-right');
    right.append(pill(item.status, `status-${item.status.toLowerCase().replace(/[^a-z]+/g, '-')}`), pill(item.priority, `priority-${item.priority.toLowerCase()}`));
    if (!isCompleted(item)) {
      right.append(button('✓', 'actarium-task-mode-done', event => {
        event.stopPropagation();
        complete(item);
      }, 'Mark as done'));
    }
    row.append(left, right);
    return row;
  }

  function setView(view) {
    state.view = view;
    localStorage.setItem('actarium.taskModeView', view);
    paint();
  }

  function board() {
    const node = el('section', 'actarium-task-mode');
    const activeCount = orderedItems().filter(item => !isCompleted(item)).length;
    const completeCount = orderedItems().length - activeCount;
    const header = el('div', 'actarium-task-mode-bar');
    const intro = el('div', 'actarium-task-mode-intro');
    intro.append(el('strong', '', 'Tasks'), el('span', '', state.loading ? 'Refreshing tasks…' : `${activeCount} open · ${completeCount} completed`));
    const actions = el('div', 'actarium-task-mode-actions');
    actions.append(
      button('↻ Refresh', 'actarium-task-mode-secondary', refresh),
      button('List', `actarium-task-mode-view ${state.view === 'list' ? 'active' : ''}`, () => setView('list')),
      button('Thumbnail', `actarium-task-mode-view ${state.view === 'thumbnail' ? 'active' : ''}`, () => setView('thumbnail')),
      button('Preview', `actarium-task-mode-view ${state.view === 'preview' ? 'active' : ''}`, () => setView('preview')),
      button('⚡ Quick add', 'actarium-task-mode-primary', openQuickAdd)
    );
    header.append(intro, actions);
    node.append(header);
    if (state.notice) node.append(el('p', 'actarium-task-mode-message error', state.notice));

    const items = orderedItems();
    const list = el('div', `actarium-task-mode-items view-${state.view}`);
    if (items.length) items.forEach(item => list.append(state.view === 'list' ? listRow(item) : card(item, state.view)));
    else list.append(el('p', 'actarium-task-mode-message', 'No tasks or reminders yet.'));
    node.append(list);
    return node;
  }

  function paint() {
    if (!state.active || !root) return;
    const shell = root.querySelector('.actarium-shell');
    if (!shell) return;
    shell.classList.add('task-mode-active');
    setTasksButton(true);
    const replacement = board();
    const existing = shell.querySelector('.actarium-task-mode');
    if (existing) existing.replaceWith(replacement);
    else (shell.querySelector('.actarium-apps-panel') || shell.querySelector('.actarium-header'))?.insertAdjacentElement('afterend', replacement);
    renderPreview();
    renderQuickAdd();
  }

  function openPreview(item) {
    state.preview = { item, editing: false, message: '' };
    renderPreview();
  }

  function closePreview() {
    state.preview = null;
    renderPreview();
  }

  function detail(label, value) {
    const node = el('div', 'actarium-task-detail');
    node.append(el('span', '', label), el('strong', '', value || '—'));
    return node;
  }

  function previewContent(item) {
    const group = groupFor(item);
    const cardNode = el('article', `actarium-task-preview-card ${group}`);
    const title = el('div', 'actarium-task-preview-title');
    const heading = el('h3');
    if (item.emoji) heading.append(el('span', 'actarium-task-mode-emoji', item.emoji));
    heading.append(document.createTextNode(item.title));
    title.append(heading, el('span', 'actarium-task-mode-type', item.kind === 'reminder' ? 'Reminder' : item.taskType || 'Task'));
    const grid = el('div', 'actarium-task-detail-grid');
    grid.append(
      detail('Project', item.project),
      detail(item.kind === 'reminder' ? 'Reminder' : 'Date', itemDateLabel(item)),
      detail('Status', item.status),
      detail('Priority', item.priority),
      detail('Repeat', item.recurrence || 'None'),
      detail(item.kind === 'reminder' ? 'Alarm' : 'Task type', item.kind === 'reminder' ? (item.alarmEnabled ? (item.alarmTime || 'Enabled') : 'Off') : item.taskType)
    );
    cardNode.append(title, grid);
    const notes = el('section', 'actarium-task-preview-notes');
    notes.append(el('h4', '', 'Notes'), el('p', '', item.notes || 'No notes added.'));
    cardNode.append(notes);
    if (item.link) {
      const link = document.createElement('a');
      link.className = 'actarium-task-preview-link';
      link.href = item.link;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = item.link;
      cardNode.append(link);
    }
    return cardNode;
  }

  function editorField(label, name, type, value) {
    const wrap = el('label', 'actarium-quick-add-field');
    wrap.append(el('span', '', label));
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    input.name = name;
    if (type !== 'textarea') input.type = type;
    input.value = value || '';
    wrap.append(input);
    return wrap;
  }

  function editorSelect(label, name, value, options) {
    const wrap = el('label', 'actarium-quick-add-field');
    wrap.append(el('span', '', label));
    const select = document.createElement('select');
    select.name = name;
    select.className = 'actarium-quick-add-select';
    options.forEach(option => {
      const node = document.createElement('option');
      node.value = option;
      node.textContent = option;
      node.selected = option === value;
      select.append(node);
    });
    wrap.append(select);
    return wrap;
  }

  function readEditor(modal, item) {
    const read = name => modal.querySelector(`[name="${name}"]`)?.value || '';
    return {
      id: item.id,
      kind: item.kind,
      title: read('title') || 'Untitled item',
      emoji: read('emoji'),
      project: read('project') || 'General',
      source: item.source || 'Actarium',
      status: read('status') || 'Not started',
      priority: read('priority') || 'Normal',
      start: read('start') || berlinDate(),
      end: item.kind === 'task' ? (read('end') || read('start') || berlinDate()) : (read('start') || berlinDate()),
      due: read('start') || berlinDate(),
      taskType: item.kind === 'task' ? (read('taskType') || 'Personal') : 'Reminder',
      recurrence: read('recurrence') || 'None',
      notes: read('notes'),
      link: read('link'),
      alarmEnabled: item.kind === 'reminder' && read('alarmEnabled') === 'Yes',
      alarmTime: item.kind === 'reminder' ? read('alarmTime') : ''
    };
  }

  function previewEditor(item, modal) {
    const body = el('div', 'actarium-task-preview-body');
    const top = el('div', 'actarium-quick-add-dates');
    top.append(editorField('Title', 'title', 'text', item.title), editorField('Emoji', 'emoji', 'text', item.emoji), editorField('Project', 'project', 'text', item.project));
    const dates = el('div', 'actarium-quick-add-dates');
    dates.append(editorField(item.kind === 'reminder' ? 'Reminder date' : 'Start date', 'start', 'date', item.start));
    if (item.kind === 'task') dates.append(editorField('End date', 'end', 'date', item.end));
    else dates.append(editorField('Alarm time', 'alarmTime', 'time', item.alarmTime), editorSelect('Alarm', 'alarmEnabled', item.alarmEnabled ? 'Yes' : 'No', ['Yes', 'No']));
    const options = el('div', 'actarium-quick-add-dates');
    options.append(
      editorSelect('Priority', 'priority', item.priority, ['Low', 'Normal', 'High', 'Urgent']),
      editorSelect('Status', 'status', item.status, ['Not started', 'In progress', 'Done', 'Cancelled']),
      editorSelect('Repeat', 'recurrence', item.recurrence || 'None', ['None', 'Daily', 'Weekly', 'Weekdays', 'Monthly'])
    );
    if (item.kind === 'task') options.append(editorSelect('Task type', 'taskType', item.taskType, ['Personal', 'Work']));
    body.append(top, dates, options, editorField('Link', 'link', 'url', item.link), editorField('Notes', 'notes', 'textarea', item.notes));
    if (state.preview.message) body.append(el('p', 'actarium-quick-add-message error', state.preview.message));
    const actions = el('div', 'actarium-task-preview-actions');
    actions.append(
      button('Cancel', 'actarium-task-mode-secondary', () => { state.preview.editing = false; state.preview.message = ''; renderPreview(); }),
      button('Save changes', 'actarium-task-mode-primary', async () => {
        const output = readEditor(modal, item);
        if (output.end < output.start) {
          state.preview.message = 'End date cannot be earlier than start date.';
          renderPreview();
          return;
        }
        state.saving = true;
        actions.querySelectorAll('button').forEach(node => { node.disabled = true; });
        try {
          await request(item.kind === 'reminder' ? 'saveReminder' : 'saveTask', { [item.kind === 'reminder' ? 'reminder' : 'task']: output });
          state.preview = null;
          await refresh();
        } catch (error) {
          state.preview.message = `Could not save changes: ${error.message}`;
          renderPreview();
        } finally {
          state.saving = false;
        }
      })
    );
    body.append(actions);
    return body;
  }

  function renderPreview() {
    root?.querySelector('.actarium-task-preview-backdrop')?.remove();
    if (!state.active || !state.preview || !root) return;
    const backdrop = el('div', 'actarium-task-preview-backdrop');
    const modal = el('section', 'actarium-task-preview');
    backdrop.append(modal);
    const item = state.preview.item;
    const head = el('div', 'actarium-task-preview-head');
    head.append(el('h2', '', state.preview.editing ? 'Edit task' : 'Task details'), button('✕', 'actarium-task-preview-close', closePreview));
    modal.append(head);
    if (state.preview.editing) modal.append(previewEditor(item, modal));
    else {
      const body = el('div', 'actarium-task-preview-body');
      body.append(previewContent(item));
      const actions = el('div', 'actarium-task-preview-actions');
      actions.append(button('✎ Edit', 'actarium-task-preview-edit', () => { state.preview.editing = true; renderPreview(); }));
      if (!isCompleted(item)) actions.append(button('✓ Done', 'actarium-task-mode-done', () => complete(item)));
      body.append(actions);
      modal.append(body);
    }
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closePreview(); });
    root.append(backdrop);
  }

  function openQuickAdd() {
    state.quickAdd.open = true;
    state.quickAdd.message = '';
    paint();
  }

  function closeQuickAdd() {
    state.quickAdd.open = false;
    state.quickAdd.message = '';
    renderQuickAdd();
  }

  function syncQuickAdd(backdrop) {
    const start = backdrop.querySelector('[name="quick-start"]');
    const end = backdrop.querySelector('[name="quick-end"]');
    const time = backdrop.querySelector('[name="quick-time"]');
    const text = backdrop.querySelector('[name="quick-text"]');
    state.quickAdd.start = start?.value || berlinDate();
    state.quickAdd.end = end?.value || state.quickAdd.start;
    state.quickAdd.time = time?.value || '20:00';
    if (text) state.quickAdd.text = text.value;
  }

  function processLines(backdrop) {
    syncQuickAdd(backdrop);
    const drafts = [];
    const remaining = [];
    state.quickAdd.text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (/\*\*\s*$/.test(trimmed)) {
        const title = trimmed.replace(/\*\*\s*$/, '').trim();
        if (title) drafts.push(title);
      } else remaining.push(line);
    });
    state.quickAdd.drafts = drafts;
    state.quickAdd.text = remaining.join('\n');
    state.quickAdd.message = drafts.length ? `${drafts.length} item${drafts.length === 1 ? '' : 's'} ready to convert.` : 'Add ** to the end of at least one line, then process it.';
    renderQuickAdd();
  }

  function restoreText(backdrop) {
    syncQuickAdd(backdrop);
    const returned = state.quickAdd.drafts.map(title => `${title}**`);
    state.quickAdd.text = [...returned, state.quickAdd.text].filter(Boolean).join(returned.length && state.quickAdd.text ? '\n' : '');
    state.quickAdd.drafts = [];
    state.quickAdd.message = 'Back in the text box for editing.';
    renderQuickAdd();
  }

  function quickPayload(title, kind) {
    const base = { title, project: 'General', source: 'Actarium', status: 'Not started', priority: 'Normal', recurrence: 'None', emoji: '' };
    return kind === 'reminder'
      ? { ...base, start: state.quickAdd.start, due: state.quickAdd.start, alarmEnabled: true, alarmTime: state.quickAdd.time }
      : { ...base, start: state.quickAdd.start, end: state.quickAdd.end || state.quickAdd.start, due: state.quickAdd.start, taskType: 'Personal' };
  }

  async function convert(kind, backdrop) {
    syncQuickAdd(backdrop);
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
      for (const title of state.quickAdd.drafts) await request(kind === 'reminder' ? 'saveReminder' : 'saveTask', { [kind === 'reminder' ? 'reminder' : 'task']: quickPayload(title, kind) });
      const count = state.quickAdd.drafts.length;
      state.quickAdd.drafts = [];
      state.quickAdd.text = '';
      state.quickAdd.open = false;
      state.notice = `${count} ${kind}${count === 1 ? '' : 's'} created.`;
      await refresh();
    } catch (error) {
      state.quickAdd.message = `Nothing else was created after the error: ${error.message}`;
    } finally {
      state.saving = false;
      renderQuickAdd();
      paint();
    }
  }

  function quickField(label, name, type, value) {
    const wrap = el('label', 'actarium-quick-add-field');
    wrap.append(el('span', '', label));
    const input = document.createElement('input');
    input.name = name;
    input.type = type;
    input.value = value;
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
    dates.append(quickField('Start date', 'quick-start', 'date', state.quickAdd.start), quickField('End date', 'quick-end', 'date', state.quickAdd.end), quickField('Reminder time', 'quick-time', 'time', state.quickAdd.time));
    body.append(dates);
    if (!state.quickAdd.drafts.length) {
      body.append(el('p', 'actarium-quick-add-guide', 'Paste one item per line and end each item with **. Unfinished lines stay in the text box.'));
      const textarea = document.createElement('textarea');
      textarea.name = 'quick-text';
      textarea.placeholder = 'Buy contact lens solution**\nReply to Nike email**\nBook dentist appointment**';
      textarea.value = state.quickAdd.text;
      body.append(textarea);
    } else {
      body.append(el('p', 'actarium-quick-add-guide', 'Check the items below. Edit text returns them to the text box with ** added back.'));
      const drafts = el('div', 'actarium-quick-add-drafts');
      state.quickAdd.drafts.forEach((title, index) => {
        const pillNode = el('label', 'actarium-quick-add-pill');
        const input = document.createElement('input');
        input.value = title;
        input.addEventListener('input', event => { state.quickAdd.drafts[index] = event.currentTarget.value; });
        pillNode.append(el('span', '', '•'), input);
        drafts.append(pillNode);
      });
      const hidden = document.createElement('textarea');
      hidden.name = 'quick-text';
      hidden.hidden = true;
      hidden.value = state.quickAdd.text;
      body.append(drafts, hidden);
    }
    if (state.quickAdd.message) body.append(el('p', `actarium-quick-add-message ${/error|cannot|add \*\*/i.test(state.quickAdd.message) ? 'error' : ''}`, state.quickAdd.message));
    const actions = el('div', 'actarium-quick-add-actions');
    if (state.quickAdd.drafts.length) {
      actions.append(button('Edit text', 'actarium-task-mode-secondary', () => restoreText(backdrop)), button('Convert to tasks', 'actarium-task-mode-primary', () => convert('task', backdrop)), button('Convert to reminders', 'actarium-task-mode-primary', () => convert('reminder', backdrop)));
    } else actions.append(button('Process', 'actarium-task-mode-primary', () => processLines(backdrop)));
    actions.querySelectorAll('button').forEach(node => { node.disabled = state.saving; });
    body.append(actions);
    modal.append(body);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeQuickAdd(); });
    root.append(backdrop);
  }

  async function complete(item) {
    try {
      await request(item.kind === 'reminder' ? 'markRemindersDone' : 'markTasksDone', { ids: [item.id], completedAt: new Date().toISOString() });
      state.preview = null;
      await refresh();
    } catch (error) {
      state.notice = `Could not mark “${item.title}” as done: ${error.message}`;
      paint();
    }
  }

  function isTasksButton(target) {
    const node = target.closest('button');
    return Boolean(node?.closest('.actarium-action-row, .actarium-mobile-tabs')) && /\bTasks\b/i.test(node.textContent || '');
  }

  function isNavigationButton(target) {
    return Boolean(target.closest('button')?.closest('.actarium-action-row, .actarium-mobile-tabs'));
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