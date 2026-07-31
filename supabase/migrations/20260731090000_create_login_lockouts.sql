-- ログイン試行のロック状態（要件: ミスログイン3の倍数ごとに段階ロック、15回目以降は
-- 恒久ロックし管理者が解除するまで自動解除しない）。
--
-- lib/rateLimit.tsの旧実装はプロセス単位のインメモリMapだったが、Next.jsのAPIルートは
-- ルートごとに別モジュールとしてコンパイルされうる（開発サーバーのオンデマンド
-- コンパイル/アイドル時の再コンパイルを含む）ため、別ルート（login.ts/login-status.ts）
-- 間はもちろん同一ルートでも状態が失われることがあった。IPアドレスをキーとした
-- 共有ストアとしてこのテーブルに永続化する。
create table public.login_lockouts (
  ip text primary key,
  fail_count integer not null default 0,
  lock_until timestamptz,
  permanent boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.login_lockouts enable row level security;

-- ログイン前（未認証）のリクエストからも読み書きする必要があるため、RLSポリシーは
-- 意図的に定義しない（anon/authenticatedともに既定拒否）。読み書きはservice role
-- クライアント（lib/supabase/server.tsのcreateAdminClient）経由のみに限定する。
