import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { useCurrentUser } from "@/lib/currentUser";

const GENERIC_ERROR = "ログインIDまたはパスワードが正しくありません。";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

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
        | { error: string }
        | null;

      if (!res.ok || !body || "error" in body) {
        setError((body && "error" in body && body.error) || GENERIC_ERROR);
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
            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
