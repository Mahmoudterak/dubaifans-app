/**
 * عدّاد نافذة ثابتة في الذاكرة. يكفي لحماية التكلفة على نسخة خادم واحدة.
 * ملاحظة: على بيئات serverless متعددة الحاويات يكون العداد لكل حاوية،
 * ولحماية صارمة عبر كل النسخ استخدم مخزنًا مشتركًا مثل Redis أو قاعدة البيانات.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class FixedWindowLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): LimitResult {
    const current = this.now();
    this.sweep(current);

    const state = this.windows.get(key);
    if (!state || state.resetAt <= current) {
      this.windows.set(key, { count: 1, resetAt: current + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterSeconds: 0 };
    }

    if (state.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((state.resetAt - current) / 1000),
      };
    }

    state.count += 1;
    return { allowed: true, remaining: this.limit - state.count, retryAfterSeconds: 0 };
  }

  private sweep(current: number): void {
    if (this.windows.size < 1000) return;
    for (const [key, state] of this.windows) {
      if (state.resetAt <= current) this.windows.delete(key);
    }
  }
}
