// src/components/Cart.js
import React, { useMemo, useState } from "react";
import api from "../api";
import "./components-style/App.css";
import "./components-style/cart.css";

function Cart({
    cart,
    tableToken,
    addToCart,
    removeFromCart,
    isWaiter,
    onBackToMenu, // optional: () => setView("menu")
    clearCart,    // optional: () => setCart([])
}) {
    // Tip selection (percent)
    const [tipPercent, setTipPercent] = useState(0);

    // Currency formatter (display as whole MKD, e.g., "200 MKD")
    const fmtMKD = (n) => `${Math.round(Number(n || 0))} MKD`;

    // Calculate money parts
    const subtotal = useMemo(
        () =>
            (cart || []).reduce(
                (sum, item) =>
                    sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
                0
            ),
        [cart]
    );
    const tipAmount = useMemo(() => (subtotal * tipPercent) / 100, [subtotal, tipPercent]);
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
            const msg = err?.response?.data?.error || err?.message || "Something went wrong";
            console.error(err);
            alert(msg);
        }
    };

    const handleBackToMenu = () => {
        if (typeof onBackToMenu === "function") {
            onBackToMenu();
        } else {
            window.location.hash = "/"; // fallback to menu
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

        // Fallback: brute-force clear via remove calls
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
                        <div className="cart-item-left">
                            <span className="cart-item-name">{item.name}</span>
                            <span className="cart-item-price">
                                {fmtMKD(item.price)}
                            </span>
                        </div>

                        <div className="cart-controls">
                            <button
                                type="button"
                                aria-label={`Remove one ${item.name}`}
                                className="qty-btn"
                                onClick={() => removeFromCart(item)}
                            >
                                &minus;
                            </button>
                            <span className="cart-qty" aria-live="polite">
                                {item.quantity}
                            </span>
                            <button
                                type="button"
                                aria-label={`Add one ${item.name}`}
                                className="qty-btn"
                                onClick={() => addToCart(item)}
                            >
                                +
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Tip selector + totals */}
            {cart.length > 0 && (
                <div className="cart-summary">
                    <div className="tip-selector">
                        <div className="tip-label">Tip</div>
                        <div className="tip-buttons">
                            {[0, 5, 10, 15, 25].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setTipPercent(p)}
                                    className={`tip-btn ${tipPercent === p ? "is-active" : ""}`}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="money-rows">
                        <Row label="Subtotal" value={subtotal} fmt={fmtMKD} />
                        <Row label={`Tip (${tipPercent}%)`} value={tipAmount} fmt={fmtMKD} />
                        <Row label="Total" value={total} bold fmt={fmtMKD} />
                    </div>

                    {/* Navigation & destructive actions */}
                    <div className="cart-actions">
                        <button
                            type="button"
                            onClick={handleBackToMenu}
                            className="btn btn-secondary"
                        >
                            ← Back to Menu
                        </button>

                        <button
                            type="button"
                            onClick={handleClearCart}
                            className="btn btn-danger"
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

function Row({ label, value, bold, fmt = (n) => n }) {
    return (
        <div className={`money-row ${bold ? "money-row--bold" : ""}`}>
            <span>{label}</span>
            <span>{fmt(value)}</span>
        </div>
    );
}

export default Cart;
