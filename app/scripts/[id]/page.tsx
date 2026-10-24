import { notFound } from "next/navigation";
import { ScriptEditor } from "@/components/script-editor";
import { Notice } from "@/components/ui";
import { getOwnerId } from "@/lib/db/owner";
import { listFeedback } from "@/lib/repo/calendar-feedback";
import { getScript, listVersions } from "@/lib/repo/scripts";
import { safeLoad } from "@/lib/safe-load";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = idParamSchema.safeParse(await params);
  // معرّف غير صالح يعني أن السكريبت غير موجود، فنعرض 404 بدل خطأ قاعدة بيانات
  if (!parsed.success) notFound();
  const { id } = parsed.data;

  const data = await safeLoad(async () => {
    const userId = await getOwnerId();
    const [script, versions, feedback] = await Promise.all([
      getScript(userId, id),
      listVersions(userId, id),
      listFeedback(userId, id),
    ]);
    return { script, versions, feedback };
  });

  if (!data.ok) {
    if (data.code === "NOT_FOUND") notFound();
    return <Notice tone="error" title="تعذر فتح السكريبت">{data.message}</Notice>;
  }

  return (
    <ScriptEditor
      initialScript={data.data.script}
      initialVersions={data.data.versions}
      initialFeedback={data.data.feedback}
    />
  );
}
