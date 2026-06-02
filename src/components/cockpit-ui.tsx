"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

type Tone = "cyan" | "fuchsia" | "lime" | "rose" | "amber" | "neutral";

function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

const toneText: Record<Tone, string> = {
  amber: "text-amber-200",
  cyan: "text-cyan-100",
  fuchsia: "text-fuchsia-100",
  lime: "text-lime-200",
  neutral: "text-slate-300",
  rose: "text-rose-200",
};

const toneAccent: Record<Tone, string> = {
  amber: "text-amber-300",
  cyan: "text-cyan-300",
  fuchsia: "text-fuchsia-300",
  lime: "text-lime-300",
  neutral: "text-slate-300",
  rose: "text-rose-300",
};

const toneBorder: Record<Tone, string> = {
  amber: "border-amber-300/25",
  cyan: "border-cyan-300/25",
  fuchsia: "border-fuchsia-300/25",
  lime: "border-lime-300/25",
  neutral: "border-white/10",
  rose: "border-rose-300/25",
};

const toneNotice: Record<Tone, string> = {
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  fuchsia: "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100",
  lime: "border-lime-300/25 bg-lime-300/10 text-lime-100",
  neutral: "border-white/10 bg-white/[0.03] text-slate-300",
  rose: "border-rose-300/35 bg-rose-300/10 text-rose-100",
};

export function TerminalPanel({
  children,
  className = "",
  isProminent = false,
}: BaseProps & { isProminent?: boolean }) {
  return (
    <div
      className={cn(
        "glass-frosted p-6 sm:p-8",
        isProminent && "shadow-[0_0_36px_rgba(34,211,238,0.15)] border-cyan-300/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  action,
  className = "",
  description,
  eyebrow,
  title,
  tone = "cyan",
}: {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow: string;
  title: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl min-w-0">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.32em]",
            toneAccent[tone],
          )}
        >
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricCell({
  action,
  className = "",
  description,
  label,
  tone = "cyan",
  value,
}: {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  label: string;
  tone?: Tone;
  value: ReactNode;
}) {
  return (
    <div className={cn("glass-frosted p-6", toneBorder[tone], className)}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={cn("text-sm font-medium", toneText[tone])}>{label}</p>
            <div className="numeric-value mt-3 text-3xl font-black leading-none text-white sm:text-4xl">
              {value}
            </div>
          </div>
          {action}
        </div>
        {description ? (
          <p className="mt-auto text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SharpButton({
  children,
  className = "",
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const variantClass =
    variant === "primary"
      ? "border-cyan-200/60 bg-cyan-300 text-slate-950 hover:bg-cyan-200 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)]"
      : variant === "danger"
        ? "border-rose-300/35 text-rose-100 hover:border-rose-300/70 hover:bg-rose-300/10"
        : "border-white/10 text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-300/10";

  return (
    <button
      className={cn(
        "min-h-11 border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55",
        variantClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SharpInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "mt-2 min-h-12 w-full border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function SharpSelect({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "mt-2 min-h-12 w-full appearance-none border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function StatusChip({
  children,
  className = "",
  tone = "cyan",
}: BaseProps & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "status-chip border px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.22em]",
        toneBorder[tone],
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  children,
  className = "",
  tone = "neutral",
}: BaseProps & { tone?: Tone }) {
  return (
    <p
      className={cn(
        "border px-4 py-3 text-sm leading-6",
        toneNotice[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}

export function EmptyState({
  children,
  className = "",
}: BaseProps) {
  return (
    <div
      className={cn(
        "border border-dashed border-cyan-300/20 bg-cyan-300/5 px-4 py-8 text-center text-sm text-slate-400",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  className = "",
  onChange,
  options,
  value,
}: {
  className?: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 gap-2 border border-white/10 bg-black/30 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          className={cn(
            "flex min-h-11 min-w-0 items-center justify-center overflow-hidden px-4 py-2 text-center text-xs font-black uppercase tracking-[0.06em] transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50 sm:text-sm sm:tracking-[0.08em]",
            value === option.value
              ? "cockpit-nav-active text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.22)]"
              : "text-slate-300 hover:bg-white/10 hover:text-white",
          )}
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function NumberValue({
  children,
  className = "",
}: BaseProps) {
  return <span className={cn("numeric-value", className)}>{children}</span>;
}

export function SystemReading({
  children,
  className = "",
}: BaseProps) {
  return (
    <div className={cn("system-reading border p-4", className)}>{children}</div>
  );
}
