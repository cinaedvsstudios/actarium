const ACTARIUM_SPREADSHEET_ID = '1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA';
const VIATICUM_SPREADSHEET_ID = '1D8CT24J65KRPubakzrOCaYgavXGTKuo_86YBMjqGcyg';
const VIATICUM_TAB = 'sheet1';
const VIATICUM_REF_TAB = 'ref';

const TABS = {
  tasks: 'Tasks',
  reminders: 'Reminders',
  routine: 'Routine',
  schedule: 'Schedule',
  appFeed: 'AppFeed',
  apps: 'Apps'
};

function doGet(e) {
  try {
    const action = String((e.parameter || {}).action || 'bootstrap');
    if (action === 'bootstrap') {
      return json_({
        success: true,
        tasks: read_(TABS.tasks),
        reminders: read_(TABS.reminders),
        routine: read_(TABS.routine),
        schedule: read_(TABS.schedule),
        appFeed: read_(TABS.appFeed),
        apps: read_(TABS.apps),
        viaticum: viaticumSummary_(),
        viaticumEvents: viaticumEvents_()
      });
    }
    if (action === 'tasks') return json_({ success: true, tasks: read_(TABS.tasks) });
    if (action === 'reminders') return json_({ success: true, reminders: read_(TABS.reminders) });
    if (action === 'routine') return json_({ success: true, routine: read_(TABS.routine) });
    if (action === 'schedule') return json_({ success: true, schedule: read_(TABS.schedule) });
    if (action === 'viaticum') return json_({ success: true, viaticum: viaticumSummary_(), viaticumEvents: viaticumEvents_() });
    return json_({ success: false, error: 'Unknown GET action: ' + action });
  } catch (error) {
    return json_({ success: false, error: errorText_(error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    if (action === 'saveTask') return json_({ success: true, task: saveTask_(body.task || {}) });
    if (action === 'saveReminder') return json_({ success: true, reminder: saveReminder_(body.reminder || {}) });
    if (action === 'deleteTask') return json_({ success: true, deletedId: deleteRecord_(TABS.tasks, body.id) });
    if (action === 'deleteReminder') return json_({ success: true, deletedId: deleteRecord_(TABS.reminders, body.id) });
    if (action === 'saveRoutine') return json_({ success: true, routine: saveRoutine_(body.routine || {}) });
    if (action === 'deleteRoutine') return json_({ success: true, deletedId: deleteRecord_(TABS.routine, body.id) });
    if (action === 'saveSchedule') return json_({ success: true, schedule: saveSchedule_(body.schedule || {}) });
    if (action === 'deleteSchedule') return json_({ success: true, deletedId: deleteRecord_(TABS.schedule, body.id) });
    if (action === 'markTasksDone') return json_({ success: true, tasks: markDone_(TABS.tasks, body.ids || [], body.completedAt) });
    if (action === 'markRemindersDone') return json_({ success: true, reminders: markDone_(TABS.reminders, body.ids || [], body.completedAt) });
    if (action === 'snoozeReminder') return json_({ success: true, reminder: snoozeReminder_(body.id, body.snoozeUntil) });

    return json_({ success: false, error: 'Unknown POST action: ' + action });
  } catch (error) {
    return json_({ success: false, error: errorText_(error) });
  }
}

function saveTask_(task) {
  const sheet = sheet_(TABS.tasks);
  const id = usableId_(task.id, 'T-') ? String(task.id) : nextId_(sheet, 'T-', /^T-(\d+)$/);
  const start = task.start || task.startDate || task.due || task.dueDate || today_();
  const end = task.end || task.endDate || start;
  const shoppingFormat = task.shoppingListFormat || task.shopping_list_format || '';
  if (shoppingFormat) ensureColumn_(sheet, 'shopping_list_format');

  const record = {
    id: id,
    title: task.title || 'Untitled task',
    project: task.project || 'General',
    source: task.source || 'Actarium',
    status: task.status || 'Not started',
    priority: task.priority || 'Normal',
    due_date: start,
    week_start: weekStart_(start),
    energy: task.energy || '',
    link: task.link || '',
    notes: task.notes || '',
    updated_at: new Date(),
    start_date: start,
    end_date: end,
    duration_type: start === end ? 'Single day' : 'Date range',
    recurrence: task.recurrence || 'None',
    repeat_until: task.repeatUntil || task.repeat_until || '',
    completed_at: task.completedAt || task.completed_at || '',
    completion_note: task.completionNote || task.completion_note || '',
    task_type: task.taskType || task.task_type || 'Personal',
    emoji: task.emoji || ''
  };
  if (shoppingFormat) record.shopping_list_format = shoppingFormat;

  const saved = save_(sheet, id, record);
  if (shoppingFormat) applyShoppingListFormat_(sheet, id, shoppingFormat);
  return saved;
}

function saveReminder_(reminder) {
  const sheet = sheet_(TABS.reminders);
  const id = usableId_(reminder.id, 'RMD-') ? String(reminder.id) : nextId_(sheet, 'RMD-', /^RMD-(\d+)$/);
  const date = reminder.start || reminder.startDate || reminder.due || reminder.dueDate || reminder.date || today_();
  const alarmEnabled = isYes_(reminder.alarmEnabled) || isYes_(reminder.alarm_enabled);

  return save_(sheet, id, {
    id: id,
    title: reminder.title || 'Untitled reminder',
    project: reminder.project || 'General',
    source: reminder.source || 'Actarium',
    status: reminder.status || 'Not started',
    priority: reminder.priority || 'Normal',
    date: date,
    recurrence: reminder.recurrence || 'None',
    repeat_until: reminder.repeatUntil || reminder.repeat_until || '',
    link: reminder.link || '',
    notes: reminder.notes || '',
    completed_at: reminder.completedAt || reminder.completed_at || '',
    alarm_enabled: alarmEnabled ? 'Yes' : 'No',
    alarm_time: alarmEnabled ? (reminder.alarmTime || reminder.alarm_time || '') : '',
    snooze_until: reminder.snoozeUntil || reminder.snooze_until || '',
    emoji: reminder.emoji || ''
  });
}

function saveRoutine_(routine) {
  const sheet = sheet_(TABS.routine);
  const id = usableExistingId_(routine.id) ? String(routine.id) : nextId_(sheet, 'RTN-', /^RTN-(\d+)$/);
  return save_(sheet, id, {
    id: id,
    label: routine.label || routine.title || 'Routine',
    emoji: routine.emoji || '🗓️',
    monday: routine.monday || '',
    tuesday: routine.tuesday || '',
    wednesday: routine.wednesday || '',
    thursday: routine.thursday || '',
    friday: routine.friday || '',
    saturday: routine.saturday || '',
    sunday: routine.sunday || ''
  });
}

function saveSchedule_(schedule) {
  const sheet = sheet_(TABS.schedule);
  const id = usableExistingId_(schedule.id) ? String(schedule.id) : nextId_(sheet, 'SCH-', /^SCH-(\d+)$/);
  return save_(sheet, id, {
    id: id,
    title: schedule.title || schedule.label || 'Scheduled item',
    label: schedule.label || schedule.title || 'Scheduled item',
    emoji: schedule.emoji || '🗓️',
    type: schedule.type || 'Weekly',
    days: schedule.days || '',
    start_time: schedule.start_time || schedule.startTime || '',
    end_time: schedule.end_time || schedule.endTime || ''
  });
}

function deleteRecord_(tabName, id) {
  if (!id) throw new Error('Missing id.');
  const sheet = sheet_(tabName);
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) throw new Error('Item not found: ' + id);
  sheet.deleteRow(rowNumber);
  return String(id);
}

function markDone_(tabName, ids, completedAt) {
  const sheet = sheet_(tabName);
  const headers = headers_(sheet);
  const rows = sheet.getDataRange().getValues();
  const wanted = (ids || []).map(String);
  const idIndex = headers.indexOf('id');
  const statusIndex = headers.indexOf('status');
  const completedIndex = headers.indexOf('completed_at');
  const snoozeIndex = headers.indexOf('snooze_until');
  const changed = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!wanted.includes(String(row[idIndex]))) continue;
    if (statusIndex >= 0) row[statusIndex] = 'Done';
    if (completedIndex >= 0) row[completedIndex] = completedAt || new Date();
    if (snoozeIndex >= 0) row[snoozeIndex] = '';
    sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
    changed.push(rowObject_(headers, row));
  }
  return changed;
}

function snoozeReminder_(id, snoozeUntil) {
  if (!id) throw new Error('Missing reminder id.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(snoozeUntil || ''))) throw new Error('Invalid snooze time.');

  const sheet = sheet_(TABS.reminders);
  const headers = headers_(sheet);
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) throw new Error('Reminder not found: ' + id);

  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  if (headers.indexOf('snooze_until') >= 0) row[headers.indexOf('snooze_until')] = snoozeUntil;
  if (headers.indexOf('status') >= 0) row[headers.indexOf('status')] = 'Not started';
  if (headers.indexOf('completed_at') >= 0) row[headers.indexOf('completed_at')] = '';
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  return rowObject_(headers, row);
}

function save_(sheet, id, record) {
  const headers = headers_(sheet);
  const rowNumber = findRow_(sheet, id);
  const existing = rowNumber > 0 ? rowObject_(headers, sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]) : {};
  const merged = Object.assign({}, existing, record, { id: id });
  if (!merged.created_at && headers.indexOf('created_at') >= 0) merged.created_at = new Date();
  const values = headers.map(header => merged[header] !== undefined ? merged[header] : '');
  if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
  else sheet.appendRow(values);
  return rowObject_(headers, values);
}

function applyShoppingListFormat_(sheet, id, rawFormat) {
  const headers = headers_(sheet);
  const notesIndex = headers.indexOf('notes');
  if (notesIndex < 0) return;
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) return;

  let parsed = {};
  try { parsed = typeof rawFormat === 'string' ? JSON.parse(rawFormat) : rawFormat; } catch (_) { parsed = {}; }
  const text = String(parsed.text || '');
  const ranges = Array.isArray(parsed.ranges) ? parsed.ranges : [];
  const builder = SpreadsheetApp.newRichTextValue().setText(text);
  const strike = SpreadsheetApp.newTextStyle().setStrikethrough(true).build();
  ranges.forEach(range => {
    const start = Math.max(0, Math.min(text.length, Number(range.start) || 0));
    const end = Math.max(start, Math.min(text.length, Number(range.end) || 0));
    if (end > start) builder.setTextStyle(start, end, strike);
  });
  sheet.getRange(rowNumber, notesIndex + 1).setRichTextValue(builder.build());
}

function viaticumSummary_() {
  const today = today_();
  const horizon = shiftDate_(today, 29);
  const records = readViaticum_();
  const todayRecord = records.find(record => record.date === today) || emptyViaticumRecord_(today);
  const schedule = records.filter(record => {
    return record.date >= today && record.date <= horizon && hasViaticumScheduleEntry_(record);
  });

  return {
    today: todayRecord,
    upcomingCount: schedule.length,
    next: {
      date: '',
      location: '',
      event: viaticumScheduleText_(schedule),
      status: '',
      schedule: '',
      details: '',
      links: '',
      tripName: ''
    },
    upcoming: schedule
  };
}

function viaticumEvents_() {
  const today = today_();
  const horizon = shiftDate_(today, 29);
  return readViaticum_().filter(record => {
    return record.date >= today && record.date <= horizon && hasViaticumScheduleEntry_(record);
  });
}

function viaticumScheduleText_(records) {
  if (!records.length) return 'DATE        LOCATION                  EVENT\nNo scheduled items.';
  const header = 'DATE        LOCATION                  EVENT';
  const lines = records.map(record => {
    const date = `${viaticumDateLabel_(record.date)} ${record.statusEmoji || ''}`.trim().padEnd(12, ' ');
    const location = compactText_(record.location || '—').slice(0, 24).padEnd(26, ' ');
    const event = compactText_(record.event || '—');
    return `${date}${location}${event}`;
  });
  return [header].concat(lines).join('\n');
}

function viaticumDateLabel_(isoDate) {
  const parts = String(isoDate || '').split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
}

function viaticumEmojiMaps_() {
  const sheet = SpreadsheetApp.openById(VIATICUM_SPREADSHEET_ID).getSheetByName(VIATICUM_REF_TAB);
  if (!sheet) return { statuses: {}, locations: {}, events: {} };
  const values = sheet.getDataRange().getValues();
  const maps = { statuses: {}, locations: {}, events: {} };

  values.slice(1).forEach(row => {
    const status = compactText_(row[2]);
    const statusEmoji = compactText_(row[3]);
    const location = compactText_(row[4]);
    const locationEmoji = compactText_(row[5]);
    const event = compactText_(row[6]);
    const eventEmoji = compactText_(row[7]);
    if (status && statusEmoji) maps.statuses[status] = statusEmoji;
    if (location && locationEmoji) maps.locations[location] = locationEmoji;
    if (event && eventEmoji) maps.events[event] = eventEmoji;
  });

  return maps;
}

function readViaticum_() {
  const workbook = SpreadsheetApp.openById(VIATICUM_SPREADSHEET_ID);
  const sheet = workbook.getSheetByName(VIATICUM_TAB);
  if (!sheet) throw new Error('Missing Viaticum sheet: ' + VIATICUM_TAB);
  const emojiMaps = viaticumEmojiMaps_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(key_);

  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const source = rowObject_(headers, row);
    const rawLocation = compactText_(source.location || '');
    const rawEvent = compactText_(source.event || '');
    const rawStatus = compactText_(source.status || '');
    const locationEmoji = emojiMaps.locations[rawLocation] || '';
    const eventDisplay = splitViaticumValues_(rawEvent).map(value => {
      const emoji = emojiMaps.events[value] || '';
      return `${emoji ? `${emoji} ` : ''}${value}`.trim();
    }).join(' • ');
    const statusEmoji = splitViaticumValues_(rawStatus).map(value => emojiMaps.statuses[value] || '').filter(Boolean).join(' ');

    return {
      date: String(source.realdate || ''),
      location: `${locationEmoji ? `${locationEmoji} ` : ''}${rawLocation}`.trim(),
      event: eventDisplay,
      status: rawStatus,
      statusEmoji: statusEmoji,
      rawEvent: rawEvent,
      schedule: String(source.schedule || ''),
      details: String(source.details || ''),
      links: String(source.links || ''),
      tripName: String(source.tripname || '')
    };
  }).filter(record => /^\d{4}-\d{2}-\d{2}$/.test(record.date)).sort((a, b) => a.date.localeCompare(b.date));
}

function splitViaticumValues_(value) {
  return String(value || '').split(/[\n,|]/).map(compactText_).filter(Boolean);
}

function emptyViaticumRecord_(date) {
  return { date: date || '', location: '', event: '', status: '', statusEmoji: '', rawEvent: '', schedule: '', details: '', links: '', tripName: '' };
}

function hasViaticumScheduleEntry_(record) {
  return Boolean(record.rawEvent || record.event);
}

function shiftDate_(isoDate, days) {
  const parts = String(isoDate).split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + Number(days || 0));
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function read_(tabName) {
  const sheet = sheet_(tabName);
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(key_);
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => rowObject_(headers, row));
}

function sheet_(tabName) {
  const sheet = SpreadsheetApp.openById(ACTARIUM_SPREADSHEET_ID).getSheetByName(tabName);
  if (!sheet) throw new Error('Missing sheet: ' + tabName);
  return sheet;
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(key_);
}

function ensureColumn_(sheet, name) {
  const headers = headers_(sheet);
  if (headers.indexOf(name) >= 0) return;
  sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
}

function findRow_(sheet, id) {
  const values = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getValues().flat().map(String);
  const index = values.findIndex(value => value === String(id));
  return index < 0 ? -1 : index + 1;
}

function nextId_(sheet, prefix, expression) {
  const values = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues().flat().map(String);
  let max = 0;
  values.forEach(value => {
    const match = value.match(expression);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return prefix + String(max + 1).padStart(4, '0');
}

function usableId_(id, prefix) {
  return id && !String(id).startsWith('local-') && String(id).indexOf(prefix) === 0;
}

function usableExistingId_(id) {
  return id && !String(id).startsWith('local-');
}

function rowObject_(headers, row) {
  const record = {};
  headers.forEach((header, index) => { if (header) record[header] = serialise_(row[index]); });
  return record;
}

function key_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function serialise_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return value === null || value === undefined ? '' : value;
}

function isYes_(value) {
  return value === true || /^(yes|true|1|on)$/i.test(String(value || ''));
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function weekStart_(isoDate) {
  const parts = String(isoDate).split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function errorText_(error) {
  return String(error && error.message ? error.message : error);
}
