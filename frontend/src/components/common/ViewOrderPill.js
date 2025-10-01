// src/components/common/ViewOrderPill.js
import React from "react";

/**
 * Reusable sticky pill used in Menu (View Order) and Cart (Place Order).
 *
 * Props:
 * - count: number (circle at left)
 * - text: string (main label)
 * - totalText: string (right-side total already formatted)
 * - onClick: function
 * - hidden: boolean (adds "pill-hidden" class to slide it down)
 * - disabled: boolean
 * - ariaDisabled: boolean (optional override for aria-disabled)
 * - className: string (optional extra classes)
 */
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
