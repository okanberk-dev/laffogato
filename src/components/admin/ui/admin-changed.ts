/**
 * "Something in the panel changed": an event on `window` after a kit
 * action succeeds (ActionModal, ConfirmButton, ActionForm, ActionButton).
 * Counts shown outside the page, such as the sidebar's open-orders and
 * karaoke badges, listen for it and read again instead of waiting for
 * their 60 s poll: an action revalidates its own page but stays on the
 * same path, so nothing else told them (admin audit KAR-23).
 */
export const ADMIN_CHANGED_EVENT = "admin:changed";

/** Fires ADMIN_CHANGED_EVENT; a no-op outside the browser. */
export function announceAdminChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
}
