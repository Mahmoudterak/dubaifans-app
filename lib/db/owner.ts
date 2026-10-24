import { query, queryOne } from "./client";

/**
 * التطبيق مصمم لحساب مالك واحد (محمود طارق)، لكن الجداول كلها مرتبطة بـ user_id
 * حتى يمكن توسيعه لعدة مستخدمين لاحقًا دون تغيير المخطط.
 */

const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim() || "owner@mt-reels.local";
const OWNER_NAME = process.env.OWNER_DISPLAY_NAME?.trim() || "محمود طارق";

let cachedOwnerId: string | null = null;

export async function getOwnerId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId;

  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (email, display_name)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [OWNER_EMAIL, OWNER_NAME],
  );
  if (!user) throw new Error("تعذر إنشاء حساب المالك");

  await query(`INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);

  cachedOwnerId = user.id;
  return user.id;
}

/** للاختبارات: يسمح بمسح الكاش بين الحالات */
export function resetOwnerCache(): void {
  cachedOwnerId = null;
}
