import type { NextRequest } from "next/server";
import { apiHandler, ok, readJson } from "@/lib/api";
import { generateAndSave } from "@/lib/services/scripts";
import { generateScriptSchema } from "@/lib/validation";

// التوليد قد يستغرق عدة ثواني، لذلك نرفع حد التنفيذ على الخادم
export const maxDuration = 90;

export const POST = apiHandler(async (request: NextRequest) => {
  const input = await readJson(request, generateScriptSchema);
  const script = await generateAndSave(input);
  return ok({ script }, 201);
});
