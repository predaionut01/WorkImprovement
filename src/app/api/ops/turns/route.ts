/** GET /api/ops/turns → StoredTurn[] newest first. */
import { connection } from "next/server";
import { list } from "@/lib/pipeline/store";


export async function GET() {
  await connection(); // never prerender: the store changes at runtime
  return Response.json(list());
}
