(() => {
  const API = () => String(window.ACTARIUM_API || '');
  let bootstrap = null;
  let selected = null;
  let queued = false;

  const style = document.createElement('style');
  style.textContent = '.actarium-mark-done{background:rgba(49,148,98,.23)!important;border-color:rgba(102,220,147,.58)!important}.editor-actions .actarium-mark-done{min-height:40px;padding:0 14px;border:1px solid rgba(102,220,147,.58);border-radius:11px;color:var(--text);font-weight:850}';
  document.head.append(style);

  function value(row, ...names) {
    const keys = Object.keys(row || {});
    for (const name of names) {
      const key = keys.find(candidate => candidate.toLowerCase() === String(name).toLowerCase());
      if (key && String(row[key] ?? '').trim() !== '') return row[key];
    }
    return '';
  }

  function asDate(value) {
    const text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(value || Date.now());
  }

  function displayDate(value) {
    const date = asDate(value);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
  }

  async function load() {
    try {
      const response = await fetch(`${API()}?action=bootstrap`, { cache: 'no-store' });
      const payload = await response.json();
      if (payload && payload.success !== false) bootstrap = payload;
    } catch (error) {
      console.warn('Actarium done control data unavailable:', error);
    }
  }

  function matchItem(title, project, date, kind) {
    const records = kind === 'reminder' ? bootstrap?.reminders || [] : bootstrap?.tasks || [];
    const candidates = records.filter(item => String(value(item, 'title')) === title && String(value(item, 'project', 'area') || 'General') === project);
    return candidates.find(item => displayDate(value(item, 'start_date', 'due_date', 'date')) === date) || candidates[0] || null;
  }

  function capture(event) {
    const rolling = event.target.closest('.actarium-rolling-card');
    const standard = event.target.closest('.task-detail, .more');
    const source = rolling || standard;
    if (!source || !bootstrap) return;

    const titleText = String((rolling ? rolling.querySelector('strong')?.textContent : source.closest('.task-row')?.querySelector('h3')?.textContent) || '');
    const kind = /^\s*🔔/.test(titleText) ? 'reminder' : 'task';
    const title = titleText.replace(/^\s*(?:🔔|🏠|💼|✅)\s*/, '').trim();
    const info = String((rolling ? rolling.querySelector('span')?.textContent : source.closest('.task-row')?.querySelector('.task-detail p')?.textContent) || '');
    const [project = 'General', date = ''] = info.split(' · ').map(part => part.trim());
    const item = matchItem(title, project, date, kind);
    if (item) selected = { kind, id: String(value(item, 'id')), title: value(item, 'title') };
  }

  async function markDone() {
    if (!selected?.id) {
      alert('Open the task or reminder again, then choose Mark as done.');
      return;
    }
    try {
      await fetch(API(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: selected.kind === 'reminder' ? 'markRemindersDone' : 'markTasksDone',
          ids: [selected.id],
          completedAt: new Date().toISOString()
        })
      }).then(async response => {
        const payload = await response.json();
        if (!response.ok || payload.success === false) throw new Error(payload.error || 'Could not mark item as done.');
      });
      window.location.reload();
    } catch (error) {
      alert(`Could not mark as done: ${error.message}`);
    }
  }

  function button() {
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'actarium-mark-done';
    done.textContent = '✓ Mark as done';
    done.onclick = markDone;
    return done;
  }

  function addButtons() {
    const panelActions = document.querySelector('.actarium-overlay .actarium-panel-actions');
    if (panelActions && !panelActions.querySelector('.actarium-mark-done')) {
      const save = panelActions.querySelector('button');
      panelActions.insertBefore(button(), save?.nextSibling || null);
    }

    const editorActions = document.querySelector('.modal .editor-actions');
    const heading = document.querySelector('.modal .modal-head h2')?.textContent || '';
    if (editorActions && /Edit item/i.test(heading) && !editorActions.querySelector('.actarium-mark-done')) {
      const save = editorActions.querySelector('.save');
      editorActions.insertBefore(button(), save?.nextSibling || null);
    }
  }

  function refresh() {
    queued = false;
    addButtons();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  document.addEventListener('click', capture, true);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  load().finally(schedule);
})();
