import { useState } from "react";
import Menu from "./Menu";
import Cart from "./Cart";
import "./components-style/App.css";
import "./components-style/Waiter.css";

function WaiterMenu({
    tableToken,
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
            <div className="waiter-menu-header">
                <div className="header-left">
                    <button onClick={goBack}>⬅ Back to Tables</button>
                    <h2>Ordering for {tableToken}</h2>
                </div>
                <button
                    className="order-btn"
                    onClick={() => setView("cart")}
                >
                    Order
                </button>
            </div>

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
                    tableToken={tableToken}   // ✅ pass token here
                    isWaiter={true}
                />
            )}
        </div>
    );
}

export default WaiterMenu;
