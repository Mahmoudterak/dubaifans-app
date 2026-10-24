import { createHmac, timingSafeEqual } from "node:crypto";
import type { Env } from "../env";

/**
 * حماية بسيطة لتطبيق لمالك واحد: كلمة مرور من البيئة، وجلسة موقّعة بـ HMAC في كوكي httpOnly.
 * كلمة المرور لا تُخزَّن في الكوكي أبدًا، وإنما توقيع يمكن التحقق منه فقط بالسر.
 */

export const SESSION_COOKIE = "mt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthConfig {
  /** هل الحماية مفعّلة؟ */
  enabled: boolean;
  /** إعداد ناقص في الإنتاج: يجب أن يغلق التطبيق بدل أن يفتح بدون حماية */
  misconfigured: boolean;
  password: string;
  secret: string;
}

export function readAuthConfig(env: Env = process.env): AuthConfig {
  const password = env.APP_PASSWORD?.trim() ?? "";
  const secret = env.APP_SESSION_SECRET?.trim() ?? "";
  const isProduction = env.NODE_ENV === "production";

  if (!password) {
    // في التطوير المحلي نسمح بالعمل بدون كلمة مرور، أما الإنتاج فيُغلق
    return { enabled: false, misconfigured: isProduction, password: "", secret: "" };
  }
  return {
    enabled: true,
    misconfigured: secret.length < 16,
    password,
    secret,
  };
}

export function sessionTokenFor(config: AuthConfig): string {
  return createHmac("sha256", config.secret).update("mt-reels-owner-session").digest("hex");
}

function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isValidSessionToken(config: AuthConfig, token: string | undefined): boolean {
  if (!config.enabled || !token) return false;
  return safeEqualStrings(token, sessionTokenFor(config));
}

export function isValidPassword(config: AuthConfig, candidate: string): boolean {
  // نقارن توقيعين بطول ثابت حتى لا نكشف طول كلمة المرور
  const sign = (value: string) => createHmac("sha256", config.secret).update(value).digest("hex");
  return safeEqualStrings(sign(candidate), sign(config.password));
}
