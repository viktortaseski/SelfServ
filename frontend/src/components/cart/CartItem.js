import React, { useState, useRef, useEffect } from "react";
import editIcon from "../../assets/other-images/edit.svg";
import { fmtMKD } from "../common/format";

const NOTE_MAX = 40;

function CartItem({ item, qty = 0, note = "", onAdd, onRemove, onNoteChange }) {
  const [openNote, setOpenNote] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { if (openNote && inputRef.current) inputRef.current.focus(); }, [openNote]);

  if (!item) return null;

  const handleChange = (e) => {
    const v = e.target.value.slice(0, NOTE_MAX);
    onNoteChange?.(item.id, v);
  };

  return (
    <li className="cart-item">
      <div className="ci-main">
        <button
          type="button"
          className="ci-note-toggle"
          title={openNote ? "Hide note" : "Add note"}
          onClick={() => setOpenNote((v) => !v)}
        >
          <img src={editIcon} alt="" className="ci-note-icon" />
        </button>

        <div className="ci-info">
          <div className="ci-name">{item.name}</div>
          <div className="ci-sub">{`${qty} × ${fmtMKD(item.price)}`}</div>
        </div>

        <div className="ci-qty">
          <button className="ci-qty-btn" onClick={() => onRemove?.(item)} aria-label={`Remove one ${item.name}`}>
            &minus;
          </button>
          <span className="ci-qty-num">{qty}</span>
          <button className="ci-qty-btn" onClick={() => onAdd?.(item)} aria-label={`Add one ${item.name}`}>
            +
          </button>
        </div>
      </div>

      {(openNote || (note && note.length)) && (
        <div className="ci-note-row">
          {openNote ? (
            <input
              ref={inputRef}
              className="ci-note-input"
              type="text"
              value={note || ""}
              onChange={handleChange}
              placeholder="Add note for this item"
              maxLength={NOTE_MAX}
              inputMode="text"
            />
          ) : (
            <div className="ci-note-display">{note}</div>
          )}
        </div>
      )}
    </li>
  );
}

export default CartItem;

