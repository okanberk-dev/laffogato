// Client-safe (no server-only): what Kullanıcılar says about the signed-in
// owner's own row. The actions refuse these changes (a lower role takes the
// page away at once, switching yourself off or deleting yourself signs you
// out, with nobody's confirmation) and the row shows the same reasons
// beside its switched-off controls.

export const SELF_DELETE_REFUSED =
  "Kendi hesabını silemezsin: oturumun hemen kapanır. Gerekirse başka bir sahip siler.";

export const SELF_CHANGE_REFUSED =
  "Kendi rolünü ve erişimini değiştiremezsin: daha düşük rol bu sayfayı hemen kapatır, pasifleştirmek oturumunu kapatır. Gerekirse başka bir sahip değiştirir.";
