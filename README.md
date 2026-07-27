# You Say!!

配送オペレーション管理システム（オペレーションダッシュボード／ドライバーダッシュボード）。

詳細な要件は [REQUIREMENT.md](./REQUIREMENT.md) を参照。

## 技術スタック

- フレームワーク: Next.js（Pages Router）
- 言語: TypeScript
- スタイリング: Vanilla CSS
- ホスティング: Vercel
- データベース／バックエンド: Supabase（アプリケーション連携は今後実装予定。現時点はフロントエンドのみ）

## セットアップ方法

### 前提

- Node.js 20 以上
- npm
- Docker（Supabaseのローカル起動に使用）
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

### 手順

1. リポジトリをクローン

   ```bash
   git clone <このリポジトリのURL>
   cd yuuseiDX
   ```

2. 依存パッケージをインストール

   ```bash
   npm install
   ```

3. 開発サーバーを起動

   ```bash
   npm run dev
   ```

   ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

## Supabaseのセットアップ（ローカル環境）

Dockerを使ってローカルにSupabase環境（DB・Auth・Storage等）を起動する。

1. Dockerを起動しておく

2. Supabaseローカル環境を起動

   ```bash
   supabase start
   ```

   初回はコンテナイメージの取得が行われるため数分かかる。

3. 起動後、以下のツールにアクセスできる

   | ツール | URL |
   |---|---|
   | Studio（管理画面） | http://127.0.0.1:54323 |
   | REST API | http://127.0.0.1:54321/rest/v1 |
   | Mailpit（メール確認） | http://127.0.0.1:54324 |

   接続情報（URL・APIキー等）は `supabase start` の出力、または以下で再確認できる。

   ```bash
   supabase status
   ```

4. ローカル環境を停止する場合

   ```bash
   supabase stop
   ```

> Supabaseの設定ファイルは [supabase/config.toml](./supabase/config.toml) を参照。マイグレーションは `supabase/migrations/` 配下で管理する。

## その他のコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用ビルド |
| `npm run start` | ビルド済みアプリを起動 |
| `npm run lint` | ESLint によるコードチェック |

## ディレクトリ構成（抜粋）

```
pages/       ページ（ルーティング）
components/  共通コンポーネント
lib/         ユーティリティ・共通ロジック
styles/      スタイルシート
mockup/      HTML/CSSモックアップ
supabase/    Supabaseのローカル設定・マイグレーション
```
