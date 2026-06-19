(() => {
  const RELEASE = 'v3.18.0';
  const API = window.ACTARIUM_API;
  const projects = new Set(['General', 'Shopping List']);
  const drafts = { task: null, reminder: null };
  let pendingDraft = null;
  let mobileMode = sessionStorage.getItem('actarium.mobileDateMode') || 'day';
  let queued = false;

  function labelText(field) {
    return String(field?.querySelector('span')?.textContent || '').trim();
  }

  function fieldByLabel(root, label) {
    return [...root.querySelectorAll('.actarium-field')].find(field => labelText(field) === label) || null;
  }

  function inputByLabel(root, label) {
    return fieldByLabel(root, label)?.querySelector('input,textarea,select') || null;
  }

  function selectedKind(modal) {
    const active = modal.querySelector('.actarium-editor-tabs button.active');
    return /reminder/i.test(String(active?.textContent || '')) ? 'reminder' : 'task';
  }

  function readForm(modal) {
    const get = label => inputByLabel(modal, label);
    const start = get('Start date') || get('Reminder date');
    const alarm = get('Alarm');
    return {
      title: get('Title')?.value || '',
      emoji: get('Custom emoji')?.value || '',
      project: get('Project')?.value || 'General',
      start: start?.value || '',
      end: get('End date')?.value || '',
      priority: get('Priority')?.value || 'Normal',
      status: get('Status')?.value || 'Not started',
      taskType: get('Task type')?.value || 'Personal',
      recurrence: get('Repeat')?.value || 'None',
      repeatUntil: get('Repeat until')?.value || '',
      link: get('Link')?.value || '',
      notes: get('Notes')?.value || '',
      alarmEnabled: alarm?.value === 'Yes',
      alarmTime: get('Alarm time')?.value || ''
    };
  }

  function applyForm(modal, data) {
    const set = (label, value) => {
      const input = inputByLabel(modal, label);
      if (!input || value === undefined || value === null) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('Title', data.title);
    set('Custom emoji', data.emoji);
    set('Project', data.project);
    set('Start date', data.start);
    set('Reminder date', data.start);
    set('End date', data.end || data.start);
    set('Priority', data.priority);
    set('Status', data.status);
    set('Task type', data.taskType);
    set('Repeat', data.recurrence);
    set('Repeat until', data.repeatUntil);
    set('Link', data.link);
    set('Notes', data.notes);
    set('Alarm', data.alarmEnabled ? 'Yes' : 'No');
    set('Alarm time', data.alarmTime);
  }

  function moveSaveToHeader(modal) {
    if (!modal.querySelector('.actarium-editor-tabs')) return;
    const head = modal.querySelector('.actarium-modal-head');
    const save = modal.querySelector('.actarium-form-actions .primary');
    const close = [...head.querySelectorAll('button')].find(button => String(button.textContent || '').trim() === '✕');
    if (!head || !save || !close) return;
    let actions = head.querySelector('.actarium-editor-header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'actarium-editor-header-actions';
      head.append(actions);
    }
    save.classList.add('actarium-editor-save');
    actions.append(save, close);
  }

  function addProjectSuggestions(modal) {
    const project = inputByLabel(modal, 'Project');
    if (!project) return;
    let list = document.getElementById('actarium-project-suggestions');
    if (!list) {
      list = document.createElement('datalist');
      list.id = 'actarium-project-suggestions';
      list.className = 'actarium-project-suggestions';
      document.body.append(list);
    }
    list.replaceChildren();
    [...projects].sort((a, b) => a.localeCompare(b)).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      list.append(option);
    });
    project.setAttribute('list', list.id);
  }

  function addEmojiPicker(modal) {
    const wrapper = fieldByLabel(modal, 'Custom emoji');
    const input = inputByLabel(modal, 'Custom emoji');
    if (!wrapper || !input || wrapper.querySelector('.actarium-emoji-picker-trigger')) return;
    const row = document.createElement('div');
    row.className = 'actarium-emoji-field-row';
    input.parentElement?.insertBefore(row, input);
    row.append(input);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'actarium-emoji-picker-trigger';
    trigger.textContent = '😀';
    trigger.title = 'Choose an emoji';
    trigger.setAttribute('aria-label', 'Choose an emoji');
    trigger.addEventListener('click', () => window.ActariumEmojiPicker?.open(input));
    row.append(trigger);
  }

  function applyMobileFormLayout(modal) {
    ['Title', 'Link', 'Notes'].forEach(label => fieldByLabel(modal, label)?.classList.add('actarium-mobile-full'));
  }

  function enhanceModal(modal) {
    moveSaveToHeader(modal);
    addProjectSuggestions(modal);
    addEmojiPicker(modal);
    applyMobileFormLayout(modal);
    if (pendingDraft && selectedKind(modal) === pendingDraft.kind) {
      applyForm(modal, pendingDraft.data);
      drafts[pendingDraft.kind] = { ...pendingDraft.data };
      pendingDraft = null;
    }
  }

  function updateRelease() {
    document.querySelectorAll('.actarium-version').forEach(node => {
      if (node.textContent !== RELEASE) node.textContent = RELEASE;
    });
  }

  function parseHeaderDate() {
    const source = String(document.querySelector('.actarium-date')?.textContent || '');
    const match = source.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (!match) return new Date();
    return new Date(2000 + Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  function sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function displayedCalendarMonth(modal) {
    const text = String(modal.querySelector('.actarium-calendar-nav strong')?.textContent || '');
    const date = new Date(`${text} 1`);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  function waitFor(selector, timeout = 1600) {
    return new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        const found = document.querySelector(selector);
        if (found || Date.now() - started >= timeout) return resolve(found || null);
        requestAnimationFrame(check);
      };
      check();
    });
  }

  async function chooseDate(target) {
    const title = document.querySelector('.actarium-day-button');
    if (!title) return;
    title.click();
    let modal = await waitFor('.actarium-modal');
    if (!modal) return;

    for (let safety = 0; safety < 24; safety += 1) {
      modal = document.querySelector('.actarium-modal');
      const current = modal && displayedCalendarMonth(modal);
      if (!current || sameMonth(current, target)) break;
      const nav = [...modal.querySelectorAll('.actarium-calendar-nav button')];
      (target > current ? nav[2] : nav[0])?.click();
      await waitFor('.actarium-modal');
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    modal = document.querySelector('.actarium-modal');
    const day = String(target.getDate());
    const targetButton = [...(modal?.querySelectorAll('.actarium-calendar-day') || [])].find(button => String(button.textContent || '').trim() === day);
    targetButton?.click();
  }

  function shiftMobileDate(direction) {
    const current = parseHeaderDate();
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    if (mobileMode === 'month') next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction);
    chooseDate(next);
  }

  function addMobileDateControls(header) {
    const day = header.querySelector('.actarium-day-block');
    if (!day || day.querySelector('.actarium-mobile-date-controls')) return;
    const controls = document.createElement('div');
    controls.className = 'actarium-mobile-date-controls';
    const make = (label, title, onClick) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.title = title;
      button.setAttribute('aria-label', title);
      button.addEventListener('click', onClick);
      return button;
    };
    const previous = make('‹', 'Previous day or month', () => shiftMobileDate(-1));
    const dayMode = make('☀️', 'Day mode', () => { mobileMode = 'day'; sessionStorage.setItem('actarium.mobileDateMode', mobileMode); refresh(); });
    const monthMode = make('🌙', 'Month mode', () => { mobileMode = 'month'; sessionStorage.setItem('actarium.mobileDateMode', mobileMode); refresh(); });
    const next = make('›', 'Next day or month', () => shiftMobileDate(1));
    const today = make('↻', 'Return to today', () => { mobileMode = 'day'; sessionStorage.setItem('actarium.mobileDateMode', mobileMode); chooseDate(new Date()); });
    dayMode.classList.toggle('active', mobileMode === 'day');
    monthMode.classList.toggle('active', mobileMode === 'month');
    controls.append(previous, dayMode, monthMode, next, today);
    day.append(controls);
  }

  async function loadProjects() {
    if (!API) return;
    try {
      const url = new URL(API);
      url.searchParams.set('action', 'bootstrap');
      const response = await fetch(url.href, { cache: 'no-store' });
      const data = await response.json();
      [...(data.tasks || []), ...(data.reminders || [])].forEach(item => {
        const value = String(item.project || item.area || '').trim();
        if (value) projects.add(value);
      });
      queue();
    } catch (_) {}
  }

  function refresh() {
    document.querySelectorAll('.actarium-modal').forEach(enhanceModal);
    document.querySelectorAll('.actarium-header').forEach(addMobileDateControls);
    updateRelease();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      refresh();
    });
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('.actarium-editor-tabs button');
    if (tab) {
      const modal = tab.closest('.actarium-modal');
      if (modal) {
        const currentKind = selectedKind(modal);
        const current = readForm(modal);
        drafts[currentKind] = current;
        const targetKind = /reminder/i.test(String(tab.textContent || '')) ? 'reminder' : 'task';
        pendingDraft = { kind: targetKind, data: { ...current, ...(drafts[targetKind] || {}) } };
        queue();
      }
      return;
    }

    const open = event.target.closest('.actarium-item-content, .actarium-action-row button.primary');
    if (open && /new task|✨/i.test(String(open.textContent || ''))) {
      drafts.task = null;
      drafts.reminder = null;
      pendingDraft = null;
    }
  }, true);

  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  loadProjects();
  refresh();
})();
