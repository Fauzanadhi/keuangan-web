import { createClient } from "@supabase/supabase-js";

// Dibaca sebelum client dibuat, karena client menghapus data tautan dari alamat setelah memprosesnya.
const hash = typeof window !== "undefined" ? window.location.hash : "";
export const isRecovery = hash.includes("type=recovery");
export const linkExpired = hash.includes("error_code=otp_expired");

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key-belum-diisi"
);
