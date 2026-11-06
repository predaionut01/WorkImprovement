This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Frontend

Mock de Home'Bank (ING, retail România) cu un asistent AI integrat și pipeline-ul vizibil. Totul este marcat „PoC · date fictive”; nu există autentificare, clientul demo (Andrei Popescu, `cust_demo_01`) este deja „logat”. UI în română, light only, Tailwind v4 (tokens în `src/app/globals.css` via `@theme`), fără librării UI externe.

### Rute (App Router, `src/app`)

| Rută | Ce arată |
| --- | --- |
| `/` | Acasă: salut, conturi (RON, EUR, ING Economii, Round Up), carduri (debit/credit/virtual), ultimele 10 tranzacții, acțiuni rapide (Transfer nou, Plătește factură, Schimb valutar, Blochează card — modale/stub), widget Economii, grid „Produse și servicii”. |
| `/conturi` | Conturi cu IBAN (copiază), carduri cu toggle Contactless / Plăți online și Blochează/Deblochează (`POST /api/bank/cards/:id/…`), CTA card virtual (stub). |
| `/tranzactii` | Lista completă cu filtre (cont, categorie, text, interval), tranzacțiile `pending` separat, drawer cu detalii la click. |
| `/plati` | Formular de transfer (cont sursă, beneficiar salvat sau IBAN, sumă, detalii) → pas de confirmare determinist → toast; lista locală „Transferuri recente”; istoricul transferurilor din API cu badge-uri de status (În verificare / Finalizat / Respins + motiv). |
| `/economii` | Cont de economii, Round Up, depozite (dobândă, scadență, dobândă acumulată, reînnoire), „Deschide depozit nou” cu tabel de dobânzi ilustrative. |
| `/credite` | Credit de nevoi personale (progres, rată, următoarea plată), card de credit (limită/utilizat, plata minimă), Extra'ROL, simulator ipotecar (slidere, calcul local, marcat „Simulare”). |
| `/investitii` | Total portofoliu, poziții cu P&L colorat, bară de alocare. |
| `/asigurari` | Trei polițe (acoperire, primă, următoarea plată). |
| `/rapoarte` | Statistici lunare din `/api/bank/stats`: venituri vs. cheltuieli (SVG) și bare pe categorii pentru luna aleasă. |
| `/ops` | Observabilitate: tile-uri sumar, tabel per model, scor mediu judges, Conversation Store (rând expandabil cu context pack pseudonimizat + cei 8 pași), butoane „Rulează judges” și „Reset”, auto-refresh la 5 s și la focus. Afișează stări goale dacă `/api/ops/*` lipsește. |

### Structură

- `src/lib/ui/bank-store.tsx` — `BankProvider` + `useBank()`: încarcă o dată `GET /api/bank/snapshot`, expune `data`, `refresh()`, `cardAction()` și formatatoare (`fmtMoney` → „1.234,56 RON”, date `ro-RO`).
- `src/lib/ui/format.ts`, `src/lib/ui/labels.ts` — formatare și etichete RO (statusuri, ramuri, intenții, culori categorii).
- `src/lib/ui/chat-client.ts` — `streamChat()`: `POST /api/chat`, citește NDJSON prin `ReadableStream`, reasamblează liniile tăiate între chunk-uri, suportă `AbortSignal`.
- `src/components/ui/*` — Card, Badge, Money, Button, Modal, Drawer, Toast, Toggle, ProgressBar, Table, Field, Stat, Skeleton, Icons (SVG inline).
- `src/components/layout/*` — TopBar (bară portocalie, wordmark text „Home'Bank” + pill PoC), SideNav, AppShell.
- `src/components/chat/*` — widget, panou, hook `useChat`, Trace panel, action cards, JSON viewer.
- `src/components/ops/TurnRow.tsx` — rândul expandabil din Conversation Store.

### Panoul de chat

Buton portocaliu „Asistent” jos-dreapta pe toate paginile. Panoul (~1000×640, full-screen pe ecrane mici, cu tab-uri Chat/Trace) are două coloane:

- **Stânga — chat**: header „Asistentul Home'Bank” + disclaimer AI, mesaje (user dreapta/portocaliu, asistent stânga/gri, text streamat cu caret), chip-uri cu cele 6 prompturi demo, input (Enter trimite), „Vreau un agent”, toggle „Simulează provider principal căzut” (`simulate.providerDown`) și toggle Trace. Sub fiecare răspuns: `ramură · intenție · model · ms`. Butonul „Oprește” anulează stream-ul.
- **Dreapta — Trace**: cei 8 pași din `STEP_ORDER`/`STEP_LABELS`, fiecare cu număr, titlu, descriere scurtă, status live (gri = în așteptare, spinner = rulează, verde = ok, roșu = blocat/eroare, gri întrerupt = sărit), durată, `summary` și `details` (JSON expandabil). Se resetează la fiecare mesaj nou și se umple pe măsură ce sosesc evenimentele `trace` (același `key` înlocuiește rândul).
- **Action cards** (eveniment `action`): `confirm_card_block` / `confirm_card_unblock` → card determinist „Blochezi cardul ••••1234?” cu Confirmă/Renunță; confirmarea apelează `POST /api/bank/cards/:id/block|unblock`, afișează un mesaj de sistem și reîmprospătează store-ul. `open_section` → buton-link către rută (`payload.route`). `handover` → card „Te conectez cu un coleg” cu poziție în coadă. Evenimentul `handover` afișează și un mesaj de sistem cu motivul.
- Protocol: `ChatRequest` (`sessionId` uuid per deschidere de panou, în `sessionStorage`; `customerId = cust_demo_01`; `history` ultimele 20 mesaje; `simulate`) → stream `ChatStreamEvent` NDJSON (`turn`, `trace`, `token`, `action`, `handover`, `done`, `error`).

## Backend / pipeline (VA API în fața Dialogflow CX)

Pipeline-ul de chat joacă rolul stratului de orchestrare „VA API” al băncii: el pseudonimizează, rutează, aduce contextul și verifică răspunsul; inteligența conversațională (intenții, Playbooks, răspunsuri generative pe Gemini) stă în **Dialogflow CX (Conversational Agents)**. Pipeline-ul merge însă **și complet offline** (fără nicio credențială): un furnizor „template” determinist compune răspunsul din pachetul de context, un router pe cuvinte-cheie și judges euristici țin locul modelelor. Trace-ul spune mereu ce mod a rulat (`mode: dialogflow | gemini | dev-http | template`). Repo-ul conține **exclusiv Google** (Dialogflow CX + Gemini pe Vertex AI); singura excepție este hook-ul neutru `dev-http`, activ doar local prin `.env.local`.

### Module (`src/lib/pipeline/`)

| Pas | Fișier | Ce face |
|---|---|---|
| 1 | `inputGuard.ts`, `vault.ts`, `injection.ts` | Pseudonimizare cu vault per sesiune (`<IBAN_01>`, `<PERSON_01>`, `<PHONE_01>`, `<EMAIL_01>`, `<CNP_01>`, `<CARD_01>`; nume cunoscute din datele bancare), detecție prompt injection RO+EN, lungime/gol/limbaj abuziv → răspuns fix, fără LLM |
| 2 | `router.ts` | Ramură + intenție + încredere + entități. Mod Dialogflow (`detectIntent`, `match.intent.displayName` → intenție), altfel Gemini Flash cu JSON structurat (sau hook-ul `dev-http` local), altfel reguli pe cuvinte-cheie. Reguli deterministe peste orice model: verbe de acțiune → ACTION, sfaturi interzise → HUMAN, „agent/om” → HUMAN, încredere < 0,55 → HUMAN |
| 3 | `context.ts`, `src/lib/knowledge/` | Context Service: un fetcher per intenție (data minimization) peste `bank.*`, `context_pack` cu schemă versionată (`ctx.<intent>.v1`), pseudonimizat. GENERAL_QA → retrieval BM25-lite peste FAQ-ul public (8 fișiere markdown, valori ilustrative), cu detector de injection pe chunk-uri |
| 4 | `prompt.ts` | `PROMPT_VERSION = hb-assistant-v1`: prefix de sistem stabil (cacheabil) → politici + context_pack ca bloc user → istoric (max 10) → mesajul pseudonimizat. Textul sugerat pentru Playbook: `playbook-instructions.md` |
| 5 | `gateway.ts`, `dialogflow.ts`, `llm.ts`, `devHttp.ts`, `template.ts` | Inference Gateway cu lanț de furnizori `Provider { id, model, generate({system, messages, onToken, signal}) }`, timeout per furnizor, 0 retry, telemetrie per încercare `{provider, model, ok, ms, error}`; `simulate.providerDown` doboară primul furnizor configurat |
| 6 | `outputGuard.ts` | PII în clar → `[redactat]`; tokeni necunoscuți → eliminați; sfaturi interzise → refuz sigur; grounding pe cifre (≥ 10, toleranță 0,01) → `warn` + „te rog verifică în secțiunea …”; **detokenizare ultima**, în perimetru |
| 7 | `delivery.ts` | ACTION → text + `action` (`confirm_card_block` cu `{cardId,last4}` sau `open_section` cu `payload.route`), HUMAN → text + `handover` + `action{kind:"handover", queuePosition, waitMinutes}`, BLOCKED → text fix |
| 8 | `store.ts`, `judges.ts` | Store în memorie + `.data/turns.json` (persistă la restart, pseudonimizat); 5 judges (faithfulness, hallucination, guardrails, resolution, tone) rulați asincron după `done` — LLM cu JSON structurat sau euristici offline |
| — | `index.ts` | `runTurn(req, emit)` orchestrează pașii și emite `turn → trace(running → ok/blocked/skipped/error) × 8 → token* → action?/handover? → done`; orice excepție devine `error` |
| — | `tools.ts` | Context Service expus pentru Dialogflow (webhook, tool OpenAPI, acțiune card) |

### Endpoint-uri

- `POST /api/chat` — body `ChatRequest`, răspuns `application/x-ndjson`, un `ChatStreamEvent` pe linie, flush imediat.
- `GET /api/ops/turns` (nou → vechi), `GET /api/ops/summary`, `POST /api/ops/judge {turnId?}`, `POST /api/ops/reset`.
- `POST /api/tools/webhook` — webhook Dialogflow CX (`WebhookRequest` → `WebhookResponse`): `fulfillmentInfo.tag` = intenția, `sessionInfo.session` → sessionId, `sessionInfo.parameters` → entități; răspunde cu `fulfillmentResponse.messages[].text` și `sessionInfo.parameters.context_pack` (pseudonimizat).
- `GET /api/tools/context?intent=…&sessionId=…` — pachetul de context pseudonimizat; `GET /api/tools/openapi.json` — spec OpenAPI 3.0 de lipit ca **Tool** într-un Playbook.
- `POST /api/tools/actions/card-block {cardId|last4, confirm, action?}` — acțiunea deterministă apelată de pagina de confirmare dintr-un Flow; fără `confirm:true` doar întoarce cardul de confirmat.
- Client fix: header `x-customer-id` (implicit `cust_demo_01`).
- Crearea agentului Dialogflow CX (script `scripts/df-provision.ts` sau pași în consolă) și integrarea: `docs/dialogflow-setup.md`.

Test rapid al webhook-ului (serverul pe :3000):

```bash
curl -s -X POST http://localhost:3000/api/tools/webhook \
  -H 'content-type: application/json' -H 'x-customer-id: cust_demo_01' \
  -d '{"fulfillmentInfo":{"tag":"transfer_status"},"sessionInfo":{"session":"projects/p/locations/europe-west1/agents/a/sessions/demo-1","parameters":{"amount":{"numberValue":240},"currency":{"stringValue":"EUR"}}},"text":"unde e transferul de 240 EUR"}'
```

### Variabile de mediu (vezi `.env.example`)

| Variabilă | Rol |
|---|---|
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Gemini Developer API (cheie din Google AI Studio) — varianta simplă |
| `GOOGLE_GENAI_USE_VERTEXAI=true` + `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` | Vertex AI cu Application Default Credentials (`gcloud auth application-default login`); SDK-ul `@google/genai` alege singur backend-ul din aceste variabile |
| `GEMINI_MODEL_MAIN`, `GEMINI_MODEL_SMALL` | Modele Gemini (implicit `gemini-3.1-pro-preview` pentru răspuns, `gemini-3.8-flash` pentru router/judges) |
| `DF_PROJECT_ID`, `DF_LOCATION`, `DF_AGENT_ID`, `DF_ENVIRONMENT?`, `DF_LANGUAGE?` | Dialogflow CX (ADC); când sunt setate, `dialogflow` e primul în lanț și routerul folosește `detectIntent` |
| `HB_DEV_PROVIDER_URL` | **Doar dezvoltare locală individuală**: hook neutru `dev-http` — gateway-ul trimite promptul la acest URL (protocol NDJSON în `src/lib/pipeline/devHttp.ts`) și nu știe ce rulează în spate. Se setează numai în `.env.local`; niciodată pe workstation-ul echipei |
| `HB_PROVIDER_CHAIN` | Ordinea furnizorilor; implicit `dialogflow,gemini-pro,gemini-flash,dev-http,template`; cei neconfigurați sunt săriți cu notă în trace |
| `HB_FORCE_OFFLINE=1` | Forțează modul offline (șablon + reguli + judges euristici) |
| `HB_TEMPLATE_DELAY_MS` | Întârzierea de streaming a șablonului (implicit 18 ms) |
| `HB_PUBLIC_URL` | URL-ul public folosit în `openapi.json` |

### Mod offline

Fără credențiale (cazul acestui laptop): routerul folosește reguli pe cuvinte-cheie, gateway-ul sare furnizorii neconfigurați și ajunge la `template`, judges-ii sunt euristici. Totul e vizibil în Trace (`mode: template`, lista `sarite`). Smoke test:

```bash
npx --yes tsx scripts/chat-smoke.ts            # offline forțat, 7 scenarii
npx --yes tsx scripts/chat-smoke.ts --online   # cu credențialele existente
```

### Pasul PoC → concept Dialogflow CX

| Pas PoC | Concept Dialogflow CX / VA API |
|---|---|
| 1 Input guard | Pre-procesare în VA API (pseudonimizarea e a noastră, CX nu o face) + CX *prompt security* / *banned phrases* |
| 2 Router | Rutele de intenție din *Default Start Flow* + rutarea către Playbooks; routerul nostru le simulează offline |
| 3 Context | *Playbook Tools* (OpenAPI `/api/tools/openapi.json`) / *webhook fulfillment* (`/api/tools/webhook`); GENERAL_QA → *Data Stores* |
| 4 Prompt | *Playbook goal + instructions* (textul din `src/lib/pipeline/playbook-instructions.md`) |
| 5 Inferență | Funcțiile generative CX (modelul Gemini ales în setările agentului) |
| 6 Output guard | Post-procesare în VA API + CX *response safety* |
| 7 Livrare | CX *Flows/pages*, cu pagină de confirmare pentru ACTION (`/api/tools/actions/card-block`) |
| 8 Store/Eval | Export istoric conversații CX (BigQuery) + judges-ii noștri |
