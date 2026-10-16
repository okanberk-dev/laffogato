"use client";

import { PrimaryButton } from "@/components/admin/forms";

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <PrimaryButton
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
    >
      Yazdır
    </PrimaryButton>
  );
}
