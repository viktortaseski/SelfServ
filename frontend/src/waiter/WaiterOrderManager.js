import { useMemo, useState } from "react";

const STATUS_OPTIONS = [
    { value: "open", label: "Open" },
    { value: "paid", label: "Paid" },
    { value: "open,paid", label: "Active" },
    { value: "canceled", label: "Canceled" },
    { value: "void", label: "Void" },
];

const STATUS_LABELS = {
    open: "Open",
    paid: "Paid",
    canceled: "Canceled",
    void: "Void",
};

function formatMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0 MKD";
    return `${num.toFixed(2)} MKD`;
}

function formatDate(value) {
    if (!value) return "Unknown time";
    try {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString();
    } catch {
        return String(value);
    }
}

function buildStatusLabel(status) {
    const key = typeof status === "string" ? status.toLowerCase() : "";
    return STATUS_LABELS[key] || "Unknown";
}

export default function WaiterOrderManager({
    open,
    orders = [],
    loading,
    error,
    filter,
    onChangeFilter,
    onRefresh,
    onClose,
    onReprint,
    onMarkPaid,
    busyOrderId,
}) {
    const [expanded, setExpanded] = useState(() => new Set());

    const handleToggleOrder = (orderId) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    const statusOptions = useMemo(() => STATUS_OPTIONS, []);

    if (!open) return null;

    const hasOrders = Array.isArray(orders) && orders.length > 0;

    return (
        <div className="waiter-modal">
            <div className="waiter-modal__content waiter-modal__content--wide">
                <div className="waiter-modal__header">
                    <div>
                        <h3 className="waiter-modal__title">Manage Orders</h3>
                        <p className="waiter-modal__subtitle">
                            View active orders, reprint tickets, and mark tables as paid.
                        </p>
                    </div>
                    <button className="waiter-modal__close" onClick={onClose}>
                        Close
                    </button>
                </div>

                <div className="waiter-order-manager__toolbar">
                    <label className="waiter-order-manager__filter">
                        <span>Status</span>
                        <select
                            value={filter}
                            onChange={(e) => onChangeFilter?.(e.target.value)}
                            className="waiter-input waiter-order-manager__select"
                        >
                            {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="button" className="waiter-btn waiter-btn--ghost" onClick={onRefresh}>
                        Refresh
                    </button>
                </div>

                {error ? <div className="waiter-error">{error}</div> : null}
                {loading ? <div className="waiter-placeholder">Loading orders…</div> : null}

                {!loading && !hasOrders ? (
                    <div className="waiter-placeholder">No orders match the selected filters.</div>
                ) : null}

                <div className="waiter-order-manager__list">
                    {hasOrders
                        ? orders.map((order) => {
                              const expandedState = expanded.has(order.id);
                              const statusLabel = buildStatusLabel(order.status);
                              const isBusy = busyOrderId === order.id;
                              return (
                                  <div key={order.id} className="waiter-order-card">
                                      <div className="waiter-order-card__header">
                                          <div className="waiter-order-card__headline">
                                              <div className="waiter-order-card__title">
                                                  Order #{order.id}
                                              </div>
                                              <div className="waiter-order-card__meta">
                                                  <span>{order.tableName}</span>
                                                  <span>•</span>
                                                  <span
                                                      className={`waiter-order-card__status waiter-order-card__status--${order.status}`}
                                                  >
                                                      {statusLabel}
                                                  </span>
                                                  <span>•</span>
                                                  <span>{formatDate(order.createdAt)}</span>
                                              </div>
                                          </div>
                                          <div className="waiter-order-card__totals">
                                              <div className="waiter-order-card__total">
                                                  {formatMoney(order.total)}
                                              </div>
                                              <div className="waiter-order-card__subtotal">
                                                  Subtotal {formatMoney(order.subtotal)}
                                              </div>
                                              <div className="waiter-order-card__tip">
                                                  Tip {formatMoney(order.tip)}
                                              </div>
                                          </div>
                                      </div>

                                      <div className="waiter-order-card__actions">
                                          <button
                                              type="button"
                                              className="waiter-btn waiter-btn--ghost"
                                              onClick={() => handleToggleOrder(order.id)}
                                          >
                                              {expandedState ? "Hide items" : "View items"}
                                          </button>
                                          <button
                                              type="button"
                                              className="waiter-btn waiter-btn--ghost"
                                              onClick={() => onReprint?.(order)}
                                              disabled={!order.reprintAvailable || isBusy}
                                          >
                                              {isBusy ? "Working…" : "Reprint"}
                                          </button>
                                          {order.status !== "paid" ? (
                                              <button
                                                  type="button"
                                                  className="waiter-btn waiter-btn--primary"
                                                  onClick={() => onMarkPaid?.(order)}
                                                  disabled={isBusy}
                                              >
                                                  {isBusy ? "Working…" : "Mark as paid"}
                                              </button>
                                          ) : (
                                              <span className="waiter-order-card__paid-badge">
                                                  Paid
                                              </span>
                                          )}
                                      </div>

                                      {expandedState ? (
                                          <div className="waiter-order-card__items">
                                              {order.items.map((item, idx) => (
                                                  <div key={`${order.id}-${idx}`} className="waiter-order-card__item">
                                                      <div className="waiter-order-card__item-name">
                                                          {item.name}
                                                      </div>
                                                      <div className="waiter-order-card__item-qty">
                                                          ×{item.quantity}
                                                      </div>
                                                      <div className="waiter-order-card__item-price">
                                                          {formatMoney(item.price)}
                                                      </div>
                                                      <div className="waiter-order-card__item-note">
                                                          {item.note ? (
                                                              <span className="waiter-order-card__item-note-text">
                                                                  “{item.note}”
                                                              </span>
                                                          ) : (
                                                              <span className="waiter-order-card__item-note-placeholder">
                                                                  —
                                                              </span>
                                                          )}
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : null}
                                  </div>
                              );
                          })
                        : null}
                </div>
            </div>
        </div>
    );
}
