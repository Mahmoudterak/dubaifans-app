import type { ScriptOutput } from "@/lib/script/output-schema";

/** مخرجات صالحة للاختبار، كما يُفترض أن يردها النموذج */
export const validOutput: ScriptOutput = {
  title: "الاشتياق مش دليل حب",
  psychCategory: "الانفصال والتعافي والاشتياق",
  angle: "الفرق بين الاشتياق والحاجة للإحساس بالأمان",
  hooks: [
    { text: "مش كل اشتياق معناه إنك لسه بتحب.", reason: "بيكسر فكرة مسلّمة" },
    { text: "ليه بتشتاق لشخص كان بيتعبك كل يوم؟", reason: "سؤال بيخلي المشاهد يتعرف على نفسه" },
    { text: "أحيانًا اللي بتشتاقله هو الإحساس اللي كنت فيه معاه.", reason: "زاوية جديدة" },
  ],
  recommendedHookIndex: 1,
  segments: [
    { label: "الافتتاحية", text: "placeholder", emphasis: [], delivery: "نبرة سؤال" },
    {
      label: "التفسير",
      text: "الاشتياق أحيانًا مش بيكون لشخص بعينه، بيكون لإحساس الأمان اللي كان بيديهولك لحظات.",
      emphasis: ["الأمان"],
      delivery: "وقفة قصيرة بعد الجملة",
    },
    {
      label: "الخطوة",
      text: "خد دقيقة النهارده واسأل نفسك: الحاجة اللي بتوحشني دي كانت شخص ولا كانت إحساس؟",
      emphasis: ["إحساس"],
      delivery: "هادي",
    },
  ],
  coverText: "الاشتياق مش دايمًا حب",
  caption: "أحيانًا اللي بنشتاقه هو الإحساس بالأمان، مش الشخص نفسه.",
  cta: null,
  interactiveQuestion: "إنت بتشتاق لشخص ولا لإحساس كنت فيه؟",
  keywords: ["الاشتياق", "الانفصال", "التعافي"],
  hashtags: ["#العلاقات", "#تطوير_الذات"],
  deliveryNotes: ["ابدأ بنظرة مباشرة للكاميرا"],
  selfReview: {
    psychologicalAccuracy: 4,
    balance: 4,
    clarity: 5,
    dialect: 4,
    misleadingRisk: "low",
    notes: [],
  },
};

/** نسخة من المخرجات الصالحة بعد تعديل جزئي */
export function withOutput(patch: Partial<ScriptOutput>): ScriptOutput {
  return { ...validOutput, ...patch };
}
