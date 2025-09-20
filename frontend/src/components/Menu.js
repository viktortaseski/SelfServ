import { useEffect, useState, useMemo } from "react";
import api from "../api";
import "./components-style/Menu.css";

const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

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
            {/* Search pill */}
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

            {/* Top Picks */}
            {!category && topPicks.length > 0 && (
                <section className="top-picks">
                    <h3 className="section-head">Top Picks</h3>
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
                                    <div className="pick-price">€{Number(item.price).toFixed(2)}</div>
                                </div>
                                <button className="pick-add" onClick={() => addToCart(item)}>
                                    +
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Categories / Lists */}
            {categoriesToRender.map((cat) => {
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
                    <section key={cat} className="menu-section">
                        <h3 className="menu-section-title">{cat.toUpperCase()}</h3>
                        <ul className="menu-list">
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
                                        <span className="item-price">
                                            €{Number(item.price).toFixed(2)}
                                        </span>
                                    </div>
                                    <button className="add-btn" onClick={() => addToCart(item)}>
                                        +
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}

            {/* Back to Menu button appears when a category is active */}
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
