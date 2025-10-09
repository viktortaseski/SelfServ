import React, { memo, useState, useRef, useEffect } from "react";
import { PLACEHOLDER, fmtMKD } from "../common/format";
import editIcon from "../../assets/other-images/edit.svg";

function MenuItem({
    item,
    qty = 0,
    onAdd,
    onRemove,
    className = "",
    variant = "menu",          // "menu" | "cart"
    note = "",
    onNoteChange,              // (id, text) => void
}) {
    // Hooks must be unconditional
    const [editing, setEditing] = useState(false);
    const inputRef = useRef(null);
    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus();
    }, [editing]);

    if (!item) return null;

    const handleImgError = (e) => (e.currentTarget.src = PLACEHOLDER);
    const handleEditToggle = (e) => {
        e.stopPropagation();
        setEditing((v) => !v);
    };
    const handleChange = (e) => {
        onNoteChange?.(item.id, e.target.value.slice(0, 200));
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
                onClick={() => (variant === "menu" ? onAdd?.(item) : undefined)}
            >
                <span className="item-name">{item.name}</span>
                {variant === "cart" ? (
                    <span className="cart-line">{`${qty} × ${fmtMKD(item.price)}`}</span>
                ) : (
                    <span className="item-price">{fmtMKD(item.price)}</span>
                )}
            </div>

            {/* NOTE (sits between info and +/-) */}
            {variant === "cart" && (
                <div className="note-slot">
                    {!editing ? (
                        <button
                            type="button"
                            className={`note-pill ${note ? "has-text" : ""}`}
                            onClick={handleEditToggle}
                            aria-label="Add note"
                        >
                            <img src={editIcon} alt="" className="note-pill__icon-img" />
                            {note && note.length ? note : "Add Note"}
                        </button>
                    ) : (
                        <input
                            ref={inputRef}
                            className="note-inline-input"
                            type="text"
                            value={note || ""}
                            onChange={handleChange}
                            onBlur={() => setEditing(false)}
                            placeholder="Type note (max 200)…"
                            maxLength={200}
                            inputMode="text"
                        />
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
                        &minus;
                    </button>

                    <button
                        className="qty-btn"
                        onClick={() => onAdd?.(item)}
                        aria-label={`Add one more ${item.name}`}
                    >
                        +
                    </button>
                </div>
            ) : (
                <button
                    className="add-btn"
                    onClick={() => onAdd?.(item)}
                    aria-label={`Add ${item.name} to order`}
                >
                    +
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
