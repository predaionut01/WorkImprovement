/**
 * Tiny public-FAQ retrieval over the markdown files in this folder.
 * Chunk = one "## " section. Scoring = BM25-lite over diacritics-stripped,
 * prefix-stemmed terms. Every retrieved chunk is run through the injection
 * detector before it can reach the prompt.
 */
import fs from "node:fs";
import path from "node:path";
import { detectInjection } from "@/lib/pipeline/injection";
import { stripDiacritics } from "@/lib/pipeline/format";
import type { KnowledgeHit } from "@/lib/pipeline/types";

export interface Chunk {
  file: string;
  title: string;
  text: string;
  terms: string[];
}

const STOP = new Set([
  "care", "cum", "este", "sunt", "pentru", "din", "intr", "despre", "poti", "pot", "are", "sau", "dar", "mai", "fara", "cu", "la", "de", "pe", "si", "un", "o", "in", "ce", "ca", "sa", "se", "nu", "imi", "meu", "mea", "mele", "asta", "aceasta", "acest", "aceste", "unde", "cand", "the", "and", "for", "what", "how", "lei", "ron", "eur",
]);

export function termsOf(text: string): string[] {
  return stripDiacritics(text.toLowerCase())
    .replace(/<[a-z]+_\d+>/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => (w.length >= 3 || /^\d{2}$/.test(w)) && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w));
}

let cache: Chunk[] | null = null;

export function knowledgeDir(): string {
  return path.join(process.cwd(), "src", "lib", "knowledge");
}

export function loadChunks(): Chunk[] {
  if (cache) return cache;
  const dir = knowledgeDir();
  const chunks: Chunk[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    files = [];
  }
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const h1 = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file;
    const sections = raw.split(/^##\s+/m).slice(1);
    for (const s of sections) {
      const [titleLine, ...rest] = s.split("\n");
      const text = rest.join("\n").trim();
      if (!text) continue;
      const title = `${h1} › ${titleLine.trim()}`;
      chunks.push({ file, title, text, terms: termsOf(`${title}\n${text}`) });
    }
  }
  cache = chunks;
  return chunks;
}

export function resetKnowledgeCache() {
  cache = null;
}

export interface RetrievalResult {
  hits: KnowledgeHit[];
  /** chunks dropped because they tripped the injection detector */
  injectionDropped: number;
  query: string;
}

export function retrieve(query: string, k = 3): RetrievalResult {
  const chunks = loadChunks();
  const q = [...new Set(termsOf(query))];
  const N = chunks.length || 1;
  const avgLen = chunks.reduce((a, c) => a + c.terms.length, 0) / N || 1;
  const k1 = 1.2;
  const b = 0.75;
  const df = new Map<string, number>();
  for (const t of q) df.set(t, chunks.filter((c) => c.terms.includes(t)).length);

  const scored = chunks.map((c) => {
    let score = 0;
    for (const t of q) {
      const tf = c.terms.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (c.terms.length / avgLen))));
    }
    return { c, score };
  });
  scored.sort((a, b2) => b2.score - a.score);

  let injectionDropped = 0;
  const hits: KnowledgeHit[] = [];
  for (const { c, score } of scored) {
    if (hits.length >= k) break;
    if (score <= 0 && hits.length > 0) break;
    if (detectInjection(c.text).hit) {
      injectionDropped++;
      continue;
    }
    hits.push({ file: c.file, title: c.title, text: c.text, score: Number(score.toFixed(3)) });
  }
  return { hits, injectionDropped, query: q.join(" ") };
}
