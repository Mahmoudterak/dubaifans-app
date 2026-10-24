/**
 * الثوابت المشتركة بين الواجهة والخادم: الأوضاع، والأهداف، ومدد الفيديو، وأنواع الـ CTA.
 * أي تعديل هنا ينعكس على الواجهة وعلى قواعد التحقق تلقائيًا.
 */

export const MODES = [
  {
    key: "reach",
    label: "ريلز انتشار",
    description: "افتتاحية قوية، إيقاع سريع، وفكرة قابلة للمشاركة.",
    instruction:
      "اكتب ريلز انتشار: افتتاحية صادمة بهدوء في أول ثانيتين، إيقاع سريع، جمل قصيرة، وفكرة واحدة يحب المشاهد يبعتها لحد يعرفه.",
  },
  {
    key: "awareness",
    label: "ريلز توعوي",
    description: "تفسير نفسي متوازن ومعلومة عملية مفهومة.",
    instruction:
      "اكتب ريلز توعوي: اشرح الآلية النفسية ببساطة، وقدّم معلومة عملية واحدة واضحة، من غير تهويل.",
  },
  {
    key: "story",
    label: "ريلز قصصي",
    description: "موقف افتراضي أو حالة مركبة غير معرّفة، ثم تحليل ودروس.",
    instruction:
      "اكتب ريلز قصصي: ابدأ بموقف افتراضي أو حالة مركبة غير معرّفة (من غير أسماء ولا تفاصيل تدل على شخص حقيقي)، ثم حلّل الموقف وخرج منه بدرس واضح.",
  },
  {
    key: "deep",
    label: "ريلز عميق",
    description: "تأمل نفسي ورسالة قوية من غير مبالغة درامية.",
    instruction:
      "اكتب ريلز عميق: تأمل هادئ في سؤال إنساني، رسالة قوية بس بدون تهويل درامي ولا وعود.",
  },
  {
    key: "myth",
    label: "ريلز تصحيح مفاهيم",
    description: "تصحيح اعتقاد شائع مع توضيح الاستثناءات.",
    instruction:
      "اكتب ريلز تصحيح مفاهيم: اذكر الاعتقاد الشائع بصيغة يتعرف عليها المشاهد، صحّحه بهدوء، ووضّح الاستثناءات والفرق المهم.",
  },
  {
    key: "practical",
    label: "ريلز عملي",
    description: "تمرين أو خطوات قابلة للتطبيق فورًا.",
    instruction:
      "اكتب ريلز عملي: قدّم تمرينًا أو خطوتين إلى ثلاث خطوات قابلة للتطبيق اليوم، واشرح إزاي تعملها بالظبط.",
  },
  {
    key: "interactive",
    label: "ريلز تفاعلي",
    description: "سؤال يفتح نقاشًا محترمًا في التعليقات.",
    instruction:
      "اكتب ريلز تفاعلي: اطرح سؤالًا حقيقيًا يخلي الناس تكتب تجربتها، وخلي السؤال مفتوح ومحترم من غير ما تحكم على حد.",
  },
  {
    key: "marketing",
    label: "ريلز تسويقي",
    description: "قيمة أولًا، ثم دعوة هادية لحجز استشارة.",
    instruction:
      "اكتب ريلز تسويقي: ادِّ قيمة حقيقية الأول لدرجة إن المشاهد يحس إنه اتفاد، وبعدين دعوة هادية للاستشارة من غير ضغط.",
  },
  {
    key: "reply",
    label: "رد على تعليق",
    description: "تحويل سؤال المتابع إلى فيديو كامل.",
    instruction:
      "اكتب ريلز رد على تعليق: حوّل السؤال أو الموقف اللي المتابع كتبه إلى فيديو كامل، من غير ما تذكر اسمه ولا تفاصيله الشخصية.",
  },
  {
    key: "series",
    label: "سلسلة محتوى",
    description: "تقسيم موضوع كبير إلى حلقة مترابطة.",
    instruction:
      "اكتب حلقة من سلسلة محتوى: ركّز على جزء واحد من الموضوع الكبير، واختم بجملة تربط الحلقة اللي بعدها.",
  },
] as const;

export type ModeKey = (typeof MODES)[number]["key"];

export const GOALS = [
  { key: "reach", label: "الانتشار والوصول" },
  { key: "awareness", label: "التوعية" },
  { key: "trust", label: "بناء الثقة" },
  { key: "engagement", label: "التفاعل" },
  { key: "consult", label: "تحويل المشاهد إلى استشارة" },
] as const;

export type GoalKey = (typeof GOALS)[number]["key"];

export const CTA_TYPES = [
  { key: "none", label: "بدون دعوة" },
  { key: "soft", label: "دعوة هادية (متابعة أو حفظ الفيديو)" },
  { key: "consult", label: "دعوة لحجز استشارة" },
] as const;

export type CtaType = (typeof CTA_TYPES)[number]["key"];

export const DURATION_PRESETS = [
  { seconds: 25, label: "15–30 ثانية: فكرة واحدة سريعة" },
  { seconds: 40, label: "30–45 ثانية: شرح مختصر" },
  { seconds: 55, label: "45–60 ثانية: سكريبت متكامل" },
  { seconds: 75, label: "60–90 ثانية: شرح أعمق" },
] as const;

export const MIN_DURATION_SECONDS = 10;
export const MAX_DURATION_SECONDS = 300;

export const PLATFORMS = [
  { key: "instagram", label: "Instagram Reels" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook Reels" },
  { key: "youtube", label: "YouTube Shorts" },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

export const REVISION_PRESETS = [
  { key: "stronger_opening", label: "اجعل البداية أقوى", instruction: "اجعل الافتتاحية أقوى وأكثر تحديدًا، مع الحفاظ على الفكرة." },
  { key: "shorter_30", label: "اختصر النص بنسبة 30%", instruction: "اختصر النص بنحو 30% مع الحفاظ على الفكرة المركزية والرسالة." },
  { key: "more_natural_dialect", label: "اجعل اللهجة المصرية أكثر طبيعية", instruction: "خلّي الكلام باللهجة المصرية البسيطة الطبيعية، زي ما بيتقال في الكلام اليومي." },
  { key: "more_depth", label: "أضف عمقًا نفسيًا", instruction: "أضف عمقًا نفسيًا مسؤولًا يشرح الآلية، من غير تشخيص ولا وعود." },
  { key: "less_preachy", label: "قلل النبرة الوعظية", instruction: "شيل أي نبرة وعظية أو أوامر مباشرة، وخلي الكلام صحبة وتفهّم." },
  { key: "less_dramatic", label: "اجعل النص أكثر واقعية وأقل درامية", instruction: "خلّي النص أقرب للواقع وأقل درامية، من غير مبالغة في الألم." },
  { key: "daily_example", label: "أضف مثالًا من الحياة اليومية", instruction: "أضف مثالًا قصيرًا من الحياة اليومية (افتراضي) يوضح الفكرة." },
  { key: "remove_repetition", label: "احذف التكرار", instruction: "احذف أي تكرار في الأفكار أو الكلام." },
  { key: "new_ending", label: "غيّر الخاتمة", instruction: "غيّر الخاتمة فقط، واحتفظ بباقي السكريبت." },
  { key: "fit_30s", label: "اجعل الفيديو مناسبًا لمدة 30 ثانية", instruction: "اضبط النص ليكون مناسبًا لمدة حوالي 30 ثانية." },
  { key: "calmer_cta", label: "اجعل CTA أكثر هدوءًا", instruction: "خلّي دعوة الفعل (CTA) أهدى وأقل إلحاحًا، أو شيلها لو مش مناسبة." },
  { key: "completely_different", label: "اكتب نسخة مختلفة تمامًا بنفس الفكرة", instruction: "اكتب نسخة مختلفة تمامًا في الصياغة والزاوية والافتتاحية، مع الحفاظ على نفس الفكرة الأساسية." },
] as const;

export type RevisionPresetKey = (typeof REVISION_PRESETS)[number]["key"];

export function findMode(key: string) {
  return MODES.find((mode) => mode.key === key);
}
