import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { errorBody } from "@/lib/errors";

export function uploadsDir(): string {
  return process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(process.cwd(), ".data", "uploads");
}

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * POST multipart FormData { file } → { ok, data: { path, size, name } }
 * Speichert das fertige Video, damit die Buffer-Server es über die öffentliche
 * URL /uploads/<name> abrufen können.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) return errorBody("UPLOAD_READ_FAILED", "Kein File im Request", 400);
    if (!file.type.startsWith("video/")) return errorBody("UPLOAD_BAD_TYPE", file.type, 415);
    if (file.size > MAX_BYTES) return errorBody("UPLOAD_TOO_LARGE", `${Math.round(file.size / 1e6)} MB`, 413);

    const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("webm") ? "webm" : "bin";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ ok: true, data: { path: `/uploads/${name}`, size: file.size, name } });
  } catch (e) {
    return errorBody("BUFFER_UPLOAD_FAILED", e instanceof Error ? e.message : undefined, 500);
  }
}
