import { useEffect, useState, useCallback, useMemo } from "react";
import { apiCreateMenuItem, apiListMenuItems, apiUpdateMenuItem, apiDeleteMenuItem, fmtMKD } from "./dashboardApi";
import "./dashboard.css";

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

function MenuManager() {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");

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
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    const onFile = (e) => setFile(e.target.files?.[0] || null);
    const onEditFile = (e) => setEFile(e.target.files?.[0] || null);

    const toDataUrl = (f) => new Promise((resolve, reject) => {
        if (!f) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
    });

    const load = useCallback(async () => {
        try {
            const data = await apiListMenuItems({
                search: search.trim() || undefined,
            });
            setItems(Array.isArray(data) ? data : []);
        } catch {}
    }, [search]);

    useEffect(() => { load(); }, [load]);

    const filteredItems = useMemo(() => {
        const min = minPrice !== "" ? Number(minPrice) : null;
        const max = maxPrice !== "" ? Number(maxPrice) : null;
        return items.filter((it) => {
            if (filterCategory && it.category !== filterCategory) return false;
            const priceNum = Number(it.price);
            if (min != null && priceNum < min) return false;
            if (max != null && priceNum > max) return false;
            return true;
        });
    }, [items, filterCategory, minPrice, maxPrice]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setErr(""); setOk(""); setBusy(true);
        try {
            if (!name.trim()) throw new Error("Name is required");
            const p = Number(price);
            if (!Number.isFinite(p) || p <= 0) throw new Error("Price must be positive");
            const imageDataUrl = await toDataUrl(file);
            const res = await apiCreateMenuItem({ name: name.trim(), price: p, category, imageDataUrl });
            if (!res?.success) throw new Error(res?.error || "Failed to create item");
            const base = slugify(name.trim());
            let ext = "";
            if (file?.type === "image/png") ext = ".png";
            else if (file?.type === "image/jpeg") ext = ".jpg";
            else if (file?.type === "image/webp") ext = ".webp";
            setOk(`Item created. Image saved as ${base}${ext}`);
            setName(""); setPrice(""); setCategory("other"); setFile(null);
            await load();
            e.target.reset?.();
        } catch (e2) {
            setErr(e2?.message || "Upload failed");
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
        setErr(""); setOk("");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditing(null);
        setEName(""); setEPrice(""); setECategory("other"); setEFile(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!editing) return;
        setErr(""); setOk(""); setBusy(true);
        try {
            if (!eName.trim()) throw new Error("Name is required");
            const p = Number(ePrice);
            if (!Number.isFinite(p) || p <= 0) throw new Error("Price must be positive");
            const imageDataUrl = await toDataUrl(eFile);
            const res = await apiUpdateMenuItem(editing.id, { name: eName.trim(), price: p, category: eCategory, imageDataUrl });
            if (!res?.success) throw new Error(res?.error || "Failed to update item");
            setOk("Item updated");
            await load();
            cancelEdit();
        } catch (e2) {
            setErr(e2?.message || "Edit failed");
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (it) => {
        if (!window.confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
        setErr(""); setOk(""); setBusy(true);
        try {
            const res = await apiDeleteMenuItem(it.id);
            if (!res?.success) throw new Error(res?.error || "Failed to delete item");
            setOk("Item deleted");
            await load();
        } catch (e2) {
            setErr(e2?.message || "Delete failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid gap-10">
            <div className="card">
                <h3 className="mt-0">{editing ? "Edit Menu Item" : "Add Menu Item"}</h3>
                <form onSubmit={editing ? handleSave : handleCreate} className="filters-grid">
                    <label className="form-label">
                        Name
                        <input className="input" value={editing ? eName : name} onChange={(e) => (editing ? setEName(e.target.value) : setName(e.target.value))} required />
                    </label>
                    <label className="form-label">
                        Price (MKD)
                        <input className="input" type="number" step="0.01" value={editing ? ePrice : price} onChange={(e) => (editing ? setEPrice(e.target.value) : setPrice(e.target.value))} required />
                    </label>
                    <label className="form-label">
                        Category
                        <select className="input" value={editing ? eCategory : category} onChange={(e) => (editing ? setECategory(e.target.value) : setCategory(e.target.value))}>
                            <option value="other">other</option>
                            <option value="coffee">coffee</option>
                            <option value="drinks">drinks</option>
                            <option value="food">food</option>
                            <option value="desserts">desserts</option>
                        </select>
                    </label>
                    <label className="form-label">
                        {editing ? "New Image (optional)" : "Image"}
                        <input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={editing ? onEditFile : onFile} />
                    </label>
                    <div className="self-end">
                        {!editing ? (
                            <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Create item"}</button>
                        ) : (
                            <div className="row gap-8">
                                <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={busy}>Cancel</button>
                            </div>
                        )}
                    </div>
                </form>
                {err ? <div className="error-text">{err}</div> : null}
                {ok ? <div className="mt-12" style={{ color: '#065f46', fontWeight: 700 }}>{ok}</div> : null}
            </div>

            <div className="card">
                <h3 className="mt-0">Menu Items</h3>
                <div className="filters-grid" style={{ marginBottom: 12 }}>
                    <label className="form-label">
                        Search
                        <input className="input" placeholder="search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </label>
                    <label className="form-label">
                        Category
                        <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                            <option value="">(any)</option>
                            <option value="other">other</option>
                            <option value="coffee">coffee</option>
                            <option value="drinks">drinks</option>
                            <option value="food">food</option>
                            <option value="desserts">desserts</option>
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
                        <button className="btn btn-ghost" onClick={load} disabled={busy}>Refresh</button>
                    </div>
                </div>
                {filteredItems.length === 0 ? (
                    <div className="muted">No items.</div>
                ) : (
                    <div className="grid" style={{ gap: 8 }}>
                        {filteredItems.map((it) => (
                            <div key={it.id} className="month-row" style={{ gridTemplateColumns: '60px 1fr 120px 140px 160px' }}>
                                <div>
                                    {it.image_url ? <img src={it.image_url} alt={it.name} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8 }} /> : <span className="dim">no image</span>}
                                </div>
                                <div className="fw-700">{it.name}</div>
                                <div>{fmtMKD(it.price)}</div>
                                <div className="muted">{it.category}</div>
                                <div className="row gap-8">
                                    <button className="btn btn-ghost" onClick={() => startEdit(it)} disabled={busy}>Edit</button>
                                    <button className="btn btn-ghost" onClick={() => handleDelete(it)} disabled={busy}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MenuManager;
