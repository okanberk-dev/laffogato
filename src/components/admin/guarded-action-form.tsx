"use client";

import { useRef, type ComponentProps } from "react";

import { ActionForm } from "./action-form";
import { useUnsavedGuard } from "./ui/unsaved-guard";

/**
 * ActionForm with the unsaved-changes guard (ui/unsaved-guard.ts), for the
 * long forms that leave for a list or a record when saved (the menu item,
 * the slides, the app's announcements and posts): a link or the palette
 * asks before typed changes are left behind, and a refused save stays
 * guarded. Its own file, so ActionForm, on every panel page, does not carry
 * the guard (tests/admin-unsaved-guard.test.ts).
 */
export function GuardedActionForm(
  props: Omit<ComponentProps<typeof ActionForm>, "formRef">,
) {
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedGuard(formRef);
  return <ActionForm {...props} formRef={formRef} />;
}
