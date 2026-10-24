import { describe, expect, it } from "vitest";
import { generateScriptSchema, preferencesSchema, reviseScriptSchema, calendarCreateSchema } from "@/lib/validation";

const validGenerate = {
  input: "الخوف من الهجر بيخلي الواحد يقبل أي حاجة",
  mode: "awareness",
  goal: "trust",
  durationSeconds: 40,
  ctaType: "soft",
};

describe("generateScriptSchema", () => {
  it("accepts a valid request and fills defaults", () => {
    const parsed = generateScriptSchema.parse(validGenerate);
    expect(parsed.inputKind).toBe("topic");
    expect(parsed.platform).toBeNull();
    expect(parsed.topicId).toBeNull();
    expect(parsed.useMyVoice).toBe(false);
  });

  it("rejects an unknown mode", () => {
    expect(generateScriptSchema.safeParse({ ...validGenerate, mode: "random" }).success).toBe(false);
  });

  it("rejects a duration outside the allowed range", () => {
    expect(generateScriptSchema.safeParse({ ...validGenerate, durationSeconds: 5 }).success).toBe(false);
    expect(generateScriptSchema.safeParse({ ...validGenerate, durationSeconds: 301 }).success).toBe(false);
  });

  it("rejects an empty or very short input", () => {
    expect(generateScriptSchema.safeParse({ ...validGenerate, input: "  a " }).success).toBe(false);
  });

  it("rejects a topic id that is not a UUID", () => {
    expect(generateScriptSchema.safeParse({ ...validGenerate, topicId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("reviseScriptSchema", () => {
  it("requires either a preset or an instruction", () => {
    expect(reviseScriptSchema.safeParse({}).success).toBe(false);
    expect(reviseScriptSchema.safeParse({ presetKey: "shorter_30" }).success).toBe(true);
    expect(reviseScriptSchema.safeParse({ instruction: "خليه أهدى" }).success).toBe(true);
  });

  it("rejects an unknown preset", () => {
    expect(reviseScriptSchema.safeParse({ presetKey: "unknown" }).success).toBe(false);
  });
});

describe("preferencesSchema", () => {
  it("limits the style sample size", () => {
    const base = {
      dialect: "egyptian",
      tone: "direct",
      defaultDurationSeconds: 45,
      defaultCtaType: "soft",
      signaturePhrases: "",
      avoidPhrases: "",
    };
    expect(preferencesSchema.safeParse({ ...base, styleSamples: "x".repeat(9000) }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...base, styleSamples: "ok" }).success).toBe(true);
  });
});

describe("calendarCreateSchema", () => {
  it("requires a date in YYYY-MM-DD format", () => {
    const base = { platform: "instagram", pillar: "reach", note: "" };
    expect(calendarCreateSchema.safeParse({ ...base, plannedDate: "2026-10-24" }).success).toBe(true);
    expect(calendarCreateSchema.safeParse({ ...base, plannedDate: "24/10/2026" }).success).toBe(false);
  });
});
