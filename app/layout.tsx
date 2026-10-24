import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "MT Reels AI",
  description: "مساعد كتابة سكريبتات الريلز النفسية لمحمود طارق",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1a33",
};

const NAV_ITEMS = [
  { href: "/", label: "الرئيسية" },
  { href: "/scripts/new", label: "سكريبت جديد" },
  { href: "/scripts", label: "المحفوظة" },
  { href: "/topics", label: "المكتبة" },
  { href: "/calendar", label: "التقويم" },
  { href: "/quality", label: "الجودة" },
  { href: "/settings/style", label: "أسلوبي" },
  { href: "/settings/ai", label: "النموذج" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-20 border-b border-navy-800/10 bg-navy-900 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gold-500 text-sm text-navy-900">MT</span>
              <span>Reels AI</span>
            </Link>
            <SignOutButton />
          </div>
          <nav aria-label="القائمة الرئيسية" className="border-t border-white/10">
            <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 text-sm [scrollbar-width:none]">
              {NAV_ITEMS.map((item) => (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-1.5 text-white/85 transition hover:bg-white/10 hover:text-gold-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-charcoal-600">
          الكلام هنا تثقيف نفسي عام، ولا يغني عن التقييم المتخصص عند الحاجة.
        </footer>
      </body>
    </html>
  );
}
