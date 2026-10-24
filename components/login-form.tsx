"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Field, Notice, inputClass } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message: string } } | null;
        setError(data?.error?.message ?? "تعذر تسجيل الدخول.");
        return;
      }
      // انتقال كامل بدل راوتر التطبيق: صفحات سبقت الدخول ممكن تكون مخزّنة كإعادة توجيه لصفحة الدخول
      window.location.href = next;
    } catch {
      setError("مفيش اتصال بالخادم دلوقتي.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="كلمة المرور">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" disabled={busy || password.length === 0}>
          {busy ? "بنتحقق..." : "دخول"}
        </Button>
      </form>
    </Card>
  );
}
