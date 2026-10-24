/**
 * تقدير مدة الإلقاء بالعربية.
 * متوسط الكلام الطبيعي حوالي 2.4 كلمة في الثانية، ونضيف 10% للوقفات والتنفس.
 * المدة الفعلية تختلف حسب الأداء، فنعطي نطاقًا بدل رقم قاطع.
 */

export const WORDS_PER_SECOND = 2.4;
const PAUSE_ALLOWANCE = 1.1;

export function countWords(text: string): number {
  // نحذف التشكيل أولًا حتى لا تنكسر الكلمة المشكولة لكلمتين، ثم نستبدل الترقيم بمسافات
  const cleaned = text
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

export function estimateSpeakingSeconds(text: string): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.round((words / WORDS_PER_SECOND) * PAUSE_ALLOWANCE);
}

/** عدد الكلمات المناسب تقريبًا لمدة مستهدفة */
export function targetWordCount(targetSeconds: number): number {
  return Math.round((targetSeconds * WORDS_PER_SECOND) / PAUSE_ALLOWANCE);
}

export function durationRange(targetSeconds: number): { min: number; max: number } {
  return {
    min: Math.max(5, Math.round(targetSeconds * 0.85)),
    max: Math.round(targetSeconds * 1.15),
  };
}
