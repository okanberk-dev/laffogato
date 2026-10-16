"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

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

function RotateButton() {
  const { pending } = useFormStatus();
  return (
    <GhostButton
      type="submit"
      className="text-xs"
      disabled={pending}
      onClick={(e) => {
        if (
          !confirm(
            "Bu masanın kodu yenilensin mi? Masadaki basılı QR hemen çalışmaz olur; yeni kartı yazdırıp eskisini masadan hemen kaldırman gerekir.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Yenileniyor…" : "Kodu yenile"}
    </GhostButton>
  );
}

/** "Kodu yenile", behind a confirm: it kills the printed card at once. */
export function RotateTableCodeForm({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <RotateButton />
    </form>
  );
}
