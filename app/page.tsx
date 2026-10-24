import Link from "next/link";
import { Badge, buttonClass, Card, EmptyState, Notice, QualityBadge } from "@/components/ui";
import { readAiStatus } from "@/lib/ai/provider";
import { getOwnerId } from "@/lib/db/owner";
import { safeLoad } from "@/lib/safe-load";
import { listCalendar } from "@/lib/repo/calendar-feedback";
import { listScripts, type ScriptSummary } from "@/lib/repo/scripts";
import { MODES } from "@/lib/script/catalog";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const ai = readAiStatus();
  const data = await safeLoad(async () => {
    const userId = await getOwnerId();
    const [scripts, upcoming] = await Promise.all([
      listScripts(userId, { limit: 100 }),
      listCalendar(userId, todayIso(), inDays(7)),
    ]);
    return { scripts, upcoming };
  });

  const scripts: ScriptSummary[] = data.ok ? data.data.scripts : [];
  const scored = scripts.filter((s) => s.qualityScore !== null);
  const avgQuality = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.qualityScore ?? 0), 0) / scored.length) : null;
  const drafts = scripts.filter((s) => s.status === "draft").length;

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-3xl bg-navy-900 p-6 text-white md:p-10">
        <p className="text-sm text-gold-400">MT Reels AI</p>
        <h1 className="mt-2 text-2xl font-bold leading-relaxed md:text-4xl">
          سكريبت ريلز جاهز للتسجيل، بصوتك وبعمق نفسي مسؤول
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">
          اكتب موضوع أو سؤال متابع، وهتاخد 3 افتتاحيات وسكريبت كامل ومراجعة جودة قبل ما تسجّل.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/scripts/new" className={buttonClass("gold", "w-full sm:w-auto text-base px-6")}>
            سكريبت جديد
          </Link>
          <Link href="/topics" className={buttonClass("outline", "w-full sm:w-auto border-white/20 bg-transparent text-white hover:bg-white/10")}>
            تصفح مكتبة الموضوعات
          </Link>
        </div>
      </section>

      {!ai.configured && (
        <Notice tone="warning" title="التوليد مش شغال لسه">
          مزود الذكاء الاصطناعي مش مضبوط. المتغيرات الناقصة: {ai.missing.join("، ")}.{" "}
          <Link href="/settings/ai" className="font-semibold underline">افتح إعدادات النموذج</Link>
        </Notice>
      )}

      {!data.ok && (
        <Notice tone="error" title="قاعدة البيانات">
          {data.message}
        </Notice>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="السكريبتات المحفوظة" value={String(scripts.length)} />
        <Stat label="مسودات تحتاج مراجعة" value={String(drafts)} />
        <Stat label="متوسط الجودة" value={avgQuality === null ? "—" : `${avgQuality}`} />
        <Stat label="مواعيد الأسبوع الجاي" value={data.ok ? String(data.data.upcoming.length) : "—"} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900">آخر السكريبتات</h2>
          <Link href="/scripts" className="text-sm font-semibold text-navy-800 underline">كل السكريبتات</Link>
        </div>
        {scripts.length === 0 ? (
          <EmptyState
            title="لسه مفيش سكريبتات"
            description="ابدأ بأول فكرة: موضوع من المكتبة، أو سؤال من متابع، أو موقف واقعي."
          >
            <Link href="/scripts/new" className={buttonClass("gold")}>اكتب أول سكريبت</Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {scripts.slice(0, 4).map((script) => (
              <li key={script.id}>
                <Link href={`/scripts/${script.id}`} className="block h-full">
                  <Card className="h-full transition hover:border-gold-500/60">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge tone="gold">{MODES.find((m) => m.key === script.mode)?.label}</Badge>
                      <QualityBadge score={script.qualityScore} />
                    </div>
                    <p className="font-bold text-navy-900">{script.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-charcoal-600">{script.chosenHook}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.ok && data.data.upcoming.length > 0 && (
        <Card>
          <h2 className="mb-2 text-base font-bold text-navy-900">الجاي في التقويم (7 أيام)</h2>
          <ul className="space-y-2 text-sm">
            {data.data.upcoming.slice(0, 5).map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                <span>{item.plannedDate}</span>
                <span className="text-charcoal-600">{item.scriptTitle ?? item.note ?? "بدون سكريبت"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-charcoal-200/70 bg-surface p-4">
      <p className="text-xs text-charcoal-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-900">{value}</p>
    </div>
  );
}
