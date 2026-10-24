import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { AppError } from "../errors";
import type { Env } from "../env";

/**
 * مجمّع اتصالات واحد لكل عملية Node. في بيئة التطوير يُحفظ على globalThis
 * حتى لا تتكرر الاتصالات مع إعادة تحميل الوحدات.
 */

const globalForDb = globalThis as unknown as { __mtReelsPool?: Pool };

export function getDatabaseUrl(env: Env = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new AppError(
      "DATABASE_NOT_CONFIGURED",
      "قاعدة البيانات غير مضبوطة. أضف DATABASE_URL في ملف البيئة ثم شغّل npm run db:migrate.",
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForDb.__mtReelsPool) {
    const url = getDatabaseUrl();
    const needsSsl = !/localhost|127\.0\.0\.1/.test(url);
    globalForDb.__mtReelsPool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalForDb.__mtReelsPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** ينفّذ دالة داخل معاملة ويتراجع عنها عند الخطأ */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
