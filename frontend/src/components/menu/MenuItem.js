import React from "react";
import { PLACEHOLDER, fmtMKD } from "../common/format";

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
