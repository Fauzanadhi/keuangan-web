"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isRecovery, linkExpired, supabase } from "@/lib/supabase";

type Tx = { id: string; date: string; type: "in" | "out"; amount: number; category: string; note: string | null; wallet_id: string | null };
type Budget = { category: string; amount: number; kind: "limit" | "target" };

const IN_CATS = ["Deposit", "Gaji", "Lainnya"];
const OUT_CATS = ["Jajan", "Jalan", "Kebutuhan", "Tanggungan", "Infaq", "Tabungan", "Lainnya"];
const DEFAULT_BUDGETS: Budget[] = [
  { category: "Jajan", amount: 200000, kind: "limit" },
  { category: "Tabungan", amount: 150000, kind: "target" },
];
const COLORS = ["#2dd4a7", "#f59bb0", "#4a7bd8", "#9c98f2", "#fdbe2d", "#e03e6b", "#8a8fa8"];

const rp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthLabel = (k: string, short = false) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: short ? "short" : "long",
    year: short ? "2-digit" : "numeric",
  });
};
const dateLabel = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

type Wallet = { id: string; name: string; kind: "cash" | "emoney" | "bank" };
type Freq = "weekly" | "monthly";
type Recurring = { id: string; type: "in" | "out"; amount: number; category: string; note: string | null; wallet_id: string | null; frequency: Freq; next_date: string };
const KINDS = { cash: "Tunai", emoney: "E-money", bank: "Rekening" } as const;
const addPeriod = (s: string, f: Freq) => {
  const d = new Date(s + "T00:00:00");
  if (f === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const NAV = [
  { id: "beranda", label: "Beranda", icon: "home" },
  { id: "transaksi", label: "Transaksi", icon: "list" },
  { id: "dompet", label: "Dompet", icon: "wallet" },
  { id: "statistik", label: "Statistik", icon: "chart" },
  { id: "berulang", label: "Berulang", icon: "repeat" },
];

function Icon({ n }: { n: string }) {
  const p: Record<string, string> = {
    home: "M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z",
    list: "M4 6h16M4 12h16M4 18h10",
    wallet: "M3 7a2 2 0 012-2h14v4M3 7v10a2 2 0 002 2h14a1 1 0 001-1V9a1 1 0 00-1-1H5a2 2 0 01-2-2zM16 14h2",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={p[n]} />
    </svg>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(isRecovery);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  return session ? <Dashboard session={session} /> : <Login />;
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setMsg("Kata sandi minimal 6 karakter.");
    if (pw !== cf) return setMsg("Konfirmasi kata sandi tidak sama.");
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg(error.message);
    else onDone();
  }

  return (
    <main className="wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Kata sandi baru</h1>
        <p>Buat kata sandi baru untuk akunmu.</p>
        <div className="field">
          <label htmlFor="np">Kata sandi baru</label>
          <input id="np" type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nc">Konfirmasi kata sandi</label>
          <input id="nc" type="password" required autoComplete="new-password" value={cf} onChange={(e) => setCf(e.target.value)} />
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan kata sandi"}</button>
      </form>
    </main>
  );
}

function Login() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(linkExpired ? "Tautan sudah kedaluwarsa. Minta tautan baru lewat Lupa kata sandi." : "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const ident = id.trim();
    if (ident.includes("@")) {
      const { error } = await supabase.auth.signInWithPassword({ email: ident, password });
      if (error) setMsg("Email atau kata sandi salah.");
    } else {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ident, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(j.error ?? "Gagal masuk.");
      else await supabase.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
    }
    setBusy(false);
  }

  return (
    <main className="wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Rekap Keuangan</h1>
        <p>Masuk untuk melihat catatanmu.</p>
        <div className="field">
          <label htmlFor="id">Username</label>
          <input id="id" required autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">Kata sandi</label>
          <input id="pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Masuk..." : "Masuk"}</button>
        <p className="alt"><a href="/lupa">Lupa kata sandi?</a></p>
        <p className="alt" style={{ marginTop: 6 }}>Belum punya akun? <a href="/daftar">Daftar</a></p>
      </form>
    </main>
  );
}

function Dashboard({ session }: { session: Session }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>(DEFAULT_BUDGETS);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState("");
  const [repeat, setRepeat] = useState<"" | Freq>("");
  const [newWallet, setNewWallet] = useState<{ name: string; kind: Wallet["kind"] }>({ name: "", kind: "cash" });
  const ran = useRef(false);
  const [nav, setNav] = useState("beranda");
  const [more, setMore] = useState(false);
  const [username, setUsername] = useState("");

  // form
  const [type, setType] = useState<"in" | "out">("out");
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(OUT_CATS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const all: Tx[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,date,type,amount,category,note,wallet_id")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) { setError(error.message); break; }
      all.push(...(data ?? []).map((x) => ({ ...x, amount: Number(x.amount) }) as Tx));
      if (!data || data.length < 1000) break;
    }
    setTxs(all);
    const pf = await supabase.from("profiles").select("username").maybeSingle();
    if (pf.data?.username) setUsername(pf.data.username);
    const w = await supabase.from("wallets").select("id,name,kind").order("created_at");
    setWallets((w.data ?? []) as Wallet[]);
    const r = await supabase.from("recurring").select("*");
    setRecurring(((r.data ?? []) as Recurring[]).map((x) => ({ ...x, amount: Number(x.amount) })));
    const b = await supabase.from("budgets").select("category,amount,kind");
    if (b.data && b.data.length) setBudgets(b.data.map((x) => ({ ...x, amount: Number(x.amount) }) as Budget));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Buat transaksi dari jadwal berulang yang sudah jatuh tempo (sekali per kunjungan)
  useEffect(() => {
    if (ran.current || loading) return;
    ran.current = true;
    (async () => {
      const t = todayStr();
      let made = 0;
      for (const r of recurring) {
        const rows = [];
        let d = r.next_date;
        while (d <= t) {
          rows.push({ date: d, type: r.type, amount: r.amount, category: r.category, note: r.note, wallet_id: r.wallet_id });
          d = addPeriod(d, r.frequency);
        }
        if (!rows.length) continue;
        const ins = await supabase.from("transactions").insert(rows);
        if (ins.error) { setError(ins.error.message); continue; }
        await supabase.from("recurring").update({ next_date: d }).eq("id", r.id);
        made += rows.length;
      }
      if (made) load();
    })();
  }, [loading, recurring, load]);

  const months = useMemo(() => {
    const s = new Set(txs.map((t) => t.date.slice(0, 7)));
    s.add(todayStr().slice(0, 7));
    return Array.from(s).sort().reverse();
  }, [txs]);

  const saldo = useMemo(() => txs.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0), [txs]);
  const monthTxs = useMemo(() => txs.filter((t) => t.date.startsWith(month)), [txs, month]);
  const inM = monthTxs.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0);
  const outM = monthTxs.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0);

  const walletBal = useMemo(() => {
    const sum = (f: (t: Tx) => boolean) => txs.filter(f).reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
    const rows = wallets.map((w) => ({ id: w.id, name: w.name, kind: KINDS[w.kind] as string, bal: sum((t) => t.wallet_id === w.id) }));
    const none = sum((t) => !t.wallet_id);
    return none !== 0 || !rows.length ? [...rows, { id: "none", name: "Tanpa dompet", kind: "Belum dikelompokkan", bal: none }] : rows;
  }, [txs, wallets]);

  const series = useMemo(() => {
    const m = new Map<string, { bulan: string; Pemasukan: number; Pengeluaran: number }>();
    [...txs].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
      const k = t.date.slice(0, 7);
      if (!m.has(k)) m.set(k, { bulan: monthLabel(k, true), Pemasukan: 0, Pengeluaran: 0 });
      m.get(k)![t.type === "in" ? "Pemasukan" : "Pengeluaran"] += t.amount;
    });
    return Array.from(m.values());
  }, [txs]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    monthTxs.filter((t) => t.type === "out").forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount));
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTxs]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? monthTxs.filter((t) => `${t.category} ${t.note ?? ""}`.toLowerCase().includes(q))
      : monthTxs;
  }, [monthTxs, search]);

  function switchType(t: "in" | "out") {
    setType(t);
    setCategory((t === "in" ? IN_CATS : OUT_CATS)[0]);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount.replace(/\D/g, ""));
    if (!amt) { setError("Isi nominal lebih dari 0."); return; }
    setSaving(true);
    setError("");
    const row = { date, type, amount: amt, category, note, wallet_id: walletId || null };
    const { error } = editId
      ? await supabase.from("transactions").update(row).eq("id", editId)
      : await supabase.from("transactions").insert(row);
    if (error) setError(error.message);
    else {
      if (repeat && !editId) {
        const rr = await supabase.from("recurring").insert({ ...row, frequency: repeat, next_date: addPeriod(date, repeat) });
        if (rr.error) setError(rr.error.message);
      }
      resetForm();
      setMonth(date.slice(0, 7));
      await load();
    }
    setSaving(false);
  }

  function resetForm() { setAmount(""); setNote(""); setEditId(null); setRepeat(""); }

  function startEdit(t: Tx) {
    setEditId(t.id); setType(t.type); setDate(t.date); setAmount(String(t.amount));
    setCategory(t.category); setNote(t.note ?? ""); setWalletId(t.wallet_id ?? ""); setRepeat("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!newWallet.name.trim()) return;
    const { error } = await supabase.from("wallets").insert({ name: newWallet.name.trim(), kind: newWallet.kind });
    if (error) setError(error.message);
    else { setNewWallet({ ...newWallet, name: "" }); load(); }
  }

  async function stopRecurring(id: string) {
    await supabase.from("recurring").delete().eq("id", id);
    setRecurring((p) => p.filter((x) => x.id !== id));
  }

  function exportCsv() {
    const wname = (id: string | null) => wallets.find((w) => w.id === id)?.name ?? "";
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      "Tanggal;Jenis;Nominal;Kategori;Dompet;Catatan",
      ...[...txs].reverse().map((t) =>
        [t.date, t.type === "in" ? "Pemasukan" : "Pengeluaran", t.amount, t.category, wname(t.wallet_id), t.note ?? ""].map(esc).join(";")),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `rekap-keuangan-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function remove(t: Tx) {
    if (!window.confirm(`Hapus ${t.category} ${rp(t.amount)}?`)) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) setError(error.message);
    else setTxs((p) => p.filter((x) => x.id !== t.id));
  }

  async function editBudget(b: Budget) {
    const v = window.prompt(`${b.kind === "limit" ? "Batas" : "Target"} ${b.category} per bulan (Rp):`, String(b.amount));
    if (v === null) return;
    const amt = Number(v.replace(/\D/g, ""));
    const { error } = await supabase
      .from("budgets")
      .upsert({ user_id: session.user.id, category: b.category, amount: amt, kind: b.kind }, { onConflict: "user_id,category" });
    if (error) setError(error.message);
    else load();
    setBudgets((p) => p.map((x) => (x.category === b.category ? { ...x, amount: amt } : x)));
  }

  const uname = username || (session.user.email ?? "").split("@")[0];
  const h = new Date().getHours();
  const sapa = h < 11 ? "pagi" : h < 15 ? "siang" : h < 18 ? "sore" : "malam";
  const topCat = byCat[0];
  const totalOut = byCat.reduce((a, c) => a + c.value, 0);
  const topPct = topCat && totalOut ? Math.round((topCat.value / totalOut) * 100) : 0;
  const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;

  return (
    <div className="shell">
      <aside className="side">
        <div className="profile">
          <div className="avatar" aria-hidden="true">{(uname[0] ?? "?").toUpperCase()}</div>
          <b>{uname}</b>
        </div>
        <nav className="navlist" aria-label="Menu utama">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} aria-current={nav === n.id} onClick={() => setNav(n.id)}>
              <Icon n={n.icon} /><span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-actions">
          <button className="btn ghost" onClick={exportCsv}>Ekspor CSV</button>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
      </aside>

      <main className="main" id="beranda">
        <header className="hdr">
          <div>
            <h1>Halo, {uname}</h1>
            <p>Selamat {sapa}</p>
          </div>
          <div className="hdr-tools">
            <label className="searchbox">
              <span className="sr">Cari transaksi</span>
              <input placeholder="Cari kategori atau catatan" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Icon n="search" />
            </label>
            <select className="pick" aria-label="Pilih bulan" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <div className="only-mobile">
              <button className="btn ghost" onClick={exportCsv}>Ekspor CSV</button>
              <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Keluar</button>
            </div>
          </div>
        </header>

        {error && <p className="err" role="alert">{error}</p>}

        <div className="cols">
          <div className="col">
<section className="card" id="dompet">
          <h2>Dompet</h2>
          <div className="pcard">
            <small>Saldo saat ini</small>
            <div className="big">{rp(saldo)}</div>
            <div className="row"><span>{uname}</span><span>{monthLabel(month, true)}</span></div>
          </div>
          {walletBal.map((w) => (
            <div className="tx" key={w.id}>
              <div><div className="cat">{w.name}</div><div className="meta">{w.kind}</div></div>
              <div className="amt">{rp(w.bal)}</div>
            </div>
          ))}
          <details className="adder"><summary>Tambah dompet</summary>
          <form onSubmit={addWallet} style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <div className="row2">
              <input className="month" aria-label="Nama dompet" placeholder="mis. GoPay, BCA" value={newWallet.name} onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })} />
              <select className="month" aria-label="Jenis dompet" value={newWallet.kind} onChange={(e) => setNewWallet({ ...newWallet, kind: e.target.value as Wallet["kind"] })}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button className="btn ghost" style={{ width: "100%" }}>Tambah dompet</button>
          </form></details>
        </section>
<section className="card">
          <h2>{editId ? "Ubah transaksi" : "Catat transaksi"}</h2>
          <form onSubmit={add}>
            <div className="seg" role="group" aria-label="Jenis transaksi">
              <button type="button" className="out" aria-pressed={type === "out"} onClick={() => switchType("out")}>Pengeluaran</button>
              <button type="button" className="in" aria-pressed={type === "in"} onClick={() => switchType("in")}>Pemasukan</button>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="amt">Nominal (Rp)</label>
                <input id="amt" inputMode="numeric" placeholder="15000" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="date">Tanggal</label>
                <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="cat">Kategori</label>
              <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {(type === "in" ? IN_CATS : OUT_CATS).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="note">Catatan</label>
              <input id="note" placeholder="mis. bensin, maksi" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="wal">Dompet</label>
                <select id="wal" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                  <option value="">Tanpa dompet</option>
                  {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              {!editId && (
                <div className="field">
                  <label htmlFor="rep">Ulangi</label>
                  <select id="rep" value={repeat} onChange={(e) => setRepeat(e.target.value as "" | Freq)}>
                    <option value="">Tidak</option>
                    <option value="weekly">Tiap minggu</option>
                    <option value="monthly">Tiap bulan</option>
                  </select>
                </div>
              )}
            </div>
            <button className="btn" disabled={saving}>{saving ? "Menyimpan..." : editId ? "Simpan perubahan" : "Simpan transaksi"}</button>
            {editId && <button type="button" className="btn ghost" style={{ marginTop: 8, width: "100%" }} onClick={resetForm}>Batal</button>}
          </form>
        </section>
<section className="card" id="transaksi">
          <h2>Transaksi <small>{monthLabel(month)}</small></h2>
          {loading ? (
            <p className="empty">Memuat...</p>
          ) : shown.length === 0 ? (
            <p className="empty">Belum ada transaksi. Catat yang pertama lewat formulir di atas.</p>
          ) : (
            shown.slice(0, more ? 500 : 8).map((t) => (
              <div className="tx" key={t.id}>
                <div>
                  <div className="cat">{t.category}{t.note ? ` · ${t.note}` : ""}</div>
                  <div className="meta">{dateLabel(t.date)}{t.wallet_id ? ` · ${wallets.find((w) => w.id === t.wallet_id)?.name ?? ""}` : ""}</div>
                </div>
                <div className={`amt ${t.type}`}>{t.type === "in" ? "+" : "-"}{rp(t.amount)}</div>
                <span style={{ justifySelf: "end", display: "flex", gap: 12 }}>
                  <button className="del" onClick={() => startEdit(t)}>Ubah</button>
                  <button className="del" onClick={() => remove(t)}>Hapus</button>
                </span>
              </div>
            ))
          )}
        {shown.length > 8 && <button className="btn ghost" style={{ width: "100%" }} onClick={() => setMore(!more)}>{more ? "Tampilkan lebih sedikit" : `Lihat semua (${shown.length})`}</button>}
        </section>
          </div>

          <div className="col">
            <section className="card">
              <h2>Ringkasan <small>{monthLabel(month)}</small></h2>
              <div className="pair">
                <div><small>Pemasukan</small><b className="in">{rp(inM)}</b></div>
                <div><small>Pengeluaran</small><b className="out">{rp(outM)}</b></div>
              </div>
              <p className="note">
                <strong>CATATAN</strong><br />
                {topCat ? `Pengeluaran terbesar bulan ini ada di ${topCat.name} (${rp(topCat.value)}, ${topPct}%).` : "Belum ada pengeluaran di bulan ini."}
                {outM > inM && inM > 0 ? " Pengeluaran sudah melebihi pemasukan." : ""}
              </p>
            </section>

            <section className="card" id="statistik">
              <h2>Kategori <small>Pengeluaran {monthLabel(month)}</small></h2>
              {byCat.length === 0 ? (
                <p className="empty">Belum ada pengeluaran di bulan ini.</p>
              ) : (
                <>
                  <div className="donut">
                    <div className="donut-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={byCat} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="94%" paddingAngle={2} stroke="none" cornerRadius={6}>
                            {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => rp(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-mid"><b>{topPct}%</b><small>{topCat?.name}</small></div>
                    </div>
                    <div className="legend">
                      {byCat.map((c, i) => <span key={c.name}><i style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span>)}
                    </div>
                  </div>
                  <div className="topcat">
                    <small>{topCat?.name}</small>
                    <b>{rp(topCat?.value ?? 0)}</b>
                    <small>Total pengeluaran {rp(totalOut)}</small>
                  </div>
                </>
              )}
            </section>

            <section className="card">
              <h2>Anggaran <small>{monthLabel(month)}</small></h2>
              <div>
            {budgets.map((b) => {
              const used = monthTxs.filter((t) => t.type === "out" && t.category === b.category).reduce((a, t) => a + t.amount, 0);
              const pct = b.amount ? Math.min(100, (used / b.amount) * 100) : 0;
              const isLimit = b.kind === "limit";
              const cls = isLimit ? (used > b.amount ? "over" : "") : used >= b.amount ? "done" : "";
              const text = isLimit
                ? used > b.amount ? `Lewat ${rp(used - b.amount)} dari batas.` : `Sisa ${rp(b.amount - used)}.`
                : used >= b.amount ? "Target bulan ini tercapai." : `Kurang ${rp(b.amount - used)} lagi.`;
              return (
                <div className="budget" key={b.category}>
                  <div className="head">
                    <strong>{b.category}</strong>
                    <span>{rp(used)} / {rp(b.amount)} <button className="linkbtn" onClick={() => editBudget(b)}>ubah</button></span>
                  </div>
                  <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${isLimit ? "Batas" : "Target"} ${b.category}`}>
                    <i className={cls} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="msg">{text}</div>
                </div>
              );
            })}
          </div>
        
            </section>

<section className="card" id="berulang">
          <h2>Transaksi berulang</h2>
          {recurring.length === 0 ? (
            <p className="empty">Belum ada. Pilih &quot;Ulangi&quot; saat mencatat transaksi.</p>
          ) : (
            recurring.map((r) => (
              <div className="tx" key={r.id}>
                <div>
                  <div className="cat">{r.category}{r.note ? ` · ${r.note}` : ""}</div>
                  <div className="meta">{r.frequency === "weekly" ? "Tiap minggu" : "Tiap bulan"} · berikutnya {dateLabel(r.next_date)}</div>
                </div>
                <div className={`amt ${r.type}`}>{r.type === "in" ? "+" : "-"}{rp(r.amount)}</div>
                <button className="del" onClick={() => stopRecurring(r.id)}>Hentikan</button>
              </div>
            ))
          )}
        </section>
          </div>

          <div className="col">
            <section className="card">
              <h2>Arus kas <small>Pemasukan dan pengeluaran per bulan</small></h2>
              <div className="legend row">
                <span><i style={{ background: "var(--in)" }} />Pemasukan</span>
                <span><i style={{ background: "var(--out)" }} />Pengeluaran</span>
              </div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid vertical={false} stroke="#ece7da" />
                    <XAxis dataKey="bulan" {...axis} />
                    <YAxis {...axis} width={44} tickFormatter={(v: number) => `${Math.round(v / 1000)}rb`} />
                    <Tooltip formatter={(v: number) => rp(v)} />
                    <Line type="monotone" dataKey="Pemasukan" stroke="#12b886" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Pengeluaran" stroke="#ee4a74" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2>Analisis pengeluaran <small>Total per bulan</small></h2>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={series}>
                    <CartesianGrid vertical={false} stroke="#ece7da" />
                    <XAxis dataKey="bulan" {...axis} />
                    <YAxis {...axis} width={44} tickFormatter={(v: number) => `${Math.round(v / 1000)}rb`} />
                    <Tooltip formatter={(v: number) => rp(v)} />
                    <Bar dataKey="Pengeluaran" fill="#8e92f0" radius={[8, 8, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
