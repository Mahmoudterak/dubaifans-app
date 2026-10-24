import { z } from "zod";

/**
 * المخطط الصارم لمخرجات النموذج. أي رد لا يطابقه يُرفض ويُعاد طلبه مرة واحدة.
 * الحقول كلها بالعربية كما ستظهر للمستخدم، والمفاتيح بالإنجليزية للتعامل البرمجي.
 */

export const hookSchema = z.object({
  text: z.string().trim().min(5).max(300),
  reason: z.string().trim().max(300).default(""),
});

export const segmentSchema = z.object({
  label: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(2000),
  emphasis: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  delivery: z.string().trim().max(200).default(""),
});

const score = z.number().int().min(1).max(5);

export const selfReviewSchema = z.object({
  psychologicalAccuracy: score,
  balance: score,
  clarity: score,
  dialect: score,
  misleadingRisk: z.enum(["low", "medium", "high"]),
  notes: z.array(z.string().trim().max(300)).max(10).default([]),
});

export const scriptOutputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  psychCategory: z.string().trim().min(2).max(160),
  angle: z.string().trim().min(2).max(300),
  hooks: z.array(hookSchema).length(3),
  recommendedHookIndex: z.number().int().min(0).max(2),
  segments: z.array(segmentSchema).min(2).max(12),
  coverText: z.string().trim().min(2).max(80),
  caption: z.string().trim().min(2).max(2200),
  cta: z.string().trim().max(300).nullable(),
  interactiveQuestion: z.string().trim().min(2).max(200),
  keywords: z.array(z.string().trim().min(1).max(60)).max(15),
  hashtags: z.array(z.string().trim().min(2).max(60)).max(15),
  deliveryNotes: z.array(z.string().trim().min(1).max(300)).max(10),
  selfReview: selfReviewSchema,
});

export type ScriptOutput = z.infer<typeof scriptOutputSchema>;
export type ScriptSegment = z.infer<typeof segmentSchema>;
export type ScriptHook = z.infer<typeof hookSchema>;

/** المخطط الخاص بإعادة كتابة الافتتاحية فقط */
export const hookOnlySchema = z.object({
  hooks: z.array(hookSchema).length(3),
  recommendedHookIndex: z.number().int().min(0).max(2),
});

export type HookOnlyOutput = z.infer<typeof hookOnlySchema>;

/**
 * يحوّل مخرجات النموذج إلى نص منطوق متصل. الافتتاحية هي المقطع الأول دائمًا،
 * ولذلك نضبط نصه على الـ hook المرشّح حتى تتطابق الفكرتان.
 */
export function normalizeOutput(output: ScriptOutput): ScriptOutput {
  const chosen = output.hooks[output.recommendedHookIndex];
  if (!chosen) return output;
  const [first, ...rest] = output.segments;
  if (!first) return output;
  return {
    ...output,
    segments: [{ ...first, text: chosen.text }, ...rest],
  };
}

export function fullTextOf(output: Pick<ScriptOutput, "segments">): string {
  return output.segments.map((segment) => segment.text).join("\n");
}
