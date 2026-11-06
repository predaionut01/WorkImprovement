/** GET /api/tools/openapi.json — OpenAPI 3.0 spec for the Playbook Tool (paste into Dialogflow CX → Tools). */
import type { NextRequest } from "next/server";
import { openApiSpec } from "@/lib/pipeline/tools";


export async function GET(req: NextRequest) {
  const origin = process.env.HB_PUBLIC_URL ?? req.nextUrl.origin;
  return Response.json(openApiSpec(origin));
}
