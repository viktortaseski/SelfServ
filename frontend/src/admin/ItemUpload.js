import { useState } from "react";
import { apiCreateMenuItem } from "./dashboardApi";
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

function ItemUpload() {
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [category, setCategory] = useState("other");
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    const onFile = (e) => {
        const f = e.target.files?.[0] || null;
        setFile(f);
    };

    const toDataUrl = (f) =>
        new Promise((resolve, reject) => {
            if (!f) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(f);
        });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        setOk("");
        setBusy(true);
        try {
            if (!name.trim()) throw new Error("Name is required");
            const p = Number(price);
            if (!Number.isFinite(p) || p <= 0) throw new Error("Price must be positive");

            const imageDataUrl = await toDataUrl(file);
            const res = await apiCreateMenuItem({ name: name.trim(), price: p, category, imageDataUrl });
            if (res?.success) {
                const base = slugify(name.trim());
                let ext = "";
                if (file?.type === "image/png") ext = ".png";
                else if (file?.type === "image/jpeg") ext = ".jpg";
                else if (file?.type === "image/webp") ext = ".webp";
                const fname = base + ext;
                setOk(`Item created. Image saved as ${fname}`);
                setName("");
                setPrice("");
                setCategory("other");
                setFile(null);
                e.target.reset?.();
            } else {
                throw new Error(res?.error || "Failed to create item");
            }
        } catch (e2) {
            setErr(e2?.message || "Upload failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card">
            <h3 className="mt-0">Add Menu Item</h3>
            <form onSubmit={handleSubmit} className="filters-grid">
                <label className="form-label">
                    Name
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="form-label">
                    Price (MKD)
                    <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </label>
                <label className="form-label">
                    Category
                    <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="other">other</option>
                        <option value="coffee">coffee</option>
                        <option value="drinks">drinks</option>
                        <option value="food">food</option>
                        <option value="desserts">desserts</option>
                    </select>
                </label>
                <label className="form-label">
                    Image
                    <input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
                </label>
                <div className="self-end">
                    <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Create item"}</button>
                </div>
            </form>
            {err ? <div className="error-text">{err}</div> : null}
            {ok ? <div className="mt-12" style={{ color: '#065f46', fontWeight: 700 }}>{ok}</div> : null}
        </div>
    );
}

export default ItemUpload;
