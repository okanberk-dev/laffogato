"use client";

import { useState } from "react";

import { GhostButton } from "@/components/admin/forms";

/** Copies the table's public link; says so for two seconds. */
export function CopyTableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <GhostButton
      type="button"
      className="text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied("ok");
        } catch {
          setCopied("fail");
        }
        window.setTimeout(() => setCopied("idle"), 2000);
      }}
    >
      {copied === "ok"
        ? "Kopyalandı"
        : copied === "fail"
          ? "Kopyalanamadı"
          : "Bağlantıyı kopyala"}
    </GhostButton>
  );
}
