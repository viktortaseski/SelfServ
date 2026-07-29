function WaiterOrdersControls({
    selectedOrder,
    onRefresh,
    onMerge,
    onSplit,
    onClose,
    mergeBusy,
    closeBusy,
    refreshing,
}) {
    const canAct = !!selectedOrder;

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
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--split"
                    onClick={onSplit}
                    disabled={!canAct || mergeBusy || closeBusy}
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
                    disabled={!canAct || closeBusy}
                >
                    {closeBusy ? "…" : "Close"}
                </button>
            </div>
        </div>
    );
}

export default WaiterOrdersControls;
