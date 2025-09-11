// src/components/Cart.js
import React from "react";
import api from "../api";                 // ✅ use your axios instance
import "./components-style/App.css";

function Cart({ cart, tableToken, addToCart, removeFromCart }) {
    const handleCheckout = async () => {
        const waiterToken = localStorage.getItem("token");
        const isWaiter = !!waiterToken;

        // Endpoints match your backend routes
        const path = isWaiter ? "/orders/waiter" : "/orders/customer";

        try {
            const res = await api.post(
                path,
                { tableToken, items: cart },
                isWaiter
                    ? { headers: { Authorization: `Bearer ${waiterToken}` } }
                    : undefined
            );

            const { orderId } = res.data || {};
            const msg = isWaiter
                ? `Order placed by waiter for table token ${tableToken}`
                : `Order placed by customer at table token ${tableToken}`;
            alert(orderId ? `${msg}. Order ID: ${orderId}` : msg);
            console.log("Order response:", res.data);
        } catch (err) {
            // Axios always gives something parseable
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Something went wrong";
            console.error(err);
            alert(msg);
        }
    };

    const disabled = cart.length === 0 || !tableToken;

    return (
        <div className="cart-container">
            <h2 className="cart-title">Your Cart</h2>
            {cart.length === 0 && <p className="empty-cart">Your cart is empty</p>}
            <ul className="cart-list">
                {cart.map((item, i) => (
                    <li key={i} className="cart-item">
                        <span className="cart-item-name">
                            {item.name} × {item.quantity}
                        </span>
                        <div className="cart-controls">
                            <button onClick={() => removeFromCart(item)}>-</button>
                            <button onClick={() => addToCart(item)}>+</button>
                        </div>
                    </li>
                ))}
            </ul>
            <button
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={disabled}
                title={disabled ? "Scan table QR and add items first" : "Place order"}
            >
                Place Order
            </button>
        </div>
    );
}

export default Cart;
