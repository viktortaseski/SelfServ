// src/components/WaiterMenu.js
import Menu from "./Menu";
import Cart from "./Cart";

function WaiterMenu({
    tableId,
    cart,
    setCart,
    addToCart,
    removeFromCart,
    category,
    setCategory,
    view,
    goBack,
}) {
    return (
        <div className="waiter-menu">
            <div className="waiter-menu-header">
                <h2>Ordering for {tableId}</h2>
                <button onClick={goBack}>⬅ Back to Tables</button>
            </div>

            {view === "menu" && (
                <Menu addToCart={addToCart} category={category} />
            )}

            {view === "cart" && (
                <Cart
                    cart={cart}
                    addToCart={addToCart}
                    removeFromCart={removeFromCart}
                    tableId={tableId} // waiter uses numeric ID
                    isWaiter={true}
                />
            )}
        </div>
    );
}

export default WaiterMenu;
