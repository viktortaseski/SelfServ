function Cart({ cart, checkout }) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <div>
            <h2>Cart</h2>
            {cart.map(item => (
                <p key={item.id}>
                    {item.name} x {item.quantity}
                </p>
            ))}
            <p>Total: €{total.toFixed(2)}</p>
            <button onClick={checkout}>Checkout</button>
        </div>
    );
}

export default Cart;
