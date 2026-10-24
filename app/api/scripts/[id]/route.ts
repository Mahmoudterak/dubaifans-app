import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams, readJson } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { deleteScript, getScript, updateScriptMeta } from "@/lib/repo/scripts";
import { idParamSchema, updateScriptSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  return ok({ script: await getScript(await getOwnerId(), id) });
});

export const PATCH = apiHandler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  const patch = await readJson(request, updateScriptSchema);
  const script = await updateScriptMeta(await getOwnerId(), id, patch);
  return ok({ script });
});

export const DELETE = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  await deleteScript(await getOwnerId(), id);
  return ok({ ok: true });
});
