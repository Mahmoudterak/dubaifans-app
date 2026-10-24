import { z } from "zod";
import {
  CTA_TYPES,
  GOALS,
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  MODES,
  PLATFORMS,
  REVISION_PRESETS,
  type CtaType,
  type GoalKey,
  type ModeKey,
  type PlatformKey,
  type RevisionPresetKey,
} from "./script/catalog";

/** مخططات التحقق من مدخلات الـ API. كل ما يدخل النظام يمر من هنا. */

const uuid = z.uuid("المعرّف غير صالح");

const modeKeys = MODES.map((m) => m.key) as [ModeKey, ...ModeKey[]];
const goalKeys = GOALS.map((g) => g.key) as [GoalKey, ...GoalKey[]];
const ctaKeys = CTA_TYPES.map((c) => c.key) as [CtaType, ...CtaType[]];
const platformKeys = PLATFORMS.map((p) => p.key) as [PlatformKey, ...PlatformKey[]];
const presetKeys = REVISION_PRESETS.map((p) => p.key) as [RevisionPresetKey, ...RevisionPresetKey[]];

const statusSchema = z.enum(["draft", "approved", "scheduled", "published"]);

export const idParamSchema = z.object({ id: uuid });
export const versionParamSchema = z.object({ id: uuid, versionId: uuid });

export const generateScriptSchema = z
  .object({
    input: z.string().trim().min(3, "اكتب موضوع أو موقف يكون أوضح من كده").max(2000),
    inputKind: z.enum(["topic", "question", "situation"]).default("topic"),
    mode: z.enum(modeKeys),
    goal: z.enum(goalKeys),
    durationSeconds: z.number().int().min(MIN_DURATION_SECONDS).max(MAX_DURATION_SECONDS),
    ctaType: z.enum(ctaKeys),
    platform: z.enum(platformKeys).nullish(),
    topicId: uuid.nullish(),
    useMyVoice: z.boolean().default(false),
  })
  .transform((value) => ({ ...value, platform: value.platform ?? null, topicId: value.topicId ?? null }));

export type GenerateScriptInput = z.infer<typeof generateScriptSchema>;

export const reviseScriptSchema = z
  .object({
    presetKey: z.enum(presetKeys).optional(),
    instruction: z.string().trim().max(500).optional(),
  })
  .refine((value) => Boolean(value.presetKey || value.instruction), {
    message: "اختار تعديل جاهز أو اكتب تعليمة",
  });

export const updateScriptSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    status: statusSchema.optional(),
    platform: z.enum(platformKeys).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "لا يوجد تغيير لحفظه" });

export const listScriptsQuerySchema = z.object({
  status: statusSchema.optional(),
  search: z.string().max(100).optional(),
});

export const topicSchema = z.object({
  category: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2, "عنوان الموضوع قصير").max(200),
  notes: z.string().trim().max(1000).default(""),
});

export const topicQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
});

export const categorySchema = z.object({
  label: z.string().trim().min(2, "اسم التصنيف قصير").max(160),
});

export const preferencesSchema = z.object({
  dialect: z.enum(["egyptian", "msa_simple"]),
  tone: z.enum(["direct", "warm", "calm"]),
  defaultDurationSeconds: z.number().int().min(MIN_DURATION_SECONDS).max(MAX_DURATION_SECONDS),
  defaultCtaType: z.enum(["none", "soft", "consult"]),
  signaturePhrases: z.string().max(1000).default(""),
  avoidPhrases: z.string().max(1000).default(""),
  styleSamples: z.string().max(8000).default(""),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(1000).default(""),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ لازم يكون بصيغة YYYY-MM-DD");

export const calendarRangeSchema = z.object({
  from: isoDate,
  to: isoDate,
});

export const calendarCreateSchema = z.object({
  plannedDate: isoDate,
  platform: z.enum(platformKeys),
  pillar: z.enum(goalKeys).default("awareness"),
  note: z.string().trim().max(500).default(""),
  scriptId: uuid.nullish(),
});

export const calendarPatchSchema = z.object({
  status: z.enum(["planned", "published", "skipped"]),
});

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});
