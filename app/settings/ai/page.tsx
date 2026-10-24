import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { readAiStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

const ENV_VARS: Array<{ name: string; required: boolean; description: string }> = [
  { name: "DATABASE_URL", required: true, description: "رابط PostgreSQL. مثال: postgres://user:pass@host/db" },
  { name: "APP_PASSWORD", required: true, description: "كلمة مرور الدخول للتطبيق" },
  { name: "APP_SESSION_SECRET", required: true, description: "سر توقيع الجلسة، 16 حرفًا على الأقل" },
  { name: "AI_PROVIDER", required: true, description: "anthropic أو openai" },
  { name: "AI_API_KEY", required: true, description: "مفتاح المزود. يُقرأ على الخادم فقط ولا يظهر في الواجهة" },
  { name: "AI_MODEL", required: true, description: "اسم النموذج الذي تختاره من المزود" },
  { name: "AI_BASE_URL", required: false, description: "اختياري: لخدمة متوافقة مع OpenAI" },
  { name: "AI_TIMEOUT_MS", required: false, description: "اختياري: المهلة بالمللي ثانية (الافتراضي 60000)" },
  { name: "GENERATION_RATE_LIMIT_PER_HOUR", required: false, description: "اختياري: حد التوليد في الساعة (الافتراضي 30)" },
];

export default async function AiSettingsPage() {
  const status = readAiStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="إعدادات النموذج" description="التطبيق بيقرأ الإعداد من متغيرات البيئة. مفيش مفتاح بيتكتب في الكود أو بيظهر في المتصفح." />

      {status.configured ? (
        <Notice tone="success" title="الإعداد مكتمل">
          المزود: <strong>{status.provider}</strong> · النموذج: <strong>{status.model}</strong>. الاتصال الفعلي بيتأكد عند أول توليد، لأن التطبيق ما بيبعتش طلبات تجريبية.
        </Notice>
      ) : (
        <Notice tone="warning" title="الإعداد ناقص">
          المتغيرات الناقصة: {status.missing.join("، ")}. أضفها في إعدادات البيئة (في Vercel: Project Settings → Environment Variables) ثم أعد النشر.
        </Notice>
      )}

      <Card>
        <SectionTitle>متغيرات البيئة</SectionTitle>
        <ul className="divide-y divide-charcoal-200">
          {ENV_VARS.map((item) => (
            <li key={item.name} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <code className="text-sm font-bold text-navy-900" dir="ltr">{item.name}</code>
                <p className="text-xs text-charcoal-600">{item.description}</p>
              </div>
              <Badge tone={item.required ? "gold" : "neutral"}>{item.required ? "مطلوب" : "اختياري"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-charcoal-600">
        ملف <code dir="ltr">.env.example</code> في المستودع بيوضّح أسماء المتغيرات من غير قيم حقيقية.
      </p>
    </div>
  );
}
