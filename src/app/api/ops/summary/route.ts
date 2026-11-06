/** GET /api/ops/summary → OpsSummary. */
import { connection } from "next/server";
import { summary } from "@/lib/pipeline/store";


export async function GET() {
  await connection(); // never prerender: the store changes at runtime
  return Response.json(summary());
}
