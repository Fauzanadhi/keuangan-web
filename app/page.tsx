"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isRecovery, linkExpired, supabase } from "@/lib/supabase";

type Tx = { id: string; date: string; type: "in" | "out" | "transfer"; amount: number; category: string; note: string | null; wallet_id: string | null; wallet_to_id: string | null; wishlist_id: string | null };
type Budget = { category: string; amount: number; kind: "limit" | "target"; month: number; year: number };
type Wish = { id: string; name: string; target_amount: number; completed_at: string | null; completed_amount: number | null };

const DEFAULT_IN_CATS = ["Deposit", "Gaji", "Lainnya"];
const DEFAULT_OUT_CATS = ["Jajan", "Jalan", "Kebutuhan", "Tanggungan", "Infaq", "Tabungan", "Investasi", "Lainnya"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const YEAR_OPTIONS = Array.from({ length: 101 }, (_, index) => String(2000 + index));
const COLORS = ["#2ecfc4", "#7185ff", "#f2a65a", "#d87ac7", "#8bc85b", "#ed7186", "#48a9d8", "#b99045", "#9275d8", "#53b99a", "#ed8051", "#6d8fbd"];
const categoryColor = (index: number) =>
  COLORS[index] ?? `hsl(${(18 + (index - COLORS.length) * 31) % 360} 72% 61%)`;

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
const KINDS = { cash: "Tunai", emoney: "E - Wallet", bank: "Rekening" } as const;

const NAV_GROUPS = [
  { label: "", items: [
    { id: "beranda", label: "Beranda", icon: "home" },
  ] },
  { label: "", items: [
    { id: "kelola-uang", label: "Transaksi", icon: "list" },
  ] },
  { label: "", items: [
    { id: "statistik", label: "Statistik", icon: "chart" },
  ] },
  { label: "", items: [
    { id: "pengaturan", label: "Kategori", icon: "category" },
  ] },
];

function Icon({ n }: { n: string }) {
  const p: Record<string, string> = {
    home: "M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z",
    list: "M7 3.75h8l4 4V20a1 1 0 01-1 1H7a2 2 0 01-2-2V5.75a2 2 0 012-2zM15 4v4h4M9 12h6M9 16h6M7.5 12h.01M7.5 16h.01",
    wallet: "M4.5 6.5h14a2 2 0 012 2v10a2 2 0 01-2 2h-13a2 2 0 01-2-2v-12a2 2 0 012-2zM3.5 9h17M15.5 14h2M6 6.5V5a2 2 0 012-2h10",
    chart: "M4 19.5h16M5.5 16V11M10 16V6M14.5 16V9M19 16V4M4.5 8.5l5-4 4.5 3 5-4",
    "trend-up": "M3 17l6-6 4 4 8-9M15 6h6v6",
    "trend-down": "M3 7l6 6 4-4 8 9M15 18h6v-6",
    eye: "M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 9a3 3 0 100 6 3 3 0 000-6z",
    "eye-off": "M3 3l18 18M10.6 6.2A10.7 10.7 0 0112 6c6.4 0 10 6 10 6a16 16 0 01-3.1 3.7M6.2 6.3C3.5 8.1 2 12 2 12s3.6 6 10 6a10.7 10.7 0 004.2-.8M9.9 9.9a3 3 0 004.2 4.2",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
    budget: "M12 3.5l7 3v5.3c0 4.2-2.8 7.2-7 8.7-4.2-1.5-7-4.5-7-8.7V6.5l7-3zM12 8v7M14.2 9.5c-.5-.7-1.2-1-2.2-1-1.2 0-2 .6-2 1.5s.8 1.3 2 1.5 2 .6 2 1.5-.8 1.5-2 1.5c-.9 0-1.7-.3-2.2-1",
    category: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 00-1.8.2l-.1.1h-3.4l-.1-.2a1.7 1.7 0 00-1.5-1.1h-.2l-2.9-1.7.1-.2a1.7 1.7 0 00-.2-1.8l-.1-.1v-3.4l.2-.1a1.7 1.7 0 001.1-1.5v-.2l1.7-2.9.2.1a1.7 1.7 0 001.8-.2l.1-.1h3.4l.1.2a1.7 1.7 0 001.5 1.1h.2l2.9 1.7-.1.2a1.7 1.7 0 00.2 1.8l.1.1v3.4z",
    account: "M20 21a8 8 0 00-16 0M12 13a5 5 0 100-10 5 5 0 000 10z",
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

function PeriodOptionPicker({
  label,
  value,
  options,
  className,
  onChange,
  id,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  className: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `period-menu-${className}`;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const focusOption = (index: number) => {
    menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[index]?.focus();
  };

  return (
    <div className={`period-select themed-select ${className}`} ref={pickerRef}>
      <button
        ref={triggerRef}
        id={id}
        className="pick period-select-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
            requestAnimationFrame(() => focusOption(selectedIndex));
          }
        }}
      >
        <span>{options.find((option) => option.value === value)?.label ?? value}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="period-options" id={menuId} role="menu" ref={menuRef} aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={option.value === value ? "selected" : ""}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  focusOption((index + direction + options.length) % options.length);
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  focusOption(event.key === "Home" ? 0 : options.length - 1);
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
          <PasswordField id="np" label="Kata sandi baru" autoComplete="new-password" value={pw} onChange={setPw} required />
        </div>
        <div className="field">
          <PasswordField id="nc" label="Konfirmasi kata sandi" autoComplete="new-password" value={cf} onChange={setCf} required />
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan kata sandi"}</button>
      </form>
    </main>
  );
}

function PasswordField({
  id, label, value, onChange, autoComplete, required = false, minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return <>
    <label htmlFor={id}>{label}</label>
    <div className="password-input-wrap">
      <input id={id} type={visible ? "text" : "password"} required={required} minLength={minLength} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      <button className="password-visibility" type="button" onClick={() => setVisible((show) => !show)} aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={visible}>
        {visible
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.2-1.2 2.4-2.2 3.4M6.2 6.2C4.2 7.5 2.9 9.7 2.5 12c.9 2.8 4.5 7 9.5 7 1.1 0 2.1-.2 3-.5" /></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>}
      </button>
    </div>
  </>;
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
        <h1>Pocket Flow</h1>
        <p>Masuk untuk melihat catatanmu.</p>
        <div className="field">
          <label htmlFor="id">Username</label>
          <input id="id" required autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="field">
          <PasswordField id="pw" label="Kata sandi" autoComplete="current-password" value={password} onChange={setPassword} required />
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
  const [showBalances, setShowBalances] = useState(true);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void | Promise<void> } | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [reportScale, setReportScale] = useState<"monthly" | "yearly">("monthly");
  const [search, setSearch] = useState("");
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_OUT_CATS);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(DEFAULT_IN_CATS);
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newIncomeCategory, setNewIncomeCategory] = useState("");
  const [categoryKind, setCategoryKind] = useState<"income" | "expense">("expense");
  const [editId, setEditId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState("");
  const [transactionWishId, setTransactionWishId] = useState("");
  const [newWallet, setNewWallet] = useState<{ name: string; kind: keyof typeof KINDS | "investment" }>({ name: "", kind: "cash" });
  const [walletEditing, setWalletEditing] = useState<Wallet | null>(null);
  const [nav, setNav] = useState("beranda");
  const navHistory = useRef<string[]>([]);
  const currentNav = useRef(nav);
  const [more, setMore] = useState(false);
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sapa, setSapa] = useState("pagi");
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
  const [walletToId, setWalletToId] = useState("");
  const [saving, setSaving] = useState(false);

  function navigate(to: string) {
    if (currentNav.current !== to) {
      navHistory.current.push(currentNav.current);
      window.history.pushState({ pocketFlowNav: to }, "", window.location.href);
    }
    currentNav.current = to;
    setNav(to);
  }

  function goBack() {
    if (navHistory.current.length) {
      window.history.back();
      return;
    }
    const previous = navHistory.current.pop() ?? "beranda";
    currentNav.current = previous;
    setNav(previous);
  }

  useEffect(() => {
    setDarkMode(localStorage.getItem("keuangan-theme") === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("keuangan-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const handlePopState = () => {
      const previous = navHistory.current.pop() ?? "beranda";
      currentNav.current = previous;
      setNav(previous);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      setSapa(hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam");
    };
    updateGreeting();
    const interval = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    const all: Tx[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,date,type,amount,category,note,wallet_id,wallet_to_id,wishlist_id")
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
    const incomeCats = await supabase.from("income_categories").select("category").order("category");
    if (incomeCats.error) setError(incomeCats.error.message);
    else if (!incomeCats.data?.length) {
      const { error: seedError } = await supabase.from("income_categories").insert(
        DEFAULT_IN_CATS.map((category) => ({ user_id: session.user.id, category })),
      );
      if (seedError) setError(seedError.message);
      else setIncomeCategories(DEFAULT_IN_CATS);
    } else {
      setIncomeCategories(incomeCats.data.map((item) => item.category));
    }
    const b = await supabase.from("category_budgets").select("category,amount,kind,month,year");
    if (b.error) setError(b.error.message);
    else setBudgets((b.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) }) as Budget));
    const wish = await supabase.from("wish_list").select("id,name,target_amount,completed_at,completed_amount").order("created_at", { ascending: false });
    if (wish.error) setError(wish.error.message);
    else setWishes((wish.data ?? []).map((x) => ({ ...x, target_amount: Number(x.target_amount), completed_amount: x.completed_amount === null ? null : Number(x.completed_amount) })) as Wish[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const transactionCategory = (transaction: Tx) => transaction.type === "transfer" ? "Pindah dana" : transaction.category;
  const transferWalletRoute = (transaction: Tx) => {
    const walletName = (id: string | null) => {
      if (!id) return "Dompet tidak tersedia";
      const wallet = wallets.find((item) => item.id === id);
      return wallet ? `${wallet.name}${wallet.archived_at ? " (diarsipkan)" : ""}` : "Dompet tidak tersedia";
    };
    return `${walletName(transaction.wallet_id)} → ${walletName(transaction.wallet_to_id)}`;
  };
  const expenseForCategoryInRange = (expenseCategory: string, from: string, to: string) =>
    txs.filter((transaction) =>
      transaction.date >= from && transaction.date <= to &&
      transaction.type === "out" && transaction.category === expenseCategory,
    ).reduce((total, transaction) => total + transaction.amount, 0);
  const monthTxs = useMemo(() => txs.filter((t) => t.date.startsWith(month)), [txs, month]);
  const inM = monthTxs.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0);
  const outM = monthTxs.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0);
  const transactionCategories = useMemo(
    () => Array.from(new Set(txs.map(transactionCategory))).sort((a, b) => a.localeCompare(b, "id")),
    [txs, wallets],
  );
  const transactionYears = useMemo(
    () => Array.from(new Set([new Date().getFullYear(), ...txs.map((t) => Number(t.date.slice(0, 4)))]))
      .sort((a, b) => b - a),
    [txs],
  );
  const transactionPeriodRows = useMemo(
    () => monthTxs.filter((transaction) => transactionCategoryFilter === "all" || transactionCategory(transaction) === transactionCategoryFilter),
    [monthTxs, transactionCategoryFilter, wallets],
  );
  const transactionRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? transactionPeriodRows.filter((t) => {
          const walletNames = [t.wallet_id, t.wallet_to_id]
            .map((id) => wallets.find((wallet) => wallet.id === id)?.name ?? "")
            .join(" ");
          return `${transactionCategory(t)} ${t.note ?? ""} ${t.amount} ${t.date} ${walletNames}`.toLowerCase().includes(q);
        })
      : transactionPeriodRows;
  }, [transactionPeriodRows, search, wallets]);
  const transactionIncomeTotal = transactionPeriodRows
    .filter((transaction) => transaction.type === "in")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const transactionExpenseTotal = transactionPeriodRows
    .filter((transaction) => transaction.type === "out")
    .reduce((total, transaction) => total + transaction.amount, 0);

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
    const rows = wallets.map((w) => ({ id: w.id, name: w.name, kind: w.kind === "investment" ? "Dompet" : KINDS[w.kind], archived: !!w.archived_at, bal: sum(w.id) }));
    const none = txs.filter((t) => t.type !== "transfer" && !t.wallet_id).reduce((balance, t) => balance + (t.type === "in" ? t.amount : -t.amount), 0);
    return none !== 0 || !rows.length ? [...rows, { id: "none", name: "Tanpa dompet", kind: "Belum dikelompokkan", archived: false, bal: none }] : rows;
  }, [txs, wallets]);
  const activeWalletBalances = walletBal.filter((w) => !w.archived);
  const activeWallets = wallets.filter((wallet) => !wallet.archived_at);
  const archivedWalletBalances = walletBal.filter((w) => w.archived);
  const regularWalletBalances = activeWalletBalances;
  const archivedRegularBalances = archivedWalletBalances;
  const regularWalletEntries = regularWalletBalances.filter((w) => w.id !== "none");
  const unassignedWalletBalance = walletBal.find((w) => w.id === "none")?.bal ?? 0;
  const saldo = regularWalletBalances.reduce((sum, w) => sum + w.bal, 0);

  const reportYear = Number(month.slice(0, 4));
  const reportMonth = Number(month.slice(5, 7));
  const reportTransactions = txs.filter((transaction) =>
    transaction.date.startsWith(`${reportYear}-`) &&
    (reportScale === "yearly" || Number(transaction.date.slice(5, 7)) === reportMonth),
  );
  const reportIncome = reportTransactions
    .filter((transaction) => transaction.type === "in")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const reportExpense = reportTransactions
    .filter((transaction) => transaction.type === "out")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const reportExpensesByCategory = reportTransactions.reduce((totals, transaction) => {
    if (transaction.type === "out") {
      totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
    }
    return totals;
  }, new Map<string, number>());
  const reportCategories = Array.from(reportExpensesByCategory, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const reportTotalExpense = reportCategories.reduce((total, category) => total + category.value, 0);
  const reportTopCategory = reportCategories[0];
  const reportTopCategoryPercent = reportTotalExpense ? Math.round((reportTopCategory?.value ?? 0) / reportTotalExpense * 100) : 0;
  const reportChart = reportScale === "yearly"
    ? Array.from({ length: 12 }, (_, index) => {
        const m = index + 1;
        const transactions = reportTransactions.filter((transaction) => Number(transaction.date.slice(5, 7)) === m);
        return {
          bulan: MONTH_NAMES[index].slice(0, 3),
          Pemasukan: transactions.filter((transaction) => transaction.type === "in").reduce((total, transaction) => total + transaction.amount, 0),
          Pengeluaran: transactions.filter((transaction) => transaction.type === "out").reduce((total, transaction) => total + transaction.amount, 0),
        };
      })
    : Array.from({ length: new Date(reportYear, reportMonth, 0).getDate() }, (_, index) => {
        const day = index + 1;
        const transactions = reportTransactions.filter((transaction) => Number(transaction.date.slice(8, 10)) === day);
        return {
          bulan: String(day),
          Pemasukan: transactions.filter((transaction) => transaction.type === "in").reduce((total, transaction) => total + transaction.amount, 0),
          Pengeluaran: transactions.filter((transaction) => transaction.type === "out").reduce((total, transaction) => total + transaction.amount, 0),
        };
      });
  const reportBudgetByCategory = budgets
    .filter((budget) => budget.year === reportYear && (reportScale === "yearly" || budget.month === reportMonth))
    .reduce((totals, budget) => totals.set(budget.category, (totals.get(budget.category) ?? 0) + budget.amount), new Map<string, number>());
  const reportBudgetRows = Array.from(new Set([...reportBudgetByCategory.keys(), ...reportExpensesByCategory.keys()]))
    .map((category) => ({
      category,
      budget: reportBudgetByCategory.get(category) ?? 0,
      spent: reportExpensesByCategory.get(category) ?? 0,
    }))
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);

  function shiftReportPeriod(offset: number) {
    const date = new Date(reportYear, reportMonth - 1 + (reportScale === "yearly" ? offset * 12 : offset), 1);
    setMonth(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? monthTxs.filter((t) => {
          const walletNames = [t.wallet_id, t.wallet_to_id]
            .map((id) => wallets.find((wallet) => wallet.id === id)?.name ?? "")
            .join(" ");
          return `${t.category} ${t.note ?? ""} ${t.amount} ${t.date} ${walletNames}`.toLowerCase().includes(q);
        })
      : monthTxs;
  }, [monthTxs, search, wallets]);

  function switchType(t: "in" | "out" | "transfer") {
    setType(t);
    if (t !== "transfer") setCategory((t === "in" ? incomeCategories : expenseCategories)[0] ?? "");
    setTransactionWishId("");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseRupiah(amount);
    if (!amt) { setError("Isi nominal lebih dari 0."); return; }
    if (type !== "transfer") {
      const selectedWallet = activeWallets.find((wallet) => wallet.id === walletId);
      if (!selectedWallet) {
        setError("Pilih dompet aktif untuk transaksi ini.");
        return;
      }
    }
    if (type === "transfer" && !activeWallets.some((wallet) => wallet.id === walletId)) {
      setError("Pilih dompet asal yang masih aktif.");
      return;
    }
    if (type === "transfer" && !activeWallets.some((wallet) => wallet.id === walletToId)) {
      setError("Pilih dompet tujuan yang masih aktif.");
      return;
    }
    if (type === "transfer" && walletId === walletToId) {
      setError("Dompet asal dan tujuan harus berbeda.");
      return;
    }
    setSaving(true);
    setError("");
    const row = {
      date,
      type,
      amount: amt,
      category: type === "transfer" ? "Pindah dana" : category,
      note,
      wallet_id: walletId || null,
      wallet_to_id: type === "transfer" ? walletToId : null,
      wishlist_id: type === "out" ? transactionWishId || null : null,
    };
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

  function resetForm() { setAmount(""); setNote(""); setEditId(null); setWalletId(""); setWalletToId(""); setTransactionWishId(""); setType("out"); setCategory(expenseCategories[0] ?? ""); }

  function startEdit(t: Tx) {
    setEditId(t.id); setType(t.type); setDate(t.date); setAmount(rupiahInput(String(t.amount)));
    setCategory(t.category); setNote(t.note ?? ""); setWalletId(t.wallet_id ?? ""); setWalletToId(t.wallet_to_id ?? "");
    setTransactionWishId(t.wishlist_id ?? "");
    navigate("catat-transaksi");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!newWallet.name.trim()) {
      setError("Isi nama dompet.");
      return;
    }
    const query = walletEditing
      ? supabase.from("wallets").update({ name: newWallet.name.trim(), kind: newWallet.kind }).eq("id", walletEditing.id)
      : supabase.from("wallets").insert({ name: newWallet.name.trim(), kind: newWallet.kind });
    const { error } = await query;
    if (error) setError(error.message);
    else {
      setNewWallet({ name: "", kind: "cash" });
      setWalletEditing(null);
      setError("");
      await load();
    }
  }

  function startEditWallet(wallet: Wallet) {
    setWalletEditing(wallet);
    setNewWallet({ name: wallet.name, kind: wallet.kind });
    setError("");
    document.getElementById("wallet-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  async function addIncomeCategory(e: React.FormEvent) {
    e.preventDefault();
    const value = newIncomeCategory.trim();
    if (!value) return;
    if (incomeCategories.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setError("Kategori tersebut sudah ada.");
      return;
    }
    const { error } = await supabase.from("income_categories").insert({ user_id: session.user.id, category: value });
    if (error) setError(error.message);
    else {
      setIncomeCategories((items) => [...items, value].sort((a, b) => a.localeCompare(b, "id")));
      setNewIncomeCategory("");
      setError("");
    }
  }

  function removeIncomeCategory(value: string) {
    if (incomeCategories.length <= 1) {
      setError("Minimal harus ada satu kategori pemasukan.");
      return;
    }
    requestConfirmation(`Hapus kategori "${value}" dari pilihan? Riwayat transaksi lama tetap disimpan.`, async () => {
      const { error } = await supabase.from("income_categories").delete().eq("category", value);
      if (error) setError(error.message);
      else {
        const next = incomeCategories.filter((item) => item !== value);
        setIncomeCategories(next);
        if (type === "in" && category === value) setCategory(next[0]);
      }
    });
  }

  function removeExpenseCategory(value: string) {
    if (expenseCategories.length <= 1) {
      setError("Minimal harus ada satu kategori pengeluaran.");
      return;
    }
    requestConfirmation(`Hapus kategori "${value}" dari pilihan? Riwayat transaksi dan anggaran lama tetap disimpan.`, async () => {
      const { error } = await supabase.from("expense_categories").delete().eq("category", value);
      if (error) setError(error.message);
      else {
        const next = expenseCategories.filter((item) => item !== value);
        setExpenseCategories(next);
        if (category === value) setCategory(next[0]);
        if (budgetCategory === value) setBudgetCategory(next[0]);
        if (budgetFilter === value) setBudgetFilter("all");
      }
    });
  }

  function archiveWallet(wallet: Wallet) {
    requestConfirmation(`Hapus dompet "${wallet.name}" dari daftar aktif? Riwayat dan saldonya tetap tersimpan, dan transaksi lama akan menandai dompet ini sebagai dihapus.`, async () => {
      const { error } = await supabase.from("wallets").update({ archived_at: new Date().toISOString() }).eq("id", wallet.id);
      if (error) setError(error.message);
      else await load();
    });
  }

  async function restoreWallet(wallet: Wallet) {
    const { error } = await supabase.from("wallets").update({ archived_at: null }).eq("id", wallet.id);
    if (error) setError(error.message);
    else await load();
  }

  function permanentlyDeleteWallet(wallet: Wallet) {
    if (!wallet.archived_at) {
      setError("Hanya dompet yang sudah diarsipkan yang dapat dihapus permanen.");
      return;
    }
    requestConfirmation(`Hapus permanen dompet "${wallet.name}" beserta seluruh transaksi yang terkait? Tindakan ini tidak dapat dibatalkan.`, async () => {
      const { error: transactionError } = await supabase
        .from("transactions")
        .delete()
        .or(`wallet_id.eq.${wallet.id},wallet_to_id.eq.${wallet.id}`);
      if (transactionError) {
        setError(`Transaksi terkait dompet tidak dapat dihapus: ${transactionError.message}`);
        return;
      }

      const { error: walletError } = await supabase
        .from("wallets")
        .delete()
        .eq("id", wallet.id)
        .not("archived_at", "is", null);
      if (walletError) {
        setError(`Transaksi terkait sudah dihapus, tetapi dompet gagal dihapus: ${walletError.message}`);
        return;
      }
      await load();
    });
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
    if (!currentPassword) {
      setPasswordMessage("Masukkan kata sandi saat ini untuk verifikasi.");
      return;
    }
    if (!session.user.email) {
      setPasswordMessage("Email akun tidak tersedia untuk memverifikasi kata sandi saat ini.");
      return;
    }
    setChangingPassword(true);
    setPasswordMessage("");
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setChangingPassword(false);
      setPasswordMessage("Kata sandi saat ini tidak benar.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) setPasswordMessage(error.message);
    else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Kata sandi berhasil diubah.");
    }
  }

  function remove(t: Tx) {
    requestConfirmation(`Hapus ${t.category} ${rp(t.amount)}?`, async () => {
      const { error } = await supabase.from("transactions").delete().eq("id", t.id);
      if (error) setError(error.message);
      else setTxs((p) => p.filter((x) => x.id !== t.id));
    });
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

  function removeBudget(budget: Budget) {
    requestConfirmation(`Hapus anggaran ${budget.category} ${MONTH_NAMES[budget.month - 1]} ${budget.year}?`, async () => {
      const { error } = await supabase
        .from("category_budgets")
        .delete()
        .eq("category", budget.category)
        .eq("month", budget.month)
        .eq("year", budget.year);
      if (error) setError(error.message);
      else await load();
    });
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

  function removeWish(wish: Wish) {
    requestConfirmation(`Hapus "${wish.name}" dari Wish List?`, async () => {
      const { error } = await supabase.from("wish_list").delete().eq("id", wish.id);
      if (error) setError(error.message);
      else setWishes((items) => items.filter((item) => item.id !== wish.id));
    });
  }

  async function completeWish(wish: Wish) {
    const { error } = await supabase.from("wish_list")
      .update({ completed_at: new Date().toISOString(), completed_amount: wish.target_amount })
      .eq("id", wish.id);
    if (error) setError(error.message);
    else await load();
  }

  async function reopenWish(wish: Wish) {
    const { error } = await supabase.from("wish_list")
      .update({ completed_at: null, completed_amount: null })
      .eq("id", wish.id);
    if (error) setError(error.message);
    else await load();
  }

  const uname = username || (session.user.email ?? "").split("@")[0];
  const displayRp = (amount: number) => showBalances ? rp(amount) : "••••••";
  const balanceVisibilityButton = (
    <button
      type="button"
      className="balance-visibility-toggle"
      onClick={() => setShowBalances((visible) => !visible)}
      aria-label={showBalances ? "Sembunyikan saldo" : "Tampilkan saldo"}
      aria-pressed={!showBalances}
      title={showBalances ? "Sembunyikan saldo" : "Tampilkan saldo"}
    >
      <Icon n={showBalances ? "eye" : "eye-off"} />
    </button>
  );
  function requestConfirmation(message: string, onConfirm: () => void) {
    setConfirmation({ message, onConfirm });
  }
  useEffect(() => {
    if (!confirmation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmation(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmation]);
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
    t.type === "out" &&
    t.date >= budgetDateRange.from && t.date <= budgetDateRange.to &&
    (budgetFilter === "all" || t.category === budgetFilter),
  );
  const chartBudgets = budgets.filter((budget) => budget.month === viewBudgetMonth && budget.year === viewBudgetYear && (budgetFilter === "all" || budget.category === budgetFilter));
  const budgetByCategory = chartBudgets.reduce(
    (totals, budget) => totals.set(budget.category, (totals.get(budget.category) ?? 0) + budget.amount),
    new Map<string, number>(),
  );
  const spentByCategory = chartTransactions.reduce(
    (totals, transaction) => {
      return totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
    },
    new Map<string, number>(),
  );
  const budgetChart = Array.from(new Set([...budgetByCategory.keys(), ...spentByCategory.keys()]))
    .map((name) => ({ name, budget: budgetByCategory.get(name) ?? 0, spent: spentByCategory.get(name) ?? 0 }))
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);
  const budgetChartBudgetTotal = budgetChart.reduce((sum, item) => sum + item.budget, 0);
  const budgetChartSpentTotal = budgetChart.reduce((sum, item) => sum + item.spent, 0);
  const renderBudgetCategories = (items: typeof budgetChart) => items.map((item) => {
    const index = budgetChart.indexOf(item);
    return (
      <span className="budget-chart-category" key={item.name}>
        <i style={{ background: categoryColor(index) }} />
        <span>{item.name}</span>
        <b>{displayRp(item.spent)} / {displayRp(item.budget)}</b>
      </span>
    );
  });
  const selectedBudgetCategory = type === "out" ? category : undefined;
  const selectedCategoryBudget = selectedBudgetCategory
    ? budgets.find((b) => b.category === selectedBudgetCategory && b.month === Number(date.slice(5, 7)) && b.year === Number(date.slice(0, 4)))
    : undefined;
  const selectedCategorySpent = selectedCategoryBudget
    ? expenseForCategoryInRange(selectedBudgetCategory ?? selectedCategoryBudget.category, budgetRange(selectedCategoryBudget.month, selectedCategoryBudget.year).from, budgetRange(selectedCategoryBudget.month, selectedCategoryBudget.year).to)
    : 0;
  const selectedCategoryPct = selectedCategoryBudget ? Math.min(100, (selectedCategorySpent / selectedCategoryBudget.amount) * 100) : 0;
  const activeWishes = wishes.filter((wish) => !wish.completed_at);
  const completedWishes = wishes.filter((wish) => !!wish.completed_at);
  const miniSeries = useMemo(() => {
    const byMonth = new Map<string, { bulan: string; Pemasukan: number; Pengeluaran: number }>();
    txs.forEach((transaction) => {
      const key = transaction.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, { bulan: monthLabel(key, true), Pemasukan: 0, Pengeluaran: 0 });
      const row = byMonth.get(key)!;
      if (transaction.type === "in") row.Pemasukan += transaction.amount;
      if (transaction.type === "out") row.Pengeluaran += transaction.amount;
    });
    const [year, selectedMonth] = month.split("-").map(Number);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(year, selectedMonth - 6 + index, 1);
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      return byMonth.get(key) ?? { bulan: monthLabel(key, true), Pemasukan: 0, Pengeluaran: 0 };
    });
  }, [txs, month]);
  const balanceSummary = (
    <>
      <section className="card balance-group">
        <h2>Saldo saat ini</h2>
        <div className="pcard">
          <div className="balance-visibility-heading"><small>Total saldo dompet</small>{balanceVisibilityButton}</div>
          <div className="big">{displayRp(saldo)}</div>
          <div className="row"><span>{uname}</span><span>{monthLabel(month, true)}</span></div>
        </div>
        <h3>Dompet</h3>
        {regularWalletEntries.length ? regularWalletEntries.map((w) => (
          <div className="wallet-entry" key={w.id}>
            <div><strong>{w.name}</strong><small>{w.kind}{w.archived ? " · Dompet dihapus" : ""}</small></div>
            <b>{displayRp(w.bal)}</b>
          </div>
        )) : <p className="empty">Belum ada dompet aktif.</p>}
        {unassignedWalletBalance !== 0 && <div className="wallet-entry"><div><strong>Tanpa dompet</strong><small>Transaksi yang belum dipasangkan ke dompet</small></div><b>{displayRp(unassignedWalletBalance)}</b></div>}
        {!!archivedRegularBalances.length && <>
          <h3 className="archived-wallet-title">Dompet dihapus</h3>
          {archivedRegularBalances.map((w) => <div className="wallet-entry archived-wallet-entry" key={w.id}><div><strong>{w.name}</strong><small>Riwayat dipertahankan</small></div><b>{displayRp(w.bal)}</b></div>)}
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
          <PeriodOptionPicker
            id="cat"
            label="Kategori"
            className="transaction-category-select"
            value={category}
            options={[
              ...(editId && !(type === "in" ? incomeCategories : expenseCategories).includes(category) ? [{ label: category, value: category }] : []),
              ...(type === "in" ? incomeCategories : expenseCategories).map((item) => ({ label: item, value: item })),
            ]}
            onChange={setCategory}
          />
          {type === "out" && selectedCategoryBudget && (
            <div className="category-budget-hint">
              <div className="bar" role="progressbar" aria-valuenow={Math.round(selectedCategoryPct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Anggaran ${category}`}>
                <i className={selectedCategorySpent > selectedCategoryBudget.amount ? "over" : ""} style={{ width: `${selectedCategoryPct}%` }} />
              </div>
              <small>Sisa anggaran {MONTH_NAMES[selectedCategoryBudget.month - 1]}: {displayRp(Math.max(0, selectedCategoryBudget.amount - selectedCategorySpent))} dari {displayRp(selectedCategoryBudget.amount)}</small>
            </div>
          )}
          {type === "out" && !selectedCategoryBudget && <small className="category-budget-empty">Belum ada anggaran untuk kategori ini pada bulan transaksi.</small>}
        </div>}
        {type === "out" && <div className="field">
          <label htmlFor="transaction-wishlist">Wish List (opsional)</label>
          <PeriodOptionPicker
            id="transaction-wishlist"
            label="Wish List (opsional)"
            className="transaction-wishlist-select"
            value={transactionWishId}
            options={[
              { label: "Tidak terkait Wish List", value: "" },
              ...wishes.filter((wish) => !wish.completed_at || wish.id === transactionWishId).map((wish) => ({
                label: `${wish.name} · Target ${displayRp(wish.target_amount)}${wish.completed_at ? " (Selesai)" : ""}`,
                value: wish.id,
              })),
            ]}
            onChange={setTransactionWishId}
          />
          {transactionWishId && <small className="category-budget-empty">Saat pengeluaran disimpan, Wish List akan ditandai selesai dengan nominal transaksi sebagai harga pembelian.</small>}
        </div>}
        <div className="field">
          <label htmlFor="note">Catatan</label>
          <input id="note" placeholder="mis. bensin, maksi" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {type === "transfer" ? <>
          <div className="field">
            <label htmlFor="wallet-from">Dompet asal</label>
            <PeriodOptionPicker
              id="wallet-from"
              label="Pilih dompet asal"
              className="wallet-from-select"
              value={walletId}
              options={[
                { label: "Pilih dompet asal", value: "" },
                ...activeWallets.map((wallet) => ({ label: wallet.name, value: wallet.id })),
              ]}
              onChange={(sourceId) => {
                setWalletId(sourceId);
                if (sourceId === walletToId) setWalletToId(activeWallets.find((wallet) => wallet.id !== sourceId)?.id ?? "");
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="wallet-to">Dompet tujuan</label>
            <PeriodOptionPicker
              id="wallet-to"
              label="Pilih dompet tujuan"
              className="wallet-to-select"
              value={walletToId}
              options={[
                { label: "Pilih dompet tujuan", value: "" },
                ...activeWallets.filter((wallet) => wallet.id !== walletId).map((wallet) => ({ label: wallet.name, value: wallet.id })),
              ]}
              onChange={setWalletToId}
            />
          </div>
          {activeWallets.length < 2 && <p className="category-budget-empty transfer-wallet-hint">Buat minimal dua dompet aktif sebelum memindahkan dana.</p>}
        </> : <div className="field">
          <label htmlFor="wal">Dompet</label>
          <PeriodOptionPicker
            id="wal"
            label="Dompet"
            className="transaction-wallet-select"
            value={walletId}
            options={[
              { label: "Pilih dompet", value: "" },
              ...wallets.filter((wallet) => !wallet.archived_at || wallet.id === walletId).map((wallet) => ({
                label: `${wallet.name}${wallet.archived_at ? " (Dompet dihapus)" : ""}`,
                value: wallet.id,
              })),
            ]}
            onChange={setWalletId}
          />
        </div>}
        <button className="btn" disabled={saving || (type === "transfer" && activeWallets.length < 2)}>{saving ? "Menyimpan..." : editId ? "Simpan perubahan" : type === "transfer" ? "Simpan pindah dana" : "Simpan transaksi"}</button>
        {editId && <button type="button" className="btn ghost" style={{ marginTop: 8, width: "100%" }} onClick={resetForm}>Batal</button>}
      </form>
    </section>
  );

  return (
    <div className={`shell ${nav === "anggaran" || nav === "wishlist" ? "budget-shell" : ""} ${nav === "catat-transaksi" || nav === "dompet" || nav === "wishlist" ? "transaction-shell" : ""}`}>
      {nav !== "anggaran" && nav !== "catat-transaksi" && nav !== "dompet" && nav !== "wishlist" && <aside className="side">
        <div className="profile">
          <div className="avatar" aria-hidden="true">{(uname[0] ?? "?").toUpperCase()}</div>
          <b>{uname}</b>
        </div>
        <nav className="navlist" aria-label="Menu utama">
          {NAV_GROUPS.map((group) => (
            <div className="navgroup" key={group.label}>
              {group.label && <b className="navgroup-title">{group.label}</b>}
              <div className="navitems">
                {group.items.map((item) => (
                  <button key={item.id} type="button" aria-current={nav === item.id} onClick={() => navigate(item.id)}>
                    <Icon n={item.icon} /><span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>}

      <main key={nav} className={`main ${nav === "anggaran" ? "budget-page" : ""} ${nav === "catat-transaksi" ? "transaction-page" : ""} ${nav === "dompet" ? "wallet-page" : ""} ${nav === "wishlist" ? "wishlist-page" : ""} ${nav === "pengaturan" ? "category-page" : ""}`}>
        {nav === "anggaran" ? (
          <header className="budget-page-header">
            <button className="budget-back" type="button" onClick={goBack} aria-label="Kembali ke halaman sebelumnya">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <h1>Anggaran</h1>
            <button className="budget-add" type="button" onClick={openNewBudget} aria-label="Tambah anggaran">+</button>
          </header>
        ) : nav === "wishlist" ? (
          <header className="transaction-page-header wishlist-page-header">
            <button className="budget-back" type="button" onClick={goBack} aria-label="Kembali ke halaman sebelumnya">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <h1>Wish List</h1>
            <button className="budget-add" type="button" onClick={() => { setWishEditing(null); setWishName(""); setWishAmount(""); setWishFormOpen(true); }} aria-label="Tambah Wish List">+</button>
          </header>
        ) : nav === "catat-transaksi" || nav === "dompet" ? (
          <header className="transaction-page-header">
            <button className="budget-back" type="button" onClick={goBack} aria-label="Kembali ke halaman sebelumnya">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <h1>{nav === "catat-transaksi" ? "Catat Transaksi" : "Dompet"}</h1>
          </header>
        ) : <header className="home-header">
          <div>
            {nav === "beranda"
              ? <div className="greeting">Selamat {sapa}, {uname}</div>
              : <h1>{nav === "kelola-uang" ? "Transaksi" : nav === "catat-transaksi" ? "Catat Transaksi" : nav === "wishlist" ? "Wish List" : nav === "statistik" ? "Statistik" : nav === "ubah-password" ? "Ubah kata sandi" : "Kategori"}</h1>}
          </div>
          <div className="home-header-actions">
            {nav === "beranda" && <div className="period-picker">
              <PeriodOptionPicker
                label="Pilih bulan"
                className="period-month"
                value={month.slice(5, 7)}
                options={MONTH_NAMES.map((name, index) => ({ label: name, value: pad(index + 1) }))}
                onChange={(selectedMonth) => setMonth(`${month.slice(0, 4)}-${selectedMonth}`)}
              />
              <PeriodOptionPicker
                label="Pilih tahun"
                className="period-year"
                value={month.slice(0, 4)}
                options={transactionYears.map((year) => ({ label: String(year), value: String(year) }))}
                onChange={(selectedYear) => setMonth(`${selectedYear}-${month.slice(5, 7)}`)}
              />
            </div>}
            <details className="account-menu" onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) event.currentTarget.open = false;
            }}>
              <summary className="icon-button" aria-label="Menu akun" title="Menu akun"><Icon n="account" /></summary>
              <div className="account-dropdown">
                <div className="account-identity">
                  <small>Akun</small>
                  <strong>{uname}</strong>
                </div>
                <button type="button" onClick={() => { setPasswordMessage(""); navigate("ubah-password"); }}>
                  <span>Kata sandi</span><small>Ubah kata sandi</small>
                </button>
                <button type="button" className="account-theme-toggle" onClick={() => setDarkMode((enabled) => !enabled)}>
                  {darkMode ? "Mode terang" : "Mode gelap"}
                </button>
                <button className="account-signout" type="button" onClick={() => supabase.auth.signOut()}>
                  Keluar
                </button>
              </div>
            </details>
          </div>
        </header>}

        {error && <p className="err" role="alert">{error}</p>}

        {nav === "anggaran" && <>
          <div className="budget-month-picker" aria-label="Pilih bulan anggaran">
            <PeriodOptionPicker
              label="Bulan anggaran"
              className="budget-month-select"
              value={String(viewBudgetMonth)}
              options={MONTH_NAMES.map((name, index) => ({ label: name, value: String(index + 1) }))}
              onChange={(selectedMonth) => setViewBudgetMonth(Number(selectedMonth))}
            />
            <PeriodOptionPicker
              label="Tahun anggaran"
              className="budget-year-select"
              value={String(viewBudgetYear)}
              options={YEAR_OPTIONS.map((year) => ({ label: year, value: year }))}
              onChange={(year) => setViewBudgetYear(Number(year))}
            />
          </div>
          <section className="budget-overview">
            <div className="budget-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={budgetChart.filter((item) => item.spent > 0)} dataKey="spent" nameKey="name" innerRadius="80%" outerRadius="94%" paddingAngle={2} stroke="none">
                    {budgetChart.filter((item) => item.spent > 0).map((item) => (
                      <Cell key={item.name} fill={categoryColor(budgetChart.findIndex((row) => row.name === item.name))} />
                    ))}
                  </Pie>
                  <Pie data={budgetChart.filter((item) => item.budget > 0)} dataKey="budget" nameKey="name" innerRadius="62%" outerRadius="76%" paddingAngle={2} stroke="none">
                    {budgetChart.filter((item) => item.budget > 0).map((item) => (
                      <Cell key={item.name} fill={categoryColor(budgetChart.findIndex((row) => row.name === item.name))} fillOpacity={0.55} />
                    ))}
                  </Pie>
                  {budgetChartSpentTotal === 0 && <Pie data={[{ name: "Tidak ada pengeluaran", value: 1 }]} dataKey="value" innerRadius="80%" outerRadius="94%" stroke="none"><Cell fill="#e9eaf2" /></Pie>}
                  {budgetChartBudgetTotal === 0 && <Pie data={[{ name: "Belum ada anggaran", value: 1 }]} dataKey="value" innerRadius="62%" outerRadius="76%" stroke="none"><Cell fill="#d9dbe8" /></Pie>}
                  <Tooltip formatter={(value: number) => displayRp(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="budget-chart-legend budget-chart-legend-left">{renderBudgetCategories(budgetChart.filter((_, index) => index % 2 === 0))}</div>
            <div className="budget-chart-legend budget-chart-legend-right">{renderBudgetCategories(budgetChart.filter((_, index) => index % 2 === 1))}</div>
            {budgetChart.length === 0 && <p className="empty budget-chart-empty">Belum ada anggaran atau pengeluaran pada bulan ini.</p>}
            <div className="budget-chart-summary">
              <div><span>Realisasi</span><strong>{displayRp(budgetChartSpentTotal)}</strong></div>
              <div><span>Anggaran</span><strong>{displayRp(budgetChartBudgetTotal)}</strong></div>
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
                    <strong>{displayRp(budget.used)} <small>/ {displayRp(budget.amount)}</small></strong>
                  </div>
                  <div className="bar" role="progressbar" aria-valuenow={Math.round(budget.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${budget.category} ${MONTH_NAMES[budget.month - 1]} ${budget.year}`}>
                    <i className={over ? "over" : budget.kind === "target" && budget.used >= budget.amount ? "done" : ""} style={{ width: `${budget.pct}%` }} />
                  </div>
                  <div className="budget-entry-footer">
                    <span className={over ? "budget-alert" : ""}>{over ? `Melewati batas ${displayRp(budget.used - budget.amount)}` : near ? "Hampir mencapai batas" : budget.kind === "target" && budget.used >= budget.amount ? "Target tercapai" : `Sisa ${displayRp(Math.max(0, budget.amount - budget.used))}`}</span>
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
                  <PeriodOptionPicker
                    id="budget-category"
                    label="Kategori pengeluaran"
                    className="budget-category-select"
                    value={budgetCategory}
                    options={[
                      ...(budgetEditing && !expenseCategories.includes(budgetEditing.category) ? [{ label: budgetEditing.category, value: budgetEditing.category }] : []),
                      ...expenseCategories.map((item) => ({ label: item, value: item })),
                    ]}
                    disabled={!!budgetEditing}
                    onChange={setBudgetCategory}
                  />
                </div>
                <div className="field">
                  <label htmlFor="budget-month">Bulan</label>
                  <PeriodOptionPicker
                    id="budget-month"
                    label="Bulan anggaran"
                    className="budget-form-month-select"
                    value={String(budgetMonth)}
                    options={MONTH_NAMES.map((name, index) => ({ label: name, value: String(index + 1) }))}
                    disabled={!!budgetEditing}
                    onChange={(selectedMonth) => setBudgetMonth(Number(selectedMonth))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="budget-year">Tahun</label>
                  <PeriodOptionPicker
                    id="budget-year"
                    label="Tahun anggaran"
                    className="budget-form-year-select"
                    value={String(budgetYear)}
                    options={YEAR_OPTIONS.map((year) => ({ label: year, value: year }))}
                    disabled={!!budgetEditing}
                    onChange={(year) => setBudgetYear(Number(year))}
                  />
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

        {nav === "beranda" && <div className="home-dashboard">
        <section className="home-balance">
          <div className="balance-heading"><span>Saldo saat ini</span><small>{monthLabel(month)}</small>{balanceVisibilityButton}</div>
          <strong>{displayRp(saldo)}</strong>
          <span className="balance-caption">Ringkasan keuanganmu, diperbarui dari transaksi tercatat</span>
        </section>

        <div className="home-totals">
          <section className="total-tile income-tile">
            <span className="total-icon"><Icon n="trend-up" /></span><span>Pemasukan bulan ini</span>
            <strong>{displayRp(inM)}</strong>
          </section>
          <section className="total-tile expense-tile">
            <span className="total-icon"><Icon n="trend-down" /></span><span>Pengeluaran bulan ini</span>
            <strong>{displayRp(outM)}</strong>
          </section>
          <section className="total-tile net-tile">
            <span className="total-icon">≈</span><span>Arus kas bersih</span>
            <strong>{displayRp(inM - outM)}</strong>
          </section>
        </div>

        <nav className="home-shortcuts" aria-label="Pintasan">
          <button type="button" onClick={() => navigate("anggaran")}><span className="shortcut-icon budget-shortcut"><Icon n="budget" /></span>Anggaran</button>
          <button type="button" onClick={() => { setEditId(null); navigate("catat-transaksi"); }}><span className="shortcut-icon add-shortcut">+</span>Catat transaksi</button>
          <button type="button" onClick={() => navigate("dompet")}><span className="shortcut-icon wallet-shortcut"><Icon n="wallet" /></span>Dompet</button>
          <button type="button" onClick={() => navigate("wishlist")}><span className="shortcut-icon wishlist-shortcut"><Icon n="wishlist" /></span>Wish List</button>
        </nav>

        <section className="card home-chart">
          <div className="section-heading">
            <div><h2>Perkembangan arus kas</h2><small>Tren pemasukan dan pengeluaran</small></div>
            <button type="button" onClick={() => navigate("statistik")}>Lihat statistik</button>
          </div>
          {txs.length === 0 ? <p className="empty">Grafik akan muncul setelah ada transaksi.</p> : (
            <>
              <div className="legend row">
                <span><i style={{ background: "var(--in)" }} />Pemasukan</span>
                <span><i style={{ background: "var(--out)" }} />Pengeluaran</span>
              </div>
              <div className="mini-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={miniSeries}>
                    <defs>
                      <linearGradient id="income-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#35cfc8" stopOpacity={0.36} />
                        <stop offset="95%" stopColor="#35cfc8" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expense-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7382f4" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#7382f4" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(112, 139, 195, .2)" />
                    <XAxis dataKey="bulan" {...axis} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number) => displayRp(v)} />
                    <Area type="monotone" dataKey="Pemasukan" stroke="#35cfc8" strokeWidth={3} fill="url(#income-glow)" dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="Pengeluaran" stroke="#7382f4" strokeWidth={3} fill="url(#expense-glow)" dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>

        <div className="home-grid">
          <section className="card home-budget">
            <div className="section-heading">
              <h2>Anggaran berjalan</h2>
              <button type="button" onClick={() => navigate("anggaran")}>Kelola</button>
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
                    <span className={over ? "budget-alert" : ""}>{over ? "Melewati batas" : near ? "Hampir mencapai batas" : `${displayRp(b.used)} / ${displayRp(b.amount)}`}</span>
                  </div>
                  <div className="bar" role="progressbar" aria-valuenow={Math.round(b.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Anggaran ${b.category}`}>
                    <i className={over ? "over" : b.kind === "target" && b.used >= b.amount ? "done" : ""} style={{ width: `${b.pct}%` }} />
                  </div>
                  <div className="msg">{b.kind === "target"
                    ? b.used >= b.amount ? "Target tercapai." : `Kurang ${displayRp(b.amount - b.used)} lagi.`
                    : over ? `Lewat ${displayRp(b.used - b.amount)} dari batas.` : `Sisa ${displayRp(b.amount - b.used)}.`}</div>
                </div>
              );
            })}
          </section>

        <section className="card recent-card" id="transaksi">
          <div className="section-heading recent-heading">
            <div><h2>Transaksi terbaru</h2><small>Aktivitas keuangan pada periode ini</small></div>
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
                  <div className="cat">{transactionCategory(t)}{t.note ? ` · ${t.note}` : ""}</div>
                  <div className="meta">{dateLabel(t.date)}{t.type === "transfer"
                    ? ` · ${transferWalletRoute(t)}`
                    : t.wallet_id ? ` · ${wallets.find((w) => w.id === t.wallet_id)?.name ?? ""}${wallets.find((w) => w.id === t.wallet_id)?.archived_at ? " (Dompet sudah dihapus)" : ""}` : ""}</div>
                </div>
                <div className={`amt ${t.type === "transfer" ? "" : t.type}`}>{t.type === "transfer" ? displayRp(t.amount) : `${t.type === "in" ? "+" : "-"}${displayRp(t.amount)}`}</div>
                <span className="transaction-actions">
                  <button className="del" onClick={() => startEdit(t)}>Ubah</button>
                  <button className="del" onClick={() => remove(t)}>Hapus</button>
                </span>
              </div>
            ))
          )}
          {shown.length > 5 && <button className="btn ghost see-all" onClick={() => setMore(!more)}>{more ? "Tampilkan lebih sedikit" : `Lihat semua (${shown.length})`}</button>}
        </section>
        </div>
        </div>}

        {nav !== "beranda" && nav !== "anggaran" && <>
        {!["kelola-uang", "catat-transaksi", "dompet", "wishlist", "statistik", "pengaturan", "ubah-password"].includes(nav) && <h2 className="page-section-title">Pengaturan akun</h2>}
        <div className={`cols ${nav === "kelola-uang" ? "manage-view" : nav === "catat-transaksi" ? "transaction-view" : nav === "dompet" ? "wallet-view" : nav === "wishlist" ? "wishlist-view" : nav === "statistik" ? "stats-view" : "settings-view"}`}>
          {nav === "kelola-uang" && <div className="transaction-history-page">
            <div className="transaction-summary">
              <section className="card transaction-summary-income">
                <span>Pemasukan</span>
                <strong>{displayRp(transactionIncomeTotal)}</strong>
              </section>
              <section className="card transaction-summary-expense">
                <span>Pengeluaran</span>
                <strong>{displayRp(transactionExpenseTotal)}</strong>
              </section>
            </div>
            <section className="card recent-card transaction-history-card">
              <div className="section-heading recent-heading">
                <div><h2>Riwayat transaksi</h2><small>{monthLabel(month)}</small></div>
                <div className="transaction-history-actions">
                  <PeriodOptionPicker
                    label="Pilih bulan transaksi"
                    className="transaction-filter-month"
                    value={month.slice(5, 7)}
                    options={MONTH_NAMES.map((name, index) => ({ label: name, value: pad(index + 1) }))}
                    onChange={(selectedMonth) => setMonth(`${month.slice(0, 4)}-${selectedMonth}`)}
                  />
                  <PeriodOptionPicker
                    label="Pilih tahun transaksi"
                    className="transaction-filter-year"
                    value={month.slice(0, 4)}
                    options={transactionYears.map((year) => ({ label: String(year), value: String(year) }))}
                    onChange={(selectedYear) => setMonth(`${selectedYear}-${month.slice(5, 7)}`)}
                  />
                  <PeriodOptionPicker
                    label="Pilih kategori transaksi"
                    className="transaction-filter-category"
                    value={transactionCategoryFilter}
                    options={[
                      { label: "Semua kategori", value: "all" },
                      ...transactionCategories.map((categoryName) => ({ label: categoryName, value: categoryName })),
                    ]}
                    onChange={setTransactionCategoryFilter}
                  />
                  <label className="recent-search">
                    <span className="sr">Cari transaksi</span>
                    <input placeholder="Cari transaksi" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <Icon n="search" />
                  </label>
                </div>
              </div>
              <button className="btn transaction-add-button" type="button" onClick={() => { resetForm(); navigate("catat-transaksi"); }}>+ Catat transaksi</button>
              {loading ? (
                <p className="empty">Memuat...</p>
              ) : transactionRows.length === 0 ? (
                <p className="empty">{search || transactionCategoryFilter !== "all" ? "Tidak ada transaksi yang sesuai dengan pilihan." : "Belum ada transaksi untuk periode ini."}</p>
              ) : transactionRows.map((t) => (
                <div className="tx" key={t.id}>
                  <div>
                    <div className="cat">{transactionCategory(t)}{t.note ? ` · ${t.note}` : ""}</div>
                    <div className="meta">{dateLabel(t.date)}{t.type === "transfer"
                      ? ` · ${transferWalletRoute(t)}`
                      : t.wallet_id ? ` · ${wallets.find((w) => w.id === t.wallet_id)?.name ?? ""}${wallets.find((w) => w.id === t.wallet_id)?.archived_at ? " (Dompet sudah dihapus)" : ""}` : ""}</div>
                  </div>
                  <div className={`amt ${t.type === "transfer" ? "" : t.type}`}>{t.type === "transfer" ? displayRp(t.amount) : `${t.type === "in" ? "+" : "-"}${displayRp(t.amount)}`}</div>
                  <span className="transaction-actions">
                    <button className="del" onClick={() => startEdit(t)}>Ubah</button>
                    <button className="del" onClick={() => remove(t)}>Hapus</button>
                  </span>
                </div>
              ))}
            </section>
          </div>}

  {nav === "catat-transaksi" && <>{balanceSummary}{transactionEntry}</>}

  {nav === "dompet" && <>
    <section className="card wallet-balance-panel">
      <div className="wallet-section-heading">
        <div><h2>Ringkasan saldo</h2><small>Saldo total mencakup transaksi yang belum dipasangkan ke dompet.</small></div>
      </div>
      <div className="pcard">
        <div className="balance-visibility-heading"><small>Total saldo</small>{balanceVisibilityButton}</div>
        <div className="big">{displayRp(saldo)}</div>
        <span>Perubahan bersih dari seluruh transaksi</span>
      </div>
      <h3>Dompet</h3>
      {regularWalletEntries.length ? regularWalletEntries.map((w) => {
        const walletTransactions = txs.filter((transaction) => transaction.wallet_id === w.id || transaction.wallet_to_id === w.id);
        return <div className="wallet-record" key={w.id}>
          <article className="wallet-entry">
            <div><strong>{w.name}</strong><small>{w.kind}</small></div>
            <b className={`wallet-entry-value${w.bal < 0 ? " negative" : ""}`}>{displayRp(w.bal)}</b>
            <div className="wallet-entry-actions">
              <button type="button" className="wallet-edit" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) startEditWallet(wallet); }}>Ubah</button>
              <button type="button" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) archiveWallet(wallet); }}>Hapus</button>
            </div>
          </article>
          <details className="wallet-transaction-history">
            <summary>Riwayat transaksi ({walletTransactions.length})</summary>
            {walletTransactions.length ? walletTransactions.map((transaction) => (
              <div className="tx" key={transaction.id}>
                <div>
                  <div className="cat">{transactionCategory(transaction)}{transaction.note ? ` · ${transaction.note}` : ""}</div>
                  <div className="meta">{dateLabel(transaction.date)}{transaction.type === "transfer" ? ` · ${transferWalletRoute(transaction)}` : ""}</div>
                </div>
                <div className={`amt ${transaction.type === "transfer" ? "" : transaction.type}`}>
                  {transaction.type === "transfer" ? displayRp(transaction.amount) : `${transaction.type === "in" ? "+" : "-"}${displayRp(transaction.amount)}`}
                </div>
                <span className="transaction-actions">
                  <button className="del" type="button" onClick={() => startEdit(transaction)}>Ubah</button>
                  <button className="del" type="button" onClick={() => remove(transaction)}>Hapus</button>
                </span>
              </div>
            )) : <p className="empty">Belum ada transaksi di dompet ini.</p>}
          </details>
        </div>;
      }) : <p className="empty">Belum ada dompet aktif.</p>}
      {unassignedWalletBalance !== 0 && <div className="wallet-entry unassigned-wallet-entry"><div><strong>Tanpa dompet</strong><small>Transaksi yang belum dipasangkan ke dompet</small></div><b className={`wallet-entry-value${unassignedWalletBalance < 0 ? " negative" : ""}`}>{displayRp(unassignedWalletBalance)}</b></div>}
      {!!archivedRegularBalances.length && <>
        <h3 className="archived-wallet-title">Dompet dihapus</h3>
        {archivedRegularBalances.map((w) => (
          <article className="wallet-entry archived-wallet-entry" key={w.id}>
            <div><strong>{w.name}</strong><small>Riwayat transaksi tetap tersimpan</small></div>
            <b className={`wallet-entry-value${w.bal < 0 ? " negative" : ""}`}>{displayRp(w.bal)}</b>
            <div className="archived-wallet-actions">
              <button type="button" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) restoreWallet(wallet); }}>Pulihkan</button>
              <button type="button" className="wallet-permanent-delete" onClick={() => { const wallet = wallets.find((item) => item.id === w.id); if (wallet) permanentlyDeleteWallet(wallet); }}>Hapus permanen</button>
            </div>
          </article>
        ))}
      </>}
    </section>
    <section className="card wallet-add-card" id="wallet-form">
      <div className="wallet-section-heading">
        <div><h2>{walletEditing ? "Ubah dompet" : "Tambah dompet"}</h2><small>{walletEditing ? "Ubah nama atau jenis dompet. Saldo dihitung dari transaksi." : "Buat dompet untuk mengelompokkan transaksi."}</small></div>
      </div>
      <form onSubmit={addWallet}>
        <div className="field">
          <label htmlFor="new-wallet-name">Nama dompet</label>
          <input id="new-wallet-name" required placeholder="mis. BCA, GoPay, Tunai" value={newWallet.name} onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new-wallet-kind">Jenis dompet</label>
          <PeriodOptionPicker
            id="new-wallet-kind"
            label="Jenis dompet"
            className="wallet-kind-select"
            value={newWallet.kind}
            options={[
              ...Object.entries(KINDS).map(([kind, label]) => ({ label, value: kind })),
              ...(walletEditing?.kind === "investment" ? [{ label: "Dompet", value: "investment" }] : []),
            ]}
            onChange={(kind) => setNewWallet({ ...newWallet, kind: kind as keyof typeof KINDS | "investment" })}
          />
        </div>
        <button className="btn">{walletEditing ? "Simpan perubahan" : "Tambah dompet"}</button>
        {walletEditing && <button className="btn ghost wallet-edit-cancel" type="button" onClick={() => { setWalletEditing(null); setNewWallet({ name: "", kind: "cash" }); }}>Batal</button>}
      </form>
    </section>
  </>}

  {nav === "wishlist" && <>
    <section className="card wishlist-card">
      <div className="section-heading">
        <div><h2>Daftar keinginan</h2><small>Barang yang masih ingin kamu beli</small></div>
        <span className="wishlist-count">{activeWishes.length} aktif</span>
      </div>
      {activeWishes.length === 0
        ? <p className="empty">Belum ada barang aktif. Tambahkan barang yang ingin kamu beli.</p>
        : <div className="wishlist-grid">{activeWishes.map((wish) => (
          <article className="wishlist-entry" key={wish.id}>
            <div className="wishlist-item-details">
              <strong>{wish.name}</strong>
              <small>Target harga</small>
              <b>{displayRp(wish.target_amount)}</b>
            </div>
            <div className="wishlist-entry-actions">
              <button type="button" onClick={() => editWish(wish)}>Ubah</button>
              <button type="button" className="wishlist-complete" onClick={() => completeWish(wish)}>Selesai</button>
              <button type="button" className="wishlist-delete" onClick={() => removeWish(wish)}>Hapus</button>
            </div>
          </article>
        ))}</div>}
    </section>
    <section className="card wishlist-card wishlist-history">
      <div className="section-heading">
        <div><h2>Riwayat selesai</h2><small>Wish List yang sudah terpenuhi</small></div>
        <span className="wishlist-count">{completedWishes.length} selesai</span>
      </div>
      {completedWishes.length === 0
        ? <p className="empty">Barang yang ditandai selesai akan muncul di sini.</p>
        : <div className="wishlist-grid">{completedWishes.map((wish) => (
          <article className="wishlist-entry completed-wishlist-entry" key={wish.id}>
            <div className="wishlist-item-details">
              <strong>{wish.name}</strong>
              <small>Selesai {wish.completed_at ? dateLabel(wish.completed_at.slice(0, 10)) : ""}</small>
              <span>Target {displayRp(wish.target_amount)}</span>
              <b>Harga pembelian {displayRp(wish.completed_amount ?? wish.target_amount)}</b>
            </div>
            <div className="wishlist-entry-actions">
              <button type="button" onClick={() => reopenWish(wish)}>Aktifkan lagi</button>
              <button type="button" className="wishlist-delete" onClick={() => removeWish(wish)}>Hapus</button>
            </div>
          </article>
        ))}</div>}
    </section>
  </>}

          {nav === "statistik" && <div className="report-page" id="statistik">
            <section className="card report-controls">
              <div className="budget-period-tabs" role="tablist" aria-label="Skala laporan">
                <button type="button" role="tab" aria-selected={reportScale === "monthly"} onClick={() => setReportScale("monthly")}>Bulanan</button>
                <button type="button" role="tab" aria-selected={reportScale === "yearly"} onClick={() => setReportScale("yearly")}>Tahunan</button>
              </div>
              <div className="report-date-controls">
                {reportScale === "monthly" && <PeriodOptionPicker
                  label="Pilih bulan laporan"
                  className="report-month-select"
                  value={month.slice(5, 7)}
                  options={MONTH_NAMES.map((name, index) => ({ label: name, value: pad(index + 1) }))}
                  onChange={(selectedMonth) => setMonth(`${month.slice(0, 4)}-${selectedMonth}`)}
                />}
                <PeriodOptionPicker
                  label="Pilih tahun laporan"
                  className="report-year-select"
                  value={String(reportYear)}
                  options={Array.from(new Set([...transactionYears, reportYear])).sort((a, b) => b - a).map((year) => ({ label: String(year), value: String(year) }))}
                  onChange={(selectedYear) => setMonth(`${selectedYear}-${month.slice(5, 7)}`)}
                />
              </div>
            </section>

            <div className="report-summary">
              <section className="card report-income"><span>Total pemasukan</span><strong>{displayRp(reportIncome)}</strong></section>
              <section className="card report-expense"><span>Total pengeluaran</span><strong>{displayRp(reportExpense)}</strong></section>
              <section className="card report-net"><span>Selisih</span><strong>{displayRp(reportIncome - reportExpense)}</strong></section>
              <section className="card report-saving"><span>Rasio tersisa</span><strong>{reportIncome > 0 ? `${Math.round(((reportIncome - reportExpense) / reportIncome) * 100)}%` : "—"}</strong></section>
            </div>

            <section className="card">
              <div className="section-heading">
                <div><h2>Arus kas</h2><small>{reportScale === "yearly" ? `Per bulan · ${reportYear}` : `Per hari · ${monthLabel(month)}`}</small></div>
                <div className="report-period-nav" aria-label="Navigasi periode grafik">
                  <button type="button" className="icon-button" aria-label={reportScale === "yearly" ? "Tahun sebelumnya" : "Bulan sebelumnya"} onClick={() => shiftReportPeriod(-1)}>‹</button>
                  <button type="button" className="icon-button" aria-label={reportScale === "yearly" ? "Tahun berikutnya" : "Bulan berikutnya"} onClick={() => shiftReportPeriod(1)}>›</button>
                </div>
              </div>
              <div className="legend row">
                <span><i style={{ background: "var(--in)" }} />Pemasukan</span>
                <span><i style={{ background: "var(--out)" }} />Pengeluaran</span>
              </div>
              <div className="report-chart-scroll" tabIndex={0} aria-label="Grafik arus kas, dapat digeser ke samping">
                <div className="report-chart">
                  <ResponsiveContainer>
                    <LineChart data={reportChart}>
                      <CartesianGrid vertical={false} stroke="#dce5f5" />
                      <XAxis dataKey="bulan" {...axis} interval={reportScale === "monthly" ? 4 : 0} />
                      <YAxis {...axis} width={54} tickFormatter={(value: number) => `${Math.round(value / 1000)}rb`} />
                      <Tooltip formatter={(value: number) => displayRp(value)} />
                      <Line type="monotone" dataKey="Pemasukan" stroke="#35cfc8" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="Pengeluaran" stroke="#7382f4" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <div className="report-analysis-grid">
              <section className="card">
                <h2>Pengeluaran per kategori</h2>
                {!reportCategories.length ? <p className="empty">Belum ada pengeluaran pada periode ini.</p> : <>
                  <div className="donut">
                    <div className="donut-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={reportCategories} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="94%" paddingAngle={2} stroke="none" cornerRadius={6}>
                            {reportCategories.map((item, index) => <Cell key={item.name} fill={categoryColor(index)} />)}
                          </Pie>
                          <Tooltip formatter={(value: number) => displayRp(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-mid"><b>{reportTopCategoryPercent}%</b><small>{reportTopCategory?.name}</small></div>
                    </div>
                    <div className="legend">
                      {reportCategories.map((category, index) => <span key={category.name}><i style={{ background: categoryColor(index) }} />{category.name} · {displayRp(category.value)}</span>)}
                    </div>
                  </div>
                  <p className="report-largest">Pengeluaran terbesar: <strong>{reportTopCategory?.name}</strong> ({displayRp(reportTopCategory?.value ?? 0)})</p>
                </>}
              </section>

              <section className="card">
                <h2>Anggaran vs realisasi</h2>
                <small>{reportScale === "yearly" ? `Anggaran bulanan dijumlahkan untuk ${reportYear}` : monthLabel(month)}</small>
                {!reportBudgetRows.length ? <p className="empty">Belum ada anggaran atau pengeluaran pada periode ini.</p> : reportBudgetRows.map((row) => {
                  const over = row.budget > 0 && row.spent > row.budget;
                  const percent = row.budget > 0 ? Math.min(100, row.spent / row.budget * 100) : row.spent > 0 ? 100 : 0;
                  return <div className="report-budget-row" key={row.category}>
                    <div className="budget-entry-heading">
                      <strong>{row.category}</strong>
                      <strong>{displayRp(row.spent)} <small>/ {displayRp(row.budget)}</small></strong>
                    </div>
                    <div className="bar" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`Realisasi anggaran ${row.category}`}>
                      <i className={over ? "over" : ""} style={{ width: `${percent}%` }} />
                    </div>
                  </div>;
                })}
              </section>
            </div>
          </div>}

          {nav === "pengaturan" && (() => {
            const isIncome = categoryKind === "income";
            const categories = isIncome ? incomeCategories : expenseCategories;
            const categoryLabel = isIncome ? "pemasukan" : "pengeluaran";
            return <section className="card category-settings category-manager">
              <div className="category-kind-tabs" role="group" aria-label="Jenis kategori">
                <button
                  type="button"
                  className={isIncome ? "income active" : "income"}
                  aria-pressed={isIncome}
                  onClick={() => setCategoryKind("income")}
                >
                  Pemasukan
                </button>
                <button
                  type="button"
                  className={!isIncome ? "expense active" : "expense"}
                  aria-pressed={!isIncome}
                  onClick={() => setCategoryKind("expense")}
                >
                  Pengeluaran
                </button>
              </div>
              <div className="category-manager-heading">
                <div className={`category-manager-icon ${isIncome ? "income-category-icon" : "expense-category-icon"}`} aria-hidden="true">
                  <Icon n={isIncome ? "trend-up" : "trend-down"} />
                </div>
                <div className="category-manager-title">
                  <h2>Kategori {categoryLabel}</h2>
                  <small>Kelola kategori yang tersedia saat mencatat {categoryLabel}.</small>
                </div>
                <span className="category-count">{categories.length} kategori</span>
              </div>
              <form className="category-add-form" onSubmit={isIncome ? addIncomeCategory : addExpenseCategory}>
                <input
                  aria-label={`Nama kategori ${categoryLabel} baru`}
                  placeholder="Nama kategori baru"
                  value={isIncome ? newIncomeCategory : newExpenseCategory}
                  onChange={(event) => isIncome ? setNewIncomeCategory(event.target.value) : setNewExpenseCategory(event.target.value)}
                />
                <button className="btn" type="submit">Tambah kategori</button>
              </form>
              <div className="category-list" aria-label={`Daftar kategori ${categoryLabel}`}>
                {categories.map((item) => (
                  <div className="category-list-item" key={item}>
                    <span>{item}</span>
                    <button
                      type="button"
                      title={`Hapus kategori ${item}`}
                      onClick={() => isIncome ? removeIncomeCategory(item) : removeExpenseCategory(item)}
                      aria-label={`Hapus kategori ${categoryLabel} ${item}`}
                    >
                      <span aria-hidden="true">×</span>
                      <span className="sr">Hapus</span>
                    </button>
                  </div>
                ))}
                {categories.length === 0 && <p className="category-empty">Belum ada kategori {categoryLabel}. Tambahkan kategori baru di atas.</p>}
              </div>
            </section>;
          })()}

          {nav === "ubah-password" && <div className="col">
            <section className="card" id="ubah-password">
              <h2>Ubah kata sandi</h2>
              <p className="note">Akun: {session.user.email ?? uname}</p>
              <form onSubmit={changePassword}>
                <div className="field">
                  <PasswordField id="current-password" label="Kata sandi saat ini" autoComplete="current-password" required value={currentPassword} onChange={setCurrentPassword} />
                </div>
                <div className="field">
                  <PasswordField id="new-password" label="Kata sandi baru" autoComplete="new-password" minLength={6} required value={newPassword} onChange={setNewPassword} />
                </div>
                <div className="field">
                  <PasswordField id="confirm-password" label="Konfirmasi kata sandi baru" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={setConfirmPassword} />
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

        {confirmation && <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null); }}>
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
            <div className="confirmation-mark" aria-hidden="true">!</div>
            <h2 id="confirmation-title">Konfirmasi tindakan</h2>
            <p id="confirmation-message">{confirmation.message}</p>
            <div className="confirmation-actions">
              <button type="button" className="btn ghost" onClick={() => setConfirmation(null)}>Batal</button>
              <button type="button" className="btn confirmation-submit" onClick={() => {
                const action = confirmation.onConfirm;
                setConfirmation(null);
                void action();
              }}>Ya, lanjutkan</button>
            </div>
          </section>
        </div>}
      </main>
    </div>
  );
}
