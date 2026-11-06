/**
 * Provisions the Dialogflow CX (Conversational Agents) agent for the Home'Bank PoC.
 *
 * Creates (idempotently, by display name) in one GCP project/location:
 *   - the agent "HomeBank Assistant PoC" (ro, Europe/Bucharest)
 *   - webhook  "hb-webhook"   → POST {HB_PUBLIC_URL}/api/tools/webhook
 *   - tool     "hb-context"   → OpenAPI from {HB_PUBLIC_URL}/api/tools/openapi.json
 *   - playbook "Asistent Home'Bank" (goal + instructions from src/lib/pipeline/playbook-instructions.md, tool attached)
 *   - intents with Romanian training phrases, one per pipeline intent
 *   - routes on the Default Start Flow: account intents → webhook (tag = intent);
 *     card_block → page "Confirmare blocare card" (entry webhook, "da" → webhook tag card_block_execute);
 *     human_request / advice_forbidden → live agent handoff;
 *     sys.no-match-default → the Playbook (generative, hybrid like ING's CC2.0)
 *
 * Usage:
 *   gcloud auth application-default login
 *   DF_PROJECT_ID=my-proj DF_LOCATION=europe-west1 HB_PUBLIC_URL=https://xyz.trycloudflare.com \
 *     npx --yes tsx scripts/df-provision.ts
 *
 * Prints the DF_* lines to put in .env.local. Safe to re-run: existing resources are reused/updated.
 * Not run on this machine (no Google credentials) — expect to adjust field names if the API has moved.
 */
import fs from "node:fs";
import path from "node:path";
import { protos, v3beta1 } from "@google-cloud/dialogflow-cx";

type IIntent = protos.google.cloud.dialogflow.cx.v3beta1.IIntent;
type ITransitionRoute = protos.google.cloud.dialogflow.cx.v3beta1.ITransitionRoute;
type IEventHandler = protos.google.cloud.dialogflow.cx.v3beta1.IEventHandler;

const PROJECT = process.env.DF_PROJECT_ID ?? "";
const LOCATION = process.env.DF_LOCATION ?? "europe-west1";
const PUBLIC_URL = (process.env.HB_PUBLIC_URL ?? "").replace(/\/$/, "");
const EXISTING_AGENT = process.env.DF_AGENT_ID ?? "";
const CUSTOMER = process.env.HB_DEMO_CUSTOMER ?? "cust_demo_01";
const AGENT_NAME = "HomeBank Assistant PoC";
const START_FLOW_ID = "00000000-0000-0000-0000-000000000000";

if (!PROJECT || !PUBLIC_URL) {
  console.error("Setează DF_PROJECT_ID și HB_PUBLIC_URL (URL public către serverul PoC, ex. tunel cloudflared).");
  process.exit(1);
}

const apiEndpoint = LOCATION === "global" ? "dialogflow.googleapis.com" : `${LOCATION}-dialogflow.googleapis.com`;
const agents = new v3beta1.AgentsClient({ apiEndpoint });
const webhooks = new v3beta1.WebhooksClient({ apiEndpoint });
const tools = new v3beta1.ToolsClient({ apiEndpoint });
const playbooks = new v3beta1.PlaybooksClient({ apiEndpoint });
const intents = new v3beta1.IntentsClient({ apiEndpoint });
const flows = new v3beta1.FlowsClient({ apiEndpoint });
const pages = new v3beta1.PagesClient({ apiEndpoint });

const log = (s: string) => console.log(`• ${s}`);

/** Training phrases per intent (Romanian). Keep in sync with src/lib/pipeline/router.ts keyword rules. */
const INTENTS: Record<string, string[]> = {
  transfer_status: ["Unde e transferul meu?", "Ce status are transferul de 240 EUR către Maria?", "A ajuns transferul la beneficiar?", "De ce e în verificare transferul meu?", "Când ajung banii la destinatar?"],
  spend_by_category: ["Cât am cheltuit pe mâncare luna asta?", "Cât am dat pe transport în octombrie?", "Cheltuielile mele pe categorii", "Pe ce am cheltuit cel mai mult luna trecută?"],
  balance: ["Cât am în cont?", "Care e soldul meu?", "Ce disponibil am pe contul în euro?", "Cât am în economii?"],
  card_info: ["Ce carduri am?", "Când expiră cardul meu?", "Cardul meu are plăți online activate?", "Ce limită are cardul de credit?"],
  card_block: ["Blochează-mi cardul", "Vreau să blochez cardul care se termină în 1234", "Mi-am pierdut cardul, blochează-l", "Blochez cardul de debit"],
  card_unblock: ["Deblochează-mi cardul", "Vreau să reactivez cardul blocat"],
  transaction_lookup: ["Arată-mi ultimele tranzacții", "Ce plată am făcut la Lidl?", "Caută tranzacția de 302 RON", "Ce am plătit ieri?"],
  deposit_info: ["Ce depozite am?", "Când expiră depozitul meu?", "Câtă dobândă am acumulat la depozit?"],
  loan_info: ["Cât mai am de plătit la credit?", "Când e următoarea rată?", "Ce dobândă am la creditul de nevoi personale?"],
  insurance_info: ["Ce asigurări am?", "Când se plătește prima la asigurarea de viață?", "Ce acoperire are asigurarea de sănătate?"],
  investment_info: ["Cât valorează investițiile mele?", "Ce fonduri am?", "Cum stau investițiile mele?"],
  roundup_info: ["Cât am economisit cu Round Up?", "Cum funcționează Round Up?", "Cât am strâns luna asta prin rotunjire?"],
  product_info: ["Ce dobândă are depozitul la 12 luni?", "Ce comision are retragerea de la ATM?", "Cum deschid un cont de economii?", "Ce este Extra'ROL?"],
  human_request: ["Vreau să vorbesc cu un agent", "Vreau un om", "Dă-mi legătura cu un operator", "Vreau să vorbesc cu cineva"],
  advice_forbidden: ["Merită să investesc în ETF-uri acum?", "Ar trebui să iau credit ipotecar?", "Ce acțiuni să cumpăr?", "Îmi recomanzi să vând fondul?"],
};

const ACCOUNT_INTENTS = ["transfer_status", "spend_by_category", "balance", "card_info", "transaction_lookup", "deposit_info", "loan_info", "insurance_info", "investment_info", "roundup_info", "product_info"];

function readPlaybookText(): { goal: string; steps: string[] } {
  const md = fs.readFileSync(path.join(process.cwd(), "src/lib/pipeline/playbook-instructions.md"), "utf8");
  const goal = /Goal \(scop\):\s*(.+)/.exec(md)?.[1]?.trim() ?? "Răspunzi clienților băncii folosind exclusiv contextul adus de tool-ul hb-context.";
  const steps = md
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter((l) => !l.startsWith("`hb-") && !l.startsWith("Webhook"));
  return { goal, steps };
}

async function ensureAgent(): Promise<string> {
  const parent = `projects/${PROJECT}/locations/${LOCATION}`;
  if (EXISTING_AGENT) {
    const name = `${parent}/agents/${EXISTING_AGENT}`;
    const [a] = await agents.getAgent({ name });
    log(`agent existent: ${a.displayName} (${name})`);
    return name;
  }
  const [list] = await agents.listAgents({ parent });
  const found = list.find((a) => a.displayName === AGENT_NAME);
  if (found?.name) {
    log(`agent găsit: ${found.name}`);
    return found.name;
  }
  const [created] = await agents.createAgent({
    parent,
    agent: {
      displayName: AGENT_NAME,
      defaultLanguageCode: "ro",
      supportedLanguageCodes: ["en"],
      timeZone: "Europe/Bucharest",
      description: "PoC Home'Bank — agent hibrid (Flows deterministe + Playbook generativ) în spatele VA API. Date fictive.",
      enableStackdriverLogging: true,
    },
  });
  log(`agent creat: ${created.name}`);
  return created.name!;
}

async function ensureWebhook(agent: string): Promise<string> {
  const [list] = await webhooks.listWebhooks({ parent: agent });
  const uri = `${PUBLIC_URL}/api/tools/webhook`;
  const body = { displayName: "hb-webhook", genericWebService: { uri, requestHeaders: { "x-customer-id": CUSTOMER } }, timeout: { seconds: 10 } };
  const found = list.find((w) => w.displayName === "hb-webhook");
  if (found?.name) {
    const [w] = await webhooks.updateWebhook({ webhook: { ...body, name: found.name }, updateMask: { paths: ["generic_web_service", "timeout"] } });
    log(`webhook actualizat: ${w.name} → ${uri}`);
    return w.name!;
  }
  const [w] = await webhooks.createWebhook({ parent: agent, webhook: body });
  log(`webhook creat: ${w.name} → ${uri}`);
  return w.name!;
}

async function ensureTool(agent: string): Promise<string> {
  const specUrl = `${PUBLIC_URL}/api/tools/openapi.json`;
  const res = await fetch(specUrl);
  if (!res.ok) throw new Error(`nu pot citi ${specUrl}: ${res.status}`);
  const textSchema = await res.text();
  const body = { displayName: "hb-context", description: "Context Service (VA API): pachet de context pseudonimizat per intenție + acțiunea deterministă de blocare card.", openApiSpec: { textSchema } };
  const [list] = await tools.listTools({ parent: agent });
  const found = list.find((t) => t.displayName === "hb-context");
  if (found?.name) {
    const [t] = await tools.updateTool({ tool: { ...body, name: found.name }, updateMask: { paths: ["open_api_spec", "description"] } });
    log(`tool actualizat: ${t.name}`);
    return t.name!;
  }
  const [t] = await tools.createTool({ parent: agent, tool: body });
  log(`tool creat: ${t.name}`);
  return t.name!;
}

async function ensurePlaybook(agent: string, tool: string): Promise<string> {
  const { goal, steps } = readPlaybookText();
  const body = { displayName: "Asistent Home'Bank", goal, instruction: { steps: steps.map((text) => ({ text })) }, referencedTools: [tool] };
  const [list] = await playbooks.listPlaybooks({ parent: agent });
  const found = list.find((p) => p.displayName === body.displayName);
  if (found?.name) {
    const [p] = await playbooks.updatePlaybook({ playbook: { ...body, name: found.name }, updateMask: { paths: ["goal", "instruction", "referenced_tools"] } });
    log(`playbook actualizat: ${p.name}`);
    return p.name!;
  }
  const [p] = await playbooks.createPlaybook({ parent: agent, playbook: body });
  log(`playbook creat: ${p.name}`);
  return p.name!;
}

async function ensureIntents(agent: string): Promise<Record<string, string>> {
  const [list] = await intents.listIntents({ parent: agent, languageCode: "ro" });
  const byName: Record<string, string> = {};
  for (const [display, phrases] of Object.entries(INTENTS)) {
    const body: IIntent = { displayName: display, trainingPhrases: phrases.map((text) => ({ parts: [{ text }], repeatCount: 1 })) };
    const found = list.find((i) => i.displayName === display);
    if (found?.name) {
      await intents.updateIntent({ intent: { ...body, name: found.name }, languageCode: "ro", updateMask: { paths: ["training_phrases"] } });
      byName[display] = found.name;
    } else {
      const [i] = await intents.createIntent({ parent: agent, intent: body, languageCode: "ro" });
      byName[display] = i.name!;
    }
  }
  log(`intenții: ${Object.keys(byName).length} (create/actualizate)`);
  return byName;
}

async function ensureConfirmPage(agent: string, webhook: string, intentNames: Record<string, string>): Promise<string> {
  const flow = `${agent}/flows/${START_FLOW_ID}`;
  const [list] = await pages.listPages({ parent: flow, languageCode: "ro" });
  const display = "Confirmare blocare card";
  // "yes" intent for the confirmation page
  let yes = intentNames.confirm_yes;
  if (!yes) {
    const [existing] = await intents.listIntents({ parent: agent, languageCode: "ro" });
    const f = existing.find((i) => i.displayName === "confirm_yes");
    if (f?.name) yes = f.name;
    else {
      const [i] = await intents.createIntent({ parent: agent, languageCode: "ro", intent: { displayName: "confirm_yes", trainingPhrases: ["da", "confirm", "da, blochează", "sigur", "ok"].map((text) => ({ parts: [{ text }], repeatCount: 1 })) } });
      yes = i.name!;
    }
  }
  const body = {
    displayName: display,
    entryFulfillment: { webhook, tag: "card_block", messages: [] },
    transitionRoutes: [
      { intent: yes, triggerFulfillment: { webhook, tag: "card_block_execute", messages: [] }, targetFlow: flow },
      { intent: intentNames.human_request, triggerFulfillment: { messages: [{ text: { text: ["Te conectez cu un coleg."] } }, { liveAgentHandoff: { metadata: {} } }] } },
    ] as ITransitionRoute[],
    eventHandlers: [{ event: "sys.no-match-default", triggerFulfillment: { messages: [{ text: { text: ["Blochez cardul? Răspunde cu „da” pentru a confirma sau spune-mi altceva."] } }] } }] as IEventHandler[],
  };
  const found = list.find((p) => p.displayName === display);
  if (found?.name) {
    const [p] = await pages.updatePage({ page: { ...body, name: found.name }, languageCode: "ro", updateMask: { paths: ["entry_fulfillment", "transition_routes", "event_handlers"] } });
    log(`pagină actualizată: ${p.name}`);
    return p.name!;
  }
  const [p] = await pages.createPage({ parent: flow, languageCode: "ro", page: body });
  log(`pagină creată: ${p.name}`);
  return p.name!;
}

async function wireStartFlow(agent: string, webhook: string, playbook: string, intentNames: Record<string, string>, confirmPage: string) {
  const name = `${agent}/flows/${START_FLOW_ID}`;
  const [flow] = await flows.getFlow({ name, languageCode: "ro" });
  const keep = (flow.transitionRoutes ?? []).filter((r) => !r.intent || !Object.values(intentNames).includes(r.intent));
  const routes: ITransitionRoute[] = [
    ...keep,
    ...ACCOUNT_INTENTS.map((i) => ({ intent: intentNames[i], triggerFulfillment: { webhook, tag: i, messages: [] } })),
    { intent: intentNames.card_block, targetPage: confirmPage },
    { intent: intentNames.card_unblock, triggerFulfillment: { webhook, tag: "card_unblock", messages: [] } },
    { intent: intentNames.human_request, triggerFulfillment: { messages: [{ text: { text: ["Te conectez cu un coleg din call center."] } }, { liveAgentHandoff: { metadata: {} } }] } },
    { intent: intentNames.advice_forbidden, triggerFulfillment: { messages: [{ text: { text: ["Nu pot oferi recomandări de investiții, ipotecare, juridice sau fiscale. Te pot conecta cu un specialist."] } }, { liveAgentHandoff: { metadata: {} } }] } },
  ];
  const handlers: IEventHandler[] = [
    ...(flow.eventHandlers ?? []).filter((h) => h.event !== "sys.no-match-default"),
    { event: "sys.no-match-default", targetPlaybook: playbook },
  ];
  await flows.updateFlow({ flow: { name, transitionRoutes: routes, eventHandlers: handlers }, languageCode: "ro", updateMask: { paths: ["transition_routes", "event_handlers"] } });
  log(`Default Start Flow: ${routes.length} rute, no-match → Playbook`);
}

async function main() {
  console.log(`Provizionare Dialogflow CX în ${PROJECT}/${LOCATION}, VA API la ${PUBLIC_URL}\n`);
  const agent = await ensureAgent();
  const webhook = await ensureWebhook(agent);
  const tool = await ensureTool(agent);
  const playbook = await ensurePlaybook(agent, tool);
  const intentNames = await ensureIntents(agent);
  const confirmPage = await ensureConfirmPage(agent, webhook, intentNames);
  await wireStartFlow(agent, webhook, playbook, intentNames, confirmPage);

  const agentId = agent.split("/").pop();
  console.log(`\nGata. Pune în .env.local:\n\nDF_PROJECT_ID=${PROJECT}\nDF_LOCATION=${LOCATION}\nDF_AGENT_ID=${agentId}\nDF_LANGUAGE=ro\n\nApoi antrenează agentul din consolă (Train) și testează în Test Agent sau din chat-ul PoC.`);
}

main().catch((err) => {
  console.error("Eroare:", err instanceof Error ? err.message : err);
  process.exit(1);
});
