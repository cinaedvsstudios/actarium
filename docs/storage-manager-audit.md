# Actarium Storage Manager — integration and ownership audit

Date: 2026-11-23
Application ID: `actarium`
Source inspected: default branch of `cinaedvsstudios/actarium`

## Active integration

The live `index.html` loads `js/app.js`, plus Task Mode, clock,
tablet/weather, and dashboard modules. The Settings window is rendered
by `settingsModal` in `js/app.js`. A new isolated module attaches
the **💾 Storage & Cleanup** button to that existing modal, without
modifying the task or reminder save logic.

The active app retrieves tasks/reminders from a Google Apps Script
backend connected to a Google Sheet. The active client does not register
a locally stored full task/reminder dataset that can be content-verified
against a published static file. Accordingly, server verification and
automatic removal of verified local copies are **disabled**. The Sheet
is not modified by browser cleanup.

## Confirmed localStorage ownership

All of the following were mapped from code in this repository:

| Key | Category | Cleanup |
| --- | --- | --- |
| actarium.theme | Settings | Protected |
| actarium.mobileView | Settings | Protected |
| actarium.taskModeView | Settings | Protected |
| actarium.taskGridColumns | Settings | Protected |
| actarium.taskGridForce | Settings | Protected |
| actarium.timeVisible | Settings | Protected |
| actarium.timePosition | Settings | Protected |
| actarium.timeSize | Settings | Protected |
| actarium.tabletView | Settings | Protected |
| actarium.weatherVisible | Settings | Protected |
| actarium.berlinWeather | Regenerable cache | **Safe to clean** |
| actarium.localRecords.v1 | Legacy local records | Protected |
| actarium.localTasks.v2 | Legacy local user data | Protected |
| actarium.theme.v2 | Legacy settings | Protected |
| actarium.activeView.v1 | Legacy settings | Protected |
| actarium.storageManager.lastCleanup | Manager history | Protected |

The two legacy user-data keys are **not** treated as server-verified
copies: there is no evidence that their exact contents exist on the
current server. They must survive Quick Clean.

## Other browser storage

The source search did not find active writers for sessionStorage,
IndexedDB, Cache Storage, OPFS or cookies. The manager reports capability
and available origin-level names, but does **not** treat any such entries
as Actarium-owned. These technologies may contain data for other apps
hosted on the same `cinaedvsstudios.github.io` origin.

Unknown `actarium.*` keys also require review; their prefix alone does
not establish a safe deletion classification. No broad origin-wide clear
methods are used.

## Added files

- `js/storage-manager.js`: registry, discovery, overview, category
  selection, readonly unknown-storage listing, export, restore,
  carefully confirmed cleanup and explicit full Actarium-only reset.
- `css/storage-manager.css`: visual and responsive styles.
- `index.html`: new stylesheet and script references.

## Safety boundaries

- Quick Clean can currently remove only `actarium.berlinWeather`.
- Clearing categories never selects unknown or protected entries.
- Clearing everything covers registered Actarium localStorage keys only,
  after a typed phrase and a final confirmation.
- Export/import operate only on recognised Actarium keys, with
  compatibility and conflict checks, and no silent overwriting.
- Browser storage estimates for the whole origin are explicitly labelled
  as including other apps.
- No server API, GitHub file, Google Sheet or disk file is deleted.
- Deleting settings/legacy data requires explicit confirmation;
  the app is reloaded after full reset/restore.

## Known limitations / manual tests

This integration does not silently open or modify unknown IndexedDB
databases or OPFS folders. Those entries are informational and
protected. No published static dataset is configured for server
checksum comparison. The browser may block some APIs under
`file:///`, in private mode or on restricted devices.

Run these checks in the browser before treating the feature as
production-verified:

1. Open Settings → Storage & Cleanup and close it; other controls work.
2. Verify each registered key's ownership and protective category.
3. Confirm Quick Clean only removes the weather cache.
4. Export a backup, then import and review conflicts.
5. Confirm Clear Everything requires `DELETE ACTARIUM` and does
   not affect unrelated prefixed or other-app keys.
6. Test Firefox/Chrome, Android tablet, and restricted/local-file
   contexts; unsupported APIs must be marked unavailable.
7. Check the live task/reminder data still loads and saves normally.
