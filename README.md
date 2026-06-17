# Actarium

Actarium is the weekly control panel that sits above ChrisFit, Viaticum, and a general task list. The V2 direction is intentionally simpler than the first dashboard draft.

## Current design direction

The app has four main views at the top:

- 🌅 **Today** — today's date card, repeatable schedule items, ChrisFit card, Viaticum card, and today's tasks.
- 🗓️ **Week** — the same logic zoomed out to this week.
- 🌘 **Month** — the same logic zoomed out to this month.
- ✅ **Tasks** — all tasks in one list.

The top date card is deliberately simple. The day name is large. The smaller date line sits underneath. Schedule info comes from a repeatable `Schedule` list, not from hardcoded app UI.

## Colour and interaction rules

Main colours are purple and teal. The app supports both dark and light mode. Selected buttons and the main create-task action use a very subtle pulse animation so selected things feel alive without becoming annoying.

All primary buttons use emojis:

- 🌅 Today
- 🗓️ Week
- 🌘 Month
- ✅ Tasks
- ➕ New task
- 💾 Save task
- ✏️ Edit
- 🔎 Open task
- ☀️ / 🌙 Theme

## Task logic

Tasks can be:

- single-day tasks;
- date-range tasks lasting more than one day;
- recurring tasks;
- linked to an app/source such as Actarium, ChrisFit, or Viaticum;
- opened in a larger detail window;
- edited in a calendar-style form;
- marked done individually;
- selected in bulk and marked done together.

The task creation form is designed like a lightweight Google Calendar creation flow: title, start date, end date, recurrence, repeat-until, priority, status, area, source, link, and notes.

## Schedule logic

The `Schedule` sheet is for repeatable ongoing things. It is separate from tasks because scheduled routines should not create endless manual task rows.

Recommended columns:

| Column | Meaning |
|---|---|
| id | Stable row ID, e.g. `S-0001` |
| title | Schedule item title |
| type | Daily, Weekly, Monthly, Custom |
| days | Comma-separated weekdays, e.g. `Mon,Tue,Wed,Thu,Fri` |
| start_time | Optional time, e.g. `09:00` |
| end_time | Optional end time |
| area | Planning, Fitness, Travel, Work, etc. |
| status | Active or Inactive |
| emoji | Display emoji |
| details | Short details shown in the date card |
| link | Optional link |
| start_date | Optional first active date |
| end_date | Optional final active date |
| priority | Low, Normal, High, Urgent |

## Viaticum-style text sections

Actarium supports the same kind of labelled text-section logic used in Viaticum templates. Any task note or app-feed text can contain sections like:

```text
Info:
General information.

Maps:
Map links or places to check.

Codes:
Booking codes, door codes, or reference numbers.

Paid:
What has already been paid.

Unpaid:
What still needs paying.

Links:
Useful links.
```

The app parses those labels and displays them as clean sub-sections inside cards and task detail windows.

## File structure

```text
index.html
styles.css
README.md
js/
  app.js
  config.js
  state.js
  api.js
  sheetParser.js
  cards.js
  layout.js
  forms.js
  dateUtils.js
```

### Module responsibilities

`app.js` starts the app and wires the first render.

`config.js` stores stable app configuration, URLs, sheet IDs, and source app details.

`state.js` owns the in-memory state, theme mode, modal state, local storage keys, and the render subscription system.

`api.js` loads Google Sheet CSV data when available, falls back to local/demo data when the sheet is not public, and owns task save/done/delete operations.

`sheetParser.js` owns CSV parsing, row normalization, and Viaticum-style labelled section parsing.

`cards.js` owns reusable visual components: date cards, app cards, task rows, schedule rows, period cards, and helper display logic.

`layout.js` owns the top navigation, Today/Week/Month/Tasks view composition, and bulk-selection behaviour.

`forms.js` owns the modal windows and task creation/editing form.

`dateUtils.js` owns date formatting, week/month boundaries, and recurring-date helpers.

## Locked development rule: no patches

Do not add patch files.

Do not add files named like:

```text
mobile-fix.js
layout-patch.js
quick-fix.js
helper-helper.js
override.js
```

If something is broken, fix the source module that owns the behaviour.

If a file gets too big, split it into a proper named module with a clear responsibility and import it normally.

A module is allowed when it owns a real permanent concept. A patch is not allowed when it only overrides or corrects another file after load.

Good examples:

```text
recurrence.js
sheetParser.js
taskStore.js
calendarRange.js
```

Bad examples:

```text
taskStoreFix.js
calendarPatch.js
loadAfterApp.js
mobileOverride.js
```

The app should remain understandable from the file structure alone.

## Deployment

Upload the files to the root of the GitHub Pages repo:

```text
cinaedvsstudios/actarium
```

The public app should then load at:

```text
https://cinaedvsstudios.github.io/actarium/
```

If the Google Sheet is not published or connected through Apps Script, the app still works with local/demo data and local browser-saved tasks. A future Apps Script endpoint should replace the read-only CSV approach so tasks can write back to the Google Sheet.
