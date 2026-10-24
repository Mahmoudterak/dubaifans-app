import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { listVersions } from "@/lib/repo/scripts";
import { idParamSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  return ok({ versions: await listVersions(await getOwnerId(), id) });
});
