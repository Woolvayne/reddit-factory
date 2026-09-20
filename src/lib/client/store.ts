"use client";

import { create } from "zustand";
import JSZip from "jszip";
import { apiCall, apiCallBlob } from "@/lib/client/api";
import { AppError, errorMessage } from "@/lib/errors";
import { renderStoryVideo } from "@/lib/client/render";
import { idbDelete, idbGet, idbPut } from "@/lib/client/persist";
import { AppSettings, DEFAULT_SETTINGS, MAX_BAYS, VIDEO_DESCRIPTION } from "@/lib/shared";
import type { BufferChannel, BufferMode } from "@/lib/server/buffer";

export type BayStatus = "idle" | "story" | "tts" | "render" | "done" | "error";
export type BufferBayStatus = "idle" | "uploading" | "posting" | "ok" | "error";

export interface BayState {
  index: number;
  status: BayStatus;
  stage: string;
  progress: number;
  title: string;
  story: string;
  videoBlob: Blob | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  mimeType: string;
  duration: number;
  size: number;
  errorCode: string | null;
  errorDetail: string | null;
  scheduledLocal: string; // datetime-local
  bufferStatus: BufferBayStatus;
  bufferMessage: string | null;
  bufferPostId: string | null;
  bufferDueAt: string | null;
  uploadPath: string | null;
}

export interface Toast {
  id: number;
  kind: "error" | "ok" | "info";
  text: string;
  detail?: string;
}

export interface LogEntry {
  ts: number;
  kind: "info" | "ok" | "error";
  text: string;
}

function emptyBay(index: number): BayState {
  return {
    index,
    status: "idle",
    stage: "",
    progress: 0,
    title: "",
    story: "",
    videoBlob: null,
    videoUrl: null,
    thumbUrl: null,
    mimeType: "video/mp4",
    duration: 0,
    size: 0,
    errorCode: null,
    errorDetail: null,
    scheduledLocal: "",
    bufferStatus: "idle",
    bufferMessage: null,
    bufferPostId: null,
    bufferDueAt: null,
    uploadPath: null,
  };
}

const controllers = new Map<number, AbortController>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 1;

function defaultScheduleStart(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return toLocalInput(d);
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtBytes(n: number): string {
  if (n <= 0) return "–";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return `${(n / 10 ** (i * 3)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtDuration(s: number): string {
  if (!isFinite(s) || s <= 0) return "–";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")} min` : `${sec} s`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "video";
}

function fileExt(mime: string): string {
  return mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : "mp4";
}

/* ============================================================
   STORE
   ============================================================ */

interface StudioStore {
  hydrated: boolean;
  settings: AppSettings;
  settingsLoaded: boolean;
  settingsSaving: boolean;
  bays: BayState[];
  bgBlob: Blob | null;
  bgName: string;
  audioBlob: Blob | null;
  audioName: string;
  toasts: Toast[];
  generatingCount: number;
  planningAll: boolean;
  postingAll: boolean;
  bufferChannels: BufferChannel[];
  bufferChannelsLoading: boolean;
  autopilot: {
    running: boolean;
    nextAt: number | null;
    posted: number;
    counter: number;
    log: LogEntry[];
  };

  // Basis
  init: () => Promise<void>;
  toast: (kind: Toast["kind"], text: string, detail?: string) => void;
  toastError: (code: string, detail?: string) => void;
  dismissToast: (id: number) => void;
  saveSettings: (patch: Partial<AppSettings>) => void;
  testAi: () => Promise<void>;
  testBuffer: () => Promise<void>;

  // Assets
  setBg: (file: File) => Promise<void>;
  setAudio: (file: File) => void;

  // Titel & Story
  updateBay: (index: number, patch: Partial<BayState>) => void;
  generateTitles: () => Promise<void>;
  generateBayTitle: (index: number) => Promise<void>;

  // Generierung
  generateBay: (index: number) => Promise<void>;
  generateAll: () => Promise<void>;
  cancelBay: (index: number) => void;
  cancelAll: () => void;
  clearBay: (index: number) => void;

  // Downloads
  downloadBay: (index: number) => void;
  downloadZip: () => Promise<void>;

  // Buffer
  fetchChannels: () => Promise<void>;
  ensureUpload: (index: number) => Promise<string>;
  postBay: (index: number, mode: BufferMode, dueAtIso?: string) => Promise<void>;
  postAll: (mode: BufferMode) => Promise<void>;

  // Autopilot
  startAutopilot: () => void;
  stopAutopilot: () => void;
  autopilotTick: () => Promise<void>;
  autopilotLog: (kind: LogEntry["kind"], text: string) => void;
}

export const useStudio = create<StudioStore>((set, get) => {
  const persistBayMeta = () => {
    try {
      const meta = get().bays.map((b) => ({
        t: b.title,
        s: b.story,
        d: b.duration,
        z: b.size,
        m: b.mimeType,
        th: b.thumbUrl?.startsWith("data:") ? b.thumbUrl : null,
        sc: b.scheduledLocal,
        bs: b.bufferStatus === "ok" ? "ok" : "idle",
        bp: b.bufferPostId,
        bd: b.bufferDueAt,
        done: b.status === "done",
      }));
      localStorage.setItem("rs-bay-meta", JSON.stringify(meta));
    } catch {
      /* voll */
    }
  };

  const patchBay = (index: number, patch: Partial<BayState>, persist = true) => {
    set((st) => ({
      bays: st.bays.map((b) => (b.index === index ? { ...b, ...patch } : b)),
    }));
    if (persist) persistBayMeta();
  };

  const runningRenders = () =>
    get().bays.filter((b) => ["story", "tts", "render"].includes(b.status)).length;

  return {
    hydrated: false,
    settings: { ...DEFAULT_SETTINGS },
    settingsLoaded: false,
    settingsSaving: false,
    bays: Array.from({ length: MAX_BAYS }, (_, i) => emptyBay(i)),
    bgBlob: null,
    bgName: "",
    audioBlob: null,
    audioName: "",
    toasts: [],
    generatingCount: 0,
    planningAll: false,
    postingAll: false,
    bufferChannels: [],
    bufferChannelsLoading: false,
    autopilot: { running: false, nextAt: null, posted: 0, counter: 0, log: [] },

    /* ---------- Basis ---------- */

    init: async () => {
      if (get().hydrated) return;
      set({ hydrated: true });

      // Einstellungen laden
      try {
        const data = await apiCall<AppSettings>("/api/settings");
        set({ settings: { ...DEFAULT_SETTINGS, ...data }, settingsLoaded: true });
        if (!get().settings.scheduleStart) {
          get().saveSettings({ scheduleStart: defaultScheduleStart() });
        }
      } catch (e) {
        get().toastError(e instanceof AppError ? e.code : "SETTINGS_LOAD_FAILED");
      }

      // Hintergrund-Clip wiederherstellen
      const bg = await idbGet("bg");
      if (bg) set({ bgBlob: bg, bgName: localStorage.getItem("rs-bg-name") || "hintergrund.mp4" });

      // Bay-Metadaten + Videos wiederherstellen
      try {
        const raw = localStorage.getItem("rs-bay-meta");
        if (raw) {
          const meta = JSON.parse(raw) as {
            t?: string; s?: string; d?: number; z?: number; m?: string; th?: string | null;
            sc?: string; bs?: string; bp?: string | null; bd?: string | null; done?: boolean;
          }[];
          for (let i = 0; i < Math.min(meta.length, MAX_BAYS); i++) {
            const m = meta[i];
            if (!m) continue;
            const blob = m.done ? await idbGet(`bay-${i}`) : null;
            if (m.done && !blob) continue;
            patchBay(i, {
              title: m.t ?? "",
              story: m.s ?? "",
              duration: m.d ?? 0,
              size: m.z ?? 0,
              mimeType: m.m ?? "video/mp4",
              thumbUrl: m.th ?? null,
              scheduledLocal: m.sc ?? "",
              bufferStatus: m.bs === "ok" ? "ok" : "idle",
              bufferPostId: m.bp ?? null,
              bufferDueAt: m.bd ?? null,
              videoBlob: blob,
              videoUrl: blob ? URL.createObjectURL(blob) : null,
              status: blob ? "done" : "idle",
              stage: blob ? "Fertig" : "",
              progress: blob ? 1 : 0,
            }, false);
          }
        }
      } catch {
        /* Wiederherstellung optional */
      }
    },

    toast: (kind, text, detail) => {
      const id = toastId++;
      set((st) => ({ toasts: [...st.toasts.slice(-5), { id, kind, text, detail }] }));
      setTimeout(() => get().dismissToast(id), kind === "error" ? 9000 : 4500);
    },

    toastError: (code, detail) => {
      get().toast("error", errorMessage(code, undefined), detail);
    },

    dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

    saveSettings: (patch) => {
      set((st) => ({ settings: { ...st.settings, ...patch } }));
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        set({ settingsSaving: true });
        try {
          const current = get().settings;
          const out: Record<string, unknown> = { ...patch };
          // Nie maskierte Secrets zurückschreiben
          for (const k of ["aiKey", "supabaseKey", "bufferToken"]) {
            const v = current[k as keyof AppSettings];
            if (typeof v === "string" && v.includes("•")) delete out[k];
          }
          await apiCall("/api/settings", { method: "PUT", body: out });
        } catch (e) {
          get().toastError(e instanceof AppError ? e.code : "SETTINGS_SAVE_FAILED");
        } finally {
          set({ settingsSaving: false });
        }
      }, 700);
    },

    testAi: async () => {
      try {
        const data = await apiCall<{ model: string }>("/api/ai/test", { method: "POST", body: {} });
        get().toast("ok", `KI verbunden – Modell: ${data.model}`);
      } catch (e) {
        if (e instanceof AppError) get().toastError(e.code, e.detail);
        else get().toastError("INTERNAL");
      }
    },

    testBuffer: async () => {
      try {
        const data = await apiCall<{ channelCount: number }>("/api/buffer/test", { method: "POST", body: {} });
        get().toast("ok", `Buffer verbunden – ${data.channelCount} Kanal/Kanäle gefunden`);
      } catch (e) {
        if (e instanceof AppError) get().toastError(e.code, e.detail);
        else get().toastError("INTERNAL");
      }
    },

    /* ---------- Assets ---------- */

    setBg: async (file) => {
      if (!file.type.startsWith("video/")) {
        get().toastError("UPLOAD_BAD_TYPE", file.type || file.name);
        return;
      }
      set({ bgBlob: file, bgName: file.name });
      localStorage.setItem("rs-bg-name", file.name);
      idbPut("bg", file).catch(() => undefined);
      get().toast("ok", "Hintergrund-Clip übernommen", file.name);
    },

    setAudio: (file) => {
      if (!file.type.startsWith("audio/")) {
        get().toastError("UPLOAD_BAD_TYPE", file.type || file.name);
        return;
      }
      set({ audioBlob: file, audioName: file.name });
      get().toast("ok", "Audio übernommen", file.name);
    },

    /* ---------- Titel & Story ---------- */

    updateBay: (index, patch) => patchBay(index, patch),

    generateTitles: async () => {
      const { settings, bays } = get();
      const count = Math.min(settings.bayCount, bays.length);
      try {
        const data = await apiCall<{ titles: string[] }>("/api/ai/titles", {
          method: "POST",
          body: { count },
        });
        data.titles.forEach((t, i) => patchBay(i, { title: t }));
        get().toast("ok", `${data.titles.length} Titel generiert`);
      } catch (e) {
        if (e instanceof AppError) get().toastError(e.code, e.detail);
        else get().toastError("INTERNAL");
      }
    },

    generateBayTitle: async (index) => {
      try {
        const data = await apiCall<{ titles: string[] }>("/api/ai/titles", {
          method: "POST",
          body: { count: 1 },
        });
        if (data.titles[0]) {
          patchBay(index, { title: data.titles[0] });
          get().toast("ok", `Titel für Bay ${index + 1} generiert`);
        }
      } catch (e) {
        if (e instanceof AppError) get().toastError(e.code, e.detail);
        else get().toastError("INTERNAL");
      }
    },

    /* ---------- Generierung ---------- */

    generateBay: async (index) => {
      const st = get();
      const bay = st.bays[index];
      if (!bay) return;
      if (["story", "tts", "render"].includes(bay.status)) return;

      const settings = st.settings;
      const fail = (code: string, detail?: string) => {
        patchBay(index, { status: "error", stage: "", errorCode: code, errorDetail: detail ?? null });
        get().toastError(code, detail);
      };

      if (!st.bgBlob) {
        fail("RENDER_NO_BG");
        return;
      }

      const controller = new AbortController();
      controllers.set(index, controller);

      try {
        // 1) Story + Titel
        let { title, story } = bay;
        if (!story.trim()) {
          patchBay(index, { status: "story", stage: "KI schreibt die Story", progress: 0, errorCode: null, errorDetail: null });
          const data = await apiCall<{ title: string; story: string }>("/api/ai/story", {
            method: "POST",
            body: { index },
          });
          title = title.trim() || data.title;
          story = data.story;
          patchBay(index, { title, story });
        } else {
          patchBay(index, { status: "story", stage: "Story vorhanden", progress: 0, errorCode: null });
          if (!title.trim()) {
            await get().generateBayTitle(index);
            title = get().bays[index].title;
          }
        }
        if (controller.signal.aborted) throw new AppError("RENDER_ABORTED");

        // 2) Audio: hochgeladene Datei ODER Supabase TTS
        let audio = st.audioBlob;
        const ttsText = `${settings.readTitle && title ? `${title}. ` : ""}${story}`.trim();
        if (!audio) {
          patchBay(index, { status: "tts", stage: "Supabase TTS erzeugt die Stimme" });
          audio = await apiCallBlob("/api/tts", { text: ttsText });
        } else {
          patchBay(index, { status: "tts", stage: "Hochgeladenes Audio wird genutzt" });
        }
        if (controller.signal.aborted) throw new AppError("RENDER_ABORTED");

        // 3) Rendern
        patchBay(index, { status: "render", stage: "Video wird gerendert", progress: 0 });
        const result = await renderStoryVideo({
          background: st.bgBlob,
          voiceover: audio,
          title,
          ttsText,
          settings: {
            resolution: settings.resolution,
            fps: settings.fps,
            subtitleEnabled: settings.subtitleEnabled,
            subtitleWords: settings.subtitleWords,
            subtitleSize: settings.subtitleSize,
            subtitlePosition: settings.subtitlePosition,
            subtitleColor: settings.subtitleColor,
            titleCardEnabled: settings.titleCardEnabled,
            titleCardDuration: settings.titleCardDuration,
            titleCardStyle: settings.titleCardStyle,
            showProgressBar: settings.showProgressBar,
            bgVolume: settings.bgVolume,
            videoBitrate: settings.videoBitrate,
          },
          signal: controller.signal,
          onProgress: (p) => patchBay(index, { progress: p }, false),
          onStage: (stage) => patchBay(index, { stage }, false),
        });

        const old = get().bays[index];
        if (old.videoUrl) URL.revokeObjectURL(old.videoUrl);
        const thumbUrl = result.thumbnail ? URL.createObjectURL(result.thumbnail) : old.thumbUrl;

        patchBay(index, {
          status: "done",
          stage: "Fertig",
          progress: 1,
          videoBlob: result.blob,
          videoUrl: URL.createObjectURL(result.blob),
          thumbUrl,
          mimeType: result.mimeType,
          duration: result.duration,
          size: result.blob.size,
          bufferStatus: "idle",
          bufferMessage: null,
          uploadPath: null,
        });
        idbPut(`bay-${index}`, result.blob).catch(() => undefined);
        get().toast("ok", `Bay ${index + 1} fertig gerendert`, fmtBytes(result.blob.size));
      } catch (e) {
        if (e instanceof AppError) fail(e.code, e.detail);
        else fail("INTERNAL", e instanceof Error ? e.message : undefined);
      } finally {
        controllers.delete(index);
      }
    },

    generateAll: async () => {
      const { settings, bays } = get();
      if (!get().bgBlob) {
        get().toastError("RENDER_NO_BG");
        return;
      }
      const count = Math.min(settings.bayCount, bays.length);
      const indexes = Array.from({ length: count }, (_, i) => i).filter(
        (i) => !["story", "tts", "render", "done"].includes(bays[i].status)
      );
      if (indexes.length === 0) {
        get().toast("info", "Alle Bays sind bereits fertig oder in Arbeit.");
        return;
      }
      const limit = Math.max(1, Math.min(MAX_BAYS, settings.concurrency));
      const queue = [...indexes];
      const worker = async () => {
        while (queue.length > 0) {
          const i = queue.shift();
          if (i === undefined) break;
          await get().generateBay(i);
        }
      };
      await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
    },

    cancelBay: (index) => {
      const c = controllers.get(index);
      if (c) {
        c.abort();
        controllers.delete(index);
        patchBay(index, { status: "idle", stage: "Abgebrochen", progress: 0 });
      }
    },

    cancelAll: () => {
      for (const [i] of controllers) get().cancelBay(i);
      get().toast("info", "Alle laufenden Generierungen abgebrochen.");
    },

    clearBay: (index) => {
      const b = get().bays[index];
      if (["story", "tts", "render"].includes(b.status)) get().cancelBay(index);
      if (b.videoUrl) URL.revokeObjectURL(b.videoUrl);
      if (b.thumbUrl && b.thumbUrl.startsWith("blob:")) URL.revokeObjectURL(b.thumbUrl);
      patchBay(index, { ...emptyBay(index), title: b.title, story: b.story, scheduledLocal: b.scheduledLocal });
      idbDelete(`bay-${index}`).catch(() => undefined);
    },

    /* ---------- Downloads ---------- */

    downloadBay: (index) => {
      const b = get().bays[index];
      if (!b.videoBlob) {
        get().toastError("BUFFER_VIDEO_MISSING");
        return;
      }
      const ext = fileExt(b.mimeType);
      const a = document.createElement("a");
      a.href = b.videoUrl ?? URL.createObjectURL(b.videoBlob);
      a.download = `reddit-story-${String(index + 1).padStart(2, "0")}-${slugify(b.title)}.${ext}`;
      a.click();
    },

    downloadZip: async () => {
      const done = get().bays.filter((b) => b.videoBlob);
      if (done.length === 0) {
        get().toastError("BUFFER_VIDEO_MISSING", "Keine fertigen Videos vorhanden");
        return;
      }
      get().toast("info", `ZIP wird erstellt (${done.length} Videos)…`);
      try {
        const zip = new JSZip();
        for (const b of done) {
          const ext = fileExt(b.mimeType);
          zip.file(`reddit-story-${String(b.index + 1).padStart(2, "0")}-${slugify(b.title)}.${ext}`, b.videoBlob as Blob);
        }
        zip.file("beschreibung.txt", VIDEO_DESCRIPTION);
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `reddit-story-${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        get().toast("ok", "ZIP-Download gestartet");
      } catch {
        get().toastError("INTERNAL", "ZIP-Erstellung fehlgeschlagen");
      }
    },

    /* ---------- Buffer ---------- */

    fetchChannels: async () => {
      set({ bufferChannelsLoading: true });
      try {
        const data = await apiCall<{ channels: BufferChannel[] }>("/api/buffer/channels");
        set({ bufferChannels: data.channels });
        const { settings } = get();
        if (!settings.bufferChannelId && data.channels[0]) {
          get().saveSettings({
            bufferChannelId: data.channels[0].id,
            bufferChannelName: data.channels[0].displayName || data.channels[0].name,
          });
        }
        get().toast("ok", `${data.channels.length} Buffer-Kanäle geladen`);
      } catch (e) {
        if (e instanceof AppError) get().toastError(e.code, e.detail);
        else get().toastError("INTERNAL");
      } finally {
        set({ bufferChannelsLoading: false });
      }
    },

    ensureUpload: async (index) => {
      const b = get().bays[index];
      if (b.uploadPath) return b.uploadPath;
      if (!b.videoBlob) throw new AppError("BUFFER_VIDEO_MISSING");
      patchBay(index, { bufferStatus: "uploading", bufferMessage: "Video wird hochgeladen" }, false);
      const fd = new FormData();
      fd.append("file", b.videoBlob, `video.${fileExt(b.mimeType)}`);
      const data = await apiCall<{ path: string }>("/api/uploads", { formData: fd });
      patchBay(index, { uploadPath: data.path }, false);
      return data.path;
    },

    postBay: async (index, mode, dueAtIso) => {
      const st = get();
      const b = st.bays[index];
      if (!b.videoBlob) {
        get().toastError("BUFFER_VIDEO_MISSING");
        return;
      }
      if (!st.settings.bufferChannelId) {
        get().toastError("BUFFER_CHANNEL_MISSING");
        return;
      }
      try {
        const path = await st.ensureUpload(index);
        patchBay(index, { bufferStatus: "posting", bufferMessage: "Wird an Buffer gesendet" }, false);
        const data = await apiCall<{ postId?: string; dueAt?: string }>("/api/buffer/post", {
          method: "POST",
          body: {
            path,
            bayIndex: index,
            title: b.title,
            channelId: st.settings.bufferChannelId,
            mode,
            dueAt: dueAtIso,
          },
        });
        patchBay(index, {
          bufferStatus: "ok",
          bufferMessage:
            mode === "now" ? "Sofort gepostet" : mode === "queue" ? "In der Buffer-Queue" : "Geplant",
          bufferPostId: data.postId ?? null,
          bufferDueAt: data.dueAt ?? dueAtIso ?? null,
        });
        get().toast("ok", `Bay ${index + 1}: ${mode === "now" ? "gepostet" : mode === "queue" ? "in Queue" : "geplant"}`);
      } catch (e) {
        const code = e instanceof AppError ? e.code : "INTERNAL";
        const detail = e instanceof AppError ? e.detail : undefined;
        patchBay(index, { bufferStatus: "error", bufferMessage: errorMessage(code, detail) });
        get().toastError(code, detail);
      }
    },

    postAll: async (mode) => {
      const st = get();
      const settings = st.settings;
      const ready = st.bays
        .slice(0, Math.min(settings.bayCount, st.bays.length))
        .filter((b) => b.status === "done" && b.videoBlob);
      if (ready.length === 0) {
        st.toastError("BUFFER_VIDEO_MISSING", "Keine fertigen Videos zum Posten");
        return;
      }
      if (!settings.bufferChannelId) {
        st.toastError("BUFFER_CHANNEL_MISSING");
        return;
      }
      set({ postingAll: true });

      const startMs = settings.scheduleStart ? new Date(settings.scheduleStart).getTime() : Date.now();
      const gapMs = Math.max(5, settings.scheduleGap) * 60 * 1000;

      for (let i = 0; i < ready.length; i++) {
        const bay = ready[i];
        let dueAtIso: string | undefined;
        if (mode === "scheduled") {
          const t = new Date(startMs + i * gapMs);
          dueAtIso = t.toISOString();
          patchBay(bay.index, { scheduledLocal: toLocalInput(t) });
        }
        await get().postBay(bay.index, mode, dueAtIso);
      }
      set({ postingAll: false });
      get().toast("ok", mode === "now" ? "Alle Videos gepostet" : mode === "queue" ? "Alle Videos in der Queue" : "Alle Videos geplant");
    },

    /* ---------- Autopilot ---------- */

    autopilotLog: (kind, text) => {
      set((st) => ({
        autopilot: { ...st.autopilot, log: [{ ts: Date.now(), kind, text }, ...st.autopilot.log].slice(0, 80) },
      }));
    },

    startAutopilot: () => {
      const { settings } = get();
      const perHour = Math.max(1, settings.autopilotPerHour);
      const nextAt = Date.now() + 5000;
      set((st) => ({ autopilot: { ...st.autopilot, running: true, nextAt, posted: 0 } }));
      get().autopilotLog("info", `Autopilot gestartet – ${perHour} Video(s) pro Stunde`);
      get().toast("ok", `Autopilot läuft (${perHour}/Stunde) – Tab geöffnet lassen!`);
    },

    stopAutopilot: () => {
      set((st) => ({ autopilot: { ...st.autopilot, running: false, nextAt: null } }));
      get().autopilotLog("info", "Autopilot gestoppt");
    },

    autopilotTick: async () => {
      const st = get();
      const ap = st.autopilot;
      if (!ap.running || ap.nextAt === null || Date.now() < ap.nextAt) return;

      const settings = st.settings;
      const perHour = Math.max(1, settings.autopilotPerHour);
      const intervalMs = 3600000 / perHour;
      set((prev) => ({ autopilot: { ...prev.autopilot, nextAt: Date.now() + intervalMs } }));

      if (runningRenders() > 0) {
        get().autopilotLog("info", "Warte – Generierungen laufen bereits");
        return;
      }

      const count = Math.min(settings.bayCount, st.bays.length);
      const index = ap.counter % count;
      set((prev) => ({ autopilot: { ...prev.autopilot, counter: prev.autopilot.counter + 1 } }));

      get().autopilotLog("info", `Starte Generierung für Bay ${index + 1}`);
      get().clearBay(index);
      await get().generateBay(index);

      const bay = get().bays[index];
      if (bay.status !== "done") {
        get().autopilotLog("error", `Bay ${index + 1} fehlgeschlagen: ${bay.errorCode ?? "unbekannt"}`);
        return;
      }
      get().autopilotLog("ok", `Bay ${index + 1} fertig (${fmtBytes(bay.size)})`);

      if (settings.autopilotMode === "draft") return;

      const mode: BufferMode = settings.autopilotMode === "queue" ? "queue" : "scheduled";
      let dueAtIso: string | undefined;
      if (mode === "scheduled") {
        const posted = get().autopilot.posted;
        const due = new Date(Math.max(Date.now() + 5 * 60 * 1000, Date.now() + posted * intervalMs));
        dueAtIso = due.toISOString();
        patchBay(index, { scheduledLocal: toLocalInput(due) });
        get().autopilotLog("info", `Plane Post für ${due.toLocaleString("de-DE")}`);
      } else {
        get().autopilotLog("info", "Sende an Buffer-Queue");
      }
      await get().postBay(index, mode, dueAtIso);
      const after = get().bays[index];
      if (after.bufferStatus === "ok") {
        set((prev) => ({ autopilot: { ...prev.autopilot, posted: prev.autopilot.posted + 1 } }));
        get().autopilotLog("ok", `Bay ${index + 1} an Buffer übergeben`);
      } else {
        get().autopilotLog("error", `Buffer-Fehler: ${after.bufferMessage ?? "unbekannt"}`);
      }
    },
  };
});
