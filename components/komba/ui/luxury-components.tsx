"use client";

import React from "react";

// Glassmorphism card with luxury styling
export function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-white/[0.08] bg-[rgba(15,46,58,0.82)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div>
      {eyebrow && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9dafb5]">{eyebrow}</p>}
      <h2 className="font-[family-name:var(--font-manrope)] text-[1.4rem] font-light tracking-wide text-[#f8f5ef]">{title}</h2>
      {subtitle && <p className="mt-2 text-sm font-light text-[#9dafb5]">{subtitle}</p>}
    </div>
  );
}

export function LuxuryBadge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "petrol" | "ocean" | "danger" | "gold" }) {
  const styles = {
    default: "bg-white/5 border-white/10 text-[#c9d1cf]",
    petrol: "bg-[#8fae92]/15 border-[#8fae92]/25 text-[#8fae92]",
    ocean: "bg-[#7fa8b8]/15 border-[#7fa8b8]/25 text-[#7fa8b8]",
    danger: "bg-[#bc7d67]/15 border-[#bc7d67]/25 text-[#bc7d67]",
    gold: "bg-[#c59b5b]/15 border-[#c59b5b]/25 text-[#c59b5b]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[variant]}`}>
      {children}
    </span>
  );
}

export function LuxuryButton({ children, variant = "gold", className = "", ...props }: { children: React.ReactNode; variant?: "gold" | "petrol" | "ocean" | "ghost" | "danger"; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    gold: "bg-gradient-to-r from-[#e8c88a] via-[#c59b5b] to-[#8f6d3a] text-[#0a2029] shadow-[0_4px_20px_rgba(197,155,91,0.25)] hover:shadow-[0_6px_28px_rgba(197,155,91,0.35)]",
    petrol: "bg-gradient-to-r from-[#8fae92] to-[#526b55] text-[#0a2029] shadow-[0_4px_20px_rgba(143,174,146,0.25)] hover:shadow-[0_6px_28px_rgba(143,174,146,0.35)]",
    ocean: "bg-gradient-to-r from-[#7fa8b8] to-[#4e8296] text-[#0a2029] shadow-[0_4px_20px_rgba(127,168,184,0.25)] hover:shadow-[0_6px_28px_rgba(127,168,184,0.35)]",
    ghost: "bg-white/[0.03] border border-white/10 text-[#c9d1cf] hover:bg-white/[0.06] hover:border-white/15",
    danger: "bg-gradient-to-r from-[#bc7d67] to-[#905c4a] text-white shadow-[0_4px_20px_rgba(188,125,103,0.25)] hover:shadow-[0_6px_28px_rgba(188,125,103,0.35)]",
  };
  return (
    <button className={`rounded-[1.2rem] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Stabilna input komponenta - uporablja onBlur namesto onChange za preprečevanje izgube fokusa
export function LuxuryInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const initialValue = React.useRef(String(value));
  
  // Update initial value when external value changes and input is not focused
  React.useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(value);
      initialValue.current = String(value);
    }
  }, [value]);
  
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">{label}</label>
      <input
        ref={inputRef}
        type={type}
        className="w-full rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[#f8f5ef] placeholder:text-[#43616d] transition-all duration-300 focus:border-[#c59b5b]/40 focus:outline-none focus:ring-2 focus:ring-[#c59b5b]/10"
        defaultValue={String(value)}
        onBlur={e => {
          if (e.target.value !== initialValue.current) {
            onChange(e.target.value);
            initialValue.current = e.target.value;
          }
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

export function LuxurySelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[] }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</label>
      <select
        className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-5 py-3 text-white transition-all duration-300 focus:border-[#c59b5b]/50 focus:outline-none focus:ring-2 focus:ring-[#c59b5b]/20 cursor-pointer"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => typeof opt === "string" ? <option key={opt} value={opt} className="bg-[#0a2029] text-white">{opt || "—"}</option> : <option key={opt.value} value={opt.value} className="bg-[#0a2029] text-white">{opt.label}</option>)}
      </select>
    </div>
  );
}

export function LuxuryCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-white/70 transition-colors hover:text-white">
      <div className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${checked ? "border-[#c59b5b] bg-[#c59b5b]" : "border-white/20 bg-white/5"}`}>
        {checked && <span className="text-[#0a2029] text-xs">✓</span>}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}
