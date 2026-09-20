import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { chatCompletion, extractJson } from "@/lib/server/ai";
import { AppError, errorBody } from "@/lib/errors";

/** POST { count } → { ok, data: { titles: string[] } } – generiert N Titel auf Knopfdruck. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { count?: number };
    const count = Math.min(Math.max(body.count ?? 10, 1), 20);
    const s = await readSettings();

    const lang = s.storyLanguage === "de" ? "German" : "English";
    const system = [
      "You invent viral Reddit-style post titles for short vertical videos.",
      'Return STRICT JSON only: {"titles": string[]}. No markdown, no commentary.',
      "Each title max 95 characters, punchy hook style (like AITA / TIFU / dramatic one-liners), no hashtags, no emojis, all clearly different from each other.",
    ].join(" ");
    const user = `Generate exactly ${count} titles in ${lang}. Topic: ${
      s.storyTopic.trim() || "dramatic Reddit stories (relationships, family, money, revenge, neighbors, work)"
    }.`;

    const raw = await chatCompletion(s, system, user, 1400);
    const parsed = extractJson<{ titles?: unknown }>(raw);

    const titles = Array.isArray(parsed.titles)
      ? parsed.titles
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().replace(/^["'“„]+|["'“”]+$/g, ""))
          .filter(Boolean)
          .slice(0, count)
      : [];

    if (titles.length === 0) throw new AppError("AI_EMPTY");
    return NextResponse.json({ ok: true, data: { titles } });
  } catch (e) {
    if (e instanceof AppError) return errorBody(e.code, e.detail, e.status ?? 400);
    return errorBody("INTERNAL", e instanceof Error ? e.message : undefined, 500);
  }
}
