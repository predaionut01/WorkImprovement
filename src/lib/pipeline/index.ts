/**
 * runTurn(req, emit) — orchestrates the 8 steps of the VA API pipeline and
 * emits ChatStreamEvents in order:
 *   turn → trace(running/final) per step → token* → action?/handover? → done
 * Any thrown error becomes an `error` event (never a 500 mid-stream).
 */
import type { Branch, ChatRequest, Intent, StepKey, StoredTurn, TraceStep } from "@/lib/types";
import { contextDetails, runContext } from "./context";
import { planDelivery } from "./delivery";
import { gatewayDetails, generate, providerChain } from "./gateway";
import { inputGuardDetails, runInputGuard } from "./inputGuard";
import { runJudges } from "./judges";
import { isOffline } from "./llm";
import { outputGuardDetails, runOutputGuard } from "./outputGuard";
import { buildPrompt, PROMPT_VERSION } from "./prompt";
import { routerDetails, runRouter } from "./router";
import { saveTurn } from "./store";
import { streamTemplate } from "./template";
import type { ContextPack, ContextResult, Emit, GatewayResult, RouterResult, StepRecorder } from "./types";
import { getVault } from "./vault";

export { runJudges } from "./judges";
export * as store from "./store";

function newTurnId(): string {
  return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Live detokenizer for streamed chunks: holds back an unfinished "<TOKEN" tail. */
function liveDetokenizer(emit: Emit, detok: (s: string) => string) {
  let pending = "";
  let streamed = "";
  const flushUpTo = (text: string) => {
    if (!text) return;
    const out = detok(text);
    streamed += out;
    emit({ type: "token", text: out });
  };
  return {
    push(chunk: string) {
      pending += chunk;
      const lt = pending.lastIndexOf("<");
      if (lt >= 0 && pending.indexOf(">", lt) < 0 && pending.length - lt < 16) {
        flushUpTo(pending.slice(0, lt));
        pending = pending.slice(lt);
      } else {
        flushUpTo(pending);
        pending = "";
      }
    },
    end() {
      flushUpTo(pending);
      pending = "";
      return streamed;
    },
  };
}

export async function runTurn(req: ChatRequest, emit: Emit): Promise<StoredTurn | undefined> {
  const t0 = Date.now();
  const turnId = newTurnId();
  const steps: TraceStep[] = [];
  const sessionId = req.sessionId || "demo-session";
  const customerId = req.customerId || "cust_demo_01";
  const vault = getVault(sessionId, customerId);
  emit({ type: "turn", turnId });

  const step = (key: StepKey): StepRecorder => {
    const rec: TraceStep = { key, status: "pending" };
    const finish = (status: TraceStep["status"], summary: string, details?: Record<string, unknown>) => {
      rec.status = status;
      rec.summary = summary;
      rec.details = details;
      rec.durationMs = rec.startedAt ? Date.now() - rec.startedAt : 0;
      if (!steps.includes(rec)) steps.push(rec);
      emit({ type: "trace", step: { ...rec } });
      return rec;
    };
    return {
      running: (summary, details) => {
        rec.status = "running";
        rec.summary = summary;
        rec.details = details;
        rec.startedAt = Date.now();
        emit({ type: "trace", step: { ...rec } });
      },
      ok: (s, d) => finish("ok", s, d),
      blocked: (s, d) => finish("blocked", s, d),
      skipped: (s, d) => {
        if (rec.status !== "running") {
          rec.status = "running";
          rec.summary = "Verificăm dacă pasul este necesar…";
          rec.startedAt = Date.now();
          emit({ type: "trace", step: { ...rec } });
        }
        return finish("skipped", s, d);
      },
      error: (s, d) => finish("error", s, d),
    };
  };

  let branch: Branch = "ACCOUNT_QA";
  let intent: Intent = "unknown";
  let router: RouterResult | undefined;
  let ctx: ContextResult | undefined;
  let gateway: GatewayResult | undefined;
  let assistantPseudonymized = "";
  let currentStep: StepRecorder | undefined;

  try {
    // ---- 1. Input guard ----
    currentStep = step("input_guard");
    currentStep.running("Filtrăm și pseudonimizăm mesajul…");
    const guard = runInputGuard(req.message, vault);
    const guardDetails = inputGuardDetails(guard);
    if (!guard.ok) {
      branch = "BLOCKED";
      intent = "unknown";
      const why = guard.reason === "injection" ? "prompt injection detectat" : guard.reason === "too_long" ? "mesaj prea lung" : guard.reason === "empty" ? "mesaj gol" : "limbaj abuziv";
      currentStep.blocked(`Blocat: ${why}. Răspuns fix, fără LLM.`, guardDetails);
    } else {
      const piiN = Object.values(guard.stats.counts).reduce((a, b) => a + b, 0);
      currentStep.ok(piiN ? `Mesaj curat; ${piiN} ${piiN === 1 ? "dată personală înlocuită" : "date personale înlocuite"} cu tokeni (${guard.stats.tokens.join(", ")}).` : "Mesaj curat; nicio dată personală de pseudonimizat.", guardDetails);
    }

    // ---- 2. Router ----
    currentStep = step("router");
    if (branch === "BLOCKED") {
      currentStep.skipped("Sărit: mesajul a fost blocat la input guard.", { ramura: branch });
    } else {
      currentStep.running("Clasificăm mesajul (model mic)…");
      router = await runRouter(guard.tokenizedMessage, customerId, { sessionId });
      branch = router.branch;
      intent = router.intent;
      const via = router.vendor === "dialogflow" ? "Dialogflow CX" : router.vendor === "gemini" ? `Gemini (${router.model})` : router.vendor === "dev-http" ? `dev-http (${router.model})` : "reguli offline";
      currentStep.ok(`Ramură ${branch}, intenție ${intent} (încredere ${router.confidence.toFixed(2)}) — via ${via}.`, routerDetails(router));
    }
    const deterministic = branch === "ACTION" || branch === "HUMAN" || branch === "BLOCKED";
    const skipReason = branch === "BLOCKED" ? "mesaj blocat" : branch === "ACTION" ? "ramura ACTION este un flux determinist (LLM-ul nu execută nimic)" : "ramura HUMAN escaladează către un agent";

    // ---- 3. Context ----
    currentStep = step("context");
    if (deterministic || !router) {
      currentStep.skipped(`Sărit: ${skipReason}.`, { ramura: branch });
    } else {
      currentStep.running(branch === "GENERAL_QA" ? "Căutăm în informațiile publice…" : "Aducem doar datele necesare intenției…");
      ctx = runContext({ branch, intent, entities: router.entities, customerId, tokenizedMessage: guard.tokenizedMessage, vault });
      const d = contextDetails(ctx);
      currentStep.ok(
        branch === "GENERAL_QA"
          ? `${ctx.pack.knowledge?.length ?? 0} fragmente din FAQ-ul public (schema ${ctx.pack.schema}).`
          : `Pachet ${ctx.pack.schema} din ${ctx.calls.join(", ")}; pseudonimizat cu vault-ul sesiunii.`,
        d,
      );
    }

    // ---- 4. Prompt ----
    currentStep = step("prompt");
    let prompt: ReturnType<typeof buildPrompt> | undefined;
    const chain = providerChain();
    const expected = chain.find((p) => p.configured())?.vendor ?? "template";
    if (!ctx || !router) {
      currentStep.skipped(`Sărit: ${skipReason}.`, { ramura: branch });
    } else {
      currentStep.running("Asamblăm reguli + politici + context…");
      prompt = buildPrompt({ pack: ctx.pack, history: req.history ?? [], tokenizedMessage: guard.tokenizedMessage, vault });
      currentStep.ok(`Prompt ${PROMPT_VERSION}: system stabil + ${ctx.pack.policies.length} politici + context_pack + ${Math.max(0, prompt.messages.length - 2)} mesaje istoric.`, { ...prompt.stats, mode: expected, lant_furnizori: chain.map((p) => p.id) });
    }

    // ---- 5. Inference ----
    currentStep = step("inference");
    if (!prompt || !ctx || !router) {
      currentStep.skipped(`Sărit: ${skipReason}.`, { ramura: branch });
    } else {
      const off = isOffline();
      currentStep.running(off.offline ? "Fără credențiale: generăm din șablon (offline)…" : "Generăm răspunsul prin Inference Gateway…");
      const live = liveDetokenizer(emit, (s) => vault.detokenize(s));
      gateway = await generate({
        system: prompt.system,
        messages: prompt.messages,
        onToken: (t) => live.push(t),
        template: { intent, pack: ctx.pack, entities: router.entities, message: guard.tokenizedMessage },
        dialogflow: { sessionId, tokenizedMessage: guard.tokenizedMessage, pack: ctx.pack, cached: router.dialogflow },
        simulateProviderDown: Boolean(req.simulate?.providerDown),
      });
      live.end();
      const failed = gateway.attempts.filter((a) => !a.ok).map((a) => a.provider);
      const summary =
        gateway.vendor === "template"
          ? `Răspuns din șablon determinist (offline)${failed.length ? ` după eșec: ${failed.join(", ")}` : ""}.`
          : `Răspuns de la ${gateway.provider} (${gateway.model})${gateway.fallbackUsed ? ` — fallback după ${failed.join(", ")}` : ""}.`;
      currentStep.ok(summary, gatewayDetails(gateway));
    }

    // ---- 6. Output guard ----
    currentStep = step("output_guard");
    let finalText: string | undefined;
    if (!gateway || !ctx) {
      currentStep.skipped(`Sărit: ${skipReason}.`, { ramura: branch });
    } else {
      currentStep.running("Verificăm PII, tokeni, sfaturi interzise, grounding; detokenizăm…");
      const og = runOutputGuard({ text: gateway.text, pack: ctx.pack, vault, branch, intent });
      assistantPseudonymized = og.pseudonymizedText;
      finalText = og.text;
      const failedChecks = og.checks.filter((c) => !c.pass).map((c) => c.name);
      const summary = og.verdict === "pass" ? "Toate verificările au trecut; răspuns detokenizat în perimetru." : og.verdict === "warn" ? `Avertisment: ${failedChecks.join(", ")}. Răspuns ajustat și detokenizat.` : `Răspuns înlocuit cu un refuz sigur (${failedChecks.join(", ")}).`;
      (og.verdict === "fail" ? currentStep.blocked : currentStep.ok)(summary, outputGuardDetails(og));
      // Reconcile what was streamed live with the guarded final text.
      const streamedFinal = vault.detokenize(gateway.text);
      if (finalText !== streamedFinal) {
        if (finalText.startsWith(streamedFinal.trimEnd())) emit({ type: "token", text: finalText.slice(streamedFinal.trimEnd().length) });
        else emit({ type: "token", text: `\n\n${finalText}` });
      }
    }

    // ---- 7. Delivery ----
    currentStep = step("delivery");
    currentStep.running("Livrăm răspunsul…");
    const plan = planDelivery({ branch, intent, entities: router?.entities ?? {}, customerId, blockedReason: guard.ok ? undefined : guard.reason, confidence: router?.confidence ?? 0 });
    if (plan.text) {
      assistantPseudonymized = vault.tokenize(plan.text);
      await streamTemplate(plan.text, (t) => emit({ type: "token", text: t }));
    }
    if (plan.action) emit({ type: "action", action: plan.action });
    if (plan.handover) emit({ type: "handover", reason: plan.handover.reason });
    currentStep.ok(
      plan.action ? `${plan.action.kind === "handover" ? "Handover către agent" : `Card de acțiune: ${plan.action.label}`}.` : branch === "BLOCKED" ? "Răspuns fix livrat." : "Răspuns streamat în chat.",
      plan.details,
    );

    // ---- 8. Store + eval ----
    currentStep = step("store");
    currentStep.running("Salvăm tura și programăm evaluarea…");
    const totalMs = Date.now() - t0;
    const stored: StoredTurn = {
      turnId,
      sessionId,
      customerId,
      ts: new Date(t0).toISOString(),
      userMessage: guard.tokenizedMessage,
      branch,
      intent,
      routerConfidence: router?.confidence ?? (branch === "BLOCKED" ? 1 : 0),
      contextSchema: ctx?.pack.schema,
      contextPack: ctx?.pack as Record<string, unknown> | undefined,
      promptVersion: PROMPT_VERSION,
      model: gateway?.model ?? (branch === "BLOCKED" ? "input-guard" : "deterministic"),
      fallbackUsed: gateway?.fallbackUsed ?? false,
      assistantMessage: assistantPseudonymized,
      steps,
      totalMs,
    };
    saveTurn(stored);
    currentStep.ok("Tură salvată (pseudonimizat); judges rulează asincron.", { turnId, fisier: ".data/turns.json", judges: isOffline().offline ? "heuristic (offline)" : "LLM (Gemini Flash / Haiku)", latenta_ms: totalMs });
    emit({ type: "done", turnId, branch, intent, model: stored.model, totalMs });

    // fire-and-forget judges
    void runJudges(turnId).catch((err) => console.warn("[judges]", err instanceof Error ? err.message : err));
    return stored;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      currentStep?.error(`Eroare: ${message.slice(0, 200)}`, { eroare: message.slice(0, 500) });
    } catch {
      /* emit failed: stream already closed */
    }
    emit({ type: "error", message: `A apărut o eroare în pipeline: ${message.slice(0, 200)}` });
    try {
      saveTurn({
        turnId,
        sessionId,
        customerId,
        ts: new Date(t0).toISOString(),
        userMessage: vault.tokenize(req.message ?? ""),
        branch,
        intent,
        routerConfidence: router?.confidence ?? 0,
        contextSchema: ctx?.pack.schema,
        contextPack: ctx?.pack as ContextPack | undefined,
        promptVersion: PROMPT_VERSION,
        model: gateway?.model ?? "error",
        fallbackUsed: gateway?.fallbackUsed ?? false,
        assistantMessage: assistantPseudonymized || `[eroare] ${message.slice(0, 200)}`,
        steps,
        totalMs: Date.now() - t0,
      });
    } catch {
      /* ignore */
    }
    return undefined;
  }
}
