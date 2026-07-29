import { formatMoney } from "./money";

const STATUS_FILTERS = [
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

function WaiterOrdersScreen({
    orders = [],
    loading,
    error,
    filter,
    onChangeFilter,
    onReprint,
    onMarkPaid,
    busyOrderId,
    selectedOrderId,
    onSelectOrder,
}) {
    const hasOrders = Array.isArray(orders) && orders.length > 0;

    return (
        <section className="waiter-section">
            <div className="waiter-menu__categories waiter-orders-screen__filters">
                {STATUS_FILTERS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        className={`waiter-chip ${filter === opt.value ? "waiter-chip--active" : ""}`}
                        onClick={() => onChangeFilter?.(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {error ? <div className="waiter-error">{error}</div> : null}
            {loading && !hasOrders ? <div className="waiter-placeholder">Loading orders…</div> : null}
            {!loading && !hasOrders ? (
                <div className="waiter-placeholder">No orders match the selected filters.</div>
            ) : null}

            <div className="waiter-order-list">
                {orders.map((order) => {
                    const isExpanded = selectedOrderId === order.id;
                    const isBusy = busyOrderId === order.id;
                    const statusLabel = STATUS_LABELS[order.status] || "Unknown";
                    const selectOrder = () => onSelectOrder?.(isExpanded ? null : order);
                    return (
                        <div
                            key={order.id}
                            className={`waiter-order-card ${
                                isExpanded ? "waiter-order-card--selected" : ""
                            }`}
                        >
                            <div
                                className="waiter-order-card__header"
                                role="button"
                                tabIndex={0}
                                onClick={selectOrder}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        selectOrder();
                                    }
                                }}
                            >
                                <div className="waiter-order-card__headline">
                                    <span className="waiter-order-card__title">
                                        {order.tableName} · #{order.id}
                                    </span>
                                    <span className="waiter-order-card__meta">
                                        <span
                                            className={`waiter-order-card__status waiter-order-card__status--${order.status}`}
                                        >
                                            {statusLabel}
                                        </span>
                                        <span>{formatDate(order.createdAt)}</span>
                                    </span>
                                </div>
                                <span className="waiter-order-card__total">
                                    {formatMoney(order.total)}
                                    <span className="waiter-order-card__caret">{isExpanded ? "▴" : "▾"}</span>
                                </span>
                            </div>

                            {isExpanded ? (
                                <div className="waiter-order-card__items waiter-receipt">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="waiter-receipt__item">
                                            <div className="waiter-receipt__row">
                                                <span className="waiter-receipt__qty">{item.quantity}×</span>
                                                <span className="waiter-receipt__name">{item.name}</span>
                                                <span className="waiter-receipt__unit">
                                                    {formatMoney(item.price)}
                                                </span>
                                                <span className="waiter-receipt__price">
                                                    {formatMoney(item.price * item.quantity)}
                                                </span>
                                            </div>
                                            {item.note ? (
                                                <div className="waiter-receipt__note">– {item.note}</div>
                                            ) : null}
                                        </div>
                                    ))}
                                    <div className="waiter-receipt__divider" />
                                    <div className="waiter-receipt__row">
                                        <span className="waiter-receipt__name">SUBTOTAL</span>
                                        <span className="waiter-receipt__price">
                                            {formatMoney(order.subtotal)}
                                        </span>
                                    </div>
                                    {order.tip > 0 ? (
                                        <div className="waiter-receipt__row">
                                            <span className="waiter-receipt__name">TIP</span>
                                            <span className="waiter-receipt__price">
                                                {formatMoney(order.tip)}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="waiter-order-card__actions">
                                <button
                                    type="button"
                                    className="waiter-btn waiter-btn--ghost"
                                    onClick={() => onReprint?.(order)}
                                    disabled={!order.reprintAvailable || isBusy}
                                >
                                    {isBusy ? "…" : "Reprint"}
                                </button>
                                {order.status !== "paid" ? (
                                    <button
                                        type="button"
                                        className="waiter-btn waiter-btn--primary"
                                        onClick={() => onMarkPaid?.(order)}
                                        disabled={isBusy}
                                    >
                                        {isBusy ? "…" : "Mark paid"}
                                    </button>
                                ) : (
                                    <span className="waiter-order-card__paid-badge">Paid</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default WaiterOrdersScreen;
