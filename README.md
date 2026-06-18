# Actarium v3.8

Actarium is a personal weekly control panel for tasks, reminders, ChrisFit, Viaticum, and grouped app links.

## v3.8 changes

- The desktop ChrisFit and Viaticum card data is more compact while their titles and Open buttons retain the previous size.
- The daily task card is labelled **Tasks** rather than **Today tasks**.
- The old text-based **Done selected** control is now a tick-only action.
- Duplicate New task controls were removed from task cards and the mobile task viewer.
- The header now has the only creation control: **New task** beside Archive.
- New task opens one shared editor with a Task / Reminder switch. The same editor is used on desktop and mobile.
- Project entry has both a dropdown of projects already in Actarium and a separate custom free-text box. Both inputs are half-width in the editor row.
- Reminders now have their own backend save and mark-done actions in `apps-script/Code.gs`.

## Apps Script deployment required for reminder changes

The frontend v3.8 deployment is in this repository. To make new reminders and reminder completion save into the Google Sheet, copy the current `apps-script/Code.gs` into the linked Apps Script project and deploy it as a **new version**. Keep the existing web-app access settings, then use the resulting `/exec` URL if Google changes it.

## Development rule

Do not add patch files, override scripts, helper-on-helper loaders, or post-load fixes. Update the owning source file directly. When a stable feature becomes larger, move it into one properly named module with a clear responsibility.
