import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, isTokenValid } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (await isTokenValid(token)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
