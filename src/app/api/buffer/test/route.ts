import { NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { fetchBufferChannels } from "@/lib/server/buffer";
import { AppError, errorBody } from "@/lib/errors";

/** POST → prüft den Buffer-Key und meldet Kanal-Anzahl zurück. */
export async function POST() {
  try {
    const s = await readSettings();
    if (!s.bufferToken) throw new AppError("BUFFER_TOKEN_MISSING");
    const channels = await fetchBufferChannels(s.bufferToken);
    return NextResponse.json({
      ok: true,
      data: { channelCount: channels.length, channels: channels.slice(0, 5).map((c) => c.displayName || c.name) },
    });
  } catch (e) {
    if (e instanceof AppError) return errorBody(e.code, e.detail, e.status ?? 400);
    return errorBody("INTERNAL", e instanceof Error ? e.message : undefined, 500);
  }
}
