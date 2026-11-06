/**
 * Offline "template" provider: composes a correct Romanian answer directly
 * from the (pseudonymized) context pack, per intent. Tokens are left in place;
 * the output guard detokenizes them like for any other provider.
 */
import type { Intent } from "@/lib/types";
import type {
  BalancePack,
  CardPack,
  DepositPack,
  InsurancePack,
  InvestmentPack,
  LoanPack,
  RoundUpPack,
  SpendPack,
  TransferLite,
  TransferStatusPack,
  TxLookupPack,
} from "./context";
import { CARD_STATUS_RO, fmtDate, fmtMoney, fmtMonth, fmtPct, TRANSFER_STATUS_RO } from "./format";
import { termsOf } from "@/lib/knowledge";
import type { ContextPack, RouterEntities } from "./types";

export const HUMAN_OFFER = "Dacă vrei, te pot pune în legătură cu un coleg din call center.";

function money(n: number, c: string) {
  return fmtMoney(n, c);
}

function pickTransfer(p: TransferStatusPack, e: RouterEntities): TransferLite | undefined {
  const list = p.transfers;
  const scored = list.map((t) => {
    let s = 0;
    if (e.personToken && t.toName === e.personToken) s += 3;
    if (e.amount != null && Math.abs(t.amount - e.amount) < 0.01) s += 2;
    if (e.currency && t.currency === e.currency) s += 1;
    if (t.status !== "completed") s += 0.5;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s || (a.t.initiated < b.t.initiated ? 1 : -1));
  return scored[0]?.t;
}

function transferStatus(p: TransferStatusPack, e: RouterEntities): string {
  const t = pickTransfer(p, e);
  if (!t) return `Nu am găsit niciun transfer recent în contul tău. ${HUMAN_OFFER}`;
  const head = `Transferul de ${money(t.amount, t.currency)} către ${t.toName} (referință „${t.reference}”), inițiat pe ${fmtDate(t.initiated)}, este ${TRANSFER_STATUS_RO[t.status as keyof typeof TRANSFER_STATUS_RO] ?? t.status}.`;
  let tail = "";
  switch (t.status) {
    case "pending_aml":
      tail = ` Este o verificare suplimentară de conformitate, care durează de regulă câteva ore și cel mult o zi lucrătoare; nu trebuie să faci nimic.${t.eta ? ` Estimarea de ajungere la beneficiar: ${fmtDate(t.eta)}.` : ""}`;
      break;
    case "pending":
      tail = ` Va fi procesat la următorul cut-off (SEPA: ora 15:00, RON: ora 16:00).${t.eta ? ` Estimare: ${fmtDate(t.eta)}.` : ""}`;
      break;
    case "processing":
      tail = ` A plecat din bancă${t.eta ? ` și ar trebui să ajungă până pe ${fmtDate(t.eta)}` : ""}.`;
      break;
    case "completed":
      tail = " Banii au ajuns la banca beneficiarului.";
      break;
    case "rejected":
      tail = ` Motiv: ${t.rejectReason ?? "nespecificat"}. Suma este din nou disponibilă în contul tău.`;
      break;
  }
  const others = p.transfers.filter((x) => x.id !== t.id).length;
  const more = others ? ` Mai ai ${others} ${others === 1 ? "transfer recent" : "transferuri recente"} în secțiunea Plăți, dacă vrei să le verificăm.` : "";
  return `${head}${tail}${more}`;
}

function spend(p: SpendPack): string {
  const monthName = fmtMonth(p.month);
  if (p.category && p.categoryTotal) {
    if (p.categoryTotal.count === 0) return `În ${monthName} nu am găsit cheltuieli în categoria ${p.category}. Totalul cheltuielilor din cont luna aceasta este ${money(p.spend, "RON")}.`;
    const top = (p.topMerchants ?? []).slice(0, 3).map((m) => `${m.merchant} ${money(m.amount, "RON")}`).join(", ");
    const prev = p.previousMonth?.categoryAmount != null ? ` În ${fmtMonth(p.previousMonth.month)} fuseseră ${money(p.previousMonth.categoryAmount, "RON")}.` : "";
    const note = p.category === "Mâncare & Băutură" ? " Restaurantele, cafenelele și cumpărăturile alimentare intră în această categorie." : "";
    return `În ${monthName} ai cheltuit ${money(p.categoryTotal.amount, "RON")} pe ${p.category}, în ${p.categoryTotal.count} ${p.categoryTotal.count === 1 ? "plată" : "plăți"}.${note}${top ? ` Cele mai mari sume: ${top}.` : ""}${prev} Totalul cheltuielilor din cont luna aceasta: ${money(p.spend, "RON")}.`;
  }
  const top = p.byCategory.slice(0, 3).map((c) => `${c.category} ${money(c.amount, "RON")}`).join(", ");
  const prev = p.previousMonth ? ` În ${fmtMonth(p.previousMonth.month)} totalul fusese ${money(p.previousMonth.spend, "RON")}.` : "";
  return `În ${monthName} ai cheltuit în total ${money(p.spend, "RON")} din contul curent (încasări: ${money(p.income, "RON")}).${top ? ` Cele mai mari categorii: ${top}.` : ""}${prev} Detaliile complete sunt în secțiunea Rapoarte.`;
}

function balance(p: BalancePack): string {
  if (!p.accounts.length) return `Nu am găsit conturi active. ${HUMAN_OFFER}`;
  const lines = p.accounts.map((a) => `${a.name}: ${money(a.balance, a.currency)}${a.available !== a.balance ? ` (disponibil ${money(a.available, a.currency)})` : ""}`);
  return `Iată soldurile tale: ${lines.join("; ")}. Disponibilul poate fi mai mic decât soldul din cauza plăților în așteptare.`;
}

function cards(p: CardPack): string {
  if (!p.cards.length) return `Nu am găsit niciun card cu aceste detalii. ${HUMAN_OFFER}`;
  const lines = p.cards.map((c) => {
    const kind = c.type === "debit" ? "card de debit" : c.type === "credit" ? "card de credit" : "card virtual";
    const credit = c.creditLimit != null ? `, limită ${money(c.creditLimit, "RON")}, folosit ${money(c.creditUsed ?? 0, "RON")}` : "";
    return `${c.brand} ${kind} ••••${c.last4}: ${CARD_STATUS_RO[c.status] ?? c.status}, expiră ${c.expiry}, contactless ${c.contactless ? "pornit" : "oprit"}, plăți online ${c.onlinePayments ? "pornite" : "oprite"}${credit}`;
  });
  return `${lines.join(". ")}. Blocarea sau setările cardului se schimbă dintr-un flux securizat, cu confirmare.`;
}

function txLookup(p: TxLookupPack): string {
  if (!p.transactions.length) return `Nu am găsit tranzacții pentru filtrul cerut${p.filter.merchant ? ` (${p.filter.merchant})` : ""}. ${HUMAN_OFFER}`;
  const lines = p.transactions.slice(0, 5).map((t) => `${fmtDate(t.date)} ${t.merchant} ${money(t.amount, t.currency)}${t.status === "pending" ? " (în așteptare)" : ""}`);
  const rest = p.transactions.length > 5 ? ` și încă ${p.transactions.length - 5} în secțiunea Tranzacții` : "";
  return `Ultimele tranzacții găsite: ${lines.join("; ")}${rest}.`;
}

function deposits(p: DepositPack): string {
  if (!p.deposits.length) return "Nu ai depozite active momentan. Poți constitui unul din secțiunea Economii.";
  const lines = p.deposits.map((d) => `${d.name}: ${money(d.principal, d.currency)} la ${fmtPct(d.rate)} pe an, scadent pe ${fmtDate(d.maturityDate, true)}, dobândă acumulată ${money(d.interestAccrued, d.currency)}${d.autoRenew ? ", cu prelungire automată" : ""}`);
  return `${lines.join(". ")}. Dobânda se plătește la scadență; lichidarea anticipată pierde dobânda acumulată.`;
}

function loans(p: LoanPack): string {
  if (!p.loans.length) return "Nu ai credite active momentan.";
  const lines = p.loans.map((l) => {
    if (l.type === "overdraft" || l.type === "credit_card") return `${l.name}: limită ${money(l.limit ?? 0, l.currency)}, folosit ${money(l.used ?? 0, l.currency)}${l.nextPaymentDate ? `, următoarea plată pe ${fmtDate(l.nextPaymentDate, true)}` : ""}`;
    return `${l.name}: sold rămas ${money(l.outstanding, l.currency)}, rată lunară ${money(l.monthlyPayment ?? 0, l.currency)}${l.nextPaymentDate ? ` scadentă pe ${fmtDate(l.nextPaymentDate, true)}` : ""}${l.remainingMonths ? `, ${l.remainingMonths} rate rămase` : ""}`;
  });
  return `${lines.join(". ")}. Pentru opțiuni de refinanțare sau un credit nou te pot pune în legătură cu un coleg.`;
}

function insurance(p: InsurancePack): string {
  if (!p.insurance.length) return "Nu ai asigurări active momentan.";
  const lines = p.insurance.map((i) => `${i.name} (${i.insurer}): primă ${money(i.premium, i.currency)} ${i.frequency === "monthly" ? "pe lună" : "pe an"}, acoperire ${money(i.coverage, i.currency)}, următoarea plată pe ${fmtDate(i.nextPaymentDate, true)}`);
  return `${lines.join(". ")}. Pentru daune te adresezi direct asigurătorului.`;
}

function investments(p: InvestmentPack): string {
  if (!p.investments.length) return "Nu ai investiții în portofoliu momentan.";
  const lines = p.investments.map((i) => `${i.name}${i.ticker ? ` (${i.ticker})` : ""}: ${money(i.value, i.currency)}, ${i.pnl >= 0 ? "+" : ""}${money(i.pnl, i.currency)} (${i.pnlPct >= 0 ? "+" : ""}${fmtPct(i.pnlPct)})`);
  return `Portofoliul tău: ${lines.join("; ")}. Îți pot arăta valorile, dar nu pot oferi recomandări de investiții; pentru asta te pot pune în legătură cu un specialist.`;
}

function roundUp(p: RoundUpPack): string {
  if (!p.roundUp.enabled) return "Round Up este dezactivat momentan. Îl poți porni din secțiunea Economii: plățile cu cardul de debit se rotunjesc și diferența se economisește automat.";
  return `Round Up este activ, cu rotunjire la ${p.roundUp.roundTo} RON. Ai economisit în total ${money(p.roundUp.totalSaved, "RON")}, din care ${money(p.roundUp.thisMonth, "RON")} luna aceasta${p.account ? `, în contul ${p.account.name}` : ""}. Banii sunt disponibili oricând.`;
}

function general(pack: ContextPack, message: string): string {
  const hits = pack.knowledge ?? [];
  if (!hits.length) return `Nu am găsit informația în materialele publice ale băncii. ${HUMAN_OFFER}`;
  const q = new Set(termsOf(message));
  const top = hits[0];
  const lines = top.text.split("\n").filter((l) => l.trim());
  const scored = lines.map((l, i) => ({ l, i, s: termsOf(l).filter((t) => q.has(t)).length }));
  const relevant = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  const chosen = (relevant.length ? relevant : scored).slice(0, 4).map((x) => x.l.replace(/^-\s*/, "").trim());
  const illustrative = /ilustrativ/i.test(top.text) || /ilustrativ/i.test(top.title) ? " Valorile sunt ilustrative, pentru acest demo." : "";
  return `Conform informațiilor publice ale băncii (${top.title.split(" › ")[1] ?? top.title}): ${chosen.join(" ")}${illustrative} Dacă vrei, îți pot arăta și detalii din contul tău.`;
}

export function composeTemplate(args: { intent: Intent; pack: ContextPack; entities: RouterEntities; message: string }): string {
  const { intent, pack, entities, message } = args;
  switch (intent) {
    case "transfer_status":
      return transferStatus(pack as TransferStatusPack, entities);
    case "spend_by_category":
      return spend(pack as SpendPack);
    case "balance":
      return balance(pack as BalancePack);
    case "card_info":
      return cards(pack as CardPack);
    case "transaction_lookup":
      return txLookup(pack as TxLookupPack);
    case "deposit_info":
      return deposits(pack as DepositPack);
    case "loan_info":
      return loans(pack as LoanPack);
    case "insurance_info":
      return insurance(pack as InsurancePack);
    case "investment_info":
      return investments(pack as InvestmentPack);
    case "roundup_info":
      return roundUp(pack as RoundUpPack);
    case "smalltalk":
      return "Salut! Sunt Asistentul Home'Bank. Te pot ajuta cu informații despre conturile, cardurile, transferurile sau economiile tale, ori despre produsele băncii. Cu ce începem?";
    case "product_info":
    case "fees_info":
    case "how_to":
      return general(pack, message);
    default:
      if (pack.knowledge) return general(pack, message);
      if ("accounts" in pack) return balance(pack as BalancePack);
      return `Nu am găsit informația cerută în datele disponibile. ${HUMAN_OFFER}`;
  }
}

/** Stream a text in word chunks with small delays so the UI looks live. */
export async function streamTemplate(text: string, onToken: (t: string) => void, signal?: AbortSignal): Promise<void> {
  const delay = Number(process.env.HB_TEMPLATE_DELAY_MS ?? 18);
  const words = text.split(/(\s+)/);
  let buf = "";
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) return;
    buf += words[i];
    if (buf.length >= 6 || i === words.length - 1) {
      onToken(buf);
      buf = "";
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }
}
