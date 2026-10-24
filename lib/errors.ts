/**
 * خطأ تطبيقي له كود ثابت ورسالة عربية قابلة للعرض للمستخدم.
 * الكود يُستخدم في الواجهة والاختبارات، والرسالة تُعرض كما هي.
 */
export type AppErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "DATABASE_NOT_CONFIGURED"
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "AI_INVALID_OUTPUT"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  DATABASE_NOT_CONFIGURED: 503,
  AI_NOT_CONFIGURED: 503,
  AI_TIMEOUT: 504,
  AI_PROVIDER_ERROR: 502,
  AI_INVALID_OUTPUT: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function toErrorBody(error: unknown): { status: number; body: { error: { code: string; message: string } } } {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  // لا نكشف تفاصيل الأخطاء الداخلية للمستخدم
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "حصل خطأ غير متوقع. حاول مرة تانية." } },
  };
}
