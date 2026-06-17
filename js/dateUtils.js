export function toIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso() {
  return toIsoDate(new Date());
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function startOfWeekIso(isoDate = todayIso()) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return toIsoDate(date);
}

export function endOfWeekIso(isoDate = todayIso()) {
  return addDays(startOfWeekIso(isoDate), 6);
}

export function endOfMonthIso(isoDate = todayIso()) {
  const date = new Date(`${isoDate}T12:00:00`);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
}

export function isBefore(dateA, dateB) {
  return String(dateA || '') < String(dateB || '');
}

export function isBetweenInclusive(date, start, end) {
  const value = String(date || '');
  return value >= String(start || '') && value <= String(end || '');
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) return 'No date';
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(date);
}

export function classifyDueDate(isoDate, today = todayIso()) {
  if (!isoDate) return 'none';
  if (isoDate < today) return 'overdue';
  if (isoDate === today) return 'today';
  if (isBetweenInclusive(isoDate, startOfWeekIso(today), endOfWeekIso(today))) return 'week';
  if (isBetweenInclusive(isoDate, addDays(endOfWeekIso(today), 1), endOfMonthIso(today))) return 'month';
  return 'future';
}
