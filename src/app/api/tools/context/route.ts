/**
 * GET /api/tools/context?intent=…&sessionId=…[&last4=&month=&category=&merchant=]
 * Context Service exposed as a Playbook Tool for Dialogflow CX: returns the
 * pseudonymized context pack for one intent. Customer from x-customer-id.
 */
import type { NextRequest } from "next/server";
import { buildToolContext, parseIntent } from "@/lib/pipeline/tools";


export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const intent = parseIntent(q.get("intent"));
  if (!intent) return Response.json({ error: "intent invalid sau lipsă" }, { status: 400 });
  try {
    const out = buildToolContext({
      intent,
      sessionId: q.get("sessionId") ?? "df-session",
      customerId: req.headers.get("x-customer-id") ?? "cust_demo_01",
      entities: { last4: q.get("last4") ?? undefined, month: q.get("month") ?? undefined, category: q.get("category") ?? undefined, merchant: q.get("merchant") ?? undefined },
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
