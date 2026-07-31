import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  checkLoginLock,
  describeLockStatus,
  getClientIp,
  registerLoginFailure,
  resetLoginAttempts,
  type LoginLockStatus,
} from "@/lib/rateLimit";

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ID・パスワードいずれの誤りかを区別しない(アカウント列挙・総当たり攻撃の手がかりを与えない)
const GENERIC_ERROR = "ログインIDまたはパスワードが正しくありません。";

function sendLockResponse(res: NextApiResponse, status: Extract<LoginLockStatus, { locked: true }>) {
  return res.status(429).json(describeLockStatus(status));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // SameSite=Laxに加えた多層防御として、同一オリジンからのリクエストのみ受け付ける
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ip = getClientIp(req);

  const existingLock = await checkLoginLock(ip);
  if (existingLock.locked) {
    return sendLockResponse(res, existingLock);
  }

  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length === 0 ||
    email.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email) ||
    password.length === 0 ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return res.status(400).json({ error: GENERIC_ERROR });
  }

  const supabase = createClient(req, res);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const failureStatus = await registerLoginFailure(ip);
    if (failureStatus.locked) {
      return sendLockResponse(res, failureStatus);
    }
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    const failureStatus = await registerLoginFailure(ip);
    if (failureStatus.locked) {
      return sendLockResponse(res, failureStatus);
    }
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  await resetLoginAttempts(ip);
  return res.status(200).json({ name: profile.name, role: profile.role });
}
