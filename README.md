# Actarium v3.4

Actarium is the weekly control panel for Chris's work, personal tasks, reminders, app links, ChrisFit summaries, and Viaticum schedule context.

## v3.4 changes

- The main navigation/actions now sit inside the top day card instead of floating above it.
- The top day card has a visible outline and the page background is darker than the cards.
- The Actarium logo is displayed with transparent background and a drop shadow only.
- The Viaticum card now matches the ChrisFit card structure: two compact summary panels plus a schedule/details box.
- The large blue Viaticum block is removed. Only small Viaticum accents remain.
- Added a separate Reminders card.
- Added a new `Reminders` Sheet tab and Apps Script bootstrap support for it.
- Version bumped to `v3.4`.

## Data model

Core Sheet tabs:

- `Tasks` — normal actionable tasks.
- `Reminders` — reminder-style items that should display separately from tasks.
- `Routine` — ordinary recurring day context, such as Work day or Weekend.
- `Apps` — drives the Apps dropdown and GitHub link buttons.
- `AppFeed` — app-supplied summary cards, especially ChrisFit and Viaticum.
- `Settings` — app metadata and important URLs.

## Layout rule

The top day card is the master sticky card. It owns the logo, version, view buttons, Apps, Archive, Add, theme, settings, day title, date, and routine/trip pill.

## No patches rule

Do not add patch files, fix files, override files, or helper-on-helper scripts. If a file becomes too large, move permanent behaviour into a clearly named module and import it normally.

Examples of acceptable modules:

- `api.js`
- `cards.js`
- `forms.js`
- `layout.js`
- `sheetParser.js`
- `state.js`
- `dateUtils.js`

Examples of not acceptable files:

- `fix.js`
- `mobile-fix.js`
- `patch-loader.js`
- `dropdown-helper-helper.js`

## Deployment

Deploy the static files to the root of `cinaedvsstudios/actarium`.

The Apps Script backend is in `apps-script/Code.gs`. After changing Apps Script code, update the Apps Script deployment to a new version so the `/exec` URL runs the new backend.
