import { CalendarManager } from "@/components/calendar-manager";
import { Notice, PageHeader } from "@/components/ui";
import { getOwnerId } from "@/lib/db/owner";
import { listCalendar } from "@/lib/repo/calendar-feedback";
import { listScripts } from "@/lib/repo/scripts";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";

function isoDaysFromToday(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  const today = isoDaysFromToday(0);
  const until = isoDaysFromToday(27);

  const data = await safeLoad(async () => {
    const userId = await getOwnerId();
    const [items, scripts] = await Promise.all([listCalendar(userId, today, until), listScripts(userId, { limit: 50 })]);
    return { items, scripts };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="تقويم المحتوى" description="خطّة 4 أسابيع قدام: وزّع الأهداف بين التوعية والانتشار والثقة والتفاعل، من غير ما كل فيديو يبيع." />
      {!data.ok ? (
        <Notice tone="error" title="تعذر تحميل التقويم">{data.message}</Notice>
      ) : (
        <CalendarManager
          todayIso={today}
          items={data.data.items}
          scripts={data.data.scripts.map((s) => ({ id: s.id, title: s.title }))}
        />
      )}
    </div>
  );
}
