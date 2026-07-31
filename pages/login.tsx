import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/lib/currentUser";

const GENERIC_ERROR = "ログインIDまたはパスワードが正しくありません。";

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `残り ${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [permanentlyLocked, setPermanentlyLocked] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isLocked = permanentlyLocked || (lockedUntil !== null && now < lockedUntil);

  useEffect(() => {
    // ページ読み込み・リロード時に現在のロック状態をサーバーへ確認し、
    // ロック中であればタイマー表示が消えてしまわないよう復元する。
    let cancelled = false;
    fetch("/api/auth/login-status")
      .then((res) => res.json())
      .then((body: { locked: boolean; permanent?: boolean; retryAfterMs?: number; error?: string }) => {
        if (cancelled || !body.locked) return;
        setError(body.error ?? null);
        if (body.permanent) {
          setPermanentlyLocked(true);
        } else if (typeof body.retryAfterMs === "number") {
          setNow(Date.now());
          setLockedUntil(Date.now() + body.retryAfterMs);
        }
      })
      .catch(() => {
        // 状態確認に失敗しても通常のログイン試行自体は可能なため無視する
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // ロック中は1秒ごとに現在時刻を更新し、期限が来たら自動的にボタンを再度押せるようにする
    if (permanentlyLocked || lockedUntil === null) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [permanentlyLocked, lockedUntil]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || isLocked) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = (await res.json().catch(() => null)) as
        | { name: string; role: "管理者" | "スタッフ" | "ドライバー" }
        | { error: string; locked?: boolean; permanent?: boolean; retryAfterMs?: number }
        | null;

      if (!res.ok || !body || "error" in body) {
        setError((body && "error" in body && body.error) || GENERIC_ERROR);
        if (body && "error" in body && body.locked) {
          if (body.permanent) {
            setPermanentlyLocked(true);
          } else if (typeof body.retryAfterMs === "number") {
            setNow(Date.now());
            setLockedUntil(Date.now() + body.retryAfterMs);
          }
        }
        // 認証情報はDOM/ブラウザ履歴に残さない
        setPassword("");
        return;
      }

      setUser({ name: body.name, role: body.role });
      router.push(body.role === "ドライバー" ? "/mypage" : "/dashboard");
    } catch {
      setError("通信エラーが発生しました。時間をおいて再度お試しください。");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>ログイン | YOU SAY!!</title>
      </Head>

      <div className="login-shell">
        <div className="login-card">
          <div className="logo-block">
            <div className="logo">
              郵政DX
            </div>
            <div className="sub">配送業務管理システム</div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">メールアドレス</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="username"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pw">パスワード</label>
              <input
                type="password"
                id="pw"
                name="password"
                placeholder="●●●●●●●●"
                autoComplete="current-password"
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn--primary btn--block" disabled={submitting || isLocked}>
              {permanentlyLocked
                ? ""
                : lockedUntil !== null
                  ? formatCountdown(lockedUntil - now)
                  : submitting
                    ? "ログイン中..."
                    : "ログイン"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
