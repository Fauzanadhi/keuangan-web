"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Daftar() {
  const [f, setF] = useState({ username: "", email: "", password: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const username = f.username.trim().replace(/\s+/g, " ");
    if (username.length < 3 || username.length > 20 || !/^[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$/.test(username)) return setMsg("Username 3-20 karakter: huruf, angka, spasi, atau garis bawah (_).");
    if (f.password.length < 6) return setMsg("Kata sandi minimal 6 karakter.");
    if (f.password !== f.confirm) return setMsg("Konfirmasi kata sandi tidak sama.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { username }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setMsg(/database error/i.test(error.message) ? "Username sudah dipakai, coba yang lain." : error.message);
    if (data.session) window.location.href = "/";
    else setDone(true);
  }

  if (done)
    return (
      <main className="wrap">
        <div className="card login">
          <h1>Cek Gmail kamu</h1>
          <p>Kami mengirim tautan konfirmasi ke {f.email.trim()}. Klik tautannya, lalu masuk dengan username <b>{f.username.trim().replace(/\s+/g, " ")}</b>.</p>
          <a className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/">Ke halaman masuk</a>
        </div>
      </main>
    );

  return (
    <main className="wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Buat akun</h1>
        <p>Isi data di bawah untuk mulai mencatat keuanganmu.</p>
        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" required autoComplete="username" placeholder="mis. Fauzan Adhi" value={f.username} onChange={set("username")} />
        </div>
        <div className="field">
          <label htmlFor="e">Gmail</label>
          <input id="e" type="email" required autoComplete="email" placeholder="nama@gmail.com" value={f.email} onChange={set("email")} />
        </div>
        <div className="field">
          <label htmlFor="p">Kata sandi</label>
          <input id="p" type="password" required autoComplete="new-password" value={f.password} onChange={set("password")} />
        </div>
        <div className="field">
          <label htmlFor="c">Konfirmasi kata sandi</label>
          <input id="c" type="password" required autoComplete="new-password" value={f.confirm} onChange={set("confirm")} />
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Membuat akun..." : "Daftar"}</button>
        <p className="alt">Sudah punya akun? <a href="/">Masuk</a></p>
      </form>
    </main>
  );
}
