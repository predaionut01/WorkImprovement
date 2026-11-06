/** POST /api/ops/judge {turnId?} → run judges for that turn or all unjudged; returns updated StoredTurn[]. */
import type { NextRequest } from "next/server";
import { runJudges } from "@/lib/pipeline/judges";


export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { turnId?: unknown };
  const turnId = typeof body.turnId === "string" && body.turnId ? body.turnId : undefined;
  try {
    return Response.json(await runJudges(turnId));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
