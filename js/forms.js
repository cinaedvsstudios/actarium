import * as api from './api.js';
import { CONFIG } from './config.js';
import { state, closeModal, createEmptyTask, setModal, setSelectedDate } from './state.js';
import { parseSectionText } from './sheetParser.js';
import { createInfoSection, isDone, isArchived } from './cards.js';
import { addDays, formatLongDate, formatMonth, getWeekDates, parseDate, startOfMonth, startOfWeek, toISODate } from './dateUtils.js';

export function renderModal() {
  if (!state.modal) return null;
  if (state.modal.type === 'task-detail') return renderTaskDetail(state.modal.taskId);
  if (state.modal.type === 'task-form') return renderTaskForm(state.modal.taskId);
  if (state.modal.type === 'date-picker') return renderDatePicker();
  if (state.modal.type === 'history') return renderHistoryArchive();
  if (state.modal.type === 'settings') return renderSettingsModal();
  if (state.modal.type === 'confirm-delete') return renderDeleteConfirm(state.modal.taskId);
  return null;
}

export function openNewTask() {
  setModal({ type: 'task-form', taskId: null });
}

function renderTaskDetail(taskId) {
  const task = state.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return null;
  const backdrop = modalShell(`🔎 ${task.title}`, 'Task details');
  const body = backdrop.querySelector('.modal-body');

  const summary = document.createElement('div');
  summary.className = 'form-grid';
  summary.innerHTML = `
    <div class="task-meta">
      <span class="status-pill ${isDone(task) ? 'done' : 'purple'}">${escapeHtml(task.status || 'Open')}</span>
      <span class="status-pill teal">${escapeHtml(task.source || 'Actarium')}</span>
      <span class="status-pill tasks">${escapeHtml(task.taskType || 'Personal')}</span>
      <span class="status-pill warn">${escapeHtml(task.priority || 'Normal')}</span>
      ${task.recurrence && task.recurrence !== 'None' ? `<span class="status-pill teal">🔁 ${escapeHtml(task.recurrence)}</span>` : ''}
    </div>
    <div class="info-section"><strong>Date</strong><p>${escapeHtml(task.startDate || task.dueDate || '—')}${task.endDate && task.endDate !== task.startDate ? ` → ${escapeHtml(task.endDate)}` : ''}</p></div>
    <div class="info-section"><strong>Project</strong><p>${escapeHtml(task.project || 'General')}</p></div>
    <div class="info-section"><strong>Task type</strong><p>${escapeHtml(task.taskType || 'Personal')}</p></div>
  `;
  body.append(summary);

  const sections = parseSectionText(task.notes || '');
  if (sections.length) sections.forEach(section => body.append(createInfoSection(section.label, section.body)));
  else body.append(createInfoSection('Notes', 'No notes yet.'));

  if (task.link) {
    const link = document.createElement('a');
    link.className = 'secondary-button';
    link.href = task.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '🔗 Open link';
    body.append(link);
  }

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  actions.append(
    button('✏️ Edit', 'primary-button', () => setModal({ type: 'task-form', taskId: task.id })),
    button(isDone(task) ? '↩️ Reopen' : '✅ Mark done', 'secondary-button', () => { api.markTaskDone(task.id, !isDone(task)); closeModal(); }),
    button('🗑️ Delete', 'danger-button', () => setModal({ type: 'confirm-delete', taskId: task.id }))
  );
  body.append(actions);
  return backdrop;
}


function renderSettingsModal() {
  const backdrop = modalShell('⚙️ Settings', 'Links and connection details for Actarium.');
  const body = backdrop.querySelector('.modal-body');

  const quickLinks = document.createElement('div');
  quickLinks.className = 'settings-grid';
  quickLinks.append(
    settingsLink('📊 Open Actarium Sheet', CONFIG.googleSheetUrl || `https://docs.google.com/spreadsheets/d/${CONFIG.googleSheetId}/edit`, 'Main database and tabs'),
    settingsLink('🧩 Open Apps Script', 'https://script.google.com/home/projects', 'Backend deployment console'),
    settingsLink('🐙 Open GitHub repo', CONFIG.githubRepoUrl, 'Source files and deployment'),
    settingsLink('🌐 Open live app', CONFIG.liveAppUrl || 'https://cinaedvsstudios.github.io/actarium/', 'GitHub Pages app'),
    settingsLink('⚖️ Open ChrisFit', CONFIG.sourceApps?.fitness?.url, 'Fitness source app'),
    settingsLink('🎒 Open Viaticum', CONFIG.sourceApps?.viaticum?.url, 'Travel source app')
  );

  const details = document.createElement('div');
  details.className = 'settings-detail-list';
  details.append(
    settingsDetail('Version', CONFIG.version),
    settingsDetail('Sheet ID', CONFIG.googleSheetId),
    settingsDetail('Backend', CONFIG.apiBaseUrl ? 'Connected endpoint configured' : 'No endpoint configured'),
    settingsDetail('Theme', state.theme === 'light' ? 'Light' : 'Dark'),
    settingsDetail('Version rule', 'Bump the version for every visible edit.'),
    settingsDetail('Structure rule', 'No patches, no fix files, no helper-on-helper files.')
  );

  body.append(quickLinks, details);
  return backdrop;
}

function settingsLink(label, href, note) {
  const link = document.createElement('a');
  link.className = 'settings-link-card';
  link.href = href || '#';
  link.target = href ? '_blank' : '_self';
  link.rel = 'noopener noreferrer';
  link.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(note || '')}</span>`;
  return link;
}

function settingsDetail(label, value) {
  const item = document.createElement('div');
  item.className = 'settings-detail';
  item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong>`;
  return item;
}

function renderDeleteConfirm(taskId) {
  const task = state.tasks.find(item => String(item.id) === String(taskId));
  const backdrop = modalShell('🗑️ Delete task', task ? task.title : 'Task');
  const body = backdrop.querySelector('.modal-body');
  body.append(createInfoSection('Confirm', 'Delete this local task? This cannot be undone.', 'outstanding'));
  const actions = document.createElement('div');
  actions.className = 'form-actions';
  actions.append(
    button('🗑️ Delete', 'danger-button', () => { api.deleteTask(taskId); closeModal(); }),
    button('↩️ Keep task', 'secondary-button', () => setModal({ type: 'task-detail', taskId }))
  );
  body.append(actions);
  return backdrop;
}


function renderHistoryArchive() {
  const backdrop = modalShell('🗄️ History / Archive', 'Search completed and archived tasks.');
  const body = backdrop.querySelector('.modal-body');
  const archiveTasks = state.tasks
    .filter(task => isArchived(task))
    .sort((a, b) => String(b.completedAt || b.updatedAt || b.dueDate).localeCompare(String(a.completedAt || a.updatedAt || a.dueDate)));

  const searchWrap = document.createElement('div');
  searchWrap.className = 'field archive-search-field';
  searchWrap.innerHTML = '<label for="archiveSearch">Search archive</label><input id="archiveSearch" type="search" placeholder="Search title, project, source, notes…" autocomplete="off" />';
  const list = document.createElement('div');
  list.className = 'archive-list';
  body.append(searchWrap, list);

  function draw(query = '') {
    const needle = query.trim().toLowerCase();
    list.innerHTML = '';
    const visible = archiveTasks.filter(task => {
      const text = `${task.title || ''} ${task.project || ''} ${task.source || ''} ${task.taskType || ''} ${task.notes || ''}`.toLowerCase();
      return !needle || text.includes(needle);
    });
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = archiveTasks.length ? 'No archived tasks match that search.' : 'No completed tasks are archived yet.';
      list.append(empty);
      return;
    }
    visible.forEach(task => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'archive-row';
      row.innerHTML = `<strong>${escapeHtml(task.title || 'Untitled task')}</strong><span>${escapeHtml(task.taskType || 'Personal')} · ${escapeHtml(task.project || 'General')} · ${escapeHtml(task.completedAt || task.updatedAt || task.dueDate || 'No date')}</span>`;
      row.addEventListener('click', () => setModal({ type: 'task-detail', taskId: task.id }));
      list.append(row);
    });
  }

  searchWrap.querySelector('input').addEventListener('input', event => draw(event.target.value));
  draw();
  return backdrop;
}

function renderTaskForm(taskId) {
  const existing = state.tasks.find(item => String(item.id) === String(taskId));
  const task = existing ? { ...existing } : createEmptyTask();
  const backdrop = modalShell(existing ? '✏️ Edit task' : '➕ Create task', 'Calendar-style date range and recurrence. Use Save to keep changes.');
  const body = backdrop.querySelector('.modal-body');

  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    ${field('Title', 'title', 'text', task.title, 'What needs to be done?')}
    <div class="two-col">
      ${field('Start date', 'startDate', 'date', task.startDate || task.dueDate)}
      ${field('End date', 'endDate', 'date', task.endDate || task.startDate || task.dueDate)}
    </div>
    <div class="two-col">
      ${selectField('Recurrence', 'recurrence', task.recurrence || 'None', ['None', 'Daily', 'Weekly', 'Monthly'])}
      ${field('Repeat until', 'repeatUntil', 'date', task.repeatUntil || '')}
    </div>
    <div class="two-col">
      ${selectField('Priority', 'priority', task.priority || 'Normal', ['Low', 'Normal', 'High', 'Urgent'])}
      ${selectField('Status', 'status', task.status || 'Not started', ['Not started', 'In progress', 'Waiting', 'Done'])}
    </div>
    <div class="two-col">
      ${selectField('Task type', 'taskType', task.taskType || 'Personal', ['Personal', 'Work'])}
      ${field('Project', 'project', 'text', task.project || 'General', 'Apps, Fitness, Travel…')}
    </div>
    ${field('Source', 'source', 'text', task.source || 'Actarium', 'Actarium, ChrisFit, Viaticum…')}
    ${field('Link', 'link', 'url', task.link || '', 'https://…')}
    <div class="field">
      <label for="notes">Notes / sections</label>
      <textarea id="notes" name="notes" placeholder="Info:\nMaps:\nPaid:\nUnpaid:\nLinks:">${escapeHtml(task.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button type="submit" class="primary-button">💾 Save task</button>
      <button type="button" class="secondary-button" data-close>☠️ Cancel</button>
    </div>
  `;

  wireCustomSelects(form);
  form.querySelector('[data-close]').addEventListener('click', () => requestClose(backdrop));
  form.addEventListener('input', () => { backdrop.dataset.dirty = 'true'; });
  form.addEventListener('change', () => { backdrop.dataset.dirty = 'true'; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const startDate = data.get('startDate') || task.startDate;
    const endDate = data.get('endDate') || startDate;
    backdrop.dataset.dirty = 'false';
    api.saveTask({
      ...task,
      title: data.get('title'),
      startDate,
      endDate,
      dueDate: startDate,
      durationType: startDate === endDate ? 'Single day' : 'Date range',
      recurrence: data.get('recurrence'),
      repeatUntil: data.get('repeatUntil'),
      priority: data.get('priority'),
      status: data.get('status'),
      project: data.get('project'),
      source: data.get('source'),
      taskType: data.get('taskType'),
      link: data.get('link'),
      notes: data.get('notes')
    });
    closeModal();
  });

  body.append(form);
  return backdrop;
}

function renderDatePicker() {
  const baseDate = parseDate(state.selectedDate) || new Date();
  const monthStart = startOfMonth(baseDate);
  const selectedIso = toISODate(baseDate);
  const backdrop = modalShell('📅 Pick date', formatMonth(baseDate));
  const body = backdrop.querySelector('.modal-body');

  const picker = document.createElement('div');
  picker.className = 'date-picker';
  const header = document.createElement('div');
  header.className = 'date-picker-header';
  header.append(
    button('‹', 'icon-button', () => { setSelectedDate(toISODate(addDays(monthStart, -1))); setModal({ type: 'date-picker' }); }),
    monthTitle(formatMonth(baseDate)),
    button('›', 'icon-button', () => { const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1); setSelectedDate(toISODate(next)); setModal({ type: 'date-picker' }); })
  );
  picker.append(header);

  const grid = document.createElement('div');
  grid.className = 'picker-grid';
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(label => {
    const cell = document.createElement('div');
    cell.className = 'picker-head';
    cell.textContent = label;
    grid.append(cell);
  });

  const firstDay = monthStart.getDay() || 7;
  for (let i = 1; i < firstDay; i += 1) grid.append(emptyPickerCell());
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  for (let day = 1; day <= end.getDate(); day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const iso = toISODate(date);
    const dayButton = document.createElement('button');
    dayButton.type = 'button';
    dayButton.className = `picker-day ${iso === selectedIso ? 'is-selected' : ''}`;
    dayButton.textContent = String(day);
    dayButton.title = formatLongDate(date);
    dayButton.addEventListener('click', () => { setSelectedDate(iso); closeModal(); });
    grid.append(dayButton);
  }
  picker.append(grid);
  body.append(picker);
  return backdrop;
}

function monthTitle(text) {
  const item = document.createElement('strong');
  item.className = 'date-picker-month';
  item.textContent = text;
  return item;
}

function emptyPickerCell() {
  const cell = document.createElement('span');
  cell.className = 'picker-empty';
  return cell;
}

function modalShell(title, subtitle) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.dataset.dirty = 'false';
  backdrop.addEventListener('click', event => { if (event.target === backdrop) requestClose(backdrop); });
  backdrop.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(subtitle || '')}</p></div>
        <button type="button" class="icon-button" data-close title="Close">✖️</button>
      </div>
      <div class="modal-body"></div>
    </section>
  `;
  backdrop.querySelector('[data-close]').addEventListener('click', () => requestClose(backdrop));
  return backdrop;
}

function requestClose(backdrop) {
  if (backdrop?.dataset?.dirty === 'true') {
    const leave = window.confirm('Close without saving? Unsaved changes will be lost.');
    if (!leave) return;
  }
  closeModal();
}

function field(label, name, type, value = '', placeholder = '') {
  return `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input id="${name}" name="${name}" type="${type}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" /></div>`;
}

function selectField(label, name, value, options) {
  const selected = options.includes(value) ? value : options[0];
  const buttons = options.map(option => `<button type="button" class="custom-select-option ${String(option) === String(selected) ? 'is-selected' : ''}" data-value="${escapeAttribute(option)}">${escapeHtml(option)}</button>`).join('');
  return `<div class="field custom-select-field" data-custom-select><label id="${name}Label">${escapeHtml(label)}</label><input type="hidden" id="${name}" name="${name}" value="${escapeAttribute(selected)}" /><button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-labelledby="${name}Label">${escapeHtml(selected)} <span>⌄</span></button><div class="custom-select-menu" role="listbox">${buttons}</div></div>`;
}

function wireCustomSelects(scope) {
  scope.querySelectorAll('[data-custom-select]').forEach(select => {
    const input = select.querySelector('input[type="hidden"]');
    const trigger = select.querySelector('.custom-select-trigger');
    const menu = select.querySelector('.custom-select-menu');
    if (!input || !trigger || !menu) return;
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      scope.querySelectorAll('[data-custom-select].is-open').forEach(open => {
        if (open !== select) open.classList.remove('is-open');
      });
      const willOpen = !select.classList.contains('is-open');
      select.classList.toggle('is-open', willOpen);
      if (willOpen) {
        window.setTimeout(() => {
          document.addEventListener('click', () => select.classList.remove('is-open'), { once: true });
        }, 0);
      }
    });
    menu.querySelectorAll('.custom-select-option').forEach(option => {
      option.addEventListener('click', event => {
        event.stopPropagation();
        input.value = option.dataset.value || option.textContent.trim();
        trigger.innerHTML = `${escapeHtml(input.value)} <span>⌄</span>`;
        menu.querySelectorAll('.custom-select-option').forEach(item => item.classList.toggle('is-selected', item === option));
        select.classList.remove('is-open');
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

function button(text, className, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = className;
  item.textContent = text;
  item.addEventListener('click', onClick);
  return item;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
