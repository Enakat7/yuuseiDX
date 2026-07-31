// ブラウザから自前のAPI Routeを呼ぶための薄いfetchラッパー。
// このアプリは認証Cookieを意図的にhttpOnlyにしているため、ブラウザのSupabaseクライアントは
// セッションを持てない。データアクセスは必ずサーバー側のAPI Route（lib/apiAuth.ts参照）を経由する。
export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : null;
    throw new Error(message ?? "通信エラーが発生しました。");
  }
  return body as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
