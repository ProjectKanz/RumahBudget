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
  cyan: "text-slate-100",
  fuchsia: "text-slate-100",
  lime: "text-lime-200",
  neutral: "text-slate-300",
  rose: "text-orange-200",
};

const toneAccent: Record<Tone, string> = {
  amber: "text-amber-300",
  cyan: "text-lime-300",
  fuchsia: "text-amber-300",
  lime: "text-lime-300",
  neutral: "text-slate-300",
  rose: "text-orange-300",
};

const toneBorder: Record<Tone, string> = {
  amber: "ledger-tone-warning",
  cyan: "ledger-tone-neutral",
  fuchsia: "ledger-tone-neutral",
  lime: "ledger-tone-positive",
  neutral: "ledger-tone-neutral",
  rose: "ledger-tone-danger",
};

const toneNotice: Record<Tone, string> = {
  amber: "ledger-notice ledger-notice--warning",
  cyan: "ledger-notice",
  fuchsia: "ledger-notice",
  lime: "ledger-notice ledger-notice--positive",
  neutral: "ledger-notice",
  rose: "ledger-notice ledger-notice--danger",
};

export function TerminalPanel({
  children,
  className = "",
  isProminent = false,
}: BaseProps & { isProminent?: boolean }) {
  return (
    <div
      className={cn(
        "ledger-panel p-6 sm:p-8",
        isProminent && "ledger-panel--raised",
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
            "ledger-eyebrow",
            toneAccent[tone],
          )}
        >
          {eyebrow}
        </p>
        <h2 className="ledger-section-title mt-2">
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
    <div className={cn("ledger-panel p-6", toneBorder[tone], className)}>
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
      ? "ledger-button--primary"
      : variant === "danger"
        ? "ledger-button--danger"
        : "ledger-button--secondary";

  return (
    <button
      className={cn(
        "ledger-button min-h-11 px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55",
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
        "ledger-input mt-2 min-h-12 w-full px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60",
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
        "ledger-input mt-2 min-h-12 w-full appearance-none px-4 py-3 text-sm text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
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
        "ledger-state-tag px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em]",
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
        "ledger-empty px-4 py-8 text-center text-sm text-slate-400",
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
        "ledger-tabs grid w-full min-w-0 gap-2 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          className={cn(
            "flex min-h-11 min-w-0 items-center justify-center overflow-hidden px-4 py-2 text-center text-xs font-black uppercase tracking-[0.06em] transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50 sm:text-sm sm:tracking-[0.08em]",
            value === option.value
              ? "ledger-tab ledger-tab--active"
              : "ledger-tab",
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
    <div className={cn("ledger-check border p-4", className)}>{children}</div>
  );
}
