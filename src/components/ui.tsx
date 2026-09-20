"use client";

import { ReactNode } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";

/** Aufklappbare Sektion (Accordion) für die Steuerleiste. */
export function Section({
  icon: Icon,
  title,
  sub,
  children,
  defaultOpen = false,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  return (
    <details className="section panel overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center gap-3 px-4 py-3.5 sm:px-5 select-none">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
        >
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold tracking-tight">{title}</span>
          {sub && (
            <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>
              {sub}
            </span>
          )}
        </span>
        {badge}
        <ChevronDown size={16} className="chev shrink-0" style={{ color: "var(--faint)" }} />
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--faint)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="label !mb-0">{label}</label>
        <span className="mono text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${pct}%` }}
      />
    </div>
  );
}

export function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
      onClick={() => onChange(!checked)}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{label}</span>
        {desc && (
          <span className="block text-[11px] leading-snug" style={{ color: "var(--faint)" }}>
            {desc}
          </span>
        )}
      </span>
      <span className="toggle" data-on={checked} />
    </button>
  );
}

/** Segmente/Umschalter */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex rounded-xl p-1"
      style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className="flex-1 rounded-lg px-2 py-1.5 text-[12px] font-bold transition-all"
          style={
            o.value === value
              ? { background: "var(--accent)", color: "var(--on-accent)", boxShadow: "0 4px 14px -4px var(--glow)" }
              : { color: "var(--muted)" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
