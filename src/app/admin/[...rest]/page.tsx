import { notFound } from "next/navigation";

/**
 * Any /admin address no page answers: a typo, an old bookmark, a retired
 * screen. Next sends an unmatched URL to the ROOT not-found, the shop's
 * 404 with the storefront around it and no way back into the panel
 * (admin audit SHE-20). Matching it here renders admin/not-found.tsx inside
 * the panel instead. Every real route, static or dynamic, still wins over
 * a catch-all (the CSV and QR route handlers too).
 */
export default function AdminUnknownPage(): never {
  notFound();
}
