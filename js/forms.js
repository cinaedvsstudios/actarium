import { state, addTask, addLink, addIdea, showToast } from './state.js';
import { persistCurrentState } from './api.js';
import { todayIso, addDays } from './dateUtils.js';
import { normaliseTask, normaliseLink, normaliseIdea } from './sheetParser.js';

let activeForm = 'task';

export function renderQuickForm(compact = false) {
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-heading">
      <div>
        <h2>Quick add</h2>
        <p>Capture a task, link, or idea without leaving the dashboard.</p>
      </div>
    </div>
    <div class="form-tabs">
      <button class="ghost-button form-tab ${activeForm === 'task' ? 'active' : ''}" type="button" data-form="task">Task</button>
      <button class="ghost-button form-tab ${activeForm === 'link' ? 'active' : ''}" type="button" data-form="link">Link</button>
      <button class="ghost-button form-tab ${activeForm === 'idea' ? 'active' : ''}" type="button" data-form="idea">Idea</button>
    </div>
  `;

  card.querySelectorAll('[data-form]').forEach((button) => {
    button.addEventListener('click', () => {
      activeForm = button.dataset.form;
      card.replaceWith(renderQuickForm(compact));
    });
  });

  if (activeForm === 'link') card.appendChild(renderLinkForm(compact));
  else if (activeForm === 'idea') card.appendChild(renderIdeaForm(compact));
  else card.appendChild(renderTaskForm(compact));
  return card;
}

function renderTaskForm(compact) {
  const form = document.createElement('form');
  form.className = `quick-form ${compact ? '' : 'two-col'}`;
  form.innerHTML = `
    ${field('Title', 'title', 'text', 'What needs doing?')}
    ${field('Area', 'area', 'text', 'Apps, Travel, Fitness…')}
    ${field('Due date', 'dueDate', 'date', '', addDays(todayIso(), 1))}
    ${selectField('Priority', 'priority', ['High', 'Medium', 'Low'])}
    <div class="form-row wide"><label>Notes</label><textarea name="notes" placeholder="Optional context, link logic, map note, paid/unpaid detail…"></textarea></div>
    <div class="wide"><button class="primary-button" type="submit">Add task</button></div>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    addTask(normaliseTask({
      ...data,
      id: makeId('T'),
      source: 'Actarium',
      status: 'Not started',
      due_date: data.dueDate
    }));
    persistCurrentState(state);
    showToast('Task captured locally.');
    form.reset();
  });
  return form;
}

function renderLinkForm(compact) {
  const form = document.createElement('form');
  form.className = `quick-form ${compact ? '' : 'two-col'}`;
  form.innerHTML = `
    ${field('Title', 'title', 'text', 'Link title')}
    ${field('URL', 'url', 'url', 'https://…')}
    ${field('Category', 'category', 'text', 'Map, hotel, idea, doc…')}
    ${field('Review by', 'reviewBy', 'date', '', addDays(todayIso(), 14))}
    <div class="form-row wide"><label>Why saved</label><textarea name="whySaved" placeholder="Why this matters / what to check later"></textarea></div>
    <div class="wide"><button class="primary-button" type="submit">Add link</button></div>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    addLink(normaliseLink({ ...data, id: makeId('L'), why_saved: data.whySaved, review_by: data.reviewBy, status: 'To review' }));
    persistCurrentState(state);
    showToast('Link saved locally.');
    form.reset();
  });
  return form;
}

function renderIdeaForm(compact) {
  const form = document.createElement('form');
  form.className = `quick-form ${compact ? '' : 'two-col'}`;
  form.innerHTML = `
    <div class="form-row wide"><label>Idea</label><textarea name="idea" placeholder="Future thing to build, do, watch, book, check…"></textarea></div>
    ${field('Project', 'project', 'text', 'Actarium')}
    ${field('Category', 'category', 'text', 'Apps, Travel, Fitness…')}
    <div class="form-row wide"><label>Next action</label><textarea name="nextAction" placeholder="Optional next step"></textarea></div>
    <div class="wide"><button class="primary-button" type="submit">Add idea</button></div>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    addIdea(normaliseIdea({ ...data, id: makeId('I'), next_action: data.nextAction, status: 'Active', month: todayIso().slice(0, 7) }));
    persistCurrentState(state);
    showToast('Idea captured locally.');
    form.reset();
  });
  return form;
}

function field(label, name, type, placeholder = '', value = '') {
  return `<div class="form-row"><label>${label}</label><input name="${name}" type="${type}" placeholder="${placeholder}" value="${value}" /></div>`;
}

function selectField(label, name, options) {
  return `<div class="form-row"><label>${label}</label><select name="${name}">${options.map((option) => `<option>${option}</option>`).join('')}</select></div>`;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
