import { useMemo } from "react";

// Distinct, saturated colors so staff can tell categories apart at a glance,
// assigned deterministically per category slug (stable across reloads).
const CATEGORY_PALETTE = [
    "#8a5a2b", // brown - coffee
    "#c9770f", // amber - snacks
    "#1f6fb3", // blue - soft drinks
    "#15406e", // navy - alcohol
    "#a4262c", // red - specials
    "#7a3d9c", // purple - other
    "#b3315c", // magenta - desserts
    "#2f7a3d", // green - food
];

function colorForCategory(slug) {
    const str = slug || "other";
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

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
    onMergeOrders,
    onCloseOrders,
    actionsBusy,
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

    const openOrders = Number(table?.openOrders ?? table?.open_orders ?? 0);
    const statusText =
        table?.status ||
        (openOrders > 0
            ? `${openOrders} open ${openOrders === 1 ? "order" : "orders"}`
            : "Available");
    const busy = Boolean(actionsBusy);

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
                {table ? (
                    <div className="waiter-table-inline-actions">
                        <span
                            className={`waiter-table-inline-actions__status ${
                                openOrders > 0
                                    ? "waiter-table-inline-actions__status--busy"
                                    : "waiter-table-inline-actions__status--free"
                            }`}
                        >
                            {statusText}
                        </span>
                        <div className="waiter-table-inline-actions__buttons">
                            {openOrders > 1 ? (
                                <button
                                    type="button"
                                    className="waiter-btn waiter-btn--ghost"
                                    onClick={() => onMergeOrders?.(table)}
                                    disabled={busy}
                                >
                                    {busy ? "Working…" : "Merge orders"}
                                </button>
                            ) : null}
                            {openOrders > 0 ? (
                                <button
                                    type="button"
                                    className="waiter-btn waiter-btn--primary"
                                    onClick={() => onCloseOrders?.(table)}
                                    disabled={busy}
                                >
                                    {busy ? "Working…" : "Close orders"}
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
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
                            style={{ "--chip-color": colorForCategory(cat.slug) }}
                            onClick={() => handleCategoryClick(cat.slug)}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {error ? <div className="waiter-error">{error}</div> : null}

            <div className="waiter-tile-grid">
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
                    const slug = itemCategorySlug(item);
                    const categoryName = itemCategoryName(item);
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`waiter-tile ${quantity > 0 ? "waiter-tile--selected" : ""}`}
                            style={{ "--tile-color": colorForCategory(slug) }}
                            onClick={() => onIncrease(item)}
                        >
                            <span className="waiter-tile__category">{categoryName}</span>
                            <span className="waiter-tile__name">{item.name}</span>
                            <span className="waiter-tile__footer">
                                <span className="waiter-tile__price">{Math.round(price)}</span>
                                {quantity > 0 ? (
                                    <span className="waiter-tile__controls">
                                        <button
                                            type="button"
                                            className="waiter-tile__minus"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDecrease(item);
                                            }}
                                        >
                                            −
                                        </button>
                                        <span className="waiter-tile__qty">{quantity}</span>
                                    </span>
                                ) : null}
                            </span>
                            {quantity > 0 ? (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    className={`waiter-tile__note ${note ? "waiter-tile__note--set" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRequestNote?.(item, note);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.stopPropagation();
                                            onRequestNote?.(item, note);
                                        }
                                    }}
                                >
                                    {note ? "✎" : "+"}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default WaiterMenu;
