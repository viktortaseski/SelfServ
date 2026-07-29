import { useEffect, useState } from "react";

function WaiterSplitModal({ open, order, onClose, onConfirm, submitting }) {
    const [selections, setSelections] = useState({});

    useEffect(() => {
        if (open) setSelections({});
    }, [open, order?.id]);

    if (!open || !order) return null;

    const splitLines = Array.isArray(order.items)
        ? order.items.filter((item) => item.id != null && item.quantity > 0)
        : [];

    const setQty = (itemId, qty, max) => {
        const clamped = Math.max(0, Math.min(max, qty));
        setSelections((prev) => ({ ...prev, [itemId]: clamped }));
    };

    const hasSelection = Object.values(selections).some((qty) => qty > 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        const items = Object.entries(selections)
            .filter(([, qty]) => qty > 0)
            .map(([orderItemId, quantity]) => ({ orderItemId: Number(orderItemId), quantity }));
        if (!items.length) return;
        onConfirm?.(items);
    };

    return (
        <div className="waiter-modal waiter-note-modal__overlay">
            <form className="waiter-modal__content waiter-note-modal waiter-split-modal" onSubmit={handleSubmit}>
                <div className="waiter-note-modal__header">
                    <span className="waiter-note-modal__tag">SPLIT</span>
                    <h3 className="waiter-note-modal__item-name">
                        {order.tableName} · #{order.id}
                    </h3>
                </div>
                <p className="waiter-note-modal__hint">
                    Choose how many of each item to move onto a new check.
                </p>
                <div className="waiter-split-modal__list">
                    {splitLines.length === 0 ? (
                        <div className="waiter-placeholder">No items available to split.</div>
                    ) : (
                        splitLines.map((item) => {
                            const qty = selections[item.id] || 0;
                            return (
                                <div key={item.id} className="waiter-split-modal__row">
                                    <div className="waiter-split-modal__row-info">
                                        <span className="waiter-split-modal__row-name">{item.name}</span>
                                        <span className="waiter-split-modal__row-meta">
                                            of {item.quantity}
                                        </span>
                                    </div>
                                    <div className="waiter-split-modal__stepper">
                                        <button
                                            type="button"
                                            className="waiter-split-modal__stepper-btn"
                                            onClick={() => setQty(item.id, qty - 1, item.quantity)}
                                            disabled={qty <= 0}
                                        >
                                            −
                                        </button>
                                        <span className="waiter-split-modal__stepper-value">{qty}</span>
                                        <button
                                            type="button"
                                            className="waiter-split-modal__stepper-btn"
                                            onClick={() => setQty(item.id, qty + 1, item.quantity)}
                                            disabled={qty >= item.quantity}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="waiter-note-modal__actions">
                    <button
                        type="button"
                        className="waiter-note-modal__btn waiter-note-modal__btn--cancel"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="waiter-note-modal__btn waiter-note-modal__btn--save"
                        disabled={!hasSelection || submitting}
                    >
                        {submitting ? "…" : "Split"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default WaiterSplitModal;
