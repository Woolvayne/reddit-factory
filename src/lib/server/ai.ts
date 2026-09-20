import { AppError } from "@/lib/errors";
import { AppSettings } from "@/lib/shared";

interface ChatChoice {
  choices?: { message?: { content?: string } }[];
}

export async function chatCompletion(
  s: AppSettings,
  system: string,
  user: string,
  maxTokens = 1200
): Promise<string> {
  if (!s.aiKey) throw new AppError("AI_KEY_MISSING");
  const base = (s.aiBaseUrl || "").replace(/\/+$/, "");
  if (!base) throw new AppError("AI_NETWORK", "Keine Basis-URL konfiguriert");

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.aiKey}`,
      },
      body: JSON.stringify({
        model: s.aiModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.9,
        max_tokens: maxTokens,
      }),
    });
  } catch (e) {
    throw new AppError("AI_NETWORK", e instanceof Error ? e.message : undefined);
  }

  if (res.status === 401 || res.status === 403) {
    throw new AppError("AI_HTTP", `Ungültiger API-Key (${res.status})`, 401);
  }
  if (res.status === 429) throw new AppError("AI_RATE_LIMIT", undefined, 429);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new AppError("AI_HTTP", `HTTP ${res.status}: ${txt.slice(0, 200)}`, 502);
  }

  const data = (await res.json().catch(() => null)) as ChatChoice | null;
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AppError("AI_EMPTY");
  return content;
}

/** Extrahiert das erste JSON-Objekt aus einer (ggf. verschmutzten) KI-Antwort. */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new AppError("AI_BAD_JSON");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new AppError("AI_BAD_JSON");
  }
}

export function storySystemPrompt(): string {
  return [
    "You write viral Reddit-style stories for vertical short videos (TikTok / YouTube Shorts).",
    "Return STRICT JSON only: {\"title\": string, \"story\": string}. No markdown, no commentary.",
    "Title rules: punchy Reddit hook, max 95 characters, e.g. like 'AITA for banishing my MIL from delivery room?' or a dramatic one-liner. No hashtags, no emojis.",
    "Story rules: first person, spoken-word friendly, extremely engaging hook in the FIRST sentence, rising tension, a twist or satisfying payoff at the end.",
    "No chapter markers, no quotes around the story, no stage directions. Plain sentences only, ready for text-to-speech.",
  ].join(" ");
}

export function storyUserPrompt(s: AppSettings, variant: number): string {
  const lang = s.storyLanguage === "de" ? "German" : "English";
  const topic =
    s.storyTopic.trim() ||
    "surprise me with a dramatic relationship / family / workplace / revenge / money / neighbor conflict in typical Reddit style";
  return [
    `Write a ~${s.storyLength}-words story in ${lang}.`,
    `Topic: ${topic}.`,
    variant > 0 ? `This is variation #${variant + 1} of a batch – make it clearly different from generic versions (new scenario, new names, new twist).` : "",
    "Return JSON now.",
  ]
    .filter(Boolean)
    .join(" ");
}
