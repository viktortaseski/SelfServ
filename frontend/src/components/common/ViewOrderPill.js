export default function ViewOrderPill({
    count = 0,
    text = "",
    totalText = "",
    onClick,
    hidden = false,
    disabled = false,
    ariaDisabled,
    className = "",
    variant = "default", // "default" (menu) | "center" (cart)
}) {
    const classes = [
        "view-order-pill",
        hidden ? "pill-hidden" : "",
        variant === "center" ? "view-order-pill--center" : "",
        className || "",
    ]
        .filter(Boolean)
        .join(" ");

    const hasCenterTotal = variant === "center" && Boolean(totalText);

    return (
        <button
            className={classes}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={ariaDisabled ?? disabled}
        >
            {variant === "center" ? (
                <span className="pill-center">
                    <span className="pill-text">{text}</span>
                    {hasCenterTotal && (
                        <>
                            <span className="pill-dot" aria-hidden="true">•</span>
                            <span className="pill-total">{totalText}</span>
                        </>
                    )}
                </span>
            ) : (
                <>
                    <span className="pill-left">
                        <span className="pill-count">{count}</span>
                        <span className="pill-text">{text}</span>
                    </span>
                    <span className="pill-total">{totalText}</span>
                </>
            )}
        </button>
    );
}
