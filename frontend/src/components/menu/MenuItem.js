import React, { memo, useState, useRef, useEffect } from "react";
import { PLACEHOLDER, fmtMKD } from "../common/format";
import editIcon from "../../assets/other-images/edit.svg";

const NOTE_MAX = 40; // ⬅️ increased

function MenuItem({
    item,
    qty = 0,
    onAdd,
    onRemove,
    className = "",
    variant = "menu",
    note = "",
    onNoteChange,
}) {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus();
    }, [editing]);

    if (!item) return null;

    const handleImgError = (e) => (e.currentTarget.src = PLACEHOLDER);
    const handleChange = (e) => {
        const v = e.target.value.slice(0, NOTE_MAX); // enforce hard cap
        onNoteChange?.(item.id, v);
    };

    const showImage = variant !== "cart";

    return (
        <li className={`menu-item ${className}`.trim()}>
            {showImage && (
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
                    onClick={() => onAdd?.(item)}
                />
            )}

            {/* INFO */}
            <div
                className="item-info"
                onClick={variant === "menu" ? () => onAdd?.(item) : undefined}
            >
                {variant === "cart" && (
                    <button
                        type="button"
                        className="note-toggle"
                        title={editing ? "Hide note" : "Add note"}
                        aria-label={editing ? "Hide note" : "Add note"}
                        onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }}
                    >
                        <img src={editIcon} alt="" className="note-toggle__icon" />
                    </button>
                )}
                <span className="item-name">{item.name}</span>
                {variant === "cart" ? (
                    <span className="cart-line">{`${qty} × ${fmtMKD(item.price)}`}</span>
                ) : (
                    <span className="item-price">{fmtMKD(item.price)}</span>
                )}
            </div>

            {/* NOTE full-width row below item when toggled or when a note exists */}
            {variant === "cart" && (editing || (note && note.length)) && (
                <div className="note-row">
                    {editing ? (
                        <input
                            ref={inputRef}
                            className="note-input"
                            type="text"
                            value={note || ""}
                            onChange={handleChange}
                            placeholder={`Add note for this item`}
                            maxLength={NOTE_MAX}
                            inputMode="text"
                        />
                    ) : (
                        <div className="note-display">{note}</div>
                    )}
                </div>
            )}

            {/* QTY CONTROLS */}
            {qty > 0 ? (
                <div className="qty-controls" aria-label="Quantity controls">
                    <button
                        className="qty-btn"
                        onClick={() => onRemove?.(item)}
                        aria-label={`Remove one ${item.name}`}
                    >
                        <span className="btn-symbol" aria-hidden="true">
                            &minus;
                        </span>
                    </button>
                    {variant !== "cart" ? (
                        <span className="qty-num" aria-live="polite">
                            {qty}
                        </span>
                    ) : null}
                    <button
                        className="qty-btn"
                        onClick={() => onAdd?.(item)}
                        aria-label={`Add one more ${item.name}`}
                    >
                        <span className="btn-symbol" aria-hidden="true">+</span>
                    </button>
                </div>
            ) : (
                <button
                    className="add-btn"
                    onClick={() => onAdd?.(item)}
                    aria-label={`Add ${item.name} to order`}
                >
                    <span className="btn-symbol" aria-hidden="true">+</span>
                </button>
            )}
        </li>
    );
}

export default memo(
    MenuItem,
    (prev, next) => {
        const a = prev.item || {};
        const b = next.item || {};
        return (
            prev.qty === next.qty &&
            prev.className === next.className &&
            prev.variant === next.variant &&
            (prev.note || "") === (next.note || "") &&
            a.id === b.id &&
            a.name === b.name &&
            a.price === b.price &&
            a.image_url === b.image_url
        );
    }
);
