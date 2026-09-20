"use client";

import { useState } from "react";
import {
  Archive,
  CalendarClock,
  ChevronDown,
  CircleStop,
  Download,
  ListPlus,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import { BayState, fmtBytes, fmtDuration, useStudio } from "@/lib/client/store";
import { errorMessage } from "@/lib/errors";

function statusChip(b: BayState): { label: string; tone: string } {
  switch (b.status) {
    case "story":
      return { label: "Story", tone: "accent" };
    case "tts":
      return { label: "TTS", tone: "accent" };
    case "render":
      return { label: `${Math.round(b.progress * 100)} %`, tone: "accent" };
    case "done":
      return { label: "Fertig", tone: "ok" };
    case "error":
      return { label: "Fehler", tone: "danger" };
    default:
      return { label: "Bereit", tone: "default" };
  }
}

function bufferChip(b: BayState): { label: string; tone: string } | null {
  switch (b.bufferStatus) {
    case "uploading":
      return { label: "Upload…", tone: "accent" };
    case "posting":
      return { label: "Sende…", tone: "accent" };
    case "ok":
      return { label: b.bufferMessage ?? "Publiziert", tone: "ok" };
    case "error":
      return { label: "Buffer-Fehler", tone: "danger" };
    default:
      return null;
  }
}

function BayCard({ bay }: { bay: BayState }) {
  const updateBay = useStudio((s) => s.updateBay);
  const generateBay = useStudio((s) => s.generateBay);
  const cancelBay = useStudio((s) => s.cancelBay);
  const clearBay = useStudio((s) => s.clearBay);
  const downloadBay = useStudio((s) => s.downloadBay);
  const generateBayTitle = useStudio((s) => s.generateBayTitle);
  const postBay = useStudio((s) => s.postBay);
  const toastError = useStudio((s) => s.toastError);
  const toast = useStudio((s) => s.toast);
  const [titleBusy, setTitleBusy] = useState(false);

  const working = ["story", "tts", "render"].includes(bay.status);
  const chip = statusChip(bay);
  const bChip = bufferChip(bay);

  const onScheduleSingle = () => {
    if (!bay.scheduledLocal) {
      toastError("BUFFER_GRAPHQL", "Bitte zuerst einen Zeitpunkt in der Bay wählen");
      return;
    }
    const iso = new Date(bay.scheduledLocal).toISOString();
    postBay(bay.index, "scheduled", iso);
  };

  return (
    <article className="panel rise flex flex-col gap-3 p-3.5" style={{ animationDelay: `${bay.index * 40}ms` }}>
      {/* Kopf */}
      <div className="flex items-center gap-2">
        <span
          className="mono flex h-7 w-9 items-center justify-center rounded-lg text-[11px] font-bold"
          style={{ background: "var(--panel-3)", color: "var(--muted)" }}
        >
          {String(bay.index + 1).padStart(2, "0")}
        </span>
        <span
          className="chip"
          data-tone={chip.tone === "default" ? undefined : chip.tone}
          style={working ? { gap: "0.45rem" } : undefined}
        >
          {working && (
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          )}
          {chip.label}
        </span>
        {bChip && (
          <span className="chip" data-tone={bChip.tone} title={bay.bufferMessage ?? undefined}>
            {bChip.label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {bay.status === "done" && (
            <button
              type="button"
              className="btn btn-icon btn-ghost !p-1.5"
              title="Video verwerfen"
              onClick={() => clearBay(bay.index)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Vorschau 9:16 */}
      <div
        className="aspect-916 relative w-full overflow-hidden rounded-xl"
        style={{
          background: "var(--bg)",
          border: `1px solid ${bay.status === "error" ? "color-mix(in srgb, var(--danger) 45%, transparent)" : "var(--line)"}`,
        }}
      >
        {bay.status === "done" && bay.videoUrl ? (
          <video src={bay.videoUrl} controls playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : working ? (
          <div className="absolute inset-0">
            {bay.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bay.thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[2px]" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <LoaderCircle size={22} className="spin" style={{ color: "var(--accent)" }} />
              <p className="text-[12px] font-bold">{bay.stage || "Arbeite…"}</p>
              {bay.status === "render" && (
                <p className="mono text-[11px]" style={{ color: "var(--muted)" }}>
                  {Math.round(bay.progress * 100)} %
                </p>
              )}
            </div>
            <div className="progress-track absolute inset-x-3 bottom-3">
              <div className="progress-fill" style={{ width: `${Math.round(bay.progress * 100)}%` }} />
            </div>
          </div>
        ) : bay.status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-5 text-center">
            <CircleStop size={20} style={{ color: "var(--danger)" }} />
            <p className="text-[12px] font-bold leading-snug" style={{ color: "var(--danger)" }}>
              {errorMessage(bay.errorCode ?? "INTERNAL")}
            </p>
            {bay.errorDetail && (
              <p className="mono break-words text-[10.5px] leading-snug" style={{ color: "var(--muted)" }}>
                {bay.errorDetail}
              </p>
            )}
          </div>
        ) : (
          // Titelkarten-Vorschau im Idle-Zustand
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
            {bay.title ? (
              <>
                <span
                  className="rounded-full px-3 py-1 text-[9.5px] font-bold tracking-widest uppercase"
                  style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}
                >
                  Reddit Story
                </span>
                <p className="text-[14px] font-bold leading-snug">{bay.title}</p>
                <span className="h-[3px] w-12 rounded-full" style={{ background: "var(--accent)" }} />
              </>
            ) : (
              <>
                <Play size={20} style={{ color: "var(--faint)" }} />
                <p className="text-[11.5px] font-semibold" style={{ color: "var(--faint)" }}>
                  Noch nichts generiert
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {bay.status === "done" && (
        <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
          <span>{fmtBytes(bay.size)}</span>
          <span>{fmtDuration(bay.duration)}</span>
          <span>{bay.mimeType.includes("mp4") ? "MP4" : "WebM"}</span>
        </div>
      )}

      {/* Titel */}
      <div className="flex items-center gap-1.5">
        <input
          className="input !py-2 !text-[12.5px] font-semibold"
          placeholder="Titel eingeben oder per KI…"
          value={bay.title}
          onChange={(e) => updateBay(bay.index, { title: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-icon !p-2"
          title="Titel per KI generieren"
          disabled={titleBusy}
          onClick={async () => {
            setTitleBusy(true);
            await generateBayTitle(bay.index);
            setTitleBusy(false);
          }}
        >
          {titleBusy ? <LoaderCircle size={13} className="spin" /> : <Wand2 size={13} />}
        </button>
      </div>

      {/* Story (aufklappbar) */}
      <details className="section">
        <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider select-none" style={{ color: "var(--muted)" }}>
          Story-Text
          <ChevronDown size={12} className="chev" />
        </summary>
        <textarea
          className="textarea mt-2 !min-h-[76px] !text-[12px]"
          placeholder="Leer lassen → KI schreibt automatisch eine neue Story…"
          value={bay.story}
          onChange={(e) => updateBay(bay.index, { story: e.target.value })}
        />
      </details>

      {/* Aktionen */}
      <div className="grid grid-cols-2 gap-1.5">
        {working ? (
          <button type="button" className="btn col-span-2" onClick={() => cancelBay(bay.index)}>
            <CircleStop size={14} /> Abbrechen
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-accent col-span-2"
            onClick={async () => {
              if (bay.status === "done") {
                clearBay(bay.index);
                toast("info", `Bay ${bay.index + 1} wird neu generiert`);
                await new Promise((r) => setTimeout(r, 50));
              }
              generateBay(bay.index);
            }}
          >
            {bay.status === "done" ? <RefreshCw size={14} /> : <Play size={14} />}
            {bay.status === "done" ? "Neu generieren" : "Generieren"}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={!bay.videoBlob}
          onClick={() => downloadBay(bay.index)}
        >
          <Download size={14} /> Download
        </button>
        <button
          type="button"
          className="btn"
          disabled={!bay.videoBlob || ["uploading", "posting"].includes(bay.bufferStatus)}
          onClick={() => postBay(bay.index, "queue")}
          title="In die Buffer-Queue legen"
        >
          <ListPlus size={14} /> Queue
        </button>
      </div>

      {/* Planen pro Bay */}
      <div className="flex items-center gap-1.5">
        <input
          type="datetime-local"
          className="input mono !py-2 !text-[11px]"
          value={bay.scheduledLocal}
          onChange={(e) => updateBay(bay.index, { scheduledLocal: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-icon !p-2"
          title="Zum gewählten Zeitpunkt planen & an Buffer senden"
          disabled={!bay.videoBlob || ["uploading", "posting"].includes(bay.bufferStatus)}
          onClick={onScheduleSingle}
        >
          <CalendarClock size={13} />
        </button>
        <button
          type="button"
          className="btn btn-icon !p-2"
          title="Sofort über Buffer posten"
          disabled={!bay.videoBlob || ["uploading", "posting"].includes(bay.bufferStatus)}
          onClick={() => postBay(bay.index, "now")}
        >
          <Zap size={13} />
        </button>
      </div>

      {bay.bufferStatus === "ok" && bay.bufferDueAt && (
        <p className="mono text-[10.5px]" style={{ color: "var(--ok)" }}>
          {new Date(bay.bufferDueAt).toLocaleString("de-DE")}
        </p>
      )}
    </article>
  );
}

export default function BayGrid() {
  const bays = useStudio((s) => s.bays);
  const settings = useStudio((s) => s.settings);
  const generateAll = useStudio((s) => s.generateAll);
  const cancelAll = useStudio((s) => s.cancelAll);
  const downloadZip = useStudio((s) => s.downloadZip);
  const generateTitles = useStudio((s) => s.generateTitles);
  const postAll = useStudio((s) => s.postAll);
  const postingAll = useStudio((s) => s.postingAll);
  const [titlesBusy, setTitlesBusy] = useState(false);

  const count = Math.min(settings.bayCount, bays.length);
  const shown = bays.slice(0, count);
  const doneCount = shown.filter((b) => b.status === "done").length;
  const workingCount = shown.filter((b) => ["story", "tts", "render"].includes(b.status)).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="panel flex flex-wrap items-center gap-2 p-3 sm:p-3.5">
        <button
          type="button"
          className="btn btn-accent glow-breathe"
          onClick={generateAll}
          disabled={workingCount > 0}
        >
          <Sparkles size={15} />
          Alle {count} generieren
        </button>
        {workingCount > 0 && (
          <button type="button" className="btn btn-danger" onClick={cancelAll}>
            <CircleStop size={14} /> Abbrechen ({workingCount})
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={titlesBusy}
          onClick={async () => {
            setTitlesBusy(true);
            await generateTitles();
            setTitlesBusy(false);
          }}
        >
          {titlesBusy ? <LoaderCircle size={14} className="spin" /> : <Wand2 size={14} />}
          Alle Titel (KI)
        </button>

        <div className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--line)" }} />

        <button type="button" className="btn" onClick={downloadZip} disabled={doneCount === 0}>
          <Archive size={14} /> ZIP
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => postAll("now")}
          disabled={postingAll || doneCount === 0}
          title="Alle fertigen Videos sofort posten"
        >
          <Zap size={14} /> Alle posten
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => postAll("queue")}
          disabled={postingAll || doneCount === 0}
          title="Alle in die Buffer-Queue"
        >
          <ListPlus size={14} /> Alle queuen
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => postAll("scheduled")}
          disabled={postingAll || doneCount === 0}
          title="Alle nach Schema planen und an Buffer senden"
        >
          {postingAll ? <LoaderCircle size={14} className="spin" /> : <CalendarClock size={14} />}
          Alle planen
        </button>

        <span className="chip ml-auto" data-tone={doneCount === count && count > 0 ? "ok" : undefined}>
          {doneCount}/{count} fertig
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shown.map((b) => (
          <BayCard key={b.index} bay={b} />
        ))}
      </div>
    </div>
  );
}
