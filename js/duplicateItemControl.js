(() => {
  const sleep = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

  const style = document.createElement('style');
  style.textContent = '.duplicate-actions{display:flex;justify-content:flex-end;gap:10px}.duplicate-actions .save{justify-self:auto}.duplicate-action{background:color-mix(in srgb,var(--soft) 86%,transparent)!important}';
  document.head.append(style);

  function fieldByLabel(modal, label) {
    return [...modal.querySelectorAll('.field')].find(field => field.querySelector(':scope > span')?.textContent.trim() === label) || null;
  }

  function controlValue(modal, label) {
    return fieldByLabel(modal, label)?.querySelector('input, select, textarea')?.value || '';
  }

  function activeButton(container, text) {
    return [...container.querySelectorAll('.kind-option')].find(button => button.classList.contains('active') && button.textContent.includes(text));
  }

  function snapshot(modal) {
    const dates = [...modal.querySelectorAll('input[type="date"]')];
    const kind = activeButton(modal, 'Reminder') ? 'reminder' : 'task';
    const alarm = fieldByLabel(modal, 'Alarm');
    const taskType = fieldByLabel(modal, 'Task type');

    return {
      kind,
      title: controlValue(modal, 'Title'),
      start: dates[0]?.value || '',
      end: dates[1]?.value || '',
      project: modal.querySelector('.project-custom')?.value || '',
      priority: controlValue(modal, 'Priority'),
      status: controlValue(modal, 'Status'),
      recurrence: controlValue(modal, 'Repeat'),
      repeatUntil: controlValue(modal, 'Repeat until'),
      link: controlValue(modal, 'Link'),
      notes: controlValue(modal, 'Notes'),
      alarmEnabled: Boolean(alarm && activeButton(alarm, 'Yes')),
      alarmTime: alarm?.querySelector('input[type="time"]')?.value || '',
      work: Boolean(taskType && activeButton(taskType, 'Work'))
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

  function findAction(label) {
    return [...document.querySelectorAll('button')].find(button => button.textContent.includes(label));
  }

  async function duplicate(modal) {
    const copy = snapshot(modal);
    modal.querySelector('.modal-head .icon')?.click();
    await waitFor(() => !document.querySelector('.modal'));

    findAction('New task')?.click();
    let editor = await waitFor(() => document.querySelector('.modal'));
    if (!editor) return;

    if (copy.kind === 'reminder') {
      findAction('Reminder')?.click();
      editor = await waitFor(() => activeButton(document.querySelector('.modal'), 'Reminder'))?.closest('.modal') || document.querySelector('.modal');
      await sleep(30);
    }

    if (copy.kind === 'task' && copy.work) {
      const workButton = [...editor.querySelectorAll('.kind-option')].find(button => button.textContent.includes('Work'));
      workButton?.click();
      await sleep(30);
      editor = document.querySelector('.modal');
    }

    if (copy.kind === 'reminder' && copy.alarmEnabled) {
      const alarm = fieldByLabel(editor, 'Alarm');
      [...alarm.querySelectorAll('.kind-option')].find(button => button.textContent === 'Yes')?.click();
      await sleep(30);
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

  function addDuplicateButton() {
    const modal = document.querySelector('.modal');
    const heading = modal?.querySelector('.modal-head h2')?.textContent || '';
    const save = modal?.querySelector('button.save');
    if (!modal || !/Edit item/i.test(heading) || !save || save.closest('.duplicate-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'duplicate-actions';
    save.replaceWith(actions);
    actions.append(save);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'save duplicate-action';
    button.textContent = '⧉ Duplicate';
    button.addEventListener('click', () => duplicate(modal));
    actions.append(button);
  }

  new MutationObserver(addDuplicateButton).observe(document.documentElement, { childList: true, subtree: true });
  addDuplicateButton();
})();
