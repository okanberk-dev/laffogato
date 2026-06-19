import "server-only";

import { getSupabaseAdmin, TABLES } from "@/lib/supabase/server";

export type FranchiseStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "rejected"
  | "closed";

export const FRANCHISE_STATUSES: FranchiseStatus[] = [
  "new",
  "contacted",
  "qualified",
  "rejected",
  "closed",
];

export interface FranchiseApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  experience: string;
  budget: string;
  package: string;
  message: string;
  status: FranchiseStatus;
  createdAt: string;
}

export interface FranchiseApplicationInput {
  name: string;
  email: string;
  phone: string;
  city: string;
  experience: string;
  budget: string;
  package: string;
  message: string;
}

function clamp(s: string, n: number): string {
  return (s ?? "").trim().slice(0, n);
}

export async function createFranchiseApplication(
  input: FranchiseApplicationInput,
): Promise<FranchiseApplication> {
  const sb = getSupabaseAdmin();
  const app: FranchiseApplication = {
    id: `frapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: clamp(input.name, 120),
    email: clamp(input.email, 160),
    phone: clamp(input.phone, 40),
    city: clamp(input.city, 80),
    experience: clamp(input.experience, 80),
    budget: clamp(input.budget, 160),
    package: clamp(input.package, 80),
    message: clamp(input.message, 4000),
    status: "new",
    createdAt: new Date().toISOString(),
  };
  const { error } = await sb.from(TABLES.franchiseApplications).insert(app);
  if (error) throw new Error(`createFranchiseApplication: ${error.message}`);
  return app;
}

export async function listFranchiseApplications(): Promise<
  FranchiseApplication[]
> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.franchiseApplications)
    .select("*")
    .order("createdAt", { ascending: false });
  if (error) throw new Error(`listFranchiseApplications: ${error.message}`);
  return (data as FranchiseApplication[] | null) ?? [];
}

export async function getFranchiseApplication(
  id: string,
): Promise<FranchiseApplication | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.franchiseApplications)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getFranchiseApplication: ${error.message}`);
  return (data as FranchiseApplication | null) ?? null;
}

export async function setFranchiseApplicationStatus(
  id: string,
  status: FranchiseStatus,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.franchiseApplications)
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`setFranchiseApplicationStatus: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

export async function deleteFranchiseApplication(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.franchiseApplications)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`deleteFranchiseApplication: ${error.message}`);
  return ((data as { id: string }[] | null) ?? []).length > 0;
}
