import { useState } from "react";
import Menu from "./Menu";
import Cart from "./Cart";
import "./components-style/App.css";
import "./components-style/Waiter.css";

function WaiterMenu({
    tableId,        // ✅ shows which table is active
    tableToken,     // ✅ pass token to Cart for waiter flow
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
            {/* Header row */}
            <div className="waiter-menu-header">
                <div className="header-left">
                    <button onClick={goBack}>⬅ Back to Tables</button>
                    <h2>Ordering for {tableId}</h2>
                </div>
                {/* Order button moved to floating FAB; header keeps clean */}
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

            {view === "menu" && (
                <Menu addToCart={addToCart} category={category} search={search} />
            )}

            {view === "cart" && (
                <Cart
                    cart={cart}
                    addToCart={addToCart}
                    removeFromCart={removeFromCart}
                    tableToken={tableToken}
                    isWaiter={true}
                />
            )}

            {/* 🟦 Floating, always-visible Order button (bottom-left) */}
            <button
                type="button"
                className="order-fab"
                onClick={() => setView("cart")}
                aria-label="Open cart to place order"
            >
                Order
            </button>
        </div>
    );
}

export default WaiterMenu;
