import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Login dengan username: cari email-nya di server (kunci service_role tidak pernah dikirim ke browser).
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return NextResponse.json({ error: "Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });

  const fail = () => NextResponse.json({ error: "Username atau kata sandi salah." }, { status: 401 });
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) return fail();

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: prof } = await admin.from("profiles").select("email").eq("username_lower", username.trim().replace(/\s+/g, " ").toLowerCase()).maybeSingle();
  if (!prof) return fail();

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: prof.email, password });
  if (error || !data.session) {
    if (error && /not confirmed/i.test(error.message)) return NextResponse.json({ error: "Email belum dikonfirmasi. Cek Gmail kamu." }, { status: 401 });
    return fail();
  }
  return NextResponse.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
