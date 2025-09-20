import { useEffect, useState, useMemo } from "react";
import api from "../api";
import "./components-style/Menu.css";

const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

function titleCase(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function Menu({ addToCart, search, category, setCategory }) {
    const [items, setItems] = useState([]);
    const [localSearch, setLocalSearch] = useState("");
    const hasExternalSearch = typeof search === "string";
    const activeSearch = hasExternalSearch ? search : localSearch;

    useEffect(() => {
        api.get("/menu").then((res) => setItems(res.data));
    }, []);

    const allCategories = ["coffee", "drinks", "food", "desserts"];
    const categoriesToRender = useMemo(
        () => (category ? [category] : allCategories),
        [category]
    );

    // Show only 4 items per category on home; all items when a category is selected
    const perCategoryLimit = category ? 9999 : 4;

    // Simple top picks (first 2 items) shown only on home
    const topPicks = category
        ? []
        : items.slice(0, 2).filter((it) =>
            it.name.toLowerCase().includes((activeSearch || "").toLowerCase())
        );

    const willRenderAnything = useMemo(() => {
        if (!category && topPicks.length > 0) return true;
        return categoriesToRender.some((cat) =>
            items.some(
                (it) =>
                    it.category === cat &&
                    it.name.toLowerCase().includes((activeSearch || "").toLowerCase())
            )
        );
    }, [categoriesToRender, items, activeSearch, category, topPicks.length]);

    return (
        <div className="menu-container">
            {/* Optional internal search (not used because header search exists) */}
            {!hasExternalSearch && (
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="  🔍   Search"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                </div>
            )}

            {!willRenderAnything && (
                <p style={{ padding: "8px 4px", color: "#666" }}>No items found.</p>
            )}

            {/* Header title: Top Picks (home) OR current category (e.g., Coffee) */}
            <h3 className="page-head">
                {category ? titleCase(category) : "Top Picks"}
            </h3>

            {/* HOME: show top picks cards; CATEGORY: skip cards and show list */}
            {!category && topPicks.length > 0 && (
                <div className="top-picks-grid">
                    {topPicks.map((item) => (
                        <div key={item.id} className="pick-card">
                            <img
                                className="pick-image"
                                src={item.image_url || PLACEHOLDER}
                                alt={item.name}
                                loading="lazy"
                                onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                            />
                            <div className="pick-meta">
                                <div className="pick-name">{item.name}</div>
                                <div className="pick-price">{Math.round(Number(item.price))} MKD</div>
                            </div>
                            <button className="pick-add" onClick={() => addToCart(item)}>+</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Lists */}
            {categoriesToRender.map((cat) => {
                const filtered = items
                    .filter(
                        (item) =>
                            item.category === cat &&
                            item.name.toLowerCase().includes((activeSearch || "").toLowerCase())
                    )
                    .slice(0, perCategoryLimit);

                if (filtered.length === 0) return null;

                return (
                    <ul key={cat} className={`menu-list ${category ? "menu-list--full" : ""}`}>
                        {filtered.map((item) => (
                            <li key={item.id} className="menu-item">
                                <img
                                    src={item.image_url || PLACEHOLDER}
                                    alt={item.name}
                                    className="thumb"
                                    loading="lazy"
                                    onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                                />
                                <div className="item-info">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-price">{Math.round(Number(item.price))} MKD</span>
                                </div>
                                <button className="add-btn" onClick={() => addToCart(item)}>+</button>
                            </li>
                        ))}
                    </ul>
                );
            })}

            {category && typeof setCategory === "function" && (
                <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 0" }}>
                    <button
                        type="button"
                        onClick={() => setCategory(null)}
                        className="back-to-menu-btn"
                    >
                        ← Back to Menu
                    </button>
                </div>
            )}
        </div>
    );
}

export default Menu;
