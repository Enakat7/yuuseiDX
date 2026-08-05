import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type OperationRole = "管理者" | "スタッフ" | "ドライバー";

export type CurrentUser = {
  name: string;
  role: OperationRole;
};

const STORAGE_KEY = "you-say:current-user";

export const DEFAULT_USER: CurrentUser = { name: "", role: "スタッフ" };

type CurrentUserContextValue = {
  user: CurrentUser;
  setUser: (user: CurrentUser) => void;
  // localStorageからの復元が完了したか。false の間はuserがDEFAULT_USER
  // （role: "スタッフ"）のままの可能性があるため、権限チェックをこのフラグで
  // 待たないと、フルページ読み込み直後に誤って非管理者と判定されてしまう。
  ready: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser>(DEFAULT_USER);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CurrentUser;
        if (parsed.role === "管理者" || parsed.role === "スタッフ" || parsed.role === "ドライバー") {
          // サーバーとクライアント初回描画を一致させるため、localStorage の反映は
          // マウント後の effect で行う（SSR ハイドレーション崩れを防ぐための意図的な設計）。
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUserState(parsed);
        }
      } catch {
        // 破損したストレージ値は無視してデフォルトのまま
      }
    }
    setReady(true);
  }, []);

  const setUser = (next: CurrentUser) => {
    setUserState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <CurrentUserContext.Provider value={{ user, setUser, ready }}>{children}</CurrentUserContext.Provider>
  );
}

// ログインページの「キャッシュをクリア」操作等、Provider外から
// localStorageのキャッシュだけを消したい場合に使う。
export function clearStoredCurrentUser() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx;
}
