import { query, queryOne } from "../db/client";
import { AppError } from "../errors";
import type { GoalKey, PlatformKey } from "../script/catalog";

export type CalendarStatus = "planned" | "published" | "skipped";

export interface CalendarItem {
  id: string;
  plannedDate: string;
  platform: PlatformKey;
  pillar: GoalKey;
  note: string;
  status: CalendarStatus;
  scriptId: string | null;
  scriptTitle: string | null;
}

export async function listCalendar(userId: string, from: string, to: string): Promise<CalendarItem[]> {
  const rows = await query<{
    id: string;
    planned_date: string;
    platform: PlatformKey;
    pillar: GoalKey;
    note: string;
    status: CalendarStatus;
    script_id: string | null;
    script_title: string | null;
  }>(
    `SELECT c.id, to_char(c.planned_date, 'YYYY-MM-DD') AS planned_date, c.platform, c.pillar, c.note, c.status,
            c.script_id, s.title AS script_title
       FROM content_calendar c
       LEFT JOIN scripts s ON s.id = c.script_id
      WHERE c.user_id = $1 AND c.planned_date BETWEEN $2::date AND $3::date
      ORDER BY c.planned_date, c.created_at`,
    [userId, from, to],
  );
  return rows.map((row) => ({
    id: row.id,
    plannedDate: row.planned_date,
    platform: row.platform,
    pillar: row.pillar,
    note: row.note,
    status: row.status,
    scriptId: row.script_id,
    scriptTitle: row.script_title,
  }));
}

export async function addCalendarItem(
  userId: string,
  input: { plannedDate: string; platform: PlatformKey; pillar: GoalKey; note: string; scriptId: string | null },
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO content_calendar (user_id, planned_date, platform, pillar, note, script_id)
     VALUES ($1, $2::date, $3, $4, $5, $6)
     RETURNING id`,
    [userId, input.plannedDate, input.platform, input.pillar, input.note, input.scriptId],
  );
  if (!row) throw new AppError("INTERNAL", "تعذر إضافة العنصر للتقويم");
  return row.id;
}

export async function updateCalendarStatus(userId: string, id: string, status: CalendarStatus): Promise<void> {
  const rows = await query<{ id: string }>(
    "UPDATE content_calendar SET status = $3 WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId, status],
  );
  if (rows.length === 0) throw new AppError("NOT_FOUND", "العنصر غير موجود في التقويم");
}

export async function deleteCalendarItem(userId: string, id: string): Promise<void> {
  const rows = await query<{ id: string }>("DELETE FROM content_calendar WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "العنصر غير موجود في التقويم");
}

export interface FeedbackItem {
  id: string;
  rating: number;
  note: string;
  createdAt: string;
}

export async function addFeedback(userId: string, scriptId: string, rating: number, note: string): Promise<FeedbackItem> {
  const owned = await queryOne<{ id: string }>("SELECT id FROM scripts WHERE id = $1 AND user_id = $2", [scriptId, userId]);
  if (!owned) throw new AppError("NOT_FOUND", "السكريبت غير موجود");

  const row = await queryOne<{ id: string; rating: number; note: string; created_at: Date }>(
    `INSERT INTO script_feedback (script_id, user_id, rating, note)
     VALUES ($1, $2, $3, $4)
     RETURNING id, rating, note, created_at`,
    [scriptId, userId, rating, note],
  );
  if (!row) throw new AppError("INTERNAL", "تعذر حفظ التقييم");
  return { id: row.id, rating: row.rating, note: row.note, createdAt: row.created_at.toISOString() };
}

export async function listFeedback(userId: string, scriptId: string): Promise<FeedbackItem[]> {
  const rows = await query<{ id: string; rating: number; note: string; created_at: Date }>(
    `SELECT id, rating, note, created_at FROM script_feedback
      WHERE script_id = $1 AND user_id = $2
      ORDER BY created_at DESC LIMIT 50`,
    [scriptId, userId],
  );
  return rows.map((row) => ({ id: row.id, rating: row.rating, note: row.note, createdAt: row.created_at.toISOString() }));
}
