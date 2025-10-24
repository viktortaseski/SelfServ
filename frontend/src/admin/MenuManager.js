import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    apiCreateMenuItem,
    apiListMenuItems,
    apiUpdateMenuItem,
    apiDeleteMenuItem,
    apiAddItemToMenu,
    apiRemoveItemFromMenu,
    apiFetchCategories,
    fmtMKD,
} from "./dashboardApi";
import "./dashboard.css";

const CATEGORY_ORDER = ["coffee", "drinks", "food", "desserts", "other"];
const CATEGORY_LABELS = {
    coffee: "Coffee",
    drinks: "Drinks",
    food: "Food",
    desserts: "Desserts",
    other: "Other",
};

function slugify(str) {
    return (str || "")
        .toString()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();
}

function humanizeSlug(slug) {
    if (!slug) return "";
    return slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function MenuManager({ user }) {
    const restaurantId = user?.restaurant_id || null;
    const restaurantName = user?.restaurant_name || "";
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [activeSection, setActiveSection] = useState("menu"); // "menu" | "all"
    const [serverCategories, setServerCategories] = useState([]);

    // Create form state
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [category, setCategory] = useState("other");
    const [file, setFile] = useState(null);

    // Edit form state
    const [editing, setEditing] = useState(null); // item or null
    const [eName, setEName] = useState("");
    const [ePrice, setEPrice] = useState("");
    const [eCategory, setECategory] = useState("other");
    const [eFile, setEFile] = useState(null);

    // UX state
    const [busy, setBusy] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createOk, setCreateOk] = useState("");
    const [editError, setEditError] = useState("");
    const [editOk, setEditOk] = useState("");
    const [removeImage, setRemoveImage] = useState(false);
    const [editPreview, setEditPreview] = useState(null);
    const previewUrlRef = useRef(null);
    const editFileInputRef = useRef(null);

    const updatePreview = useCallback((url) => {
        if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = url && typeof url === "string" && url.startsWith("blob:")
            ? url
            : null;
        setEditPreview(url || null);
    }, []);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    const onFile = (e) => setFile(e.target.files?.[0] || null);
    const onEditFile = (e) => {
        const selected = e.target.files?.[0] || null;
        setEFile(selected);
        setEditError("");
        setEditOk("");
        if (selected) {
            const blobUrl = URL.createObjectURL(selected);
            updatePreview(blobUrl);
            setRemoveImage(false);
        } else if (editing) {
            updatePreview(editing.image_url || null);
        } else {
            updatePreview(null);
        }
    };

    const toDataUrl = (f) => new Promise((resolve, reject) => {
        if (!f) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
    });

    const load = useCallback(async () => {
        try {
            const data = await apiListMenuItems();
            const normalized = (Array.isArray(data) ? data : []).map((it) => {
                const active = Boolean(it.is_active ?? it.is_on_menu);
                return {
                    ...it,
                    category: it.category || "other",
                    isActive: active,
                    isOnMenu: active,
                };
            });
            setItems(normalized);
        } catch { }
    }, []);

    useEffect(() => {
        if (!restaurantId) return;
        load();
    }, [load, restaurantId]);

    useEffect(() => {
        if (!restaurantId) {
            setServerCategories([]);
            return;
        }
        let mounted = true;
        apiFetchCategories({ restaurantId, auth: true })
            .then((rows) => {
                if (!mounted) return;
                if (Array.isArray(rows) && rows.length) {
                    const mapped = rows
                        .map((row) => ({
                            slug: row?.slug,
                            name: row?.name || CATEGORY_LABELS[row?.slug] || humanizeSlug(row?.slug),
                        }))
                        .filter((row) => row.slug);
                    setServerCategories(mapped);
                } else {
                    setServerCategories([]);
                }
            })
            .catch(() => {
                if (mounted) setServerCategories([]);
            });
        return () => {
            mounted = false;
        };
    }, [restaurantId]);

    const categoryOptions = useMemo(() => {
        if (serverCategories.length) {
            return serverCategories;
        }
        return CATEGORY_ORDER.map((slug) => ({
            slug,
            name: CATEGORY_LABELS[slug] || humanizeSlug(slug),
        }));
    }, [serverCategories]);

    const categoryLabelMap = useMemo(() => {
        const map = {};
        categoryOptions.forEach((cat) => {
            map[cat.slug] = cat.name || humanizeSlug(cat.slug);
        });
        return map;
    }, [categoryOptions]);

    const categorySortOrder = useMemo(
        () => categoryOptions.map((cat) => cat.slug),
        [categoryOptions]
    );

    useEffect(() => {
        if (!categoryOptions.length) return;
        if (!categoryOptions.some((opt) => opt.slug === category)) {
            setCategory(categoryOptions[0].slug);
        }
    }, [categoryOptions, category]);

    useEffect(() => {
        if (!categoryOptions.length) return;
        if (editing && !categoryOptions.some((opt) => opt.slug === eCategory)) {
            setECategory(categoryOptions[0].slug);
        }
    }, [categoryOptions, editing, eCategory]);

    useEffect(() => {
        if (!categoryOptions.length) return;
        if (filterCategory && !categoryOptions.some((opt) => opt.slug === filterCategory)) {
            setFilterCategory("");
        }
    }, [categoryOptions, filterCategory]);

    const filteredItems = useMemo(() => {
        const min = minPrice !== "" ? Number(minPrice) : null;
        const max = maxPrice !== "" ? Number(maxPrice) : null;
        const searchTerm = search.trim().toLowerCase();
        return items.filter((it) => {
            if (searchTerm && !(it.name || "").toLowerCase().includes(searchTerm)) return false;
            if (filterCategory && it.category !== filterCategory) return false;
            const priceNum = Number(it.price);
            if (min != null && priceNum < min) return false;
            if (max != null && priceNum > max) return false;
            return true;
        });
    }, [items, filterCategory, minPrice, maxPrice, search]);

    const currentMenu = useMemo(
        () => items.filter((it) => it.isActive),
        [items]
    );

    const currentMenuByCategory = useMemo(() => {
        const groups = new Map();
        currentMenu.forEach((item) => {
            const key = item.category || "other";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        const sorted = Array.from(groups.entries()).map(([cat, list]) => ({
            category: cat,
            label: categoryLabelMap[cat] || (cat ? humanizeSlug(cat) : "Other"),
            items: list.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
        }));

        return sorted.sort((a, b) => {
            const idxA = categorySortOrder.indexOf(a.category);
            const idxB = categorySortOrder.indexOf(b.category);
            const orderA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
            const orderB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
            if (orderA !== orderB) return orderA - orderB;
            return a.label.localeCompare(b.label);
        });
    }, [currentMenu, categoryLabelMap, categorySortOrder]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreateError("");
        setCreateOk("");
        setBusy(true);
        try {
            if (!name.trim()) throw new Error("Name is required");
            const p = Number(price);
            if (!Number.isFinite(p) || p <= 0) throw new Error("Price must be positive");
            const imageDataUrl = file ? await toDataUrl(file) : undefined;
            const res = await apiCreateMenuItem({ name: name.trim(), price: p, category, imageDataUrl });
            if (!res?.success) throw new Error(res?.error || "Failed to create item");
            if (file) {
                const base = slugify(name.trim());
                let ext = "";
                if (file.type === "image/png") ext = ".png";
                else if (file.type === "image/jpeg") ext = ".jpg";
                else if (file.type === "image/webp") ext = ".webp";
                setCreateOk(`Item created. Image saved as ${base}${ext}`);
            } else {
                setCreateOk("Item created.");
            }
            setName(""); setPrice(""); setCategory("other"); setFile(null);
            await load();
            e.target.reset?.();
        } catch (e2) {
            const serverMsg = e2?.response?.data?.error;
            setCreateError(serverMsg || e2?.message || "Upload failed");
        } finally {
            setBusy(false);
        }
    };

    const startEdit = (it) => {
        setEditing(it);
        setEName(it.name || "");
        setEPrice(String(it.price ?? ""));
        setECategory(it.category || "other");
        setEFile(null);
        setRemoveImage(false);
        if (editFileInputRef.current) editFileInputRef.current.value = "";
        updatePreview(it.image_url || null);
        setEditError("");
        setEditOk("");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditing(null);
        setEName("");
        setEPrice("");
        setECategory("other");
        setEFile(null);
        setRemoveImage(false);
        if (editFileInputRef.current) editFileInputRef.current.value = "";
        updatePreview(null);
        setEditError("");
        setEditOk("");
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!editing) return;
        setEditError("");
        setEditOk("");
        setBusy(true);
        try {
            if (!eName.trim()) throw new Error("Name is required");
            const p = Number(ePrice);
            if (!Number.isFinite(p) || p <= 0) throw new Error("Price must be positive");
            const imageDataUrl = eFile ? await toDataUrl(eFile) : undefined;
            const res = await apiUpdateMenuItem(editing.id, {
                name: eName.trim(),
                price: p,
                category: eCategory,
                imageDataUrl,
                removeImage,
            });
            if (!res?.success) throw new Error(res?.error || "Failed to update item");
            setEditOk("Item updated");
            await load();
            cancelEdit();
        } catch (e2) {
            const serverMsg = e2?.response?.data?.error;
            setEditError(serverMsg || e2?.message || "Edit failed");
        } finally {
            setBusy(false);
        }
    };

    const handleRemoveImageToggle = (checked) => {
        setRemoveImage(checked);
        setEditError("");
        setEditOk("");
        if (checked) {
            setEFile(null);
            if (editFileInputRef.current) {
                editFileInputRef.current.value = "";
            }
            updatePreview(null);
        } else if (editing) {
            updatePreview(editing.image_url || null);
        }
    };

    const handleClearSelectedImage = () => {
        setEFile(null);
        if (editFileInputRef.current) {
            editFileInputRef.current.value = "";
        }
        setRemoveImage(false);
        if (editing) {
            updatePreview(editing.image_url || null);
        } else {
            updatePreview(null);
        }
    };

    const handleDelete = async (it) => {
        if (!window.confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
        setCreateError("");
        setCreateOk("");
        setBusy(true);
        try {
            const res = await apiDeleteMenuItem(it.id);
            if (!res?.success) throw new Error(res?.error || "Failed to delete item");
            const msg =
                res?.deleted === false && res?.note
                    ? res.note
                    : "Item deleted";
            setCreateOk(msg);
            await load();
        } catch (e2) {
            setCreateError(e2?.message || "Delete failed");
        } finally {
            setBusy(false);
        }
    };

    const handleAddToMenu = async (it) => {
        setCreateError("");
        setCreateOk("");
        setBusy(true);
        try {
            const res = await apiAddItemToMenu(it.id);
            if (!res?.success) throw new Error(res?.error || "Failed to add to menu");
            setCreateOk(`"${it.name}" added to the menu`);
            await load();
        } catch (e2) {
            const msg = e2?.response?.data?.error || e2?.message || "Failed to add to menu";
            setCreateError(msg);
        } finally {
            setBusy(false);
        }
    };

    const handleRemoveFromMenu = async (it) => {
        setCreateError("");
        setCreateOk("");
        setBusy(true);
        try {
            const res = await apiRemoveItemFromMenu(it.id);
            if (!res?.success) throw new Error(res?.error || "Failed to remove from menu");
            setCreateOk(`"${it.name}" removed from the menu`);
            await load();
        } catch (e2) {
            const msg = e2?.response?.data?.error || e2?.message || "Failed to remove from menu";
            setCreateError(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid gap-10">
            {!restaurantId ? (
                <div className="card">
                    <h3 className="mt-0">Menu Manager</h3>
                    <p className="muted">This employee is not assigned to a restaurant yet.</p>
                </div>
            ) : (
                <>
                    <div className="card">
                        <h3 className="mt-0">
                            Add Menu Item
                            {restaurantName ? ` · ${restaurantName}` : ""}
                        </h3>
                        <form onSubmit={handleCreate} className="filters-grid">
                            <label className="form-label">
                                Name
                                <input
                                    className="input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </label>
                            <label className="form-label">
                                Price (MKD)
                                <input
                                    className="input"
                                    type="number"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    required
                                />
                            </label>
                            <label className="form-label">
                                Category
                                <select
                                    className="input"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    {categoryOptions.map((opt) => (
                                        <option key={opt.slug} value={opt.slug}>
                                            {opt.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="form-label">
                                Image
                                <input
                                    className="input"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={onFile}
                                />
                            </label>
                            <div className="self-end">
                                <button className="btn btn-primary" disabled={busy}>
                                    {busy ? "Uploading…" : "Create item"}
                                </button>
                            </div>
                        </form>
                        {createError ? <div className="error-text">{createError}</div> : null}
                        {createOk ? (
                            <div className="mt-12" style={{ color: "#065f46", fontWeight: 700 }}>
                                {createOk}
                            </div>
                        ) : null}
                    </div>

                    {editing && (
                        <div className="card card--light">
                            <div className="row space-between align-center" style={{ marginBottom: 12 }}>
                                <h3 className="mt-0 mb-0">
                                    Edit Menu Item
                                    {restaurantName ? ` · ${restaurantName}` : ""}
                                </h3>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={cancelEdit}
                                    disabled={busy}
                                >
                                    Close
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="filters-grid">
                                <label className="form-label">
                                    Name
                                    <input
                                        className="input"
                                        value={eName}
                                        onChange={(e) => setEName(e.target.value)}
                                        required
                                    />
                                </label>
                                <label className="form-label">
                                    Price (MKD)
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.01"
                                        value={ePrice}
                                        onChange={(e) => setEPrice(e.target.value)}
                                        required
                                    />
                                </label>
                                <label className="form-label">
                                    Category
                                    <select
                                        className="input"
                                        value={eCategory}
                                        onChange={(e) => setECategory(e.target.value)}
                                    >
                                        {categoryOptions.map((opt) => (
                                            <option key={`edit-${opt.slug}`} value={opt.slug}>
                                                {opt.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="form-label">
                                    <span>Current preview</span>
                                    {editPreview ? (
                                        <img
                                            src={editPreview}
                                            alt={eName || "preview"}
                                            style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid #e5e7eb" }}
                                        />
                                    ) : (
                                        <span className="muted small">
                                            {removeImage ? "Image will be removed" : "No image"}
                                        </span>
                                    )}
                                </div>
                                <label className="form-label">
                                    New Image (optional)
                                    <input
                                        ref={editFileInputRef}
                                        className="input"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={onEditFile}
                                        disabled={removeImage}
                                    />
                                    {eFile ? (
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            style={{ justifySelf: "start" }}
                                            onClick={handleClearSelectedImage}
                                            disabled={busy}
                                        >
                                            Remove selected file
                                        </button>
                                    ) : null}
                                </label>
                                {editing.image_url ? (
                                    <label className="form-label">
                                        Remove current image
                                        <input
                                            type="checkbox"
                                            checked={removeImage}
                                            onChange={(e) => handleRemoveImageToggle(e.target.checked)}
                                        />
                                    </label>
                                ) : null}
                                <div className="self-end row gap-8">
                                    <button className="btn btn-primary" disabled={busy}>
                                        {busy ? "Saving…" : "Save changes"}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={cancelEdit}
                                        disabled={busy}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                            {editError ? <div className="error-text">{editError}</div> : null}
                            {editOk ? (
                                <div className="mt-12" style={{ color: "#065f46", fontWeight: 700 }}>
                                    {editOk}
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div className="row gap-8" style={{ marginBottom: 16 }}>
                        <button
                            type="button"
                            className={`btn ${activeSection === "menu" ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setActiveSection("menu")}
                            disabled={busy}
                        >
                            Menu Overview
                        </button>
                        <button
                            type="button"
                            className={`btn ${activeSection === "all" ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setActiveSection("all")}
                            disabled={busy}
                        >
                            Menu Items
                        </button>
                    </div>

                    {activeSection === "menu" && (
                        <div className="card">
                            <h3 className="mt-0">Menu Overview{restaurantName ? ` · ${restaurantName}` : ""}</h3>
                            {currentMenu.length === 0 ? (
                                <div className="muted">No items are currently published on the customer menu.</div>
                            ) : (
                                <div className="current-menu-grid">
                                    {currentMenuByCategory.map((group) => (
                                        <section key={`menu-cat-${group.category}`} className="current-menu-column">
                                            <header className="current-menu-column__header">
                                                <span className="current-menu-column__title">{group.label}</span>
                                                <span className="current-menu-count">{group.items.length}</span>
                                            </header>
                                            <div className="current-menu-items">
                                                {group.items.map((it) => (
                                                    <div key={`menu-item-${group.category}-${it.id}`} className="current-menu-item">
                                                        <div className="current-menu-item__info">
                                                            {it.image_url ? (
                                                                <img src={it.image_url} alt={it.name} className="current-menu-item__thumb" />
                                                            ) : (
                                                                <div className="current-menu-item__thumb current-menu-item__thumb--placeholder">N/A</div>
                                                            )}
                                                            <div>
                                                                <div className="fw-700">{it.name}</div>
                                                                <div className="muted" style={{ fontSize: 12 }}>{fmtMKD(it.price)}</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn btn-danger"
                                                            onClick={() => handleRemoveFromMenu(it)}
                                                            disabled={busy}
                                                        >
                                                            {busy ? "Working…" : "Remove"}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === "all" && (
                        <div className="card">
                            <h3 className="mt-0">Menu Items{restaurantName ? ` · ${restaurantName}` : ""}</h3>
                            <div className="filters-grid" style={{ marginBottom: 12 }}>
                                <label className="form-label">
                                    Search
                                    <input className="input" placeholder="search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
                                </label>
                                <label className="form-label">
                                    Category
                                    <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                        <option value="">(any)</option>
                                        {categoryOptions.map((opt) => (
                                            <option key={`filter-${opt.slug}`} value={opt.slug}>
                                                {opt.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="form-label">
                                    Min Price
                                    <input className="input" type="number" step="0.01" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                                </label>
                                <label className="form-label">
                                    Max Price
                                    <input className="input" type="number" step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                                </label>
                                <div className="self-end">
                                    <button className="btn btn-ghost" onClick={load} disabled={busy}>
                                        Refresh
                                    </button>
                                </div>
                            </div>
                            {filteredItems.length === 0 ? (
                                <div className="muted">No items.</div>
                            ) : (
                                <div className="grid" style={{ gap: 8 }}>
                                    {filteredItems.map((it) => {
                                        const onMenu = Boolean(it.isActive);
                                        return (
                                            <div key={it.id} className="month-row" style={{ gridTemplateColumns: "60px 1fr 120px 140px 240px" }}>
                                                <div>
                                                    {it.image_url ? (
                                                        <img src={it.image_url} alt={it.name} style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 8 }} />
                                                    ) : (
                                                        <span className="dim">no image</span>
                                                    )}
                                                </div>
                                                <div className="fw-700">
                                                    {it.name}
                                                    <div className="muted" style={{ fontSize: 12 }}>
                                                        {onMenu ? "On menu" : "Hidden"}
                                                    </div>
                                                </div>
                                                <div>{fmtMKD(it.price)}</div>
                                                <div className="muted">{categoryLabelMap[it.category] || humanizeSlug(it.category) || "Other"}</div>
                                                <div className="row gap-8">
                                                    <button
                                                        className={`btn ${onMenu ? "btn-danger" : "btn-primary"}`}
                                                        onClick={() => (onMenu ? handleRemoveFromMenu(it) : handleAddToMenu(it))}
                                                        disabled={busy}
                                                    >
                                                        {busy ? "Working…" : onMenu ? "Remove from menu" : "Add to menu"}
                                                    </button>
                                                    <button className="btn btn-ghost" onClick={() => startEdit(it)} disabled={busy}>
                                                        Edit
                                                    </button>
                                                    <button className="btn btn-ghost" onClick={() => handleDelete(it)} disabled={busy}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default MenuManager;
