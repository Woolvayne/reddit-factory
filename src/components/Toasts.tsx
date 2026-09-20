"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useStudio } from "@/lib/client/store";

/** Jede Fehlermeldung bekommt ihren eigenen, eindeutigen Toast. */
export default function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  const dismiss = useStudio((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end">
      {toasts.map((t) => {
        const Icon = t.kind === "error" ? CircleAlert : t.kind === "ok" ? CircleCheck : Info;
        const color =
          t.kind === "error" ? "var(--danger)" : t.kind === "ok" ? "var(--ok)" : "var(--accent)";
        return (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              background: "color-mix(in srgb, var(--panel) 94%, black 6%)",
              border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
              boxShadow: "0 18px 50px -12px rgba(0,0,0,0.55)",
            }}
            role="alert"
          >
            <Icon size={17} className="mt-0.5 shrink-0" style={{ color }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold leading-snug">{t.text}</p>
              {t.detail && (
                <p
                  className="mt-1 break-words text-[11px] leading-snug mono"
                  style={{ color: "var(--muted)" }}
                >
                  {t.detail}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--panel-3)]"
              style={{ color: "var(--faint)" }}
              aria-label="Schließen"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
