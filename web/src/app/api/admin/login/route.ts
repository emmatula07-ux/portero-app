import { NextResponse } from "next/server";
import { err } from "@/lib/admin";

export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({}));
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return err("Clave incorrecta", 401);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("portero_admin", secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
