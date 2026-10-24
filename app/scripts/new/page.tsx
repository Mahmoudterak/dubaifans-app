import { GeneratorForm, type TopicOption } from "@/components/generator-form";
import { PageHeader, Notice } from "@/components/ui";
import { readAiStatus } from "@/lib/ai/provider";
import { getOwnerId } from "@/lib/db/owner";
import { getPreferences } from "@/lib/repo/preferences";
import { listCategories, listTopics } from "@/lib/repo/topics";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";

export default async function NewScriptPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const ai = readAiStatus();

  const data = await safeLoad(async () => {
    const userId = await getOwnerId();
    const [preferences, topics, categories] = await Promise.all([
      getPreferences(userId),
      listTopics(userId),
      listCategories(),
    ]);
    const labels = new Map(categories.map((c) => [c.slug, c.label]));
    const options: TopicOption[] = topics.map((t) => ({
      id: t.id,
      title: t.title,
      categoryLabel: labels.get(t.category) ?? t.category,
    }));
    return { preferences, options };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سكريبت جديد"
        description="اختار الفكرة والنوع والمدة، والنتيجة هتظهر في صفحة السكريبت مع كل المخرجات."
      />
      {!data.ok ? (
        <Notice tone="error" title="تعذر تجهيز الصفحة">{data.message}</Notice>
      ) : (
        <GeneratorForm
          topics={data.data.options}
          defaultDuration={data.data.preferences.defaultDurationSeconds}
          defaultCta={data.data.preferences.defaultCtaType}
          aiConfigured={ai.configured}
          missingAiSettings={ai.missing}
          initialTopicId={topic}
        />
      )}
    </div>
  );
}
