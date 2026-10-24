"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GOALS, PLATFORMS, type GoalKey, type PlatformKey } from "@/lib/script/catalog";
import { Badge, Button, Card, Field, Notice, SectionTitle, inputClass } from "./ui";

export interface CalendarRow {
  id: string;
  plannedDate: string;
  platform: PlatformKey;
  pillar: GoalKey;
  note: string;
  status: "planned" | "published" | "skipped";
  scriptTitle: string | null;
}

export interface ScriptOption {
  id: string;
  title: string;
}

const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.key, p.label])) as Record<PlatformKey, string>;
const STATUS_LABEL: Record<CalendarRow["status"], string> = { planned: "مخطط", published: "اتنشر", skipped: "اتأجل" };

async function send(url: string, init: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
    if (response.ok) return null;
    const data = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
    return data?.error?.message ?? "حصل خطأ. حاول تاني.";
  } catch {
    return "مفيش اتصال بالخادم دلوقتي.";
  }
}

export function CalendarManager({ items, scripts, todayIso }: { items: CalendarRow[]; scripts: ScriptOption[]; todayIso: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(todayIso);
  const [platform, setPlatform] = useState<PlatformKey>("instagram");
  const [pillar, setPillar] = useState<GoalKey>("awareness");
  const [scriptId, setScriptId] = useState("");
  const [note, setNote] = useState("");

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await task();
    setBusy(false);
    if (message) setError(message);
    else router.refresh();
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return run(async () => {
      const message = await send("/api/calendar", {
        method: "POST",
        body: JSON.stringify({ plannedDate, platform, pillar, note, scriptId: scriptId || null }),
      });
      if (!message) {
        setNote("");
        setScriptId("");
      }
      return message;
    });
  }

  const grouped = items.reduce<Record<string, CalendarRow[]>>((acc, item) => {
    (acc[item.plannedDate] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}

      <Card>
        <SectionTitle>أضف ريلز للتقويم</SectionTitle>
        <form onSubmit={add} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="التاريخ">
            <input type="date" className={inputClass} value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} required />
          </Field>
          <Field label="المنصة">
            <select className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value as PlatformKey)}>
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="ركيزة المحتوى" hint="توزيع الهدف على الأسبوع: توعية، انتشار، ثقة، تفاعل، أو استشارة">
            <select className={inputClass} value={pillar} onChange={(e) => setPillar(e.target.value as GoalKey)}>
              {GOALS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="السكريبت (اختياري)">
            <select className={inputClass} value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
              <option value="">بدون سكريبت مرتبط</option>
              {scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="ملاحظة">
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="مثال: فيديو بعد ما ينزل الدرس الجديد" />
            </Field>
          </div>
          <div>
            <Button type="submit" disabled={busy || !plannedDate}>أضف للتقويم</Button>
          </div>
        </form>
      </Card>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-charcoal-600">مفيش عناصر في الفترة دي. ضيف أول ريلز تخطط له.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([date, rows]) => (
            <Card key={date}>
              <h2 className="mb-3 text-sm font-bold text-navy-900">{date}</h2>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-2 rounded-xl bg-canvas p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-charcoal-800">{row.scriptTitle ?? row.note ?? "بدون عنوان"}</p>
                      <p className="text-xs text-charcoal-600">
                        {PLATFORM_LABEL[row.platform]} · {GOALS.find((g) => g.key === row.pillar)?.label}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={row.status === "published" ? "success" : "neutral"}>{STATUS_LABEL[row.status]}</Badge>
                      {row.status !== "published" && (
                        <Button variant="outline" className="min-h-9 px-3 text-xs" disabled={busy}
                          onClick={() => run(() => send(`/api/calendar/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "published" }) }))}>
                          اتنشر
                        </Button>
                      )}
                      <Button variant="danger" className="min-h-9 px-3 text-xs" disabled={busy}
                        onClick={() => run(() => send(`/api/calendar/${row.id}`, { method: "DELETE" }))}>
                        حذف
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
