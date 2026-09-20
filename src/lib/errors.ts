/**
 * Zentrales Fehler-Register: Jeder Fehlercode hat eine eigene, klare
 * deutschsprachige Meldung, die im UI als Toast angezeigt wird.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  AUTH_REQUIRED: "Zugriff verweigert – bitte melde dich erneut an.",
  AUTH_WRONG_PASSWORD: "Falsches Passwort. Bitte versuche es erneut.",
  AUTH_NOT_CONFIGURED: "APP_PASSWORD ist nicht gesetzt – bitte Environment Variable prüfen.",

  // Einstellungen / Datenbank
  SETTINGS_SAVE_FAILED: "Einstellungen konnten nicht gespeichert werden.",
  SETTINGS_LOAD_FAILED: "Einstellungen konnten nicht geladen werden.",
  DB_ERROR: "Datenbankfehler. Bitte prüfe die PostgreSQL-Verbindung.",

  // KI
  AI_KEY_MISSING: "Kein KI-API-Key hinterlegt. Trage z. B. deinen Mistral- oder Qwen-Key in den Einstellungen ein.",
  AI_HTTP: "Die KI hat eine Fehlermeldung zurückgegeben.",
  AI_NETWORK: "Die KI ist nicht erreichbar. Prüfe Internetverbindung und Basis-URL.",
  AI_BAD_JSON: "Die KI-Antwort konnte nicht gelesen werden (kein gültiges JSON).",
  AI_EMPTY: "Die KI hat eine leere Antwort geliefert. Bitte erneut versuchen.",
  AI_RATE_LIMIT: "KI-Limit erreicht – bitte kurz warten und erneut versuchen.",

  // TTS (Supabase)
  TTS_NOT_CONFIGURED: "Supabase TTS ist nicht konfiguriert. Hinterlege URL und Key in den Einstellungen.",
  TTS_HTTP: "Die Supabase-TTS-Funktion hat einen Fehler gemeldet.",
  TTS_BAD_AUDIO: "Antwort der TTS-Funktion war kein Audio. Prüfe die Edge Function.",
  TTS_EMPTY: "Die TTS-Funktion hat keine Audiodaten zurückgegeben.",
  TTS_NETWORK: "Supabase TTS ist nicht erreichbar. Prüfe URL und Key.",
  TTS_TEXT_EMPTY: "Kein Text für die Sprachausgabe vorhanden (erst Story generieren).",

  // Buffer
  BUFFER_TOKEN_MISSING: "Kein Buffer-API-Key hinterlegt. Erstelle ihn unter publish.buffer.com/settings/api.",
  BUFFER_CHANNEL_MISSING: "Kein Buffer-Kanal ausgewählt. Lade deine Kanäle und wähle einen aus.",
  BUFFER_VIDEO_MISSING: "Für diese Bay liegt noch kein fertiges Video vor.",
  BUFFER_PRIVATE_URL: "Diese Seite läuft lokal – Buffer kann das Video nicht abrufen. Nutze eine öffentliche URL.",
  BUFFER_GRAPHQL: "Buffer hat den Post abgelehnt.",
  BUFFER_HTTP: "Die Buffer API ist nicht erreichbar.",
  BUFFER_INVALID_TOKEN: "Der Buffer-API-Key ist ungültig oder abgelaufen.",
  BUFFER_UPLOAD_FAILED: "Das Video konnte nicht zum Server hochgeladen werden.",
  BUFFER_NO_CHANNELS: "Keine Buffer-Kanäle gefunden. Verbinde einen Kanal in Buffer.",

  // Upload
  UPLOAD_TOO_LARGE: "Die Datei ist zu groß (Limit: 500 MB).",
  UPLOAD_BAD_TYPE: "Dieser Dateityp wird nicht unterstützt.",
  UPLOAD_READ_FAILED: "Die Datei konnte nicht gelesen werden.",

  // Rendering
  RENDER_NO_BG: "Kein Hintergrund-Clip ausgewählt. Lade zuerst ein Video hoch.",
  RENDER_NO_AUDIO: "Keine Audiodatei vorhanden. Erstelle TTS oder lade Audio hoch.",
  RENDER_BG_LOAD: "Der Hintergrund-Clip konnte nicht geladen werden (Format?).",
  RENDER_AUDIO_LOAD: "Die Audiodatei konnte nicht geladen werden (Format?).",
  RENDER_RECORDER: "Videoaufnahme wird in diesem Browser nicht unterstützt.",
  RENDER_ABORTED: "Die Generierung wurde abgebrochen.",
  RENDER_TIMEOUT: "Das Rendern hat zu lange gedauert und wurde gestoppt.",

  // Browser / Medien
  BROWSER_UNSUPPORTED: "Dein Browser unterstützt diese Funktion nicht.",
  FILE_READ: "Die Datei konnte nicht eingelesen werden.",

  INTERNAL: "Unerwarteter Fehler. Details stehen in der Konsole.",
};

export class AppError extends Error {
  code: string;
  detail?: string;
  status?: number;

  constructor(code: string, detail?: string, status?: number) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export function errorMessage(code?: string, detail?: string): string {
  const base = ERROR_MESSAGES[code ?? ""] ?? ERROR_MESSAGES.INTERNAL;
  return detail ? `${base} (${detail})` : base;
}

export function errorBody(code: string, detail?: string, status = 400) {
  return Response.json(
    { ok: false, error: { code, message: errorMessage(code, detail), detail } },
    { status }
  );
}
