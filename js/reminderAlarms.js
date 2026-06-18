const FIRED_STORAGE_KEY = 'actarium.reminderAlarmFired.v1';
const POLL_INTERVAL_MS = 10_000;

let reminderProvider = () => [];
let timerId = null;
let audioContext = null;
let visibilityHandlerAttached = false;

export function startReminderAlarmService({ getReminders }) {
  reminderProvider = typeof getReminders === 'function' ? getReminders : () => [];
  if (timerId) window.clearInterval(timerId);
  timerId = window.setInterval(scanForDueAlarms, POLL_INTERVAL_MS);

  if (!visibilityHandlerAttached) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scanForDueAlarms();
    });
    visibilityHandlerAttached = true;
  }

  scanForDueAlarms();
}

export async function enableReminderAlarmCapability() {
  const audioEnabled = await primeAudio();
  const notification = await requestNotificationPermission();
  return { audioEnabled, notification };
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

async function primeAudio() {
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

function scanForDueAlarms() {
  const now = new Date();
  const today = localIso(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const fired = readFired();
  let changed = false;

  safeArray(reminderProvider()).forEach(reminder => {
    if (!isAlarmEnabled(reminder) || isDone(reminder) || !reminder.alarmTime) return;
    if (!isReminderDueOn(reminder, today)) return;

    const alarmMinutes = timeToMinutes(reminder.alarmTime);
    if (alarmMinutes === null || currentMinutes < alarmMinutes) return;

    const key = `${reminder.id}|${today}|${reminder.alarmTime}`;
    if (fired[key]) return;

    fired[key] = Date.now();
    changed = true;
    fireReminderAlarm(reminder);
  });

  if (changed) writeFired(fired);
}

function fireReminderAlarm(reminder) {
  playAlarmSound();
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

function playAlarmSound() {
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

function isReminderDueOn(reminder, today) {
  const start = normaliseIso(reminder.start || reminder.due || reminder.date);
  if (!start || start > today) return false;

  const repeatUntil = normaliseIso(reminder.repeatUntil || reminder.repeat_until);
  if (repeatUntil && today > repeatUntil) return false;

  const recurrence = String(reminder.recurrence || 'None').trim().toLowerCase();
  if (recurrence === '' || recurrence === 'none') return start === today;
  if (recurrence === 'daily') return true;

  const startDate = parseIso(start);
  const todayDate = parseIso(today);
  if (!startDate || !todayDate) return false;

  if (recurrence === 'weekly') {
    const days = Math.floor((todayDate - startDate) / 86400000);
    return days >= 0 && days % 7 === 0;
  }
  if (recurrence === 'weekdays') {
    const day = todayDate.getDay();
    return day >= 1 && day <= 5;
  }
  if (recurrence === 'monthly') return todayDate.getDate() === startDate.getDate();

  return start === today;
}

function isAlarmEnabled(reminder) {
  const value = reminder.alarmEnabled ?? reminder.alarm_enabled;
  return value === true || /^(yes|true|1|on)$/i.test(String(value || ''));
}

function isDone(reminder) {
  return /^done$/i.test(String(reminder.status || '')) || Boolean(reminder.completedAt || reminder.completed_at);
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
}

function localIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normaliseIso(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function parseIso(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function readFired() {
  try {
    const value = JSON.parse(localStorage.getItem(FIRED_STORAGE_KEY) || '{}');
    const cutoff = Date.now() - 14 * 86400000;
    Object.keys(value).forEach(key => {
      if (!Number(value[key]) || value[key] < cutoff) delete value[key];
    });
    return value;
  } catch (_) {
    return {};
  }
}

function writeFired(value) {
  try {
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(value));
  } catch (_) {}
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
