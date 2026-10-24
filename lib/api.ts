import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { AppError, toErrorBody } from "./errors";

/** يغلّف معالج الـ route: أي خطأ يتحول لرد JSON موحّد بدون تسريب تفاصيل داخلية */
export function apiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (!(error instanceof AppError)) {
        console.error("[api] unexpected error", error);
      }
      const { status, body } = toErrorBody(error);
      return NextResponse.json(body, { status });
    }
  };
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** يقرأ JSON من الطلب ويتحقق منه بالمخطط. يرمي VALIDATION_FAILED برسالة عربية واضحة. */
export async function readJson<T>(request: NextRequest | Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("VALIDATION_FAILED", "الطلب لازم يكون JSON صالح.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw new AppError("VALIDATION_FAILED", field ? `الحقل ${field}: ${issue?.message}` : (issue?.message ?? "بيانات غير صالحة"));
  }
  return result.data;
}

export function parseParams<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("VALIDATION_FAILED", "معرّف غير صالح");
  return result.data;
}
