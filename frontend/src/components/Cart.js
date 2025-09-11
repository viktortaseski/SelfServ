import React from "react";

function Cart({ cart, tableName, checkout, addToCart, removeFromCart }) {
    return (
        <div className="cart-container">
            <h2>Your Cart</h2>
            {cart.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <ul>
                    {cart.map((item, i) => (
                        <li key={i}>
                            {item.name} - {item.quantity}
                            <button onClick={() => addToCart(item)}>+</button>
                            <button onClick={() => removeFromCart(item)}>-</button>
                        </li>
                    ))}
                </ul>
            )}

            <button onClick={checkout}>
                Place Order at {tableName ? tableName.replace("table", "Table ") : "?"}
            </button>
        </div>
    );
}

export default Cart;
