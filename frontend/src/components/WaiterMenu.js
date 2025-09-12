import { useState } from "react";
import Menu from "./Menu";
import Cart from "./Cart";
import "./components-style/App.css";
import "./components-style/Waiter.css";

function WaiterMenu({
    tableId,
    cart,
    setCart,
    addToCart,
    removeFromCart,
    category,
    setCategory,
    view,
    setView,
    goBack,
}) {
    const [search, setSearch] = useState("");

    return (
        <div className="waiter-menu">
            {/* Header row with back + order button */}
            <div className="waiter-menu-header">
                <div className="header-left">
                    <button onClick={goBack}>⬅ Back to Tables</button>
                    <h2>Ordering for {tableId}</h2>
                </div>
                <button
                    className="order-btn"
                    onClick={() => setView("cart")}   // ✅ now works
                >
                    Order
                </button>
            </div>

            {/* Search bar */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search menu..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Menu + Cart */}
            {view === "menu" && (
                <Menu addToCart={addToCart} category={category} search={search} />
            )}

            {view === "cart" && (
                <Cart
                    cart={cart}
                    addToCart={addToCart}
                    removeFromCart={removeFromCart}
                    tableId={tableId}
                    isWaiter={true}
                />
            )}
        </div>
    );
}

export default WaiterMenu;
