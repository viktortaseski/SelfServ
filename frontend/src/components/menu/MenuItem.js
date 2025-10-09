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
                onClick={() => (variant === "menu" ? onAdd?.(item) : undefined)}
            >
                <span className="item-name">{item.name}</span>
                {variant === "cart" ? (
                    <span className="cart-line">{`${qty} × ${fmtMKD(item.price)}`}</span>
                ) : (
                    <span className="item-price">{fmtMKD(item.price)}</span>
                )}
            </div>

            {/* NOTE between info and +/- */}
            {variant === "cart" && (
                <div className="note-slot">
                    {/* Minimal: pill → input; if text exists show compact text, click to edit */}
                    {editing ? (<input
                        ref={inputRef}
                        className="note-inline-input"
                        type="text"
                        value={note || ""}
                        onChange={handleChange}
                        onBlur={() => setEditing(false)}
                        placeholder={`Type note (max ${NOTE_MAX})…`}
                        maxLength={NOTE_MAX}
                        inputMode="text"
                    />
                    ) : note && note.length ? (
                        <button
                            type="button"
                            className="note-text"
                            title="Edit note"
                            onClick={() => setEditing(true)}
                        >
                            {note}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="note-pill"
                            onClick={() => setEditing(true)}
                            aria-label="Add note"
                            title="Add note"
                        >
                            <img src={editIcon} alt="" className="note-pill__icon-img" />
                            Add Note
                        </button>
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
                    {variant !== "cart" ? <span className="qty-num" aria-live="polite">{qty}</span>
                        : null}
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
