// Client-safe (no server-only): the field a form's second submit button,
// "Kaydet ve yenisini ekle", posts, read by the create actions (menu items,
// tables) to open the next empty form instead of the list or the record.

export const SAVE_AND_NEW_FIELD = "sonra";
export const SAVE_AND_NEW_VALUE = "yeni";

/** True when the form was sent with "Kaydet ve yenisini ekle". */
export function wantsAnother(formData: FormData): boolean {
  return formData.get(SAVE_AND_NEW_FIELD) === SAVE_AND_NEW_VALUE;
}
