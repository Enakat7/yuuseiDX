import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import { useCurrentUser } from "@/lib/currentUser";
import { apiRequest } from "@/lib/apiClient";

type LockedLoginEntry = {
  ip: string;
  failCount: number;
  permanent: boolean;
  retryAfterMs: number | null;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
}

export default function LoginLocksPage() {
  const router = useRouter();
  const { user, ready } = useCurrentUser();
  const [entries, setEntries] = useState<LockedLoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlockingIp, setUnlockingIp] = useState<string | null>(null);

  useEffect(() => {
    // readyになる前はuserがまだ既定値のため、このタイミングでの判定を待たないと
    // フルページ読み込み時に誤って弾いてしまう。
    if (ready && user.role !== "管理者") {
      router.replace("/dashboard");
    }
  }, [ready, user.role, router]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: LockedLoginEntry[] }>("/api/settings/login-locks");
      setEntries(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user.role !== "管理者") return;
    // 初回マウント時にAPI経由で一覧取得する意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [user.role]);

  async function handleUnlock(ip: string) {
    setUnlockingIp(ip);
    setError(null);
    try {
      await apiRequest(`/api/settings/login-locks/${encodeURIComponent(ip)}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除に失敗しました。");
    } finally {
      setUnlockingIp(null);
    }
  }

  if (ready && user.role !== "管理者") {
    return (
      <OperationLayout>
        <p className="empty-note">アクセス権限がありません。管理者アカウントでログインしてください。</p>
      </OperationLayout>
    );
  }

  return (
    <>
      <Head>
        <title>ログインロック管理 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>ログインロック管理</h2>
            <p className="content__lead">
              ミスログインの繰り返しによりロック中のIPアドレスを確認・解除します（管理者限定）。
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={loadAll} disabled={loading}>
            更新
          </button>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="panel">
          <div className="panel__head">
            <h3>ロック中のIP</h3>
            <span className="text-sm text-muted">{loading ? "読み込み中..." : `${entries.length}件`}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>IPアドレス</th>
                  <th>ミスログイン回数</th>
                  <th>状態</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && entries.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-note">現在ロック中のIPはありません。</p>
                    </td>
                  </tr>
                )}
                {entries.map((entry) => (
                  <tr key={entry.ip}>
                    <td>{entry.ip}</td>
                    <td className="num">{entry.failCount}</td>
                    <td>
                      <span className={`pill pill--${entry.permanent ? "alert" : "pending"}`}>
                        {entry.permanent ? "恒久ロック" : `残り ${formatRemaining(entry.retryAfterMs ?? 0)}`}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={unlockingIp === entry.ip}
                        onClick={() => handleUnlock(entry.ip)}
                      >
                        {unlockingIp === entry.ip ? "解除中..." : "解除する"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
