import * as api from './api.js';
import { state, closeModal, createEmptyTask } from './state.js';
import { parseSectionText } from './sheetParser.js';
import { createInfoSection, isDone } from './cards.js';

export function renderModal() {
  if (!state.modal) return null;
  if (state.modal.type === 'task-detail') return renderTaskDetail(state.modal.taskId);
  if (state.modal.type === 'task-form') return renderTaskForm(state.modal.taskId);
  return null;
}

export function openNewTask() {
  state.modal = { type: 'task-form', taskId: null };
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
      <span class="status-pill ${isDone(task) ? 'done' : 'purple'}">${task.status || 'Open'}</span>
      <span class="status-pill teal">${task.source || 'Actarium'}</span>
      <span class="status-pill warn">${task.priority || 'Normal'}</span>
      ${task.recurrence && task.recurrence !== 'None' ? `<span class="status-pill teal">🔁 ${task.recurrence}</span>` : ''}
    </div>
    <div class="info-section"><strong>Date</strong><p>${task.startDate || task.dueDate || '—'}${task.endDate && task.endDate !== task.startDate ? ` → ${task.endDate}` : ''}</p></div>
    <div class="info-section"><strong>Area</strong><p>${task.area || 'General'}</p></div>
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
    button('✏️ Edit', 'primary-button', () => { state.modal = { type: 'task-form', taskId: task.id }; window.dispatchEvent(new CustomEvent('actarium:render')); }),
    button(isDone(task) ? '↩️ Reopen' : '✅ Mark done', 'secondary-button', () => { api.markTaskDone(task.id, !isDone(task)); closeModal(); }),
    button('🗑️ Delete', 'danger-button', () => { if (confirm('Delete this local task?')) { api.deleteTask(task.id); closeModal(); } })
  );
  body.append(actions);
  return backdrop;
}

function renderTaskForm(taskId) {
  const existing = state.tasks.find(item => String(item.id) === String(taskId));
  const task = existing ? { ...existing } : createEmptyTask();
  const backdrop = modalShell(existing ? `✏️ Edit task` : '➕ Create task', 'Calendar-style date range and recurrence.');
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
      ${field('Area', 'area', 'text', task.area || 'General', 'Apps, Fitness, Travel…')}
      ${field('Source', 'source', 'text', task.source || 'Actarium', 'Actarium, ChrisFit, Viaticum…')}
    </div>
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

  form.querySelector('[data-close]').addEventListener('click', closeModal);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const startDate = data.get('startDate') || task.startDate;
    const endDate = data.get('endDate') || startDate;
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
      area: data.get('area'),
      source: data.get('source'),
      link: data.get('link'),
      notes: data.get('notes')
    });
    closeModal();
  });

  body.append(form);
  return backdrop;
}

function modalShell(title, subtitle) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
  backdrop.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(subtitle || '')}</p></div>
        <button type="button" class="icon-button" data-close title="Close">✖️</button>
      </div>
      <div class="modal-body"></div>
    </section>
  `;
  backdrop.querySelector('[data-close]').addEventListener('click', closeModal);
  return backdrop;
}

function field(label, name, type, value = '', placeholder = '') {
  return `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input id="${name}" name="${name}" type="${type}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" /></div>`;
}

function selectField(label, name, value, options) {
  const opts = options.map(option => `<option value="${escapeAttribute(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
  return `<div class="field"><label for="${name}">${escapeHtml(label)}</label><select id="${name}" name="${name}">${opts}</select></div>`;
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
