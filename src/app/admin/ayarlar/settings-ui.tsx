"use client";

import type { ReactNode } from "react";

import { Card, PrimaryButton } from "@/components/admin/forms";

import type { SettingsState } from "./settings-core";

// The pieces every settings tab draws with (settings-form.tsx and
// karaoke-tab.tsx).

export const initial: SettingsState = {};

export function SaveBar({
  state,
  pending,
  label = "Kaydet",
  pendingLabel = "Kaydediliyor…",
  idle = "Değişiklikler bu sekme kaydedildiğinde anında uygulanır.",
}: {
  state: SettingsState;
  pending: boolean;
  label?: string;
  pendingLabel?: string;
  idle?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
      <span className="text-xs">
        {state.error ? (
          <span className="text-red-600">{state.error}</span>
        ) : state.message ? (
          <span className="text-emerald-700">{state.message}</span>
        ) : (
          <span className="text-neutral-400">{idle}</span>
        )}
      </span>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </PrimaryButton>
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h2
        className="mb-4 text-xl"
        style={{
          fontFamily: "var(--serif), 'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {children}
    </Card>
  );
}
