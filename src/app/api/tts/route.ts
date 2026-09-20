import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { AppError, errorBody } from "@/lib/errors";

/**
 * POST { text } → Audio (audio/*).
 * Ruft eine Supabase Edge Function für Text-to-Speech auf:
 *   {supabaseUrl}/functions/v1/{ttsFunction}
 * mit Authorization: Bearer {supabaseKey}.
 * Erwartet entweder rohe Audio-Bytes oder JSON mit Base64-Audio.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) throw new AppError("TTS_TEXT_EMPTY");

    const s = await readSettings();
    if (!s.supabaseUrl || !s.supabaseKey) throw new AppError("TTS_NOT_CONFIGURED");

    const base = s.supabaseUrl.replace(/\/+$/, "");
    const fn = (s.ttsFunction || "tts").replace(/^\/+|\/+$/g, "");
    const url = `${base}/functions/v1/${fn}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.supabaseKey}`,
          apikey: s.supabaseKey,
        },
        body: JSON.stringify({
          text,
          input: text, // Kompatibilität mit gängigen TTS-Functions
          voice: s.ttsVoice,
          speed: s.ttsSpeed,
          response_format: "mp3",
          format: "mp3",
        }),
      });
    } catch (e) {
      throw new AppError("TTS_NETWORK", e instanceof Error ? e.message : undefined);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AppError("TTS_HTTP", `HTTP ${res.status}: ${detail.slice(0, 200)}`, 502);
    }

    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("audio") || contentType.includes("octet-stream")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength < 100) throw new AppError("TTS_EMPTY");
      return new Response(buf, {
        headers: {
          "Content-Type": contentType.split(";")[0] || "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    // JSON-Fallback: { audio | audio_base64 | data : "<base64>" }
    if (contentType.includes("json")) {
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const b64 =
        (typeof data?.audio === "string" && data.audio) ||
        (typeof data?.audio_base64 === "string" && data.audio_base64) ||
        (typeof data?.data === "string" && data.data) ||
        "";
      if (b64) {
        const bin = Buffer.from(b64.replace(/^data:[^,]*,/, ""), "base64");
        if (bin.byteLength < 100) throw new AppError("TTS_EMPTY");
        return new Response(new Uint8Array(bin), {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      }
      throw new AppError("TTS_BAD_AUDIO", "JSON ohne Audio-Feld");
    }

    throw new AppError("TTS_BAD_AUDIO", `Content-Type: ${contentType || "unbekannt"}`);
  } catch (e) {
    if (e instanceof AppError) return errorBody(e.code, e.detail, e.status ?? 400);
    return errorBody("INTERNAL", e instanceof Error ? e.message : undefined, 500);
  }
}
