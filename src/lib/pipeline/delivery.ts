/**
 * Step 7 — Delivery. Deterministic branches get a fixed text plus an
 * action/handover payload; ACCOUNT_QA/GENERAL_QA were already streamed.
 */
import { bank } from "@/lib/mock/bank";
import type { Branch, ChatAction, Intent } from "@/lib/types";
import { FIXED_REPLIES, type InputGuardReason } from "./inputGuard";
import type { RouterEntities } from "./types";

export interface DeliveryPlan {
  /** Text to stream as tokens (deterministic branches only). */
  text?: string;
  action?: ChatAction;
  handover?: { reason: string };
  details: Record<string, unknown>;
}

const HUMAN_REASONS: Partial<Record<Intent, string>> = {
  advice_forbidden: "subiect interzis pentru asistent (consultanță de investiții / ipotecară / juridică / fiscală)",
  human_request: "clientul a cerut explicit un agent uman",
  unknown: "încredere scăzută a routerului",
};

const HUMAN_TEXT: Partial<Record<Intent, string>> = {
  advice_forbidden:
    "Înțeleg întrebarea, dar nu pot oferi recomandări de investiții, ipotecare, juridice sau fiscale. Îți pot arăta oricând valorile din portofoliul tău sau informații generale despre produse. Pentru o discuție despre ce ți s-ar potrivi, te pun în legătură cu un specialist.",
  human_request: "Sigur. Te pun în legătură cu un coleg din call center; conversația și contextul de până acum merg împreună cu tine, ca să nu reiei totul.",
};

const HUMAN_DEFAULT = "Nu sunt sigur că am înțeles corect ce ai nevoie, așa că prefer să nu ghicesc. Te pun în legătură cu un coleg care te poate ajuta.";

export function planDelivery(args: { branch: Branch; intent: Intent; entities: RouterEntities; customerId: string; blockedReason?: InputGuardReason; confidence: number }): DeliveryPlan {
  const { branch, intent, entities, customerId, blockedReason, confidence } = args;

  if (branch === "BLOCKED") {
    const reason = blockedReason ?? "injection";
    return { text: FIXED_REPLIES[reason], details: { ramura: branch, raspuns: "fix, fără LLM", motiv: reason } };
  }

  if (branch === "HUMAN") {
    const reason = HUMAN_REASONS[intent] ?? (confidence < 0.55 ? HUMAN_REASONS.unknown! : "escaladare");
    const action: ChatAction = {
      kind: "handover",
      label: "Vorbește cu un agent",
      payload: { reason, queuePosition: 2, waitMinutes: 3, intent, confidence: Number(confidence.toFixed(2)) },
    };
    return { text: HUMAN_TEXT[intent] ?? HUMAN_DEFAULT, handover: { reason }, action, details: { ramura: branch, handover: reason, transcript_si_context_pack: "trimise pseudonimizat către agent" } };
  }

  if (branch === "ACTION") {
    if (intent === "card_block" || intent === "card_unblock") {
      const cards = bank.cards(customerId);
      const card = (entities.last4 && cards.find((c) => c.last4 === entities.last4)) || cards.find((c) => c.type === "debit") || cards[0];
      if (!card) return { text: "Nu am găsit niciun card pe care să îl pot bloca. Te pun în legătură cu un coleg.", handover: { reason: "card inexistent" }, details: { ramura: branch, card: null } };
      const block = intent === "card_block";
      const text = block
        ? `Pot bloca cardul ${card.brand} ••••${card.last4} — confirmă mai jos. Blocarea se face printr-un flux securizat, cu confirmarea ta, nu de către asistent. Dacă l-ai pierdut, după blocare poți cere reemiterea tot din aplicație.`
        : `Pot debloca cardul ${card.brand} ••••${card.last4} — confirmă mai jos. Deblocarea se face printr-un flux securizat, cu confirmarea ta, nu de către asistent.`;
      const action: ChatAction = {
        kind: block ? "confirm_card_block" : "confirm_card_unblock",
        label: block ? `Blochează cardul ••••${card.last4}` : `Deblochează cardul ••••${card.last4}`,
        payload: { cardId: card.id, last4: card.last4, brand: card.brand, type: card.type, status: card.status },
      };
      return { text, action, details: { ramura: branch, actiune: action.kind, card: `••••${card.last4}`, executie: "flux determinist cu confirmare explicită (POST /api/bank/cards/:id/block)" } };
    }
    const action: ChatAction = { kind: "open_section", label: "Deschide Plăți", payload: { route: "/plati", href: "/plati" } };
    return {
      text: "Transferurile și plățile se fac din secțiunea Plăți, printr-un flux securizat cu confirmare. Îți deschid secțiunea; eu nu pot iniția plăți în locul tău.",
      action,
      details: { ramura: branch, actiune: action.kind, ruta: "/plati" },
    };
  }

  return { details: { ramura: branch, livrare: "răspuns streamat din gateway" } };
}
