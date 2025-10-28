function fallbackFormat(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0 MKD";
    return `${Math.round(num)} MKD`;
}

function WaiterSummary({
    table,
    items = [],
    total,
    formatPrice = fallbackFormat,
    onIncrease,
    onDecrease,
    onRequestNote,
    submitting,
    error,
}) {
    return (
        <section className="waiter-section">
            <header className="waiter-section__header waiter-section__header--column">
                <div>
                    <h2 className="waiter-title">
                        Review order for {table?.name || `Table ${table?.id || "?"}`}
                    </h2>
                    <p className="waiter-subtitle">
                        Confirm the items and quantities. Use the Next button below to submit.
                    </p>
                </div>
            </header>

            {error ? <div className="waiter-error">{error}</div> : null}

            <div className="waiter-summary__list">
                {items.map((line) => {
                    const { item, quantity, note } = line;
                    const price = Number(item?.price) || 0;
                    return (
                        <div key={item.id} className="waiter-summary__item">
                            <div className="waiter-summary__details">
                                <div className="waiter-summary__row">
                                    <span className="waiter-summary__name">{item.name}</span>
                                    <div className="waiter-summary__row-right">
                                        <span className="waiter-summary__quantity-badge">×{quantity}</span>
                                        <span className="waiter-summary__price">{Math.round(price)} MKD</span>
                                    </div>
                                </div>
                                <div className="waiter-summary__meta">
                                    <span className="waiter-summary__line-total">
                                        Line total: {formatPrice(price * quantity)}
                                    </span>
                                </div>
                                <div className="waiter-summary__note">
                                    {note ? (
                                        <span className="waiter-note__preview">{note}</span>
                                    ) : (
                                        <span className="waiter-note__placeholder">No note added</span>
                                    )}
                                    <button
                                        type="button"
                                        className="waiter-note__btn"
                                        onClick={() => onRequestNote?.(item, note)}
                                    >
                                        {note ? "Edit note" : "Add note"}
                                    </button>
                                </div>
                            </div>
                            <div className="waiter-summary__actions">
                                <button
                                    type="button"
                                    className="waiter-counter__btn"
                                    onClick={() => onDecrease(item)}
                                    disabled={quantity === 0 || submitting}
                                >
                                    -
                                </button>
                                <button
                                    type="button"
                                    className="waiter-counter__btn waiter-counter__btn--primary"
                                    onClick={() => onIncrease(item)}
                                    disabled={submitting}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <footer className="waiter-summary__footer">
                <div className="waiter-summary__total">
                    <span>Total</span>
                    <strong>{formatPrice(total)}</strong>
                </div>
                {submitting ? <div className="waiter-placeholder">Submitting order…</div> : null}
                <p className="waiter-summary__hint">
                    Use the Next button below to place the order. You can still adjust quantities here.
                </p>
            </footer>
        </section>
    );
}

export default WaiterSummary;
