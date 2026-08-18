import { formatMoney } from "./money";

function WaiterSummary({ items = [], total, selectedItemId, onSelectItem, submitting }) {
    return (
        <section className="waiter-section">
            <div className="waiter-receipt">
                {items.map((line) => {
                    const { item, quantity, note } = line;
                    const price = Number(item?.price) || 0;
                    const isSelected = item.id === selectedItemId;
                    return (
                        <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className={`waiter-receipt__item ${
                                isSelected ? "waiter-receipt__item--selected" : ""
                            }`}
                            onClick={() => onSelectItem?.(item)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSelectItem?.(item);
                                }
                            }}
                        >
                            <div className="waiter-receipt__row">
                                <span className="waiter-receipt__qty">{quantity}×</span>
                                <span className="waiter-receipt__name">{item.name}</span>
                                <span className="waiter-receipt__unit">{formatMoney(price)}</span>
                                <span className="waiter-receipt__price">
                                    {formatMoney(price * quantity)}
                                </span>
                            </div>
                            {note ? <div className="waiter-receipt__note">– {note}</div> : null}
                        </div>
                    );
                })}
                <div className="waiter-receipt__divider" />
                <div className="waiter-receipt__row waiter-receipt__row--total">
                    <span className="waiter-receipt__name">TOTAL</span>
                    <span className="waiter-receipt__price">{formatMoney(total)}</span>
                </div>
            </div>

            {submitting ? <div className="waiter-placeholder">Submitting order…</div> : null}
        </section>
    );
}

export default WaiterSummary;
