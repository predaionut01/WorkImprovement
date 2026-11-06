/**
 * Context Service exposed to Dialogflow CX: webhook fulfillment, Playbook Tool
 * (OpenAPI) and the deterministic card action. Everything returned is
 * pseudonymized with the session vault, like in the chat pipeline.
 */
import type { protos } from "@google-cloud/dialogflow-cx";
import { bank } from "@/lib/mock/bank";
import type { Intent, TxCategory } from "@/lib/types";
import { runContext } from "./context";
import { fromParameterMap, intentToBranch, mapDisplayNameToIntent, toValue } from "./dialogflow";
import { composeTemplate } from "./template";
import type { ContextPack, RouterEntities } from "./types";
import { getVault } from "./vault";

export type WebhookRequestLike = protos.google.cloud.dialogflow.cx.v3.IWebhookRequest;
export type WebhookResponseLike = protos.google.cloud.dialogflow.cx.v3.IWebhookResponse;

const INTENTS: Intent[] = [
  "transfer_status",
  "spend_by_category",
  "balance",
  "card_info",
  "card_block",
  "card_unblock",
  "transaction_lookup",
  "deposit_info",
  "loan_info",
  "insurance_info",
  "investment_info",
  "roundup_info",
  "product_info",
  "fees_info",
  "how_to",
  "advice_forbidden",
  "human_request",
  "smalltalk",
  "unknown",
];

export function parseIntent(raw: string | null | undefined): Intent | undefined {
  if (!raw) return undefined;
  if ((INTENTS as string[]).includes(raw)) return raw as Intent;
  return mapDisplayNameToIntent(raw);
}

function toEntities(p: Record<string, unknown>): RouterEntities {
  const e: RouterEntities = {};
  if (typeof p.last4 === "string" && p.last4) e.last4 = p.last4;
  if (typeof p.month === "string" && p.month) e.month = p.month;
  if (typeof p.category === "string" && p.category) e.category = p.category as TxCategory;
  if (typeof p.merchant === "string" && p.merchant) e.merchant = p.merchant;
  if (typeof p.amount === "number") e.amount = p.amount;
  if (typeof p.currency === "string" && ["RON", "EUR", "USD"].includes(p.currency)) e.currency = p.currency as RouterEntities["currency"];
  return e;
}

export interface ToolContextResult {
  intent: Intent;
  branch: ReturnType<typeof intentToBranch>;
  schema: string;
  answer: string;
  context_pack: ContextPack;
  pseudonymized: true;
}

export function buildToolContext(args: { intent: Intent; sessionId: string; customerId: string; entities: Record<string, unknown>; query?: string }): ToolContextResult {
  const vault = getVault(args.sessionId, args.customerId);
  const entities = toEntities(args.entities);
  const branch = intentToBranch(args.intent);
  const effectiveBranch = branch === "ACTION" || branch === "HUMAN" ? "ACCOUNT_QA" : branch;
  const query = args.query ?? `${args.intent} ${Object.values(args.entities).filter((v) => typeof v === "string").join(" ")}`;
  const ctx = runContext({ branch: effectiveBranch, intent: args.intent, entities, customerId: args.customerId, tokenizedMessage: vault.tokenize(query), vault });
  const answer = composeTemplate({ intent: args.intent, pack: ctx.pack, entities, message: query });
  return { intent: args.intent, branch, schema: ctx.pack.schema, answer, context_pack: ctx.pack, pseudonymized: true };
}

/** "projects/p/locations/l/agents/a/sessions/<id>" → "<id>" */
export function sessionIdFromPath(session: string | null | undefined): string {
  if (!session) return "df-session";
  const parts = session.split("/");
  return parts[parts.length - 1] || "df-session";
}

export function handleWebhook(req: WebhookRequestLike, customerId: string): WebhookResponseLike {
  const tag = req.fulfillmentInfo?.tag ?? "";
  const sessionId = sessionIdFromPath(req.sessionInfo?.session);
  const params = fromParameterMap(req.sessionInfo?.parameters);

  // Deterministic action tags, called from a CX Flow page AFTER the confirmation page.
  const exec = /^card_(block|unblock)_execute$/.exec(tag);
  if (exec) {
    const action = exec[1] as "block" | "unblock";
    const r = cardAction({ customerId, cardId: typeof params.cardId === "string" ? params.cardId : undefined, last4: typeof params.last4 === "string" ? params.last4 : undefined, confirm: true, action });
    return {
      fulfillmentResponse: { messages: [{ text: { text: [r.message] } }], mergeBehavior: "REPLACE" },
      sessionInfo: { session: req.sessionInfo?.session ?? undefined, parameters: { hb_action: toValue(action), hb_executed: toValue(r.executed), hb_card: toValue(r.card ?? null) } },
      payload: { fields: { source: { stringValue: "hb-va-api" }, action: { stringValue: action } } },
    };
  }

  const intent = parseIntent(tag) ?? parseIntent(req.intentInfo?.displayName) ?? "unknown";
  const out = buildToolContext({ intent, sessionId, customerId, entities: params, query: req.text ?? undefined });
  return {
    fulfillmentResponse: {
      messages: [{ text: { text: [out.answer] } }],
      mergeBehavior: "REPLACE",
    },
    sessionInfo: {
      session: req.sessionInfo?.session ?? undefined,
      parameters: {
        context_pack: toValue(out.context_pack),
        context_schema: toValue(out.schema),
        hb_intent: toValue(out.intent),
        hb_branch: toValue(out.branch),
      },
    },
    payload: { fields: { source: { stringValue: "hb-va-api" }, pseudonymized: { boolValue: true } } },
  };
}

export interface CardActionResult {
  ok: boolean;
  executed: boolean;
  action: "block" | "unblock";
  card?: { cardId: string; last4: string; brand: string; type: string; status: string };
  message: string;
}

export function cardAction(args: { customerId: string; cardId?: string; last4?: string; confirm: boolean; action: "block" | "unblock" }): CardActionResult {
  const cards = bank.cards(args.customerId);
  const card = (args.cardId && cards.find((c) => c.id === args.cardId)) || (args.last4 && cards.find((c) => c.last4 === args.last4)) || (!args.cardId && !args.last4 ? cards.find((c) => c.type === "debit") : undefined);
  if (!card) return { ok: false, executed: false, action: args.action, message: "Card inexistent." };
  const lite = () => ({ cardId: card.id, last4: card.last4, brand: card.brand, type: card.type, status: card.status });
  if (!args.confirm) {
    return { ok: true, executed: false, action: args.action, card: lite(), message: `${args.action === "block" ? "Blochezi" : "Deblochezi"} cardul ${card.brand} ••••${card.last4}? Trimite confirm:true pentru a executa.` };
  }
  const updated = args.action === "block" ? bank.blockCard(args.customerId, card.id) : bank.unblockCard(args.customerId, card.id);
  return { ok: true, executed: true, action: args.action, card: { cardId: updated.id, last4: updated.last4, brand: updated.brand, type: updated.type, status: updated.status }, message: `Cardul ••••${updated.last4} este acum ${updated.status === "blocked" ? "blocat" : "activ"}.` };
}

export function openApiSpec(origin: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Home'Bank VA API — Context Service",
      version: "1.0.0",
      description: "Tool pentru Playbook-urile Dialogflow CX: aduce pachetul de context (pseudonimizat) pentru o intenție și execută acțiunea deterministă de blocare card. Date fictive, PoC.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/tools/context": {
        get: {
          operationId: "getContext",
          summary: "Pachet de context pseudonimizat pentru o intenție",
          parameters: [
            { name: "intent", in: "query", required: true, schema: { type: "string", enum: INTENTS }, description: "Intenția clientului" },
            { name: "sessionId", in: "query", required: true, schema: { type: "string" }, description: "Id-ul sesiunii Dialogflow (același vault de pseudonimizare)" },
            { name: "last4", in: "query", required: false, schema: { type: "string" }, description: "Ultimele 4 cifre ale cardului" },
            { name: "month", in: "query", required: false, schema: { type: "string" }, description: "Luna YYYY-MM" },
            { name: "category", in: "query", required: false, schema: { type: "string" }, description: "Categoria de cheltuieli (ex. Mâncare & Băutură)" },
            { name: "merchant", in: "query", required: false, schema: { type: "string" }, description: "Comerciant" },
          ],
          responses: {
            "200": {
              description: "Context pack + răspuns sugerat",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      intent: { type: "string" },
                      branch: { type: "string" },
                      schema: { type: "string" },
                      answer: { type: "string", description: "Răspuns scurt, determinist, cu tokeni <PERSON_01> în loc de date personale" },
                      context_pack: { type: "object", additionalProperties: true },
                      pseudonymized: { type: "boolean" },
                    },
                    required: ["intent", "branch", "schema", "answer", "context_pack"],
                  },
                },
              },
            },
            "400": { description: "Intenție invalidă" },
          },
        },
      },
      "/api/tools/actions/card-block": {
        post: {
          operationId: "cardBlock",
          summary: "Blochează / deblochează un card (flux determinist cu confirmare)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cardId: { type: "string" },
                    last4: { type: "string" },
                    confirm: { type: "boolean", description: "false = doar returnează cardul de confirmat; true = execută" },
                    action: { type: "string", enum: ["block", "unblock"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Rezultatul acțiunii",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      executed: { type: "boolean" },
                      action: { type: "string" },
                      card: { type: "object", properties: { cardId: { type: "string" }, last4: { type: "string" }, brand: { type: "string" }, type: { type: "string" }, status: { type: "string" } } },
                      message: { type: "string" },
                    },
                    required: ["ok", "executed", "action", "message"],
                  },
                },
              },
            },
            "404": { description: "Card inexistent" },
          },
        },
      },
    },
  };
}
