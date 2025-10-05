import React, { memo } from "react";
import { PLACEHOLDER, fmtMKD } from "../common/format";

function MenuItem({
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
                width={160}
                height={120}
                loading="lazy"
                decoding="async"
                fetchPriority="high"
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

// Avoid re-render unless something that affects UI changed.
export default memo(
    MenuItem,
    (prev, next) => {
        const a = prev.item || {};
        const b = next.item || {};
        return (
            prev.qty === next.qty &&
            prev.className === next.className &&
            a.id === b.id &&
            a.name === b.name &&
            a.price === b.price &&
            a.image_url === b.image_url
        );
    }
);
