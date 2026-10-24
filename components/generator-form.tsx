"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CTA_TYPES, DURATION_PRESETS, GOALS, MAX_DURATION_SECONDS, MIN_DURATION_SECONDS, MODES, PLATFORMS } from "@/lib/script/catalog";
import { Button, Card, Field, Notice, SectionTitle, Spinner, inputClass } from "./ui";

export interface TopicOption {
  id: string;
  title: string;
  categoryLabel: string;
}

interface Props {
  topics: TopicOption[];
  defaultDuration: number;
  defaultCta: "none" | "soft" | "consult";
  aiConfigured: boolean;
  missingAiSettings: string[];
  initialTopicId?: string;
}

const INPUT_KINDS = [
  { key: "topic", label: "موضوع محدد" },
  { key: "question", label: "سؤال من متابع" },
  { key: "situation", label: "موقف واقعي" },
] as const;

export function GeneratorForm({ topics, defaultDuration, defaultCta, aiConfigured, missingAiSettings, initialTopicId }: Props) {
  const router = useRouter();
  const [inputKind, setInputKind] = useState<(typeof INPUT_KINDS)[number]["key"]>("topic");
  const [input, setInput] = useState("");
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const [mode, setMode] = useState<string>("awareness");
  const [goal, setGoal] = useState<string>("awareness");
  const [duration, setDuration] = useState(defaultDuration);
  const [ctaType, setCtaType] = useState<string>(defaultCta);
  const [platform, setPlatform] = useState("");
  const [useMyVoice, setUseMyVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationValid = Number.isInteger(duration) && duration >= MIN_DURATION_SECONDS && duration <= MAX_DURATION_SECONDS;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input,
          inputKind,
          mode,
          goal,
          durationSeconds: duration,
          ctaType,
          platform: platform || null,
          topicId: topicId || null,
          useMyVoice,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { script: { id: string } }
        | { error: { message: string } }
        | null;
      if (!response.ok || !data || !("script" in data)) {
        setError(data && "error" in data ? data.error.message : "تعذر إنشاء السكريبت. حاول تاني.");
        return;
      }
      router.push(`/scripts/${data.script.id}`);
    } catch {
      setError("مفيش اتصال بالخادم دلوقتي. اتأكد من النت وجرّب تاني.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = aiConfigured && !busy && input.trim().length >= 3 && durationValid;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {!aiConfigured && (
        <Notice tone="warning" title="مزود الذكاء الاصطناعي مش مضبوط">
          أضف المتغيرات دي في إعدادات البيئة ثم أعد تشغيل التطبيق: {missingAiSettings.join("، ")}. راجع صفحة{" "}
          <a className="font-semibold underline" href="/settings/ai">إعدادات النموذج</a>.
        </Notice>
      )}

      <Card>
        <SectionTitle>١. الفكرة</SectionTitle>
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="نوع المدخل" className="flex flex-wrap gap-2">
            {INPUT_KINDS.map((kind) => (
              <label
                key={kind.key}
                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  inputKind === kind.key ? "border-gold-500 bg-gold-100 text-navy-900" : "border-charcoal-200 text-charcoal-600"
                }`}
              >
                <input
                  type="radio"
                  name="inputKind"
                  value={kind.key}
                  checked={inputKind === kind.key}
                  onChange={() => setInputKind(kind.key)}
                  className="sr-only"
                />
                {kind.label}
              </label>
            ))}
          </div>

          <Field
            label={inputKind === "question" ? "اكتب سؤال المتابع" : inputKind === "situation" ? "اكتب الموقف" : "اكتب الموضوع"}
            hint="اكتب بالعامية أو بأي كلام واضح. ما تكتبش أسماء أشخاص حقيقيين."
          >
            <textarea
              required
              rows={4}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputClass}
              placeholder={inputKind === "question" ? "مثال: ليه بقيت أفكر في اللي سابني كل ليلة؟" : "مثال: الخوف من الهجر وإزاي بيخلي الواحد يقبل أقل من اللي يستحقه"}
            />
          </Field>

          {topics.length > 0 && (
            <Field label="من المكتبة (اختياري)">
              <select className={inputClass} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">بدون اختيار من المكتبة</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title} — {topic.categoryLabel}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>٢. نوع الريلز</SectionTitle>
        <div role="radiogroup" aria-label="وضع الريلز" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODES.map((item) => (
            <label
              key={item.key}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                mode === item.key ? "border-gold-500 bg-gold-100/60" : "border-charcoal-200 hover:border-navy-700/40"
              }`}
            >
              <input type="radio" name="mode" value={item.key} checked={mode === item.key} onChange={() => setMode(item.key)} className="sr-only" />
              <span className="block text-sm font-bold text-navy-900">{item.label}</span>
              <span className="mt-0.5 block text-xs text-charcoal-600">{item.description}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>٣. الهدف والمدة والدعوة</SectionTitle>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="الهدف">
            <select className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="الدعوة (CTA)">
            <select className={inputClass} value={ctaType} onChange={(e) => setCtaType(e.target.value)}>
              {CTA_TYPES.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-charcoal-800">مدة الفيديو</span>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  type="button"
                  onClick={() => setDuration(preset.seconds)}
                  aria-pressed={duration === preset.seconds}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    duration === preset.seconds ? "border-gold-500 bg-gold-100 text-navy-900" : "border-charcoal-200 text-charcoal-600"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-sm text-charcoal-600" htmlFor="custom-duration">مدة مخصصة (ثانية)</label>
              <input
                id="custom-duration"
                type="number"
                inputMode="numeric"
                min={MIN_DURATION_SECONDS}
                max={MAX_DURATION_SECONDS}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={`${inputClass} w-28`}
              />
            </div>
            {!durationValid && (
              <p className="mt-1 text-xs text-danger">المدة لازم تكون بين {MIN_DURATION_SECONDS} و{MAX_DURATION_SECONDS} ثانية.</p>
            )}
          </div>

          <Field label="المنصة (اختياري)">
            <select className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">لم تُحدد</option>
              {PLATFORMS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-start gap-3 rounded-xl border border-charcoal-200 p-3 text-sm">
            <input
              type="checkbox"
              checked={useMyVoice}
              onChange={(e) => setUseMyVoice(e.target.checked)}
              className="mt-1 size-4 accent-navy-800"
            />
            <span>
              <span className="block font-semibold text-navy-900">اكتب بطريقتي</span>
              <span className="text-xs text-charcoal-600">
                يستخدم عينات كلامك من صفحة «أسلوبي». لازم تكون ضفت عينات هناك.
              </span>
            </span>
          </label>
        </div>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="sticky bottom-3 flex flex-col gap-3 rounded-2xl bg-navy-900 p-4 shadow-lg md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-white/80">
          {busy ? <Spinner label="بنكتب السكريبت... ممكن ياخد دقيقة" /> : "هيتعمل 3 افتتاحيات، والسكريبت كامل، ومراجعة جودة قبل ما يظهر."}
        </p>
        <Button variant="gold" type="submit" disabled={!canSubmit} className="w-full md:w-auto">
          اكتب السكريبت
        </Button>
      </div>
    </form>
  );
}
