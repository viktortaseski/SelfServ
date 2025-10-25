import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    apiCreateMenuItem,
    apiListMenuItems,
    apiUpdateMenuItem,
    apiDeleteMenuItem,
    apiAddItemToMenu,
    apiRemoveItemFromMenu,
    apiListRestaurantCategories,
    apiAddRestaurantCategory,
    apiUpdateRestaurantCategory,
    apiDeleteRestaurantCategory,
    apiSearchCategoriesByName,
    apiSearchProductsByName,
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
const MAX_RESTAURANT_CATEGORIES = 4;

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
    const [restaurantCategories, setRestaurantCategories] = useState([]);
    const [categoryInput, setCategoryInput] = useState("");
    const [selectedCategorySuggestion, setSelectedCategorySuggestion] = useState(null);
    const [categoryImageFile, setCategoryImageFile] = useState(null);
    const categoryImageInputRef = useRef(null);
    const [categorySuggestions, setCategorySuggestions] = useState([]);
    const [categoryBusy, setCategoryBusy] = useState(false);
    const [categoryError, setCategoryError] = useState("");
    const [categoryOk, setCategoryOk] = useState("");
    const [categorySearchLoading, setCategorySearchLoading] = useState(false);

    // Create form state
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [category, setCategory] = useState("other");
    const [file, setFile] = useState(null);
    const [description, setDescription] = useState("");
    const [selectedProductSuggestion, setSelectedProductSuggestion] = useState(null);
    const [productSuggestions, setProductSuggestions] = useState([]);
    const [productSearchLoading, setProductSearchLoading] = useState(false);

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

    const clearProductSelection = useCallback(() => {
        setSelectedProductSuggestion(null);
        setProductSuggestions([]);
        setDescription("");
        setProductSearchLoading(false);
        setCreateError("");
        setCreateOk("");
    }, []);

    const handleNameInputChange = (value) => {
        setName(value);
        if (
            selectedProductSuggestion &&
            value.trim().toLowerCase() !==
                (selectedProductSuggestion.name || "").toLowerCase()
        ) {
            clearProductSelection();
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

    const refreshRestaurantCategories = useCallback(async () => {
        if (!restaurantId) {
            setRestaurantCategories([]);
            return;
        }
        try {
            const rows = await apiListRestaurantCategories();
            setRestaurantCategories(Array.isArray(rows) ? rows : []);
        } catch {
            setRestaurantCategories([]);
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!restaurantId) return;
        load();
    }, [load, restaurantId]);

    useEffect(() => {
        refreshRestaurantCategories();
    }, [refreshRestaurantCategories]);

    useEffect(() => {
        setCategoryInput("");
        setSelectedCategorySuggestion(null);
        setCategoryImageFile(null);
        setCategorySuggestions([]);
        if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
    }, [restaurantId]);

    useEffect(() => {
        const trimmed = categoryInput.trim();
        if (!trimmed) {
            setCategorySuggestions([]);
            setCategorySearchLoading(false);
            return;
        }

        let cancelled = false;
        setCategorySearchLoading(true);
        const handle = setTimeout(async () => {
            try {
                const results = await apiSearchCategoriesByName(trimmed);
                if (cancelled) return;
                const filtered = (Array.isArray(results) ? results : []).filter(
                    (cat) =>
                        !restaurantCategories.some(
                            (existing) => existing.categoryId === Number(cat.id)
                        )
                );
                setCategorySuggestions(filtered);
            } catch {
                if (!cancelled) setCategorySuggestions([]);
            } finally {
                if (!cancelled) setCategorySearchLoading(false);
            }
        }, 200);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [categoryInput, restaurantCategories]);

    useEffect(() => {
        const trimmed = name.trim();
        if (!trimmed) {
            setProductSuggestions([]);
            setProductSearchLoading(false);
            if (selectedProductSuggestion) {
                clearProductSelection();
            }
            return;
        }

        if (
            selectedProductSuggestion &&
            trimmed.toLowerCase() === (selectedProductSuggestion.name || "").toLowerCase()
        ) {
            setProductSuggestions([]);
            setProductSearchLoading(false);
            return;
        }

        let cancelled = false;
        setProductSearchLoading(true);
        const handle = setTimeout(async () => {
            try {
                const results = await apiSearchProductsByName(trimmed);
                if (cancelled) return;
                setProductSuggestions(Array.isArray(results) ? results : []);
            } catch {
                if (!cancelled) setProductSuggestions([]);
            } finally {
                if (!cancelled) setProductSearchLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [name, selectedProductSuggestion, clearProductSelection]);

    const categoryOptions = useMemo(() => {
        if (restaurantCategories.length) {
            const mapped = restaurantCategories
                .filter((cat) => cat?.slug)
                .map((cat) => ({
                    slug: cat.slug,
                    name: cat.name || humanizeSlug(cat.slug),
                }));
            if (mapped.length) return mapped;
        }
        return CATEGORY_ORDER.map((slug) => ({
            slug,
            name: CATEGORY_LABELS[slug] || humanizeSlug(slug),
        }));
    }, [restaurantCategories]);

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
            const trimmedName = name.trim() || selectedProductSuggestion?.name || "";
            if (!trimmedName) throw new Error("Name is required");
            const p = Number(price);
            if (!Number.isFinite(p) || p <= 0) throw new Error("Price must be positive");
            const imageDataUrl = file ? await toDataUrl(file) : undefined;
            const payload = {
                name: trimmedName,
                price: p,
                category,
                imageDataUrl,
            };
            if (selectedProductSuggestion?.id) {
                payload.productId = selectedProductSuggestion.id;
            } else if (description.trim()) {
                payload.description = description.trim();
            }
            const res = await apiCreateMenuItem(payload);
            if (!res?.success) throw new Error(res?.error || "Failed to create item");

            if (file) {
                const base = slugify(trimmedName);
                let ext = "";
                if (file.type === "image/png") ext = ".png";
                else if (file.type === "image/jpeg") ext = ".jpg";
                else if (file.type === "image/webp") ext = ".webp";
                setCreateOk(`Item created. Image saved as ${base}${ext}`);
            } else {
                setCreateOk("Item created.");
            }

            setName("");
            setPrice("");
            setCategory("other");
            setFile(null);
            setDescription("");
            clearProductSelection();
            e.target.reset?.();
            await load();
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

    const handleCategoryInputChange = (value) => {
        setCategoryInput(value);
        setCategoryError("");
        setCategoryOk("");
        if (
            !value ||
            !selectedCategorySuggestion ||
            value.trim().toLowerCase() !==
                (selectedCategorySuggestion.name || selectedCategorySuggestion.slug || "").toLowerCase()
        ) {
            setSelectedCategorySuggestion(null);
        }
    };

    const handleCategoryImageFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        setCategoryImageFile(file);
        setCategoryError("");
        setCategoryOk("");
    };

    const handleSuggestionSelect = (suggestion) => {
        setSelectedCategorySuggestion(suggestion);
        setCategoryInput(suggestion.name || humanizeSlug(suggestion.slug));
        setCategorySuggestions([]);
        setCategoryError("");
        setCategoryOk("");
    };

    const handleAddRestaurantCategory = async (e) => {
        e.preventDefault();
        setCategoryError("");
        setCategoryOk("");
        if (restaurantCategories.length >= MAX_RESTAURANT_CATEGORIES) {
            setCategoryError(`You can only have ${MAX_RESTAURANT_CATEGORIES} categories.`);
            return;
        }
        const trimmed = categoryInput.trim();
        if (!trimmed) {
            setCategoryError("Category name is required.");
            return;
        }
        setCategoryBusy(true);
        try {
            const payload = {};
            if (
                selectedCategorySuggestion &&
                selectedCategorySuggestion.id &&
                trimmed.toLowerCase() ===
                    (selectedCategorySuggestion.name || selectedCategorySuggestion.slug).toLowerCase()
            ) {
                payload.categoryId = selectedCategorySuggestion.id;
            } else if (selectedCategorySuggestion && selectedCategorySuggestion.id) {
                payload.categoryId = selectedCategorySuggestion.id;
            } else {
                payload.name = trimmed;
            }
            if (categoryImageFile) {
                payload.imageDataUrl = await toDataUrl(categoryImageFile);
            }
            const added = await apiAddRestaurantCategory(payload);
            if (!added) {
                throw new Error("Failed to add category");
            }
            setCategoryOk(`Category "${added.name || trimmed}" saved.`);
            setCategoryInput("");
            setSelectedCategorySuggestion(null);
            setCategorySuggestions([]);
            setCategoryImageFile(null);
            if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
            await refreshRestaurantCategories();
        } catch (e2) {
            const serverMsg = e2?.response?.data?.error;
            setCategoryError(serverMsg || e2?.message || "Failed to save category");
        } finally {
            setCategoryBusy(false);
        }
    };

    const handleUploadCategoryImage = async (restaurantCategoryId, file) => {
        if (!file) return;
        setCategoryError("");
        setCategoryOk("");
        setCategoryBusy(true);
        try {
            const imageDataUrl = await toDataUrl(file);
            await apiUpdateRestaurantCategory(restaurantCategoryId, { imageDataUrl });
            setCategoryOk("Category image updated.");
            await refreshRestaurantCategories();
        } catch (e2) {
            const serverMsg = e2?.response?.data?.error;
            setCategoryError(serverMsg || e2?.message || "Failed to update category image");
        } finally {
            setCategoryBusy(false);
        }
    };

    const handleCategoryImageUploadChange = async (restaurantCategoryId, event) => {
        const file = event.target.files?.[0] || null;
        if (!file) return;
        await handleUploadCategoryImage(restaurantCategoryId, file);
        event.target.value = "";
    };

    const handleRemoveCategoryImage = async (restaurantCategoryId) => {
        setCategoryError("");
        setCategoryOk("");
        setCategoryBusy(true);
        try {
            await apiUpdateRestaurantCategory(restaurantCategoryId, { removeImage: true });
            setCategoryOk("Category image removed.");
            await refreshRestaurantCategories();
        } catch (e2) {
            const serverMsg = e2?.response?.data?.error;
            setCategoryError(serverMsg || e2?.message || "Failed to remove category image");
        } finally {
            setCategoryBusy(false);
        }
    };

    const handleDeleteRestaurantCategory = async (restaurantCategoryId, name) => {
        if (
            !window.confirm(
                `Remove category "${name}" from this restaurant? Items using this category must be reassigned first.`
            )
        )
            return;
        setCategoryError("");
        setCategoryOk("");
        setCategoryBusy(true);
        try {
            await apiDeleteRestaurantCategory(restaurantCategoryId);
            setCategoryOk("Category removed.");
            await refreshRestaurantCategories();
        } catch (e2) {
            const serverMsg = e2?.response?.data?.error;
            setCategoryError(serverMsg || e2?.message || "Failed to remove category");
        } finally {
            setCategoryBusy(false);
        }
    };

    const handleProductSuggestionSelect = (suggestion) => {
        if (!suggestion) return;
        setSelectedProductSuggestion(suggestion);
        setProductSuggestions([]);
        setProductSearchLoading(false);
        setName(suggestion.name || "");
        setDescription(suggestion.description || "");
        const targetPrice =
            suggestion.restaurantPrice != null
                ? suggestion.restaurantPrice
                : suggestion.samplePrice != null
                    ? suggestion.samplePrice
                    : null;
        setPrice(
            targetPrice != null && !Number.isNaN(Number(targetPrice))
                ? String(targetPrice)
                : ""
        );
        if (suggestion.suggestedCategorySlug) {
            const slug = suggestion.suggestedCategorySlug;
            if (categoryOptions.some((opt) => opt.slug === slug)) {
                setCategory(slug);
            }
        }
        setCreateError("");
        setCreateOk("");
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
                            <label className="form-label category-input-wrapper">
                                Name
                                <input
                                    className="input"
                                    value={name}
                                    onChange={(e) => handleNameInputChange(e.target.value)}
                                    placeholder="Start typing to search existing products"
                                    required
                                />
                                {productSearchLoading ? (
                                    <span className="muted small">Searching…</span>
                                ) : null}
                                {!!productSuggestions.length && (
                                    <div className="category-suggestions">
                                        {productSuggestions.map((suggestion) => {
                                            const disabled = suggestion.isLinked;
                                            const priceLine = suggestion.restaurantPrice != null
                                                ? `Price here: ${fmtMKD(suggestion.restaurantPrice)}`
                                                : suggestion.samplePrice != null
                                                    ? `Sample price: ${fmtMKD(suggestion.samplePrice)}`
                                                    : "";
                                            return (
                                                <button
                                                    type="button"
                                                    key={`prod-suggest-${suggestion.id}`}
                                                    className="category-suggestion"
                                                    onClick={() => handleProductSuggestionSelect(suggestion)}
                                                    disabled={disabled || productSearchLoading || busy}
                                                >
                                                    <div className="fw-700">{suggestion.name}</div>
                                                    {priceLine ? (
                                                        <div className="muted small">{priceLine}</div>
                                                    ) : null}
                                                    {disabled ? (
                                                        <div className="muted small">Already on menu</div>
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </label>
                            {selectedProductSuggestion ? (
                                <div className="muted small" style={{ marginTop: -6 }}>
                                    Using shared product. You can adjust price and image for this restaurant.
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-small"
                                        style={{ marginLeft: 8 }}
                                        onClick={clearProductSelection}
                                        disabled={busy}
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : null}
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
                                Description
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional description"
                                    disabled={!!selectedProductSuggestion}
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
                        <button
                            type="button"
                            className={`btn ${activeSection === "categories" ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setActiveSection("categories")}
                            disabled={busy || categoryBusy}
                        >
                            Category Management
                        </button>
                    </div>

                    {activeSection === "categories" && (
                        <div className="card">
                            <h3 className="mt-0">
                                Restaurant Categories
                                {restaurantName ? ` · ${restaurantName}` : ""}
                            </h3>
                            <p className="muted small">
                                You can assign up to {MAX_RESTAURANT_CATEGORIES} categories. These power the menu tabs and product forms.
                            </p>
                            <form onSubmit={handleAddRestaurantCategory} className="category-manager-grid">
                                <label className="form-label category-input-wrapper">
                                    Category name
                                    <input
                                        className="input"
                                        value={categoryInput}
                                        onChange={(e) => handleCategoryInputChange(e.target.value)}
                                        placeholder="Type to search or create"
                                        disabled={categoryBusy || restaurantCategories.length >= MAX_RESTAURANT_CATEGORIES}
                                    />
                                    {categorySearchLoading ? (
                                        <span className="muted small">Searching…</span>
                                    ) : null}
                                    {!!categorySuggestions.length && (
                                        <div className="category-suggestions">
                                            {categorySuggestions.map((suggestion) => (
                                                <button
                                                    type="button"
                                                    key={`suggest-${suggestion.id}`}
                                                    className="category-suggestion"
                                                    onClick={() => handleSuggestionSelect(suggestion)}
                                                    disabled={categoryBusy}
                                                >
                                                    {suggestion.name || humanizeSlug(suggestion.slug)}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </label>
                                <label className="form-label">
                                    Category image (optional)
                                    <input
                                        ref={categoryImageInputRef}
                                        className="input"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleCategoryImageFileChange}
                                        disabled={categoryBusy}
                                    />
                                </label>
                                <div className="self-end">
                                    <button
                                        className="btn btn-primary"
                                        type="submit"
                                        disabled={categoryBusy || restaurantCategories.length >= MAX_RESTAURANT_CATEGORIES}
                                    >
                                        {categoryBusy ? "Saving…" : "Add category"}
                                    </button>
                                </div>
                            </form>
                            {restaurantCategories.length >= MAX_RESTAURANT_CATEGORIES ? (
                                <div className="muted small" style={{ marginTop: 8 }}>
                                    Maximum categories reached. Remove one to add another.
                                </div>
                            ) : null}
                            {categoryError ? <div className="error-text">{categoryError}</div> : null}
                            {categoryOk ? (
                                <div className="mt-12" style={{ color: "#065f46", fontWeight: 700 }}>
                                    {categoryOk}
                                </div>
                            ) : null}

                            <div className="restaurant-category-list">
                                {restaurantCategories.length === 0 ? (
                                    <div className="muted small">No categories yet.</div>
                                ) : (
                                    restaurantCategories.map((cat) => (
                                        <div key={cat.restaurantCategoryId} className="restaurant-category-row">
                                            <div className="restaurant-category-thumb">
                                                {cat.image_url ? (
                                                    <img src={cat.image_url} alt={cat.name} />
                                                ) : (
                                                    <span>{(cat.name || cat.slug || "?").slice(0, 1).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="restaurant-category-info">
                                                <div className="fw-700">{cat.name}</div>
                                                <div className="muted small">/{cat.slug}</div>
                                                <div className="muted small">
                                                    {cat.item_count} item{cat.item_count === 1 ? "" : "s"}
                                                </div>
                                            </div>
                                            <div className="restaurant-category-actions">
                                                <label className="btn btn-ghost btn-small">
                                                    Update image
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        onChange={(e) =>
                                                            handleCategoryImageUploadChange(cat.restaurantCategoryId, e)
                                                        }
                                                        disabled={categoryBusy}
                                                        style={{ display: "none" }}
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-small"
                                                    onClick={() => handleRemoveCategoryImage(cat.restaurantCategoryId)}
                                                    disabled={categoryBusy || !cat.raw_image_url}
                                                >
                                                    Remove image
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-small"
                                                    onClick={() =>
                                                        handleDeleteRestaurantCategory(
                                                            cat.restaurantCategoryId,
                                                            cat.name || cat.slug
                                                        )
                                                    }
                                                    disabled={categoryBusy}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

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
