"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Notice, SectionTitle, inputClass } from "./ui";

export interface CategoryView {
  slug: string;
  label: string;
}

export interface TopicView {
  id: string;
  category: string;
  title: string;
  notes: string;
}

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

export function TopicsManager({ categories, topics }: { categories: CategoryView[]; topics: TopicView[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [category, setCategory] = useState(categories[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await task();
    setBusy(false);
    if (message) setError(message);
    else router.refresh();
  }

  function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return run(async () => {
      const message = await send("/api/topics", { method: "POST", body: JSON.stringify({ category, title, notes }) });
      if (!message) {
        setTitle("");
        setNotes("");
      }
      return message;
    });
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return run(async () => {
      const message = await send("/api/topic-categories", { method: "POST", body: JSON.stringify({ label: newCategory }) });
      if (!message) setNewCategory("");
      return message;
    });
  }

  function removeTopic(id: string) {
    if (!window.confirm("تحذف الموضوع ده من المكتبة؟")) return;
    return run(() => send(`/api/topics/${id}`, { method: "DELETE" }));
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}

      <Card>
        <SectionTitle>أضف موضوع للمكتبة</SectionTitle>
        <form onSubmit={addTopic} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="التصنيف">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} required>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="عنوان الموضوع">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={200} placeholder="مثال: ليه بنشتاق لعلاقة كانت بتوجعنا" />
          </Field>
          <div className="md:col-span-2">
            <Field label="ملاحظات (اختياري)">
              <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </Field>
          </div>
          <div>
            <Button type="submit" disabled={busy || title.trim().length < 2 || !category}>أضف للمكتبة</Button>
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle>أضف تصنيف جديد</SectionTitle>
        <form onSubmit={addCategory} className="flex flex-col gap-2 md:flex-row">
          <input className={inputClass} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} minLength={2} maxLength={160} placeholder="اسم التصنيف النفسي الجديد" />
          <Button type="submit" variant="outline" disabled={busy || newCategory.trim().length < 2}>أضف التصنيف</Button>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const items = topics.filter((t) => t.category === cat.slug);
          return (
            <Card key={cat.slug}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-navy-900">{cat.label}</h2>
                <span className="text-xs text-charcoal-600">{items.length} موضوع</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-charcoal-600">لسه مفيش مواضيع في التصنيف ده.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((topic) => (
                    <li key={topic.id} className="flex flex-col gap-2 rounded-xl bg-canvas p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-charcoal-800">{topic.title}</p>
                        {topic.notes && <p className="text-xs text-charcoal-600">{topic.notes}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <a
                          href={`/scripts/new?topic=${topic.id}`}
                          className="inline-flex min-h-9 items-center rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white"
                        >
                          اكتب سكريبت
                        </a>
                        <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => removeTopic(topic.id)} disabled={busy}>
                          حذف
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
