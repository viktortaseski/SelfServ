// src/components/Menu.js
import { useEffect, useState, useMemo } from "react";
import api from "../api";
import "./components-style/Menu.css";

const PLACEHOLDER =
    "https://dummyimage.com/96x96/eaeaea/555&text=%F0%9F%8D%BA"; // neutral placeholder

function Menu({ addToCart, search, category, setCategory }) {
    const [items, setItems] = useState([]);
    const [localSearch, setLocalSearch] = useState("");

    // If waiter view provides `search`, use it; otherwise use our local search.
    const hasExternalSearch = typeof search === "string";
    const activeSearch = hasExternalSearch ? search : localSearch;

    useEffect(() => {
        api.get("/menu").then((res) => setItems(res.data));
    }, []);

    const allCategories = ["coffee", "drinks", "food", "desserts"];

    // Decide which categories to render (one if filtered, all if not)
    const categoriesToRender = useMemo(
        () => (category ? [category] : allCategories),
        [category]
    );

    // Show only 4 items per category on the main menu; all items when a category is selected
    const perCategoryLimit = category ? 9999 : 4;

    // Quick check if we’ll render any item at all (for empty states)
    const willRenderAnything = useMemo(() => {
        return categoriesToRender.some((cat) =>
            items.some(
                (it) =>
                    it.category === cat &&
                    it.name.toLowerCase().includes((activeSearch || "").toLowerCase())
            )
        );
    }, [categoriesToRender, items, activeSearch]);

    return (
        <div className="menu-container">
            {/* Header with optional Back button when a category is selected */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                }}
            >
                {category && typeof setCategory === "function" && (
                    <button
                        type="button"
                        onClick={() => setCategory(null)}
                        className="back-to-menu-btn"
                        style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #d0d0d0",
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        ← Back to Menu
                    </button>
                )}
                <h2 className="menu-title" style={{ margin: 0 }}>
                    Menu
                </h2>
            </div>

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

            {!willRenderAnything && (
                <p style={{ padding: "8px 4px", color: "#666" }}>No items found.</p>
            )}

            {categoriesToRender.map((cat) => {
                // filter by (selected) category AND search string
                const filtered = items
                    .filter(
                        (item) =>
                            item.category === cat &&
                            item.name
                                .toLowerCase()
                                .includes((activeSearch || "").toLowerCase())
                    )
                    .slice(0, perCategoryLimit);

                if (filtered.length === 0) return null;

                return (
                    <div key={cat} className="menu-section">
                        <h3 className="menu-section-title">{cat.toUpperCase()}</h3>
                        <ul className="menu-list">
                            {filtered.map((item) => (
                                <li
                                    key={item.id}
                                    className="menu-item"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "10px 12px",
                                    }}
                                >
                                    {/* Thumbnail */}
                                    <img
                                        src={item.image_url || PLACEHOLDER}
                                        alt={item.name}
                                        loading="lazy"
                                        style={{
                                            width: 64,
                                            height: 64,
                                            objectFit: "cover",
                                            borderRadius: 10,
                                            flexShrink: 0,
                                            background: "#f3f4f6",
                                            border: "1px solid #eee",
                                        }}
                                        onError={(e) => {
                                            // Fallback if an image fails to load
                                            e.currentTarget.src = PLACEHOLDER;
                                        }}
                                    />

                                    {/* Name + price */}
                                    <div
                                        className="item-info"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            width: "100%",
                                            gap: 12,
                                        }}
                                    >
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-price">
                                            €{Number(item.price).toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Add button */}
                                    <button
                                        className="add-btn"
                                        onClick={() => addToCart(item)}
                                        style={{ marginLeft: 8 }}
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
