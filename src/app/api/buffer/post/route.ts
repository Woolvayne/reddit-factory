import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/server/settings";
import { createBufferPost, BufferMode } from "@/lib/server/buffer";
import { AppError, errorBody } from "@/lib/errors";
import { VIDEO_DESCRIPTION } from "@/lib/shared";
import { db } from "@/db";
import { bufferJobs } from "@/db/schema";

const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|.*\.local$|.*\.internal$)/i;

/** Ermittelt die öffentliche Basis-URL aus den Request-Headern. */
function publicBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

/**
 * POST { path, bayIndex, title, channelId?, mode, dueAt? }
 * → erstellt den Buffer-Post mit Video-URL und der festen Video-Beschreibung.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    path?: string;
    bayIndex?: number;
    title?: string;
    channelId?: string;
    mode?: BufferMode;
    dueAt?: string;
  };
  const mode: BufferMode = body.mode ?? "queue";
  let logStatus = "error";
  let logMessage = "";
  let postId: string | null = null;
  let dueAt: string | undefined;

  try {
    const s = await readSettings();
    if (!s.bufferToken) throw new AppError("BUFFER_TOKEN_MISSING");
    const channelId = body.channelId || s.bufferChannelId;
    if (!channelId) throw new AppError("BUFFER_CHANNEL_MISSING");
    if (!body.path || !body.path.startsWith("/uploads/")) throw new AppError("BUFFER_VIDEO_MISSING");

    const base = publicBaseUrl(req);
    const host = base.replace(/^https?:\/\//, "").split(":")[0];
    if (PRIVATE_HOST.test(host) || !host) {
      throw new AppError(
        "BUFFER_PRIVATE_URL",
        `Host "${host || "unbekannt"}" ist nicht öffentlich erreichbar`
      );
    }

    const videoUrl = `${base}${body.path}`;
    const result = await createBufferPost(s.bufferToken, {
      channelId,
      text: VIDEO_DESCRIPTION, // feste Beschreibung – immer gleich
      videoUrl,
      mode,
      dueAt: body.dueAt,
    });

    logStatus = "success";
    logMessage = mode === "now" ? "Sofort gepostet" : mode === "queue" ? "In Buffer-Queue" : "Geplant";
    postId = result.postId;
    dueAt = result.dueAt;

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    if (e instanceof AppError) {
      logMessage = e.message + (e.detail ? ` – ${e.detail}` : "");
      return errorBody(e.code, e.detail, e.status ?? 400);
    }
    logMessage = e instanceof Error ? e.message : "unbekannt";
    return errorBody("INTERNAL", logMessage, 500);
  } finally {
    try {
      await db.insert(bufferJobs).values({
        bayIndex: body.bayIndex ?? null,
        title: (body.title ?? "").slice(0, 300),
        channelId: body.channelId ?? "",
        mode,
        status: logStatus,
        bufferPostId: postId,
        dueAt: dueAt ?? body.dueAt ?? null,
        message: logMessage.slice(0, 500),
      });
    } catch {
      // Logging-Fehler soll den eigentlichen Request nicht brechen
    }
  }
}
