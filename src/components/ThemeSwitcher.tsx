"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { THEMES, ThemeId } from "@/lib/shared";

/** Farb-Auswahl oben rechts: Schwarz, Weiß, Rot, Orange, Blau. */
export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("black");

  useEffect(() => {
    try {
      setTheme((localStorage.getItem("rs-theme") as ThemeId) || "black");
    } catch {
      /* noop */
    }
  }, []);

  const apply = (t: ThemeId) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("rs-theme", t);
    } catch {
      /* noop */
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2 py-1.5"
      style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
      role="radiogroup"
      aria-label="Farbschema"
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          aria-label={`Theme ${t.label}`}
          onClick={() => apply(t.id)}
          className="relative h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95"
          style={{
            background: t.dot,
            border: `1.5px solid ${theme === t.id ? "var(--accent)" : "var(--line-strong)"}`,
            boxShadow: theme === t.id ? "0 0 0 3px var(--glow)" : undefined,
          }}
        >
          {theme === t.id && (
            <Check
              size={12}
              strokeWidth={3.5}
              className="absolute inset-0 m-auto"
              style={{ color: t.id === "white" ? "#111" : t.id === "black" ? "#fff" : "var(--on-accent)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
