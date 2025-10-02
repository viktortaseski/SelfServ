export default function ViewOrderPill({
    count = 0,
    text = "",
    totalText = "",
    onClick,
    hidden = false,
    disabled = false,
    ariaDisabled,
    className = "",
}) {
    const classes = [
        "view-order-pill",
        hidden ? "pill-hidden" : "",
        className || "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            className={classes}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={ariaDisabled ?? disabled}
        >
            <span className="pill-left">
                <span className="pill-count">{count}</span>
                <span className="pill-text">{text}</span>
            </span>
            <span className="pill-total">{totalText}</span>
        </button>
    );
}
