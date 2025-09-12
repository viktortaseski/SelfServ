// src/components/Menu.js
import { useEffect, useState } from "react";
import api from "../api";
import "./components-style/Menu.css";

function Menu({ addToCart, search = "" }) {
    const [items, setItems] = useState([]);

    useEffect(() => {
        api.get("/menu").then((res) => setItems(res.data));
    }, []);

    const categories = ["coffee", "drinks", "food", "desserts"];

    return (
        <div className="menu-container">
            <h2 className="menu-title">Menu</h2>

            {categories.map((category) => {
                // filter by category AND search string
                const filtered = items
                    .filter(
                        (item) =>
                            item.category === category &&
                            item.name.toLowerCase().includes(search.toLowerCase())
                    )
                    .slice(0, 20); // adjust limit if you want more items shown

                if (filtered.length === 0) return null;

                return (
                    <div key={category} className="menu-section">
                        <h3 className="menu-section-title">{category.toUpperCase()}</h3>
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
