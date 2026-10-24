import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "gold" | "ghost" | "danger" | "outline";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-navy-800 text-white hover:bg-navy-700",
  gold: "bg-gold-500 text-navy-900 hover:bg-gold-400",
  outline: "border border-charcoal-200 bg-surface text-charcoal-800 hover:border-navy-700",
  ghost: "text-navy-800 hover:bg-navy-800/5",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_STYLES[variant],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-charcoal-200/70 bg-surface p-5 shadow-sm md:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ number, children }: { number?: number; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-navy-900">
      {number !== undefined && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-100 text-sm text-navy-900">
          {number}
        </span>
      )}
      {children}
    </h2>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-charcoal-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "gold" | "success" | "danger";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-charcoal-600",
  gold: "bg-gold-100 text-navy-900",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>{children}</span>;
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: "border-navy-700/20 bg-navy-800/5 text-navy-900",
    warning: "border-gold-500/40 bg-gold-100 text-charcoal-800",
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {title && <p className="mb-1 font-bold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-charcoal-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-charcoal-600">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-charcoal-200 bg-surface px-3 py-2.5 text-sm text-charcoal-800 placeholder:text-charcoal-600/60 focus:border-navy-700 focus:outline-none";

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-charcoal-600" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" aria-hidden />
      {label}
    </span>
  );
}

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-charcoal-200 bg-surface px-6 py-10 text-center">
      <p className="text-base font-bold text-navy-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-charcoal-600">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge>بدون تقييم</Badge>;
  const tone: Tone = score >= 80 ? "success" : score >= 60 ? "gold" : "danger";
  return <Badge tone={tone}>جودة {score}</Badge>;
}
