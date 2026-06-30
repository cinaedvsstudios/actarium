(() => {
  const root = document.getElementById('app');
  const VISIBILITY_KEY = 'actarium.timeVisible';
  const POSITION_KEY = 'actarium.timePosition';
  const positions = new Set(['after-day', 'right-align', 'below-date', 'before-navigation']);
  let queued = false;

  function visible() {
    return localStorage.getItem(VISIBILITY_KEY) === 'true';
  }

  function position() {
    const stored = localStorage.getItem(POSITION_KEY) || 'after-day';
    return positions.has(stored) ? stored : 'after-day';
  }

  function berlinTime() {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date());
  }

  function clockDisplay(header) {
    let display = header.querySelector('.actarium-time-display');
    if (!display) {
      display = document.createElement('span');
      display.className = 'actarium-time-display';
      display.setAttribute('aria-label', 'Current Berlin time');
    }
    const time = berlinTime();
    if (display.textContent !== time) display.textContent = time;
    return display;
  }

  function syncClockButton(header) {
    const actions = header.querySelector('.actarium-action-row');
    if (!actions) return;
    let toggle = actions.querySelector('.actarium-clock-toggle');
    if (!toggle) {
      const themeButton = actions.querySelector('button.icon-only');
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'icon-only actarium-clock-toggle';
      toggle.textContent = '🕒';
      if (themeButton) themeButton.insertAdjacentElement('afterend', toggle);
      else actions.prepend(toggle);
    }
    const active = visible();
    toggle.classList.toggle('is-active', active);
    toggle.setAttribute('aria-pressed', String(active));
    toggle.title = active ? 'Hide 24-hour Berlin time' : 'Show 24-hour Berlin time';
  }

  function targetForClock(header) {
    const selected = position();
    if (selected === 'right-align') {
      const sync = header.querySelector('.actarium-sync-top');
      if (sync) return sync;
      let right = header.querySelector('.actarium-time-right');
      if (!right) {
        right = document.createElement('div');
        right.className = 'actarium-time-right';
        header.append(right);
      }
      return right;
    }
    if (selected === 'below-date') {
      const day = header.querySelector('.actarium-day-block');
      if (!day) return null;
      let below = day.querySelector('.actarium-time-below-date');
      if (!below) {
        below = document.createElement('div');
        below.className = 'actarium-time-below-date';
        day.append(below);
      }
      return below;
    }
    if (selected === 'before-navigation') return header.querySelector('.actarium-action-row');
    return header.querySelector('.actarium-date-line') || header.querySelector('.actarium-day-block');
  }

  function renderClock() {
    const header = root?.querySelector('.actarium-header');
    if (!header) return;
    syncClockButton(header);
    header.querySelectorAll('.actarium-time-display').forEach(node => {
      if (!visible()) node.remove();
    });
    if (!visible()) return;
    const target = targetForClock(header);
    if (!target) return;
    const display = clockDisplay(header);
    display.classList.toggle('actarium-time-before-nav', position() === 'before-navigation');
    if (display.parentElement !== target) {
      if (position() === 'before-navigation') target.prepend(display);
      else target.append(display);
    }
  }

  function addSettingsSection() {
    const modal = [...document.querySelectorAll('.actarium-modal')].find(node => node.querySelector('.actarium-modal-head h2')?.textContent.trim() === 'Settings');
    if (!modal || modal.querySelector('.actarium-time-settings')) return;
    const body = modal.querySelector('.actarium-modal-body');
    if (!body) return;
    const section = document.createElement('section');
    section.className = 'actarium-time-settings';
    const heading = document.createElement('h3');
    heading.textContent = 'Clock display';
    const note = document.createElement('p');
    note.textContent = 'Use the clock button beside the light/dark button to show or hide the current 24-hour Berlin time.';
    const field = document.createElement('label');
    const label = document.createElement('span');
    label.textContent = 'Time position';
    const select = document.createElement('select');
    select.name = 'actarium-time-position';
    [
      ['after-day', 'After day title'],
      ['right-align', 'Right aligned'],
      ['below-date', 'Below date'],
      ['before-navigation', 'Before navigation']
    ].forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = value === position();
      select.append(option);
    });
    select.addEventListener('change', () => {
      localStorage.setItem(POSITION_KEY, positions.has(select.value) ? select.value : 'after-day');
      renderClock();
    });
    field.append(label, select);
    section.append(heading, note, field);
    const managerButton = [...body.querySelectorAll('button')].find(button => /schedules & routines/i.test(button.textContent));
    if (managerButton) managerButton.insertAdjacentElement('afterend', section);
    else body.prepend(section);
  }

  function renderAll() {
    renderClock();
    addSettingsSection();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderAll();
    });
  }

  window.addEventListener('click', event => {
    const button = event.target.closest('.actarium-clock-toggle');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    localStorage.setItem(VISIBILITY_KEY, String(!visible()));
    renderClock();
  }, true);

  const observer = new MutationObserver(schedule);
  if (root) observer.observe(root, { childList: true, subtree: true });
  setInterval(renderClock, 15000);
  document.addEventListener('DOMContentLoaded', renderAll);
  renderAll();
})();