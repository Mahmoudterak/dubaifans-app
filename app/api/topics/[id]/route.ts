import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { deleteTopic } from "@/lib/repo/topics";
import { idParamSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  await deleteTopic(await getOwnerId(), id);
  return ok({ ok: true });
});
