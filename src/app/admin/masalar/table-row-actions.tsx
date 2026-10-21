"use client";

import { useState } from "react";

import { cx } from "@/components/laffogato/cx";
import { BUTTON, useToast } from "@/components/admin/ui";

/**
 * Copies the table's public link and says so. On the table's page: the
 * button's text for two seconds and a polite live region for a screen
 * reader (the text swap alone was never announced, admin audit KAR-22). In
 * the ⋯ menu, which closes on the click and hides both, a toast says it
 * (the toast stack is a live region of its own).
 */
export function CopyTableLink({
  url,
  tableName,
  variant = "ghost",
}: {
  url: string;
  /** For the button's accessible name: "Bağlantıyı kopyala: Bahçe 3". */
  tableName: string;
  variant?: "ghost" | "menu";
}) {
  const toast = useToast();
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const said =
    copied === "ok"
      ? `${tableName} bağlantısı kopyalandı.`
      : copied === "fail"
        ? "Kopyalanamadı; bağlantıyı elle seç."
        : "";
  return (
    <>
      <button
        type="button"
        aria-label={`Bağlantıyı kopyala: ${tableName}`}
        className={cx(BUTTON[variant])}
        onClick={async () => {
          let ok = true;
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            ok = false;
          }
          setCopied(ok ? "ok" : "fail");
          if (variant === "menu") {
            toast.show(
              ok
                ? {
                    message: `${tableName} bağlantısı kopyalandı.`,
                    tone: "info",
                  }
                : {
                    message: "Bağlantı kopyalanamadı; elle seçip kopyala.",
                    tone: "warning",
                  },
            );
          }
          window.setTimeout(() => setCopied("idle"), 2000);
        }}
      >
        {copied === "ok"
          ? "Kopyalandı"
          : copied === "fail"
            ? "Kopyalanamadı"
            : "Bağlantıyı kopyala"}
      </button>
      {variant === "menu" ? null : (
        <span className="sr-only" role="status" aria-live="polite">
          {said}
        </span>
      )}
    </>
  );
}
