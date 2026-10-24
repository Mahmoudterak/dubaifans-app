import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams, readJson } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { addFeedback, listFeedback } from "@/lib/repo/calendar-feedback";
import { idParamSchema, feedbackSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  return ok({ feedback: await listFeedback(await getOwnerId(), id) });
});

export const POST = apiHandler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  const body = await readJson(request, feedbackSchema);
  const item = await addFeedback(await getOwnerId(), id, body.rating, body.note);
  return ok({ feedback: item }, 201);
});
