import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams } from "@/lib/api";
import { restoreVersionAndSave } from "@/lib/services/scripts";
import { versionParamSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export const POST = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id, versionId } = parseParams(versionParamSchema, await ctx.params);
  return ok({ script: await restoreVersionAndSave(id, versionId) });
});
