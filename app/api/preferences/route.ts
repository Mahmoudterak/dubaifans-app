import type { NextRequest } from "next/server";
import { apiHandler, ok, readJson } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { getPreferences, savePreferences } from "@/lib/repo/preferences";
import { preferencesSchema } from "@/lib/validation";

export const GET = apiHandler(async () => {
  return ok({ preferences: await getPreferences(await getOwnerId()) });
});

export const PUT = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request, preferencesSchema);
  return ok({ preferences: await savePreferences(await getOwnerId(), body) });
});
