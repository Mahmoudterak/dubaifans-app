import type { NextRequest } from "next/server";
import { apiHandler, ok, readJson } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { addCalendarItem, listCalendar } from "@/lib/repo/calendar-feedback";
import { AppError } from "@/lib/errors";
import { calendarCreateSchema, calendarRangeSchema } from "@/lib/validation";

export const GET = apiHandler(async (request: NextRequest) => {
  const parsed = calendarRangeSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "حدد فترة صالحة بالتاريخين from و to");
  const items = await listCalendar(await getOwnerId(), parsed.data.from, parsed.data.to);
  return ok({ items });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request, calendarCreateSchema);
  const id = await addCalendarItem(await getOwnerId(), {
    plannedDate: body.plannedDate,
    platform: body.platform,
    pillar: body.pillar,
    note: body.note,
    scriptId: body.scriptId ?? null,
  });
  return ok({ id }, 201);
});
