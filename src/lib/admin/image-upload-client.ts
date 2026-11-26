/**
 * The panel uploader's trip to the photo store (Cloudflare R2, 26 Kas 2026).
 *
 * Client-safe. The browser still shrinks the picked file first
 * (`image-encode.ts`: 1600 px, JPEG or WebP), which keeps one request far
 * under the platform's 4.5 MB ceiling; then the result goes up on its own
 * request to `/admin/gorsel-yukle`, the server compresses it with the
 * store's rule and answers its public URL. The form posts that URL, never
 * the bytes, so a save stays a few hundred bytes however many photos it
 * carries.
 *
 * A deployment without the store answers 503 `unconfigured`; the uploader
 * then keeps the data URL, as before the store existed, and does not ask
 * again for the rest of the page's life.
 */

export const IMAGE_UPLOAD_ENDPOINT = "/admin/gorsel-yukle";

let storeMissing = false;

/** `data:image/...;base64,...` → its bytes and type. */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(5, comma); // image/webp;base64
  const type = header.replace(/;base64$/, "");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Uploads one encoded photo and returns what the form should store: the
 * store's https URL, or the data URL itself when the deployment has no
 * store. Throws an Error with a Turkish message the uploader shows.
 */
export async function storeEncodedImage(
  dataUrl: string,
  fileName: string,
): Promise<string> {
  if (storeMissing) return dataUrl;
  let res: Response;
  try {
    res = await fetch(IMAGE_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": dataUrlToBlob(dataUrl).type },
      body: dataUrlToBlob(dataUrl),
      credentials: "same-origin",
    });
  } catch {
    throw new Error(`${fileName} yüklenemedi: bağlantı kurulamadı.`);
  }
  let body: { url?: unknown; error?: unknown; message?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // An HTML error page (a platform 413, a proxy): the status says enough.
  }
  if (
    res.ok &&
    typeof body.url === "string" &&
    body.url.startsWith("https://")
  ) {
    return body.url;
  }
  if (res.status === 503 && body.error === "unconfigured") {
    storeMissing = true;
    return dataUrl;
  }
  // proxy.ts sends a request without the session cookie to the sign-in page.
  if (
    res.status === 401 ||
    (res.redirected && res.url.includes("/admin/giris"))
  ) {
    throw new Error("Oturum kapanmış. Sayfayı yenileyip yeniden giriş yap.");
  }
  const reason =
    typeof body.message === "string" && body.message
      ? body.message
      : "Görsel yüklenemedi.";
  throw new Error(`${fileName}: ${reason}`);
}
