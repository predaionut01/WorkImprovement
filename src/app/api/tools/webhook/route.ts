/**
 * POST /api/tools/webhook — Dialogflow CX webhook (WebhookRequest → WebhookResponse).
 *   fulfillmentInfo.tag       = intent name (transfer_status, spend_by_category, balance, card_info, …)
 *   sessionInfo.session       → our sessionId (last path segment)
 *   sessionInfo.parameters    may carry entities (last4, month, category, merchant)
 * Responds with fulfillmentResponse.messages[].text (short template answer)
 * and sessionInfo.parameters.context_pack (pseudonymized).
 */
import type { NextRequest } from "next/server";
import { handleWebhook, type WebhookRequestLike } from "@/lib/pipeline/tools";


export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as WebhookRequestLike | null;
  if (!body || typeof body !== "object") return Response.json({ error: "WebhookRequest JSON invalid" }, { status: 400 });
  try {
    return Response.json(handleWebhook(body, req.headers.get("x-customer-id") ?? "cust_demo_01"));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
