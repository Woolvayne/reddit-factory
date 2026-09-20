import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppSettings, DEFAULT_SETTINGS } from "@/lib/shared";

const KEY = "app";

export const SECRET_FIELDS = ["aiKey", "supabaseKey", "bufferToken"] as const;

export async function readSettings(): Promise<AppSettings> {
  try {
    const rows = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
    const stored = (rows[0]?.value ?? {}) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(next: Partial<AppSettings>): Promise<void> {
  const current = await readSettings();
  const merged: AppSettings = { ...current, ...next };

  await db
    .insert(settings)
    .values({ key: KEY, value: merged, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: merged, updatedAt: new Date() },
    });
}

/** Maskiert Secrets für die Auslieferung an den Client. */
export function maskSettings(s: AppSettings): AppSettings {
  const out = { ...s };
  for (const f of SECRET_FIELDS) {
    if (out[f]) (out as Record<string, unknown>)[f] = "••••••••••";
  }
  return out;
}
