import { t } from "../../i18n";

const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

const tableNum = (name) => {
    const m = String(name || "").match(/\d+/);
    return m ? m[0].padStart(2, "0") : null;
};

const fmtMKD = (n) => `${Math.round(Number(n || 0))} MKD`;
const fmtDT = (iso) => {
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return "";
    }
};

export default function MyOrders({ orders = [], onBack }) {
    return (
        <>


            {
                (!orders || orders.length === 0) && (
                    <p className="empty-cart">{t("orders.noPrevious")}</p>
                )
            }

            {
                orders.map((ord, idx) => (
                    <div key={`${ord.orderId || "pending"}-${idx}`} className="order-card">
                        <h3 className="page-head" style={{ margin: "0 6px 6px" }}>
                            {ord.orderId ? t("orders.orderConfirmed") : t("orders.awaiting")}
                        </h3>

                        <div className="order-header">
                            {ord.tableName && (
                                <div className="order-header__cell">
                                    {t("orders.table")}: <strong>{tableNum(ord.tableName)}</strong>
                                </div>
                            )}
                            {!!ord.orderId && (
                                <div className="order-header__cell">
                                    {t("orders.orderId")}: <strong>{ord.orderId}</strong>
                                </div>
                            )}
                            {ord.createdAt && (
                                <div className="order-header__cell">{fmtDT(ord.createdAt)}</div>
                            )}
                        </div>

                        <ul className="menu-list menu-list--full">
                            {ord.items.map((it) => (
                                <li key={`hist-${ord.createdAt}-${it.id}`} className="menu-item">
                                    <img
                                        src={it.image_url || PLACEHOLDER}
                                        alt={it.name}
                                        className="thumb"
                                        loading="lazy"
                                    />
                                    <div className="item-info">
                                        <span className="item-name">{it.name}</span>
                                        <span className="item-price">
                                            {it.quantity} × {fmtMKD(it.price)}
                                        </span>
                                    </div>
                                    <div className="line-total">{fmtMKD(it.price * it.quantity)}</div>
                                </li>
                            ))}
                        </ul>

                        <div className="summary">
                            <div className="summary-row">
                                <span>{t("orders.subtotal")}</span>
                                <span>{fmtMKD(ord.subtotal)}</span>
                            </div>
                            <div className="summary-row">
                                <span>{t("orders.tip")}</span>
                                <span>{fmtMKD(ord.tip)}</span>
                            </div>
                            <div className="summary-row summary-row--total">
                                <span>{t("orders.total")}</span>
                                <span>{fmtMKD(ord.total)}</span>
                            </div>
                        </div>
                    </div>
                ))
            }
        </>
    );
}
