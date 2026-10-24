import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // نقبل مسارات داخلية فقط لتفادي إعادة التوجيه لمواقع خارجية
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
      <PageHeader title="تسجيل الدخول" description="ادخل بكلمة مرور التطبيق." />
      <LoginForm next={safeNext} />
    </div>
  );
}
