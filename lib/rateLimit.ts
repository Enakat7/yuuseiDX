import type { NextApiRequest } from "next";
import { createAdminClient } from "@/lib/supabase/server";

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

// ミスログインが3の倍数に達するたびに段階的に長いロックをかける。
// 3回目:3分 / 6回目:5分 / 9回目:10分 / 12回目:15分 / 15回目以降:恒久ロック。
//
// 状態はSupabase（public.login_lockouts）に永続化する。NextのAPIルートはルートごとに
// 別モジュールとしてコンパイルされることがあり、プロセス内インメモリ変数では
// ルート間は元より同一ルートでも状態が失われることがあったため、DBを共有ストアとして使う。
const MILESTONE_INTERVAL = 3;
const LOCKOUT_DURATIONS_MS = [
  3 * 60 * 1000, // 3回目
  5 * 60 * 1000, // 6回目
  10 * 60 * 1000, // 9回目
  15 * 60 * 1000, // 12回目
]; // 15回目(5段階目)以降は自動解除しない恒久ロック

export type LoginLockStatus =
  | { locked: false }
  | { locked: true; permanent: true }
  | { locked: true; permanent: false; retryAfterMs: number };

type LockoutRow = { ip: string; fail_count: number; lock_until: string | null; permanent: boolean };

function toLockStatus(row: LockoutRow | null, now: number): LoginLockStatus {
  if (!row) return { locked: false };
  if (row.permanent) return { locked: true, permanent: true };
  if (row.lock_until) {
    const lockUntil = new Date(row.lock_until).getTime();
    if (lockUntil > now) return { locked: true, permanent: false, retryAfterMs: lockUntil - now };
  }
  return { locked: false };
}

async function fetchRow(ip: string): Promise<LockoutRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("login_lockouts").select("*").eq("ip", ip).maybeSingle();
  return data;
}

// ログイン試行の前に呼び、現在ロック中でないか確認する（ロック中はカウントを進めない）。
export async function checkLoginLock(ip: string): Promise<LoginLockStatus> {
  return toLockStatus(await fetchRow(ip), Date.now());
}

// ミスログインのたびに呼ぶ。累計回数が3の倍数に達したら段階的に長くなるロックをかける。
export async function registerLoginFailure(ip: string): Promise<LoginLockStatus> {
  const now = Date.now();
  const existing = await fetchRow(ip);
  const failCount = (existing?.fail_count ?? 0) + 1;

  let lockUntil = existing?.lock_until ?? null;
  let permanent = existing?.permanent ?? false;

  if (failCount % MILESTONE_INTERVAL === 0) {
    const milestone = failCount / MILESTONE_INTERVAL;
    if (milestone > LOCKOUT_DURATIONS_MS.length) {
      permanent = true;
      lockUntil = null;
    } else {
      lockUntil = new Date(now + LOCKOUT_DURATIONS_MS[milestone - 1]).toISOString();
    }
  }

  const admin = createAdminClient();
  await admin
    .from("login_lockouts")
    .upsert({ ip, fail_count: failCount, lock_until: lockUntil, permanent, updated_at: new Date(now).toISOString() });

  return toLockStatus({ ip, fail_count: failCount, lock_until: lockUntil, permanent }, now);
}

// ログイン成功時に呼び、ミスログイン履歴をリセットする。
export async function resetLoginAttempts(ip: string) {
  const admin = createAdminClient();
  await admin.from("login_lockouts").delete().eq("ip", ip);
}

export type LockedLoginEntry = {
  ip: string;
  failCount: number;
  permanent: boolean;
  retryAfterMs: number | null;
};

// 現在ロック中のIP一覧（ログインロック管理画面向け）。
export async function listLockedLogins(): Promise<LockedLoginEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("login_lockouts").select("*");
  const now = Date.now();
  const entries: LockedLoginEntry[] = [];
  for (const row of data ?? []) {
    const status = toLockStatus(row, now);
    if (!status.locked) continue;
    entries.push({
      ip: row.ip,
      failCount: row.fail_count,
      permanent: status.permanent,
      retryAfterMs: status.permanent ? null : status.retryAfterMs,
    });
  }
  return entries;
}

// 管理者操作によるロック強制解除。
export async function unlockLoginIp(ip: string) {
  const admin = createAdminClient();
  await admin.from("login_lockouts").delete().eq("ip", ip);
}

// ログインAPI・ロック状態確認APIで共通のレスポンス本文を組み立てる。
export function describeLockStatus(status: Extract<LoginLockStatus, { locked: true }>) {
  return status.permanent
    ? { error: "管理者に確認してください。", locked: true as const, permanent: true as const }
    : {
        error: "試行回数が上限に達しました。しばらく時間をおいて再度お試しください。",
        locked: true as const,
        permanent: false as const,
        retryAfterMs: status.retryAfterMs,
      };
}
