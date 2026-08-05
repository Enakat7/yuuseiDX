import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/domain/schedule";
import type { PaymentNotice, PaymentNoticeItem, PaymentNoticeRevision, PaymentStatus } from "@/types/domain/payment";

export type MySummary = {
  workedDaysThisMonth: number;
  availableAdvance: number;
  latestPayment: {
    id: string;
    status: PaymentStatus;
    period_start: string;
    period_end: string;
    amount: number;
  } | null;
};

export type MyOrderRow = PurchaseOrder;
export type MyOrderMonthDay = { workDate: string; worked: boolean; code: string | null; backgroundColor: string | null };
export type MyOrderMonth = { days: MyOrderMonthDay[]; year: number; month: number };

export type MyPaymentRow = PaymentNotice;
export type MyPaymentDetail = PaymentNotice & {
  items: (PaymentNoticeItem & { categoryLabel: string })[];
  revisions: PaymentNoticeRevision[];
};

export type { PurchaseOrderStatus, PaymentStatus };
