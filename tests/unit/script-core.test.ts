import { describe, expect, it } from "vitest";
import { countWords, durationRange, estimateSpeakingSeconds, targetWordCount } from "@/lib/script/duration";
import { normalizeOutput, scriptOutputSchema, fullTextOf } from "@/lib/script/output-schema";
import { runQualityChecks } from "@/lib/script/quality";
import { buildGenerationPrompt, type StyleProfile } from "@/lib/script/prompt";
import { MODES, findMode } from "@/lib/script/catalog";
import { validOutput, withOutput } from "../fixtures/script-output";

const style: StyleProfile = {
  dialect: "egyptian",
  tone: "direct",
  signaturePhrases: "خليك واقعي",
  avoidPhrases: "",
  styleSamples: "عينة كلام محمود الحقيقي",
};

describe("duration", () => {
  it("counts Arabic words and ignores punctuation", () => {
    expect(countWords("مش كل اشتياق، معناه إنك بتحب.")).toBe(6);
    expect(countWords("   ")).toBe(0);
  });

  it("does not split a diacritized word into two", () => {
    expect(countWords("مَشْ كُلّ اشتياق")).toBe(3);
  });

  it("estimates speaking time with pause allowance", () => {
    // 24 كلمة ÷ 2.4 كلمة/ثانية × 1.1 = 11 ثانية
    const text = Array.from({ length: 24 }, () => "كلمة").join(" ");
    expect(estimateSpeakingSeconds(text)).toBe(11);
    expect(estimateSpeakingSeconds("")).toBe(0);
  });

  it("gives a range around the target instead of a fixed number", () => {
    expect(durationRange(40)).toEqual({ min: 34, max: 46 });
    expect(targetWordCount(44)).toBe(96);
  });
});

describe("output schema", () => {
  it("accepts a well-formed output", () => {
    expect(scriptOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("rejects an output with a wrong number of hooks", () => {
    const bad = { ...validOutput, hooks: validOutput.hooks.slice(0, 2) };
    expect(scriptOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown misleading-risk value", () => {
    const bad = { ...validOutput, selfReview: { ...validOutput.selfReview, misleadingRisk: "unknown" } };
    expect(scriptOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("sets the first segment to the recommended hook so opening and hook match", () => {
    const normalized = normalizeOutput(validOutput);
    expect(normalized.segments[0]?.text).toBe(validOutput.hooks[1]?.text);
    expect(normalized.segments).toHaveLength(validOutput.segments.length);
  });

  it("joins segments into the spoken full text", () => {
    const text = fullTextOf(normalizeOutput(validOutput));
    expect(text.split("\n")).toHaveLength(3);
  });
});

describe("quality checks", () => {
  it("gives a clean output a high score", () => {
    const report = runQualityChecks(normalizeOutput(validOutput), 40);
    expect(report.warnings.filter((w) => w.severity === "error")).toHaveLength(0);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it("flags false promises as errors", () => {
    const output = withOutput({
      segments: [
        { label: "الافتتاحية", text: "هتتعافى من الحب خلال أسبوع مضمون.", emphasis: [], delivery: "" },
        { label: "الخاتمة", text: "كلام تاني هنا عن الموضوع ده خالص.", emphasis: [], delivery: "" },
      ],
    });
    const report = runQualityChecks(output, 20);
    expect(report.warnings.map((w) => w.code)).toContain("false_promise");
    expect(report.score).toBeLessThan(80);
  });

  it("flags generic openers in the chosen hook", () => {
    const output = withOutput({
      recommendedHookIndex: 0,
      hooks: [
        { text: "هل تعلم أن الاشتياق مش حب؟", reason: "" },
        validOutput.hooks[1]!,
        validOutput.hooks[2]!,
      ],
    });
    expect(runQualityChecks(output, 40).warnings.map((w) => w.code)).toContain("generic_opener");
  });

  it("flags diagnostic labels instead of stating them as facts", () => {
    const output = withOutput({
      segments: [
        validOutput.segments[0]!,
        { label: "التفسير", text: "الشخص ده نرجسي ومش هيتغير أبدًا.", emphasis: [], delivery: "" },
      ],
    });
    expect(runQualityChecks(output, 40).warnings.map((w) => w.code)).toContain("diagnostic_label");
  });

  it("flags cited studies and numbers as unverified", () => {
    const output = withOutput({
      segments: [
        validOutput.segments[0]!,
        { label: "التفسير", text: "حسب دراسة حديثة، 80% من الناس بيعملوا كده.", emphasis: [], delivery: "" },
      ],
    });
    expect(runQualityChecks(output, 40).warnings.map((w) => w.code)).toContain("unverified_source");
  });

  it("flags a script that is far longer than the target duration", () => {
    const long = Array.from({ length: 200 }, () => "كلمة").join(" ");
    const output = withOutput({
      segments: [validOutput.segments[0]!, { label: "زيادة", text: long, emphasis: [], delivery: "" }],
    });
    expect(runQualityChecks(output, 20).warnings.map((w) => w.code)).toContain("too_long_for_duration");
  });

  it("never returns a score outside 0..100", () => {
    const output = withOutput({
      selfReview: { ...validOutput.selfReview, misleadingRisk: "high", psychologicalAccuracy: 1 },
      segments: [
        { label: "الافتتاحية", text: "هتتعافى مضمون 100% كارثة نرجسي حسب دراسة", emphasis: [], delivery: "" },
        { label: "2", text: "هتتعافى مضمون 100% كارثة نرجسي حسب دراسة", emphasis: [], delivery: "" },
      ],
    });
    const { score } = runQualityChecks(output, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("prompt building", () => {
  it("includes the mode instruction, duration and goal", () => {
    const { user, system } = buildGenerationPrompt(
      {
        input: "الخوف من الهجر",
        inputKind: "topic",
        mode: "deep",
        goal: "trust",
        durationSeconds: 40,
        ctaType: "soft",
      },
      style,
    );
    expect(user).toContain(findMode("deep")!.instruction);
    expect(user).toContain("40 ثانية");
    expect(user).toContain("بناء الثقة");
    expect(system).toContain("أخرج JSON صالح فقط");
    expect(system).toContain("لا تشخّص");
  });

  it("only includes style samples when the user asks for their own voice", () => {
    const base = {
      input: "موضوع",
      inputKind: "topic" as const,
      mode: "awareness" as const,
      goal: "awareness" as const,
      durationSeconds: 30,
      ctaType: "none" as const,
    };
    expect(buildGenerationPrompt(base, style).user).not.toContain("عينة كلام محمود الحقيقي");
    expect(buildGenerationPrompt({ ...base, useMyVoice: true }, style).user).toContain("عينة كلام محمود الحقيقي");
  });

  it("has a definition for every mode key", () => {
    expect(MODES.length).toBeGreaterThanOrEqual(10);
    for (const mode of MODES) expect(mode.instruction.length).toBeGreaterThan(20);
  });
});
