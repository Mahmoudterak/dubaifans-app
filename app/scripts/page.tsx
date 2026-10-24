import Link from "next/link";
import { Badge, buttonClass, Card, EmptyState, Notice, PageHeader, QualityBadge } from "@/components/ui";
import { getOwnerId } from "@/lib/db/owner";
import { safeLoad } from "@/lib/safe-load";
import { listScripts, type ScriptStatus } from "@/lib/repo/scripts";
import { MODES } from "@/lib/script/catalog";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: ScriptStatus | "all"; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "draft", label: "مسودات" },
  { key: "approved", label: "معتمدة" },
  { key: "scheduled", label: "متجدولة" },
  { key: "published", label: "منشورة" },
];

const STATUS_LABEL: Record<ScriptStatus, string> = {
  draft: "مسودة",
  approved: "معتمد",
  scheduled: "متجدول",
  published: "منشور",
};

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const activeStatus = FILTERS.some((f) => f.key === status) && status !== "all" ? (status as ScriptStatus) : undefined;

  const data = await safeLoad(() =>
    getOwnerId().then((userId) => listScripts(userId, { status: activeStatus, search: q })),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="السكريبتات المحفوظة"
        description="كل سكريبت محفوظ مع سجل نسخه وتقييماته."
        actions={<Link href="/scripts/new" className={buttonClass("gold")}>سكريبت جديد</Link>}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="فلترة حسب الحالة" className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const active = (activeStatus ?? "all") === filter.key;
            const href = filter.key === "all" ? "/scripts" : `/scripts?status=${filter.key}`;
            return (
              <Link
                key={filter.key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  active ? "border-navy-800 bg-navy-800 text-white" : "border-charcoal-200 bg-surface text-charcoal-600"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
        <form action="/scripts" className="flex gap-2">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ابحث في العناوين والموضوعات"
            className="w-full rounded-xl border border-charcoal-200 bg-surface px-3 py-2 text-sm md:w-72"
          />
          <button type="submit" className={buttonClass("outline")}>بحث</button>
        </form>
      </div>

      {!data.ok && <Notice tone="error" title="تعذر تحميل السكريبتات">{data.message}</Notice>}

      {data.ok && data.data.length === 0 && (
        <EmptyState
          title={q || activeStatus ? "مفيش نتايج للفلتر ده" : "لسه مفيش سكريبتات محفوظة"}
          description="جرّب فلتر تاني، أو اكتب سكريبت جديد."
        >
          <Link href="/scripts/new" className={buttonClass("gold")}>سكريبت جديد</Link>
        </EmptyState>
      )}

      {data.ok && data.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.data.map((script) => (
            <li key={script.id}>
              <Link href={`/scripts/${script.id}`} className="block h-full">
                <Card className="h-full transition hover:border-gold-500/60">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge tone="gold">{MODES.find((m) => m.key === script.mode)?.label}</Badge>
                    <Badge>{STATUS_LABEL[script.status]}</Badge>
                    <Badge>{script.durationSeconds} ث</Badge>
                    <QualityBadge score={script.qualityScore} />
                  </div>
                  <p className="font-bold text-navy-900">{script.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-charcoal-600">{script.chosenHook}</p>
                  <p className="mt-3 text-xs text-charcoal-600">
                    نسخة {script.currentVersion} · {new Date(script.updatedAt).toLocaleDateString("ar-EG")}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
