/**
 * Fictional demo data for one Home'Bank customer. Deterministic (seeded),
 * so every dev-server restart shows the same numbers.
 */
import type {
  Account,
  Beneficiary,
  Card,
  Customer,
  CustomerData,
  Deposit,
  Insurance,
  Investment,
  Loan,
  MonthlyStat,
  RoundUp,
  Transaction,
  Transfer,
  TxCategory,
} from "../types";

export const TODAY = new Date("2026-11-06T10:30:00+02:00");

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const customer: Customer = {
  id: "cust_demo_01",
  firstName: "Andrei",
  lastName: "Popescu",
  cnp: "1900512123456",
  phone: "+40 722 123 456",
  email: "andrei.popescu@example.com",
  address: "Str. Lalelelor 12, ap. 7, București",
  segment: "retail",
  package: "ING Complete",
  lang: "ro",
  customerSince: "2017-03-14",
};

const accounts: Account[] = [
  {
    id: "acc_ron_main",
    iban: "RO49INGB0000999901234567",
    currency: "RON",
    type: "current",
    name: "Cont Curent RON",
    balance: 8432.17,
    available: 8182.17,
  },
  {
    id: "acc_eur_main",
    iban: "RO21INGB0000999907654321",
    currency: "EUR",
    type: "current",
    name: "Cont Curent EUR",
    balance: 1260.0,
    available: 1020.0,
  },
  {
    id: "acc_savings",
    iban: "RO77INGB0000999905550001",
    currency: "RON",
    type: "savings",
    name: "ING Economii",
    balance: 15320.55,
    available: 15320.55,
    rate: 4.0,
  },
  {
    id: "acc_roundup",
    iban: "RO55INGB0000999905550002",
    currency: "RON",
    type: "roundup",
    name: "Round Up",
    balance: 412.3,
    available: 412.3,
    rate: 4.0,
  },
];

const cards: Card[] = [
  {
    id: "card_debit_1234",
    accountId: "acc_ron_main",
    type: "debit",
    brand: "Visa",
    last4: "1234",
    holder: "ANDREI POPESCU",
    expiry: "08/28",
    status: "active",
    contactless: true,
    onlinePayments: true,
    walletEnrolled: ["Apple Pay"],
  },
  {
    id: "card_credit_7788",
    accountId: "acc_ron_main",
    type: "credit",
    brand: "Mastercard",
    last4: "7788",
    holder: "ANDREI POPESCU",
    expiry: "02/27",
    status: "active",
    contactless: true,
    onlinePayments: true,
    creditLimit: 12000,
    creditUsed: 2140.5,
  },
  {
    id: "card_virtual_9901",
    accountId: "acc_eur_main",
    type: "virtual",
    brand: "Visa",
    last4: "9901",
    holder: "ANDREI POPESCU",
    expiry: "11/27",
    status: "active",
    contactless: false,
    onlinePayments: true,
    walletEnrolled: ["Google Pay"],
  },
];

const beneficiaries: Beneficiary[] = [
  { id: "ben_1", name: "Maria Ionescu", iban: "RO12BTRL0000000012345678", bank: "Banca Transilvania", lastUsed: "2026-11-05" },
  { id: "ben_2", name: "Mihai Popescu", iban: "RO66INGB0000999903334444", bank: "ING Bank", lastUsed: "2026-10-28" },
  { id: "ben_3", name: "Asociația de Proprietari Bl. A4", iban: "RO88BRDE0000000098765432", bank: "BRD", lastUsed: "2026-11-02" },
  { id: "ben_4", name: "Elena Dumitrescu", iban: "DE89370400440532013000", bank: "Commerzbank", lastUsed: "2026-09-15" },
];

const transfers: Transfer[] = [
  {
    id: "trf_7f3a",
    fromAccountId: "acc_eur_main",
    toIban: "RO12BTRL0000000012345678",
    toName: "Maria Ionescu",
    amount: 240,
    currency: "EUR",
    initiated: "2026-11-05T14:02:00+02:00",
    status: "pending_aml",
    eta: "2026-11-06",
    reference: "Chirie noiembrie",
    scheme: "SEPA",
  },
  {
    id: "trf_2b19",
    fromAccountId: "acc_ron_main",
    toIban: "RO88BRDE0000000098765432",
    toName: "Asociația de Proprietari Bl. A4",
    amount: 385,
    currency: "RON",
    initiated: "2026-11-02T09:15:00+02:00",
    status: "completed",
    reference: "Întreținere octombrie",
    scheme: "intra",
  },
  {
    id: "trf_c0d4",
    fromAccountId: "acc_ron_main",
    toIban: "RO66INGB0000999903334444",
    toName: "Mihai Popescu",
    amount: 500,
    currency: "RON",
    initiated: "2026-10-28T19:40:00+02:00",
    status: "completed",
    reference: "Cadou",
    scheme: "instant",
  },
  {
    id: "trf_e551",
    fromAccountId: "acc_eur_main",
    toIban: "DE89370400440532013000",
    toName: "Elena Dumitrescu",
    amount: 150,
    currency: "EUR",
    initiated: "2026-09-15T11:05:00+03:00",
    status: "rejected",
    reference: "Carte",
    scheme: "SEPA",
    rejectReason: "IBAN beneficiar invalid la banca destinatară",
  },
];

const deposits: Deposit[] = [
  {
    id: "dep_12m",
    sourceAccountId: "acc_ron_main",
    name: "Depozit la termen 12 luni",
    principal: 20000,
    currency: "RON",
    rate: 5.25,
    termMonths: 12,
    startDate: "2026-03-10",
    maturityDate: "2027-03-10",
    interestAccrued: 689.04,
    autoRenew: true,
  },
  {
    id: "dep_bonus_6m",
    sourceAccountId: "acc_ron_main",
    name: "Depozit Bonus 6 luni",
    principal: 7500,
    currency: "RON",
    rate: 5.75,
    termMonths: 6,
    startDate: "2026-08-20",
    maturityDate: "2027-02-20",
    interestAccrued: 92.33,
    autoRenew: false,
  },
];

const loans: Loan[] = [
  {
    id: "loan_personal",
    type: "personal",
    name: "Credit de nevoi personale",
    currency: "RON",
    principal: 45000,
    outstanding: 28340.2,
    rate: 9.9,
    monthlyPayment: 1012.4,
    nextPaymentDate: "2026-11-15",
    remainingMonths: 32,
    status: "active",
  },
  {
    id: "loan_cc",
    type: "credit_card",
    name: "Card de credit ING",
    currency: "RON",
    outstanding: 2140.5,
    rate: 19.9,
    limit: 12000,
    used: 2140.5,
    nextPaymentDate: "2026-11-20",
    monthlyPayment: 214.05,
    status: "active",
  },
  {
    id: "loan_overdraft",
    type: "overdraft",
    name: "ING Extra'ROL",
    currency: "RON",
    outstanding: 0,
    rate: 17.5,
    limit: 6000,
    used: 0,
    status: "active",
  },
];

const investments: Investment[] = [
  {
    id: "inv_fund_1",
    type: "fund",
    name: "ING Fond Echilibrat",
    units: 412.5,
    unitPrice: 18.42,
    currency: "RON",
    value: 7598.25,
    invested: 7000,
    pnl: 598.25,
    pnlPct: 8.55,
  },
  {
    id: "inv_etf_1",
    type: "etf",
    name: "iShares Core MSCI World",
    ticker: "IWDA",
    units: 12,
    unitPrice: 98.1,
    currency: "EUR",
    value: 1177.2,
    invested: 1080,
    pnl: 97.2,
    pnlPct: 9.0,
  },
  {
    id: "inv_stock_1",
    type: "stock",
    name: "Banca Transilvania",
    ticker: "TLV",
    units: 150,
    unitPrice: 31.6,
    currency: "RON",
    value: 4740,
    invested: 4950,
    pnl: -210,
    pnlPct: -4.24,
  },
];

const insurance: Insurance[] = [
  {
    id: "ins_life",
    type: "life",
    name: "Asigurare de viață",
    insurer: "NN Asigurări",
    premium: 85,
    currency: "RON",
    frequency: "monthly",
    coverage: 150000,
    status: "active",
    nextPaymentDate: "2026-12-01",
    since: "2022-06-01",
  },
  {
    id: "ins_health",
    type: "health",
    name: "Asigurare de sănătate",
    insurer: "NN Asigurări",
    premium: 120,
    currency: "RON",
    frequency: "monthly",
    coverage: 50000,
    status: "active",
    nextPaymentDate: "2026-12-01",
    since: "2024-01-15",
  },
  {
    id: "ins_income",
    type: "income",
    name: "Protecția venitului",
    insurer: "NN Asigurări",
    premium: 48,
    currency: "RON",
    frequency: "monthly",
    coverage: 24000,
    status: "active",
    nextPaymentDate: "2026-12-01",
    since: "2025-09-01",
  },
];

const roundUp: RoundUp = {
  enabled: true,
  savingsAccountId: "acc_roundup",
  roundTo: 5,
  totalSaved: 412.3,
  thisMonth: 23.6,
  bonusRatePct: 10,
};

// ---- Transactions: ~4 months, deterministic ----

interface MerchantDef {
  name: string;
  category: TxCategory;
  min: number;
  max: number;
  weight: number;
}

const merchants: MerchantDef[] = [
  { name: "Mega Image", category: "Mâncare & Băutură", min: 25, max: 240, weight: 10 },
  { name: "Lidl", category: "Mâncare & Băutură", min: 40, max: 320, weight: 8 },
  { name: "Kaufland", category: "Mâncare & Băutură", min: 60, max: 420, weight: 5 },
  { name: "Starbucks", category: "Mâncare & Băutură", min: 18, max: 45, weight: 6 },
  { name: "Restaurant La Mama", category: "Mâncare & Băutură", min: 80, max: 260, weight: 3 },
  { name: "Glovo", category: "Mâncare & Băutură", min: 45, max: 140, weight: 6 },
  { name: "Bolt", category: "Transport", min: 14, max: 48, weight: 7 },
  { name: "OMV", category: "Transport", min: 150, max: 320, weight: 3 },
  { name: "STB Abonament", category: "Transport", min: 80, max: 80, weight: 1 },
  { name: "eMAG", category: "Cumpărături", min: 60, max: 900, weight: 4 },
  { name: "H&M", category: "Cumpărături", min: 90, max: 380, weight: 2 },
  { name: "Decathlon", category: "Cumpărături", min: 70, max: 450, weight: 2 },
  { name: "Netflix", category: "Abonamente", min: 55, max: 55, weight: 1 },
  { name: "Spotify", category: "Abonamente", min: 28, max: 28, weight: 1 },
  { name: "Digi", category: "Utilități", min: 65, max: 65, weight: 1 },
  { name: "Enel Energie", category: "Utilități", min: 180, max: 340, weight: 1 },
  { name: "Engie", category: "Utilități", min: 90, max: 420, weight: 1 },
  { name: "Cinema City", category: "Divertisment", min: 40, max: 120, weight: 2 },
  { name: "Regina Maria", category: "Sănătate", min: 120, max: 450, weight: 1 },
  { name: "Catena", category: "Sănătate", min: 25, max: 160, weight: 3 },
];

function pick(rng: () => number): MerchantDef {
  const total = merchants.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  for (const m of merchants) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return merchants[0];
}

function buildTransactions(): Transaction[] {
  const rng = seeded(20261106);
  const txs: Transaction[] = [];
  let n = 0;
  const start = new Date("2026-07-01T00:00:00+03:00");
  const end = TODAY;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDate();
    const iso = (h: number, m: number) => {
      const x = new Date(d);
      x.setHours(h, m, 0, 0);
      return x.toISOString();
    };
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // salary on the 25th (or last known)
    if (day === 25) {
      txs.push({
        id: `tx_${++n}`,
        accountId: "acc_ron_main",
        date: iso(8, 2),
        amount: 9850,
        currency: "RON",
        merchant: "TECHNOVA SOFTWARE SRL",
        category: "Salariu",
        status: "posted",
        type: "transfer_in",
        description: `Salariu ${month}`,
        counterparty: { name: "TECHNOVA SOFTWARE SRL", iban: "RO33BRDE0000000011112222" },
      });
    }
    // rent & utilities early month
    if (day === 3) {
      txs.push({
        id: `tx_${++n}`,
        accountId: "acc_ron_main",
        date: iso(9, 15),
        amount: -2300,
        currency: "RON",
        merchant: "Chirie - Ionescu Maria",
        category: "Locuință",
        status: "posted",
        type: "transfer_out",
        description: `Chirie ${month}`,
        counterparty: { name: "Maria Ionescu", iban: "RO12BTRL0000000012345678" },
      });
    }
    if (day === 15) {
      txs.push({
        id: `tx_${++n}`,
        accountId: "acc_ron_main",
        date: iso(7, 0),
        amount: -1012.4,
        currency: "RON",
        merchant: "Rată credit nevoi personale",
        category: "Altele",
        status: "posted",
        type: "direct_debit",
        description: "Rată credit",
      });
    }
    if (day === 1) {
      for (const ins of insurance) {
        txs.push({
          id: `tx_${++n}`,
          accountId: "acc_ron_main",
          date: iso(6, 30),
          amount: -ins.premium,
          currency: "RON",
          merchant: ins.insurer,
          category: "Altele",
          status: "posted",
          type: "direct_debit",
          description: ins.name,
        });
      }
      txs.push({
        id: `tx_${++n}`,
        accountId: "acc_savings",
        date: iso(6, 0),
        amount: Math.round(15000 * 0.04 / 12 * 100) / 100,
        currency: "RON",
        merchant: "ING Bank",
        category: "Dobânzi",
        status: "posted",
        type: "interest",
        description: "Dobândă cont economii",
      });
    }
    if (day === 10) {
      txs.push({
        id: `tx_${++n}`,
        accountId: "acc_ron_main",
        date: iso(10, 0),
        amount: -1000,
        currency: "RON",
        merchant: "Transfer către ING Economii",
        category: "Economii",
        status: "posted",
        type: "transfer_out",
        description: "Economisire lunară",
      });
    }

    // daily card spend: 0-3 transactions
    const count = Math.floor(rng() * 3.4);
    for (let i = 0; i < count; i++) {
      const m = pick(rng);
      if (["Netflix", "Spotify", "Digi", "Enel Energie", "Engie", "STB Abonament"].includes(m.name) && day !== 8) continue;
      const amount = -Math.round((m.min + rng() * (m.max - m.min)) * 100) / 100;
      const hour = 8 + Math.floor(rng() * 13);
      const useCredit = m.category === "Cumpărături" && rng() < 0.5;
      const isPending = d.getTime() > end.getTime() - 2 * 86400000 && rng() < 0.5;
      txs.push({
        id: `tx_${++n}`,
        accountId: "acc_ron_main",
        cardId: useCredit ? "card_credit_7788" : "card_debit_1234",
        date: iso(hour, Math.floor(rng() * 60)),
        amount,
        currency: "RON",
        merchant: m.name,
        category: m.category,
        status: isPending ? "pending" : "posted",
        type: "card",
      });
      if (!useCredit && roundUp.enabled) {
        const abs = Math.abs(amount);
        const rounded = Math.ceil(abs / 5) * 5 - abs;
        if (rounded > 0.01) {
          txs.push({
            id: `tx_${++n}`,
            accountId: "acc_roundup",
            date: iso(hour, 59),
            amount: Math.round(rounded * 100) / 100,
            currency: "RON",
            merchant: "Round Up",
            category: "Economii",
            status: "posted",
            type: "roundup",
            description: `Rotunjire ${m.name}`,
          });
        }
      }
    }
  }
  // the EUR transfers show up as transactions too
  txs.push({
    id: `tx_${++n}`,
    accountId: "acc_eur_main",
    date: "2026-11-05T12:02:00.000Z",
    amount: -240,
    currency: "EUR",
    merchant: "Maria Ionescu",
    category: "Transfer",
    status: "pending",
    type: "transfer_out",
    description: "Chirie noiembrie",
    counterparty: { name: "Maria Ionescu", iban: "RO12BTRL0000000012345678" },
  });
  txs.push({
    id: `tx_${++n}`,
    accountId: "acc_eur_main",
    date: "2026-10-30T09:10:00.000Z",
    amount: 1500,
    currency: "EUR",
    merchant: "Schimb valutar RON→EUR",
    category: "Transfer",
    status: "posted",
    type: "transfer_in",
    description: "Schimb valutar",
  });
  txs.push({
    id: `tx_${++n}`,
    accountId: "acc_ron_main",
    date: "2026-11-04T16:20:00.000Z",
    amount: -5,
    currency: "RON",
    merchant: "ING Bank",
    category: "Comisioane",
    status: "posted",
    type: "fee",
    description: "Comision retragere ATM altă bancă",
  });
  txs.sort((a, b) => (a.date < b.date ? 1 : -1));
  return txs;
}

const transactions = buildTransactions();

function buildStats(): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>();
  for (const t of transactions) {
    if (t.accountId !== "acc_ron_main") continue;
    const month = t.date.slice(0, 7);
    let s = map.get(month);
    if (!s) {
      s = { month, income: 0, spend: 0, byCategory: [] };
      map.set(month, s);
    }
    if (t.amount > 0) s.income += t.amount;
    else {
      s.spend += -t.amount;
      let c = s.byCategory.find((x) => x.category === t.category);
      if (!c) {
        c = { category: t.category, amount: 0, count: 0 };
        s.byCategory.push(c);
      }
      c.amount += -t.amount;
      c.count++;
    }
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      income: Math.round(s.income * 100) / 100,
      spend: Math.round(s.spend * 100) / 100,
      byCategory: s.byCategory
        .map((c) => ({ ...c, amount: Math.round(c.amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

export const demoCustomer: CustomerData = {
  customer,
  accounts,
  cards,
  transactions,
  transfers,
  deposits,
  loans,
  investments,
  insurance,
  roundUp,
  beneficiaries,
  stats: buildStats(),
};

/** Single mutable in-memory "database" for the dev server. */
const db: Record<string, CustomerData> = { [customer.id]: demoCustomer };

export function getCustomerData(customerId: string): CustomerData | undefined {
  return db[customerId];
}

export function listCustomerIds(): string[] {
  return Object.keys(db);
}
