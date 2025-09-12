import React from "react";
import api from "../api";
import "./components-style/App.css";

function Cart({ cart, tableToken, tableId, addToCart, removeFromCart, isWaiter }) {
    const handleCheckout = async () => {
        try {
            let res;
            if (isWaiter) {
                res = await api.post("/orders/waiter", {
                    tableId,   // ✅ backend now expects this
                    items: cart
                });
            } else {
                res = await api.post("/orders/customer", {
                    tableToken,
                    items: cart
                });
            }

            const { orderId } = res.data || {};
            alert(
                orderId
                    ? `Order placed! ID: ${orderId}`
                    : "Order placed!"
            );
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                "Something went wrong";
            console.error(err);
            alert(msg);
        }
    };

    const disabled = cart.length === 0 || (!isWaiter && !tableToken) || (isWaiter && !tableId);

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
            >
                {isWaiter ? "Place Order (No Payment)" : "Place Order"}
            </button>
        </div>
    );
}

export default Cart;
