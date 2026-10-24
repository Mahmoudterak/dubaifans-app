"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** ينهي الجلسة ثم ينتقل لصفحة الدخول العامة */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/10 disabled:opacity-50"
    >
      خروج
    </button>
  );
}
