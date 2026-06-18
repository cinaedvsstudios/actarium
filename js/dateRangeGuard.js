(() => {
  const sleep = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

  const style = document.createElement('style');
  style.textContent = '.duplicate-actions{display:flex;justify-content:flex-end;gap:10px}.duplicate-actions .save{justify-self:auto}.duplicate-action{background:color-mix(in srgb,var(--soft) 86%,transparent)!important}';
  document.head.append(style);

  function dateRangeFor(input) {
    const row = input.closest('.form-two');
    if (!row) return null;
    const dates = [...row.querySelectorAll('input[type="date"]')];
    return dates.length >= 2 ? { start: dates[0], end: dates[1] } : null;
  }

  function keepEndOnOrAfterStart(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'date') return;
    const range = dateRangeFor(input);
    if (!range || range.start !== input) return;
    const startDate = range.start.value;
    const endDate = range.end.value;
    if (!startDate || (endDate && endDate >= startDate)) return;
    range.end.value = startDate;
    range.end.dispatchEvent(new Event('input', { bubbles: true }));
    range.end.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fieldByLabel(modal, label) {
    return [...modal.querySelectorAll('.field')].find(field => field.querySelector(':scope > span')?.textContent.trim() === label) || null;
  }

  function valueByLabel(modal, label) {
    return fieldByLabel(modal, label)?.querySelector('input,select,textarea')?.value || '';
  }

  function activeOption(scope, text) {
    return [...scope.querySelectorAll('.kind-option')].find(button => button.classList.contains('active') && button.textContent.includes(text));
  }

  function taskSnapshot(modal) {
    const dates = [...modal.querySelectorAll('input[type="date"]')];
    const alarm = fieldByLabel(modal, 'Alarm');
    const taskType = fieldByLabel(modal, 'Task type');
    return {
      kind: activeOption(modal, 'Reminder') ? 'reminder' : 'task',
      title: valueByLabel(modal, 'Title'),
      start: dates[0]?.value || '',
      end: dates[1]?.value || '',
      project: modal.querySelector('.project-custom')?.value || '',
      priority: valueByLabel(modal, 'Priority'),
      status: valueByLabel(modal, 'Status'),
      recurrence: valueByLabel(modal, 'Repeat'),
      repeatUntil: valueByLabel(modal, 'Repeat until'),
      link: valueByLabel(modal, 'Link'),
      notes: valueByLabel(modal, 'Notes'),
      alarmEnabled: Boolean(alarm && activeOption(alarm, 'Yes')),
      alarmTime: alarm?.querySelector('input[type="time"]')?.value || '',
      isWork: Boolean(taskType && activeOption(taskType, 'Work'))
    };
  }

  function setControl(element, value, eventName = 'input') {
    if (!element) return;
    element.value = value || '';
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  }

  async function waitFor(check, timeout = 1200) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = check();
      if (value) return value;
      await sleep(25);
    }
    return null;
  }

  function buttonWithText(text, root = document) {
    return [...root.querySelectorAll('button')].find(button => button.textContent.includes(text));
  }

  async function duplicateItem(modal) {
    const copy = taskSnapshot(modal);
    modal.querySelector('.modal-head .icon')?.click();
    await waitFor(() => !document.querySelector('.modal'));

    buttonWithText('New task')?.click();
    let editor = await waitFor(() => document.querySelector('.modal'));
    if (!editor) return;

    if (copy.kind === 'reminder') {
      buttonWithText('Reminder', editor)?.click();
      await sleep(40);
      editor = document.querySelector('.modal');
    }

    if (copy.kind === 'task' && copy.isWork) {
      buttonWithText('Work', editor)?.click();
      await sleep(40);
      editor = document.querySelector('.modal');
    }

    if (copy.kind === 'reminder' && copy.alarmEnabled) {
      const alarm = fieldByLabel(editor, 'Alarm');
      buttonWithText('Yes', alarm)?.click();
      await sleep(40);
      editor = document.querySelector('.modal');
    }

    setControl(fieldByLabel(editor, 'Title')?.querySelector('input'), copy.title);
    const dates = [...editor.querySelectorAll('input[type="date"]')];
    setControl(dates[0], copy.start);
    setControl(dates[1], copy.end || copy.start);
    setControl(editor.querySelector('.project-custom'), copy.project);
    setControl(fieldByLabel(editor, 'Priority')?.querySelector('select'), copy.priority, 'change');
    setControl(fieldByLabel(editor, 'Status')?.querySelector('select'), copy.status, 'change');
    setControl(fieldByLabel(editor, 'Repeat')?.querySelector('select'), copy.recurrence, 'change');
    setControl(fieldByLabel(editor, 'Repeat until')?.querySelector('input'), copy.repeatUntil);
    setControl(fieldByLabel(editor, 'Link')?.querySelector('input'), copy.link);
    setControl(fieldByLabel(editor, 'Notes')?.querySelector('textarea'), copy.notes);
    setControl(fieldByLabel(editor, 'Alarm')?.querySelector('input[type="time"]'), copy.alarmTime);
  }

  function addDuplicateControl() {
    const modal = document.querySelector('.modal');
    const heading = modal?.querySelector('.modal-head h2')?.textContent || '';
    const save = modal?.querySelector('button.save');
    if (!modal || !/Edit item/i.test(heading) || !save || save.closest('.duplicate-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'duplicate-actions';
    save.replaceWith(actions);
    actions.append(save);

    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.className = 'save duplicate-action';
    duplicate.textContent = '⧉ Duplicate';
    duplicate.addEventListener('click', () => duplicateItem(modal));
    actions.append(duplicate);
  }

  document.addEventListener('input', keepEndOnOrAfterStart, true);
  document.addEventListener('change', keepEndOnOrAfterStart, true);
  new MutationObserver(addDuplicateControl).observe(document.documentElement, { childList: true, subtree: true });
  addDuplicateControl();
})();
