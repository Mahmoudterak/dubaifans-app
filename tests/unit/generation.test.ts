import { describe, expect, it } from "vitest";
import type { AiProvider } from "@/lib/ai/provider";
import { extractJsonObject } from "@/lib/ai/extract-json";
import { AppError } from "@/lib/errors";
import { applyHookOnly, generateScript, regenerateHook, reviseScript } from "@/lib/script/generate";
import { hookOnlySchema } from "@/lib/script/output-schema";
import type { StyleProfile } from "@/lib/script/prompt";
import { validOutput } from "../fixtures/script-output";

const style: StyleProfile = {
  dialect: "egyptian",
  tone: "direct",
  signaturePhrases: "",
  avoidPhrases: "",
  styleSamples: "",
};

/** مزود وهمي يرد بقائمة ردود بالترتيب، ويسجّل الطلبات */
function fakeProvider(replies: string[]) {
  const calls: Array<{ system: string; user: string }> = [];
  const provider: AiProvider = {
    name: "fake",
    model: "fake-model",
    async complete(request) {
      calls.push({ system: request.system, user: request.user });
      const next = replies.shift();
      if (next === undefined) throw new Error("no more replies");
      return next;
    },
  };
  return { provider, calls };
}

const request = {
  input: "الخوف من الهجر بيخلي الواحد يقبل أي حاجة",
  inputKind: "topic" as const,
  mode: "awareness" as const,
  goal: "awareness" as const,
  durationSeconds: 40,
  ctaType: "soft" as const,
};

describe("extractJsonObject", () => {
  it("reads JSON wrapped in a markdown fence", () => {
    expect(extractJsonObject('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("reads JSON surrounded by prose", () => {
    expect(extractJsonObject('هذا هو الرد: {"a": "b"} شكرًا')).toEqual({ a: "b" });
  });

  it("throws AI_INVALID_OUTPUT when there is no JSON", () => {
    expect(() => extractJsonObject("مفيش JSON هنا")).toThrow(AppError);
    try {
      extractJsonObject("{broken");
    } catch (error) {
      expect((error as AppError).code).toBe("AI_INVALID_OUTPUT");
    }
  });
});

describe("generateScript", () => {
  it("returns a validated, normalized script and quality report", async () => {
    const { provider, calls } = fakeProvider([JSON.stringify(validOutput)]);
    const result = await generateScript(provider, request, style);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.user).toContain("الخوف من الهجر");
    expect(result.output.segments[0]!.text).toBe(validOutput.hooks[validOutput.recommendedHookIndex]!.text);
    expect(result.fullText.length).toBeGreaterThan(20);
    expect(result.quality.score).toBeGreaterThan(0);
  });

  it("retries once with the validation problem when the first reply is invalid", async () => {
    const broken = { ...validOutput, hooks: validOutput.hooks.slice(0, 1) };
    const { provider, calls } = fakeProvider([JSON.stringify(broken), JSON.stringify(validOutput)]);

    const result = await generateScript(provider, request, style);

    expect(calls).toHaveLength(2);
    expect(calls[1]!.user).toContain("ردك السابق ما كانش مطابق");
    expect(result.output.title).toBe(validOutput.title);
  });

  it("fails with AI_INVALID_OUTPUT when the model keeps returning invalid output", async () => {
    const { provider, calls } = fakeProvider(["not json", "still not json"]);

    await expect(generateScript(provider, request, style)).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    expect(calls).toHaveLength(2);
  });

  it("does not retry provider errors such as timeouts", async () => {
    let attempts = 0;
    const provider: AiProvider = {
      name: "fake",
      model: "m",
      async complete() {
        attempts += 1;
        throw new AppError("AI_TIMEOUT", "timeout");
      },
    };

    await expect(generateScript(provider, request, style)).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    expect(attempts).toBe(1);
  });
});

describe("reviseScript", () => {
  it("sends the current script and the instruction to the model", async () => {
    const { provider, calls } = fakeProvider([JSON.stringify(validOutput)]);
    await reviseScript(provider, validOutput, "اختصر النص", style, 30);

    expect(calls[0]!.user).toContain("اختصر النص");
    expect(calls[0]!.user).toContain(validOutput.title);
  });
});

describe("regenerateHook", () => {
  const newHooks = {
    hooks: [
      { text: "الاشتياق أحيانًا بيكون لإحساس الأمان مش للشخص.", reason: "زاوية أدق" },
      { text: "ليه بتوحشك العلاقة اللي كانت بتوجعك؟", reason: "" },
      { text: "قبل ما ترجع للشخص، اسأل نفسك السؤال ده.", reason: "" },
    ],
    recommendedHookIndex: 0,
  };

  it("replaces only the opening and keeps the rest of the script", async () => {
    const { provider } = fakeProvider([JSON.stringify(newHooks)]);
    const result = await regenerateHook(provider, validOutput, style, 40);

    expect(result.output.segments[0]!.text).toBe(newHooks.hooks[0]!.text);
    expect(result.output.segments.slice(1)).toEqual(validOutput.segments.slice(1));
    expect(result.output.title).toBe(validOutput.title);
  });

  it("applyHookOnly keeps the recommended index consistent with the new opening", () => {
    const parsed = hookOnlySchema.parse({ ...newHooks, recommendedHookIndex: 2 });
    const updated = applyHookOnly(validOutput, parsed);
    expect(updated.recommendedHookIndex).toBe(2);
    expect(updated.segments[0]!.text).toBe(newHooks.hooks[2]!.text);
  });
});
