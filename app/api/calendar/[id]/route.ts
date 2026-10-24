import type { NextRequest } from "next/server";
import { apiHandler, ok, parseParams, readJson } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { deleteCalendarItem, updateCalendarStatus } from "@/lib/repo/calendar-feedback";
import { calendarPatchSchema, idParamSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiHandler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  const body = await readJson(request, calendarPatchSchema);
  await updateCalendarStatus(await getOwnerId(), id, body.status);
  return ok({ ok: true });
});

export const DELETE = apiHandler(async (_request: NextRequest, ctx: Ctx) => {
  const { id } = parseParams(idParamSchema, await ctx.params);
  await deleteCalendarItem(await getOwnerId(), id);
  return ok({ ok: true });
});
