import React from "react";
import api from "../api";
import "./components-style/App.css";

function Cart({ cart, tableToken, addToCart, removeFromCart }) {
    const handleCheckout = async () => {
        // ⭐ CHANGED: no token in localStorage anymore
        const resPath = "/orders/customer";

        try {
            let res;
            if (localStorage.getItem("role") === "waiter") {
                // waiter request → include session cookie
                res = await api.post(
                    "/orders/waiter",
                    { tableToken, items: cart },
                    { withCredentials: true } // ⭐ CHANGED
                );
            } else {
                // customer request
                res = await api.post("/orders/customer", { tableToken, items: cart });
            }

            const { orderId } = res.data || {};
            const msg =
                localStorage.getItem("role") === "waiter"
                    ? `Order placed by waiter for table token ${tableToken}`
                    : `Order placed by customer at table token ${tableToken}`;
            alert(orderId ? `${msg}. Order ID: ${orderId}` : msg);
            console.log("Order response:", res.data);
        } catch (err) {
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
