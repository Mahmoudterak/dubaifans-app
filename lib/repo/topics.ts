import { query, queryOne } from "../db/client";
import { AppError } from "../errors";

export interface TopicCategory {
  slug: string;
  label: string;
  sortOrder: number;
}

export interface Topic {
  id: string;
  category: string;
  title: string;
  notes: string;
  createdAt: string;
}

interface TopicRow {
  id: string;
  category: string;
  title: string;
  notes: string;
  created_at: Date;
}

const TOPIC_COLUMNS = "id, category, title, notes, created_at";

function toTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listCategories(): Promise<TopicCategory[]> {
  const rows = await query<{ slug: string; label: string; sort_order: number }>(
    "SELECT slug, label, sort_order FROM topic_categories ORDER BY sort_order, label",
  );
  return rows.map((row) => ({ slug: row.slug, label: row.label, sortOrder: row.sort_order }));
}

export async function createCategory(label: string): Promise<TopicCategory> {
  // slug فريد بالوقت وجزء عشوائي، لأن الاسم العربي لا يصلح كمعرّف في الرابط
  const slug = `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const row = await queryOne<{ slug: string; label: string; sort_order: number }>(
    `INSERT INTO topic_categories (slug, label, sort_order)
     VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) FROM topic_categories), 0) + 1)
     RETURNING slug, label, sort_order`,
    [slug, label.trim()],
  );
  if (!row) throw new AppError("INTERNAL", "تعذر إضافة التصنيف");
  return { slug: row.slug, label: row.label, sortOrder: row.sort_order };
}

export async function listTopics(userId: string, category?: string): Promise<Topic[]> {
  const rows = await query<TopicRow>(
    `SELECT ${TOPIC_COLUMNS} FROM topics
      WHERE user_id = $1 AND ($2::text IS NULL OR category = $2)
      ORDER BY created_at DESC
      LIMIT 500`,
    [userId, category ?? null],
  );
  return rows.map(toTopic);
}

export async function getTopic(userId: string, id: string): Promise<Topic | null> {
  const row = await queryOne<TopicRow>(`SELECT ${TOPIC_COLUMNS} FROM topics WHERE id = $1 AND user_id = $2`, [id, userId]);
  return row ? toTopic(row) : null;
}

export async function createTopic(userId: string, input: { category: string; title: string; notes: string }): Promise<Topic> {
  const row = await queryOne<TopicRow>(
    `INSERT INTO topics (user_id, category, title, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, category, title) DO UPDATE SET notes = EXCLUDED.notes
     RETURNING ${TOPIC_COLUMNS}`,
    [userId, input.category, input.title, input.notes],
  );
  if (!row) throw new AppError("INTERNAL", "تعذر حفظ الموضوع");
  return toTopic(row);
}

export async function deleteTopic(userId: string, id: string): Promise<void> {
  const rows = await query<{ id: string }>("DELETE FROM topics WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "الموضوع غير موجود");
}
