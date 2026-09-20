import { NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { fetchBufferChannels } from "@/lib/server/buffer";
import { AppError, errorBody } from "@/lib/errors";

/** GET → listet alle verbundenen Buffer-Kanäle (Channels) des Accounts. */
export async function GET() {
  try {
    const s = await readSettings();
    if (!s.bufferToken) throw new AppError("BUFFER_TOKEN_MISSING");
    const channels = await fetchBufferChannels(s.bufferToken);
    if (channels.length === 0) throw new AppError("BUFFER_NO_CHANNELS");
    return NextResponse.json({ ok: true, data: { channels } });
  } catch (e) {
    if (e instanceof AppError) return errorBody(e.code, e.detail, e.status ?? 400);
    return errorBody("INTERNAL", e instanceof Error ? e.message : undefined, 500);
  }
}
