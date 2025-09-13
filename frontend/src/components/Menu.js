// src/components/Menu.js
import { useEffect, useState } from "react";
import api from "../api";
import "./components-style/Menu.css";

function Menu({ addToCart, search, category }) {
    const [items, setItems] = useState([]);
    const [localSearch, setLocalSearch] = useState("");

    // If waiter view provides `search`, use it; otherwise use our local search.
    const hasExternalSearch = typeof search === "string";
    const activeSearch = hasExternalSearch ? search : localSearch;

    useEffect(() => {
        api.get("/menu").then((res) => setItems(res.data));
    }, []);

    const categories = ["coffee", "drinks", "food", "desserts"];

    return (
        <div className="menu-container">
            <h2 className="menu-title">Menu</h2>

            {/* Customer search bar: shown only when no external search is provided */}
            {!hasExternalSearch && (
                <div className="search-bar" style={{ width: "90%", marginBottom: "1rem" }}>
                    <input
                        type="text"
                        placeholder="Search menu..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                </div>
            )}

            {categories.map((cat) => {
                // filter by category AND search string
                const filtered = items
                    .filter(
                        (item) =>
                            item.category === cat &&
                            item.name.toLowerCase().includes((activeSearch || "").toLowerCase())
                    )
                    .slice(0, 20); // adjust limit if you want more items shown

                if (filtered.length === 0) return null;

                return (
                    <div key={cat} className="menu-section">
                        <h3 className="menu-section-title">{cat.toUpperCase()}</h3>
                        <ul className="menu-list">
                            {filtered.map((item) => (
                                <li key={item.id} className="menu-item">
                                    <div className="item-info">
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-price">
                                            €{Number(item.price).toFixed(2)}
                                        </span>
                                    </div>
                                    <button
                                        className="add-btn"
                                        onClick={() => addToCart(item)}
                                    >
                                        +
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

export default Menu;
