import { ok } from "@/lib/api";
import { readAiStatus } from "@/lib/ai/provider";
import { readAuthConfig } from "@/lib/auth/session";

/** حالة الإعداد فقط. لا تُرجع أي مفتاح أو سر، ولا تفحص الاتصال الفعلي بالمزود */
export async function GET() {
  const ai = readAiStatus();
  const auth = readAuthConfig();
  return ok({
    ai: { configured: ai.configured, provider: ai.provider, model: ai.model, missing: ai.missing },
    database: { configured: Boolean(process.env.DATABASE_URL?.trim()) },
    auth: { enabled: auth.enabled, misconfigured: auth.misconfigured },
  });
}
