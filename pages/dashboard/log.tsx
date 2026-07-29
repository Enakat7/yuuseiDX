import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import { useCurrentUser } from "@/lib/currentUser";
import { apiRequest } from "@/lib/apiClient";
import type { OperationLog } from "@/types/domain/log";

const ROLE_FILTERS = ["すべて", "管理者", "スタッフ"] as const;
const POLL_INTERVAL_MS = 3000;

type DisplayEntry = OperationLog & { isNew?: boolean };

function formatEntry(entry: OperationLog): string {
  const params = entry.params;
  const paramValues =
    params && typeof params === "object" && !Array.isArray(params)
      ? Object.values(params as Record<string, unknown>).map((v) => String(v))
      : [];
  const parts = [...paramValues, entry.action];
  return `${entry.screen_name}(${parts.join(",")})`;
}

export default function OperationLogPage() {
  const router = useRouter();
  const { user, ready } = useCurrentUser();
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("すべて");
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    // readyになる前（localStorage復元前）はuserがまだ既定値のため、
    // このタイミングでの判定を待たないとフルページ読み込み時に誤って弾いてしまう。
    if (ready && user.role !== "管理者") {
      router.replace("/dashboard");
    }
  }, [ready, user.role, router]);

  useEffect(() => {
    if (user.role !== "管理者") return;

    let cancelled = false;
    cursorRef.current = null;

    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        if (roleFilter !== "すべて") params.set("role", roleFilter);
        const res = await apiRequest<{ data: OperationLog[]; serverTime: string }>(`/api/logs?${params.toString()}`);
        if (cancelled) return;
        setEntries(res.data);
        cursorRef.current = res.serverTime;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "取得に失敗しました。");
      }
    }

    async function poll() {
      if (!cursorRef.current) return;
      try {
        const params = new URLSearchParams({ since: cursorRef.current });
        if (roleFilter !== "すべて") params.set("role", roleFilter);
        const res = await apiRequest<{ data: OperationLog[]; serverTime: string }>(`/api/logs?${params.toString()}`);
        if (cancelled || res.data.length === 0) {
          if (!cancelled) cursorRef.current = res.serverTime;
          return;
        }
        setEntries((prev) => [...res.data.map((e) => ({ ...e, isNew: true })), ...prev].slice(0, 100));
        cursorRef.current = res.serverTime;
      } catch {
        // ポーリング1回分の失敗はUI上のエラー表示にはしない(次回リトライで復帰させる)
      }
    }

    loadInitial();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user.role, roleFilter]);

  const visibleEntries = useMemo(() => entries, [entries]);

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
        <title>ログ | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>ログ</h2>
            <p className="content__lead">誰がどのデータを操作したかをリアルタイムに確認します（管理者限定）。</p>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {ROLE_FILTERS.map((filter) => (
            <a
              key={filter}
              href="#"
              className={filter === roleFilter ? "is-active" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setRoleFilter(filter);
              }}
            >
              {filter}
            </a>
          ))}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>操作ログ</h3>
            <span className="text-sm text-muted">直近{visibleEntries.length}件</span>
          </div>
          <div className="log-feed">
            {visibleEntries.length === 0 && <p className="empty-note">該当する権限のログはありません。</p>}
            {visibleEntries.map((entry) => (
              <div className={"log-entry" + (entry.isNew ? " is-new" : "")} key={entry.id}>
                <span className="log-entry__time">{new Date(entry.created_at).toLocaleString("ja-JP")}</span>
                <span className="log-entry__body">
                  <strong>
                    {entry.actor_role}：{entry.actor_name}
                  </strong>{" "}
                  - {formatEntry(entry)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
