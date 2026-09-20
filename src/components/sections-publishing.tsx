"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CalendarClock,
  CircleStop,
  Copy,
  FlaskConical,
  ListVideo,
  LoaderCircle,
  Play,
  RefreshCw,
  Send,
} from "lucide-react";
import { Field, Section, Seg, Slider } from "@/components/ui";
import { useStudio } from "@/lib/client/store";
import { VIDEO_DESCRIPTION } from "@/lib/shared";

/* ---------- Buffer ---------- */

export function BufferSection() {
  const settings = useStudio((s) => s.settings);
  const save = useStudio((s) => s.saveSettings);
  const channels = useStudio((s) => s.bufferChannels);
  const channelsLoading = useStudio((s) => s.bufferChannelsLoading);
  const fetchChannels = useStudio((s) => s.fetchChannels);
  const testBuffer = useStudio((s) => s.testBuffer);
  const toast = useStudio((s) => s.toast);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const scheduleStartValue = settings.scheduleStart || "";

  return (
    <Section
      icon={Send}
      title="Buffer (Posting & Planung)"
      sub={settings.bufferChannelName ? `Kanal: ${settings.bufferChannelName}` : "API-Key, Kanal, Zeitschema"}
    >
      <Field
        label="Buffer API-Key"
        hint="Erstellen unter publish.buffer.com/settings/api – erlaubt Zugriff auf deinen Account."
      >
        <input
          type="password"
          className="input mono"
          placeholder="1/29abc…"
          autoComplete="off"
          value={settings.bufferToken}
          onChange={(e) => save({ bufferToken: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          className="btn"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            await testBuffer();
            setTesting(false);
          }}
        >
          {testing ? <LoaderCircle size={14} className="spin" /> : <FlaskConical size={14} />}
          Key testen
        </button>
        <button type="button" className="btn" disabled={channelsLoading} onClick={fetchChannels}>
          {channelsLoading ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
          Kanäle laden
        </button>
      </div>

      {channels.length > 0 && (
        <Field label="Ziel-Kanal">
          <select
            className="select"
            value={settings.bufferChannelId}
            onChange={(e) => {
              const ch = channels.find((c) => c.id === e.target.value);
              save({
                bufferChannelId: e.target.value,
                bufferChannelName: ch ? ch.displayName || ch.name : "",
              });
            }}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id} disabled={c.isDisconnected}>
                {c.displayName || c.name} {c.service ? `(${c.service})` : ""}
                {c.isDisconnected ? " – getrennt" : ""}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="panel-inner space-y-4 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Planungs-Schema für „Alle planen“ & Autopilot
        </p>
        <Field label="Erster Post ab">
          <input
            type="datetime-local"
            className="input mono"
            value={scheduleStartValue}
            onChange={(e) => save({ scheduleStart: e.target.value })}
          />
        </Field>
        <Slider
          label="Abstand zwischen den Posts"
          value={settings.scheduleGap}
          min={5}
          max={720}
          step={5}
          onChange={(v) => save({ scheduleGap: v })}
          format={(v) => (v >= 60 ? `${Math.round(v / 60 * 10) / 10} Std.` : `${v} Min.`)}
        />
      </div>

      <Field label="Video-Beschreibung (fest, wird immer verwendet)">
        <div className="relative">
          <pre
            className="whitespace-pre-wrap rounded-xl p-3.5 pr-11 text-[11.5px] leading-relaxed mono"
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            {VIDEO_DESCRIPTION}
          </pre>
          <button
            type="button"
            className="btn btn-icon absolute right-2 top-2 !p-1.5"
            title="Beschreibung kopieren"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(VIDEO_DESCRIPTION);
                setCopied(true);
                toast("ok", "Beschreibung kopiert");
                setTimeout(() => setCopied(false), 1500);
              } catch {
                toast("error", "Kopieren fehlgeschlagen");
              }
            }}
          >
            {copied ? <ListVideo size={13} style={{ color: "var(--ok)" }} /> : <Copy size={13} />}
          </button>
        </div>
      </Field>
    </Section>
  );
}

/* ---------- Autopilot ---------- */

function useCountdown(target: number | null): string {
  const [, force] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (target === null) return "–";
  const diff = Math.max(0, target - Date.now());
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AutopilotSection() {
  const settings = useStudio((s) => s.settings);
  const save = useStudio((s) => s.saveSettings);
  const autopilot = useStudio((s) => s.autopilot);
  const start = useStudio((s) => s.startAutopilot);
  const stop = useStudio((s) => s.stopAutopilot);

  const countdown = useCountdown(autopilot.running ? autopilot.nextAt : null);

  return (
    <Section
      icon={Bot}
      title="Autopilot"
      sub={
        autopilot.running
          ? `Aktiv – ${settings.autopilotPerHour}×/Std., ${autopilot.posted} bereits übergeben`
          : "Generiert & plant Videos automatisch im Hintergrund"
      }
      badge={
        autopilot.running ? (
          <span className="chip" data-tone="ok">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)" }} />
            Live
          </span>
        ) : undefined
      }
    >
      <Slider
        label="Videos pro Stunde"
        value={settings.autopilotPerHour}
        min={1}
        max={30}
        onChange={(v) => save({ autopilotPerHour: v })}
        format={(v) => `${v}× / Std.`}
      />

      <Field label="Nach der Generierung">
        <Seg
          options={[
            { value: "draft", label: "Nur Bay" },
            { value: "queue", label: "Buffer-Queue" },
            { value: "schedule", label: "Planen" },
          ]}
          value={settings.autopilotMode}
          onChange={(v) => save({ autopilotMode: v })}
        />
      </Field>

      <div className="flex items-center gap-2.5">
        {autopilot.running ? (
          <button type="button" className="btn btn-danger flex-1" onClick={stop}>
            <CircleStop size={15} /> Autopilot stoppen
          </button>
        ) : (
          <button type="button" className="btn btn-accent flex-1" onClick={start}>
            <Play size={15} /> Autopilot starten
          </button>
        )}
        {autopilot.running && (
          <div className="panel-inner flex items-center gap-2 px-3.5 py-2.5">
            <CalendarClock size={13} style={{ color: "var(--accent)" }} />
            <span className="mono text-[11.5px] font-bold">{countdown}</span>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--faint)" }}>
        Der Autopilot arbeitet nur, solange dieser Tab geöffnet ist. Er nutzt das Zeitschema aus dem
        Buffer-Bereich und rotiert durch alle Bays.
      </p>

      {autopilot.log.length > 0 && (
        <div
          className="max-h-44 overflow-y-auto rounded-xl p-3"
          style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
        >
          {autopilot.log.map((l, i) => (
            <div key={i} className="flex gap-2 py-0.5 text-[11px] leading-relaxed mono">
              <span style={{ color: "var(--faint)" }}>
                {new Date(l.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span
                className="min-w-0 flex-1 break-words"
                style={{
                  color:
                    l.kind === "error" ? "var(--danger)" : l.kind === "ok" ? "var(--ok)" : "var(--muted)",
                }}
              >
                {l.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
