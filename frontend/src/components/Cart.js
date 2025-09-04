function Cart({ cart, checkout, addToCart, removeFromCart, tableName }) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <div className="cart-container">
            <h2>
                Ordering for {tableName ? tableName : "Unknown Table"}
            </h2>
            {cart.length === 0 && <p>No items yet</p>}
            {cart.map(item => (
                <div key={item.id} className="cart-item">
                    <span>{item.name}</span>
                    <div className="cart-controls">
                        <button onClick={() => removeFromCart(item)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => addToCart(item)}>+</button>
                    </div>
                </div>
            ))}
            <p className="cart-total">Total: €{Number(total).toFixed(2)}</p>
            {cart.length > 0 && (
                <button className="checkout-btn" onClick={checkout}>Checkout</button>
            )}
        </div>
    );
}

export default Cart;
