import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams, readJson } from "@/lib/api";
import { reviseAndSave } from "@/lib/services/scripts";
import { idParamSchema, reviseScriptSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 90;

export const POST = apiHandler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  const body = await readJson(request, reviseScriptSchema);
  const script = await reviseAndSave(id, body);
  return ok({ script });
});
