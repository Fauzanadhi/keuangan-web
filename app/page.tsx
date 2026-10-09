"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isRecovery, linkExpired, supabase } from "@/lib/supabase";

type Tx = { id: string; date: string; type: "in" | "out" | "transfer"; amount: number; category: string; note: string | null; wallet_id: string | null; wallet_to_id: string | null };
type Budget = { category: string; amount: number; kind: "limit" | "target"; month: number; year: number };
type Wish = { id: string; name: string; target_amount: number };

const IN_CATS = ["Deposit", "Gaji", "Lainnya"];
const DEFAULT_OUT_CATS = ["Jajan", "Jalan", "Kebutuhan", "Tanggungan", "Infaq", "Tabungan", "Investasi", "Lainnya"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const COLORS = ["#2dd4a7", "#f59bb0", "#4a7bd8", "#9c98f2", "#fdbe2d", "#e03e6b", "#8a8fa8"];

const rp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const rupiahInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("id-ID").format(Number(digits)) : "";
};
const parseRupiah = (value: string) => Number(value.replace(/\D/g, ""));
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
const budgetRange = (month: number, year: number) => ({
  from: `${year}-${pad(month)}-01`,
  to: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
});

type Wallet = { id: string; name: string; kind: "cash" | "emoney" | "bank" | "investment"; archived_at: string | null };
const KINDS = { cash: "Tunai", emoney: "E-money", bank: "Rekening", investment: "Investasi" } as const;

const NAV_GROUPS = [
  { label: "Utama", items: [
    { id: "beranda", label: "Beranda", icon: "home" },
  ] },
  { label: "", items: [
    { id: "kelola-uang", label: "Kelola Uang", icon: "wallet" },
  ] },
  { label: "Laporan", items: [
    { id: "statistik", label: "Statistik", icon: "chart" },
  ] },
  { label: "Akun", items: [
    { id: "pengaturan", label: "Pengaturan", icon: "settings" },
    { id: "keluar", label: "Keluar", icon: "logout", action: "logout" },
  ] },
];

function Icon({ n }: { n: string }) {
  const p: Record<string, string> = {
    home: "M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z",
    list: "M4 6h16M4 12h16M4 18h10",
    wallet: "M3 7a2 2 0 012-2h14v4M3 7v10a2 2 0 002 2h14a1 1 0 001-1V9a1 1 0 00-1-1H5a2 2 0 01-2-2zM16 14h2",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
    budget: "M12 3v18M17 7H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 00-1.8.2l-.1.1h-3.4l-.1-.2a1.7 1.7 0 00-1.5-1.1h-.2l-2.9-1.7.1-.2a1.7 1.7 0 00-.2-1.8l-.1-.1v-3.4l.2-.1a1.7 1.7 0 001.1-1.5v-.2l1.7-2.9.2.1a1.7 1.7 0 001.8-.2l.1-.1h3.4l.1.2a1.7 1.7 0 001.5 1.1h.2l2.9 1.7-.1.2a1.7 1.7 0 00.2 1.8l.1.1v3.4z",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    menu: "M4 6h16M4 12h16M4 18h16",
    wishlist: "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 00-.1-7.8z",
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_OUT_CATS);
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState("");
  const [walletToId, setWalletToId] = useState("");
  const [newWallet, setNewWallet] = useState<{ name: string; kind: Wallet["kind"] }>({ name: "", kind: "cash" });
  const [nav, setNav] = useState("beranda");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [more, setMore] = useState(false);
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState(DEFAULT_OUT_CATS[0]);
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetEditing, setBudgetEditing] = useState<Budget | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [budgetFilter, setBudgetFilter] = useState("all");
  const [viewBudgetMonth, setViewBudgetMonth] = useState(new Date().getMonth() + 1);
  const [viewBudgetYear, setViewBudgetYear] = useState(new Date().getFullYear());
  const [wishFormOpen, setWishFormOpen] = useState(false);
  const [wishEditing, setWishEditing] = useState<Wish | null>(null);
  const [wishName, setWishName] = useState("");
  const [wishAmount, setWishAmount] = useState("");
  const [savingWish, setSavingWish] = useState(false);

  // form
  const [type, setType] = useState<"in" | "out" | "transfer">("out");
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_OUT_CATS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const all: Tx[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,date,type,amount,category,note,wallet_id,wallet_to_id")
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
    const w = await supabase.from("wallets").select("id,name,kind,archived_at").order("created_at");
    if (w.error) setError(w.error.message);
    setWallets((w.data ?? []) as Wallet[]);
    const cats = await supabase.from("expense_categories").select("category").order("category");
    if (cats.error) setError(cats.error.message);
    else if (!cats.data?.length) {
      const { error: seedError } = await supabase.from("expense_categories").insert(
        DEFAULT_OUT_CATS.map((category) => ({ user_id: session.user.id, category })),
      );
      if (seedError) setError(seedError.message);
      else setExpenseCategories(DEFAULT_OUT_CATS);
    } else {
      setExpenseCategories(cats.data.map((item) => item.category));
    }
    const b = await supabase.from("category_budgets").select("category,amount,kind,month,year");
    if (b.error) setError(b.error.message);
    else setBudgets((b.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) }) as Budget));
    const wish = await supabase.from("wish_list").select("id,name,target_amount").order("created_at", { ascending: false });
    if (wish.error) setError(wish.error.message);
    else setWishes((wish.data ?? []).map((x) => ({ ...x, target_amount: Number(x.target_amount) })) as Wish[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const s = new Set(txs.map((t) => t.date.slice(0, 7)));
    s.add(todayStr().slice(0, 7));
    return Array.from(s).sort().reverse();
  }, [txs]);

  const investmentWalletIds = useMemo(
    () => new Set(wallets.filter((wallet) => wallet.kind === "investment").map((wallet) => wallet.id)),
    [wallets],
  );
  const transferMovesIntoInvestment = (sourceWalletId: string | null, targetWalletId: string | null) =>
    !!targetWalletId && investmentWalletIds.has(targetWalletId) &&
    !(sourceWalletId && investmentWalletIds.has(sourceWalletId));
  const transferMovesFromInvestment = (sourceWalletId: string | null, targetWalletId: string | null) =>
    !!sourceWalletId && investmentWalletIds.has(sourceWalletId) &&
    !(targetWalletId && investmentWalletIds.has(targetWalletId));
  const isTransferToInvestment = (transaction: Tx) =>
    transaction.type === "transfer" && transferMovesIntoInvestment(transaction.wallet_id, transaction.wallet_to_id);
  const isTransferFromInvestment = (transaction: Tx) =>
    transaction.type === "transfer" && transferMovesFromInvestment(transaction.wallet_id, transaction.wallet_to_id);
  const transactionExpenseCategories = expenseCategories.filter((item) => item.toLowerCase() !== "investasi");
  const expenseForCategoryInRange = (expenseCategory: string, from: string, to: string) =>
    txs.filter((transaction) =>
      transaction.date >= from && transaction.date <= to &&
      ((expenseCategory !== "Investasi" && transaction.type === "out" && transaction.category === expenseCategory) ||
        (expenseCategory === "Investasi" && isTransferToInvestment(transaction))),
    ).reduce((total, transaction) => total + transaction.amount, 0);
  const monthTxs = useMemo(() => txs.filter((t) => t.date.startsWith(month)), [txs, month]);
  const inM = monthTxs.filter((t) => t.type === "in" || isTransferFromInvestment(t)).reduce((a, t) => a + t.amount, 0);
  const outM = monthTxs.filter((t) => t.type === "out" || isTransferToInvestment(t)).reduce((a, t) => a + t.amount, 0);

  const walletBal = useMemo(() => {
    const sum = (walletId: string) => txs.reduce((balance, t) => {
      if (t.type === "transfer") {
        if (t.wallet_id === walletId) return balance - t.amount;
        if (t.wallet_to_id === walletId) return balance + t.amount;
        return balance;
      }
      if (t.wallet_id !== walletId) return balance;
      return balance + (t.type === "in" ? t.amount : -t.amount);
    }, 0);
    const rows = wallets.map((w) => ({ id: w.id, name: w.name, kind: KINDS[w.kind] as string, investment: w.kind === "investment", archived: !!w.archived_at, bal: sum(w.id) }));
    const none = txs.filter((t) => t.type !== "transfer" && !t.wallet_id).reduce((balance, t) => balance + (t.type === "in" ? t.amount : -t.amount), 0);
    return none !== 0 || !rows.length ? [...rows, { id: "none", name: "Tanpa dompet", kind: "Belum dikelompokkan", investment: false, archived: false, bal: none }] : rows;
  }, [txs, wallets]);
  const activeWalletBalances = walletBal.filter((w) => !w.archived);
  const archivedWalletBalances = walletBal.filter((w) => w.archived);
  const investmentWalletBalances = activeWalletBalances.filter((w) => w.investment);
  const regularWalletBalances = activeWalletBalances.filter((w) => !w.investment);
  const archivedInvestmentBalances = archivedWalletBalances.filter((w) => w.investment);
  const archivedRegularBalances = archivedWalletBalances.filter((w) => !w.investment);
  const regularWalletEntries = regularWalletBalances.filter((w) => w.id !== "none");
  const investmentWalletEntries = investmentWalletBalances.filter((w) => w.id !== "none");
  const unassignedWalletBalance = walletBal.find((w) => w.id === "none")?.bal ?? 0;
  const investmentBalance = investmentWalletBalances.reduce((sum, w) => sum + w.bal, 0);
  const saldo = regularWalletBalances.reduce((sum, w) => sum + w.bal, 0);

  const series = useMemo(() => {
    const m = new Map<string, { bulan: string; Pemasukan: number; Pengeluaran: number }>();
    [...txs].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
      const k = t.date.slice(0, 7);
      if (!m.has(k)) m.set(k, { bulan: monthLabel(k, true), Pemasukan: 0, Pengeluaran: 0 });
      if (t.type === "in" || isTransferFromInvestment(t)) m.get(k)!.Pemasukan += t.amount;
      if (t.type === "out" || isTransferToInvestment(t)) m.get(k)!.Pengeluaran += t.amount;
    });
    return Array.from(m.values());
  }, [txs, investmentWalletIds]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    monthTxs.filter((t) => (t.type === "out" && t.category.toLowerCase() !== "investasi") || isTransferToInvestment(t)).forEach((t) => {
      const expenseCategory = isTransferToInvestment(t) ? "Investasi" : t.category;
      m.set(expenseCategory, (m.get(expenseCategory) ?? 0) + t.amount);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTxs, investmentWalletIds]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? monthTxs.filter((t) => `${t.category} ${t.note ?? ""}`.toLowerCase().includes(q))
      : monthTxs;
  }, [monthTxs, search]);

  function switchType(t: "in" | "out" | "transfer") {
    setType(t);
    setCategory(t === "transfer" ? "Pindah Dana" : (t === "in" ? IN_CATS : transactionExpenseCategories)[0] ?? "");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseRupiah(amount);
    if (!amt) { setError("Isi nominal lebih dari 0."); return; }
    if (type === "transfer" && (!walletId || !walletToId || walletId === walletToId)) {
      setError("Pilih dompet asal dan tujuan yang berbeda.");
      return;
    }
    setSaving(true);
    setError("");
    const transferToInvestment = type === "transfer" && transferMovesIntoInvestment(walletId, walletToId);
    const row = { date, type, amount: amt, category: type === "transfer" ? transferToInvestment ? "Investasi" : "Pindah Dana" : category, note, wallet_id: walletId || null, wallet_to_id: type === "transfer" ? walletToId : null };
    const { error } = editId
      ? await supabase.from("transactions").update(row).eq("id", editId)
      : await supabase.from("transactions").insert(row);
    if (error) setError(error.message);
    else {
      resetForm();
      setMonth(date.slice(0, 7));
      await load();
    }
    setSaving(false);
  }

  function resetForm() { setAmount(""); setNote(""); setEditId(null); setWalletId(""); setWalletToId(""); setType("out"); setCategory(transactionExpenseCategories[0] ?? ""); }

  function startEdit(t: Tx) {
    setEditId(t.id); setType(t.type); setDate(t.date); setAmount(rupiahInput(String(t.amount)));
    setCategory(t.category); setNote(t.note ?? ""); setWalletId(t.wallet_id ?? "");
    setWalletToId(t.wallet_to_id ?? "");
    setNav("catat-transaksi");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!newWallet.name.trim()) {
      setError("Isi nama dompet.");
      return;
    }
    const { error } = await supabase.from("wallets").insert({ name: newWallet.name.trim(), kind: newWallet.kind });
    if (error) setError(error.message);
    else { setNewWallet({ ...newWallet, name: "" }); load(); }
  }

  async function addExpenseCategory(e: React.FormEvent) {
    e.preventDefault();
    const value = newExpenseCategory.trim();
    if (!value) return;
    if (expenseCategories.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setError("Kategori tersebut sudah ada.");
      return;
    }
    const { error } = await supabase.from("expense_categories").insert({ user_id: session.user.id, category: value });
    if (error) setError(error.message);
    else {
      setExpenseCategories((items) => [...items, value].sort((a, b) => a.localeCompare(b, "id")));
      setNewExpenseCategory("");
      setError("");
    }
  }

  async function removeExpenseCategory(value: string) {
    if (value.toLowerCase() === "investasi") {
      setError("Kategori Investasi diperlukan untuk otomatis mencatat Pindah Dana ke dompet investasi.");
      return;
    }
    if (expenseCategories.length <= 1) {
      setError("Minimal harus ada satu kategori pengeluaran.");
      return;
    }
    if (!window.confirm(`Hapus kategori "${value}" dari pilihan? Riwayat transaksi dan anggaran lama tetap disimpan.`)) return;
    const { error } = await supabase.from("expense_categories").delete().eq("category", value);
    if (error) setError(error.message);
    else {
      const next = expenseCategories.filter((item) => item !== value);
      setExpenseCategories(next);
      if (category === value) setCategory(next[0]);
      if (budgetCategory === value) setBudgetCategory(next[0]);
      if (budgetFilter === value) setBudgetFilter("all");
    }
  }

  async function archiveWallet(wallet: Wallet) {
    if (!window.confirm(`Hapus dompet "${wallet.name}" dari daftar aktif? Riwayat dan saldonya tetap tersimpan, dan transaksi lama akan menandai dompet ini sebagai dihapus.`)) return;
    const { error } = await supabase.from("wallets").update({ archived_at: new Date().toISOString() }).eq("id", wallet.id);
    if (error) setError(error.message);
    else await load();
  }

  async function restoreWallet(wallet: Wallet) {
    const { error } = await supabase.from("wallets").update({ archived_at: null }).eq("id", wallet.id);
    if (error) setError(error.message);
    else await load();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage("Kata sandi minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setChangingPassword(true);
    setPasswordMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) setPasswordMessage(error.message);
    else {
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Kata sandi berhasil diubah.");
    }
  }

  async function remove(t: Tx) {
    if (!window.confirm(`Hapus ${t.category} ${rp(t.amount)}?`)) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) setError(error.message);
    else setTxs((p) => p.filter((x) => x.id !== t.id));
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseRupiah(budgetAmount);
    if (!amount) {
      setError("Isi batas anggaran lebih dari 0.");
      return;
    }
    setSavingBudget(true);
    setError("");
    const { error } = await supabase
      .from("category_budgets")
      .upsert(
        { user_id: session.user.id, category: budgetCategory, amount, kind: budgetEditing?.kind ?? "limit", month: budgetMonth, year: budgetYear },
        { onConflict: "user_id,category,month,year" },
      );
    if (error) setError(error.message);
    else {
      setBudgetFilter(budgetCategory);
      setViewBudgetMonth(budgetMonth);
      setViewBudgetYear(budgetYear);
      cancelBudgetEdit();
      setBudgetFormOpen(false);
      await load();
    }
    setSavingBudget(false);
  }

  function startEditBudget(budget: Budget) {
    setBudgetEditing(budget);
    setBudgetCategory(budget.category);
    setBudgetMonth(budget.month);
    setBudgetYear(budget.year);
    setBudgetAmount(rupiahInput(String(budget.amount)));
  }

  function cancelBudgetEdit() {
    setBudgetEditing(null);
    setBudgetAmount("");
    setBudgetCategory(expenseCategories[0] ?? "");
    setBudgetMonth(new Date().getMonth() + 1);
    setBudgetYear(new Date().getFullYear());
  }

  function openNewBudget() {
    cancelBudgetEdit();
    setBudgetFormOpen(true);
  }

  async function removeBudget(budget: Budget) {
    if (!window.confirm(`Hapus anggaran ${budget.category} ${MONTH_NAMES[budget.month - 1]} ${budget.year}?`)) return;
    const { error } = await supabase
      .from("category_budgets")
      .delete()
      .eq("category", budget.category)
      .eq("month", budget.month)
      .eq("year", budget.year);
    if (error) setError(error.message);
    else await load();
  }

  async function saveWish(e: React.FormEvent) {
    e.preventDefault();
    const target = parseRupiah(wishAmount);
    if (!wishName.trim() || !target) {
      setError("Isi nama barang dan harga target lebih dari 0.");
      return;
    }
    setSavingWish(true);
    setError("");
    const query = wishEditing
      ? supabase.from("wish_list").update({ name: wishName.trim(), target_amount: target }).eq("id", wishEditing.id)
      : supabase.from("wish_list").insert({ user_id: session.user.id, name: wishName.trim(), target_amount: target });
    const { error } = await query;
    if (error) setError(error.message);
    else {
      setWishFormOpen(false);
      setWishEditing(null);
      setWishName("");
      setWishAmount("");
      await load();
    }
    setSavingWish(false);
  }

  function editWish(wish: Wish) {
    setWishEditing(wish);
    setWishName(wish.name);
    setWishAmount(rupiahInput(String(wish.target_amount)));
    setWishFormOpen(true);
  }

  async function removeWish(wish: Wish) {
    if (!window.confirm(`Hapus "${wish.name}" dari Wish List?`)) return;
    const { error } = await supabase.from("wish_list").delete().eq("id", wish.id);
    if (error) setError(error.message);
    else setWishes((items) => items.filter((item) => item.id !== wish.id));
  }

  const uname = username || (session.user.email ?? "").split("@")[0];
  const h = new Date().getHours();
  const sapa = h < 11 ? "pagi" : h < 15 ? "siang" : h < 18 ? "sore" : "malam";
  const topCat = byCat[0];
  const totalOut = byCat.reduce((a, c) => a + c.value, 0);
  const topPct = topCat && totalOut ? Math.round((topCat.value / totalOut) * 100) : 0;
  const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;
  const budgetOverview = budgets.filter((b) => b.month === Number(month.slice(5)) && b.year === Number(month.slice(0, 4))).map((b) => {
    const range = budgetRange(b.month, b.year);
    const used = expenseForCategoryInRange(b.category, range.from, range.to);
    return { ...b, ...range, used, pct: b.amount ? Math.min(100, (used / b.amount) * 100) : 0 };
  });
  const visibleBudgets = budgets
    .filter((b) => b.month === viewBudgetMonth && b.year === viewBudgetYear && (budgetFilter === "all" || b.category === budgetFilter))
    .map((b) => {
      const range = budgetRange(b.month, b.year);
      const used = expenseForCategoryInRange(b.category, range.from, range.to);
      return { ...b, ...range, used, pct: b.amount ? Math.min(100, (used / b.amount) * 100) : 0 };
    });
  const budgetDateRange = budgetRange(viewBudgetMonth, viewBudgetYear);
  const chartTransactions = txs.filter((t) =>
    ((t.type === "out" && t.category.toLowerCase() !== "investasi") || isTransferToInvestment(t)) &&
    t.date >= budgetDateRange.from && t.date <= budgetDateRange.to &&
    (budgetFilter === "all" || (isTransferToInvestment(t) ? "Investasi" : t.category) === budgetFilter),
  );
  const chartBudgets = budgets.filter((budget) => budget.month === viewBudgetMonth && budget.year === viewBudgetYear && (budgetFilter === "all" || budget.category === budgetFilter));
  const budgetByCategory = chartBudgets.reduce(
    (totals, budget) => totals.set(budget.category, (totals.get(budget.category) ?? 0) + budget.amount),
    new Map<string, number>(),
  );
  const spentByCategory = chartTransactions.reduce(
    (totals, transaction) => {
      const expenseCategory = isTransferToInvestment(transaction) ? "Investasi" : transaction.category;
      return totals.set(expenseCategory, (totals.get(expenseCategory) ?? 0) + transaction.amount);
    },
    new Map<string, number>(),
  );
  const budgetChart = Array.from(new Set([...budgetByCategory.keys(), ...spentByCategory.keys()]))
    .map((name) => ({ name, budget: budgetByCategory.get(name) ?? 0, spent: spentByCategory.get(name) ?? 0 }))
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);
  const budgetChartBudgetTotal = budgetChart.reduce((sum, item) => sum + item.budget, 0);
  const budgetChartSpentTotal = budgetChart.reduce((sum, item) => sum + item.spent, 0);
  const selectedBudgetCategory = type === "out" ? category : type === "transfer" && transferMovesIntoInvestment(walletId, walletToId) ? "Investasi" : undefined;
  const selectedCategoryBudget = selectedBudgetCategory
    ? budgets.find((b) => b.category === selectedBudgetCategory && b.month === Number(date.slice(5, 7)) && b.year === Number(date.slice(0, 4)))
    : undefined;
  const selectedCategorySpent = selectedCategoryBudget
    ? expenseForCategoryInRange(selectedBudgetCategory ?? selectedCategoryBudget.category, budgetRange(selectedCategoryBudget.month, selectedCategoryBudget.year).from, budgetRange(selectedCategoryBudget.month, selectedCategoryBudget.year).to)
    : 0;
  const selectedCategoryPct = selectedCategoryBudget ? Math.min(100, (selectedCategorySpent / selectedCategoryBudget.amount) * 100) : 0;
  const miniSeries = series.slice(-6);
  const balanceSummary = (
    <>
      <section className="card balance-group">
        <h2>Saldo saat ini</h2>
        <div className="pcard">
          <small>Total saldo dompet</small>
          <div className="big">{rp(saldo)}</div>
          <div className="row"><span>{uname}</span><span>{monthLabel(month, true)}</span></div>
        </div>
        <h3>Dompet</h3>
        {regularWalletEntries.length ? regularWalletEntries.map((w) => (
          <div className="wallet-entry" key={w.id}>
            <div><strong>{w.name}</strong><small>{w.kind}{w.archived ? " · Dompet dihapus" : ""}</small></div>
            <b>{rp(w.bal)}</b>
          </div>
        )) : <p className="empty">Belum ada dompet aktif.</p>}
        {unassignedWalletBalance !== 0 && <div className="wallet-entry"><div><strong>Tanpa dompet</strong><small>Transaksi yang belum dipasangkan ke dompet</small></div><b>{rp(unassignedWalletBalance)}</b></div>}
        {!!archivedRegularBalances.length && <>
          <h3 className="archived-wallet-title">Dompet dihapus</h3>
          {archivedRegularBalances.map((w) => <div className="wallet-entry archived-wallet-entry" key={w.id}><div><strong>{w.name}</strong><small>Riwayat dipertahankan</small></div><b>{rp(w.bal)}</b></div>)}
        </>}
      </section>
      <section className="card balance-group">
        <h2>Saldo Investasi</h2>
        <div className="investment-total investment-total-large">
          <span>Total saldo investasi</span>
          <strong>{rp(investmentBalance)}</strong>
          <small>Terpisah dari saldo dompet yang siap digunakan</small>
        </div>
        <h3>Investasi</h3>
        {investmentWalletEntries.length ? investmentWalletEntries.map((w) => (
          <div className="wallet-entry" key={w.id}><div><strong>{w.name}</strong><small>{w.kind}</small></div><b>{rp(w.bal)}</b></div>
        )) : <p className="empty">Belum ada dompet investasi aktif.</p>}
        {!!archivedInvestmentBalances.length && <>
          <h3 className="archived-wallet-title">Investasi dihapus</h3>
          {archivedInvestmentBalances.map((w) => <div className="wallet-entry archived-wallet-entry" key={w.id}><div><strong>{w.name}</strong><small>Riwayat dipertahankan</small></div><b>{rp(w.bal)}</b></div>)}
        </>}
      </section>
    </>
  );
  const transactionEntry = (
    <section className="card transaction-form-card">
      <h2 id="form-transaksi">{editId ? "Ubah transaksi" : "Catat transaksi"}</h2>
      <form onSubmit={add}>
        <div className="seg" role="group" aria-label="Jenis transaksi">
          <button type="button" className="out" aria-pressed={type === "out"} onClick={() => switchType("out")}>Pengeluaran</button>
          <button type="button" className="in" aria-pressed={type === "in"} onClick={() => switchType("in")}>Pemasukan</button>
          <button type="button" className="transfer" aria-pressed={type === "transfer"} onClick={() => switchType("transfer")}>Pindah dana</button>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="amt">Nominal (Rp)</label>
            <input id="amt" inputMode="numeric" placeholder="15.000" value={amount} onChange={(e) => setAmount(rupiahInput(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="date">Tanggal</label>
            <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {type !== "transfer" && <div className="field">
          <label htmlFor="cat">Kategori</label>
          <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {type === "out" && editId && !transactionExpenseCategories.includes(category) && <option value={category}>{category}</option>}
            {(type === "in" ? IN_CATS : transactionExpenseCategories).map((c) => <option key={c}>{c}</option>)}
          </select>
          {type === "out" && selectedCategoryBudget && (
            <div className="category-budget-hint">
              <div className="bar" role="progressbar" aria-valuenow={Math.round(selectedCategoryPct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Anggaran ${category}`}>
                <i className={selectedCategorySpent > selectedCategoryBudget.amount ? "over" : ""} style={{ width: `${selectedCategoryPct}%` }} />
              </div>
              <small>Sisa anggaran {MONTH_NAMES[selectedCategoryBudget.month - 1]}: {rp(Math.max(0, selectedCategoryBudget.amount - selectedCategorySpent))} dari {rp(selectedCategoryBudget.amount)}</small>
            </div>
          )}
          {type === "out" && !selectedCategoryBudget && <small className="category-budget-empty">Belum ada anggaran untuk kategori ini pada bulan transaksi.</small>}
        </div>}
        <div className="field">
          <label htmlFor="note">Catatan</label>
          <input id="note" placeholder="mis. bensin, maksi" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="wal">{type === "transfer" ? "Dompet asal" : "Dompet"}</label>
          <select id="wal" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {type === "transfer" ? <option value="">Pilih dompet asal</option> : <option value="">Tanpa dompet</option>}
            {wallets.filter((w) => !w.archived_at || w.id === walletId).map((w) => <option key={w.id} value={w.id}>{w.name}{w.archived_at ? " (Dompet dihapus)" : ""}</option>)}
          </select>
        </div>
        {type === "transfer" && <div className="field">
          <label htmlFor="wal-to">Dompet tujuan</label>
          <select id="wal-to" value={walletToId} onChange={(e) => setWalletToId(e.target.value)}>
            <option value="">Pilih dompet tujuan</option>
            {wallets.filter((w) => w.id !== walletId && (!w.archived_at || w.id === walletToId)).map((w) => <option key={w.id} value={w.id}>{w.name}{w.archived_at ? " (Dompet dihapus)" : ` · ${KINDS[w.kind]}`}</option>)}
          </select>
          <small className="category-budget-empty">Saldo dompet asal berkurang; saldo dompet tujuan bertambah.</small>
          {transferMovesIntoInvestment(walletId, walletToId) && selectedCategoryBudget && (
            <div className="category-budget-hint">
              <div className="bar" role="progressbar" aria-valuenow={Math.round(selectedCategoryPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Anggaran Investasi">
                <i className={selectedCategorySpent > selectedCategoryBudget.amount ? "over" : ""} style={{ width: `${selectedCategoryPct}%` }} />
              </div>
              <small>Masuk ke anggaran Investasi: sisa {rp(Math.max(0, selectedCategoryBudget.amount - selectedCategorySpent))} dari {rp(selectedCategoryBudget.amount)}.</small>
            </div>
          )}
          {transferMovesIntoInvestment(walletId, walletToId) && !selectedCategoryBudget && (
            <small className="category-budget-empty">Pindah dana ini otomatis tercatat sebagai pengeluaran kategori Investasi. Belum ada anggaran Investasi untuk bulan ini.</small>
          )}
          {transferMovesFromInvestment(walletId, walletToId) && (
            <small className="category-budget-empty">Pencairan dari Investasi akan dihitung sebagai pemasukan.</small>
          )}
        </div>}
        <button className="btn" disabled={saving}>{saving ? "Menyimpan..." : editId ? "Simpan perubahan" : "Simpan transaksi"}</button>
        {editId && <button type="button" className="btn ghost" style={{ marginTop: 8, width: "100%" }} onClick={resetForm}>Batal</button>}
      </form>
    </section>
  );

  return (
    <div className={`shell ${nav === "anggaran" ? "budget-shell" : ""} ${sidebarOpen ? "" : "sidebar-collapsed"} ${nav === "catat-transaksi" || nav === "dompet" ? "transaction-shell" : ""}`}>
      {nav !== "anggaran" && nav !== "catat-transaksi" && nav !== "dompet" && sidebarOpen && <aside className="side">
        <div className="profile">
          <div className="avatar" aria-hidden="true">{(uname[0] ?? "?").toUpperCase()}</div>
          <b>{uname}</b>
        </div>
        <nav className="navlist" aria-label="Menu utama">
          {NAV_GROUPS.map((group) => (
            <div className="navgroup" key={group.label}>
              {group.label && <b className="navgroup-title">{group.label}</b>}
              <div className="navitems">
                {group.items.map((item) => "action" in item ? (
                  <button
                    className="nav-action"
                    key={item.id}
                    type="button"
                    onClick={() => supabase.auth.signOut()}
                  >
                    <Icon n={item.icon} /><span>{item.label}</span>
                  </button>
                ) : (
                  <button key={item.id} type="button" aria-current={nav === item.id} onClick={() => setNav(item.id)}>
                    <Icon n={item.icon} /><span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>}

      <main className={`main ${nav === "anggaran" ? "budget-page" : ""} ${nav === "catat-transaksi" ? "transaction-page" : ""} ${nav === "dompet" ? "wallet-page" : ""}`}>
        {nav === "anggaran" ? (
          <header className="budget-page-header">
            <button className="budget-back" type="button" onClick={() => setNav("beranda")} aria-label="Kembali ke Beranda">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
            </button>
            <h1>Anggaran</h1>
            <button className="budget-add" type="button" onClick={openNewBudget} aria-label="Tambah anggaran">+</button>
          </header>
        ) : nav === "catat-transaksi" || nav === "dompet" ? (
          <header className="transaction-page-header">
            <button className="budget-back" type="button" onClick={() => setNav("beranda")} aria-label="Kembali ke Beranda">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
            </button>
            <h1>{nav === "catat-transaksi" ? "Catat Transaksi" : "Dompet"}</h1>
          </header>
        ) : <header className="home-header">
          <div>
            <div className="greeting">Selamat {sapa}, {uname}</div>
            <h1>{nav === "beranda" ? "Beranda" : nav === "kelola-uang" ? "Kelola Uang" : nav === "catat-transaksi" ? "Catat Transaksi" : nav === "wishlist" ? "Wish List" : nav === "statistik" ? "Statistik" : "Pengaturan"}</h1>
          </div>
          <div className="home-header-actions">
            {["beranda", "statistik", "kelola-uang", "catat-transaksi"].includes(nav) && <select className="pick" aria-label="Pilih bulan" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>}
            <button className="icon-button" type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Sembunyikan menu" : "Tampilkan menu"}><Icon n="menu" /></button>
            <button className="icon-button" type="button" onClick={() => setNav("pengaturan")} aria-label="Buka pengaturan"><Icon n="settings" /></button>
          </div>
        </header>}

        {error && <p className="err" role="alert">{error}</p>}

        {nav === "anggaran" && <>
          <div className="budget-month-picker" aria-label="Pilih bulan anggaran">
            <select className="pick" aria-label="Bulan anggaran" value={viewBudgetMonth} onChange={(e) => setViewBudgetMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
            <input className="pick budget-year" aria-label="Tahun anggaran" type="number" min="2000" max="2100" value={viewBudgetYear} onChange={(e) => setViewBudgetYear(Number(e.target.value))} />
          </div>
          <section className="budget-overview">
            <div className="budget-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={budgetChart.filter((item) => item.spent > 0)} dataKey="spent" nameKey="name" innerRadius="70%" outerRadius="96%" paddingAngle={2} stroke="none">
                    {budgetChart.filter((item) => item.spent > 0).map((item) => (
                      <Cell key={item.name} fill={COLORS[budgetChart.findIndex((row) => row.name === item.name) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Pie data={budgetChart.filter((item) => item.budget > 0)} dataKey="budget" nameKey="name" innerRadius="44%" outerRadius="66%" paddingAngle={2} stroke="none">
                    {budgetChart.filter((item) => item.budget > 0).map((item) => (
                      <Cell key={item.name} fill={COLORS[budgetChart.findIndex((row) => row.name === item.name) % COLORS.length]} fillOpacity={0.55} />
                    ))}
                  </Pie>
                  {budgetChartSpentTotal === 0 && <Pie data={[{ name: "Tidak ada pengeluaran", value: 1 }]} dataKey="value" innerRadius="70%" outerRadius="96%" stroke="none"><Cell fill="#e9eaf2" /></Pie>}
                  {budgetChartBudgetTotal === 0 && <Pie data={[{ name: "Belum ada anggaran", value: 1 }]} dataKey="value" innerRadius="44%" outerRadius="66%" stroke="none"><Cell fill="#d9dbe8" /></Pie>}
                  <Tooltip formatter={(value: number) => rp(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="budget-donut-center">
                <strong>{rp(budgetChartSpentTotal)} / {rp(budgetChartBudgetTotal)}</strong>
              </div>
            </div>
            <div className="budget-chart-legend">
              {budgetChart.length
                ? <>
                  <div className="budget-chart-legend-key"><span><i className="spent-key" />Pengeluaran</span><span><i className="budget-key" />Anggaran</span></div>
                  {budgetChart.map((item, index) => (
                    <span className="budget-chart-category" key={item.name}>
                      <i style={{ background: COLORS[index % COLORS.length] }} />
                      <span>{item.name}</span>
                      <b>{rp(item.spent)} / {rp(item.budget)}</b>
                    </span>
                  ))}
                </>
                : <p className="empty">Belum ada anggaran atau pengeluaran pada bulan ini.</p>}
            </div>
          </section>

          <section className="budget-list category-manager">
            <div className="section-heading">
              <div><h2>Kategori pengeluaran</h2><small>Kelola kategori yang tersedia untuk transaksi dan anggaran.</small></div>
            </div>
            <form className="category-add-form" onSubmit={addExpenseCategory}>
              <input aria-label="Nama kategori baru" placeholder="Nama kategori baru" value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value)} />
              <button className="btn" type="submit">Tambah kategori</button>
            </form>
            <div className="category-chips">
              {expenseCategories.map((item) => (
                <span className="category-chip" key={item}>
                  {item}
                  <button type="button" disabled={item.toLowerCase() === "investasi"} title={item.toLowerCase() === "investasi" ? "Kategori ini digunakan oleh Pindah Dana ke investasi" : `Hapus kategori ${item}`} onClick={() => removeExpenseCategory(item)} aria-label={`Hapus kategori ${item}`}>×</button>
                </span>
              ))}
            </div>
          </section>

          <div className="budget-period-tabs" role="tablist" aria-label="Kategori anggaran">
            {(["all", ...expenseCategories] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={budgetFilter === item} onClick={() => setBudgetFilter(item)}>{item === "all" ? "Semua" : item}</button>
            ))}
          </div>

          <section className="budget-list">
            <h2>Anggaran aktif</h2>
            {visibleBudgets.length === 0 ? (
              <p className="empty">Belum ada anggaran untuk kategori dan bulan ini. Tekan + untuk menambahkan.</p>
            ) : visibleBudgets.map((budget) => {
              const over = budget.kind === "limit" && budget.used > budget.amount;
              const near = budget.kind === "limit" && budget.pct >= 80;
              return (
                <article className="budget-entry" key={`${budget.category}-${budget.month}-${budget.year}`}>
                  <div className="budget-entry-heading">
                    <div><strong>{budget.category}</strong><small>{MONTH_NAMES[budget.month - 1]} {budget.year}</small></div>
                    <strong>{rp(budget.used)} <small>/ {rp(budget.amount)}</small></strong>
                  </div>
                  <div className="bar" role="progressbar" aria-valuenow={Math.round(budget.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${budget.category} ${MONTH_NAMES[budget.month - 1]} ${budget.year}`}>
                    <i className={over ? "over" : budget.kind === "target" && budget.used >= budget.amount ? "done" : ""} style={{ width: `${budget.pct}%` }} />
                  </div>
                  <div className="budget-entry-footer">
                    <span className={over ? "budget-alert" : ""}>{over ? `Melewati batas ${rp(budget.used - budget.amount)}` : near ? "Hampir mencapai batas" : budget.kind === "target" && budget.used >= budget.amount ? "Target tercapai" : `Sisa ${rp(Math.max(0, budget.amount - budget.used))}`}</span>
                    <span className="budget-entry-actions">
                      <button type="button" onClick={() => { startEditBudget(budget); setBudgetFormOpen(true); }}>Ubah</button>
                      <button type="button" onClick={() => removeBudget(budget)}>Hapus</button>
                    </span>
                  </div>
                </article>
              );
            })}
          </section>

          {budgetFormOpen && <div className="budget-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setBudgetFormOpen(false); cancelBudgetEdit(); } }}>
            <section className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title">
              <div className="section-heading">
                <h2 id="budget-modal-title">{budgetEditing ? "Ubah anggaran" : "Tambah anggaran"}</h2>
                <button type="button" className="modal-close" onClick={() => { setBudgetFormOpen(false); cancelBudgetEdit(); }} aria-label="Tutup">×</button>
              </div>
              <form onSubmit={saveBudget}>
                <div className="field">
                  <label htmlFor="budget-category">Kategori pengeluaran</label>
                  <select id="budget-category" value={budgetCategory} disabled={!!budgetEditing} onChange={(e) => setBudgetCategory(e.target.value)}>
                    {budgetEditing && !expenseCategories.includes(budgetEditing.category) && <option value={budgetEditing.category}>{budgetEditing.category}</option>}
                    {expenseCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="budget-month">Bulan</label>
                  <select id="budget-month" value={budgetMonth} disabled={!!budgetEditing} onChange={(e) => setBudgetMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="budget-year">Tahun</label>
                  <input id="budget-year" type="number" min="2000" max="2100" required disabled={!!budgetEditing} value={budgetYear} onChange={(e) => setBudgetYear(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label htmlFor="budget-amount">Batas anggaran (Rp)</label>
                  <input id="budget-amount" inputMode="numeric" placeholder="mis. 50.000" required value={budgetAmount} onChange={(e) => setBudgetAmount(rupiahInput(e.target.value))} />
                </div>
                <button className="btn" disabled={savingBudget}>{savingBudget ? "Menyimpan..." : budgetEditing ? "Simpan perubahan" : "Simpan anggaran"}</button>
              </form>
            </section>
          </div>}
        </>}

        {nav === "beranda" && <>
        <section className="home-balance">
          <div className="balance-heading"><span>Saldo saat ini</span><small>{monthLabel(month)}</small></div>
          <strong>{rp(saldo)}</strong>
        </section>

        <section className="investment-balance-card">
          <span><Icon n="chart" /> Saldo Investasi</span>
          <strong>{rp(investmentBalance)}</strong>
          <button type="button" onClick={() => setNav("dompet")}>Lihat dompet</button>
        </section>

        <div className="home-totals">
          <section className="total-tile income-tile">
            <span className="total-icon">↗</span><span>Pendapatan</span>
            <strong>{rp(inM)}</strong>
          </section>
          <section className="total-tile expense-tile">
            <span className="total-icon">↘</span><span>Pengeluaran</span>
            <strong>{rp(outM)}</strong>
          </section>
        </div>

        <nav className="home-shortcuts" aria-label="Pintasan">
          <button type="button" onClick={() => setNav("anggaran")}><span className="shortcut-icon budget-shortcut"><Icon n="budget" /></span>Anggaran</button>
          <button type="button" onClick={() => { setNav("catat-transaksi"); setEditId(null); }}><span className="shortcut-icon add-shortcut">+</span>Catat transaksi</button>
          <button type="button" onClick={() => setNav("dompet")}><span className="shortcut-icon wallet-shortcut"><Icon n="wallet" /></span>Dompet</button>
          <button type="button" onClick={() => setNav("wishlist")}><span className="shortcut-icon wishlist-shortcut"><Icon n="wishlist" /></span>Wish List</button>
        </nav>

        <section className="card recent-card" id="transaksi">
          <div className="section-heading recent-heading">
            <h2>Transaksi terbaru</h2>
            <label className="recent-search">
              <span className="sr">Cari transaksi</span>
              <input placeholder="Cari transaksi" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Icon n="search" />
            </label>
          </div>
          {loading ? (
            <p className="empty">Memuat...</p>
          ) : shown.length === 0 ? (
            <p className="empty">Belum ada transaksi untuk periode ini.</p>
          ) : (
            shown.slice(0, more ? shown.length : 5).map((t) => (
              <div className="tx" key={t.id}>
                <div>
                  <div className="cat">{t.type === "transfer" ? `Pindah Dana${isTransferToInvestment(t) ? " · Investasi" : ""}` : t.category}{t.note ? ` · ${t.note}` : ""}</div>
                  <div className="meta">{dateLabel(t.date)}{t.type === "transfer"
                    ? ` · ${wallets.find((w) => w.id === t.wallet_id)?.name ?? "Dompet asal"}${wallets.find((w) => w.id === t.wallet_id)?.archived_at ? " (Dompet sudah dihapus)" : ""} → ${wallets.find((w) => w.id === t.wallet_to_id)?.name ?? "Dompet tujuan"}${wallets.find((w) => w.id === t.wallet_to_id)?.archived_at ? " (Dompet sudah dihapus)" : ""}`
                    : t.wallet_id ? ` · ${wallets.find((w) => w.id === t.wallet_id)?.name ?? ""}${wallets.find((w) => w.id === t.wallet_id)?.archived_at ? " (Dompet sudah dihapus)" : ""}` : ""}</div>
                </div>
                <div className={`amt ${t.type === "transfer" ? isTransferToInvestment(t) ? "out" : isTransferFromInvestment(t) ? "in" : "" : t.type}`}>{t.type === "transfer" ? `${isTransferToInvestment(t) ? "-" : isTransferFromInvestment(t) ? "+" : ""}${rp(t.amount)}` : `${t.type === "in" ? "+" : "-"}${rp(t.amount)}`}</div>
                <span className="transaction-actions">
                  <button className="del" onClick={() => startEdit(t)}>Ubah</button>
                  <button className="del" onClick={() => remove(t)}>Hapus</button>
                </span>
              </div>
            ))
          )}
          {shown.length > 5 && <button className="btn ghost see-all" onClick={() => setMore(!more)}>{more ? "Tampilkan lebih sedikit" : `Lihat semua (${shown.length})`}</button>}
        </section>

        <div className="home-grid">
          <section className="card home-budget">
            <div className="section-heading">
              <h2>Anggaran berjalan</h2>
              <button type="button" onClick={() => setNav("anggaran")}>Kelola</button>
            </div>
            {budgetOverview.length === 0 ? (
              <p className="empty">Belum ada anggaran.</p>
            ) : budgetOverview.map((b) => {
              const over = b.kind === "limit" && b.used > b.amount;
              const near = b.kind === "limit" && b.pct >= 80;
              return (
                <div className="budget" key={b.category}>
                  <div className="head">
                    <strong>{b.category}</strong>
                    <span className={over ? "budget-alert" : ""}>{over ? "Melewati batas" : near ? "Hampir mencapai batas" : `${rp(b.used)} / ${rp(b.amount)}`}</span>
                  </div>
                  <div className="bar" role="progressbar" aria-valuenow={Math.round(b.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Anggaran ${b.category}`}>
                    <i className={over ? "over" : b.kind === "target" && b.used >= b.amount ? "done" : ""} style={{ width: `${b.pct}%` }} />
                  </div>
                  <div className="msg">{b.kind === "target"
                    ? b.used >= b.amount ? "Target tercapai." : `Kurang ${rp(b.amount - b.used)} lagi.`
                    : over ? `Lewat ${rp(b.used - b.amount)} dari batas.` : `Sisa ${rp(b.amount - b.used)}.`}</div>
                </div>
              );
            })}
          </section>

          <section className="card home-chart">
            <div className="section-heading">
              <h2>Arus kas</h2>
              <button type="button" onClick={() => setNav("statistik")}>Detail</button>
            </div>
            {miniSeries.length === 0 ? <p className="empty">Grafik akan muncul setelah ada transaksi.</p> : (
              <>
                <div className="legend row">
                  <span><i style={{ background: "var(--in)" }} />Pemasukan</span>
                  <span><i style={{ background: "var(--out)" }} />Pengeluaran</span>
                </div>
                <div className="mini-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={miniSeries}>
                      <CartesianGrid vertical={false} stroke="#ece7da" />
                      <XAxis dataKey="bulan" {...axis} />
                      <YAxis hide />
                      <Tooltip formatter={(v: number) => rp(v)} />
                      <Line type="monotone" dataKey="Pemasukan" stroke="#12b886" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="Pengeluaran" stroke="#ee4a74" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>
        </div>
        </>}

        {nav !== "beranda" && nav !== "anggaran" && <>
        {!["catat-transaksi", "dompet"].includes(nav) && <h2 className="page-section-title">{nav === "kelola-uang" ? "Kelola Uang" : nav === "wishlist" ? "Wish List" : nav === "statistik" ? "Statistik" : "Pengaturan akun"}</h2>}
        <div className={`cols ${nav === "kelola-uang" ? "manage-view" : nav === "catat-transaksi" ? "transaction-view" : nav === "dompet" ? "wallet-view" : nav === "statistik" ? "stats-view" : "settings-view"}`}>
          {nav === "kelola-uang" && <div className="col">
<section className="card">
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
  </div>}

  {nav === "catat-transaksi" && <>{balanceSummary}{transactionEntry}</>}

  {nav === "dompet" && <>
    <section className="card wallet-balance-panel">
      <h2>Saldo saat ini</h2>
      <div className="pcard">
        <small>Total saldo dompet</small>
        <div className="big">{rp(saldo)}</div>
      </div>
      <h3>Dompet</h3>
      {regularWalletEntries.length ? regularWalletEntries.map((w) => (
        <article className="wallet-entry" key={w.id}>
          <div><strong>{w.name}</strong><small>{w.kind}</small></div>
          <b>{rp(w.bal)}</b>
          <button type="button" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) archiveWallet(wallet); }}>Hapus</button>
        </article>
      )) : <p className="empty">Belum ada dompet aktif.</p>}
      {unassignedWalletBalance !== 0 && <div className="wallet-entry"><div><strong>Tanpa dompet</strong><small>Transaksi belum dipasangkan</small></div><b>{rp(unassignedWalletBalance)}</b></div>}
      {!!archivedRegularBalances.length && <>
        <h3 className="archived-wallet-title">Dompet dihapus</h3>
        {archivedRegularBalances.map((w) => (
          <article className="wallet-entry archived-wallet-entry" key={w.id}>
            <div><strong>{w.name}</strong><small>Riwayat transaksi tetap tersimpan</small></div>
            <b>{rp(w.bal)}</b>
            <button type="button" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) restoreWallet(wallet); }}>Pulihkan</button>
          </article>
        ))}
      </>}
    </section>
    <section className="card wallet-investment-panel">
      <h2>Saldo Investasi</h2>
      <div className="investment-total investment-total-large">
        <span>Total investasi</span>
        <strong>{rp(investmentBalance)}</strong>
        <small>Saldo yang dipisahkan dari dompet siap pakai</small>
      </div>
      <h3>Investasi</h3>
      {investmentWalletEntries.length ? investmentWalletEntries.map((w) => (
        <article className="wallet-entry" key={w.id}>
          <div><strong>{w.name}</strong><small>{w.kind}</small></div>
          <b>{rp(w.bal)}</b>
          <button type="button" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) archiveWallet(wallet); }}>Hapus</button>
        </article>
      )) : <p className="empty">Belum ada dompet investasi aktif.</p>}
      {!!archivedInvestmentBalances.length && <>
        <h3 className="archived-wallet-title">Investasi dihapus</h3>
        {archivedInvestmentBalances.map((w) => (
          <article className="wallet-entry archived-wallet-entry" key={w.id}>
            <div><strong>{w.name}</strong><small>Riwayat transaksi tetap tersimpan</small></div>
            <b>{rp(w.bal)}</b>
            <button type="button" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) restoreWallet(wallet); }}>Pulihkan</button>
          </article>
        ))}
      </>}
    </section>
    <section className="card wallet-add-card">
      <h2>Tambah dompet</h2>
      <form onSubmit={addWallet}>
        <div className="field">
          <label htmlFor="new-wallet-name">Nama dompet</label>
          <input id="new-wallet-name" required placeholder="mis. BCA, GoPay, Reksadana" value={newWallet.name} onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new-wallet-kind">Jenis dompet</label>
          <select id="new-wallet-kind" value={newWallet.kind} onChange={(e) => setNewWallet({ ...newWallet, kind: e.target.value as Wallet["kind"] })}>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button className="btn">Tambah dompet</button>
      </form>
    </section>
  </>}

  {nav === "wishlist" && <section className="card wishlist-card">
    <div className="section-heading">
      <h2>Daftar keinginan</h2>
      <button type="button" onClick={() => { setWishEditing(null); setWishName(""); setWishAmount(""); setWishFormOpen(true); }}>+ Tambah</button>
    </div>
    {wishes.length === 0 ? <p className="empty">Belum ada barang di Wish List. Tambahkan nama barang dan harga targetnya.</p> : wishes.map((wish) => (
      <article className="wishlist-entry" key={wish.id}>
        <div><strong>{wish.name}</strong><small>Target harga</small></div>
        <b>{rp(wish.target_amount)}</b>
        <span className="budget-entry-actions">
          <button type="button" onClick={() => editWish(wish)}>Ubah</button>
          <button type="button" onClick={() => removeWish(wish)}>Hapus</button>
        </span>
      </article>
    ))}
  </section>}

          {nav === "statistik" && <div className="col">
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

          </div>}

          {nav === "statistik" && <div className="col">
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
          }

          {nav === "pengaturan" && <div className="col">
            <section className="card" id="pengaturan">
              <h2>Pengaturan akun</h2>
              <p className="note">Akun: {session.user.email ?? uname}</p>
              <form onSubmit={changePassword}>
                <div className="field">
                  <label htmlFor="new-password">Kata sandi baru</label>
                  <input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Konfirmasi kata sandi baru</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                {passwordMessage && <p className={passwordMessage === "Kata sandi berhasil diubah." ? "note" : "err"} role={passwordMessage === "Kata sandi berhasil diubah." ? "status" : "alert"}>{passwordMessage}</p>}
                <button className="btn" disabled={changingPassword}>{changingPassword ? "Menyimpan..." : "Ubah kata sandi"}</button>
              </form>
            </section>
          </div>}
        </div>
        </>}

        {wishFormOpen && <div className="budget-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setWishFormOpen(false); setWishEditing(null); } }}>
          <section className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="wish-modal-title">
            <div className="section-heading">
              <h2 id="wish-modal-title">{wishEditing ? "Ubah Wish List" : "Tambah Wish List"}</h2>
              <button type="button" className="modal-close" onClick={() => { setWishFormOpen(false); setWishEditing(null); }} aria-label="Tutup">×</button>
            </div>
            <form onSubmit={saveWish}>
              <div className="field">
                <label htmlFor="wish-name">Nama barang</label>
                <input id="wish-name" required value={wishName} onChange={(e) => setWishName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="wish-amount">Harga target (Rp)</label>
                <input id="wish-amount" inputMode="numeric" placeholder="mis. 250.000" required value={wishAmount} onChange={(e) => setWishAmount(rupiahInput(e.target.value))} />
              </div>
              <button className="btn" disabled={savingWish}>{savingWish ? "Menyimpan..." : wishEditing ? "Simpan perubahan" : "Simpan ke Wish List"}</button>
            </form>
          </section>
        </div>}
      </main>
    </div>
  );
}
