import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import { useCurrentUser, type OperationRole } from "@/lib/currentUser";

type LogEntry = {
  id: string;
  time: string;
  role: OperationRole;
  name: string;
  screen: string;
  params: string[];
  isNew?: boolean;
};

type ActionTemplate = {
  role: OperationRole;
  name: string;
  screen: string;
  params: string[];
};

const ACTION_POOL: ActionTemplate[] = [
  { role: "スタッフ", name: "中村 恵", screen: "発注書", params: ["西", "佐藤一郎", "2026-07-18", "再発行"] },
  { role: "管理者", name: "山田 太郎", screen: "発注書", params: ["安佐南", "鈴木花子", "2026-07-14", "一括送信"] },
  {
    role: "管理者",
    name: "山田 太郎",
    screen: "支払通知書",
    params: ["中央(中区)", "高橋健太", "2026年7月第3週", "確定"],
  },
  {
    role: "スタッフ",
    name: "佐々木 亮",
    screen: "支払通知書",
    params: ["西", "佐藤一郎", "2026年7月第3週", "仮確定承認"],
  },
  { role: "スタッフ", name: "中村 恵", screen: "件数集計", params: ["宇品", "田中誠", "2026-07-17", "件数入力"] },
  { role: "管理者", name: "山田 太郎", screen: "管理費集計", params: ["西", "佐藤一郎", "2026年7月", "ガソリン代編集"] },
  { role: "管理者", name: "小林 さゆり", screen: "前払依頼書", params: ["安佐南", "鈴木花子", "ADV-0230", "承認"] },
  { role: "管理者", name: "山田 太郎", screen: "マスタ管理(単価)", params: ["広島西", "配達完了１", "単価改定"] },
  { role: "スタッフ", name: "佐々木 亮", screen: "マスタ管理(ドライバー)", params: ["田中誠", "免許証", "書類アップロード"] },
  { role: "管理者", name: "山田 太郎", screen: "設定", params: ["通知設定", "前払依頼の申請通知", "ON切替"] },
];

const SEED_ENTRIES: LogEntry[] = [
  {
    id: "seed-1",
    time: "10:12:03",
    role: "管理者",
    name: "山田 太郎",
    screen: "支払通知書",
    params: ["中央(中区)", "高橋健太", "2026年7月第3週", "確定"],
  },
  {
    id: "seed-2",
    time: "10:08:41",
    role: "スタッフ",
    name: "中村 恵",
    screen: "発注書",
    params: ["西", "佐藤一郎", "2026-07-18", "再発行"],
  },
  {
    id: "seed-3",
    time: "09:57:12",
    role: "管理者",
    name: "山田 太郎",
    screen: "前払依頼書",
    params: ["安佐南", "鈴木花子", "ADV-0230", "承認"],
  },
  {
    id: "seed-4",
    time: "09:41:55",
    role: "スタッフ",
    name: "佐々木 亮",
    screen: "件数集計",
    params: ["宇品", "田中誠", "2026-07-17", "件数入力"],
  },
  {
    id: "seed-5",
    time: "09:30:07",
    role: "管理者",
    name: "山田 太郎",
    screen: "マスタ管理(単価)",
    params: ["広島西", "配達完了１", "単価改定"],
  },
];

const ROLE_FILTERS = ["すべて", "管理者", "スタッフ"] as const;

function formatEntry(entry: LogEntry): string {
  return `${entry.screen}(${entry.params.join(",")})`;
}

function nowTimeString(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function OperationLogPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [entries, setEntries] = useState<LogEntry[]>(SEED_ENTRIES);
  const [live, setLive] = useState(true);
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("すべて");
  const nextId = useRef(0);

  useEffect(() => {
    if (user.role !== "管理者") {
      router.replace("/dashboard-operation");
    }
  }, [user.role, router]);

  useEffect(() => {
    if (!live) return undefined;

    const timer = window.setInterval(() => {
      const template = ACTION_POOL[Math.floor(Math.random() * ACTION_POOL.length)];
      nextId.current += 1;
      const entry: LogEntry = {
        id: `live-${nextId.current}`,
        time: nowTimeString(),
        role: template.role,
        name: template.name,
        screen: template.screen,
        params: template.params,
        isNew: true,
      };
      setEntries((prev) => [entry, ...prev].slice(0, 50));
    }, 5000);

    return () => window.clearInterval(timer);
  }, [live]);

  const visibleEntries = useMemo(
    () => (roleFilter === "すべて" ? entries : entries.filter((entry) => entry.role === roleFilter)),
    [entries, roleFilter]
  );

  if (user.role !== "管理者") {
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
          <div className="flex">
            <span className="text-sm text-muted flex" style={{ gap: 6 }}>
              <span className={"live-dot" + (live ? "" : " is-paused")} />
              {live ? "LIVE" : "一時停止中"}
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLive((v) => !v)}>
              {live ? "一時停止" : "再開"}
            </button>
          </div>
        </div>

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
            {visibleEntries.length === 0 && (
              <p className="empty-note">該当する権限のログはありません。</p>
            )}
            {visibleEntries.map((entry) => (
              <div className={"log-entry" + (entry.isNew ? " is-new" : "")} key={entry.id}>
                <span className="log-entry__time">{entry.time}</span>
                <span className="log-entry__body">
                  <strong>
                    {entry.role}：{entry.name}
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
