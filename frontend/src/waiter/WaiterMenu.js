import { useMemo } from "react";
import { formatMoney } from "./money";

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
    items = [],
    loading,
    search,
    onSearchChange,
    categories = [],
    activeCategory,
    onCategoryChange,
    orderLines,
    selectedItemId,
    onSelectItem,
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
                    const slug = itemCategorySlug(item);
                    const categoryName = itemCategoryName(item);
                    const isSelected = item.id === selectedItemId;
                    return (
                        <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className={`waiter-tile ${isSelected ? "waiter-tile--selected" : ""}`}
                            style={{ "--tile-color": colorForCategory(slug) }}
                            onClick={() => onSelectItem?.(item)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSelectItem?.(item);
                                }
                            }}
                        >
                            <span className="waiter-tile__category">{categoryName}</span>
                            <span className="waiter-tile__name">{item.name}</span>
                            <span className="waiter-tile__price">{formatMoney(item.price)}</span>
                            {quantity > 0 ? (
                                <span className="waiter-tile__qty-badge">{quantity}</span>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default WaiterMenu;
