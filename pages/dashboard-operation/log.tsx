import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
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

const ENTRIES: LogEntry[] = [];

const ROLE_FILTERS = ["すべて", "管理者", "スタッフ"] as const;

function formatEntry(entry: LogEntry): string {
  return `${entry.screen}(${entry.params.join(",")})`;
}

export default function OperationLogPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [entries] = useState<LogEntry[]>(ENTRIES);
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("すべて");

  useEffect(() => {
    if (user.role !== "管理者") {
      router.replace("/dashboard-operation");
    }
  }, [user.role, router]);

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
