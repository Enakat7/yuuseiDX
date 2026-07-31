import type { SupabaseClient } from "@supabase/supabase-js";

// operation_logs（ログ画面、§6.9）などのリアルタイム表示で使う購読ヘルパー。
// 呼び出し側でuseEffect内のクリーンアップとしてunsubscribeを呼ぶこと。
export function subscribeToInserts<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  onInsert: (row: T) => void
): () => void {
  const channel = supabase
    .channel(`realtime:${table}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table },
      (payload) => onInsert(payload.new as T)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
