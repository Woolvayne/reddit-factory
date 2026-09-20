import { NextRequest, NextResponse } from "next/server";
import { maskSettings, readSettings, SECRET_FIELDS, writeSettings } from "@/lib/server/settings";
import { errorBody } from "@/lib/errors";
import { AppSettings } from "@/lib/shared";

export async function GET() {
  try {
    const s = await readSettings();
    return NextResponse.json({ ok: true, data: maskSettings(s) });
  } catch {
    return errorBody("SETTINGS_LOAD_FAILED", undefined, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const incoming = (await req.json()) as Partial<AppSettings>;
    const current = await readSettings();
    const next: Partial<AppSettings> = { ...incoming };

    // Leere oder maskierte Secrets nie überschreiben → bisherigen Wert behalten
    for (const f of SECRET_FIELDS) {
      const v = incoming[f];
      if (typeof v === "string" && (v.trim() === "" || v.includes("•"))) {
        (next as Record<string, unknown>)[f] = current[f];
      }
    }

    await writeSettings(next);
    return NextResponse.json({ ok: true, data: maskSettings(await readSettings()) });
  } catch {
    return errorBody("SETTINGS_SAVE_FAILED", undefined, 500);
  }
}
