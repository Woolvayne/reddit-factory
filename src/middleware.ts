import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, isTokenValid } from "@/lib/auth";

/**
 * Passwort-Gate für die komplette App.
 * Öffentlich sind nur: /gate (Login-Seite), /api/auth/* und /uploads/*
 * (Letztere muss öffentlich bleiben, damit die Buffer-Server die Videos abrufen können.)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/gate" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health" ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;

  if (await isTokenValid(token)) {
    // Eingeloggte Nutzer sollen die Gate-Seite nicht sehen
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Nicht angemeldet" } },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr).*)"],
};
