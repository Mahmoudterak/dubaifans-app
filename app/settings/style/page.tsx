import { Notice, PageHeader } from "@/components/ui";
import { StyleForm } from "@/components/style-form";
import { getOwnerId } from "@/lib/db/owner";
import { getPreferences } from "@/lib/repo/preferences";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";

export default async function StylePage() {
  const data = await safeLoad(async () => getPreferences(await getOwnerId()));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="أسلوب الكتابة" description="الإعدادات دي بتتحط في كل سكريبت جديد، عشان الصوت يفضل صوتك." />
      {!data.ok ? (
        <Notice tone="error" title="تعذر تحميل الإعدادات">{data.message}</Notice>
      ) : (
        <StyleForm initial={data.data} />
      )}
    </div>
  );
}
