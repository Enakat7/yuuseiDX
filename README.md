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

## 同一ネットワーク内の他PCからアクセスする

`npm run dev` / `npm run start` はデフォルトでは `localhost` にのみバインドされるため、同じLAN内の他のPC・スマホからはアクセスできない。以下の手順でアクセス可能にする。

> WSL2の「ミラーモード」ネットワークが有効な環境（WSL2とWindowsホストのIPアドレスが一致する構成）を前提とした手順。

1. WSL2側のIPアドレスを確認

   ```bash
   ip -4 addr show
   ```

   `eth1`（環境により異なる）に表示される `inet` のアドレス（例: `192.168.24.130`）を確認する。

2. Windows側のIPアドレスを確認し、WSL2側と一致するか確認

   Windows の PowerShell / コマンドプロンプトで以下を実行。

   ```powershell
   ipconfig
   ```

   使用中のアダプタ（Wi-Fi等）の IPv4 アドレスが手順1のWSL2側のIPアドレスと一致していれば、ミラーモードが有効でポートフォワーディングの追加設定は不要。

3. 全ネットワークインターフェースにバインドしてサーバーを起動

   ```bash
   npx next dev -H 0.0.0.0
   # または
   npx next start -H 0.0.0.0
   ```

4. Windows Defender ファイアウォールで該当ポート（デフォルト3000）の受信を許可

   接続中のネットワークプロファイル（プライベート/パブリック）に対して着信がブロックされている場合、アクセスできない。以下のいずれかで許可する。

   - GUI: 「Windows Defender ファイアウォール」→「詳細設定」→「受信の規則」→「新しい規則」→ポート → TCP `3000` → 接続を許可する → 該当プロファイルにチェック
   - PowerShell（管理者権限）:

     ```powershell
     netsh advfirewall firewall add rule name="Next.js Dev Server (3000)" dir=in action=allow protocol=TCP localport=3000
     ```

   公衆Wi-Fi等の信頼できないネットワークでポートを開放すると、同一ネットワーク上の他の端末からもアクセス可能になる点に注意。検証後は不要な規則を削除しておくこと。

5. 他のPC・スマホのブラウザから、手順1で確認したIPアドレスにアクセス

   ```
   http://192.168.24.130:3000
   ```

## ディレクトリ構成（抜粋）

```
pages/       ページ（ルーティング）
components/  共通コンポーネント
lib/         ユーティリティ・共通ロジック
styles/      スタイルシート
mockup/      HTML/CSSモックアップ
supabase/    Supabaseのローカル設定・マイグレーション
```

## 仕様書
