function WaiterQuickControls({ item, quantity = 0, onIncrease, onDecrease, onRequestNote }) {
    const disabled = !item;

    return (
        <div className="waiter-quickbar">
            <div className="waiter-quickbar__info">
                {item ? (
                    <>
                        <span className="waiter-quickbar__name">{item.name}</span>
                        <span className="waiter-quickbar__qty">×{quantity}</span>
                    </>
                ) : (
                    <span className="waiter-quickbar__placeholder">Select a product</span>
                )}
            </div>
            <div className="waiter-quickbar__actions">
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--minus"
                    onClick={onDecrease}
                    disabled={disabled || quantity === 0}
                >
                    −
                </button>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--note"
                    onClick={onRequestNote}
                    disabled={disabled || quantity === 0}
                >
                    Note
                </button>
                <button
                    type="button"
                    className="waiter-quickbar__btn waiter-quickbar__btn--plus"
                    onClick={onIncrease}
                    disabled={disabled}
                >
                    +
                </button>
            </div>
        </div>
    );
}

export default WaiterQuickControls;
