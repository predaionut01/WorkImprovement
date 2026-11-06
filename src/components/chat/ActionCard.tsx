"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChatAction } from "@/lib/types";
import { useBank } from "@/lib/ui/bank-store";
import { Button } from "@/components/ui/Button";
import { IconArrowRight, IconLock, IconUser } from "@/components/ui/Icons";
import type { ChatItem } from "./types";

type ActionItem = Extract<ChatItem, { kind: "action" }>;

function str(p: Record<string, unknown> | undefined, k: string): string | undefined {
  const v = p?.[k];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
}

export function ActionCard({
  item,
  onState,
  onSystem,
}: {
  item: ActionItem;
  onState: (state: ActionItem["state"]) => void;
  onSystem: (text: string, tone?: "info" | "error" | "success" | "warning") => void;
}) {
  const { cardAction, data } = useBank();
  const [err, setErr] = useState<string | null>(null);
  const a: ChatAction = item.action;
  const payload = a.payload;

  if (a.kind === "confirm_card_block" || a.kind === "confirm_card_unblock") {
    const block = a.kind === "confirm_card_block";
    const cardId = str(payload, "cardId") ?? "";
    const last4 = str(payload, "last4") ?? data?.cards.find((c) => c.id === cardId)?.last4 ?? "????";
    const done = item.state === "done";
    const dismissed = item.state === "dismissed";
    const confirm = async () => {
      if (!cardId) {
        setErr("Lipsește cardId în acțiune.");
        return;
      }
      onState("busy");
      setErr(null);
      try {
        await cardAction(cardId, block ? "block" : "unblock");
        onState("done");
        onSystem(`Card ••••${last4} ${block ? "blocat" : "deblocat"}.`, "success");
      } catch (e) {
        setErr((e as Error).message);
        onState("open");
      }
    };
    return (
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-4 shadow-card hb-pop">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${block ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
            <IconLock size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {block ? "Blochezi" : "Deblochezi"} cardul ••••{last4}?
            </p>
            <p className="text-[11px] text-ink-muted">Acțiune deterministă, executată de fluxul clasic Home&apos;Bank după confirmare.</p>
          </div>
        </div>
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <div className="mt-3 flex gap-2">
          {done ? (
            <span className="text-xs font-semibold text-success">Confirmat · card {block ? "blocat" : "deblocat"}</span>
          ) : dismissed ? (
            <span className="text-xs font-semibold text-ink-muted">Anulat</span>
          ) : (
            <>
              <Button size="sm" variant={block ? "danger" : "primary"} loading={item.state === "busy"} onClick={confirm}>
                Confirmă
              </Button>
              <Button size="sm" variant="secondary" disabled={item.state === "busy"} onClick={() => onState("dismissed")}>
                Renunță
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (a.kind === "open_section") {
    const route = str(payload, "route") ?? str(payload, "href") ?? str(payload, "path") ?? "/";
    return (
      <Link href={route} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ing-orange-dark shadow-card hover:bg-ing-orange-soft hb-pop">
        {a.label || "Deschide secțiunea"}
        <IconArrowRight size={16} />
      </Link>
    );
  }

  // handover
  const queue = str(payload, "queuePosition") ?? "3";
  const wait = str(payload, "waitMinutes") ?? "4";
  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-white p-4 shadow-card hb-pop">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ing-orange-soft text-ing-orange">
          <IconUser size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold">Te conectez cu un coleg</p>
          <p className="text-[11px] text-ink-muted">{a.label || "Transcriptul și contextul (pseudonimizat) merg către agent."}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs">
        <span>
          Poziție în coadă: <strong>{queue}</strong>
        </span>
        <span className="text-ink-muted">~{wait} min (simulare)</span>
      </div>
    </div>
  );
}
