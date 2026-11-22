import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";

import {
  FRANCHISE_NOTICE_VERSION,
  type FranchiseApplicationInput,
  type FranchiseBudget,
  type FranchiseExperience,
  type FranchiseLocationStatus,
  type FranchiseStatus,
  type FranchiseTimeline,
} from "./franchise-core";

/**
 * The /franchise form's applications (`franchise_applications`,
 * 20261122135425). Written by the site's form, read and changed by the
 * panel (/admin/franchise). Never cached: the public page reads none of it.
 * Deleted 12 months after the application by the retention run
 * (src/lib/retention.ts, rule `franchise-applications`).
 */

export interface FranchiseConsent {
  /** When the box was ticked (the submit). */
  at: string;
  ip: string;
  userAgent: string;
  /** FRANCHISE_NOTICE_VERSION: which notice text the box sat under. */
  version: string;
}

export interface FranchiseApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  district: string;
  locationStatus: FranchiseLocationStatus;
  budget: FranchiseBudget;
  experience: FranchiseExperience;
  timeline: FranchiseTimeline;
  message: string;
  status: FranchiseStatus;
  consent: FranchiseConsent;
  createdAt: string;
  updatedAt: string;
}

/** A new application from the form; returns the stored row. */
export async function createFranchiseApplication(
  input: FranchiseApplicationInput,
  consent: { ip: string; userAgent: string },
): Promise<FranchiseApplication> {
  const now = new Date().toISOString();
  const id = `frn-${String(await nextSeq("frn")).padStart(4, "0")}`;
  const row: FranchiseApplication = {
    id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    district: input.district,
    locationStatus: input.locationStatus,
    budget: input.budget,
    experience: input.experience,
    timeline: input.timeline,
    message: input.message,
    status: "new",
    consent: {
      at: now,
      ip: consent.ip,
      userAgent: consent.userAgent,
      version: FRANCHISE_NOTICE_VERSION,
    },
    createdAt: now,
    updatedAt: now,
  };
  const { error } = await getDb()
    .from(TABLES.franchiseApplications)
    .insert(row);
  if (error) throw new Error(`createFranchiseApplication: ${error.message}`);
  return row;
}

/** Every application, newest first (the panel's list). */
export async function listFranchiseApplications(): Promise<
  FranchiseApplication[]
> {
  const { data, error } = await getDb()
    .from(TABLES.franchiseApplications)
    .select("*")
    .order("createdAt", { ascending: false });
  if (error) throw new Error(`listFranchiseApplications: ${error.message}`);
  return (data as FranchiseApplication[] | null) ?? [];
}

/** One application, for the panel's page; null when there is none. */
export async function getFranchiseApplication(
  id: string,
): Promise<FranchiseApplication | null> {
  if (!id) return null;
  const { data, error } = await getDb()
    .from(TABLES.franchiseApplications)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getFranchiseApplication: ${error.message}`);
  return (data as FranchiseApplication | null) ?? null;
}

/** Moves an application to `status`; false when there is no such row. */
export async function setFranchiseApplicationStatus(
  id: string,
  status: FranchiseStatus,
): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.franchiseApplications)
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`setFranchiseApplicationStatus: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

/** Deletes an application for good; false when it was already gone. */
export async function deleteFranchiseApplication(id: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.franchiseApplications)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`deleteFranchiseApplication: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}
