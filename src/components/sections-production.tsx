"use client";

import { useMemo, useRef, useState } from "react";
import {
  Captions,
  Check,
  Clapperboard,
  FileAudio,
  Film,
  FlaskConical,
  LoaderCircle,
  Mic,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Field, Section, Seg, Slider, ToggleRow } from "@/components/ui";
import { useStudio } from "@/lib/client/store";
import { AI_PROVIDERS, AiProviderId } from "@/lib/shared";

/* ---------- KI-Provider & Story ---------- */

export function AiSection() {
  const settings = useStudio((s) => s.settings);
  const save = useStudio((s) => s.saveSettings);
  const testAi = useStudio((s) => s.testAi);
  const [testing, setTesting] = useState(false);

  const providerOptions = (Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => ({
    value: id,
    label: AI_PROVIDERS[id].label.split(" ")[0],
  }));

  const setProvider = (id: AiProviderId) => {
    const p = AI_PROVIDERS[id];
    save({ aiProvider: id, aiBaseUrl: p.baseUrl, aiModel: p.model });
  };

  return (
    <Section icon={Sparkles} title="KI & Story" sub="Mistral, Qwen & Co. – Keys & Story-Parameter" defaultOpen>
      <Field label="Anbieter">
        <Seg options={providerOptions} value={settings.aiProvider} onChange={setProvider} />
      </Field>

      <Field label={`API-Key (${AI_PROVIDERS[settings.aiProvider].label})`} hint={AI_PROVIDERS[settings.aiProvider].hint}>
        <input
          type="password"
          className="input mono"
          placeholder="sk-…"
          autoComplete="off"
          value={settings.aiKey}
          onChange={(e) => save({ aiKey: e.target.value })}
        />
      </Field>

      {settings.aiProvider === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Basis-URL">
            <input
              className="input mono"
              placeholder="https://…/v1"
              value={settings.aiBaseUrl}
              onChange={(e) => save({ aiBaseUrl: e.target.value })}
            />
          </Field>
          <Field label="Modell">
            <input
              className="input mono"
              placeholder="model-name"
              value={settings.aiModel}
              onChange={(e) => save({ aiModel: e.target.value })}
            />
          </Field>
        </div>
      )}
      {settings.aiProvider !== "custom" && (
        <Field label="Modell (anpassbar)">
          <input
            className="input mono"
            value={settings.aiModel}
            onChange={(e) => save({ aiModel: e.target.value })}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sprache">
          <Seg
            options={[
              { value: "en", label: "English" },
              { value: "de", label: "Deutsch" },
            ]}
            value={settings.storyLanguage}
            onChange={(v) => save({ storyLanguage: v })}
          />
        </Field>
        <div>
          <button
            type="button"
            className="btn w-full !py-2.5 mt-[21px]"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              await testAi();
              setTesting(false);
            }}
          >
            {testing ? <LoaderCircle size={14} className="spin" /> : <FlaskConical size={14} />}
            Key testen
          </button>
        </div>
      </div>

      <Field label="Thema der Stories" hint="Leer = zufällige, dramatische Reddit-Themen.">
        <input
          className="input"
          placeholder="z. B. toxische Schwiegereltern, Erbe, Nachbarschafts-Krieg…"
          value={settings.storyTopic}
          onChange={(e) => save({ storyTopic: e.target.value })}
        />
      </Field>

      <Slider
        label="Story-Länge"
        value={settings.storyLength}
        min={80}
        max={600}
        step={10}
        onChange={(v) => save({ storyLength: v })}
        format={(v) => `~${v} Wörter`}
      />
    </Section>
  );
}

/* ---------- Supabase TTS ---------- */

export function TtsSection() {
  const settings = useStudio((s) => s.settings);
  const save = useStudio((s) => s.saveSettings);

  return (
    <Section icon={Mic} title="Stimme (Supabase TTS)" sub="Edge Function für die Sprachausgabe">
      <Field label="Supabase Projekt-URL">
        <input
          className="input mono"
          placeholder="https://dein-projekt.supabase.co"
          value={settings.supabaseUrl}
          onChange={(e) => save({ supabaseUrl: e.target.value })}
        />
      </Field>
      <Field label="Supabase Anon/Service-Key">
        <input
          type="password"
          className="input mono"
          placeholder="eyJhbGciOi…"
          autoComplete="off"
          value={settings.supabaseKey}
          onChange={(e) => save({ supabaseKey: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="TTS-Funktion">
          <input
            className="input mono"
            placeholder="tts"
            value={settings.ttsFunction}
            onChange={(e) => save({ ttsFunction: e.target.value })}
          />
        </Field>
        <Field label="Stimme">
          <input
            className="input mono"
            placeholder="alloy"
            value={settings.ttsVoice}
            onChange={(e) => save({ ttsVoice: e.target.value })}
          />
        </Field>
      </div>
      <Slider
        label="Sprech-Tempo"
        value={settings.ttsSpeed}
        min={0.5}
        max={2}
        step={0.05}
        onChange={(v) => save({ ttsSpeed: v })}
        format={(v) => `${v.toFixed(2)}×`}
      />
      <ToggleRow
        label="Titel am Anfang vorlesen"
        desc="Kombiniert mit der Titelkarte: Die Stimme liest zuerst den Titel."
        checked={settings.readTitle}
        onChange={(v) => save({ readTitle: v })}
      />
    </Section>
  );
}

/* ---------- Assets: Hintergrund & Audio ---------- */

export function AssetsSection() {
  const bgBlob = useStudio((s) => s.bgBlob);
  const bgName = useStudio((s) => s.bgName);
  const audioBlob = useStudio((s) => s.audioBlob);
  const audioName = useStudio((s) => s.audioName);
  const setBg = useStudio((s) => s.setBg);
  const setAudio = useStudio((s) => s.setAudio);
  const [dragOver, setDragOver] = useState(false);
  const bgInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  const bgUrl = useMemo(() => (bgBlob ? URL.createObjectURL(bgBlob) : null), [bgBlob]);

  return (
    <Section icon={Film} title="Hintergrund & Audio" sub="Clip + optionale eigene Audiodatei" defaultOpen>
      <Field label="Hintergrund-Clip (z. B. Minecraft Parkour)">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setBg(f);
          }}
          onClick={() => bgInput.current?.click()}
          className="group relative cursor-pointer overflow-hidden rounded-xl transition-all"
          style={{
            border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--line-strong)"}`,
            background: dragOver ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--bg-2)",
          }}
        >
          <input
            ref={bgInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setBg(f);
              e.target.value = "";
            }}
          />
          {bgUrl ? (
            <div className="relative">
              <video src={bgUrl} muted playsInline loop autoPlay className="h-36 w-full object-cover opacity-80" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
                <Check size={13} className="shrink-0 text-emerald-400" />
                <span className="truncate text-[11.5px] font-semibold text-white">{bgName}</span>
                <span className="ml-auto shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-white/60">
                  Tippen zum Ändern
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-28 flex-col items-center justify-center gap-2 text-center">
              <Upload size={18} style={{ color: "var(--muted)" }} />
              <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                Video hierher ziehen oder tippen
              </p>
            </div>
          )}
        </div>
      </Field>

      <Field label="Eigenes Audio (optional – sonst TTS)" hint="Wird für ALLE Bays genutzt, solange es aktiv ist.">
        <div className="flex items-center gap-2">
          <button type="button" className="btn flex-1 justify-start !font-medium" onClick={() => audioInput.current?.click()}>
            <FileAudio size={14} style={{ color: audioBlob ? "var(--ok)" : "var(--muted)" }} />
            <span className="truncate">{audioBlob ? audioName : "Audiodatei wählen"}</span>
          </button>
          {audioBlob && (
            <button
              type="button"
              className="btn btn-icon btn-danger"
              title="Audio entfernen (TTS wird wieder genutzt)"
              onClick={() => useStudio.setState({ audioBlob: null, audioName: "" })}
            >
              <X size={14} />
            </button>
          )}
          <input
            ref={audioInput}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAudio(f);
              e.target.value = "";
            }}
          />
        </div>
      </Field>
    </Section>
  );
}

/* ---------- Untertitel & Titelkarte & Video ---------- */

export function DesignSection() {
  const settings = useStudio((s) => s.settings);
  const save = useStudio((s) => s.saveSettings);

  return (
    <Section icon={Captions} title="Untertitel & Titelkarte" sub="Standard: Untertitel mittig, Titelkarte an" defaultOpen>
      <ToggleRow
        label="Untertitel"
        desc="Wort-für-Wort-Karaoke, standardmäßig mittig platziert."
        checked={settings.subtitleEnabled}
        onChange={(v) => save({ subtitleEnabled: v })}
      />
      {settings.subtitleEnabled && (
        <div className="panel-inner space-y-4 p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Position">
              <Seg
                options={[
                  { value: "upper", label: "Oben" },
                  { value: "center", label: "Mitte" },
                  { value: "lower", label: "Unten" },
                ]}
                value={settings.subtitlePosition}
                onChange={(v) => save({ subtitlePosition: v })}
              />
            </Field>
            <Field label="Farbe">
              <div className="flex gap-1.5">
                {["#ffffff", "#ffe14d", "#7cf7c4", "#8ecbff"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Untertitelfarbe ${c}`}
                    onClick={() => save({ subtitleColor: c })}
                    className="h-8 flex-1 rounded-lg transition-transform hover:scale-105"
                    style={{
                      background: c,
                      border: settings.subtitleColor === c ? "2px solid var(--accent)" : "1px solid var(--line)",
                    }}
                  />
                ))}
              </div>
            </Field>
          </div>
          <Slider
            label="Wörter pro Zeile"
            value={settings.subtitleWords}
            min={2}
            max={8}
            onChange={(v) => save({ subtitleWords: v })}
            format={(v) => `${v} Wörter`}
          />
          <Slider
            label="Schriftgröße"
            value={settings.subtitleSize}
            min={0.7}
            max={1.5}
            step={0.05}
            onChange={(v) => save({ subtitleSize: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      )}

      <ToggleRow
        label="Titelkarte am Anfang"
        desc="Zeigt den Titel groß auf der ersten Karte des Videos."
        checked={settings.titleCardEnabled}
        onChange={(v) => save({ titleCardEnabled: v })}
      />
      {settings.titleCardEnabled && (
        <div className="panel-inner space-y-4 p-3.5">
          <Field label="Stil">
            <Seg
              options={[
                { value: "blur", label: "Blur" },
                { value: "dark", label: "Dunkel" },
                { value: "accent", label: "Akzent" },
              ]}
              value={settings.titleCardStyle}
              onChange={(v) => save({ titleCardStyle: v })}
            />
          </Field>
          <Slider
            label="Anzeigedauer"
            value={settings.titleCardDuration}
            min={1}
            max={6}
            step={0.5}
            onChange={(v) => save({ titleCardDuration: v })}
            format={(v) => `${v.toFixed(1)} s`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Auflösung">
          <Seg
            options={[
              { value: "720", label: "720p" },
              { value: "1080", label: "1080p" },
            ]}
            value={settings.resolution}
            onChange={(v) => save({ resolution: v })}
          />
        </Field>
        <Field label="Bitrate">
          <Seg
            options={[
              { value: 5, label: "5 M" },
              { value: 8, label: "8 M" },
              { value: 12, label: "12 M" },
            ]}
            value={settings.videoBitrate}
            onChange={(v) => save({ videoBitrate: v })}
          />
        </Field>
      </div>

      <Slider
        label="Gleichzeitige Render-Jobs"
        value={settings.concurrency}
        min={1}
        max={10}
        onChange={(v) => save({ concurrency: v })}
        format={(v) => `${v} parallel`}
      />
      <Slider
        label="Hintergrund-Ton"
        value={settings.bgVolume}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => save({ bgVolume: v })}
        format={(v) => (v === 0 ? "Stumm" : `${Math.round(v * 100)}%`)}
      />
      <ToggleRow
        label="Fortschrittsbalken im Video"
        desc="Dünner Balken oben, wie bei Shorts/TikTok üblich."
        checked={settings.showProgressBar}
        onChange={(v) => save({ showProgressBar: v })}
      />
    </Section>
  );
}

/* ---------- Render-Format-Hinweis ---------- */

export function FormatNote() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[11.5px] leading-relaxed"
      style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--muted)" }}
    >
      <Clapperboard size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
      <span>
        Die Videos werden <b>vollständig im Browser</b> gerendert (9:16, Canvas + MediaRecorder).
        Der Tab muss während der Generierung geöffnet bleiben.
      </span>
    </div>
  );
}


