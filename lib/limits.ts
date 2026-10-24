import { FixedWindowLimiter } from "./rate-limit";

const HOUR_MS = 60 * 60 * 1000;

let generation: FixedWindowLimiter | null = null;
let login: FixedWindowLimiter | null = null;

/** حد طلبات التوليد لكل مستخدم في الساعة. يُضبط من GENERATION_RATE_LIMIT_PER_HOUR */
export function generationLimiter(): FixedWindowLimiter {
  if (!generation) {
    const configured = Number(process.env.GENERATION_RATE_LIMIT_PER_HOUR);
    const limit = Number.isFinite(configured) && configured > 0 ? configured : 30;
    generation = new FixedWindowLimiter(limit, HOUR_MS);
  }
  return generation;
}

/** حد محاولات تسجيل الدخول: 10 محاولات في 15 دقيقة لكل عنوان */
export function loginLimiter(): FixedWindowLimiter {
  if (!login) login = new FixedWindowLimiter(10, 15 * 60 * 1000);
  return login;
}
