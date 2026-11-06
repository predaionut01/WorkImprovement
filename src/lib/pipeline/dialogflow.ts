/**
 * Dialogflow CX (Conversational Agents) adapter.
 *
 * The pipeline is the bank's "VA API" orchestration layer that sits in front
 * of Dialogflow CX: we pseudonymize, route, fetch context and guard; CX does
 * the conversational AI (intents, Playbooks, generative answers on Gemini).
 *
 * Env: DF_PROJECT_ID, DF_LOCATION, DF_AGENT_ID, optional DF_ENVIRONMENT,
 * optional DF_LANGUAGE (default "ro"). Auth: Application Default Credentials.
 */
import { v3beta1, protos } from "@google-cloud/dialogflow-cx";
import type { Branch, Intent } from "@/lib/types";
import type { ContextPack, DialogflowResult } from "./types";

type IStruct = protos.google.protobuf.IStruct;
type IValue = protos.google.protobuf.IValue;
type IQueryResult = protos.google.cloud.dialogflow.cx.v3beta1.IQueryResult;

export const DF_TIMEOUT_MS = 15_000;

export function dialogflowConfig() {
  const env = process.env;
  return {
    project: env.DF_PROJECT_ID ?? "",
    location: env.DF_LOCATION ?? "",
    agent: env.DF_AGENT_ID ?? "",
    environment: env.DF_ENVIRONMENT ?? "",
    language: env.DF_LANGUAGE ?? "ro",
  };
}

export function dialogflowConfigured(): boolean {
  const c = dialogflowConfig();
  return Boolean(c.project && c.location && c.agent);
}

let client: v3beta1.SessionsClient | null = null;

export function getSessionsClient(): v3beta1.SessionsClient {
  if (!client) {
    const { location } = dialogflowConfig();
    const apiEndpoint = !location || location === "global" ? "dialogflow.googleapis.com" : `${location}-dialogflow.googleapis.com`;
    client = new v3beta1.SessionsClient({ apiEndpoint });
  }
  return client;
}

/** Dialogflow session ids must be ≤ 36 chars, [A-Za-z0-9_-]. */
export function dfSessionId(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 36) || "demo";
}

export function sessionPath(sessionId: string): string {
  const c = dialogflowConfig();
  const sc = getSessionsClient();
  const sid = dfSessionId(sessionId);
  return c.environment ? sc.projectLocationAgentEnvironmentSessionPath(c.project, c.location, c.agent, c.environment, sid) : sc.projectLocationAgentSessionPath(c.project, c.location, c.agent, sid);
}

// ---------- google.protobuf.Struct helpers ----------

export function toValue(v: unknown): IValue {
  if (v === null || v === undefined) return { nullValue: "NULL_VALUE" };
  if (typeof v === "number") return { numberValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { boolValue: v };
  if (Array.isArray(v)) return { listValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { structValue: toStruct(v as Record<string, unknown>) };
  return { stringValue: String(v) };
}

export function toStruct(obj: Record<string, unknown>): IStruct {
  const fields: Record<string, IValue> = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v);
  return { fields };
}

export function fromValue(v: IValue | null | undefined): unknown {
  if (!v) return null;
  if (v.numberValue != null) return v.numberValue;
  if (v.stringValue != null) return v.stringValue;
  if (v.boolValue != null) return v.boolValue;
  if (v.listValue) return (v.listValue.values ?? []).map(fromValue);
  if (v.structValue) return fromStruct(v.structValue);
  return null;
}

export function fromStruct(s: IStruct | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s?.fields ?? {})) out[k] = fromValue(v);
  return out;
}

export function fromParameterMap(m: { [k: string]: IValue } | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m ?? {})) out[k] = fromValue(v);
  return out;
}

// ---------- detectIntent ----------

type MatchTypeLike = NonNullable<NonNullable<IQueryResult["match"]>["matchType"]> | null | undefined;

function matchTypeName(mt: MatchTypeLike): string {
  if (mt == null) return "MATCH_TYPE_UNSPECIFIED";
  if (typeof mt === "string") return mt;
  const names = protos.google.cloud.dialogflow.cx.v3beta1.Match.MatchType;
  return names[mt] ?? String(mt);
}

export function mapQueryResult(qr: IQueryResult | null | undefined, ms: number, responseId?: string | null): DialogflowResult {
  const text = (qr?.responseMessages ?? [])
    .flatMap((m) => m.text?.text ?? [])
    .filter(Boolean)
    .join("\n")
    .trim();
  const match = qr?.match;
  return {
    text,
    matchType: matchTypeName(match?.matchType),
    intentDisplayName: match?.intent?.displayName ?? qr?.intent?.displayName ?? undefined,
    confidence: match?.confidence ?? qr?.intentDetectionConfidence ?? undefined,
    parameters: { ...fromStruct(qr?.parameters), ...fromStruct(match?.parameters) },
    currentPlaybooks: qr?.generativeInfo?.currentPlaybooks ?? undefined,
    generativeInfo: qr?.generativeInfo ?? undefined,
    responseId: responseId ?? undefined,
    ms,
  };
}

/**
 * One non-streaming detectIntent call. The tokenized text goes as
 * queryInput.text; the pseudonymized context pack goes both as
 * queryParams.parameters (Playbooks/Flows can read $session.params.context_pack)
 * and queryParams.payload.
 */
export async function detectIntent(args: { sessionId: string; text: string; pack?: ContextPack; signal?: AbortSignal }): Promise<DialogflowResult> {
  const c = dialogflowConfig();
  const sc = getSessionsClient();
  const t0 = Date.now();
  const params: Record<string, unknown> = args.pack ? { context_pack: args.pack, customer_segment: args.pack.customer.segment, customer_package: args.pack.customer.package } : {};
  const [res] = await sc.detectIntent(
    {
      session: sessionPath(args.sessionId),
      queryInput: { text: { text: args.text }, languageCode: c.language },
      queryParams: {
        parameters: toStruct(params),
        payload: toStruct({ source: "hb-va-api", pseudonymized: true, ...(args.pack ? { context_pack: args.pack } : {}) }),
        timeZone: "Europe/Bucharest",
        channel: "homebank-chat",
      },
    },
    { timeout: DF_TIMEOUT_MS, signal: args.signal },
  );
  return mapQueryResult(res.queryResult, Date.now() - t0, res.responseId);
}

// ---------- intent mapping ----------

const INTENT_ALIASES: Record<string, Intent> = {
  transferstatus: "transfer_status",
  statustransfer: "transfer_status",
  undetransfer: "transfer_status",
  spendbycategory: "spend_by_category",
  cheltuieli: "spend_by_category",
  spending: "spend_by_category",
  balance: "balance",
  sold: "balance",
  cardinfo: "card_info",
  card: "card_info",
  cardblock: "card_block",
  blockcard: "card_block",
  blocarecard: "card_block",
  cardunblock: "card_unblock",
  unblockcard: "card_unblock",
  transactionlookup: "transaction_lookup",
  transactions: "transaction_lookup",
  tranzactii: "transaction_lookup",
  depositinfo: "deposit_info",
  depozit: "deposit_info",
  loaninfo: "loan_info",
  credit: "loan_info",
  insuranceinfo: "insurance_info",
  asigurare: "insurance_info",
  investmentinfo: "investment_info",
  investitii: "investment_info",
  roundupinfo: "roundup_info",
  roundup: "roundup_info",
  productinfo: "product_info",
  feesinfo: "fees_info",
  comisioane: "fees_info",
  howto: "how_to",
  advice: "advice_forbidden",
  adviceforbidden: "advice_forbidden",
  humanrequest: "human_request",
  agent: "human_request",
  liveagent: "human_request",
  smalltalk: "smalltalk",
  defaultwelcomeintent: "smalltalk",
  welcome: "smalltalk",
  defaultnegativeintent: "unknown",
};

/** "Transfer Status" / "transfer.status" / "transfer_status" → our Intent (undefined if unknown). */
export function mapDisplayNameToIntent(name: string | undefined): Intent | undefined {
  if (!name) return undefined;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return INTENT_ALIASES[key];
}

export function intentToBranch(intent: Intent): Branch {
  switch (intent) {
    case "card_block":
    case "card_unblock":
      return "ACTION";
    case "advice_forbidden":
    case "human_request":
      return "HUMAN";
    case "product_info":
    case "fees_info":
    case "how_to":
    case "smalltalk":
    case "unknown":
      return "GENERAL_QA";
    default:
      return "ACCOUNT_QA";
  }
}

/** Displayable summary of a detectIntent result (no raw PII: inputs were tokenized). */
export function dialogflowDetails(r: DialogflowResult): Record<string, unknown> {
  return {
    match_type: r.matchType,
    intent_cx: r.intentDisplayName ?? null,
    incredere_cx: r.confidence != null ? Number(r.confidence.toFixed(2)) : null,
    parametri_cx: Object.keys(r.parameters),
    playbooks: r.currentPlaybooks ?? [],
    response_id: r.responseId ?? null,
    durata_ms: r.ms,
  };
}
