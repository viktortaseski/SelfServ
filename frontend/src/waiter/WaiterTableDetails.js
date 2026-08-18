import { formatMoney } from "./money";

function WaiterTableDetails({ orders = [], loading, selectedOrderId, onSelectOrder }) {
    const hasOrders = Array.isArray(orders) && orders.length > 0;
    const activeOrder = hasOrders
        ? orders.find((order) => order.id === selectedOrderId) || orders[0]
        : null;
    const lines = activeOrder ? activeOrder.items || [] : [];
    const grandTotal = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

    return (
        <section className="waiter-section">
            {loading && !hasOrders ? (
                <div className="waiter-placeholder">Loading order…</div>
            ) : null}
            {!loading && !hasOrders ? (
                <div className="waiter-placeholder">No open orders for this table.</div>
            ) : null}

            {hasOrders ? (
                <>
                    {orders.length > 1 ? (
                        <div className="waiter-table-details__notice">
                            This table has {orders.length} separate checks. Select one to manage
                            or pay it, or merge them into a single bill.
                        </div>
                    ) : null}

                    <div className="waiter-receipt waiter-table-details__receipt">
                        {lines.map((line, idx) => (
                            <div key={line.id ?? idx} className="waiter-receipt__item">
                                <div className="waiter-receipt__row">
                                    <span className="waiter-receipt__qty">{line.quantity}×</span>
                                    <span className="waiter-receipt__name">{line.name}</span>
                                    <span className="waiter-receipt__unit">
                                        {formatMoney(line.price)}
                                    </span>
                                    <span className="waiter-receipt__price">
                                        {formatMoney(line.price * line.quantity)}
                                    </span>
                                </div>
                                {line.note ? (
                                    <div className="waiter-receipt__note">– {line.note}</div>
                                ) : null}
                            </div>
                        ))}
                        <div className="waiter-receipt__divider" />
                        <div className="waiter-receipt__row waiter-receipt__row--total">
                            <span className="waiter-receipt__name">TOTAL</span>
                            <span className="waiter-receipt__price">
                                {formatMoney(activeOrder?.total ?? 0)}
                            </span>
                        </div>
                    </div>

                    {orders.length > 1 ? (
                        <>
                            <div className="waiter-table-details__grand-total">
                                Table total (all checks): {formatMoney(grandTotal)}
                            </div>
                            <div className="waiter-table-details__chips">
                                {orders.map((order) => (
                                    <button
                                        key={order.id}
                                        type="button"
                                        className={`waiter-chip ${
                                            order.id === activeOrder?.id
                                                ? "waiter-chip--active"
                                                : ""
                                        }`}
                                        onClick={() => onSelectOrder?.(order)}
                                    >
                                        #{order.id} · {formatMoney(order.total)}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}
                </>
            ) : null}
        </section>
    );
}

export default WaiterTableDetails;
