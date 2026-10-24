"use client";

import { useState, type FormEvent } from "react";
import { CTA_TYPES, DURATION_PRESETS } from "@/lib/script/catalog";
import type { Preferences } from "@/lib/repo/preferences";
import { Button, Card, Field, Notice, SectionTitle, inputClass } from "./ui";

export function StyleForm({ initial }: { initial: Preferences }) {
  const [form, setForm] = useState<Preferences>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
        setMessage({ tone: "error", text: data?.error?.message ?? "تعذر الحفظ." });
        return;
      }
      setMessage({ tone: "success", text: "اتحفظ أسلوبك. هيتطبق على السكريبتات الجاية." });
    } catch {
      setMessage({ tone: "error", text: "مفيش اتصال بالخادم دلوقتي." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Card>
        <SectionTitle>الأساسيات</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="اللهجة">
            <select className={inputClass} value={form.dialect} onChange={(e) => update("dialect", e.target.value as Preferences["dialect"])}>
              <option value="egyptian">مصرية بسيطة</option>
              <option value="msa_simple">فصحى مبسطة</option>
            </select>
          </Field>
          <Field label="النبرة">
            <select className={inputClass} value={form.tone} onChange={(e) => update("tone", e.target.value as Preferences["tone"])}>
              <option value="direct">مباشر وواقعي</option>
              <option value="warm">دافئ وقريب</option>
              <option value="calm">هادي ومتأني</option>
            </select>
          </Field>
          <Field label="المدة الافتراضية (ثانية)">
            <select className={inputClass} value={form.defaultDurationSeconds} onChange={(e) => update("defaultDurationSeconds", Number(e.target.value))}>
              {DURATION_PRESETS.map((p) => <option key={p.seconds} value={p.seconds}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="الدعوة الافتراضية">
            <select className={inputClass} value={form.defaultCtaType} onChange={(e) => update("defaultCtaType", e.target.value as Preferences["defaultCtaType"])}>
              {CTA_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>صوتك</SectionTitle>
        <div className="flex flex-col gap-4">
          <Field label="عبارات بتستخدمها كتير" hint="اكتبها مفصولة بفاصلة، والتطبيق هيحاول يستخدمها بشكل طبيعي">
            <input className={inputClass} value={form.signaturePhrases} maxLength={1000} onChange={(e) => update("signaturePhrases", e.target.value)} placeholder="مثال: خليك واقعي، الموضوع مش عيب" />
          </Field>
          <Field label="عبارات ما تحبش تظهر في كلامك" hint="اكتبها مفصولة بفاصلة">
            <input className={inputClass} value={form.avoidPhrases} maxLength={1000} onChange={(e) => update("avoidPhrases", e.target.value)} placeholder="مثال: ماتقلقش، كل حاجة هتتحل" />
          </Field>
          <Field label="عينات من كلامك الحقيقي" hint="الصق هنا كلام بتقوله في فيديوهاتك أو نص من كتاباتك. بتتستخدم فقط لما تفعّل «اكتب بطريقتي». (حتى 8000 حرف)">
            <textarea className={inputClass} rows={8} value={form.styleSamples} maxLength={8000} onChange={(e) => update("styleSamples", e.target.value)} />
          </Field>
        </div>
      </Card>

      <div>
        <Button type="submit" variant="gold" disabled={busy}>
          {busy ? "بنحفظ..." : "احفظ الأسلوب"}
        </Button>
      </div>
    </form>
  );
}
