(() => {
  const root = document.getElementById('app');
  const KEY = 'actarium.taskGridColumns';
  const validColumns = new Set(['1', '2', '3', '4', '5', '6']);

  function gridColumns() {
    const stored = localStorage.getItem(KEY) || '6';
    return validColumns.has(stored) ? stored : '6';
  }

  function applyGridColumns() {
    const columns = gridColumns();
    document.querySelectorAll('.actarium-task-mode-items.view-thumbnail').forEach(grid => {
      grid.classList.remove(...[1, 2, 3, 4, 5, 6].map(value => `task-grid-columns-${value}`));
      grid.classList.add(`task-grid-columns-${columns}`);
    });
  }

  function isUrgentPill(node) {
    return node.classList.contains('priority-urgent') || /^urgent$/i.test(node.textContent.trim());
  }

  function applyUrgentGlow() {
    document.querySelectorAll('.actarium-task-mode-pill').forEach(pill => {
      if (!isUrgentPill(pill)) return;
      pill.closest('.actarium-task-mode-card, .actarium-task-mode-list-row')?.classList.add('urgent-glow');
    });
    document.querySelectorAll('.actarium-task-detail').forEach(detail => {
      const label = detail.querySelector('span')?.textContent.trim();
      const value = detail.querySelector('strong')?.textContent.trim();
      if (/^priority$/i.test(label || '') && /^urgent$/i.test(value || '')) detail.closest('.actarium-task-preview-card')?.classList.add('urgent-glow');
    });
  }

  function applyLoadingState() {
    document.querySelectorAll('.actarium-task-mode-intro span').forEach(node => {
      node.classList.toggle('is-task-loading', /^refreshing tasks/i.test(node.textContent.trim()));
    });
  }

  function closeSettings() {
    document.querySelector('.actarium-task-settings-backdrop')?.remove();
  }

  function openSettings() {
    closeSettings();
    const backdrop = document.createElement('div');
    backdrop.className = 'actarium-task-settings-backdrop';
    const modal = document.createElement('section');
    modal.className = 'actarium-task-settings';
    backdrop.append(modal);

    const head = document.createElement('div');
    head.className = 'actarium-task-settings-head';
    const title = document.createElement('h2');
    title.textContent = 'Task display settings';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'actarium-task-settings-close';
    close.textContent = '✕';
    close.addEventListener('click', closeSettings);
    head.append(title, close);

    const body = document.createElement('div');
    body.className = 'actarium-task-settings-body';
    const note = document.createElement('p');
    note.textContent = 'Choose how many task cards fit across each desktop row in Thumbnail view. Mobile stays one card wide so it remains readable.';
    const field = document.createElement('label');
    field.className = 'actarium-task-settings-field';
    const label = document.createElement('span');
    label.textContent = 'Tasks per row';
    const select = document.createElement('select');
    select.name = 'task-grid-columns';
    [1, 2, 3, 4, 5, 6].forEach(value => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      option.selected = String(value) === gridColumns();
      select.append(option);
    });
    field.append(label, select);

    const actions = document.createElement('div');
    actions.className = 'actarium-task-settings-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeSettings);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'primary';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      localStorage.setItem(KEY, validColumns.has(select.value) ? select.value : '6');
      applyGridColumns();
      closeSettings();
    });
    actions.append(cancel, save);
    body.append(note, field, actions);
    modal.append(head, body);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeSettings();
    });
    root?.append(backdrop);
  }

  function ensureSettingsButton() {
    const actions = document.querySelector('.actarium-task-mode-actions');
    if (!actions || actions.querySelector('.actarium-task-mode-settings')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'actarium-task-mode-settings';
    button.textContent = '⚙ Settings';
    button.addEventListener('click', openSettings);
    const quickAdd = [...actions.querySelectorAll('button')].find(node => /quick add/i.test(node.textContent));
    if (quickAdd) actions.insertBefore(button, quickAdd);
    else actions.append(button);
  }

  function enhance() {
    ensureSettingsButton();
    applyGridColumns();
    applyUrgentGlow();
    applyLoadingState();
  }

  const observer = new MutationObserver(enhance);
  if (root) observer.observe(root, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', enhance);
  enhance();
})();