import { getAiProvider, type AiProvider, type FetchLike } from "../ai/provider";
import { AppError } from "../errors";
import { findMode, REVISION_PRESETS, type CtaType, type GoalKey, type ModeKey, type PlatformKey } from "../script/catalog";
import { generateScript, regenerateHook, reviseScript, type ScriptResult } from "../script/generate";
import { runQualityChecks } from "../script/quality";
import { getOwnerId } from "../db/owner";
import { getTopic } from "../repo/topics";
import { getPreferences } from "../repo/preferences";
import {
  addVersion,
  createScript,
  getScript,
  getVersion,
  listScriptDetails,
  type ScriptDetail,
} from "../repo/scripts";
import { generationLimiter } from "../limits";

/**
 * منطق الأعمال الذي يربط التوليد بالتخزين. المسارات تستدعي هذه الدوال فقط.
 * مزود الذكاء الاصطناعي يُمرَّر من الخارج ليسهل اختباره بمزود وهمي.
 */

export interface ServiceDeps {
  provider?: AiProvider;
  fetchImpl?: FetchLike;
  userId?: string;
}

async function resolveProvider(deps: ServiceDeps): Promise<AiProvider> {
  return deps.provider ?? getAiProvider(process.env, deps.fetchImpl);
}

async function resolveUser(deps: ServiceDeps): Promise<string> {
  return deps.userId ?? (await getOwnerId());
}

function enforceGenerationLimit(userId: string): void {
  const result = generationLimiter().hit(userId);
  if (!result.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      `وصلت للحد الأقصى من طلبات التوليد. استنى ${Math.ceil(result.retryAfterSeconds / 60)} دقيقة وجرّب تاني.`,
    );
  }
}

export interface CreateScriptParams {
  input: string;
  inputKind: "topic" | "question" | "situation";
  mode: ModeKey;
  goal: GoalKey;
  durationSeconds: number;
  ctaType: CtaType;
  platform: PlatformKey | null;
  topicId: string | null;
  useMyVoice: boolean;
}

export async function generateAndSave(params: CreateScriptParams, deps: ServiceDeps = {}): Promise<ScriptDetail> {
  const userId = await resolveUser(deps);
  const mode = findMode(params.mode);
  if (!mode) throw new AppError("VALIDATION_FAILED", "الوضع المختار غير معروف");

  // التحقق من الإعدادات قبل استهلاك حصة التوليد
  const provider = await resolveProvider(deps);
  enforceGenerationLimit(userId);

  const [style, topic, recent] = await Promise.all([
    getPreferences(userId),
    params.topicId ? getTopic(userId, params.topicId) : Promise.resolve(null),
    listScriptDetails(userId, 10),
  ]);

  if (params.topicId && !topic) throw new AppError("NOT_FOUND", "الموضوع المختار غير موجود في المكتبة");

  const result = await generateScript(
    provider,
    {
      input: params.input,
      inputKind: params.inputKind,
      mode: params.mode,
      goal: params.goal,
      durationSeconds: params.durationSeconds,
      ctaType: params.ctaType,
      platform: params.platform ?? undefined,
      topicTitle: topic?.title,
      categoryLabel: topic?.category,
      recentHooks: recent.map((script) => script.chosenHook).filter(Boolean).slice(0, 10),
      useMyVoice: params.useMyVoice,
    },
    style,
  );

  return createScript(userId, {
    title: result.output.title,
    inputText: params.input,
    inputKind: params.inputKind,
    topicId: params.topicId,
    mode: params.mode,
    goal: params.goal,
    durationSeconds: params.durationSeconds,
    ctaType: params.ctaType,
    platform: params.platform,
    content: result.output,
    fullText: result.fullText,
    qualityScore: result.quality.score,
    qualityWarnings: result.quality.warnings,
  });
}

function resultToVersionInput(result: ScriptResult, instruction: string | null) {
  return {
    content: result.output,
    fullText: result.fullText,
    qualityScore: result.quality.score,
    qualityWarnings: result.quality.warnings,
    instruction,
  };
}

export async function reviseAndSave(
  scriptId: string,
  params: { presetKey?: string; instruction?: string },
  deps: ServiceDeps = {},
): Promise<ScriptDetail> {
  const userId = await resolveUser(deps);
  const provider = await resolveProvider(deps);
  const script = await getScript(userId, scriptId);
  enforceGenerationLimit(userId);

  const preset = params.presetKey ? REVISION_PRESETS.find((p) => p.key === params.presetKey) : undefined;
  const instruction = preset?.instruction ?? params.instruction?.trim() ?? "";
  if (!instruction) throw new AppError("VALIDATION_FAILED", "التعليمة فاضية");

  const style = await getPreferences(userId);
  const result = await reviseScript(provider, script.content, instruction, style, script.durationSeconds);
  return addVersion(userId, scriptId, resultToVersionInput(result, instruction));
}

export async function regenerateHookAndSave(scriptId: string, deps: ServiceDeps = {}): Promise<ScriptDetail> {
  const userId = await resolveUser(deps);
  const provider = await resolveProvider(deps);
  const script = await getScript(userId, scriptId);
  enforceGenerationLimit(userId);

  const [style, recent] = await Promise.all([getPreferences(userId), listScriptDetails(userId, 10)]);
  const recentHooks = recent.map((item) => item.chosenHook).filter(Boolean).slice(0, 10);

  const result = await regenerateHook(provider, script.content, style, script.durationSeconds, recentHooks);
  return addVersion(userId, scriptId, resultToVersionInput(result, "تغيير الافتتاحية فقط"));
}

/** يستعيد نسخة سابقة كنسخة جديدة، فلا نفقد أي إصدار */
export async function restoreVersionAndSave(scriptId: string, versionId: string, deps: ServiceDeps = {}): Promise<ScriptDetail> {
  const userId = await resolveUser(deps);
  const version = await getVersion(userId, scriptId, versionId);
  const script = await getScript(userId, scriptId);
  const quality = runQualityChecks(version.content, script.durationSeconds);
  return addVersion(userId, scriptId, {
    content: version.content,
    fullText: version.fullText,
    qualityScore: quality.score,
    qualityWarnings: quality.warnings,
    instruction: `استعادة الإصدار ${version.versionNumber}`,
  });
}
