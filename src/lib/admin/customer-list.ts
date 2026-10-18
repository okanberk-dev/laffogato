import "server-only";

import { getDb } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  CUSTOMER_SORT_COLUMNS,
  toCustomerCounts,
  toCustomerListRow,
  type CustomerCounts,
  type CustomerKind,
  type CustomerListQuery,
  type CustomerListRow,
  type CustomerSortKey,
} from "./customer-list-core";

// Müşteriler's two reads (admin audit PEO-13). Both run in SQL
// (db/migrations/20261018120000_admin_customer_list.sql): the merge of member
// accounts with the order roll-up, the Turkish-folded search, the sort and
// the page. The page used to read every member row and every order and write
// the whole list into its HTML twice.
//
// Customer data: the callers are pages behind requireRole("customers").

function filterArgs(query: CustomerListQuery) {
  return {
    p_search: query.search,
    p_digits: query.digits,
    p_consent: query.consent,
    p_verified: query.verified,
  };
}

/** One page of the customer list, filtered and sorted. */
export async function listCustomerPage(input: {
  query: CustomerListQuery;
  kind: CustomerKind;
  sort: { key: CustomerSortKey; dir: "asc" | "desc" };
  page: number;
  pageSize: number;
}): Promise<CustomerListRow[]> {
  const size = Math.max(1, Math.min(200, Math.trunc(input.pageSize)));
  const page = Math.max(1, Math.trunc(input.page));
  const { data, error, status } = await getDb().rpcRows<
    Record<string, unknown>
  >("admin_customer_page", {
    ...filterArgs(input.query),
    p_kind: input.kind,
    p_sort: CUSTOMER_SORT_COLUMNS[input.sort.key],
    p_desc: input.sort.dir === "desc",
    p_limit: size,
    p_offset: (page - 1) * size,
  });
  if (error) raiseDbError("listCustomerPage", error, status);
  return (data ?? []).map(toCustomerListRow);
}

/**
 * Customers, paid orders, spend and refunds per tab under the same filters:
 * the tab badges, the pager's total and the tiles all read this one answer.
 */
export async function countCustomers(
  query: CustomerListQuery,
): Promise<CustomerCounts> {
  const { data, error, status } = await getDb().rpcRows<
    Record<string, unknown>
  >("admin_customer_counts", filterArgs(query));
  if (error) raiseDbError("countCustomers", error, status);
  return toCustomerCounts(data ?? []);
}
