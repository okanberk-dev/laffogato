"use client";

import { PrimaryButton } from "@/components/admin/forms";

/**
 * The browser's print dialog. The page's print rule (globals.css,
 * `[data-print-receipt]`) leaves only the sheet on paper; Ctrl+P / ⌘P does
 * the same before this button has hydrated.
 */
export function PrintButton() {
  return (
    <PrimaryButton type="button" onClick={() => window.print()}>
      Yazdır
    </PrimaryButton>
  );
}
