/**
 * Reddit Story – Render-Engine (komplett im Browser).
 *
 * Ablauf:
 *  1. Hintergrund-Clip (gemuted, ggf. Loop) wird per Canvas 9:16 gezeichnet.
 *  2. Voiceover kommt als AudioBuffer in die Web-Audio-Pipeline (präziser Takt).
 *  3. Untertitel (Wort-Karaoke) + Titelkarte + Fortschrittsbalken werden gezeichnet.
 *  4. MediaRecorder nimmt Canvas-Stream + Audio auf → fertige Videodatei.
 */

export interface SubtitleWord {
  text: string;
  start: number;
  end: number;
}

export interface SubtitleCue {
  words: SubtitleWord[];
  start: number;
  end: number;
}

export interface RenderSettingsSnapshot {
  resolution: "720" | "1080";
  fps: "30" | "60";
  subtitleEnabled: boolean;
  subtitleWords: number;
  subtitleSize: number;
  subtitlePosition: "center" | "upper" | "lower";
  subtitleColor: string;
  titleCardEnabled: boolean;
  titleCardDuration: number;
  titleCardStyle: "dark" | "accent" | "blur";
  showProgressBar: boolean;
  bgVolume: number;
  videoBitrate: number;
}

export interface RenderInput {
  background: Blob;
  voiceover: Blob;
  title: string;
  ttsText: string; // Text, aus dem das Voiceover erzeugt wurde (für Untertitel-Timing)
  settings: RenderSettingsSnapshot;
  onStage?: (stage: string) => void;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;
  duration: number;
  thumbnail: Blob | null;
}

class RenderError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/* ---------- Untertitel-Timing (geschätzt, wortgewichtet) ---------- */

function wordWeight(word: string): number {
  let w = Math.max(1.6, word.replace(/[^\p{L}\p{N}]/gu, "").length * 0.55 + 1.2);
  if (/[,;:]$/.test(word)) w += 2.2;
  if (/[.!?…]$/.test(word)) w += 4.2;
  return w;
}

export function buildSubtitlePlan(ttsText: string, totalDuration: number, perChunk: number): SubtitleCue[] {
  const words = ttsText.split(/\s+/).filter(Boolean);
  if (words.length === 0 || !isFinite(totalDuration) || totalDuration <= 0) return [];

  const weights = words.map(wordWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const secondsPerWeight = totalDuration / totalWeight;

  const timed: SubtitleWord[] = [];
  let cursor = 0;
  words.forEach((w, i) => {
    const dur = Math.max(0.14, weights[i] * secondsPerWeight);
    timed.push({ text: w, start: cursor, end: cursor + dur });
    cursor += dur;
  });

  const cues: SubtitleCue[] = [];
  for (let i = 0; i < timed.length; i += perChunk) {
    const slice = timed.slice(i, i + perChunk);
    cues.push({ words: slice, start: slice[0].start, end: slice[slice.length - 1].end });
  }
  return cues;
}

/* ---------- Recorder-MIME wählen ---------- */

export function pickRecorderMime(): { mime: string; ext: "mp4" | "webm" } {
  const candidates: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=h264,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "mp4" };
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* weiter */
    }
  }
  return { mime: "", ext: "mp4" };
}

/* ---------- Zeichen-Helfer ---------- */

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  W: number,
  H: number
) {
  const vw = video.videoWidth || W;
  const vh = video.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function cssVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/** roundRect-Fallback für ältere Safari-Versionen. */
function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/* ---------- Hauptfunktion ---------- */

export async function renderStoryVideo(input: RenderInput): Promise<RenderResult> {
  const s = input.settings;
  const signal = input.signal;
  const stage = (x: string) => input.onStage?.(x);

  if (signal?.aborted) throw new RenderError("RENDER_ABORTED");
  if (typeof MediaRecorder === "undefined") throw new RenderError("RENDER_RECORDER");

  /* --- Video-Element (Hintergrund, stumm → Autoplay immer erlaubt) --- */
  stage("Hintergrund wird geladen");
  const bgUrl = URL.createObjectURL(input.background);
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.loop = true;
  video.preload = "auto";
  video.src = bgUrl;
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RenderError("RENDER_TIMEOUT")), 30000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new RenderError("RENDER_BG_LOAD"));
    };
  });

  /* --- Voiceover dekodieren --- */
  stage("Audio wird verarbeitet");
  const AudioCtx: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new RenderError("RENDER_RECORDER");
  const audioCtx = new AudioCtx();
  await audioCtx.resume().catch(() => undefined);

  let voiceBuffer: AudioBuffer;
  try {
    voiceBuffer = await audioCtx.decodeAudioData(await input.voiceover.arrayBuffer());
  } catch {
    audioCtx.close().catch(() => undefined);
    URL.revokeObjectURL(bgUrl);
    throw new RenderError("RENDER_AUDIO_LOAD");
  }

  const duration = voiceBuffer.duration;
  if (!isFinite(duration) || duration < 0.5) {
    audioCtx.close().catch(() => undefined);
    URL.revokeObjectURL(bgUrl);
    throw new RenderError("RENDER_AUDIO_LOAD");
  }

  /* --- Optional: Hintergrund-Audio dekodieren --- */
  let bgBuffer: AudioBuffer | null = null;
  if (s.bgVolume > 0) {
    try {
      bgBuffer = await audioCtx.decodeAudioData(await input.background.arrayBuffer());
    } catch {
      bgBuffer = null; // Hintergrund-Audio ist optional
    }
  }

  /* --- Canvas vorbereiten --- */
  stage("Renderer wird vorbereitet");
  const W = s.resolution === "1080" ? 1080 : 720;
  const H = W === 1080 ? 1920 : 1280;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new RenderError("RENDER_RECORDER");
  const supportsFilter = typeof ctx.filter === "string";

  const fontFamily = `"Space Grotesk","Segoe UI",Arial,sans-serif`;
  try {
    await Promise.all([
      document.fonts.load(`700 ${Math.round(W * 0.062)}px "Space Grotesk"`),
      document.fonts.load(`600 ${Math.round(W * 0.04)}px "Space Grotesk"`),
    ]);
  } catch {
    /* Fallback-Fonts greifen */
  }

  const accent = cssVar("--accent", "#ffffff");
  const cues = s.subtitleEnabled ? buildSubtitlePlan(input.ttsText, duration, Math.max(1, s.subtitleWords)) : [];

  /* --- Startpunkt im Hintergrund-Clip (zufällig, wenn möglich) --- */
  const bgDur = video.duration || 0;
  const margin = duration + 1;
  const offset = bgDur > margin ? Math.random() * (bgDur - margin) : 0;
  video.currentTime = offset;

  /* --- Streams & Recorder --- */
  const fps = s.fps === "60" ? 60 : 30;
  const canvasStream = canvas.captureStream(fps);
  const streamDest = audioCtx.createMediaStreamDestination();

  const voiceGain = audioCtx.createGain();
  voiceGain.gain.value = 1;
  voiceGain.connect(streamDest);

  if (bgBuffer) {
    const bgSrc = audioCtx.createBufferSource();
    bgSrc.buffer = bgBuffer;
    bgSrc.loop = true;
    const bgGain = audioCtx.createGain();
    bgGain.gain.value = Math.max(0, Math.min(1, s.bgVolume)) * 0.5;
    bgSrc.connect(bgGain).connect(streamDest);
    bgSrc.start(0, Math.min(offset, Math.max(0, bgBuffer.duration - 0.1)));
  }

  const voiceSrc = audioCtx.createBufferSource();
  voiceSrc.buffer = voiceBuffer;
  voiceSrc.connect(voiceGain);

  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...streamDest.stream.getAudioTracks(),
  ]);

  const { mime } = pickRecorderMime();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(mixed, {
      mimeType: mime || undefined,
      videoBitsPerSecond: Math.max(2, s.videoBitrate) * 1_000_000,
      audioBitsPerSecond: 160_000,
    });
  } catch {
    try {
      recorder = new MediaRecorder(mixed);
    } catch {
      audioCtx.close().catch(() => undefined);
      URL.revokeObjectURL(bgUrl);
      throw new RenderError("RENDER_RECORDER");
    }
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const titleCardDur =
    s.titleCardEnabled && input.title.trim()
      ? Math.max(0.5, Math.min(s.titleCardDuration, duration * 0.5))
      : 0;

  /* --- Einzelframe-Zeichner --- */
  const subFontPx = Math.round(W * 0.062 * s.subtitleSize);
  const titleFontPx = Math.round(W * 0.075);
  let thumbnail: Blob | null = null;
  let thumbCaptured = false;

  const drawFrame = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawCover(ctx, video, W, H);
    drawVignette(ctx, W, H);

    /* Untertitel */
    if (s.subtitleEnabled && cues.length > 0 && t >= 0.05) {
      const cue = cues.find((c) => t >= c.start && t < c.end + 0.12);
      if (cue) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${subFontPx}px ${fontFamily}`;

        const maxW = W * 0.88;
        const yCenter =
          s.subtitlePosition === "upper" ? H * 0.3 : s.subtitlePosition === "lower" ? H * 0.68 : H * 0.5;

        // Zweizeilige Aufteilung bei Bedarf
        const words = cue.words;
        const full = words.map((w) => w.text).join(" ");
        let lines: SubtitleWord[][] = [words];
        if (ctx.measureText(full).width > maxW && words.length > 1) {
          const mid = Math.ceil(words.length / 2);
          lines = [words.slice(0, mid), words.slice(mid)];
        }
        const lineH = subFontPx * 1.28;
        const startY = yCenter - ((lines.length - 1) * lineH) / 2;

        // Hintergrund-Pille
        const widths = lines.map((l) =>
          Math.min(maxW, ctx.measureText(l.map((w) => w.text).join(" ")).width)
        );
        const padX = subFontPx * 0.55;
        const padY = subFontPx * 0.34;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        lines.forEach((l, i) => {
          const w = widths[i] + padX * 2;
          const y = startY + i * lineH;
          rr(ctx, W / 2 - w / 2, y - subFontPx / 2 - padY + subFontPx * 0.1, w, subFontPx + padY * 2 - subFontPx * 0.1, subFontPx * 0.45);
        });
        ctx.fill();

        lines.forEach((line, li) => {
          const y = startY + li * lineH;
          const lineText = line.map((w) => w.text).join(" ");
          const lineWidth = ctx.measureText(lineText).width;
          let x = W / 2 - lineWidth / 2;

          ctx.textAlign = "left";
          for (const w of line) {
            const active = t >= w.start && t < w.end;
            ctx.font = `${active ? 700 : 600} ${subFontPx}px ${fontFamily}`;
            ctx.lineJoin = "round";
            ctx.strokeStyle = "rgba(0,0,0,0.9)";
            ctx.lineWidth = subFontPx * 0.16;
            ctx.strokeText(w.text, x, y);
            ctx.fillStyle = active ? accent : s.subtitleColor;
            ctx.fillText(w.text, x, y);
            x +=
              ctx.measureText(w.text).width + ctx.measureText(" ").width;
          }
          ctx.textAlign = "center";
        });
      }
    }

    /* Titelkarte */
    if (titleCardDur > 0 && t < titleCardDur) {
      const fade = Math.min(1, (titleCardDur - t) / 0.4, t / 0.12);
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);

      if (s.titleCardStyle === "accent") {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, accent);
        g.addColorStop(1, "#00000088");
        ctx.fillStyle = g;
        ctx.globalAlpha = Math.max(0, fade) * 0.92;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = Math.max(0, fade);
      } else if (s.titleCardStyle === "blur" && supportsFilter) {
        ctx.filter = "blur(26px) brightness(0.55) saturate(1.2)";
        drawCover(ctx, video, W, H);
        ctx.filter = "none";
        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.86)";
        ctx.fillRect(0, 0, W, H);
      }

      // Badge
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const badgeFont = Math.round(W * 0.032);
      ctx.font = `700 ${badgeFont}px ${fontFamily}`;
      const badgeText = "REDDIT STORY";
      const badgeW = ctx.measureText(badgeText).width + badgeFont * 2.6;
      const badgeH = badgeFont * 2.2;
      const badgeY = H * 0.34;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      rr(ctx, W / 2 - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH / 2);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillText(badgeText, W / 2, badgeY + badgeFont * 0.08);

      // Titel (mehrzeilig)
      ctx.font = `700 ${titleFontPx}px ${fontFamily}`;
      const titleLines = wrapLines(ctx, input.title.trim(), W * 0.84).slice(0, 3);
      const titleLineH = titleFontPx * 1.18;
      const titleStartY = H * 0.5 - ((titleLines.length - 1) * titleLineH) / 2;
      titleLines.forEach((line, i) => {
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = titleFontPx * 0.12;
        ctx.strokeText(line, W / 2, titleStartY + i * titleLineH);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line, W / 2, titleStartY + i * titleLineH);
      });

      // Akzent-Linie
      ctx.fillStyle = accent;
      const lw = W * 0.18;
      ctx.beginPath();
      rr(ctx, W / 2 - lw / 2, titleStartY + titleLines.length * titleLineH + titleFontPx * 0.35, lw, W * 0.012, W * 0.006);
      ctx.fill();
      ctx.restore();
    }

    /* Fortschrittsbalken */
    if (s.showProgressBar) {
      const barH = Math.max(4, W * 0.009);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(0, 0, W, barH);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, (t / duration) * W, barH);
    }
  };

  /* --- Rendern --- */
  stage("Video wird gerendert");
  const result = await new Promise<RenderResult>((resolve, reject) => {
    let raf = 0;
    let finished = false;
    const wallStart = performance.now();

    const cleanup = () => {
      cancelAnimationFrame(raf);
      video.pause();
      video.src = "";
      try {
        recorder.state !== "inactive" && recorder.stop();
      } catch {
        /* bereits gestoppt */
      }
      audioCtx.close().catch(() => undefined);
      URL.revokeObjectURL(bgUrl);
    };

    const onAbort = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new RenderError("RENDER_ABORTED"));
    };
    signal?.addEventListener("abort", onAbort);

    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      const type = recorder.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      cleanup();
      signal?.removeEventListener("abort", onAbort);
      if (blob.size < 1000) reject(new RenderError("RENDER_RECORDER"));
      else resolve({ blob, mimeType: type, duration, thumbnail });
    };
    recorder.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new RenderError("RENDER_RECORDER"));
    };

    const t0 = audioCtx.currentTime + 0.08;
    const tick = () => {
      if (finished) return;
      const t = audioCtx.currentTime - t0;

      // Sicherheits-Timeout: max 3x Videolänge + 30s
      if (performance.now() - wallStart > duration * 3000 + 30000) {
        try {
          recorder.stop();
        } catch {
          onAbort();
        }
        return;
      }

      if (t >= 0) {
        drawFrame(t);
        input.onProgress?.(Math.min(1, t / duration));

        if (!thumbCaptured && t > duration * 0.45) {
          thumbCaptured = true;
          const tc = document.createElement("canvas");
          const tw = 216;
          tc.width = tw;
          tc.height = Math.round((tw * H) / W);
          const tctx = tc.getContext("2d");
          if (tctx) {
            tctx.drawImage(canvas, 0, 0, tc.width, tc.height);
            tc.toBlob((b) => (thumbnail = b), "image/jpeg", 0.72);
          }
        }

        if (t >= duration) {
          try {
            recorder.stop();
          } catch {
            /* noop */
          }
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    recorder.start(500);
    video
      .play()
      .then(() => {
        voiceSrc.start(t0);
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        finished = true;
        cleanup();
        reject(new RenderError("RENDER_BG_LOAD"));
      });

    voiceSrc.onended = () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* noop */
      }
    };
  });

  return result;
}
