# Agentul Dialogflow CX pentru PoC

Agentul **nu există încă** — se creează în proiectul vostru GCP. Ai două căi, cu același
rezultat: scriptul automat (recomandat, reproductibil) sau pașii manuali din consolă.
Textele de mai jos (goal, instructions, intenții) sunt „promptul” agentului; sunt aceleași
pe care le folosește și pipeline-ul local.

## 0. Ce trebuie să existe înainte

1. Proiect GCP cu **Dialogflow API** activat și acces la Conversational Agents (Dialogflow CX).
2. Pe mașina de lucru: `gcloud auth application-default login` (ADC) cu un cont care are
   rol `Dialogflow API Admin` pe proiect.
3. **Serverul PoC accesibil din Google** — Dialogflow apelează webhook-ul și tool-ul peste
   internet. Pentru test, un tunel către `localhost:3000`:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   (sau `ngrok http 3000`). URL-ul rezultat e `HB_PUBLIC_URL`. Pentru ceva stabil: deploy pe
   Cloud Run.

## 1. Calea automată (script)

```bash
DF_PROJECT_ID=<proiect> DF_LOCATION=europe-west1 HB_PUBLIC_URL=https://<tunel> npx --yes tsx scripts/df-provision.ts
```

Scriptul creează sau actualizează (după display name, deci poate fi rulat de câte ori vrei):

| Resursă | Nume | Rol |
|---|---|---|
| Agent | `HomeBank Assistant PoC` | ro, Europe/Bucharest |
| Webhook | `hb-webhook` | `POST {HB_PUBLIC_URL}/api/tools/webhook`, header `x-customer-id` |
| Tool | `hb-context` | OpenAPI din `GET /api/tools/openapi.json` (`getContext`, `cardBlock`) |
| Playbook | `Asistent Home'Bank` | goal + instructions din `src/lib/pipeline/playbook-instructions.md`, tool atașat |
| Intenții | `transfer_status`, `spend_by_category`, `balance`, `card_info`, `card_block`, … | fraze de antrenament în română |
| Pagină | `Confirmare blocare card` | entry: webhook `card_block`; „da” → webhook `card_block_execute` |
| Default Start Flow | rute | intenții de cont → webhook cu `tag` = intenția; `card_block` → pagina de confirmare; `human_request` / `advice_forbidden` → live agent handoff; **no-match → Playbook** |

La final afișează `DF_PROJECT_ID / DF_LOCATION / DF_AGENT_ID` pentru `.env.local`.
Scriptul nu a putut fi rulat pe acest laptop (fără credențiale Google); dacă un câmp al
API-ului s-a schimbat, eroarea spune exact care.

## 2. Calea manuală (consola Conversational Agents)

1. **Create agent** → Build your own → nume `HomeBank Assistant PoC`, limbă `ro`, fus
   `Europe/Bucharest`, locație `europe-west1`.
2. **Manage → Webhooks → Create**: `hb-webhook`, URL `{HB_PUBLIC_URL}/api/tools/webhook`,
   header `x-customer-id: cust_demo_01`, timeout 10 s.
3. **Manage → Tools → Create**: `hb-context`, tip OpenAPI, lipește conținutul de la
   `{HB_PUBLIC_URL}/api/tools/openapi.json`. Authentication: none (PoC).
4. **Playbooks → Create**: nume `Asistent Home'Bank`.
   - **Goal**: textul „Goal (scop)” din `src/lib/pipeline/playbook-instructions.md`.
   - **Instructions**: liniile cu `-` din același fișier, una pe rând.
   - **Tools**: bifează `hb-context`.
   - Model: cel implicit al agentului (Gemini); poți alege Flash pentru latență.
5. **Manage → Intents**: creează intențiile din tabelul de mai jos, cu frazele de
   antrenament (minim 4–5 fiecare).
6. **Build → Default Start Flow → Start page**:
   - pentru fiecare intenție de cont: *Route* cu intenția → *Fulfillment* → *Enable webhook*
     `hb-webhook`, *Tag* = numele intenției (ex. `transfer_status`);
   - `card_block` → *Transition* la pagina nouă `Confirmare blocare card`;
   - `human_request`, `advice_forbidden` → mesaj text + *Live agent handoff*;
   - *Event handler* `sys.no-match-default` → *Transition to playbook* `Asistent Home'Bank`.
7. **Pagina `Confirmare blocare card`**: *Entry fulfillment* → webhook `hb-webhook`, tag
   `card_block` (întoarce „Blochezi cardul ••••1234?”). Route pe intenția `confirm_yes`
   („da”, „confirm”) → webhook tag `card_block_execute` → înapoi la Start.
8. **Train** și testează în *Test Agent*: „Unde e transferul meu de 240 EUR către Maria?”
   trebuie să lovească `transfer_status` și să întoarcă textul din webhook cu
   `<PERSON_01>` (pseudonimizat — detokenizarea o face VA API, nu agentul).

### Intenții și fraze de antrenament

| Intenție | Exemple |
|---|---|
| `transfer_status` | Unde e transferul meu? · Ce status are transferul de 240 EUR către Maria? · A ajuns transferul? |
| `spend_by_category` | Cât am cheltuit pe mâncare luna asta? · Cât am dat pe transport în octombrie? |
| `balance` | Cât am în cont? · Care e soldul meu? · Cât am în economii? |
| `card_info` | Ce carduri am? · Când expiră cardul? · Ce limită are cardul de credit? |
| `card_block` | Blochează-mi cardul · Mi-am pierdut cardul, blochează-l |
| `card_unblock` | Deblochează-mi cardul |
| `transaction_lookup` | Arată-mi ultimele tranzacții · Ce plată am făcut la Lidl? |
| `deposit_info` | Ce depozite am? · Când expiră depozitul? |
| `loan_info` | Cât mai am de plătit la credit? · Când e următoarea rată? |
| `insurance_info` | Ce asigurări am? · Ce acoperire are asigurarea de sănătate? |
| `investment_info` | Cât valorează investițiile mele? |
| `roundup_info` | Cât am economisit cu Round Up? |
| `product_info` | Ce dobândă are depozitul la 12 luni? · Ce comision are retragerea de la ATM? |
| `human_request` | Vreau să vorbesc cu un agent · Vreau un om |
| `advice_forbidden` | Merită să investesc în ETF-uri acum? · Ar trebui să iau credit ipotecar? |
| `confirm_yes` | da · confirm · da, blochează |

Lista completă e în `scripts/df-provision.ts` (`INTENTS`) și trebuie ținută în sincron cu
regulile din `src/lib/pipeline/router.ts`.

## 3. Integrarea cu restul soluției

În `.env.local` pe workstation:

```
DF_PROJECT_ID=<proiect>
DF_LOCATION=europe-west1
DF_AGENT_ID=<id din consolă sau din script>
DF_LANGUAGE=ro
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<proiect>
GOOGLE_CLOUD_LOCATION=europe-west1
```

Ce se întâmplă apoi, pe fiecare mesaj din chat:

1. **Pasul 1** rulează local: pseudonimizare, injection check.
2. **Pasul 2** apelează `detectIntent` pe agent cu textul pseudonimizat; intenția detectată
   de CX devine intenția pipeline-ului (`mode: dialogflow`).
3. **Pasul 3** construiește context pack-ul local și îl trimite ca `queryParams.parameters`;
   în paralel, dacă CX intră în Playbook, Playbook-ul apelează tool-ul `hb-context` singur.
4. **Pasul 5** reutilizează răspunsul CX (nu face al doilea apel). Dialogflow rulează Gemini
   din setările agentului.
5. **Pasul 6** verifică răspunsul (PII, tokeni necunoscuți, sfaturi, grounding) și îl
   detokenizează — agentul nu a văzut niciodată numele real.
6. **Pasul 8** salvează tura; judges-ii rulează pe Gemini Flash (Vertex).

Pentru acțiuni: Flow-ul `card_block` apelează webhook-ul cu `card_block` (confirmare) și
`card_block_execute` (execuție) — ambele tratate în `src/lib/pipeline/tools.ts`.

## 4. Ce rămâne de decis cu echipa de platformă

- **Autentificare webhook/tool**: PoC-ul e fără auth. În CC2.0 real: service account +
  ID token sau mTLS (Dialogflow suportă ambele în setările webhook-ului).
- **Identitatea clientului**: azi `x-customer-id` fix. Real: id-ul vine din sesiunea
  Home'Bank autentificată, pus de VA API în `queryParams.parameters`, nu din header.
- **Data Store** pentru `product_info`: PoC-ul are FAQ-ul local; în CX se indexează
  conținutul public ING într-un Data Store atașat Playbook-ului.
- **Export conversații** în BigQuery pentru evaluare, pe lângă store-ul nostru.
