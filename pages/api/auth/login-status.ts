import type { NextApiRequest, NextApiResponse } from "next";
import { checkLoginLock, describeLockStatus, getClientIp } from "@/lib/rateLimit";

// ログイン画面の初期表示・リロード時に、現在ロック中かどうかを認証情報なしで確認する。
// これによりページをリロードしてもロック中のカウントダウン表示が失われないようにする。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ip = getClientIp(req);
  const status = await checkLoginLock(ip);

  if (!status.locked) {
    return res.status(200).json({ locked: false });
  }

  return res.status(200).json(describeLockStatus(status));
}
