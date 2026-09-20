import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { uploadsDir } from "@/app/api/uploads/route";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  bin: "application/octet-stream",
};

/**
 * GET /uploads/<name> – ÖFFENTLICH (kein Passwort):
 * Die Buffer-Server müssen die Videos von dort abrufen können.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await ctx.params;
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.includes("..")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const file = path.join(uploadsDir(), name);
    const info = await stat(file);
    const buf = await readFile(file);
    const ext = name.split(".").pop()?.toLowerCase() ?? "bin";

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? MIME.bin,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
}
