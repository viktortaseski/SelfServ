import React from "react";
import { t } from "../../i18n";

const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

const tableNum = (name) => {
    const m = String(name || "").match(/\d+/);
    return m ? m[0].padStart(2, "0") : null;
};

const fmtMKD = (n) => `${Math.round(Number(n || 0))} MKD`;

export default function OrderSummary({ orderSummary, isPlacing }) {
    if (!orderSummary) return null;
    const { orderId, tableName, items, subtotal, tip, total } = orderSummary;

    return (
        <div className="menu-container cart-container">
            <div className="order-card">
                <h3 className="page-head" style={{ margin: "0 6px 6px" }}>
                    {isPlacing ? t("orders.awaiting") : t("orders.orderConfirmed")}
                </h3>

                <div className="order-header">
                    {tableName && (
                        <div className="order-header__cell">
                            {t("orders.table")}: <strong>{tableNum(tableName)}</strong>
                        </div>
                    )}
                    <div className="order-header__cell">
                        {orderId ? (
                            <>
                                {t("orders.orderId")}: <strong>{orderId}</strong>
                            </>
                        ) : (
                            t("orders.awaiting")
                        )}
                    </div>
                </div>

                <ul className="menu-list menu-list--full">
                    {items.map((it) => (
                        <li key={`conf-${it.id}`} className="menu-item">
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
                        <span>{fmtMKD(subtotal)}</span>
                    </div>
                    <div className="summary-row">
                        <span>{t("orders.tip")}</span>
                        <span>{fmtMKD(tip)}</span>
                    </div>
                    <div className="summary-row summary-row--total">
                        <span>{t("orders.total")}</span>
                        <span>{fmtMKD(total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
