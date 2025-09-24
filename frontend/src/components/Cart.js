// src/components/Cart.js
import React, { useMemo, useState } from "react";
import api from "../api";
import "./components-style/App.css";   // global + navbar + pill
import "./components-style/cart.css";  // cart-only tweaks (no navbar overrides)
import binIcon from "../assets/other-images/bin.png";

const PLACEHOLDER = "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

function Cart({
    cart = [],
    tableToken,
    addToCart,
    removeFromCart,
    isWaiter,
    clearCart, // <-- pass from parent if available (preferred)
    notify,
}) {
    const TIP_PRESETS = [0, 50, 100];
    const [tipAmount, setTipAmount] = useState(0);
    const [note, setNote] = useState("");

    const fmtMKD = (n) => `${Math.round(Number(n || 0))} MKD`;

    const itemsCount = useMemo(
        () => cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        [cart]
    );

    const subtotal = useMemo(
        () =>
            (cart || []).reduce(
                (sum, item) =>
                    sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
                0
            ),
        [cart]
    );

    const total = useMemo(
        () => subtotal + (Number(tipAmount) || 0),
        [subtotal, tipAmount]
    );

    const handleCustomTip = () => {
        const raw = window.prompt("Enter tip amount (MKD):", String(tipAmount || 0));
        if (raw == null) return;
        const v = Math.max(0, Math.round(Number(raw) || 0));
        setTipAmount(v);
    };

    const handleClearAll = () => {
        if (!cart.length) return;
        const ok = window.confirm("Clear all items from your order?");
        if (!ok) return;

        if (typeof clearCart === "function") {
            clearCart();
        } else {
            // fallback if clearCart not provided
            cart.forEach((item) => {
                const q = Number(item.quantity) || 0;
                for (let i = 0; i < q; i++) removeFromCart(item);
            });
        }

        // show toast
        if (typeof notify === "function") notify("All items cleared.");
    };



    const handleCheckout = async () => {
        if (!cart.length) return;
        if (!tableToken) {
            alert("Missing table token. Please scan the table QR again.");
            return;
        }

        try {
            const payload = {
                tableToken,
                items: cart,
                tip: Math.round(Number(tipAmount) || 0),
                note: note || "",
            };

            const res = await (isWaiter
                ? api.post("/orders/waiter", payload, { withCredentials: true })
                : api.post("/orders/customer", payload));

            const { orderId } = res.data || {};
            alert(orderId ? `Order placed! ID: ${orderId}` : "Order placed!");
        } catch (err) {
            const msg = err?.response?.data?.error || err?.message || "Something went wrong";
            console.error(err);
            alert(msg);
        }
    };

    return (
        <div className="menu-container cart-container">
            {/* Header row: title + Clear All */}
            <div className="cart-header-row">
                <h3 className="page-head" style={{ margin: 0 }}>Your Order</h3>

                {/* Surrounding DIV (96x32, #E5E5E5, radius 24px) */}
                <div className="clear-all-wrap">
                    <button
                        type="button"
                        className="clear-all-btn"
                        onClick={handleClearAll}
                        aria-label="Clear all items in the order"
                    >
                        <img
                            src={binIcon}
                            alt=""
                            className="clear-all-icon"
                            draggable="false"
                        />
                        <span>Clear All</span>
                    </button>
                </div>
            </div>

            {(!cart || cart.length === 0) && (
                <p className="empty-cart">Your cart is empty</p>
            )}

            <ul className="menu-list menu-list--full">
                {cart.map((item) => (
                    <li key={item.id} className="menu-item">
                        <img
                            src={item.image_url || PLACEHOLDER}
                            alt={item.name}
                            className="thumb"
                            loading="lazy"
                        />
                        <div className="item-info" onClick={() => addToCart(item)}>
                            <span className="item-name">{item.name}</span>
                            <span className="item-price">{fmtMKD(item.price)}</span>
                        </div>

                        <div className="qty-controls" aria-label="Quantity controls">
                            <button
                                className="qty-btn"
                                aria-label={`Remove one ${item.name}`}
                                onClick={() => removeFromCart(item)}
                            >
                                &minus;
                            </button>
                            <span className="qty-num" aria-live="polite">
                                {item.quantity}
                            </span>
                            <button
                                className="qty-btn"
                                aria-label={`Add one more ${item.name}`}
                                onClick={() => addToCart(item)}
                            >
                                +
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {cart.length > 0 && (
                <>
                    <div className="total-row">
                        <span className="total-label">Total</span>
                        <span className="total-amount">{fmtMKD(total)}</span>
                    </div>

                    <div className="block">
                        <div className="block-title">Add Tip</div>
                        <div className="tip-buttons">
                            {TIP_PRESETS.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    className={`tip-chip ${tipAmount === amt ? "is-active" : ""}`}
                                    onClick={() => setTipAmount(amt)}
                                >
                                    {amt} MKD
                                </button>
                            ))}
                            <button type="button" className="tip-chip" onClick={handleCustomTip}>
                                Custom
                            </button>
                        </div>
                    </div>

                    <div className="block">
                        <div className="block-title">Add Note</div>
                        <input
                            className="note-input"
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Message for the waiter"
                        />
                    </div>

                    <button className="view-order-pill" onClick={handleCheckout}>
                        <span className="pill-left">
                            <span className="pill-count">{itemsCount}</span>
                            <span className="pill-text">Place Order</span>
                        </span>
                        <span className="pill-total">{fmtMKD(total)}</span>
                    </button>
                </>
            )}
        </div>
    );
}

export default Cart;
