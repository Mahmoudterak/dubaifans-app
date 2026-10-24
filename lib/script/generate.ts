import type { AiProvider } from "../ai/provider";
import { extractJsonObject } from "../ai/extract-json";
import { AppError } from "../errors";
import { runQualityChecks, type QualityReport } from "./quality";
import {
  buildGenerationPrompt,
  buildHookPrompt,
  buildRevisionPrompt,
  type GenerationRequest,
  type StyleProfile,
} from "./prompt";
import {
  fullTextOf,
  hookOnlySchema,
  normalizeOutput,
  scriptOutputSchema,
  type HookOnlyOutput,
  type ScriptOutput,
} from "./output-schema";

export interface ScriptResult {
  output: ScriptOutput;
  fullText: string;
  quality: QualityReport;
}

const MAX_ATTEMPTS = 2;

/**
 * يطلب من النموذج JSON ويتحقق منه بالمخطط. إذا فشل التحقق يعيد الطلب مرة واحدة
 * مع توضيح سبب الفشل، ثم يرفض إذا تكرر الخطأ.
 */
async function requestValidated<T>(
  provider: AiProvider,
  system: string,
  user: string,
  parse: (value: unknown) => T,
): Promise<T> {
  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt =
      attempt === 1
        ? user
        : `${user}\n\nملاحظة: ردك السابق ما كانش مطابق للمطلوب (${lastProblem}). أعد JSON صالح كامل بالمفاتيح المطلوبة فقط.`;

    const raw = await provider.complete({ system, user: prompt });
    try {
      return parse(extractJsonObject(raw));
    } catch (error) {
      if (error instanceof AppError && error.code !== "AI_INVALID_OUTPUT") throw error;
      lastProblem = error instanceof AppError ? error.message : "الصيغة غير مطابقة";
    }
  }
  throw new AppError("AI_INVALID_OUTPUT", "المزود رجّع نتيجة بصيغة غير صالحة أكتر من مرة. جرّب تاني أو غيّر الصياغة.");
}

function parseOutput(value: unknown): ScriptOutput {
  const result = scriptOutputSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError("AI_INVALID_OUTPUT", `الحقل ${first?.path.join(".") || "?"} غير مطابق: ${first?.message ?? ""}`);
  }
  return normalizeOutput(result.data);
}

function parseHooks(value: unknown): HookOnlyOutput {
  const result = hookOnlySchema.safeParse(value);
  if (!result.success) throw new AppError("AI_INVALID_OUTPUT", "صيغة الافتتاحيات غير مطابقة.");
  return result.data;
}

function finish(output: ScriptOutput, durationSeconds: number): ScriptResult {
  return {
    output,
    fullText: fullTextOf(output),
    quality: runQualityChecks(output, durationSeconds),
  };
}

export async function generateScript(
  provider: AiProvider,
  request: GenerationRequest,
  style: StyleProfile,
): Promise<ScriptResult> {
  const { system, user } = buildGenerationPrompt(request, style);
  const output = await requestValidated(provider, system, user, parseOutput);
  return finish(output, request.durationSeconds);
}

export async function reviseScript(
  provider: AiProvider,
  current: ScriptOutput,
  instruction: string,
  style: StyleProfile,
  durationSeconds: number,
): Promise<ScriptResult> {
  const { system, user } = buildRevisionPrompt(current, instruction, style, durationSeconds);
  const output = await requestValidated(provider, system, user, parseOutput);
  return finish(output, durationSeconds);
}

/** يعيد كتابة الافتتاحية فقط، ويترك باقي السكريبت كما هو */
export async function regenerateHook(
  provider: AiProvider,
  current: ScriptOutput,
  style: StyleProfile,
  durationSeconds: number,
  recentHooks: string[] = [],
): Promise<ScriptResult> {
  const { system, user } = buildHookPrompt(current, style, recentHooks);
  const hooks = await requestValidated(provider, system, user, parseHooks);
  return finish(applyHookOnly(current, hooks), durationSeconds);
}

/**
 * يدمج الافتتاحيات الجديدة في السكريبت: تُستبدل الافتتاحية المرشّحة ونص المقطع الأول،
 * وباقي المقاطع لا تتغير.
 */
export function applyHookOnly(current: ScriptOutput, hooks: HookOnlyOutput): ScriptOutput {
  const chosen = hooks.hooks[hooks.recommendedHookIndex];
  const [first, ...rest] = current.segments;
  if (!chosen || !first) return current;
  return {
    ...current,
    hooks: hooks.hooks,
    recommendedHookIndex: hooks.recommendedHookIndex,
    segments: [{ ...first, text: chosen.text }, ...rest],
  };
}
