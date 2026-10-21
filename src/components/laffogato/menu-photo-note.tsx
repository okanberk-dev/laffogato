/** The line under menu photos, word for word (tests pin it). */
export const MENU_PHOTO_NOTE = "Görseller temsilidir";

/**
 * "Görseller temsilidir" under the menu items the site shows with photos.
 *
 * Most menu photos are stock photos (docs/MENU-PHOTOS.md): they show the kind
 * of drink or dessert, not the one the bar serves, and a menu that does not
 * say so can read as a promise of what arrives. One line wherever the photos
 * appear, drawn only when at least one is on screen: a filter or a search
 * that leaves only the drawn plates has nothing to qualify.
 */
export function MenuPhotoNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="menu-photo-note">{MENU_PHOTO_NOTE}</p>;
}
