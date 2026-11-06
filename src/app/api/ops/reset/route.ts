/** POST /api/ops/reset → clears the conversation store, vaults and remembered vendor outages. */
import { resetOffline } from "@/lib/pipeline/llm";
import { reset } from "@/lib/pipeline/store";
import { resetVaults } from "@/lib/pipeline/vault";


export async function POST() {
  await reset();
  resetVaults();
  resetOffline();
  return Response.json({ ok: true });
}
