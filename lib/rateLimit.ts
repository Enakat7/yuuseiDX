type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// メモリ上の簡易レートリミッタ(ブルートフォース対策の最低限の防御線)。
// プロセス単位でしか状態を持たないため、複数インスタンス構成や再起動をまたぐ
// 永続化はできない。本番運用ではRedis等の共有ストアに置き換えること。
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}
