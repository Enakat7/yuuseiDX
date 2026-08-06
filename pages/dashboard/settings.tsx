import Head from "next/head";
import { useEffect, useState, type FormEvent } from "react";
import OperationLayout from "@/components/OperationLayout";
import Modal from "@/components/Modal";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv } from "@/lib/csv";
import { OPERATION_PAGE_KEYS, OPERATION_PAGE_LABELS } from "@/lib/pages";
import type { AccountRow, OperationAccountRole } from "@/types/domain/settings";

type NotificationSettings = {
  payment_confirmed: boolean;
  license_expiry_alert: boolean;
  advance_request: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  payment_confirmed: true,
  license_expiry_alert: true,
  advance_request: false,
};

const NOTIFICATION_LABELS: Record<keyof NotificationSettings, string> = {
  payment_confirmed: "支払通知書 確定時のメール通知",
  license_expiry_alert: "免許証等 期限切れ前アラート",
  advance_request: "前払依頼の申請通知",
};

const EMPTY_FORM = { email: "", password: "", name: "", role: "スタッフ" as OperationAccountRole };

const SETTINGS_TABS = ["アカウント・権限", "通知", "CSV/PDF出力", "発注書", "支払通知書", "前払依頼書"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("アカウント・権限");

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [pdfTemplate, setPdfTemplate] = useState("標準テンプレート");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [permissionAccount, setPermissionAccount] = useState<AccountRow | null>(null);
  const [permissions, setPermissions] = useState<{ pageKey: string; canAccess: boolean }[]>([]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [accountRes, appRes] = await Promise.all([
        apiRequest<{ data: AccountRow[] }>("/api/settings/accounts"),
        apiRequest<{ data: Record<string, unknown> }>("/api/settings/app"),
      ]);
      setAccounts(accountRes.data);
      if (appRes.data.notifications) {
        setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(appRes.data.notifications as NotificationSettings) });
      }
      if (typeof appRes.data.pdf_template === "string") {
        setPdfTemplate(appRes.data.pdf_template);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 初回マウント時にAPI経由で一覧取得する意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/settings/accounts", { method: "POST", body: JSON.stringify(form) });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExportAccounts() {
    const csv = toCsv(
      accounts.map((a) => ({ name: a.name, role: a.role })),
      [
        { key: "name", header: "氏名" },
        { key: "role", header: "権限" },
      ]
    );
    downloadCsv("アカウント一覧.csv", csv);
  }

  async function handleChangeRole(id: string, role: OperationAccountRole) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/settings/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function openPermissions(account: AccountRow) {
    setPermissionAccount(account);
    try {
      const res = await apiRequest<{ data: { pageKey: string; canAccess: boolean }[] }>(
        `/api/settings/permissions?profile_id=${account.id}`
      );
      setPermissions(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    }
  }

  async function togglePermission(pageKey: string, canAccess: boolean) {
    if (!permissionAccount) return;
    setPermissions((prev) => prev.map((p) => (p.pageKey === pageKey ? { ...p, canAccess } : p)));
    try {
      await apiRequest("/api/settings/permissions", {
        method: "POST",
        body: JSON.stringify({ profile_id: permissionAccount.id, page_key: pageKey, can_access: canAccess }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    }
  }

  async function handleSaveNotifications() {
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/settings/app", {
        method: "POST",
        body: JSON.stringify({ key: "notifications", value: notifications }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePdfTemplate() {
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/settings/app", {
        method: "POST",
        body: JSON.stringify({ key: "pdf_template", value: pdfTemplate }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>設定 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>システム設定</h2>
            <p className="content__lead">
              アカウント・権限管理は確定運用です。通知設定・CSV/PDF出力設定は今後の確認により変更となる場合があります。
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {SETTINGS_TABS.map((tab) => (
            <a
              key={tab}
              href="#"
              className={tab === activeTab ? "is-active" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab(tab);
              }}
            >
              {tab}
            </a>
          ))}
        </div>

        {activeTab === "アカウント・権限" && (
          <div className="panel">
            <div className="panel__head">
              <h3>アカウント・権限管理</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleExportAccounts}>
                CSVエクスポート
              </button>
            </div>
            <div className="panel__body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>氏名</th>
                      <th>権限</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && accounts.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <p className="empty-note">登録済みのアカウントはありません。</p>
                        </td>
                      </tr>
                    )}
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>{account.name}</td>
                        <td>
                          <select
                            value={account.role}
                            onChange={(e) => handleChangeRole(account.id, e.target.value as OperationAccountRole)}
                            disabled={saving}
                            style={{ width: "auto" }}
                          >
                            <option value="管理者">管理者</option>
                            <option value="スタッフ">スタッフ</option>
                          </select>
                        </td>
                        <td>
                          <button className="btn btn--sm" onClick={() => openPermissions(account)}>
                            ページ権限
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 14 }}
                onClick={() => setShowCreate(true)}
              >
                + アカウントを追加
              </button>
            </div>
          </div>
        )}

        {activeTab === "通知" && (
          <div className="panel">
            <div className="panel__head">
              <h3>通知設定</h3>
            </div>
            <div className="panel__body">
              <ul style={{ display: "flex", flexDirection: "column", gap: 14, listStyle: "none", padding: 0 }}>
                {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationSettings)[]).map((key) => (
                  <li className="flex--between" key={key}>
                    <span>{NOTIFICATION_LABELS[key]}</span>
                    <label className="flex" style={{ gap: 6, alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={notifications[key]}
                        onChange={(e) => setNotifications((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span className={`pill pill--${notifications[key] ? "confirmed" : "pending"}`}>
                        {notifications[key] ? "ON" : "OFF"}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 14 }}
                onClick={handleSaveNotifications}
                disabled={saving}
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "CSV/PDF出力" && (
          <div className="panel">
            <div className="panel__head">
              <h3>CSV / PDF 出力設定</h3>
            </div>
            <div className="panel__body">
              <p className="text-sm">
                <strong>CSV文字コード：</strong>UTF-8・カンマ区切り・ヘッダー日本語表記（確認済み、固定）
              </p>
              <div className="field mb-0">
                <label>PDFデザインテンプレート</label>
                <select value={pdfTemplate} onChange={(e) => setPdfTemplate(e.target.value)}>
                  <option>標準テンプレート</option>
                </select>
                <p className="hint">帳票デザインは未確定のため、確定次第テンプレートを追加します。</p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handleSavePdfTemplate}
                disabled={saving}
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "発注書" && (
          <div className="panel">
            <div className="panel__head">
              <h3>発注書・発行タイミング</h3>
            </div>
            <div className="panel__body">
              <p className="text-sm mb-0">
                稼働カレンダーでスタッフが日別に配達地区コードを入力し「確定」すると作成済になります。稼働内容の変更後は自動的に「作成中」に戻り、再確定が必要です。作成済の発注書は「一括送信」でドライバーへ送信します（自動発行ではありません）。ドライバーは内容を確認のうえ「承認」または「修正依頼」を行います。
              </p>
            </div>
          </div>
        )}

        {activeTab === "支払通知書" && (
          <div className="panel">
            <div className="panel__head">
              <h3>支払通知書・発行タイミング</h3>
            </div>
            <div className="panel__body">
              <p className="text-sm">
                <strong>週払い：</strong>毎週金曜日に発行します。
              </p>
              <p className="text-sm mb-0">
                <strong>月払い：</strong>月末締め後に発行します。
              </p>
            </div>
          </div>
        )}

        {activeTab === "前払依頼書" && (
          <div className="panel">
            <div className="panel__head">
              <h3>前払依頼書・運用ルール</h3>
            </div>
            <div className="panel__body">
              <p className="text-sm mb-0">
                承認フローは設けず、申請と同時に確定します。前払可能額は「現時点までの売上 − 当月の控除予定額」で算出し、これを上回る申請は「超過（要確認）」として識別されます（マイナスでも前払い実行は可能です）。
              </p>
            </div>
          </div>
        )}
      </OperationLayout>

      {showCreate && (
        <Modal title="アカウント追加" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateAccount}>
            <div className="field">
              <label htmlFor="acc-name">氏名</label>
              <input
                id="acc-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="acc-email">メールアドレス</label>
              <input
                id="acc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="acc-password">初期パスワード</label>
              <input
                id="acc-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                minLength={8}
                required
              />
            </div>
            <div className="field">
              <label>権限</label>
              <div className="flex" style={{ gap: 16 }}>
                {(["管理者", "スタッフ"] as OperationAccountRole[]).map((role) => (
                  <label key={role} className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="role"
                      checked={form.role === role}
                      onChange={() => setForm((f) => ({ ...f, role }))}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn--ghost btn--block" disabled={saving}>
              {saving ? "作成中..." : "作成する"}
            </button>
          </form>
        </Modal>
      )}

      {permissionAccount && (
        <Modal
          title={`ページ権限 — ${permissionAccount.name}`}
          subtitle="行がない場合は既定でアクセス許可されます。オフにしたページのみ制限されます。"
          onClose={() => setPermissionAccount(null)}
        >
          {permissionAccount.role === "管理者" ? (
            <p className="text-sm text-muted">管理者はページ単位の制限を受けません。</p>
          ) : (
            <ul style={{ display: "flex", flexDirection: "column", gap: 12, listStyle: "none", padding: 0 }}>
              {OPERATION_PAGE_KEYS.map((key) => {
                const perm = permissions.find((p) => p.pageKey === key);
                const canAccess = perm?.canAccess ?? true;
                return (
                  <li className="flex--between" key={key}>
                    <span>{OPERATION_PAGE_LABELS[key]}</span>
                    <label className="flex" style={{ gap: 6, alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={canAccess}
                        onChange={(e) => togglePermission(key, e.target.checked)}
                      />
                      <span className={`pill pill--${canAccess ? "confirmed" : "pending"}`}>
                        {canAccess ? "許可" : "制限"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
