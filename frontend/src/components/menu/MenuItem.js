// src/components/menu/MenuItem.js
import React from "react";
import { PLACEHOLDER, fmtMKD } from "../common/format";

/**
 * Reusable menu item row used across Menu and Cart.
 *
 * Props:
 * - item: { id, name, price, image_url }
 * - qty: number (quantity in cart; 0 shows "+", >0 shows qty controls)
 * - onAdd(item)
 * - onRemove(item)
 * - className: string (optional extra class for li; e.g., "menu-item-cart" in Cart)
 */
export default function MenuItem({
    item,
    qty = 0,
    onAdd,
    onRemove,
    className = "",
}) {
    if (!item) return null;

    const handleImgError = (e) => {
        e.currentTarget.src = PLACEHOLDER;
    };

    return (
        <li className={`menu-item ${className}`.trim()}>
            <img
                src={item.image_url || PLACEHOLDER}
                alt={item.name}
                className="thumb"
                loading="lazy"
                onError={handleImgError}
            />
            <div className="item-info" onClick={() => onAdd?.(item)}>
                <span className="item-name">{item.name}</span>
                <span className="item-price">{fmtMKD(item.price)}</span>
            </div>

            {qty > 0 ? (
                <div className="qty-controls" aria-label="Quantity controls">
                    <button
                        className="qty-btn"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => onRemove?.(item)}
                    >
                        &minus;
                    </button>
                    <span className="qty-num" aria-live="polite">
                        {qty}
                    </span>
                    <button
                        className="qty-btn"
                        aria-label={`Add one more ${item.name}`}
                        onClick={() => onAdd?.(item)}
                    >
                        +
                    </button>
                </div>
            ) : (
                <button
                    className="add-btn"
                    aria-label={`Add ${item.name} to order`}
                    onClick={() => onAdd?.(item)}
                >
                    +
                </button>
            )}
        </li>
    );
}
