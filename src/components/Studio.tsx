"use client";

import { useEffect } from "react";
import { Clapperboard, LoaderCircle, Lock, Sparkles } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import Toasts from "@/components/Toasts";
import BayGrid from "@/components/BayGrid";
import { AiSection, AssetsSection, DesignSection, FormatNote, TtsSection } from "@/components/sections-production";
import { AutopilotSection, BufferSection } from "@/components/sections-publishing";
import { useStudio } from "@/lib/client/store";

function Header() {
  const settingsSaving = useStudio((s) => s.settingsSaving);
  const settingsLoaded = useStudio((s) => s.settingsLoaded);

  const lock = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/gate";
    }
  };

  return (
    <header className="sticky top-0 z-40" style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)", backdropFilter: "blur(16px)" }}>
      <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-3.5 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000 40%))",
              color: "var(--on-accent)",
              boxShadow: "0 8px 26px -8px var(--glow)",
            }}
          >
            <Clapperboard size={20} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-bold leading-tight tracking-tight">Reddit Story</h1>
            <p className="truncate text-[11px] font-medium" style={{ color: "var(--muted)" }}>
              KI-Story-Video-Studio
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold sm:flex" style={{ color: "var(--faint)" }}>
            {settingsSaving ? (
              <>
                <LoaderCircle size={11} className="spin" /> Speichert…
              </>
            ) : settingsLoaded ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)" }} />
                Gespeichert
              </>
            ) : null}
          </span>
          <ThemeSwitcher />
          <button type="button" className="btn btn-icon !rounded-full" title="Studio sperren (Abmelden)" onClick={lock}>
            <Lock size={14} />
          </button>
        </div>
      </div>
      <div className="h-px" style={{ background: "var(--line)" }} />
    </header>
  );
}

/** Mobile Aktionsleiste unten (Schnellzugriff). */
function MobileActionBar() {
  const bays = useStudio((s) => s.bays);
  const settings = useStudio((s) => s.settings);
  const generateAll = useStudio((s) => s.generateAll);
  const downloadZip = useStudio((s) => s.downloadZip);

  const count = Math.min(settings.bayCount, bays.length);
  const shown = bays.slice(0, count);
  const doneCount = shown.filter((b) => b.status === "done").length;
  const workingCount = shown.filter((b) => ["story", "tts", "render"].includes(b.status)).length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 lg:hidden" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <div
        className="mx-auto flex max-w-md items-center gap-2 rounded-2xl p-2"
        style={{
          background: "color-mix(in srgb, var(--panel) 92%, black 8%)",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 18px 50px -12px rgba(0,0,0,0.6)",
        }}
      >
        <button type="button" className="btn btn-accent flex-1" onClick={generateAll} disabled={workingCount > 0}>
          <Sparkles size={15} />
          {workingCount > 0 ? `Generiert… ${doneCount}/${count}` : `Alle ${count} generieren`}
        </button>
        <button
          type="button"
          className="btn btn-icon"
          onClick={downloadZip}
          disabled={doneCount === 0}
          title="Alle als ZIP laden"
        >
          <Sparkles size={0} className="hidden" />
          <span className="text-[11px] font-black">ZIP</span>
        </button>
      </div>
    </div>
  );
}

export default function Studio() {
  const init = useStudio((s) => s.init);
  const autopilotTick = useStudio((s) => s.autopilotTick);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const t = setInterval(() => {
      autopilotTick().catch(() => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [autopilotTick]);

  return (
    <div className="min-h-dvh pb-24 lg:pb-10">
      <Header />

      <main className="mx-auto max-w-[1680px] px-3.5 pt-5 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* Steuerleiste */}
          <div className="space-y-4 lg:sticky lg:top-[76px]">
            <AssetsSection />
            <AiSection />
            <TtsSection />
            <DesignSection />
            <BufferSection />
            <AutopilotSection />
            <FormatNote />
          </div>

          {/* Output-Bays */}
          <BayGrid />
        </div>

        <footer
          className="mt-10 border-t pt-5 pb-2 text-center text-[11px] leading-relaxed"
          style={{ borderColor: "var(--line)", color: "var(--faint)" }}
        >
          Reddit Story Studio · Rendering komplett im Browser · API-Keys liegen verschlüsselt auf dem Server ·
          Posting über die offizielle Buffer API
        </footer>
      </main>

      <MobileActionBar />
      <Toasts />
    </div>
  );
}
