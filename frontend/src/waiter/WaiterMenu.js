import { useMemo } from "react";

function normalizeSearch(value) {
    return value.trim().toLowerCase();
}

function matchesSearch(item, search) {
    if (!search) return true;
    const name = (item.name || "").toLowerCase();
    const description = (item.description || "").toLowerCase();
    return name.includes(search) || description.includes(search);
}

function itemCategorySlug(item) {
    return item.category || item.category_slug || "other";
}

function itemCategoryName(item) {
    if (item.category_name) return item.category_name;
    const slug = itemCategorySlug(item);
    return slug
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function WaiterMenu({
    table,
    items = [],
    loading,
    error,
    search,
    onSearchChange,
    categories = [],
    activeCategory,
    onCategoryChange,
    orderLines,
    onIncrease,
    onDecrease,
    onRequestNote,
}) {
    const normalizedSearch = useMemo(() => normalizeSearch(search || ""), [search]);

    const filteredItems = useMemo(() => {
        const requestedCategory = activeCategory && activeCategory !== "all" ? activeCategory : null;
        return items.filter((item) => {
            const slug = itemCategorySlug(item);
            const allowCategory = requestedCategory ? slug === requestedCategory : true;
            if (!allowCategory) return false;
            return matchesSearch(item, normalizedSearch);
        });
    }, [items, activeCategory, normalizedSearch]);

    const categoryOptions = useMemo(() => {
        if (!categories.length) {
            const map = new Map();
            items.forEach((item) => {
                const slug = itemCategorySlug(item);
                const name = itemCategoryName(item);
                if (!map.has(slug)) {
                    map.set(slug, { slug, name });
                }
            });
            return Array.from(map.values());
        }
        return categories;
    }, [categories, items]);

    const orderLookup = useMemo(() => {
        if (!orderLines) return new Map();
        if (orderLines instanceof Map) return orderLines;
        const map = new Map();
        if (Array.isArray(orderLines)) {
            orderLines.forEach((line) => {
                if (line?.item?.id) map.set(line.item.id, line);
            });
        } else if (typeof orderLines === "object") {
            Object.entries(orderLines).forEach(([id, line]) => {
                const numId = Number(id);
                if (Number.isFinite(numId)) map.set(numId, line);
            });
        }
        return map;
    }, [orderLines]);

    const handleCategoryClick = (slug) => {
        if (slug === activeCategory) return;
        onCategoryChange(slug);
    };

    return (
        <section className="waiter-section">
            <header className="waiter-section__header waiter-section__header--column">
                <div>
                    <h2 className="waiter-title">
                        {table ? `Ordering for ${table.name || `Table ${table.id}`}` : "Build order"}
                    </h2>
                    <p className="waiter-subtitle">
                        Choose products from the list below. Use the search or categories to filter.
                    </p>
                </div>
            </header>

            <div className="waiter-menu__filters">
                <input
                    type="search"
                    className="waiter-input waiter-menu__search"
                    placeholder="Search products"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <div className="waiter-menu__categories">
                    <button
                        type="button"
                        className={`waiter-chip ${activeCategory === "all" ? "waiter-chip--active" : ""}`}
                        onClick={() => handleCategoryClick("all")}
                    >
                        All
                    </button>
                    {categoryOptions.map((cat) => (
                        <button
                            key={cat.slug}
                            type="button"
                            className={`waiter-chip ${activeCategory === cat.slug ? "waiter-chip--active" : ""}`}
                            onClick={() => handleCategoryClick(cat.slug)}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {error ? <div className="waiter-error">{error}</div> : null}

            <div className="waiter-menu__list">
                {loading && items.length === 0 ? (
                    <div className="waiter-placeholder">Loading menu…</div>
                ) : null}

                {!loading && filteredItems.length === 0 ? (
                    <div className="waiter-placeholder">No products match the current filters.</div>
                ) : null}

                {filteredItems.map((item) => {
                    const line = orderLookup.get(item.id) || null;
                    const quantity = line?.quantity || 0;
                    const note = line?.note || "";
                    const price = Number(item.price) || 0;
                    return (
                        <div key={item.id} className="waiter-item">
                            <div className="waiter-item__info">
                                <div className="waiter-item__heading">
                                    <span className="waiter-item__name">{item.name}</span>
                                    <span className="waiter-item__price">{Math.round(price)} MKD</span>
                                </div>
                                {item.description ? (
                                    <p className="waiter-item__description">{item.description}</p>
                                ) : null}
                                <div className="waiter-item__note">
                                    {quantity > 0 ? (
                                        <>
                                            {note ? (
                                                <span className="waiter-note__preview">{note}</span>
                                            ) : (
                                                <span className="waiter-note__placeholder">No note added</span>
                                            )}
                                            <button
                                                type="button"
                                                className="waiter-note__btn"
                                                onClick={() => onRequestNote?.(item, note)}
                                            >
                                                {note ? "Edit note" : "Add note"}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="waiter-note__placeholder waiter-note__placeholder--muted">
                                            Add at least one item to leave a note
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="waiter-item__actions">
                                <button
                                    type="button"
                                    className="waiter-counter__btn"
                                    onClick={() => onDecrease(item)}
                                    disabled={quantity === 0}
                                >
                                    -
                                </button>
                                <span className="waiter-counter__value">{quantity}</span>
                                <button
                                    type="button"
                                    className="waiter-counter__btn waiter-counter__btn--primary"
                                    onClick={() => onIncrease(item)}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default WaiterMenu;
