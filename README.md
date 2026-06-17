# Actarium Web App

Actarium is the weekly command centre that sits above ChrisFit, Viaticum, and general task/link/idea capture. The app is built as a static GitHub Pages web app with a mobile-first card layout and a desktop dashboard layout using the same components.

## File structure

```text
actarium/
├── index.html
├── styles.css
├── README.md
└── js/
    ├── app.js
    ├── config.js
    ├── state.js
    ├── api.js
    ├── sheetParser.js
    ├── cards.js
    ├── layout.js
    ├── forms.js
    └── dateUtils.js
```

## Module responsibilities

`index.html` is only the page shell. It loads `styles.css` and `js/app.js`.

`styles.css` owns the visual system: dark background, cards, pills, grids, mobile stacking, desktop dashboard layout, bottom navigation, and form styling.

`js/app.js` is the app entry point. It initialises state, loads data, renders the layout, and wires event handlers. It should stay small.

`js/config.js` stores app-level constants: app name, version, sheet ID, optional API endpoint, source app URLs, and localStorage keys.

`js/state.js` owns the single in-memory state object and small state setters/getters. It does not render UI and does not fetch data.

`js/api.js` owns data access. For now it can load demo data, localStorage data, and future Google Sheets/App Script data. It should not render UI.

`js/sheetParser.js` converts raw sheet/app feed text into Actarium records. This is where Viaticum-style logic belongs, including parsing sections such as `Info:`, `Maps:`, `Codes:`, `Paid:`, `Unpaid:`, `Schedule:`, `Links:`, and `Details:`.

`js/cards.js` owns reusable card rendering: task cards, link cards, idea cards, app feed cards, status pills, and empty states.

`js/layout.js` owns page composition: header, dashboard grid, mobile nav, summary strips, and grouping cards into screen sections.

`js/forms.js` owns quick-add forms and user actions: add task, add link, add idea, update task status, and local draft capture.

`js/dateUtils.js` owns date calculations and formatting: today, week start, week end, month end, date comparisons, and display labels.

## No patches rule

Do not add patch files.

Do not create files like:

```text
mobile-fix.js
card-patch.js
app-fix.js
sheet-helper-helper.js
override.js
hotfix-loader.js
```

Actarium should never work by loading extra scripts that override previous broken behaviour. If something is wrong, fix the source module that owns that behaviour.

If a file gets too large, split it into a proper module with a clear permanent responsibility and import it normally. For example, if `cards.js` grows too much, split it into intentional modules such as:

```text
cards/taskCards.js
cards/linkCards.js
cards/feedCards.js
```

That is allowed because it clarifies ownership. A patch file is not allowed because it hides ownership.

## Change logic

Before changing behaviour, identify the module that owns it.

Task sorting belongs in `dateUtils.js` or `layout.js`, depending on whether the change is date calculation or display grouping.

Sheet parsing belongs in `sheetParser.js`.

Google Sheets or Apps Script requests belong in `api.js`.

Quick-add behaviour belongs in `forms.js`.

Card markup belongs in `cards.js`.

Page structure belongs in `layout.js`.

Global state belongs in `state.js`.

App startup belongs in `app.js`.

If none of the existing modules clearly owns the change, create a new named module with a permanent responsibility. Do not create a temporary fix file.

## Current data mode

V1 works with built-in starter data and localStorage captures. The next backend step is to connect `api.js` to an Apps Script endpoint for the Actarium Google Sheet.

The Actarium Google Sheet is:

```text
https://docs.google.com/spreadsheets/d/1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA/edit
```

The live GitHub Pages target is:

```text
https://cinaedvsstudios.github.io/actarium/
```
