import type { ScriptOutput } from "./output-schema";

/** النص المنطوق فقط، جاهز للتسجيل أو للصق في ملاحظات الإلقاء */
export function spokenScriptText(output: Pick<ScriptOutput, "segments">): string {
  return output.segments.map((segment) => segment.text).join("\n\n");
}

/** كل مخرجات السكريبت في نص واحد مرتب بالأقسام العربية */
export function formatAllOutputs(output: ScriptOutput, durationSeconds: number): string {
  return [
    `العنوان الداخلي: ${output.title}`,
    `التصنيف النفسي: ${output.psychCategory}`,
    `الزاوية: ${output.angle}`,
    "",
    "الافتتاحيات:",
    ...output.hooks.map((hook, index) => `${index + 1}${index === output.recommendedHookIndex ? " (مرشّحة)" : ""}. ${hook.text}`),
    "",
    `السكريبت (حوالي ${durationSeconds} ثانية):`,
    spokenScriptText(output),
    "",
    `نص الغلاف: ${output.coverText}`,
    "",
    "الكابشن:",
    output.caption,
    "",
    `الدعوة (CTA): ${output.cta ?? "بدون دعوة"}`,
    `سؤال للتعليقات: ${output.interactiveQuestion}`,
    "",
    `كلمات مفتاحية: ${output.keywords.join("، ")}`,
    `هاشتاجات: ${output.hashtags.join(" ")}`,
    "",
    "ملاحظات الإلقاء والمونتاج:",
    ...output.deliveryNotes.map((note) => `- ${note}`),
  ].join("\n");
}
