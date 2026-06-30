(() => {
  const root = document.getElementById('app');
  const VISIBILITY_KEY = 'actarium.timeVisible';
  const POSITION_KEY = 'actarium.timePosition';
  const SIZE_KEY = 'actarium.timeSize';
  const positions = new Set(['after-day', 'right-align', 'below-date', 'before-navigation']);
  let queued = false;

  function visible() {
    return localStorage.getItem(VISIBILITY_KEY) !== 'false';
  }

  function position() {
    const stored = localStorage.getItem(POSITION_KEY) || 'after-day';
    return positions.has(stored) ? stored : 'after-day';
  }

  function timeSize() {
    const stored = Number.parseInt(localStorage.getItem(SIZE_KEY) || '3', 10);
    return Number.isFinite(stored) ? Math.max(1, Math.min(10, stored)) : 3;
  }

  function berlinClockParts() {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const hour = parts.find(part => part.type === 'hour')?.value;
      const minute = parts.find(part => part.type === 'minute')?.value;
      if (hour && minute) return { hour: hour.padStart(2, '0'), minute: minute.padStart(2, '0') };
      const fallback = formatter.format(new Date()).match(/(\d{1,2})\D+(\d{2})/);
      if (fallback) return { hour: fallback[1].padStart(2, '0'), minute: fallback[2] };
    } catch (_) {
      // The fallback below is only for very old browsers without full Intl timezone support.
    }
    const local = new Date();
    return { hour: String(local.getHours()).padStart(2, '0'), minute: String(local.getMinutes()).padStart(2, '0') };
  }

  function applyClockSize(display) {
    const size = timeSize();
    display.dataset.timeSize = String(size);
    display.style.fontSize = size === 10 ? 'clamp(2rem,4vw,3.4rem)' : `${(0.7 + (size - 1) * 0.15).toFixed(2)}rem`;
    display.style.minHeight = size >= 8 ? 'auto' : '';
  }

  function clockDisplay(header) {
    let display = header.querySelector('.actarium-time-display');
    if (!display) {
      display = document.createElement('span');
      display.className = 'actarium-time-display';
      display.setAttribute('aria-label', 'Current Berlin time');
      const hour = document.createElement('span');
      hour.className = 'actarium-time-hour';
      const colon = document.createElement('span');
      colon.className = 'actarium-time-colon';
      colon.textContent = ':';
      const minute = document.createElement('span');
      minute.className = 'actarium-time-minute';
      display.append(hour, colon, minute);
    }
    const parts = berlinClockParts();
    const hour = display.querySelector('.actarium-time-hour');
    const minute = display.querySelector('.actarium-time-minute');
    if (hour && hour.textContent !== parts.hour) hour.textContent = parts.hour;
    if (minute && minute.textContent !== parts.minute) minute.textContent = parts.minute;
    applyClockSize(display);
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

  function timeSizeField() {
    const field = document.createElement('label');
    const label = document.createElement('span');
    label.append(document.createTextNode('Time size'));
    const output = document.createElement('output');
    output.value = String(timeSize());
    output.textContent = `${timeSize()} / 10`;
    label.append(output);
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '1';
    range.max = '10';
    range.step = '1';
    range.value = String(timeSize());
    range.setAttribute('aria-label', 'Clock size from 1 to 10');
    const note = document.createElement('small');
    note.className = 'actarium-time-scale-note';
    note.innerHTML = '<span>Small</span><span>10 = Day title</span>';
    range.addEventListener('input', () => {
      const value = Math.max(1, Math.min(10, Number.parseInt(range.value, 10) || 3));
      localStorage.setItem(SIZE_KEY, String(value));
      output.value = String(value);
      output.textContent = `${value} / 10`;
      renderClock();
    });
    field.append(label, range, note);
    return field;
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
    note.textContent = 'The clock is shown by default. Use the clock button beside the light/dark button to hide it, and its separator flashes once per second.';
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
    section.append(heading, note, field, timeSizeField());
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
  setInterval(renderClock, 10000);
  document.addEventListener('DOMContentLoaded', renderAll);
  renderAll();
})();