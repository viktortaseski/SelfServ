import React, { memo } from "react";
import { fmtMKD, PLACEHOLDER } from "../common/format";

function PickCard({ item, onAdd }) {
    if (!item) return null;

    const isLongName = (item.name || "").length > 18;

    const handleAdd = () => onAdd?.(item);
    const handleImgError = (e) => {
        e.currentTarget.src = PLACEHOLDER;
    };

    return (
        <div className="pick-card" tabIndex={0}>
            <img
                className={`pick-image ${isLongName ? "pick-image--tight" : ""}`}
                src={item.image_url || PLACEHOLDER}
                alt={item.name}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                onClick={handleAdd}
                onError={handleImgError}
            />
            <div
                className={`pick-meta ${isLongName ? "pick-meta--tight" : ""}`}
                onClick={handleAdd}
            >
                <div className="pick-name">{item.name}</div>
                <div className="pick-price">{fmtMKD(item.price || 0)}</div>
            </div>
            <button
                className="pick-add"
                aria-label={`Add ${item.name} to order`}
                onClick={handleAdd}
            >
                <span className="btn-symbol" aria-hidden="true">+</span>
            </button>
        </div>
    );
}

export default memo(
    PickCard,
    (prev, next) => {
        const a = prev.item || {};
        const b = next.item || {};
        return (
            a.id === b.id &&
            a.name === b.name &&
            a.price === b.price &&
            a.image_url === b.image_url
        );
    }
);
