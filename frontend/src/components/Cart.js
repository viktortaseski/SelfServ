// src/components/Cart.js
import React, { useMemo, useState } from "react";
import api from "../api";
import "./components-style/App.css";

function Cart({
    cart,
    tableToken,
    addToCart,
    removeFromCart,
    isWaiter,
    // NEW (optional) callbacks. If you pass them, UX is nicer.
    onBackToMenu,   // e.g. () => setView("menu")
    clearCart,      // e.g. () => setCart([])
}) {
    // Tip selection (percent)
    const [tipPercent, setTipPercent] = useState(0);

    // Calculate money parts
    const subtotal = useMemo(
        () =>
            (cart || []).reduce(
                (sum, item) =>
                    sum +
                    (Number(item.price) || 0) * (Number(item.quantity) || 0),
                0
            ),
        [cart]
    );
    const tipAmount = useMemo(
        () => (subtotal * tipPercent) / 100,
        [subtotal, tipPercent]
    );
    const total = useMemo(() => subtotal + tipAmount, [subtotal, tipAmount]);

    const handleCheckout = async () => {
        try {
            let res;
            if (isWaiter) {
                // waiter path (session cookie sent by axios via withCredentials=true in api.js)
                res = await api.post(
                    "/orders/waiter",
                    { tableToken, items: cart },
                    { withCredentials: true }
                );
            } else {
                // customer path
                res = await api.post("/orders/customer", { tableToken, items: cart });
            }

            const { orderId } = res.data || {};
            alert(orderId ? `Order placed! ID: ${orderId}` : "Order placed!");
        } catch (err) {
            const msg =
                err?.response?.data?.error || err?.message || "Something went wrong";
            console.error(err);
            alert(msg);
        }
    };

    const handleBackToMenu = () => {
        if (typeof onBackToMenu === "function") {
            onBackToMenu();
        } else {
            // graceful fallback if parent didn’t wire it
            window.location.hash = "/"; // defaults your app back to menu view
        }
    };

    const handleClearCart = () => {
        if (!cart || cart.length === 0) return;
        const ok = window.confirm("Empty the entire cart?");
        if (!ok) return;

        if (typeof clearCart === "function") {
            clearCart();
            return;
        }

        // Fallback: brute-force clear via remove calls (works without parent changes)
        cart.forEach((item) => {
            const times = Number(item.quantity) || 1;
            for (let i = 0; i < times; i++) removeFromCart(item);
        });
    };

    const disabled = (cart?.length || 0) === 0 || !tableToken;

    return (
        <div className="cart-container">
            <h2 className="cart-title">Your Cart</h2>

            {(!cart || cart.length === 0) && (
                <p className="empty-cart">Your cart is empty</p>
            )}

            <ul className="cart-list">
                {cart.map((item, i) => (
                    <li key={i} className="cart-item">
                        <div
                            className="cart-item-left"
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                            <span className="cart-item-name">{item.name}</span>
                            <span className="cart-item-price">
                                €{Number(item.price || 0).toFixed(2)}
                            </span>
                        </div>

                        <div className="cart-controls">
                            <button onClick={() => removeFromCart(item)}>-</button>
                            <span
                                className="cart-qty"
                                style={{ minWidth: 18, textAlign: "center" }}
                            >
                                {item.quantity}
                            </span>
                            <button onClick={() => addToCart(item)}>+</button>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Tip selector + totals */}
            {cart.length > 0 && (
                <div className="cart-summary" style={{ marginTop: 16 }}>
                    <div className="tip-selector" style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 6, fontWeight: 600 }}>Tip</div>
                        {[0, 5, 10, 15, 25].map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setTipPercent(p)}
                                className={`tip-btn${tipPercent === p ? " tip-btn--active" : ""}`}
                                style={{
                                    marginRight: 8,
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1px solid #d0d0d0",
                                    background: tipPercent === p ? "#e8f2ff" : "#fff",
                                    fontWeight: tipPercent === p ? 700 : 500,
                                    cursor: "pointer",
                                }}
                            >
                                {p}%
                            </button>
                        ))}
                    </div>

                    <div className="money-rows" style={{ marginBottom: 12 }}>
                        <Row label="Subtotal" value={subtotal} />
                        <Row label={`Tip (${tipPercent}%)`} value={tipAmount} />
                        <Row label="Total" value={total} bold />
                    </div>

                    {/* Navigation & destructive actions */}
                    <div
                        className="cart-actions"
                        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}
                    >
                        <button
                            type="button"
                            onClick={handleBackToMenu}
                            style={{
                                background: "#f1f5f9",
                                color: "#0f172a",
                                border: "1px solid #cbd5e1",
                                borderRadius: 8,
                                padding: "10px 14px",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            ← Back to Menu
                        </button>

                        <button
                            type="button"
                            onClick={handleClearCart}
                            style={{
                                background: "#dc3545",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                padding: "10px 14px",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Empty Cart
                        </button>
                    </div>
                </div>
            )}

            <button
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={disabled}
            >
                {isWaiter ? "Place Order (No Payment)" : "Place Order"}
            </button>
        </div>
    );
}

function Row({ label, value, bold }) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontWeight: bold ? 700 : 500,
            }}
        >
            <span>{label}</span>
            <span>€{Number(value || 0).toFixed(2)}</span>
        </div>
    );
}

export default Cart;
