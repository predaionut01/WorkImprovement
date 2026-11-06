/**
 * Prompt-injection / abuse detector (RO + EN). Used on the user message and on
 * every knowledge chunk pulled in by retrieval.
 */
import { stripDiacritics } from "./format";

interface Pattern {
  id: string;
  re: RegExp;
}

// Patterns run on a diacritics-stripped, lower-cased copy of the text.
const INJECTION_PATTERNS: Pattern[] = [
  { id: "ignore_rules_ro", re: /ignor[aă]?\s+(toate\s+)?(regulile|instructiunile|restrictiile|politicile)/ },
  { id: "ignore_rules_en", re: /ignore\s+(all\s+)?(the\s+)?(previous|prior|above|your|system)?\s*(instructions|rules|prompts?|guidelines)/ },
  { id: "disregard_en", re: /disregard\s+(all\s+)?(previous|prior|your)\s+(instructions|rules)/ },
  { id: "system_prompt", re: /(system\s*prompt|promptul\s+de\s+sistem|instructiunile\s+(tale\s+)?de\s+sistem)/ },
  { id: "reveal_instructions", re: /(arata|afiseaza|spune|repeta|print|reveal|show|dump)[\w\s-]{0,20}(instructiunile|regulile|promptul|prompt|instructions|rules)/ },
  { id: "all_customers_ro", re: /(toti|tuturor|toate)\s+(clientii|clientilor|utilizatorii|utilizatorilor|conturile|conturilor)/ },
  { id: "all_customers_en", re: /(all|every|other)\s+(customers?|users?|clients?|accounts)/ },
  { id: "other_customer", re: /(alt(ui)?\s+client|contul\s+(lui|altcuiva)|another\s+(customer|user))/ },
  { id: "jailbreak", re: /jailbreak|\bdan\s+mode\b|do\s+anything\s+now|developer\s+mode|god\s+mode/ },
  { id: "role_override_ro", re: /(esti|devii|te\s+prefaci|comporta-te|actioneaza)\s+(acum\s+)?(ca\s+)?(un\s+|o\s+)?(admin|administrator|dezvoltator|developer|root|operator\s+de\s+sistem|ai\s+fara\s+restrictii)/ },
  { id: "role_override_en", re: /(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are)|role-?play\s+as)\s+(an?\s+)?(admin|administrator|developer|root|unrestricted|jailbroken)/ },
  { id: "new_instructions", re: /(new|updated|override)\s+(instructions|rules)|instructiuni\s+noi|de\s+acum\s+(inainte\s+)?(regulile|instructiunile)/ },
  { id: "forget_rules", re: /(uita|forget)\s+(tot\s+ce|everything|all|regulile|the\s+rules)/ },
  { id: "sql_or_code", re: /(select\s+\*\s+from|drop\s+table|<script|\bexec\(|eval\()/ },
  { id: "base64_blob", re: /\b[a-z0-9+/]{60,}={0,2}\b/ },
  { id: "hidden_markup", re: /<\/?(system|instruction|admin|assistant)>|\[inst\]|\[\/inst\]|<\|im_start\|>/ },
];

const ABUSE_WORDS = ["idiot", "prost", "proasta", "tampit", "tampita", "dobitoc", "nenorocit", "bou", "jigodie", "fuck", "shit", "bitch", "idiots", "stupid", "morons"];

export interface InjectionVerdict {
  hit: boolean;
  patterns: string[];
}

export function normalizeForDetection(text: string): string {
  return stripDiacritics(text.toLowerCase()).replace(/\s+/g, " ");
}

export function detectInjection(text: string): InjectionVerdict {
  const t = normalizeForDetection(text);
  const patterns = INJECTION_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.id);
  return { hit: patterns.length > 0, patterns };
}

export function detectAbuse(text: string): { hit: boolean; count: number } {
  const t = normalizeForDetection(text);
  const words = t.split(/[^a-z0-9]+/);
  const count = words.filter((w) => ABUSE_WORDS.includes(w)).length;
  return { hit: count > 0, count };
}
