import { AppError } from "../errors";
import type { Env } from "../env";

/**
 * واجهة موحّدة لأي مزود نماذج. الإعداد كله من متغيرات البيئة، والمفتاح لا يخرج من الخادم أبدًا.
 *
 * المزودات المدعومة:
 *  - anthropic: Messages API
 *  - openai: Chat Completions API، ويعمل مع أي خدمة متوافقة معها عبر AI_BASE_URL
 */

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<string>;
}

export interface AiConfig {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs: number;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  missing: string[];
}

const SUPPORTED = ["anthropic", "openai"] as const;
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_TIMEOUT_MS = 180000;

/** يقرأ الإعداد من البيئة. لا يفترض أي مفتاح أو نموذج افتراضي. */
export function readAiStatus(env: Env = process.env): AiStatus {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  const missing: string[] = [];

  if (!provider) missing.push("AI_PROVIDER");
  else if (!(SUPPORTED as readonly string[]).includes(provider)) missing.push("AI_PROVIDER (anthropic أو openai)");
  if (!env.AI_API_KEY?.trim()) missing.push("AI_API_KEY");
  if (!env.AI_MODEL?.trim()) missing.push("AI_MODEL");

  return {
    configured: missing.length === 0,
    provider: provider || null,
    model: env.AI_MODEL?.trim() || null,
    missing,
  };
}

export function readAiConfig(env: Env = process.env): AiConfig {
  const status = readAiStatus(env);
  if (!status.configured) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `مزود الذكاء الاصطناعي غير مضبوط. أضف المتغيرات الناقصة في البيئة: ${status.missing.join("، ")}.`,
    );
  }
  const timeoutRaw = Number(env.AI_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.min(timeoutRaw, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;

  return {
    provider: status.provider as AiConfig["provider"],
    apiKey: env.AI_API_KEY!.trim(),
    model: env.AI_MODEL!.trim(),
    baseUrl: env.AI_BASE_URL?.trim() || undefined,
    timeoutMs,
  };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new AppError("AI_TIMEOUT", "مزود الذكاء الاصطناعي ما ردّش في الوقت المحدد. حاول مرة تانية.");
    }
    throw new AppError("AI_PROVIDER_ERROR", "تعذر الوصول لمزود الذكاء الاصطناعي. راجع الاتصال والإعداد.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // لا نعرض نص الخطأ الخام لأنه قد يحتوي تفاصيل من المزود
    const hint =
      response.status === 401 || response.status === 403
        ? "مفتاح API غير صالح أو ليس لديه صلاحية."
        : response.status === 429
          ? "تجاوزت حد الطلبات عند المزود. حاول بعد شوية."
          : "رد المزود بخطأ.";
    throw new AppError("AI_PROVIDER_ERROR", `${hint} (الحالة ${response.status})`);
  }

  try {
    return await response.json();
  } catch {
    throw new AppError("AI_INVALID_OUTPUT", "رد المزود مش JSON صالح.");
  }
}

export function createAnthropicProvider(config: AiConfig, fetchImpl: FetchLike = fetch): AiProvider {
  const base = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
  return {
    name: "anthropic",
    model: config.model,
    async complete({ system, user, maxTokens = 4000, temperature = 0.8 }) {
      const data = (await postJson(
        `${base}/v1/messages`,
        { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: config.model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        },
        config.timeoutMs,
        fetchImpl,
      )) as { content?: Array<{ type?: string; text?: string }> };

      const text = (data.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("");
      if (!text) throw new AppError("AI_INVALID_OUTPUT", "رد المزود ما فيهوش نص.");
      return text;
    },
  };
}

export function createOpenAiProvider(config: AiConfig, fetchImpl: FetchLike = fetch): AiProvider {
  const base = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    name: "openai",
    model: config.model,
    async complete({ system, user, maxTokens = 4000, temperature = 0.8 }) {
      const data = (await postJson(
        `${base}/chat/completions`,
        { authorization: `Bearer ${config.apiKey}` },
        {
          model: config.model,
          max_tokens: maxTokens,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        config.timeoutMs,
        fetchImpl,
      )) as { choices?: Array<{ message?: { content?: string | null } }> };

      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new AppError("AI_INVALID_OUTPUT", "رد المزود ما فيهوش نص.");
      return text;
    },
  };
}

/** يبني المزود المناسب من البيئة. يرمي AI_NOT_CONFIGURED إذا كان الإعداد ناقصًا. */
export function getAiProvider(env: Env = process.env, fetchImpl: FetchLike = fetch): AiProvider {
  const config = readAiConfig(env);
  return config.provider === "anthropic"
    ? createAnthropicProvider(config, fetchImpl)
    : createOpenAiProvider(config, fetchImpl);
}
