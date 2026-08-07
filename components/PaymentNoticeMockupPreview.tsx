import Image from "next/image";
import spbLogo from "@/images/spb-nc.png";
import type { SampleData } from "@/types/domain/paymentNoticeTemplate";
import type { DeliveryType } from "@/types/domain/master";

type Props = {
  sample: SampleData;
  deliveryTypes: DeliveryType[];
  breakdownItemLabels: string[];
  editMode: boolean;
  onChangeBreakdownLabel: (index: number, label: string) => void;
};

const ACHIEVEMENT_ROW_COUNT = 31;

// 明細内訳スロット(breakdownItemLabelsのindex)→サンプルitemsのindex。nullはデータを持たない行（繁忙期加算）。
const BREAKDOWN_DATA_SLOT_INDEX: (number | null)[] = [0, 1, 2, null, 3, 4];
const BREAKDOWN_FILLER_COUNTS = { afterAllowance: 4, afterSales: 6, afterOtherSales: 8 } as const;

function formatJaDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}年${m}月${d}日`;
}

function splitDailyDate(date: string): { mmdd: string; week: string } {
  const match = date.match(/^(\d+\/\d+)\((.+)\)$/);
  if (!match) return { mmdd: date, week: "" };
  return { mmdd: match[1], week: `(${match[2]})` };
}

function yen(value: number): string {
  return value.toLocaleString("ja-JP");
}

function BlankRows({ count, cols }: { count: number; cols: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>{c === 0 ? "　" : ""}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function PaymentNoticeMockupPreview({
  sample,
  deliveryTypes,
  breakdownItemLabels,
  editMode,
  onChangeBreakdownLabel,
}: Props) {
  const { header, daily, items, summary } = sample;
  // 実績表(pn-mockup__achievements)の列は配送種別マスタ[単価マスタ対象]と常に連動する。
  const achievementColumns = deliveryTypes.filter((t) => t.price_master_target);

  const dailyRows = Array.from({ length: ACHIEVEMENT_ROW_COUNT }, (_, i) => daily[i]);
  const dailyTotals = achievementColumns.map((t) => daily.reduce((sum, d) => sum + (d.counts[t.code] ?? 0), 0));

  return (
    <div className="pn-mockup">
      <header className="pn-mockup__header">
        <p>
          発行日：　<span>{formatJaDate(header.payDate)}</span>
        </p>
        <h1 className="pn-mockup__title">支払通知書</h1>
      </header>
      <main>
        <div className="pn-mockup__info-section">
          <div className="pn-mockup__driver-info">
            <p>
              〒<span>{header.postalCode}</span>
            </p>
            <p>
              　<span>{header.address}</span>
            </p>
            <br />
            <p className="pn-mockup__under-line">
              　<span>{header.name}</span>
            </p>
            <p className="pn-mockup__under-line">
              　インボイス番号：<span>{header.invoiceNumber}</span>
            </p>
          </div>
          <div className="pn-mockup__driver-account">
            <p className="pn-mockup__under-line" style={{ margin: "5px 0" }}>
              支払日：<span>{formatJaDate(header.payDate)}</span>
            </p>
            <p>
              銀行名：<span>{header.bankName}</span>
            </p>
            <p>
              支店名：<span>{header.bankBranch}</span>
            </p>
            <p>
              口座種別：<span>{header.bankAccountType}</span>
            </p>
            <p>
              口座番号：<span>{header.bankAccountNumber}</span>
            </p>
            <p>
              口座名義：<span>{header.bankAccountHolder}</span>
            </p>
          </div>
          <div className="pn-mockup__company-info">
            <div>
              <p>株式会社SPB-NC　西原営業所</p>
              <p>広島市安佐南区西原3-9-14</p>
              <p>TEL：082-846-4001</p>
              <p>登録番号：T6240001019638</p>
            </div>
            <div className="pn-mockup__company-logo">
              <Image src={spbLogo} alt="株式会社SPB-NC" />
            </div>
          </div>
        </div>
        <p className="pn-mockup__payment-info">
          業務委託費のお支払い金額が下記の通りとなりました。ご不明な点やご質問がございましたらお気軽にお問合せください。
        </p>
        <div className="pn-mockup__table-section">
          <table className="pn-mockup__achievements">
            <tbody>
              <tr>
                <th colSpan={2}>日付</th>
                {achievementColumns.map((t) => (
                  <th key={t.id}>{t.name}</th>
                ))}
              </tr>
              {dailyRows.map((row, i) => {
                if (!row) {
                  return (
                    <tr key={i}>
                      <td>mm/dd</td>
                      <td>week</td>
                      {achievementColumns.map((t) => (
                        <td key={t.id}></td>
                      ))}
                    </tr>
                  );
                }
                const { mmdd, week } = splitDailyDate(row.date);
                return (
                  <tr key={i}>
                    <td>{mmdd}</td>
                    <td>{week}</td>
                    {achievementColumns.map((t) => (
                      <td key={t.id}>{row.counts[t.code] || ""}</td>
                    ))}
                  </tr>
                );
              })}
              <tr className="pn-mockup__total-row">
                <td colSpan={2}>合計</td>
                {dailyTotals.map((total, i) => (
                  <td key={achievementColumns[i].id}>{total}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <table className="pn-mockup__breakdown">
            <tbody>
              <tr>
                <th colSpan={4}>明細内訳</th>
              </tr>
              <tr>
                <th>項目</th>
                <th>数量</th>
                <th>単価(税込)</th>
                <th>金額(税込)</th>
              </tr>
              {breakdownItemLabels.map((label, i) => {
                const dataIndex = BREAKDOWN_DATA_SLOT_INDEX[i];
                const item = dataIndex !== null ? items[dataIndex] : undefined;
                return (
                  <tr key={i}>
                    <td>
                      {editMode ? (
                        <input
                          className="pn-mockup__label-input"
                          value={label}
                          onChange={(e) => onChangeBreakdownLabel(i, e.target.value)}
                        />
                      ) : (
                        label
                      )}
                    </td>
                    <td>{item ? item.qty : ""}</td>
                    <td>{item ? yen(item.unitPrice) : ""}</td>
                    <td>{item ? yen(item.amount) : ""}</td>
                  </tr>
                );
              })}
              <tr>
                <td>手当合計額</td>
                <td></td>
                <td></td>
                <td>{yen(summary.allowanceTotal)}</td>
              </tr>
              <BlankRows count={BREAKDOWN_FILLER_COUNTS.afterAllowance} cols={4} />
              <tr className="pn-mockup__total-row">
                <td className="pn-mockup__cell--total" colSpan={3}>
                  売上合計(税込)
                </td>
                <td className="pn-mockup__cell--total">{yen(summary.salesTotalTaxIncl)}</td>
              </tr>
              <BlankRows count={BREAKDOWN_FILLER_COUNTS.afterSales} cols={4} />
              <tr className="pn-mockup__total-row">
                <td className="pn-mockup__cell--total" colSpan={3}>
                  その他項目売上合計(税込)
                </td>
                <td className="pn-mockup__cell--total">{yen(summary.otherSalesTotalTaxIncl)}</td>
              </tr>
              <BlankRows count={BREAKDOWN_FILLER_COUNTS.afterOtherSales} cols={4} />
              <tr className="pn-mockup__total-row">
                <td className="pn-mockup__cell--total" colSpan={3}>
                  引き去り額合計(税込)
                </td>
                <td className="pn-mockup__cell--total">{yen(summary.deductionTotalTaxIncl)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="pn-mockup__total-section">
          <table className="pn-mockup__total">
            <tbody>
              <tr>
                <td className="pn-mockup__cell--total" colSpan={1}>
                  合計(税込)
                </td>
                <td className="pn-mockup__cell--total" colSpan={3}>
                  {yen(summary.grandTotalTaxIncl)}
                </td>
              </tr>
              <tr>
                <td colSpan={1}>内消費税</td>
                <td colSpan={1}>10%</td>
                <td colSpan={2}>{yen(summary.consumptionTax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
