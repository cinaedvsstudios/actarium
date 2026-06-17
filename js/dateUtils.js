const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function pad(value) {
  return String(value).padStart(2, '0');
}

export function toISODate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return toISODate(new Date());
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addDays(value, days) {
  const date = parseDate(value) || new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

export function startOfWeek(value = new Date()) {
  const date = parseDate(value) || new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfWeek(value = new Date()) {
  return addDays(startOfWeek(value), 6);
}

export function startOfMonth(value = new Date()) {
  const date = parseDate(value) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(value = new Date()) {
  const date = parseDate(value) || new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isBetween(dateValue, startValue, endValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

export function formatDayName(value) {
  const date = parseDate(value) || new Date();
  return DAY_NAMES[date.getDay()];
}

export function formatShortDayName(value) {
  const date = parseDate(value) || new Date();
  return DAY_SHORT[date.getDay()];
}

export function formatLongDate(value) {
  const date = parseDate(value) || new Date();
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMonth(value) {
  const date = parseDate(value) || new Date();
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function getWeekDates(value = new Date()) {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function daysOverlap(startA, endA, startB, endB) {
  const aStart = parseDate(startA);
  const aEnd = parseDate(endA || startA);
  const bStart = parseDate(startB);
  const bEnd = parseDate(endB || startB);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

export function sameDay(a, b) {
  return toISODate(a) === toISODate(b);
}

export function todayIso() {
  return toISODate(new Date());
}
