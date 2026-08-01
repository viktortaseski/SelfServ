import React, { useEffect } from "react";
import { PLACEHOLDER, fmtMKD } from "../common/format";
import { t } from "../../i18n";

/**
 * Bottom sheet showing full item details (image, name, description, price)
 * with add/remove quantity controls. Slides up from the bottom over the menu.
 *
 * Props:
 *  - item: { id, name, price, image_url, description }
 *  - qty: number
 *  - onAdd / onRemove: (item) => void
 *  - onClose: () => void
 *  - closing: bool — true while the slide-down/fade-out animation is playing
 */
export default function ItemDetailSheet({
    item,
    qty = 0,
    onAdd,
    onRemove,
    onClear,
    onClose,
    closing = false,
}) {
    useEffect(() => {
        if (!item) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [item]);

    if (!item) return null;

    const handleImgError = (e) => (e.currentTarget.src = PLACEHOLDER);

    const handleClear = () => {
        onClear?.(item);
        onClose?.();
    };

    return (
        <div
            className={`item-sheet-overlay ${closing ? "is-closing" : ""}`}
            onClick={onClose}
        >
            <div
                className={`item-sheet ${closing ? "is-sliding-out" : "is-sliding-in"}`}
                role="dialog"
                aria-modal="true"
                aria-label={item.name}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="item-sheet-media">
                    <img
                        src={item.image_url || PLACEHOLDER}
                        alt={item.name}
                        className="item-sheet-image"
                        onError={handleImgError}
                    />
                    <button
                        type="button"
                        className="qty-btn qty-btn--lg item-sheet-close"
                        onClick={onClose}
                        aria-label={t("menu.close")}
                    >
                        <span className="btn-symbol" aria-hidden="true">&times;</span>
                    </button>
                </div>

                <div className="item-sheet-body">
                    <div className="item-sheet-header">
                        <span className="item-sheet-name">{item.name}</span>
                        <span className="item-sheet-price">{fmtMKD(item.price)}</span>
                    </div>
                    {item.description && (
                        <p className="item-sheet-desc">{item.description}</p>
                    )}
                </div>

                <div className="item-sheet-footer">
                    {qty > 0 && (
                        <button
                            type="button"
                            className="btn btn-secondary item-sheet-clear"
                            onClick={handleClear}
                        >
                            {t("menu.clear")}
                        </button>
                    )}
                    <button
                        type="button"
                        className="qty-btn qty-btn--lg"
                        onClick={() => qty > 0 && onRemove?.(item)}
                        disabled={qty <= 0}
                        aria-label={`Remove one ${item.name}`}
                    >
                        <span className="btn-symbol" aria-hidden="true">&minus;</span>
                    </button>
                    <span className="qty-num item-sheet-qty" aria-live="polite">
                        {qty}
                    </span>
                    <button
                        type="button"
                        className="qty-btn qty-btn--lg"
                        onClick={() => onAdd?.(item)}
                        aria-label={`Add one more ${item.name}`}
                    >
                        <span className="btn-symbol" aria-hidden="true">+</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
