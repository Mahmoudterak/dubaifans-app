import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { listScripts } from "@/lib/repo/scripts";
import { listScriptsQuerySchema } from "@/lib/validation";
import { AppError } from "@/lib/errors";

export const GET = apiHandler(async (request: NextRequest) => {
  const parsed = listScriptsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "فلتر غير صالح");
  const userId = await getOwnerId();
  return ok({ scripts: await listScripts(userId, parsed.data) });
});
