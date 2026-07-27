import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { useCurrentUser, userForRole, type OperationRole } from "@/lib/currentUser";

type Role = OperationRole | "ドライバー";


export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useCurrentUser();
  const [role, setRole] = useState<Role>("管理者");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (role === "ドライバー") {
      router.push("/dashboard-driver");
      return;
    }
    setUser(userForRole(role));
    router.push("/dashboard-operation");
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

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="id">ログインID</label>
              <input type="text" id="id" placeholder="ID を入力" />
            </div>
            <div className="field">
              <label htmlFor="pw">パスワード</label>
              <input type="password" id="pw" placeholder="●●●●●●●●" />
            </div>
            <button type="submit" className="btn btn--primary btn--block">
              ログイン
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
