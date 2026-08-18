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
    canMerge,
}) {
    const canAct = !!selectedOrder;
    const isPriority = !!selectedOrder?.priority;
    const itemCount = Array.isArray(selectedOrder?.items) ? selectedOrder.items.length : 0;
    const canSplit = canAct && itemCount >= 2;
    const mergeAllowed = canMerge != null ? canMerge : canAct;

  return (
    <div>
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
        <div className="waiter-quickbar">
        <div className="waiter-quickbar__actions">
          <div className="waiter-quickbar__stack">
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--compact"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? "…" : "Refresh"}
                </button>
                <button
                    type="button"
                    className={`waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--compact waiter-quickbar__btn--priority ${
                        isPriority ? "waiter-quickbar__btn--priority-active" : ""
                    }`}
                    onClick={onTogglePriority}
                    disabled={!canAct || orderBusy}
                >
                    {orderBusy ? "…" : isPriority ? "Unflag" : "Priority"}
          </button>
          </div>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--split"
                    onClick={onSplit}
                    disabled={!canSplit || mergeBusy || orderBusy}
                    title={canAct && !canSplit ? "Needs at least 2 items to split" : undefined}
                >
                    Split
                </button>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note waiter-quickbar__btn--plus"
                    onClick={onMerge}
                    disabled={!mergeAllowed || mergeBusy}
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
    </div>
  );
}

export default WaiterOrdersControls;
