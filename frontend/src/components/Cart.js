// src/components/Cart.js
import React from "react";
import "./components-style/App.css";

async function parseResponse(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
        return res.json();
    }
    const text = await res.text();
    return { message: text };
}

function Cart({ cart, tableToken, addToCart, removeFromCart }) {
    const handleCheckout = async () => {
        const waiterToken = localStorage.getItem("token");
        const isWaiter = !!waiterToken;

        const endpoint = isWaiter ? "/api/orders/waiter" : "/api/orders/customer";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(isWaiter && { Authorization: `Bearer ${waiterToken}` }),
                },
                body: JSON.stringify({
                    tableToken,
                    items: cart,
                }),
            });

            const data = await parseResponse(res);

            if (res.ok) {
                const msg =
                    isWaiter
                        ? `Order placed by waiter for table token ${tableToken}`
                        : `Order placed by customer at table token ${tableToken}`;
                alert(data?.orderId ? `${msg}. Order ID: ${data.orderId}` : msg);
                console.log("Order response:", data);
            } else {
                alert(data?.error || data?.message || "Something went wrong");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
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
