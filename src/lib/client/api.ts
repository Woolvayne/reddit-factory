import { AppError } from "@/lib/errors";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; detail?: string };
}

/** JSON-API-Call: wirft AppError mit dem Fehlercode des Servers. */
export async function apiCall<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; formData?: FormData }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options?.method ?? (options?.body || options?.formData ? "POST" : "GET"),
      headers: options?.formData
        ? undefined
        : options?.body
          ? { "Content-Type": "application/json" }
          : undefined,
      body: options?.formData ?? (options?.body ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new AppError("INTERNAL", "Server nicht erreichbar");
  }

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json) throw new AppError("INTERNAL", `HTTP ${res.status}`);
  if (!json.ok) {
    const code = json.error?.code ?? (res.status === 401 ? "AUTH_REQUIRED" : "INTERNAL");
    throw new AppError(code, json.error?.detail, res.status);
  }
  return json.data as T;
}

/** Binär-API-Call (TTS) – Fehler kommen als JSON, Erfolg als Audio-Bytes. */
export async function apiCallBlob(path: string, body: unknown): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError("TTS_NETWORK", "Server nicht erreichbar");
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new AppError(json?.error?.code ?? "TTS_BAD_AUDIO", json?.error?.detail);
  }
  const blob = await res.blob();
  if (blob.size < 100) throw new AppError("TTS_EMPTY");
  return blob;
}
