"use client";

import { useState } from "react";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isObj(v: unknown): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function Prim({ v }: { v: Json }) {
  if (v === null) return <span className="text-ink-faint">null</span>;
  if (typeof v === "string") return <span className="text-success break-all">&quot;{v}&quot;</span>;
  if (typeof v === "number") return <span className="text-info">{v}</span>;
  if (typeof v === "boolean") return <span className="text-purple-600">{String(v)}</span>;
  return null;
}

function Node({ k, v, depth }: { k?: string; v: Json; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const composite = Array.isArray(v) || isObj(v);
  const entries: [string, Json][] = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : isObj(v) ? Object.entries(v) : [];
  const label = k !== undefined ? <span className="text-ink">{k}: </span> : null;

  if (!composite) {
    return (
      <div className="pl-3">
        {label}
        <Prim v={v} />
      </div>
    );
  }
  const brackets = Array.isArray(v) ? ["[", "]"] : ["{", "}"];
  const count = entries.length;
  return (
    <div className="pl-3">
      <button type="button" className="cursor-pointer select-none text-left hover:bg-surface-2 rounded px-0.5" onClick={() => setOpen((o) => !o)}>
        <span className="inline-block w-3 text-ink-faint">{open ? "▾" : "▸"}</span>
        {label}
        <span className="text-ink-muted">
          {brackets[0]}
          {!open && <span className="text-ink-faint"> {count} {Array.isArray(v) ? "elem." : "chei"} </span>}
          {!open && brackets[1]}
        </span>
      </button>
      {open && (
        <div className="border-l border-line ml-1.5">
          {entries.map(([ck, cv]) => (
            <Node key={ck} k={ck} v={cv} depth={depth + 1} />
          ))}
          <div className="text-ink-muted pl-3">{brackets[1]}</div>
        </div>
      )}
    </div>
  );
}

export function JsonViewer({ value, className = "" }: { value: unknown; className?: string }) {
  let json: Json;
  try {
    json = JSON.parse(JSON.stringify(value ?? null)) as Json;
  } catch {
    json = String(value);
  }
  return (
    <div className={`rounded-lg bg-surface px-2 py-1.5 font-mono text-[11px] leading-5 text-ink ${className}`}>
      <Node v={json} depth={0} />
    </div>
  );
}
