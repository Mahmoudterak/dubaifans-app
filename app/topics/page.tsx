import { Notice, PageHeader } from "@/components/ui";
import { TopicsManager } from "@/components/topics-manager";
import { getOwnerId } from "@/lib/db/owner";
import { listCategories, listTopics } from "@/lib/repo/topics";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const data = await safeLoad(async () => {
    const userId = await getOwnerId();
    const [categories, topics] = await Promise.all([listCategories(), listTopics(userId)]);
    return { categories, topics };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="مكتبة الموضوعات" description="الموضوعات مرتبة حسب التصنيف النفسي، ومن هنا تبدأ السكريبتات بسرعة." />
      {!data.ok ? (
        <Notice tone="error" title="تعذر تحميل المكتبة">{data.message}</Notice>
      ) : (
        <TopicsManager categories={data.data.categories} topics={data.data.topics} />
      )}
    </div>
  );
}
