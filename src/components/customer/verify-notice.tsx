"use client";

import { useActionState } from "react";

import { resendVerificationAction, type ResendState } from "@/app/uye/actions";
import { BusyDots } from "@/components/laffogato/busy-dots";

/**
 * Banner shown to a logged-in customer whose e-mail is not yet verified.
 * Lets them re-send the verification link. `compact` trims the copy for
 * inline use (e.g. account page); default is the full checkout block.
 */
export function VerifyNotice({
  email,
  compact = false,
}: {
  email: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendVerificationAction,
    {},
  );

  return (
    <div
      style={{
        border: "1px solid var(--ink-line)",
        background: "var(--bg-warm)",
        borderRadius: "var(--r-md)",
        padding: compact ? "14px 16px" : "22px 24px",
        color: "var(--ink-soft)",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: "var(--ink)",
          fontSize: compact ? 14 : 16,
          marginBottom: 6,
        }}
      >
        E-postanı doğrula
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Sipariş verebilmek için <strong>{email}</strong> adresine gönderdiğimiz
        bağlantıdan hesabını onaylaman gerekiyor. E-posta gelmediyse yeniden
        gönderebilirsin.
      </p>
      <form
        action={action}
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-sm"
          aria-busy={pending}
        >
          {pending ? (
            <>
              <BusyDots />
              Gönderiliyor…
            </>
          ) : (
            "Bağlantıyı yeniden gönder"
          )}
        </button>
        {state.message && (
          <span style={{ color: "var(--matcha)", fontSize: 13 }}>
            {state.message}
          </span>
        )}
        {state.error && (
          <span style={{ color: "var(--rose)", fontSize: 13 }}>
            {state.error}
          </span>
        )}
      </form>
    </div>
  );
}
