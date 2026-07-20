import Head from "next/head";
import { useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import Modal from "@/components/Modal";
import { buildMonthGrid, DOW_LABELS } from "@/lib/calendar";

const AREAS = [
  "西",
  "安佐南",
  "中央(中区)",
  "中央(東区)",
  "府中",
  "伴",
  "宇品",
  "その他",
] as const;

const WEEK_DATES = ["7/13(月)", "7/14(火)", "7/15(水)", "7/16(木)", "7/17(金)", "7/18(土)", "7/19(日)"];

type Status = "confirmed" | "provisional" | "alert";

type Driver = {
  id: string;
  name: string;
  district: string;
  week: boolean[]; // Mon..Sun
  status: Status;
  statusLabel: string;
  confirmed: boolean;
};

const WEST_DRIVERS: Driver[] = [
  {
    id: "sato",
    name: "佐藤 一郎",
    district: "西A地区",
    week: [true, true, true, true, true, false, false],
    status: "confirmed",
    statusLabel: "送信済",
    confirmed: true,
  },
  {
    id: "suzuki",
    name: "鈴木 花子",
    district: "西B地区",
    week: [false, true, false, true, true, true, false],
    status: "confirmed",
    statusLabel: "送信済",
    confirmed: true,
  },
  {
    id: "takahashi",
    name: "高橋 健太",
    district: "西A地区",
    week: [true, true, true, true, false, false, false],
    status: "provisional",
    statusLabel: "未送信",
    confirmed: false,
  },
  {
    id: "tanaka",
    name: "田中 誠",
    district: "西C地区",
    week: [true, false, true, true, true, true, false],
    status: "confirmed",
    statusLabel: "送信済",
    confirmed: true,
  },
  {
    id: "watanabe",
    name: "渡辺 陽子",
    district: "西B地区",
    week: [true, true, true, false, true, false, true],
    status: "alert",
    statusLabel: "要再送信",
    confirmed: false,
  },
];

const DRIVERS_BY_AREA: Partial<Record<(typeof AREAS)[number], Driver[]>> = {
  西: WEST_DRIVERS,
};

// 2026年7月1日は水曜日（Mon=0 起点で firstWeekday=2）
const JULY_2026_FIRST_WEEKDAY = 2;
const JULY_2026_DAYS = 31;

export default function SchedulePage() {
  const [area, setArea] = useState<(typeof AREAS)[number]>("西");
  const [openDriver, setOpenDriver] = useState<Driver | null>(null);
  const [confirmedMap, setConfirmedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WEST_DRIVERS.map((driver) => [driver.id, driver.confirmed]))
  );

  const drivers = DRIVERS_BY_AREA[area] ?? [];

  const toggleConfirmed = (id: string) => {
    setConfirmedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const monthGrid = useMemo(() => {
    if (!openDriver) return null;
    return buildMonthGrid(JULY_2026_DAYS, JULY_2026_FIRST_WEEKDAY, openDriver.week);
  }, [openDriver]);

  return (
    <>
      <Head>
        <title>発注書(稼働表) | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>エリア別 稼働表</h2>
            <p className="content__lead">エリアタブを切り替えて、ドライバーごとの稼働状況を確認します。</p>
          </div>
          <div className="flex">
            <select style={{ width: "auto" }} defaultValue="2026年7月">
              <option>2026年7月</option>
              <option>2026年6月</option>
            </select>
            <button className="btn btn--ghost">CSVインポート</button>
            <button className="btn btn--ghost">CSVエクスポート</button>
            <button className="btn btn--ghost">発注書を一括送信</button>
          </div>
        </div>

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {AREAS.map((a) => (
            <a
              key={a}
              href="#"
              className={a === area ? "is-active" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setArea(a);
              }}
            >
              {a}
            </a>
          ))}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>{area}エリア — 稼働表</h3>
            <span className="text-sm text-muted">{drivers.length}名 稼働中</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ドライバー</th>
                  {WEEK_DATES.map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                  <th>発注書状況</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <p className="empty-note">このエリアの稼働表データはまだありません。</p>
                    </td>
                  </tr>
                )}
                {drivers.map((driver) => {
                  const isConfirmed = !!confirmedMap[driver.id];
                  return (
                    <tr key={driver.id}>
                      <td>{driver.name}</td>
                      {driver.week.map((worked, index) => (
                        <td key={index}>{worked ? "◯" : "-"}</td>
                      ))}
                      <td>
                        <span className={`pill pill--${driver.status}`}>{driver.statusLabel}</span>
                      </td>
                      <td>
                        <div className="flex" style={{ gap: 8 }}>
                          <button type="button" className="btn btn--sm" onClick={() => setOpenDriver(driver)}>
                            詳細
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm${isConfirmed ? "" : " btn--ghost"}`}
                            onClick={() => toggleConfirmed(driver.id)}
                          >
                            {isConfirmed ? "確定" : "未確定"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>

      {openDriver && monthGrid && (
        <Modal
          title={`${openDriver.name} — 稼働カレンダー`}
          subtitle={`${area}エリア / ${openDriver.district} ／ 2026年7月`}
          onClose={() => setOpenDriver(null)}
        >
          <div className="month-cal__stats">
            <div>
              <div className="month-cal__stat-label">稼働日数</div>
              <div className="month-cal__stat-value">
                {monthGrid.workCount}
                <small style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>日</small>
              </div>
            </div>
            <div>
              <div className="month-cal__stat-label">休み</div>
              <div className="month-cal__stat-value">
                {JULY_2026_DAYS - monthGrid.workCount}
                <small style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>日</small>
              </div>
            </div>
          </div>

          <div className="month-cal">
            {DOW_LABELS.map((d) => (
              <div className="month-cal__dow" key={d}>
                {d}
              </div>
            ))}
            {monthGrid.cells.map((cell, index) =>
              cell.day === null ? (
                <div className="month-cal__day is-empty" key={index} />
              ) : (
                <div className={`month-cal__day ${cell.isWork ? "is-work" : "is-off"}`} key={index}>
                  <span>{cell.day}</span>
                  <span className="month-cal__mark" />
                </div>
              )
            )}
          </div>

          <div className="month-cal__legend">
            <span className="flex">
              <span className="month-cal__mark" />
              稼働
            </span>
            <span className="flex">
              <span className="month-cal__mark" style={{ background: "var(--gray-300)" }} />
              休み
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}
