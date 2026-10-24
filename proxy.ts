import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionToken, readAuthConfig } from "./lib/auth/session";

/**
 * بوابة الدخول: تحمي الصفحات والـ API بكلمة مرور واحدة من البيئة.
 * في الإنتاج يغلق التطبيق تمامًا إذا لم تُضبط الحماية، بدل أن يفتح بدونها.
 */

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export function proxy(request: NextRequest) {
  const authConfig = readAuthConfig();
  const { pathname } = request.nextUrl;

  if (authConfig.misconfigured) {
    return new NextResponse(
      "التطبيق مغلق: ضبط APP_PASSWORD و APP_SESSION_SECRET (16 حرفًا على الأقل) في البيئة.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (!authConfig.enabled || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionToken(authConfig, token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "سجّل الدخول أولًا." } },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
