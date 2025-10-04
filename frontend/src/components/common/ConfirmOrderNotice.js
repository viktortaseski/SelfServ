import React from "react";
import { fmtMKD } from "../common/format";

/**
 * Centered modal to confirm placing an order.
 * Not related to Notification component/styles.
 *
 * Props:
 *  - items: [{ id, name, price, quantity }]
 *  - subtotal: number
 *  - tip: number
 *  - total: number
 *  - onConfirm: () => void
 *  - onCancel: () => void
 */
export default function ConfirmOrderNotice({
    items = [],
    subtotal = 0,
    tip = 0,
    total = 0,
    onConfirm,
    onCancel,
}) {
    return (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
            <div className="confirm-modal">
                <div className="confirm-header">
                    <div className="confirm-title">Confirm your order?</div>
                </div>

                <div className="confirm-body">
                    <div className="confirm-list" role="region" aria-label="Order items">
                        {items.map((it) => {
                            const qty = Number(it.quantity) || 0;
                            const unit = Number(it.price) || 0;
                            const line = unit * qty;
                            return (
                                <div key={it.id} className="confirm-row">
                                    <div className="confirm-name">
                                        {it.name} <span className="confirm-qty">×{qty}</span>
                                    </div>
                                    <div className="confirm-line">{fmtMKD(line)}</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="confirm-summary">
                        <div className="confirm-row">
                            <div className="confirm-label">Subtotal</div>
                            <div className="confirm-value">{fmtMKD(subtotal)}</div>
                        </div>
                        <div className="confirm-row">
                            <div className="confirm-label">Tip</div>
                            <div className="confirm-value">{fmtMKD(tip)}</div>
                        </div>
                        <div className="confirm-row confirm-row--total">
                            <div className="confirm-label">Total</div>
                            <div className="confirm-value">{fmtMKD(total)}</div>
                        </div>
                    </div>
                </div>

                <div className="confirm-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onConfirm}
                    >
                        Yes, order
                    </button>
                </div>
            </div>
        </div>
    );
}
