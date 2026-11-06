/**
 * POST /api/tools/actions/card-block {cardId|last4, confirm:boolean, action?: "block"|"unblock"}
 * Deterministic action called by a CX Flow page after the confirmation page.
 * Without confirm:true it only returns the card to confirm.
 */
import type { NextRequest } from "next/server";
import { cardAction } from "@/lib/pipeline/tools";


export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { cardId?: unknown; last4?: unknown; confirm?: unknown; action?: unknown };
  try {
    const out = cardAction({
      customerId: req.headers.get("x-customer-id") ?? "cust_demo_01",
      cardId: typeof body.cardId === "string" ? body.cardId : undefined,
      last4: typeof body.last4 === "string" ? body.last4 : undefined,
      confirm: body.confirm === true,
      action: body.action === "unblock" ? "unblock" : "block",
    });
    return Response.json(out, { status: out.ok ? 200 : 404 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
