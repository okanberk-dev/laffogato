import "server-only";

import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  MAX_DEVICES_PER_MEMBER,
  type DevicePlatform,
} from "./order-push-core";

/**
 * The phones a member allowed to be told about their orders
 * (`customer_devices`, docs/API-MOBILE.md §23).
 *
 * One row per Expo push token. The member's e-mail links it to the account
 * (orders are matched to members by e-mail everywhere else too); it is
 * stored lower-cased. A token belongs to whoever registered it last: a phone
 * passed from one member to another follows the one signed in now.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Links `token` to the member, or refreshes it. Returns how many of the
 * member's oldest devices were dropped to stay within the cap.
 */
export async function registerDevice(input: {
  token: string;
  email: string;
  platform: DevicePlatform;
  now?: Date;
}): Promise<number> {
  const { data, error } = await getDb().rpc<number>(
    "register_customer_device",
    {
      p_token: input.token,
      p_email: emailKey(input.email),
      p_platform: input.platform,
      p_now: (input.now ?? new Date()).toISOString(),
      p_cap: MAX_DEVICES_PER_MEMBER,
    },
  );
  checkErr(error, "registerDevice");
  return Number(data) || 0;
}

/**
 * Forgets `token` if it is the member's. Another member's token is left
 * alone: a stale app must not be able to unlink somebody else's phone.
 */
export async function unregisterDevice(
  token: string,
  email: string,
): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.customerDevices)
    .delete()
    .eq("token", token)
    .eq("customerEmail", emailKey(email))
    .select("token");
  checkErr(error, "unregisterDevice");
  return Array.isArray(data) && data.length > 0;
}

/** The member's tokens, the most recently refreshed first. */
export async function deviceTokensFor(email: string): Promise<string[]> {
  const key = emailKey(email);
  if (!key) return [];
  const { data, error } = await getDb()
    .from(TABLES.customerDevices)
    .select("token")
    .eq("customerEmail", key)
    .order("updatedAt", { ascending: false })
    .limit(MAX_DEVICES_PER_MEMBER);
  checkErr(error, "deviceTokensFor");
  return ((data ?? []) as { token: string }[]).map((r) => r.token);
}

/** Tokens Expo says reach no device any more. */
export async function forgetTokens(tokens: readonly string[]): Promise<void> {
  if (tokens.length === 0) return;
  const { error } = await getDb()
    .from(TABLES.customerDevices)
    .delete()
    .in("token", [...tokens]);
  checkErr(error, "forgetTokens");
}

/** Every device of an address: the account is being closed or deleted. */
export async function forgetDevicesOf(email: string): Promise<void> {
  const key = emailKey(email);
  if (!key) return;
  const { error } = await getDb()
    .from(TABLES.customerDevices)
    .delete()
    .eq("customerEmail", key);
  checkErr(error, "forgetDevicesOf");
}
