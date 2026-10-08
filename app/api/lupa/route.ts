import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Selalu menjawab sama, baik akunnya ada maupun tidak, agar orang lain tidak bisa menebak username.
export async function POST(req: Request) {
  const { identifier } = await req.json().catch(() => ({}));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return NextResponse.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
  if (typeof identifier !== "string" || !identifier.trim()) return NextResponse.json({ error: "Isi username atau email." }, { status: 400 });

  let email = identifier.trim();
  if (!email.includes("@")) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await admin.from("profiles").select("email").eq("username_lower", email.replace(/\s+/g, " ").toLowerCase()).maybeSingle();
    if (!data) return NextResponse.json({ ok: true });
    email = data.email;
  }

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const redirectTo = req.headers.get("origin") ?? new URL(req.url).origin;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error && /rate limit|seconds/i.test(error.message)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
