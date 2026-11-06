/**
 * Mock "core banking" HTTP API, consumed by the Home'Bank UI.
 *
 *   GET  /api/bank/snapshot
 *   GET  /api/bank/accounts | cards | transactions | transfers | deposits
 *        | loans | investments | insurance | roundup | beneficiaries | stats
 *   POST /api/bank/cards/:id/block | unblock | contactless | online   (deterministic actions)
 *
 * The demo customer is fixed via the x-customer-id header (default cust_demo_01).
 * There is no authentication on purpose: this is a local PoC.
 */
import type { NextRequest } from "next/server";
import { bank } from "@/lib/mock/bank";
import type { TxCategory } from "@/lib/types";

const DEFAULT_CUSTOMER = "cust_demo_01";

function cid(req: NextRequest) {
  return req.headers.get("x-customer-id") ?? DEFAULT_CUSTOMER;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/bank/[...path]">) {
  const { path } = await ctx.params;
  const [resource] = path;
  const q = req.nextUrl.searchParams;
  const customerId = cid(req);
  try {
    switch (resource) {
      case "snapshot":
        return Response.json(bank.snapshot(customerId));
      case "customer":
        return Response.json(bank.customer(customerId));
      case "accounts":
        return Response.json(bank.accounts(customerId));
      case "cards":
        return Response.json(bank.cards(customerId));
      case "transactions":
        return Response.json(
          bank.transactions(customerId, {
            accountId: q.get("accountId") ?? undefined,
            cardId: q.get("cardId") ?? undefined,
            from: q.get("from") ?? undefined,
            to: q.get("to") ?? undefined,
            category: (q.get("category") as TxCategory | null) ?? undefined,
            merchant: q.get("merchant") ?? undefined,
            limit: q.get("limit") ? Number(q.get("limit")) : undefined,
          }),
        );
      case "transfers":
        return Response.json(bank.transfers(customerId));
      case "deposits":
        return Response.json(bank.deposits(customerId));
      case "loans":
        return Response.json(bank.loans(customerId));
      case "investments":
        return Response.json(bank.investments(customerId));
      case "insurance":
        return Response.json(bank.insurance(customerId));
      case "roundup":
        return Response.json(bank.roundUp(customerId));
      case "beneficiaries":
        return Response.json(bank.beneficiaries(customerId));
      case "stats":
        return Response.json(bank.stats(customerId, q.get("months") ? Number(q.get("months")) : 6));
      default:
        return Response.json({ error: "not found" }, { status: 404 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/bank/[...path]">) {
  const { path } = await ctx.params;
  const customerId = cid(req);
  const [resource, id, action] = path;
  try {
    if (resource === "cards" && id && action) {
      switch (action) {
        case "block":
          return Response.json(bank.blockCard(customerId, id));
        case "unblock":
          return Response.json(bank.unblockCard(customerId, id));
        case "contactless":
        case "online": {
          const body = (await req.json().catch(() => ({}))) as { value?: boolean };
          const flag = action === "contactless" ? "contactless" : "onlinePayments";
          return Response.json(bank.setCardFlag(customerId, id, flag, Boolean(body.value)));
        }
      }
    }
    return Response.json({ error: "not found" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
