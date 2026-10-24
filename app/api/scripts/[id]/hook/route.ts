import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams } from "@/lib/api";
import { regenerateHookAndSave } from "@/lib/services/scripts";
import { idParamSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 90;

/** يغيّر الافتتاحية فقط ويترك باقي السكريبت كما هو */
export const POST = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  return ok({ script: await regenerateHookAndSave(id) });
});
