import type { NextRequest } from "next/server";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import { readJsonBody, routeFailure } from "@/lib/mobile/http";
import { createAppOrder, listAppOrders } from "@/lib/mobile/orders";
import {
  firstIssueMessage,
  placeOrderBodySchema,
} from "@/lib/mobile/order-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LABEL = "api/mobile/v1/orders";

/**
 * `POST /api/mobile/v1/orders` — places an order for the signed-in member
 * and opens payment (docs/API-MOBILE.md §3). Only a verified e-mail may
 * order, as on the web.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    if (!auth.customer.emailVerified) {
      return apiError(
        403,
        "email_unverified",
        "Sipariş verebilmek için önce e-postanı doğrula.",
      );
    }

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = placeOrderBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return apiError(400, "invalid_body", firstIssueMessage(parsed.error));
    }

    const result = await createAppOrder(auth.customer, parsed.data);
    if (!result.ok) {
      const { status, code, message } = result.failure;
      return apiError(status, code, message);
    }
    return apiJson(
      {
        order: result.order,
        payment: result.payment,
        promoDropped: result.promoDropped,
      },
      { status: 201 },
    );
  } catch (err) {
    return routeFailure(err, LABEL);
  }
}

/** `GET /api/mobile/v1/orders` — the member's orders, newest first. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const orders = await listAppOrders(auth.customer);
    return apiJson({ orders });
  } catch (err) {
    return routeFailure(err, LABEL);
  }
}
