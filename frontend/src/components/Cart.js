import React from "react";

function Cart({ cart, tableToken, addToCart, removeFromCart }) {
    const handleCheckout = async () => {
        const waiterToken = localStorage.getItem("token"); // waiter JWT if logged in
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
                    tableToken: tableToken, // always send token, backend resolves to id
                    items: cart,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                alert(
                    isWaiter
                        ? `Order placed by waiter for ${tableToken}`
                        : `Order placed by customer at ${tableToken}`
                );
                console.log("Order response:", data);
            } else {
                alert(data.error || "Something went wrong");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    };

    return (
        <div>
            <h2>Your Cart</h2>
            {cart.map((item, i) => (
                <div key={i}>
                    {item.name} - {item.quantity}
                    <button onClick={() => removeFromCart(item)}>-</button>
                    <button onClick={() => addToCart(item)}>+</button>
                </div>
            ))}
            <button onClick={handleCheckout} disabled={cart.length === 0}>
                Place Order
            </button>
        </div>
    );
}

export default Cart;
