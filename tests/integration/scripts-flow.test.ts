import { beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db/client";
import { getOwnerId } from "@/lib/db/owner";
import { AppError } from "@/lib/errors";
import type { AiProvider } from "@/lib/ai/provider";
import { generateAndSave, regenerateHookAndSave, reviseAndSave, restoreVersionAndSave } from "@/lib/services/scripts";
import { getScript, listVersions, updateScriptMeta, listScripts } from "@/lib/repo/scripts";
import { addFeedback, addCalendarItem, listCalendar, listFeedback, updateCalendarStatus } from "@/lib/repo/calendar-feedback";
import { createTopic, deleteTopic, listTopics, listCategories } from "@/lib/repo/topics";
import { getPreferences, savePreferences } from "@/lib/repo/preferences";
import { validOutput } from "../fixtures/script-output";

/**
 * اختبارات تكامل على PostgreSQL حقيقي. تعمل فقط إذا ضُبط TEST_DATABASE_URL،
 * وتمسح بيانات المستخدمين قبل البدء، فلا تشغّلها على قاعدة إنتاج.
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

/** مزود وهمي يرد بنفس المخطط الصالح، مع تعديل بسيط حسب نوع الطلب */
function scriptedProvider(): AiProvider {
  return {
    name: "scripted",
    model: "scripted-model",
    async complete({ user }) {
      if (user.includes("أعد كتابة الافتتاحية فقط")) {
        return JSON.stringify({
          hooks: [
            { text: "الاشتياق أحيانًا بيكون لإحساس الأمان مش للشخص.", reason: "" },
            { text: "ليه بتوحشك علاقة كانت بتوجعك؟", reason: "" },
            { text: "قبل ما ترجع للشخص اسأل نفسك السؤال ده.", reason: "" },
          ],
          recommendedHookIndex: 0,
        });
      }
      if (user.includes("تعليمة التعديل")) {
        return JSON.stringify({ ...validOutput, title: "نسخة معدلة من الفكرة" });
      }
      return JSON.stringify(validOutput);
    },
  };
}

const baseInput = {
  input: "الاشتياق لشخص كان بيوجعك",
  inputKind: "question" as const,
  mode: "awareness" as const,
  goal: "trust" as const,
  durationSeconds: 40,
  ctaType: "soft" as const,
  platform: null,
  topicId: null,
  useMyVoice: false,
};

describe.skipIf(!TEST_URL)("scripts flow on PostgreSQL", () => {
  let userId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    await runMigrations(TEST_URL!);
    await query("TRUNCATE users CASCADE");
    userId = await getOwnerId();
  });

  it("generates, saves and records the first version", async () => {
    const script = await generateAndSave(baseInput, { provider: scriptedProvider(), userId });

    expect(script.currentVersion).toBe(1);
    expect(script.chosenHook).toBe(validOutput.hooks[validOutput.recommendedHookIndex]!.text);
    expect(script.qualityScore).not.toBeNull();

    const versions = await listVersions(userId, script.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.instruction).toBeNull();
  });

  it("keeps every previous version when a revision is made", async () => {
    const [original] = await listScripts(userId, { limit: 1 });
    const scriptId = original!.id;

    const revised = await reviseAndSave(scriptId, { instruction: "غيّر العنوان" }, { provider: scriptedProvider(), userId });
    expect(revised.currentVersion).toBe(2);
    expect(revised.title).toBe("نسخة معدلة من الفكرة");

    const versions = await listVersions(userId, scriptId);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(versions.find((v) => v.versionNumber === 1)!.content.title).toBe(validOutput.title);
  });

  it("changes only the opening when regenerating the hook", async () => {
    const [current] = await listScripts(userId, { limit: 1 });
    const before = await getScript(userId, current!.id);

    const after = await regenerateHookAndSave(current!.id, { provider: scriptedProvider(), userId });

    expect(after.currentVersion).toBe(before.currentVersion + 1);
    expect(after.content.segments.slice(1)).toEqual(before.content.segments.slice(1));
    expect(after.chosenHook).not.toBe(before.chosenHook);
  });

  it("restores an older version as a new version without deleting history", async () => {
    const [current] = await listScripts(userId, { limit: 1 });
    const versions = await listVersions(userId, current!.id);
    const firstVersion = versions.find((v) => v.versionNumber === 1)!;

    const restored = await restoreVersionAndSave(current!.id, firstVersion.id, { userId });

    expect(restored.title).toBe(validOutput.title);
    const all = await listVersions(userId, current!.id);
    expect(all.length).toBe(versions.length + 1);
  });

  it("updates status and platform metadata", async () => {
    const [current] = await listScripts(userId, { limit: 1 });
    const updated = await updateScriptMeta(userId, current!.id, { status: "approved", platform: "tiktok" });
    expect(updated.status).toBe("approved");
    expect(updated.platform).toBe("tiktok");
  });

  it("isolates scripts between users", async () => {
    const [current] = await listScripts(userId, { limit: 1 });
    const otherUser = await query<{ id: string }>(
      "INSERT INTO users (email, display_name) VALUES ('other@test.local', 'مستخدم تاني') ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id",
    );
    await expect(getScript(otherUser[0]!.id, current!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(addFeedback(otherUser[0]!.id, current!.id, 5, "")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails clearly when the AI provider is not configured", async () => {
    const saved = { AI_PROVIDER: process.env.AI_PROVIDER, AI_API_KEY: process.env.AI_API_KEY, AI_MODEL: process.env.AI_MODEL };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    try {
      await expect(generateAndSave(baseInput, { userId })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    } finally {
      Object.assign(process.env, Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined)));
    }
  });

  it("saves and reads style preferences", async () => {
    await savePreferences(userId, {
      dialect: "egyptian",
      tone: "warm",
      defaultDurationSeconds: 55,
      defaultCtaType: "none",
      signaturePhrases: "خليك واقعي",
      avoidPhrases: "",
      styleSamples: "عينة",
    });
    const prefs = await getPreferences(userId);
    expect(prefs.tone).toBe("warm");
    expect(prefs.defaultDurationSeconds).toBe(55);
  });

  it("manages topic library and categories", async () => {
    const categories = await listCategories();
    expect(categories.length).toBeGreaterThanOrEqual(14);

    const topic = await createTopic(userId, { category: categories[0]!.slug, title: "الخوف من الهجر", notes: "" });
    const topics = await listTopics(userId, categories[0]!.slug);
    expect(topics.map((t) => t.id)).toContain(topic.id);

    await deleteTopic(userId, topic.id);
    await expect(deleteTopic(userId, topic.id)).rejects.toBeInstanceOf(AppError);
  });

  it("manages calendar items and feedback", async () => {
    const [script] = await listScripts(userId, { limit: 1 });
    const id = await addCalendarItem(userId, {
      plannedDate: "2026-11-01",
      platform: "instagram",
      pillar: "reach",
      note: "",
      scriptId: script!.id,
    });

    const items = await listCalendar(userId, "2026-10-30", "2026-11-05");
    expect(items).toHaveLength(1);
    expect(items[0]!.scriptTitle).toBe(script!.title);

    await updateCalendarStatus(userId, id, "published");
    expect((await listCalendar(userId, "2026-10-30", "2026-11-05"))[0]!.status).toBe("published");

    await addFeedback(userId, script!.id, 4, "قوي");
    expect((await listFeedback(userId, script!.id))[0]!.rating).toBe(4);
  });
});
