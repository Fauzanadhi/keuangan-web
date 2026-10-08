"use client";

import { useState } from "react";

export default function Lupa() {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/lupa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: id }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setDone(true);
    else setMsg(j.error ?? "Terjadi kesalahan, coba lagi.");
  }

  if (done)
    return (
      <main className="wrap">
        <div className="card login">
          <h1>Cek Gmail kamu</h1>
          <p>Kalau akunnya ditemukan, tautan untuk membuat kata sandi baru sudah dikirim ke emailnya. Cek juga folder Spam, dan klik tautannya dalam waktu satu jam.</p>
          <a className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/">Kembali ke halaman masuk</a>
        </div>
      </main>
    );

  return (
    <main className="wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Lupa kata sandi</h1>
        <p>Masukkan username atau email akunmu.</p>
        <div className="field">
          <label htmlFor="id">Username atau email</label>
          <input id="id" required autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Mengirim..." : "Kirim tautan reset"}</button>
        <p className="alt"><a href="/">Kembali ke halaman masuk</a></p>
      </form>
    </main>
  );
}
