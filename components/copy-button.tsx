"use client";

import { useState } from "react";
import { Button } from "./ui";

/** ينسخ نصًا للحافظة ويعرض تأكيدًا مؤقتًا. لو المتصفح ما يدعمش الحافظة يعرض رسالة بدل ما يفشل بصمت */
export function CopyButton({ text, label, variant = "outline" }: { text: string; label: string; variant?: "outline" | "gold" | "primary" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const shown = state === "copied" ? "تم النسخ ✓" : state === "failed" ? "انسخ يدويًا" : label;

  return (
    <Button variant={variant} onClick={copy} aria-live="polite" disabled={!text.trim()}>
      {shown}
    </Button>
  );
}
