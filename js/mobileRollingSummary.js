(() => {
  const DAY = 86400000;
  let bootstrap = null;
  let loading = false;

  const safe = fn => {
    try { fn(); } catch (error) { console.warn('Actarium mobile display helper:', error); }
  };

  function value(row, ...names) {
    const keys = Object.keys(row || {});
    for (const name of names) {
      const key = keys.find(candidate => candidate.toLowerCase() === name.toLowerCase());
      if (key && String(row[key] ?? '').trim() !== '') return row[key];
    }
    return '';
  }

  function iso(date) {
    const local = date instanceof Date ? date : asDate(date);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
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
    const uk = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (uk) return iso(new Date(`${uk[2]} ${uk[1]}, ${uk[3]}`));
    const short = text.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (short) return `20${short[3]}-${short[2]}-${short[1]}`;
    return iso(new Date());
  }

  function itemDate(item, anchor) {
    const original = value(item, 'start_date', 'startDate', 'due_date', 'dueDate', 'date');
    const recurrence = String(value(item, 'recurrence') || 'None');
    if (!original || recurrence === 'None') return original;
    const until = value(item, 'repeat_until', 'repeatUntil');
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

  function active(item) {
    const status = String(value(item, 'status')).toLowerCase();
    return !/done|cancelled|deleted/.test(status) && !value(item, 'completed_at', 'completedAt');
  }

  function inRange(item, start, end) {
    const next = itemDate(item, start);
    return Boolean(next && next >= start && next <= end);
  }

  function selectedWindow(anchor) {
    const reminders = (bootstrap?.reminders || []).filter(active);
    const todayEnd = anchor;
    const weekEnd = iso(addDays(anchor, 6));
    const monthEnd = iso(addDays(anchor, 29));
    if (reminders.some(item => inRange(item, anchor, todayEnd))) return { key: 'today', start: anchor, end: todayEnd, title: 'Today' };
    if (reminders.some(item => inRange(item, anchor, weekEnd))) return { key: 'week', start: anchor, end: weekEnd, title: 'Next 7 days' };
    return { key: 'month', start: anchor, end: monthEnd, title: 'Next 30 days' };
  }

  function isWork(item) {
    const text = `${value(item, 'task_type', 'taskType')} ${value(item, 'project', 'area')} ${value(item, 'source')} ${value(item, 'title')} ${value(item, 'notes')}`;
    return /work|zalando|nike|office/i.test(text);
  }

  function listItem(item, kind, anchor) {
    const card = document.createElement('article');
    card.className = 'mobile-rolling-item';
    const title = document.createElement('strong');
    const kindIcon = kind === 'reminder' ? '🔔' : (isWork(item) ? '💼' : '🏠');
    title.textContent = `${kindIcon} ${value(item, 'title') || 'Untitled item'}`;
    const detail = document.createElement('span');
    detail.textContent = `${value(item, 'project', 'area') || 'General'} · ${displayDate(itemDate(item, anchor))}`;
    card.append(title, detail);
    return card;
  }

  function heading(text) {
    const node = document.createElement('h4');
    node.className = 'mobile-rolling-heading';
    node.textContent = text;
    return node;
  }

  function renderMobileWindow() {
    const section = [...document.querySelectorAll('.viewer-section')].find(node => /Tasks\s*&\s*reminders/i.test(node.querySelector('h3')?.textContent || ''));
    if (!section || !bootstrap) return;

    const original = section.querySelector('.tasks-body');
    if (!original) return;

    const anchor = pageDate();
    const windowData = selectedWindow(anchor);
    const signature = `${anchor}:${windowData.key}:${(bootstrap.tasks || []).length}:${(bootstrap.reminders || []).length}`;
    if (section.dataset.rollingSignature === signature) return;
    section.dataset.rollingSignature = signature;

    original.style.display = 'none';
    section.querySelector('.mobile-rolling-window')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'mobile-rolling-window';
    const label = document.createElement('div');
    label.className = 'mobile-rolling-label';
    label.textContent = windowData.title;
    wrap.append(label);

    const tasks = (bootstrap.tasks || []).filter(active).filter(item => inRange(item, windowData.start, windowData.end));
    const reminders = (bootstrap.reminders || []).filter(active).filter(item => inRange(item, windowData.start, windowData.end));

    let filter = 'all';
    const controls = document.createElement('div');
    controls.className = 'mobile-rolling-filters';
    const taskList = document.createElement('div');
    const reminderList = document.createElement('div');

    function draw() {
      taskList.replaceChildren(heading(`✅ Tasks · ${windowData.title}`));
      const shown = filter === 'work' ? tasks.filter(isWork) : filter === 'personal' ? tasks.filter(item => !isWork(item)) : tasks;
      if (shown.length) shown.forEach(item => taskList.append(listItem(item, 'task', windowData.start)));
      else {
        const empty = document.createElement('p');
        empty.className = 'mobile-rolling-empty';
        empty.textContent = 'No tasks in this window.';
        taskList.append(empty);
      }

      reminderList.replaceChildren(heading(`🔔 Reminders · ${windowData.title}`));
      if (reminders.length) reminders.forEach(item => reminderList.append(listItem(item, 'reminder', windowData.start)));
      else {
        const empty = document.createElement('p');
        empty.className = 'mobile-rolling-empty';
        empty.textContent = 'No reminders in this window.';
        reminderList.append(empty);
      }

      [...controls.querySelectorAll('button')].forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
    }

    [['all', '🌐 All'], ['personal', '🏠 Personal'], ['work', '💼 Work']].forEach(([key, text]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = key;
      button.textContent = text;
      button.onclick = () => { filter = key; draw(); };
      controls.append(button);
    });

    wrap.append(controls, taskList, reminderList);
    section.append(wrap);
    draw();
  }

  function suppressGenericContext() {
    const pill = document.querySelector('.context-pill');
    if (pill && /^\s*(?:💼\s*)?Work day\s*$/i.test(pill.textContent || '')) {
      pill.remove();
    }
  }

  function formatVisibleDates() {
    const header = document.querySelector('.day-date');
    const text = String(header?.textContent || '').trim();
    const uk = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (header && uk && !header.dataset.shortDate) {
      header.textContent = displayDate(new Date(`${uk[2]} ${uk[1]}, ${uk[3]}`));
      header.dataset.shortDate = 'true';
    }

    document.querySelectorAll('.task-detail p').forEach(node => {
      if (node.dataset.shortDate) return;
      node.textContent = node.textContent.replace(/\b\d{4}-\d{2}-\d{2}\b/g, match => displayDate(match));
      node.dataset.shortDate = 'true';
    });
  }

  function refresh() {
    safe(suppressGenericContext);
    safe(formatVisibleDates);
    safe(renderMobileWindow);
  }

  async function load() {
    if (loading || !window.ACTARIUM_API) return;
    loading = true;
    try {
      const response = await fetch(`${window.ACTARIUM_API}?action=bootstrap`, { cache: 'no-store' });
      const data = await response.json();
      if (data && data.success !== false) bootstrap = data;
    } catch (error) {
      console.warn('Actarium mobile rolling data unavailable:', error);
    } finally {
      loading = false;
      refresh();
    }
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(refresh));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(load, 300);
  window.setTimeout(refresh, 450);
})();
