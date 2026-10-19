import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { campaignSendPhrase } from "@/app/admin/bulten/kampanya/campaign-mail-controls";
import { ConfirmDialog, phraseMatches } from "@/app/admin/mobil/confirm-dialog";
import {
  createMailGate,
  POST_MAIL_AUDIENCE,
  POST_MAIL_TEMPLATE,
  postMailConfirm,
} from "@/app/admin/mobil/gonderiler/post-mail-confirm";
import { campaignFromPost } from "@/lib/email/campaigns";

/**
 * A post's save asks before its member mail in a dialog that says how many
 * members it reaches and wants that number typed back, the step "Gönder"
 * takes on the Kampanya e-postası page (decision D15). It was the
 * browser's own confirm(): "TÜM üyelere", no count, one OK (the forms
 * review of #148 left it to this package).
 */

describe("the post mail dialog", () => {
  it("names the recipient count and wants it typed back", () => {
    const ask = postMailConfirm(12);
    expect(ask.lines.join(" ")).toContain("pazarlama izni olan 12 üyeye");
    expect(ask.phrase).toBe("12");
    expect(ask.submitLabel).toBe("Kaydet ve gönder");
  });

  it("says when nobody would get it, and when it could not count", () => {
    expect(postMailConfirm(0).lines.join(" ")).toMatch(/kimseye gitmez/);
    const unknown = postMailConfirm(null);
    expect(unknown.lines.join(" ")).toMatch(/okunamadı/);
    expect(unknown.phrase).toBe("GÖNDER");
  });

  it("types back what the Kampanya e-postası page asks for", () => {
    for (const count of [0, 1, 12, null]) {
      expect(postMailConfirm(count).phrase, String(count)).toBe(
        campaignSendPhrase(count),
      );
    }
  });

  it("counts the audience the post's campaign is sent to", () => {
    const campaign = campaignFromPost({
      id: "apost-1",
      kind: "campaign",
      title: "Sabah ritüeli",
      body: "x",
      image: "",
      linkUrl: "",
      linkLabel: "",
      sortOrder: 0,
      isActive: true,
      startsAt: "",
      endsAt: "",
      createdAt: "2026-10-18T09:00:00.000Z",
      updatedAt: "2026-10-18T09:00:00.000Z",
    });
    expect(campaign.audience).toBe(POST_MAIL_AUDIENCE);
    expect(campaign.template).toBe(POST_MAIL_TEMPLATE);
  });

  it("draws the count, a phrase box without a name and buttons that do not submit", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        ask: postMailConfirm(12),
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );
    expect(html).toMatch(/^<dialog/);
    expect(html).toContain("Üyelere kampanya e-postası gitsin mi?");
    expect(html).toContain("12 üyeye");
    expect(html).toMatch(/Onaylamak için.*12.*yaz/);
    // The yes stays off until the count is typed; the number pad opens.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Kaydet ve gönder/);
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toMatch(/<input[^>]*\sname=/);
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
  });

  it("reads the phrase without case or surrounding spaces", () => {
    expect(phraseMatches(" 12 ", "12")).toBe(true);
    expect(phraseMatches("gönder", "GÖNDER")).toBe(true);
    expect(phraseMatches("13", "12")).toBe(false);
    expect(phraseMatches("1.2.1", "1.2.0")).toBe(false);
  });
});

describe("when the post form may post", () => {
  it("posts at once with the box off", () => {
    const gate = createMailGate();
    expect(gate.allows(false)).toBe(true);
    expect(gate.allows(false)).toBe(true);
  });

  it("asks with the box ticked, and a yes lets exactly one post through", () => {
    const gate = createMailGate();
    expect(gate.allows(true)).toBe(false);
    expect(gate.allows(true)).toBe(false);
    gate.open();
    expect(gate.allows(true)).toBe(true);
    // A refused save, pressed again: the question comes back.
    expect(gate.allows(true)).toBe(false);
  });

  it("asks in the dialog, not in the browser's confirm()", () => {
    const src = readFileSync(
      "src/app/admin/mobil/gonderiler/post-form.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/\bconfirm\(/);
    expect(src).toMatch(/<ConfirmDialog\b/);
    expect(src).toMatch(/gate\.allows\(emailMembers\)/);
  });
});
