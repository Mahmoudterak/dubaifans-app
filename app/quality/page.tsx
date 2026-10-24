import Link from "next/link";
import { Badge, Card, EmptyState, Notice, PageHeader, QualityBadge } from "@/components/ui";
import { getOwnerId } from "@/lib/db/owner";
import { safeLoad } from "@/lib/safe-load";
import { listScriptDetails } from "@/lib/repo/scripts";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const data = await safeLoad(async () => listScriptDetails(await getOwnerId(), 100));

  // الأقل جودة أولًا حتى تبدأ المراجعة من أكثر ما يحتاج تدخل
  const rows = data.ok
    ? [...data.data].sort((a, b) => (a.qualityScore ?? 101) - (b.qualityScore ?? 101))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="جودة السكريبتات"
        description="المراجعة الداخلية لكل سكريبت: الدقة النفسية، الوعود الزائفة، التشخيص، المدة، ولغة الدعوة. الأقل جودة بيظهر أول."
      />

      {!data.ok && <Notice tone="error" title="تعذر تحميل التقييمات">{data.message}</Notice>}

      {data.ok && rows.length === 0 && (
        <EmptyState title="لسه مفيش سكريبتات نراجعها" description="أول ما تكتب سكريبت هيظهر هنا تقييم جودته." />
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((script) => (
          <li key={script.id}>
            <Link href={`/scripts/${script.id}`}>
              <Card className="transition hover:border-gold-500/60">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-navy-900">{script.title}</p>
                    <p className="text-xs text-charcoal-600">{script.psychCategory}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <QualityBadge score={script.qualityScore} />
                    <Badge>{script.qualityWarnings.length} ملاحظة</Badge>
                    {script.qualityWarnings.some((w) => w.severity === "error") && <Badge tone="danger">يحتاج مراجعة</Badge>}
                  </div>
                </div>
                {script.qualityWarnings.length > 0 && (
                  <ul className="mt-3 list-inside list-disc text-xs text-charcoal-600">
                    {script.qualityWarnings.slice(0, 3).map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                )}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
