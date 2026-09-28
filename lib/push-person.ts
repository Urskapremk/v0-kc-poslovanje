/**
 * Which person's phone this device is. Written when notifications are switched on
 * and read by the reminder card, so it has to live outside both components — the
 * card sits in the layout and must not pull the whole panel into every page.
 *
 * This is device identity, not app data: reminders themselves live in the database.
 */
export const PUSH_PERSON_KEY = "komba-push-person"
