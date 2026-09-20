/**
 * Passwort-Schutz: Das Passwort kommt aus der Environment Variable APP_PASSWORD.
 * Der Session-Cookie enthält ein SHA-256-Token, das sich aus dem Passwort ableitet –
 * so bleibt das Passwort selbst nie im Browser sichtbar. Der Cookie ist ein
 * Session-Cookie: Nach dem Schließen des Browsers wird erneut gefragt.
 */
export const AUTH_COOKIE = "rs_auth";

export function appPassword(): string | null {
  return process.env.APP_PASSWORD ?? null;
}

export async function tokenForPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`reddit-story-auth::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedToken(): Promise<string | null> {
  const pw = appPassword();
  if (!pw) return null;
  return tokenForPassword(pw);
}

export async function isTokenValid(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedToken();
  if (!expected) return false;
  return token === expected;
}
