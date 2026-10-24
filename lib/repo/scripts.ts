import { query, queryOne, withTransaction } from "../db/client";
import { AppError } from "../errors";
import type { CtaType, GoalKey, ModeKey, PlatformKey } from "../script/catalog";
import type { ScriptOutput } from "../script/output-schema";
import type { QualityWarning } from "../script/quality";

export type ScriptStatus = "draft" | "approved" | "scheduled" | "published";

export interface ScriptSummary {
  id: string;
  title: string;
  mode: ModeKey;
  goal: GoalKey;
  durationSeconds: number;
  ctaType: CtaType;
  psychCategory: string;
  chosenHook: string;
  status: ScriptStatus;
  platform: PlatformKey | null;
  qualityScore: number | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptDetail extends ScriptSummary {
  inputText: string;
  inputKind: "topic" | "question" | "situation";
  topicId: string | null;
  angle: string;
  fullText: string;
  content: ScriptOutput;
  qualityWarnings: QualityWarning[];
}

export interface ScriptVersion {
  id: string;
  versionNumber: number;
  fullText: string;
  instruction: string | null;
  content: ScriptOutput;
  createdAt: string;
}

export interface NewScript {
  title: string;
  inputText: string;
  inputKind: "topic" | "question" | "situation";
  topicId: string | null;
  mode: ModeKey;
  goal: GoalKey;
  durationSeconds: number;
  ctaType: CtaType;
  platform: PlatformKey | null;
  content: ScriptOutput;
  fullText: string;
  qualityScore: number;
  qualityWarnings: QualityWarning[];
}

interface ScriptRow {
  id: string;
  title: string;
  input_text: string;
  input_kind: ScriptDetail["inputKind"];
  topic_id: string | null;
  mode: ModeKey;
  goal: GoalKey;
  duration_seconds: number;
  cta_type: CtaType;
  psych_category: string;
  angle: string;
  chosen_hook: string;
  full_text: string;
  content: ScriptOutput;
  quality_score: number | null;
  quality_warnings: QualityWarning[];
  status: ScriptStatus;
  platform: PlatformKey | null;
  current_version: number;
  created_at: Date;
  updated_at: Date;
}

const SCRIPT_COLUMNS = `
  id, title, input_text, input_kind, topic_id, mode, goal, duration_seconds, cta_type,
  psych_category, angle, chosen_hook, full_text, content, quality_score, quality_warnings,
  status, platform, current_version, created_at, updated_at`;

function chosenHookOf(content: ScriptOutput): string {
  return content.hooks[content.recommendedHookIndex]?.text ?? "";
}

function toDetail(row: ScriptRow): ScriptDetail {
  return {
    id: row.id,
    title: row.title,
    inputText: row.input_text,
    inputKind: row.input_kind,
    topicId: row.topic_id,
    mode: row.mode,
    goal: row.goal,
    durationSeconds: row.duration_seconds,
    ctaType: row.cta_type,
    psychCategory: row.psych_category,
    angle: row.angle,
    chosenHook: row.chosen_hook,
    fullText: row.full_text,
    content: row.content,
    qualityScore: row.quality_score,
    qualityWarnings: row.quality_warnings,
    status: row.status,
    platform: row.platform,
    currentVersion: row.current_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSummary(detail: ScriptDetail): ScriptSummary {
  const { id, title, mode, goal, durationSeconds, ctaType, psychCategory, chosenHook, status, platform, qualityScore, currentVersion, createdAt, updatedAt } = detail;
  return { id, title, mode, goal, durationSeconds, ctaType, psychCategory, chosenHook, status, platform, qualityScore, currentVersion, createdAt, updatedAt };
}

export async function listScripts(
  userId: string,
  options: { status?: ScriptStatus; search?: string; limit?: number } = {},
): Promise<ScriptSummary[]> {
  const rows = await query<ScriptRow>(
    `SELECT ${SCRIPT_COLUMNS} FROM scripts
      WHERE user_id = $1
        AND ($2::text IS NULL OR status = $2)
        AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%' OR input_text ILIKE '%' || $3 || '%')
      ORDER BY created_at DESC
      LIMIT $4`,
    [userId, options.status ?? null, options.search?.trim() || null, Math.min(options.limit ?? 100, 200)],
  );
  return rows.map((row) => toSummary(toDetail(row)));
}

export async function listScriptDetails(userId: string, limit = 200): Promise<ScriptDetail[]> {
  const rows = await query<ScriptRow>(
    `SELECT ${SCRIPT_COLUMNS} FROM scripts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map(toDetail);
}

export async function getScript(userId: string, id: string): Promise<ScriptDetail> {
  const row = await queryOne<ScriptRow>(`SELECT ${SCRIPT_COLUMNS} FROM scripts WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!row) throw new AppError("NOT_FOUND", "السكريبت غير موجود");
  return toDetail(row);
}

/** ينشئ السكريبت ونسخته الأولى في معاملة واحدة */
export async function createScript(userId: string, input: NewScript): Promise<ScriptDetail> {
  return withTransaction(async (client) => {
    const result = await client.query<ScriptRow>(
      `INSERT INTO scripts (
         user_id, title, input_text, input_kind, topic_id, mode, goal, duration_seconds, cta_type,
         platform, psych_category, angle, chosen_hook, full_text, content, quality_score, quality_warnings
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING ${SCRIPT_COLUMNS}`,
      [
        userId,
        input.title,
        input.inputText,
        input.inputKind,
        input.topicId,
        input.mode,
        input.goal,
        input.durationSeconds,
        input.ctaType,
        input.platform,
        input.content.psychCategory,
        input.content.angle,
        chosenHookOf(input.content),
        input.fullText,
        JSON.stringify(input.content),
        input.qualityScore,
        JSON.stringify(input.qualityWarnings),
      ],
    );
    const row = result.rows[0];
    if (!row) throw new AppError("INTERNAL", "تعذر حفظ السكريبت");

    await client.query(
      `INSERT INTO script_versions (script_id, version_number, content, full_text, instruction)
       VALUES ($1, 1, $2, $3, NULL)`,
      [row.id, JSON.stringify(input.content), input.fullText],
    );
    return toDetail(row);
  });
}

/**
 * يضيف نسخة جديدة للسكريبت ويحدّث النسخة الحالية. النسخ السابقة لا تُحذف أبدًا.
 */
export async function addVersion(
  userId: string,
  scriptId: string,
  input: { content: ScriptOutput; fullText: string; qualityScore: number; qualityWarnings: QualityWarning[]; instruction: string | null },
): Promise<ScriptDetail> {
  return withTransaction(async (client) => {
    const owned = await client.query<{ current_version: number }>(
      "SELECT current_version FROM scripts WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [scriptId, userId],
    );
    const current = owned.rows[0];
    if (!current) throw new AppError("NOT_FOUND", "السكريبت غير موجود");

    const next = current.current_version + 1;
    await client.query(
      `INSERT INTO script_versions (script_id, version_number, content, full_text, instruction)
       VALUES ($1, $2, $3, $4, $5)`,
      [scriptId, next, JSON.stringify(input.content), input.fullText, input.instruction],
    );

    const result = await client.query<ScriptRow>(
      `UPDATE scripts SET
         content = $2, full_text = $3, quality_score = $4, quality_warnings = $5,
         psych_category = $6, angle = $7, chosen_hook = $8,
         current_version = $9, title = $10, updated_at = now()
       WHERE id = $1
       RETURNING ${SCRIPT_COLUMNS}`,
      [
        scriptId,
        JSON.stringify(input.content),
        input.fullText,
        input.qualityScore,
        JSON.stringify(input.qualityWarnings),
        input.content.psychCategory,
        input.content.angle,
        chosenHookOf(input.content),
        next,
        input.content.title,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new AppError("NOT_FOUND", "السكريبت غير موجود");
    return toDetail(row);
  });
}

export async function listVersions(userId: string, scriptId: string): Promise<ScriptVersion[]> {
  const rows = await query<{ id: string; version_number: number; full_text: string; instruction: string | null; content: ScriptOutput; created_at: Date }>(
    `SELECT v.id, v.version_number, v.full_text, v.instruction, v.content, v.created_at
       FROM script_versions v
       JOIN scripts s ON s.id = v.script_id
      WHERE v.script_id = $1 AND s.user_id = $2
      ORDER BY v.version_number DESC`,
    [scriptId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    versionNumber: row.version_number,
    fullText: row.full_text,
    instruction: row.instruction,
    content: row.content,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getVersion(userId: string, scriptId: string, versionId: string): Promise<ScriptVersion> {
  const versions = await listVersions(userId, scriptId);
  const found = versions.find((version) => version.id === versionId);
  if (!found) throw new AppError("NOT_FOUND", "النسخة غير موجودة");
  return found;
}

export async function updateScriptMeta(
  userId: string,
  id: string,
  patch: { title?: string; status?: ScriptStatus; platform?: PlatformKey | null },
): Promise<ScriptDetail> {
  const row = await queryOne<ScriptRow>(
    `UPDATE scripts SET
       title = COALESCE($3, title),
       -- العنوان في الجدول ونسخة المحتوى يبقوا متطابقين، عشان القوائم والتعديلات ما تتعارضش
       content = CASE WHEN $3::text IS NULL THEN content ELSE jsonb_set(content, '{title}', to_jsonb($3::text)) END,
       status = COALESCE($4, status),
       platform = CASE WHEN $5::boolean THEN $6 ELSE platform END,
       updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${SCRIPT_COLUMNS}`,
    [id, userId, patch.title ?? null, patch.status ?? null, patch.platform !== undefined, patch.platform ?? null],
  );
  if (!row) throw new AppError("NOT_FOUND", "السكريبت غير موجود");
  return toDetail(row);
}

export async function deleteScript(userId: string, id: string): Promise<void> {
  const rows = await query<{ id: string }>("DELETE FROM scripts WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "السكريبت غير موجود");
}
