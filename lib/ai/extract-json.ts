import { AppError } from "../errors";

/**
 * يستخرج أول كائن JSON من رد النموذج، حتى لو لفّه بعلامات markdown أو كلام زيادة.
 * يرمي AppError بكود AI_INVALID_OUTPUT إذا لم يجد JSON صالحًا.
 */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AppError("AI_INVALID_OUTPUT", "رد النموذج ما فيهوش JSON.");
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AppError("AI_INVALID_OUTPUT", "رد النموذج فيه JSON غير صالح.");
  }
}
