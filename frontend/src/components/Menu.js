import { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./components-style/Menu.css";

const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";


function Menu({
    addToCart,
    removeFromCart,
    cart = [],
    search,
    category,
    setCategory,
}) {
    const [items, setItems] = useState([]);
    const [topPicks, setTopPicks] = useState([]);

    const [localSearch, setLocalSearch] = useState("");
    const hasExternalSearch = typeof search === "string";
    const activeSearch = hasExternalSearch ? search : localSearch;
    const normalizedSearch = (activeSearch || "").trim().toLowerCase();

    // Dropdown positioning (under header search bar, anchored to navbar)
    const [ddBox, setDdBox] = useState(null);
    useEffect(() => {
        const update = () => {
            const input = document.querySelector(".search-wrap .search-input");
            if (!input) return setDdBox(null);

            const r = input.getBoundingClientRect();

            // Set CSS variable for width so styling lives in CSS
            document.documentElement.style.setProperty("--search-dd-width", `${r.width}px`);

            setDdBox({
                left: r.left,
                top: r.bottom + 6,
                // width is handled by CSS via --search-dd-width
            });
        };

        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, { passive: true }); // keep tied to fixed navbar
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update);
        };
    }, []);

    // Build a quick lookup: id -> quantity in cart
    const qtyById = useMemo(() => {
        const m = new Map();
        (cart || []).forEach((it) => {
            const prev = m.get(it.id) || 0;
            m.set(it.id, prev + (Number(it.quantity) || 0));
        });
        return m;
    }, [cart]);

    // Load entire menu once (client filters by category/search)
    useEffect(() => {
        api.get("/menu").then((res) => setItems(res.data));
    }, []);

    // Load Top Picks for the active category (most-ordered 8)
    useEffect(() => {
        if (!category) return;
        api
            .get("/menu/top-picks", { params: { category, limit: 8 } })
            .then((res) => setTopPicks(res.data))
            .catch(() => setTopPicks([]));
    }, [category]);

    const categoriesToRender = useMemo(
        () => (category ? [category] : ["coffee", "drinks", "food", "desserts"]),
        [category]
    );


    // When a category is selected we show *all* items of that category
    const perCategoryLimit = category ? 9999 : 4;

    // --- Search results (GLOBAL, any category) top 3 ---
    const searchResults = useMemo(() => {
        if (!normalizedSearch) return [];
        return items
            .filter((it) => it.name.toLowerCase().includes(normalizedSearch))
            .slice(0, 3);
    }, [items, normalizedSearch]);

    // The normal menu should NOT change when using the header search
    const normalizedForMenu = hasExternalSearch ? "" : normalizedSearch;

    // Decide whether to show "No items found."
    const willRenderAnything = useMemo(() => {
        const inSelectedCats = categoriesToRender.some((cat) =>
            items.some(
                (it) =>
                    it.category === cat &&
                    it.name.toLowerCase().includes(normalizedForMenu || "")
            )
        );
        const hasGlobal = searchResults.length > 0 || !normalizedSearch;
        return inSelectedCats || hasGlobal;
    }, [
        categoriesToRender,
        items,
        normalizedForMenu,
        searchResults.length,
        normalizedSearch,
    ]);

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

            {/* ===== Dropdown with top 3 global search results (any category) ===== */}
            {ddBox && normalizedSearch && searchResults.length > 0 && (
                <div
                    className="search-dd"
                    role="listbox"
                    aria-label="Search results"
                    style={{
                        left: ddBox.left - 6,
                        top: ddBox.top,
                    }}
                >
                    <ul className="menu-list menu-list--full" style={{ margin: 0 }}>
                        {searchResults.map((item) => {
                            const qty = qtyById.get(item.id) || 0;
                            return (
                                <li key={`sr-${item.id}`} className="menu-item search-menu-item">
                                    <img
                                        src={item.image_url || PLACEHOLDER}
                                        alt={item.name}
                                        className="thumb"
                                        loading="lazy"
                                        onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                                    />
                                    <div className="item-info" onClick={() => addToCart(item)}>
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-price">
                                            {Math.round(Number(item.price))} MKD
                                        </span>
                                    </div>

                                    {qty > 0 ? (
                                        <div className="qty-controls" aria-label="Quantity controls">
                                            <button
                                                className="qty-btn"
                                                aria-label={`Remove one ${item.name}`}
                                                onClick={() => removeFromCart(item)}
                                            >
                                                &minus;
                                            </button>
                                            <span className="qty-num" aria-live="polite">
                                                {qty}
                                            </span>
                                            <button
                                                className="qty-btn"
                                                aria-label={`Add one more ${item.name}`}
                                                onClick={() => addToCart(item)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="add-btn"
                                            aria-label={`Add ${item.name} to order`}
                                            onClick={() => addToCart(item)}
                                        >
                                            +
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* ===== Category-specific Top Picks (horizontal scroller) ===== */}
            {topPicks.length > 0 && (
                <>
                    <h3 className="page-head" style={{ marginTop: 0 }}>
                        Top Picks
                    </h3>
                    <div
                        className="top-picks-scroller"
                        aria-label="Top Picks"
                        role="region"
                    >
                        {topPicks.map((item) => (
                            <div key={item.id} className="pick-card" tabIndex={0} onClick={() => addToCart(item)}>
                                <img
                                    className="pick-image"
                                    src={item.image_url || PLACEHOLDER}
                                    alt={item.name}
                                    loading="lazy"
                                    onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                                />
                                <div className="pick-meta">
                                    <div className="pick-name">{item.name}</div>
                                    <div className="pick-price">
                                        {Math.round(Number(item.price))} MKD
                                    </div>
                                </div>
                                <button
                                    className="pick-add"
                                    aria-label={`Add ${item.name} to order`}
                                    onClick={() => addToCart(item)}
                                >
                                    +
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ===== Normal menu (unchanged by external search) ===== */}
            {categoriesToRender.map((cat) => {
                const filtered = items
                    .filter(
                        (item) =>
                            item.category === cat &&
                            item.name.toLowerCase().includes(normalizedForMenu)
                    )
                    .slice(0, perCategoryLimit);

                if (filtered.length === 0) return null;

                return (
                    <ul
                        key={cat}
                        className={`menu-list ${category ? "menu-list--full" : ""}`}
                    >
                        {filtered.map((item) => {
                            const qty = qtyById.get(item.id) || 0;

                            return (
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
                                            {Math.round(Number(item.price))} MKD
                                        </span>
                                    </div>

                                    {qty > 0 ? (
                                        <div className="qty-controls" aria-label="Quantity controls">
                                            <button
                                                className="qty-btn"
                                                aria-label={`Remove one ${item.name}`}
                                                onClick={() => removeFromCart(item)}
                                            >
                                                &minus;
                                            </button>
                                            <span className="qty-num" aria-live="polite">
                                                {qty}
                                            </span>
                                            <button
                                                className="qty-btn"
                                                aria-label={`Add one more ${item.name}`}
                                                onClick={() => addToCart(item)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="add-btn"
                                            aria-label={`Add ${item.name} to order`}
                                            onClick={() => addToCart(item)}
                                        >
                                            +
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                );
            })}
        </div>
    );
}

export default Menu;
