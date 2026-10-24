import { CTA_TYPES, GOALS, findMode, type CtaType, type GoalKey, type ModeKey, type PlatformKey, PLATFORMS } from "./catalog";
import { targetWordCount } from "./duration";
import type { ScriptOutput } from "./output-schema";

export interface StyleProfile {
  dialect: "egyptian" | "msa_simple";
  tone: "direct" | "warm" | "calm";
  signaturePhrases: string;
  avoidPhrases: string;
  styleSamples: string;
}

export interface GenerationRequest {
  input: string;
  inputKind: "topic" | "question" | "situation";
  mode: ModeKey;
  goal: GoalKey;
  durationSeconds: number;
  ctaType: CtaType;
  platform?: PlatformKey;
  categoryLabel?: string;
  topicTitle?: string;
  /** عناوين وافتتاحيات سابقة لتجنب تكرارها */
  recentHooks?: string[];
  /** عند تفعيل «اكتب بطريقتي» تُضاف عينات أسلوب المستخدم */
  useMyVoice?: boolean;
}

const TONE_LABEL: Record<StyleProfile["tone"], string> = {
  direct: "مباشر وواقعي",
  warm: "دافئ وقريب",
  calm: "هادي ومتأني",
};

const GOAL_LABEL = Object.fromEntries(GOALS.map((goal) => [goal.key, goal.label])) as Record<GoalKey, string>;
const CTA_LABEL = Object.fromEntries(CTA_TYPES.map((cta) => [cta.key, cta.label])) as Record<CtaType, string>;

export const SYSTEM_PROMPT = `
أنت كاتب سكريبتات ريلز محترف لحساب "محمود طارق"، استشاري نفسي متخصص في العلاقات وتطوير الذات ومدرب حياة.

الهدف: سكريبت منطوق عربي (لهجة مصرية بسيطة، مع فصحى مبسطة عند الحاجة) يقوله محمود قدام الكاميرا كأنه بيكلم شخص قدامه، مش مقال مكتوب ولا نص مولّد آليًا.

قواعد الكتابة:
- الكلام منطوق: جمل قصيرة، إيقاع طبيعي، وفكرة مركزية واحدة.
- الافتتاحية أول 1–3 ثواني: موقف محدد أو سؤال يخلي المشاهد يتعرف على نفسه. ممنوع «هل تعلم» و«في الفيديو ده».
- ممنوع التهويل والتخويف والوعود النفسية الزائفة (شفاء، نسيان مضمون، تغيير الشخصية في مدة محددة).
- لا تشخّص أي شخص غايب عن الحوار (نرجسي أو مضطرب أو غيره) بناءً على سلوك واحد. اتكلم عن السلوك والآلية، وفرّق بين السمة والاضطراب الذي يحتاج تقييمًا متخصصًا.
- لا تفسّر دوافع الآخرين أو نواياهم كأنها يقين. استخدم «ممكن» و«أحيانًا» و«غالبًا».
- لا تختلق دراسات أو إحصائيات أو اقتباسات. لو مفيش مصدر موثوق، ما تذكرش أرقام ولا "الدراسات أثبتت".
- ما كلش موضوع لازم يتقفل بدعوة لاستشارة. الـ CTA اختياري وهادي.
- مش لازم تلتزم ببنية ثابتة؛ غيّر الإيقاع حسب الموضوع. المهم منطق واضح من المشكلة للفهم للخطوة أو الرسالة الأخيرة.

قبل ما ترد، راجع نفسك داخليًا: الدقة النفسية، التوازن، الوضوح، اللهجة، واحتمال التضليل. سجّل تقييمك في الحقل selfReview.

أخرج JSON صالح فقط، بدون أي نص قبله أو بعده، وبدون علامات markdown. الحقول بالضبط:
{
  "title": "عنوان داخلي للفكرة",
  "psychCategory": "التصنيف النفسي",
  "angle": "الزاوية المستخدمة في الفكرة",
  "hooks": [ {"text": "افتتاحية", "reason": "ليه تشتغل"}, {...}, {...} ],
  "recommendedHookIndex": 0,
  "segments": [ {"label": "اسم المقطع", "text": "الكلام المنطوق", "emphasis": ["كلمة تتشدد"], "delivery": "وقفة أو نبرة"} ],
  "coverText": "نص الغلاف المختصر",
  "caption": "كابشن مناسب للمنصة",
  "cta": "دعوة هادية أو null",
  "interactiveQuestion": "سؤال للتعليقات",
  "keywords": ["كلمة مفتاحية"],
  "hashtags": ["#هاشتاج"],
  "deliveryNotes": ["ملاحظة إلقاء أو مونتاج"],
  "selfReview": {
    "psychologicalAccuracy": 1-5,
    "balance": 1-5,
    "clarity": 1-5,
    "dialect": 1-5,
    "misleadingRisk": "low" | "medium" | "high",
    "notes": ["ملاحظة"]
  }
}

قواعد صارمة على المخرجات:
- hooks: ثلاث افتتاحيات مختلفة فعلًا في الزاوية، مش مجرد تغيير كلمتين.
- segments[0] هو الافتتاحية نفسها (نفس الـ hook المرشّح)، وباقي المقاطع تكمّل الفكرة بالترتيب.
- الكلام كله في حقل text داخل segments، من غير أرقام مشاهد أو تعليمات داخل النص المنطوق.
- emphasis كلمات موجودة فعلًا داخل نص المقطع.
`.trim();

export function buildStyleBlock(style: StyleProfile, useMyVoice: boolean): string {
  const lines = [
    `- اللهجة: ${style.dialect === "egyptian" ? "مصرية بسيطة" : "فصحى مبسطة"}`,
    `- النبرة: ${TONE_LABEL[style.tone]}`,
  ];
  if (style.signaturePhrases.trim()) lines.push(`- عبارات يحبها محمود ويستخدمها: ${style.signaturePhrases.trim()}`);
  if (style.avoidPhrases.trim()) lines.push(`- عبارات يتجنبها: ${style.avoidPhrases.trim()}`);
  if (useMyVoice && style.styleSamples.trim()) {
    lines.push("- عينات من كلام محمود الحقيقي (قلّد الإيقاع والطريقة، من غير نسخ الجمل):");
    lines.push(style.styleSamples.trim().slice(0, 4000));
  }
  return lines.join("\n");
}

export function buildGenerationPrompt(request: GenerationRequest, style: StyleProfile): { system: string; user: string } {
  const mode = findMode(request.mode);
  if (!mode) throw new Error(`وضع غير معروف: ${request.mode}`);

  const sections = [
    `## نوع المدخل\n${
      request.inputKind === "question"
        ? "سؤال من متابع"
        : request.inputKind === "situation"
          ? "موقف واقعي"
          : "موضوع محدد"
    }`,
    `## المدخل\n${request.input.trim()}`,
    `## الوضع\n${mode.instruction}`,
    `## الهدف\n${GOAL_LABEL[request.goal]}`,
    `## المدة المستهدفة\n${request.durationSeconds} ثانية تقريبًا، أي حوالي ${targetWordCount(request.durationSeconds)} كلمة في النص المنطوق كله (الافتتاحية داخلة في العدد).`,
    `## الدعوة (CTA)\n${CTA_LABEL[request.ctaType]}`,
    `## أسلوب الكتابة\n${buildStyleBlock(style, Boolean(request.useMyVoice))}`,
  ];

  if (request.categoryLabel) sections.push(`## التصنيف\n${request.categoryLabel}`);
  if (request.topicTitle) sections.push(`## الموضوع من المكتبة\n${request.topicTitle}`);
  if (request.platform) {
    const platform = PLATFORMS.find((p) => p.key === request.platform);
    if (platform) sections.push(`## المنصة\n${platform.label}`);
  }
  if (request.recentHooks?.length) {
    sections.push(
      `## افتتاحيات سابقة يُمنع تكرارها أو تشابهها\n${request.recentHooks.map((hook) => `- ${hook}`).join("\n")}`,
    );
  }

  return { system: SYSTEM_PROMPT, user: sections.join("\n\n") };
}

export function buildRevisionPrompt(
  current: ScriptOutput,
  instruction: string,
  style: StyleProfile,
  durationSeconds: number,
): { system: string; user: string } {
  const user = [
    "هذا هو السكريبت الحالي بصيغة JSON:",
    JSON.stringify(current, null, 2),
    `## تعليمة التعديل\n${instruction.trim()}`,
    `## المدة المستهدفة\n${durationSeconds} ثانية تقريبًا.`,
    `## أسلوب الكتابة\n${buildStyleBlock(style, false)}`,
    "أعد السكريبت كاملًا بنفس الصيغة وبنفس المفاتيح، مع تطبيق التعديل. احتفظ بالفكرة المركزية إلا إذا طُلب تغييرها.",
  ].join("\n\n");
  return { system: SYSTEM_PROMPT, user };
}

export function buildHookPrompt(
  current: ScriptOutput,
  style: StyleProfile,
  recentHooks: string[],
): { system: string; user: string } {
  const body = current.segments.slice(1).map((segment) => segment.text).join("\n");
  const user = [
    "أعد كتابة الافتتاحية فقط، وأعطني ثلاث بدائل مختلفة فعلًا في الزاوية، مع ترشيح أفضلها.",
    `## الفكرة\n${current.angle}\n${current.psychCategory}`,
    `## باقي السكريبت (لا تغيّره)\n${body}`,
    `## أسلوب الكتابة\n${buildStyleBlock(style, false)}`,
    recentHooks.length ? `## افتتاحيات يُمنع تكرارها\n${recentHooks.map((h) => `- ${h}`).join("\n")}` : "",
    'أخرج JSON صالح فقط بالشكل: {"hooks":[{"text":"","reason":""},{...},{...}],"recommendedHookIndex":0}',
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system: SYSTEM_PROMPT, user };
}
