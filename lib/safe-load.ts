import { AppError } from "./errors";

export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string; code: string };

/**
 * يحمّل بيانات الصفحة ولا يرمي الخطأ: الصفحة تعرض رسالة إعداد واضحة بدل شاشة انهيار.
 */
export async function safeLoad<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message, code: error.code };
    }
    console.error("[page] load failed", error);
    return { ok: false, message: "تعذر تحميل البيانات. حاول تاني بعد شوية.", code: "INTERNAL" };
  }
}
