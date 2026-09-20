import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { chatCompletion, extractJson, storySystemPrompt, storyUserPrompt } from "@/lib/server/ai";
import { AppError, errorBody } from "@/lib/errors";

/** POST { index } → { ok, data: { title, story } } – generiert Story + Titel für eine Bay. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { index?: number };
    const s = await readSettings();
    const raw = await chatCompletion(s, storySystemPrompt(), storyUserPrompt(s, body.index ?? 0), 1800);
    const parsed = extractJson<{ title?: string; story?: string }>(raw);

    const title = (parsed.title ?? "").trim().replace(/^["'“„]+|["'“”]+$/g, "");
    const story = (parsed.story ?? "").trim();
    if (!story) throw new AppError("AI_EMPTY");

    return NextResponse.json({ ok: true, data: { title, story } });
  } catch (e) {
    if (e instanceof AppError) return errorBody(e.code, e.detail, e.status ?? 400);
    return errorBody("INTERNAL", e instanceof Error ? e.message : undefined, 500);
  }
}
