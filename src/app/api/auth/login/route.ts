import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, appPassword, tokenForPassword } from "@/lib/auth";
import { errorBody } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };
    const expected = appPassword();

    if (!expected) return errorBody("AUTH_NOT_CONFIGURED", undefined, 500);

    if (!password || password !== expected) {
      return errorBody("AUTH_WRONG_PASSWORD", undefined, 401);
    }

    const token = await tokenForPassword(expected);
    const res = NextResponse.json({ ok: true });
    // Session-Cookie (ohne Max-Age) → wird bei Browser-Neustart erneut gefragt.
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
    });
    return res;
  } catch {
    return errorBody("INTERNAL", "Login fehlgeschlagen", 500);
  }
}
