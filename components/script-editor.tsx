"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CTA_TYPES, GOALS, MODES, PLATFORMS, REVISION_PRESETS, type PlatformKey } from "@/lib/script/catalog";
import { estimateSpeakingSeconds } from "@/lib/script/duration";
import { formatAllOutputs, spokenScriptText } from "@/lib/script/format";
import type { ScriptOutput } from "@/lib/script/output-schema";
import type { ScriptDetail, ScriptStatus, ScriptVersion } from "@/lib/repo/scripts";
import { CopyButton } from "./copy-button";
import { Badge, Button, Card, Notice, QualityBadge, SectionTitle, Spinner, inputClass } from "./ui";

export interface FeedbackRow {
  id: string;
  rating: number;
  note: string;
  createdAt: string;
}

interface Props {
  initialScript: ScriptDetail;
  initialVersions: ScriptVersion[];
  initialFeedback: FeedbackRow[];
}

const STATUS_LABEL: Record<ScriptStatus, string> = {
  draft: "مسودة",
  approved: "معتمد",
  scheduled: "متجدول",
  published: "منشور",
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function callApi<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
    });
    const data = (await response.json().catch(() => null)) as T & { error?: { message: string } };
    if (!response.ok) return { ok: false, message: data?.error?.message ?? "حصل خطأ. حاول تاني." };
    return { ok: true, data };
  } catch {
    return { ok: false, message: "مفيش اتصال بالخادم دلوقتي. اتأكد من النت وجرّب تاني." };
  }
}

export function ScriptEditor({ initialScript, initialVersions, initialFeedback }: Props) {
  const router = useRouter();
  const [script, setScript] = useState(initialScript);
  const [versions, setVersions] = useState(initialVersions);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [rating, setRating] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [viewingVersion, setViewingVersion] = useState<ScriptVersion | null>(null);

  const content: ScriptOutput = script.content;
  const chosenIndex = content.recommendedHookIndex;
  const modeLabel = MODES.find((m) => m.key === script.mode)?.label ?? script.mode;
  const goalLabel = GOALS.find((g) => g.key === script.goal)?.label ?? script.goal;
  const ctaLabel = CTA_TYPES.find((c) => c.key === script.ctaType)?.label ?? script.ctaType;
  const spoken = spokenScriptText(content);

  async function refreshVersions() {
    const result = await callApi<{ versions: ScriptVersion[] }>(`/api/scripts/${script.id}/versions`);
    if (result.ok) setVersions(result.data.versions);
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  function applyScript(next: ScriptDetail) {
    setScript(next);
    setViewingVersion(null);
  }

  function revise(body: { presetKey?: string; instruction?: string }, key: string) {
    return run(key, async () => {
      const result = await callApi<{ script: ScriptDetail }>(`/api/scripts/${script.id}/revise`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!result.ok) return setError(result.message);
      applyScript(result.data.script);
      setCustomInstruction("");
      setNotice("تم إنشاء نسخة جديدة. النسخ القديمة محفوظة في السجل.");
      await refreshVersions();
    });
  }

  function changeOpening() {
    return run("hook", async () => {
      const result = await callApi<{ script: ScriptDetail }>(`/api/scripts/${script.id}/hook`, { method: "POST" });
      if (!result.ok) return setError(result.message);
      applyScript(result.data.script);
      setNotice("تم تغيير الافتتاحية، وباقي السكريبت كما هو.");
      await refreshVersions();
    });
  }

  function restore(version: ScriptVersion) {
    return run(`restore-${version.id}`, async () => {
      const result = await callApi<{ script: ScriptDetail }>(
        `/api/scripts/${script.id}/versions/${version.id}/restore`,
        { method: "POST" },
      );
      if (!result.ok) return setError(result.message);
      applyScript(result.data.script);
      setNotice(`تمت استعادة الإصدار ${version.versionNumber} كنسخة جديدة.`);
      await refreshVersions();
    });
  }

  function patch(body: Record<string, unknown>, key: string, done: string) {
    return run(key, async () => {
      const result = await callApi<{ script: ScriptDetail }>(`/api/scripts/${script.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!result.ok) return setError(result.message);
      setScript(result.data.script);
      setNotice(done);
    });
  }

  function remove() {
    if (!window.confirm("متأكد إنك عايز تحذف السكريبت ونسخه كلها؟ الحذف مش هيترجع.")) return;
    return run("delete", async () => {
      const result = await callApi<{ ok: true }>(`/api/scripts/${script.id}`, { method: "DELETE" });
      if (!result.ok) return setError(result.message);
      router.push("/scripts");
      router.refresh();
    });
  }

  function sendFeedback() {
    if (rating < 1) return setError("اختار تقييم من 1 لـ 5 الأول");
    return run("feedback", async () => {
      const result = await callApi<{ feedback: FeedbackRow }>(`/api/scripts/${script.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, note: feedbackNote }),
      });
      if (!result.ok) return setError(result.message);
      setFeedback([result.data.feedback, ...feedback]);
      setRating(0);
      setFeedbackNote("");
      setNotice("شكرًا، التقييم اتسجل.");
    });
  }

  const timeline = content.segments.reduce<{ items: Array<{ start: number; end: number; seconds: number }>; cursor: number }>(
    (acc, segment) => {
      const seconds = Math.max(1, estimateSpeakingSeconds(segment.text));
      acc.items.push({ start: acc.cursor, end: acc.cursor + seconds, seconds });
      acc.cursor += seconds;
      return acc;
    },
    { items: [], cursor: 0 },
  );

  const errors = script.qualityWarnings.filter((w) => w.severity === "error");
  const others = script.qualityWarnings.filter((w) => w.severity !== "error");
  const average = feedback.length ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge tone="gold">{modeLabel}</Badge>
              <Badge>{script.durationSeconds} ثانية</Badge>
              <Badge>{goalLabel}</Badge>
              <Badge>{ctaLabel}</Badge>
              <QualityBadge score={script.qualityScore} />
              <Badge>نسخة {script.currentVersion}</Badge>
            </div>
            <h1 className="text-xl font-bold text-navy-900 md:text-2xl">{script.title}</h1>
            <p className="mt-1 text-xs text-charcoal-600">
              اتعمل {new Date(script.createdAt).toLocaleDateString("ar-EG")} · آخر تعديل {new Date(script.updatedAt).toLocaleString("ar-EG")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/scripts" className={`inline-flex min-h-11 items-center rounded-xl border border-charcoal-200 px-4 text-sm font-semibold text-charcoal-800`}>
              رجوع للمحفوظة
            </Link>
            <Button variant="danger" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? <Spinner label="بيتحذف..." /> : "حذف"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal-800">
            الحالة
            <select
              className={inputClass}
              value={script.status}
              disabled={busy !== null}
              onChange={(e) => patch({ status: e.target.value }, "status", "اتحفظت الحالة.")}
            >
              {(Object.keys(STATUS_LABEL) as ScriptStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS_LABEL[key]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal-800">
            المنصة
            <select
              className={inputClass}
              value={script.platform ?? ""}
              disabled={busy !== null}
              onChange={(e) => patch({ platform: (e.target.value || null) as PlatformKey | null }, "platform", "اتحفظت المنصة.")}
            >
              <option value="">لم تُحدد</option>
              {PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal-800">
            <span>المدة المتوقعة للإلقاء</span>
            <span className="rounded-xl bg-canvas px-3 py-2.5 font-normal">
              حوالي {timeline.cursor} ثانية (الهدف {script.durationSeconds})
            </span>
          </div>
        </div>
      </Card>

      {(notice || error) && (
        <div className="flex flex-col gap-2">
          {notice && <Notice tone="success">{notice}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}

      {/* أزرار الإجراءات الرئيسية */}
      <Card className="sticky top-[7.5rem] z-10 md:top-[6.5rem]">
        <div className="flex flex-wrap gap-2">
          <CopyButton text={spoken} label="انسخ السكريبت فقط" variant="gold" />
          <CopyButton text={formatAllOutputs(content, script.durationSeconds)} label="انسخ كل المخرجات" />
          <Button variant="outline" onClick={changeOpening} disabled={busy !== null}>
            {busy === "hook" ? <Spinner label="بنغيّر الافتتاحية..." /> : "غيّر الافتتاحية فقط"}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById("rewrite")?.scrollIntoView({ behavior: "smooth" })}>
            أعد كتابة النص
          </Button>
        </div>
      </Card>

      {/* 1 + 2 + 3 */}
      <Card>
        <SectionTitle number={1}>العنوان الداخلي</SectionTitle>
        <p className="text-base font-semibold text-navy-900">{content.title}</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <SectionTitle number={2}>التصنيف النفسي</SectionTitle>
            <p className="text-sm">{content.psychCategory}</p>
            <p className="mt-2 text-xs text-charcoal-600">الزاوية: {content.angle}</p>
          </div>
          <div>
            <SectionTitle number={3}>الهدف</SectionTitle>
            <p className="text-sm">{goalLabel}</p>
          </div>
        </div>
      </Card>

      {/* 4: الافتتاحيات */}
      <Card>
        <SectionTitle number={4}>الافتتاحيات الثلاث</SectionTitle>
        <ol className="flex flex-col gap-3">
          {content.hooks.map((hook, index) => {
            const isChosen = index === chosenIndex;
            return (
              <li
                key={`${index}-${hook.text}`}
                className={`rounded-xl border p-4 ${isChosen ? "border-gold-500 bg-gold-100/50" : "border-charcoal-200"}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-bold text-charcoal-600">بديل {index + 1}</span>
                  {isChosen && <Badge tone="gold">المرشّح</Badge>}
                </div>
                <p className="text-base font-semibold text-navy-900">{hook.text}</p>
                {hook.reason && <p className="mt-1 text-xs text-charcoal-600">{hook.reason}</p>}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* 5 + 6: السكريبت والتقسيم الزمني */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle number={5}>السكريبت النهائي</SectionTitle>
          <CopyButton text={spoken} label="انسخ السكريبت" />
        </div>
        <div className="flex flex-col gap-4">
          {content.segments.map((segment, index) => {
            const slot = timeline.items[index];
            return (
              <div key={index} className="rounded-xl bg-canvas/70 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-navy-900">{segment.label}</span>
                  {slot && (
                    <span className="rounded-full bg-surface px-2 py-0.5 font-semibold text-charcoal-600">
                      {slot.start}–{slot.end} ث
                    </span>
                  )}
                </div>
                <p className="spoken text-base text-charcoal-800">{segment.text}</p>
                {(segment.emphasis.length > 0 || segment.delivery) && (
                  <p className="mt-2 text-xs text-charcoal-600">
                    {segment.emphasis.length > 0 && <>تشديد على: <span className="font-semibold text-navy-900">{segment.emphasis.join("، ")}</span>. </>}
                    {segment.delivery && <>{segment.delivery}</>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 7 + 8 + 9 + 10 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle number={7}>نص الغلاف</SectionTitle>
          <p className="text-base font-bold text-navy-900">{content.coverText}</p>
        </Card>
        <Card>
          <SectionTitle number={8}>الكابشن</SectionTitle>
          <p className="whitespace-pre-line text-sm">{content.caption}</p>
          <div className="mt-3">
            <CopyButton text={content.caption} label="انسخ الكابشن" />
          </div>
        </Card>
        <Card>
          <SectionTitle number={9}>الدعوة (CTA)</SectionTitle>
          <p className="text-sm">{content.cta ?? "بدون دعوة في هذا الفيديو."}</p>
        </Card>
        <Card>
          <SectionTitle number={10}>سؤال للتعليقات</SectionTitle>
          <p className="text-sm">{content.interactiveQuestion}</p>
        </Card>
      </div>

      {/* 11 + 12 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle number={11}>كلمات مفتاحية وهاشتاجات</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {content.keywords.map((keyword) => <Badge key={keyword}>{keyword}</Badge>)}
          </div>
          <p className="mt-3 text-sm text-navy-900" dir="ltr">{content.hashtags.join(" ")}</p>
        </Card>
        <Card>
          <SectionTitle number={12}>ملاحظات الإلقاء والمونتاج</SectionTitle>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {content.deliveryNotes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </Card>
      </div>

      {/* مراجعة الجودة */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-navy-900">مراجعة الجودة</h2>
          <QualityBadge score={script.qualityScore} />
        </div>
        {errors.length === 0 && others.length === 0 && (
          <p className="text-sm text-success">ما فيش ملاحظات. اقرأ النص بصوت عالي قبل النشر.</p>
        )}
        <ul className="flex flex-col gap-2">
          {[...errors, ...others].map((warning, i) => (
            <li
              key={`${warning.code}-${i}`}
              className={`rounded-xl px-4 py-2.5 text-sm ${warning.severity === "error" ? "bg-danger-soft text-danger" : "bg-canvas text-charcoal-800"}`}
            >
              {warning.message}
            </li>
          ))}
        </ul>
        {content.selfReview.notes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-charcoal-600">ملاحظات المراجعة الذاتية</p>
            <ul className="mt-1 list-inside list-disc text-xs text-charcoal-600">
              {content.selfReview.notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )}
      </Card>

      {/* إعادة الكتابة */}
      <Card className="scroll-mt-40">
        <div id="rewrite" className="scroll-mt-40" />
        <SectionTitle>أعد الكتابة أو طوّر السكريبت</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {REVISION_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant="outline"
              className="min-h-9 text-xs"
              disabled={busy !== null}
              onClick={() => revise({ presetKey: preset.key }, `preset-${preset.key}`)}
            >
              {busy === `preset-${preset.key}` ? <Spinner label="..." /> : preset.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <textarea
            rows={2}
            maxLength={500}
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="اكتب تعليمة حرة، مثلاً: خلي الكلام أقرب لمشهد من المطبخ"
            className={inputClass}
          />
          <Button
            variant="gold"
            disabled={busy !== null || customInstruction.trim().length < 3}
            onClick={() => revise({ instruction: customInstruction }, "custom")}
            className="md:self-stretch"
          >
            {busy === "custom" ? <Spinner label="بنعدّل..." /> : "نفّذ التعديل"}
          </Button>
        </div>
      </Card>

      {/* سجل الإصدارات */}
      <Card>
        <SectionTitle>سجل الإصدارات</SectionTitle>
        <p className="mb-3 text-xs text-charcoal-600">كل تعديل بيتحفظ كنسخة جديدة، وأي نسخة قديمة تقدر ترجعلها.</p>
        <ul className="flex flex-col gap-2">
          {versions.map((version) => (
            <li key={version.id} className="flex flex-col gap-2 rounded-xl border border-charcoal-200 p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy-900">
                  الإصدار {version.versionNumber}
                  {version.versionNumber === script.currentVersion && <span className="mr-2 text-xs text-success">(الحالي)</span>}
                </p>
                <p className="truncate text-xs text-charcoal-600">
                  {version.instruction ?? "النسخة الأولى"} · {new Date(version.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="min-h-9 text-xs" onClick={() => setViewingVersion(version)}>
                  عرض
                </Button>
                {version.versionNumber !== script.currentVersion && (
                  <Button variant="outline" className="min-h-9 text-xs" disabled={busy !== null} onClick={() => restore(version)}>
                    {busy === `restore-${version.id}` ? <Spinner label="..." /> : "استعادة"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {viewingVersion && (
          <div className="mt-4 rounded-xl bg-canvas p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">معاينة الإصدار {viewingVersion.versionNumber}</p>
              <button type="button" onClick={() => setViewingVersion(null)} className="text-xs text-charcoal-600 underline">
                إغلاق
              </button>
            </div>
            <p className="spoken text-sm">{viewingVersion.fullText}</p>
          </div>
        )}
      </Card>

      {/* التقييم الداخلي */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>تقييمك للسكريبت</SectionTitle>
          {average && <Badge tone="gold">متوسط {average} من 5 ({feedback.length})</Badge>}
        </div>
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="التقييم من 1 لـ 5" className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                onClick={() => setRating(value)}
                className={`size-11 rounded-xl border text-sm font-bold transition ${
                  rating === value ? "border-gold-500 bg-gold-100 text-navy-900" : "border-charcoal-200 text-charcoal-600"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            maxLength={1000}
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="ملاحظة (اختياري): إيه اللي عجبك وإيه اللي محتاج تعديل؟"
            className={inputClass}
          />
          <div>
            <Button variant="outline" onClick={sendFeedback} disabled={busy !== null}>
              احفظ التقييم
            </Button>
          </div>
        </div>
        {feedback.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {feedback.slice(0, 5).map((item) => (
              <li key={item.id} className="rounded-lg bg-canvas px-3 py-2">
                <span className="font-bold">{item.rating}/5</span>
                {item.note && <span className="mr-2 text-charcoal-600">{item.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-xs text-charcoal-600">
        {modeLabel} · الفكرة مولّدة بالذكاء الاصطناعي وتحتاج مراجعتك قبل النشر.
      </p>
    </div>
  );
}
