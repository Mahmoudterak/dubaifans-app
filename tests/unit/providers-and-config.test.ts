import { describe, expect, it, vi } from "vitest";
import { createAnthropicProvider, createOpenAiProvider, readAiStatus, readAiConfig, type AiConfig, type FetchLike } from "@/lib/ai/provider";
import { AppError } from "@/lib/errors";
import { FixedWindowLimiter } from "@/lib/rate-limit";
import { isValidPassword, isValidSessionToken, readAuthConfig, sessionTokenFor } from "@/lib/auth/session";
import { getDatabaseUrl } from "@/lib/db/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const anthropicConfig: AiConfig = { provider: "anthropic", apiKey: "test-key", model: "test-model", timeoutMs: 1000 };
const openAiConfig: AiConfig = { provider: "openai", apiKey: "test-key", model: "test-model", timeoutMs: 1000 };

describe("AI configuration from environment", () => {
  it("reports every missing variable and never assumes defaults", () => {
    const status = readAiStatus({});
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"]);
  });

  it("rejects an unsupported provider name", () => {
    const status = readAiStatus({ AI_PROVIDER: "gemini", AI_API_KEY: "k", AI_MODEL: "m" });
    expect(status.configured).toBe(false);
  });

  it("throws a helpful AI_NOT_CONFIGURED error when readAiConfig is called without setup", () => {
    expect(() => readAiConfig({})).toThrow(/AI_PROVIDER/);
    try {
      readAiConfig({});
    } catch (error) {
      expect((error as AppError).code).toBe("AI_NOT_CONFIGURED");
    }
  });

  it("reads a valid configuration and caps the timeout", () => {
    const config = readAiConfig({
      AI_PROVIDER: "openai",
      AI_API_KEY: " key ",
      AI_MODEL: "m",
      AI_TIMEOUT_MS: "999999999",
    });
    expect(config.apiKey).toBe("key");
    expect(config.timeoutMs).toBe(180000);
  });

  it("status output never contains the API key", () => {
    const status = readAiStatus({ AI_PROVIDER: "anthropic", AI_API_KEY: "super-secret", AI_MODEL: "m" });
    expect(JSON.stringify(status)).not.toContain("super-secret");
  });
});

describe("Anthropic adapter", () => {
  it("sends the expected request and joins text blocks", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse({ content: [{ type: "text", text: '{"ok":' }, { type: "text", text: "true}" }] }));
    const provider = createAnthropicProvider(anthropicConfig, fetchMock);

    const text = await provider.complete({ system: "sys", user: "usr" });

    expect(text).toBe('{"ok":true}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init.body));
    expect(body.system).toBe("sys");
    expect(body.messages[0]).toEqual({ role: "user", content: "usr" });
  });

  it("maps 401 to a clear message without echoing provider details", async () => {
    const provider = createAnthropicProvider(anthropicConfig, async () => jsonResponse({ secret_detail: "x" }, 401));
    const error = await provider.complete({ system: "s", user: "u" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("AI_PROVIDER_ERROR");
    expect((error as AppError).message).not.toContain("secret_detail");
  });

  it("maps an aborted request to AI_TIMEOUT", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    const provider = createAnthropicProvider({ ...anthropicConfig, timeoutMs: 10 }, fetchImpl);
    await expect(provider.complete({ system: "s", user: "u" })).rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });

  it("fails clearly when the reply has no text", async () => {
    const provider = createAnthropicProvider(anthropicConfig, async () => jsonResponse({ content: [] }));
    await expect(provider.complete({ system: "s", user: "u" })).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });
});

describe("OpenAI-compatible adapter", () => {
  it("uses chat completions with JSON mode and a custom base URL", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse({ choices: [{ message: { content: '{"a":1}' } }] }));
    const provider = createOpenAiProvider({ ...openAiConfig, baseUrl: "https://gateway.example.com/v1/" }, fetchMock);

    expect(await provider.complete({ system: "s", user: "u" })).toBe('{"a":1}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://gateway.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(init.body)).response_format).toEqual({ type: "json_object" });
  });

  it("maps 429 to a retry hint", async () => {
    const provider = createOpenAiProvider(openAiConfig, async () => jsonResponse({}, 429));
    await expect(provider.complete({ system: "s", user: "u" })).rejects.toThrow(/حد الطلبات/);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit and then blocks with a retry time", () => {
    const limiter = new FixedWindowLimiter(2, 60_000, () => 0);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(true);
    const blocked = limiter.hit("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(limiter.hit("b").allowed).toBe(true);
  });

  it("resets after the window passes", () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(1, 1000, () => now);
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    now = 1001;
    expect(limiter.hit("a").allowed).toBe(true);
  });
});

describe("owner auth", () => {
  const env = { APP_PASSWORD: "a-strong-password", APP_SESSION_SECRET: "unit-test-only-session-secret" };

  it("is disabled in development when no password is set", () => {
    const config = readAuthConfig({ NODE_ENV: "development" });
    expect(config.enabled).toBe(false);
    expect(config.misconfigured).toBe(false);
  });

  it("closes production when the password is missing", () => {
    expect(readAuthConfig({ NODE_ENV: "production" }).misconfigured).toBe(true);
  });

  it("requires a session secret of at least 16 characters", () => {
    expect(readAuthConfig({ APP_PASSWORD: "x", APP_SESSION_SECRET: "short" }).misconfigured).toBe(true);
  });

  it("accepts only the correct password and the signed session token", () => {
    const config = readAuthConfig(env);
    expect(isValidPassword(config, "a-strong-password")).toBe(true);
    expect(isValidPassword(config, "wrong")).toBe(false);
    expect(isValidSessionToken(config, sessionTokenFor(config))).toBe(true);
    expect(isValidSessionToken(config, "forged")).toBe(false);
    expect(isValidSessionToken(config, undefined)).toBe(false);
  });
});

describe("database configuration", () => {
  it("fails with a helpful Arabic message when DATABASE_URL is missing", () => {
    expect(() => getDatabaseUrl({})).toThrow(/DATABASE_URL/);
    expect(getDatabaseUrl({ DATABASE_URL: "postgres://x" })).toBe("postgres://x");
  });
});
