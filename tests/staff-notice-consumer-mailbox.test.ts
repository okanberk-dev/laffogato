import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isConsumerMailbox,
  resolveStaffRecipients,
  type RecipientSources,
} from "@/lib/email/staff-order-notice-core";

/**
 * Staff mail (the "yeni sipariş" notice, the account deletion request) never
 * reaches a personal webmail inbox abroad.
 *
 * KVKK Aydınlatma Metni §14/§15 and Gizlilik §9 name every recipient abroad,
 * and Google only for the map. Storing an order notice (customer's first
 * name, order lines, table or delivery) in a Gmail or Hotmail inbox is a
 * transfer abroad (KVKK m.9/1; Yurt Dışına Aktarım Rehberi: storage in a
 * provider's cloud abroad is a transfer) that no text names and no standard
 * contract covers. `.env.example` shipped `ADMIN_EMAIL` as a Gmail address,
 * and every env break-glass owner got the mail, so the published texts were
 * untrue whenever production followed the example.
 */

function sources(over: Partial<RecipientSources> = {}): RecipientSources {
  return {
    enabled: true,
    roles: ["owner", "manager", "cashier"],
    extraEmails: "",
    notificationEmail: "",
    panelUsers: [],
    envAdmins: [],
    ...over,
  };
}

describe("consumer mailboxes", () => {
  it("knows the webmail domains hosted abroad", () => {
    for (const email of [
      "patron@gmail.com",
      "Patron@GoogleMail.com",
      "a@hotmail.com",
      "a@hotmail.com.tr",
      "a@outlook.com",
      "a@live.com",
      "a@msn.com",
      "a@yahoo.com",
      "a@yahoo.com.tr",
      "a@ymail.com",
      "a@icloud.com",
      "a@me.com",
      "a@yandex.com.tr",
      "a@proton.me",
      " a@gmail.com ",
    ]) {
      expect(isConsumerMailbox(email), email).toBe(true);
    }
  });

  it("leaves a company domain alone", () => {
    for (const email of [
      "info@nextgenlab.com.tr",
      "kasa@laffogato.net",
      "a@gmail.com.example",
      "a@notgmail.com",
      "",
    ]) {
      expect(isConsumerMailbox(email), email).toBe(false);
    }
  });
});

describe("resolveStaffRecipients", () => {
  it("does not mail an env break-glass owner whose address is Gmail", () => {
    const out = resolveStaffRecipients(
      sources({
        roles: ["owner"],
        envAdmins: [{ email: "x@gmail.com", role: "owner" }],
      }),
    );
    expect(out).toEqual([]);
  });

  it("skips personal inboxes from every source and keeps company ones", () => {
    const out = resolveStaffRecipients(
      sources({
        panelUsers: [
          { email: "mudur@hotmail.com", role: "manager", isActive: true },
          { email: "kasa@laffogato.net", role: "cashier", isActive: true },
        ],
        envAdmins: [
          { email: "patron@gmail.com", role: "owner" },
          { email: "info@nextgenlab.com.tr", role: "owner" },
        ],
        extraEmails: "mutfak@icloud.com\nbar@laffogato.net",
        notificationEmail: "ops@yahoo.com",
      }),
    );
    expect(out.map((r) => r.email).sort()).toEqual([
      "bar@laffogato.net",
      "info@nextgenlab.com.tr",
      "kasa@laffogato.net",
    ]);
  });
});

describe(".env.example", () => {
  it("does not suggest a personal inbox for any account", () => {
    const text = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const emails = text.match(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.filter(isConsumerMailbox)).toEqual([]);
  });
});
