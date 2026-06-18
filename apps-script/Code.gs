const ACTARIUM_SPREADSHEET_ID = '1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA';
const VIATICUM_SPREADSHEET_ID = '1D8CT24J65KRPubakzrOCaYgavXGTKuo_86YBMjqGcyg';

const TABS = {
  tasks: 'Tasks',
  routine: 'Routine',
  schedule: 'Schedule',
  appFeed: 'AppFeed',
  apps: 'Apps',
  reminders: 'Reminders'
};

function doGet(e) {
  try {
    const action = String(e.parameter.action || 'bootstrap');
    if (action === 'bootstrap') return jsonResponse_(bootstrap_());
    if (action === 'tasks') return jsonResponse_({ success: true, tasks: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.tasks) });
    if (action === 'reminders') return jsonResponse_({ success: true, reminders: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.reminders) });
    if (action === 'viaticum') return jsonResponse_({ success: true, viaticumEvents: readViaticumEvents_() });
    return jsonResponse_({ success: false, error: 'Unknown GET action: ' + action });
  } catch (error) {
    return jsonResponse_({ success: false, error: String(error && error.message ? error.message : error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = String(body.action || '');
    if (action === 'saveTask') return jsonResponse_({ success: true, task: saveTask_(body.task || {}) });
    if (action === 'updateTaskStatus') return jsonResponse_({ success: true, task: updateTaskStatus_(body.id, body.status, body.completedAt, body.completionNote) });
    if (action === 'markTasksDone') return jsonResponse_({ success: true, tasks: markTasksDone_(body.ids || [], body.completedAt) });
    return jsonResponse_({ success: false, error: 'Unknown POST action: ' + action });
  } catch (error) {
    return jsonResponse_({ success: false, error: String(error && error.message ? error.message : error) });
  }
}

function bootstrap_() {
  return {
    success: true,
    tasks: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.tasks),
    reminders: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.reminders),
    routine: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.routine),
    schedule: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.schedule),
    appFeed: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.appFeed),
    apps: readObjects_(ACTARIUM_SPREADSHEET_ID, TABS.apps),
    viaticumEvents: readViaticumEvents_()
  };
}

function saveTask_(task) {
  const sheet = SpreadsheetApp.openById(ACTARIUM_SPREADSHEET_ID).getSheetByName(TABS.tasks);
  const headers = getHeaders_(sheet);
  const id = task.id && !String(task.id).startsWith('local-') ? String(task.id) : nextTaskId_(sheet);
  const rowIndex = findRowById_(sheet, id);
  const record = taskToRecord_(Object.assign({}, task, { id: id }));
  const rowValues = headers.map(header => record[header] !== undefined ? record[header] : '');
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  else sheet.appendRow(rowValues);
  return Object.assign({}, record, { id: id });
}

function updateTaskStatus_(id, status, completedAt, completionNote) {
  const sheet = SpreadsheetApp.openById(ACTARIUM_SPREADSHEET_ID).getSheetByName(TABS.tasks);
  const headers = getHeaders_(sheet);
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex < 1) throw new Error('Task not found: ' + id);
  const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const record = rowToObject_(headers, row);
  record.status = status || record.status || 'Not started';
  record.updated_at = new Date();
  if (completedAt !== undefined) record.completed_at = completedAt || '';
  if (completionNote !== undefined) record.completion_note = completionNote || '';
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([headers.map(header => record[header] !== undefined ? record[header] : '')]);
  return record;
}

function markTasksDone_(ids, completedAt) {
  return ids.map(id => updateTaskStatus_(id, 'Done', completedAt || new Date(), ''));
}

function taskToRecord_(task) {
  const now = new Date();
  const startDate = task.startDate || task.dueDate || today_();
  const endDate = task.endDate || startDate;
  return {
    id: task.id,
    title: task.title || 'Untitled task',
    project: task.project || 'General',
    source: task.source || 'Actarium',
    status: task.status || 'Not started',
    priority: task.priority || 'Normal',
    due_date: startDate,
    week_start: weekStart_(startDate),
    energy: task.energy || '',
    link: task.link || '',
    notes: task.notes || '',
    created_at: task.createdAt || now,
    updated_at: now,
    start_date: startDate,
    end_date: endDate,
    duration_type: task.durationType || (startDate === endDate ? 'Single day' : 'Date range'),
    recurrence: task.recurrence || 'None',
    repeat_until: task.repeatUntil || '',
    completed_at: task.completedAt || '',
    completion_note: task.completionNote || '',
    task_type: task.taskType || 'Personal'
  };
}

function readViaticumEvents_() {
  const ss = SpreadsheetApp.openById(VIATICUM_SPREADSHEET_ID);
  const rows = readObjectsFromSheet_(ss.getSheetByName('sheet1'));
  const refRows = readObjectsFromSheet_(ss.getSheetByName('ref'));
  const ref = buildViaticumRef_(refRows);
  return rows
    .filter(row => row.realdate || row.real_date || row.date)
    .map(row => {
      const status = row.status || '';
      const location = row.location || '';
      const event = row.event || '';
      return {
        date: normaliseDate_(row.realdate || row.real_date || row.date),
        status: status,
        statusEmoji: ref.status[status] || '🤔',
        location: location,
        locationEmoji: ref.location[location] || '📍',
        event: event,
        eventEmoji: ref.event[event] || '🎒',
        schedule: row.schedule || '',
        details: row.details || '',
        links: row.links || '',
        tripName: row.tripname || row.trip_name || ''
      };
    })
    .filter(event => event.date);
}

function buildViaticumRef_(rows) {
  const out = { status: {}, location: {}, event: {} };
  rows.forEach(row => {
    if (row.status_name) out.status[row.status_name] = row.status_emoji || '';
    if (row.locations) out.location[row.locations] = row.location_emoji || '';
    if (row.events) out.event[row.events] = row.event_emoji || '';
  });
  return out;
}

function readObjects_(spreadsheetId, sheetName) {
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  return readObjectsFromSheet_(sheet);
}

function readObjectsFromSheet_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(normaliseKey_);
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => rowToObject_(headers, row));
}

function rowToObject_(headers, row) {
  const out = {};
  headers.forEach((header, index) => {
    if (!header) return;
    out[header] = serialiseCell_(row[index]);
  });
  return out;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normaliseKey_);
}

function findRowById_(sheet, id) {
  if (!id) return -1;
  const values = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getValues().flat().map(String);
  const index = values.findIndex(value => value === String(id));
  return index >= 0 ? index + 1 : -1;
}

function nextTaskId_(sheet) {
  const values = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues().flat().map(String);
  let max = 0;
  values.forEach(value => {
    const match = value.match(/^T-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return 'T-' + String(max + 1).padStart(4, '0');
}

function normaliseKey_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function serialiseCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return value === null || value === undefined ? '' : value;
}

function normaliseDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return slash[3] + '-' + slash[2].padStart(2, '0') + '-' + slash[1].padStart(2, '0');
  return text;
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

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
