import React from "react";

function Cart({ items, tableId }) {
    const handleCheckout = async () => {
        const token = localStorage.getItem("token"); // waiter token if logged in
        const isWaiter = !!token;

        const endpoint = isWaiter ? "/api/orders/waiter" : "/api/orders/customer";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(isWaiter && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    table_id: tableId,
                    items: items,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                alert(
                    isWaiter
                        ? `Order placed by waiter for Table ${tableId}`
                        : `Order placed by customer at Table ${tableId}`
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
            {items.map((item, i) => (
                <div key={i}>
                    {item.name} - {item.quantity}
                </div>
            ))}
            <button onClick={handleCheckout}>Place Order</button>
        </div>
    );
}

export default Cart;
