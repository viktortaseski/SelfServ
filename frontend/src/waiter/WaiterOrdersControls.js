function WaiterOrdersControls({ onRefresh, onClose, onMerge, canMerge, busy, refreshing }) {
    return (
        <div className="waiter-orders-controls">
            <button
                type="button"
                className="waiter-orders-controls__btn"
                onClick={onRefresh}
                disabled={refreshing}
            >
                {refreshing ? "…" : "Refresh"}
            </button>
            <button
                type="button"
                className="waiter-orders-controls__btn waiter-orders-controls__btn--merge"
                onClick={onMerge}
                disabled={!canMerge || busy}
            >
                {busy ? "…" : "Merge"}
            </button>
            <button
                type="button"
                className="waiter-orders-controls__btn waiter-orders-controls__btn--close"
                onClick={onClose}
            >
                Close
            </button>
        </div>
    );
}

export default WaiterOrdersControls;
