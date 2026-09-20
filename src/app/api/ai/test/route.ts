import { NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { chatCompletion } from "@/lib/server/ai";
import { AppError, errorBody } from "@/lib/errors";

/** POST → testet den hinterlegten KI-Key mit einer minimalen Anfrage. */
export async function POST() {
  try {
    const s = await readSettings();
    const answer = await chatCompletion(s, "You are a connectivity probe.", "Reply with exactly: OK", 16);
    return NextResponse.json({ ok: true, data: { answer: answer.slice(0, 60), model: s.aiModel } });
  } catch (e) {
    if (e instanceof AppError) return errorBody(e.code, e.detail, e.status ?? 400);
    return errorBody("INTERNAL", e instanceof Error ? e.message : undefined, 500);
  }
}
