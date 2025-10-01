// src/components/Menu.js
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./components-style/Menu.css";
import MenuItem from "./menu/MenuItem";
import { fmtMKD, PLACEHOLDER } from "./common/format";

function Menu({
    addToCart,
    removeFromCart,
    cart = [],
    search,
    category,
    setCategory,
    notify, // optional toast
}) {
    const [items, setItems] = useState([]);
    const [topPicks, setTopPicks] = useState([]);

    const [localSearch, setLocalSearch] = useState("");
    const hasExternalSearch = typeof search === "string";
    const activeSearch = hasExternalSearch ? search : localSearch;
    const normalizedSearch = (activeSearch || "").trim().toLowerCase();

    const qtyById = useMemo(() => {
        const m = new Map();
        (cart || []).forEach((it) => {
            const prev = m.get(it.id) || 0;
            m.set(it.id, prev + (Number(it.quantity) || 0));
        });
        return m;
    }, [cart]);

    const show = (msg) => {
        if (typeof notify === "function") notify(msg);
    };

    const handleAdd = (item) => {
        const prevQty = qtyById.get(item.id) || 0;
        addToCart(item);
        const nextQty = prevQty + 1;
        show(`${item.name} added. ${nextQty} in order.`);
    };

    const handleRemove = (item) => {
        const prevQty = qtyById.get(item.id) || 0;
        if (prevQty <= 0) return;
        removeFromCart(item);
        const nextQty = prevQty - 1;
        show(
            nextQty > 0
                ? `${item.name} removed. ${nextQty} left.`
                : `${item.name} removed from order.`
        );
    };

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

    const perCategoryLimit = category ? 9999 : 4;

    const searchResultsAll = useMemo(() => {
        if (!normalizedSearch) return [];
        return items.filter((it) =>
            (it.name || "").toLowerCase().includes(normalizedSearch)
        );
    }, [items, normalizedSearch]);

    const normalizedForMenu = hasExternalSearch ? "" : normalizedSearch;

    const willRenderAnything = useMemo(() => {
        if (normalizedSearch) return searchResultsAll.length > 0;
        const inSelectedCats = categoriesToRender.some((cat) =>
            items.some(
                (it) =>
                    it.category === cat &&
                    (it.name || "").toLowerCase().includes(normalizedForMenu || "")
            )
        );
        return inSelectedCats || !normalizedSearch;
    }, [
        normalizedSearch,
        searchResultsAll.length,
        categoriesToRender,
        items,
        normalizedForMenu,
    ]);

    return (
        <div className="menu-container">
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
                <p style={{ textAlign: "center", padding: "8px 4px", color: "#666" }}>
                    No items found.
                </p>
            )}

            {/* Search results */}
            {normalizedSearch && searchResultsAll.length > 0 && (
                <ul className="menu-list menu-list--full" style={{ margin: 0 }}>
                    {searchResultsAll.map((item) => (
                        <MenuItem
                            key={`sr-${item.id}`}
                            item={item}
                            qty={qtyById.get(item.id) || 0}
                            onAdd={handleAdd}
                            onRemove={handleRemove}
                        />
                    ))}
                </ul>
            )}

            {/* Top Picks */}
            {!normalizedSearch && topPicks.length > 0 && (
                <>
                    <h3 className="page-head" style={{ marginTop: 0 }}>
                        Top Picks
                    </h3>
                    <div className="top-picks-scroller" aria-label="Top Picks" role="region">
                        {topPicks.map((item) => {
                            const isLongName = (item.name || "").length > 18;
                            return (
                                <div key={item.id} className="pick-card" tabIndex={0}>
                                    <img
                                        className={`pick-image ${isLongName ? "pick-image--tight" : ""}`}
                                        src={item.image_url}
                                        alt={item.name}
                                        loading="lazy"
                                        onClick={() => handleAdd(item)}
                                        onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                                    />
                                    <div
                                        className={`pick-meta ${isLongName ? "pick-meta--tight" : ""}`}
                                        onClick={() => handleAdd(item)}
                                    >
                                        <div className="pick-name">{item.name}</div>
                                        <div className="pick-price">
                                            {fmtMKD(item.price || 0)}
                                        </div>
                                    </div>
                                    <button
                                        className="pick-add"
                                        aria-label={`Add ${item.name} to order`}
                                        onClick={() => handleAdd(item)}
                                    >
                                        +
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Normal menu */}
            {!normalizedSearch &&
                categoriesToRender.map((cat) => {
                    const filtered = items
                        .filter(
                            (item) =>
                                item.category === cat &&
                                (item.name || "")
                                    .toLowerCase()
                                    .includes(normalizedForMenu || "")
                        )
                        .slice(0, perCategoryLimit);

                    if (filtered.length === 0) return null;

                    return (
                        <ul
                            key={cat}
                            className={`menu-list ${category ? "menu-list--full" : ""}`}
                        >
                            {filtered.map((item) => (
                                <MenuItem
                                    key={item.id}
                                    item={item}
                                    qty={qtyById.get(item.id) || 0}
                                    onAdd={handleAdd}
                                    onRemove={handleRemove}
                                />
                            ))}
                        </ul>
                    );
                })}
        </div>
    );
}

export default Menu;
