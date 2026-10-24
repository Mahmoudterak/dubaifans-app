/**
 * يطبّق ملفات db/migrations/*.sql بالترتيب، ويسجّل ما طُبّق في جدول schema_migrations.
 * كل ملف يُنفَّذ داخل معاملة واحدة، فإن فشل أي ملف لا يُسجَّل.
 *
 * الاستخدام: npm run db:migrate   (يحتاج DATABASE_URL)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export async function runMigrations(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const done = new Set(
      (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map(
        (row) => row.name,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`فشل تطبيق الترحيل ${file}: ${(error as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }

  return applied;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL غير مضبوط. أضفه في .env.local أولًا.");
    process.exit(1);
  }
  const applied = await runMigrations(url);
  if (applied.length === 0) {
    console.log("قاعدة البيانات محدّثة، لا توجد ترحيلات جديدة.");
  } else {
    console.log(`تم تطبيق: ${applied.join(", ")}`);
  }
}

// تشغيل مباشر فقط من سطر الأوامر، وليس عند استيراد الدالة في الاختبارات
if (process.argv[1] && path.basename(process.argv[1]).startsWith("migrate")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
