import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type OperationRole = "管理者" | "スタッフ";

export type CurrentUser = {
  name: string;
  role: OperationRole;
};

const STORAGE_KEY = "you-say:current-user";

export const DEFAULT_USER: CurrentUser = { name: "山田 太郎", role: "管理者" };

const USERS_BY_ROLE: Record<OperationRole, CurrentUser> = {
  管理者: { name: "山田 太郎", role: "管理者" },
  スタッフ: { name: "中村 恵", role: "スタッフ" },
};

export function userForRole(role: OperationRole): CurrentUser {
  return USERS_BY_ROLE[role];
}

type CurrentUserContextValue = {
  user: CurrentUser;
  setUser: (user: CurrentUser) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser>(DEFAULT_USER);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as CurrentUser;
      if (parsed.role === "管理者" || parsed.role === "スタッフ") {
        // サーバーとクライアント初回描画を一致させるため、localStorage の反映は
        // マウント後の effect で行う（SSR ハイドレーション崩れを防ぐための意図的な設計）。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserState(parsed);
      }
    } catch {
      // 破損したストレージ値は無視してデフォルトのまま
    }
  }, []);

  const setUser = (next: CurrentUser) => {
    setUserState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return <CurrentUserContext.Provider value={{ user, setUser }}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx;
}
