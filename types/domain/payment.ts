import type { Database } from "@/types/database.types";

export type PaymentNotice = Database["public"]["Tables"]["payment_notices"]["Row"];
export type PaymentNoticeItem = Database["public"]["Tables"]["payment_notice_items"]["Row"];
export type PaymentNoticeRevision = Database["public"]["Tables"]["payment_notice_revisions"]["Row"];
export type PaymentStatus = PaymentNotice["status"];

export type PaymentNoticeRow = PaymentNotice & {
  driverName: string;
  areaName: string | null;
};

export type PaymentNoticeDetail = PaymentNoticeRow & {
  items: (PaymentNoticeItem & { categoryLabel: string })[];
  revisions: PaymentNoticeRevision[];
};
