import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiHandler, ok, readJson } from "@/lib/api";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, isValidPassword, readAuthConfig, sessionTokenFor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { loginLimiter } from "@/lib/limits";
import { loginSchema } from "@/lib/validation";

function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return (forwarded ?? request.nextUrl.protocol.replace(":", "")) === "https";
}

export const POST = apiHandler(async (request: NextRequest) => {
  const auth = readAuthConfig();
  if (!auth.enabled) return ok({ ok: true });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = loginLimiter().hit(ip);
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", `محاولات كتير. استنى ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة.`);
  }

  const { password } = await readJson(request, loginSchema);
  if (!isValidPassword(auth, password)) {
    throw new AppError("UNAUTHORIZED", "كلمة المرور غير صحيحة.");
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionTokenFor(auth), {
    httpOnly: true,
    sameSite: "lax",
    // Secure يُضبط حسب بروتوكول الطلب نفسه، فالتشغيل المحلي على http يعمل والإنتاج على https يبقى محميًا
    secure: isHttps(request),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
});
