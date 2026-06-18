const POLL_INTERVAL_MS = 10_000;

let getReminders = () => [];
let intervalId = null;
let audioContext = null;
let overlayActive = false;
let visibilityAttached = false;

export function startReminderAlarmService({ getReminders: provider }) {
  getReminders = typeof provider === 'function' ? provider : () => [];

  if (intervalId) window.clearInterval(intervalId);
  scanForDueReminder({ silent: true });
  intervalId = window.setInterval(() => scanForDueReminder({ silent: false }), POLL_INTERVAL_MS);

  if (!visibilityAttached) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scanForDueReminder({ silent: true });
    });
    visibilityAttached = true;
  }
}

export async function enableReminderAlarmCapability() {
  const audioEnabled = await unlockAudio();
  const notificationPermission = await requestNotificationPermission();
  return { audioEnabled, notificationPermission };
}

function scanForDueReminder({ silent }) {
  if (overlayActive) return;

  const now = new Date();
  const reminder = safeArray(getReminders()).find(item => isDue(item, now));
  if (!reminder) return;

  overlayActive = true;
  if (!silent) playAlarm(reminder);
  showRequiredActionWindow(reminder, { overdue: silent });
}

function isDue(reminder, now) {
  if (!isAlarmEnabled(reminder) || isDone(reminder)) return false;

  const snoozeUntil = parseLocalDateTime(reminder.snoozeUntil || reminder.snooze_until);
  if (snoozeUntil) return snoozeUntil <= now;

  if (!reminder.alarmTime && !reminder.alarm_time) return false;
  if (!occursToday(reminder, localIso(now))) return false;

  const minutes = timeToMinutes(reminder.alarmTime || reminder.alarm_time);
  if (minutes === null) return false;
  return now.getHours() * 60 + now.getMinutes() >= minutes;
}

function occursToday(reminder, today) {
  const start = normaliseIso(reminder.start || reminder.due || reminder.date);
  if (!start || start > today) return false;

  const repeatUntil = normaliseIso(reminder.repeatUntil || reminder.repeat_until);
  if (repeatUntil && today > repeatUntil) return false;

  const recurrence = String(reminder.recurrence || 'None').trim().toLowerCase();
  if (!recurrence || recurrence === 'none') return start === today;
  if (recurrence === 'daily') return true;

  const startDate = parseIso(start);
  const todayDate = parseIso(today);
  if (!startDate || !todayDate) return false;

  if (recurrence === 'weekly') {
    const days = Math.floor((todayDate - startDate) / 86_400_000);
    return days >= 0 && days % 7 === 0;
  }
  if (recurrence === 'weekdays') {
    const weekday = todayDate.getDay();
    return weekday >= 1 && weekday <= 5;
  }
  if (recurrence === 'monthly') return todayDate.getDate() === startDate.getDate();

  return start === today;
}

function showRequiredActionWindow(reminder, { overdue }) {
  removeExistingOverlay();

  const backdrop = document.createElement('div');
  backdrop.className = 'actarium-alarm-backdrop';
  backdrop.setAttribute('role', 'alertdialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Reminder alarm');

  const windowEl = document.createElement('section');
  windowEl.className = `actarium-alarm-window ${overdue ? 'is-overdue' : ''}`;

  const title = escapeHtml(reminder.title || 'Reminder due now');
  const when = reminder.snoozeUntil || reminder.snooze_until
    ? `Snoozed until ${formatLocalDateTime(reminder.snoozeUntil || reminder.snooze_until)}.`
    : `Alarm time ${escapeHtml(reminder.alarmTime || reminder.alarm_time || '')}.`;

  windowEl.innerHTML = `
    <p class="actarium-alarm-kicker">${overdue ? 'Missed reminder' : 'Reminder alarm'}</p>
    <h2>${title}</h2>
    <p>${overdue ? 'This reminder became due while Actarium was closed. No sound has been played.' : 'Choose one action to stop this alarm.'}</p>
    <p>${when}</p>
    <div class="actarium-alarm-time">
      <label> Snooze until
        <input id="actarium-snooze-time" type="time" value="${nextHourTime()}" aria-label="Snooze until time">
      </label>
      <span></span>
    </div>
    <div class="actarium-alarm-actions">
      <button type="button" class="actarium-alarm-done">✅ Mark done</button>
      <button type="button" class="actarium-alarm-snooze">⏰ Snooze</button>
    </div>
    <p class="actarium-alarm-error" aria-live="polite"></p>
  `;

  const doneButton = windowEl.querySelector('.actarium-alarm-done');
  const snoozeButton = windowEl.querySelector('.actarium-alarm-snooze');
  const timeInput = windowEl.querySelector('#actarium-snooze-time');
  const error = windowEl.querySelector('.actarium-alarm-error');

  doneButton.onclick = async () => {
    setBusy(true, doneButton, snoozeButton);
    try {
      await markDone(reminder);
      reloadForFreshData();
    } catch (reason) {
      setBusy(false, doneButton, snoozeButton);
      error.textContent = `Could not mark this reminder done: ${message(reason)}`;
    }
  };

  snoozeButton.onclick = async () => {
    const snoozeUntil = resolveSnoozeUntil(timeInput.value);
    if (!snoozeUntil) {
      error.textContent = 'Enter a valid 24-hour time.';
      return;
    }

    setBusy(true, doneButton, snoozeButton);
    try {
      await snoozeReminder(reminder, snoozeUntil);
      reloadForFreshData();
    } catch (reason) {
      setBusy(false, doneButton, snoozeButton);
      error.textContent = `Could not snooze this reminder: ${message(reason)}`;
    }
  };

  backdrop.append(windowEl);
  document.body.append(backdrop);
}

async function markDone(reminder) {
  const completedAt = new Date().toISOString();
  await post('markRemindersDone', { ids: [String(reminder.id)], completedAt });
  reminder.status = 'Done';
  reminder.completedAt = completedAt;
}

async function snoozeReminder(reminder, snoozeUntil) {
  await post('snoozeReminder', { id: String(reminder.id), snoozeUntil });
  reminder.snoozeUntil = snoozeUntil;
}

async function post(action, payload) {
  const endpoint = String(window.ACTARIUM_REMINDER_API || '');
  if (!endpoint) throw new Error('Actarium alarm backend is not configured.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
  const result = await response.json();
  if (result.success === false) throw new Error(result.error || 'Backend rejected request');
  return result;
}

function reloadForFreshData() {
  window.setTimeout(() => window.location.reload(), 160);
}

function setBusy(busy, ...buttons) {
  buttons.forEach(button => {
    button.disabled = busy;
    button.style.opacity = busy ? '0.6' : '1';
  });
}

function removeExistingOverlay() {
  document.querySelectorAll('.actarium-alarm-backdrop').forEach(node => node.remove());
}

function playAlarm(reminder) {
  playTone();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Actarium reminder', {
        body: reminder.title || 'Reminder due now',
        tag: `actarium-reminder-${reminder.id}`,
        renotify: true
      });
    } catch (_) {}
  }
}

function playTone() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;

  try {
    if (!audioContext) audioContext = new Context();
    if (audioContext.state !== 'running') {
      audioContext.resume().catch(() => {});
      return;
    }

    const now = audioContext.currentTime;
    [0, 0.34, 0.68].forEach(offset => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.23);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.25);
    });
  } catch (_) {}
}

async function unlockAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return false;

  try {
    if (!audioContext) audioContext = new Context();
    if (audioContext.state !== 'running') await audioContext.resume();
    return audioContext.state === 'running';
  } catch (_) {
    return false;
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (_) {
    return 'unsupported';
  }
}

function resolveSnoozeUntil(timeText) {
  const minutes = timeToMinutes(timeText);
  if (minutes === null) return '';

  const now = new Date();
  const result = new Date(now);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (result <= now) result.setDate(result.getDate() + 1);
  return localDateTime(result);
}

function nextHourTime() {
  const later = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(later.getHours()).padStart(2, '0')}:${String(later.getMinutes()).padStart(2, '0')}`;
}

function localDateTime(date) {
  return `${localIso(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatLocalDateTime(value) {
  const date = parseLocalDateTime(value);
  if (!date) return String(value || '');
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function parseLocalDateTime(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])) : null;
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
}

function normaliseIso(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function parseIso(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function localIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isAlarmEnabled(reminder) {
  const value = reminder.alarmEnabled ?? reminder.alarm_enabled;
  return value === true || /^(yes|true|1|on)$/i.test(String(value || ''));
}

function isDone(reminder) {
  return /^done$/i.test(String(reminder.status || '')) || Boolean(reminder.completedAt || reminder.completed_at);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function message(reason) {
  return reason && reason.message ? reason.message : String(reason || 'Unknown error');
}
