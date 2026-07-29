function WaiterOrdersControls({
    selectedOrder,
    onRefresh,
    onMerge,
    onSplit,
    onClose,
    onTogglePriority,
    mergeBusy,
    orderBusy,
    refreshing,
}) {
    const canAct = !!selectedOrder;
    const isPriority = !!selectedOrder?.priority;

    return (
        <div className="waiter-quickbar">
            <div className="waiter-quickbar__info">
                {selectedOrder ? (
                    <>
                        <span className="waiter-quickbar__name">{selectedOrder.tableName}</span>
                        <span className="waiter-quickbar__qty">#{selectedOrder.id}</span>
                    </>
                ) : (
                    <span className="waiter-quickbar__placeholder">Select an order</span>
                )}
            </div>
            <div className="waiter-quickbar__actions">
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? "…" : "Refresh"}
                </button>
                <button
                    type="button"
                    className={`waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--priority ${
                        isPriority ? "waiter-quickbar__btn--priority-active" : ""
                    }`}
                    onClick={onTogglePriority}
                    disabled={!canAct || orderBusy}
                >
                    {orderBusy ? "…" : isPriority ? "Unflag" : "Priority"}
                </button>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--split"
                    onClick={onSplit}
                    disabled={!canAct || mergeBusy || orderBusy}
                >
                    Split
                </button>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--plus"
                    onClick={onMerge}
                    disabled={!canAct || mergeBusy}
                >
                    {mergeBusy ? "…" : "Merge"}
                </button>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--minus"
                    onClick={onClose}
                    disabled={!canAct || orderBusy}
                >
                    {orderBusy ? "…" : "Close"}
                </button>
            </div>
        </div>
    );
}

export default WaiterOrdersControls;
