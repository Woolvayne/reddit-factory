"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Clapperboard, Lock, ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";

function GateForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.href = params.get("next") || "/";
        return;
      }
      setError(data?.error?.message ?? "Anmeldung fehlgeschlagen.");
      setPassword("");
    } catch {
      setError("Server nicht erreichbar. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-sm px-5 rise">
      <div className="panel p-8 sm:p-10 glow-breathe">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000 40%))",
              boxShadow: "0 10px 34px -8px var(--glow)",
              color: "var(--on-accent)",
            }}
          >
            <Clapperboard size={26} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reddit Story</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
            KI-Story-Video-Studio.
            <br />
            Bitte gib das Zugangs-Passwort ein.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-3.5">
          <div className="relative">
            <Lock
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--faint)" }}
            />
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              className="input pl-10"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p
              className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug"
              style={{
                color: "var(--danger)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              }}
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-accent w-full !py-3" disabled={busy || !password}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <>
                Studio öffnen <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div
          className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-medium"
          style={{ color: "var(--faint)" }}
        >
          <ShieldCheck size={12} />
          Geschützt über APP_PASSWORD (Environment Variable)
        </div>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      {/* dezente Akzent-Orbits im Hintergrund */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, var(--glow) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />
      <Suspense>
        <GateForm />
      </Suspense>
    </main>
  );
}
