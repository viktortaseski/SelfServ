import { useEffect, useMemo, useRef, useState } from "react";
import {
    apiFetchOrdersAdmin,
    apiFetchRestaurantStatus,
    apiUpdateRestaurantStatus,
    apiUpdateRestaurantLogo,
    apiRemoveRestaurantLogo,
    DEFAULT_FROM_STR,
    DEFAULT_TO_STR,
    computeStats,
    fmtMKD,
} from "./dashboardApi";
import "./dashboard.css";
import EmployeeManager from "./EmployeeManager";

function Stat({ label, value }) {
    return (
        <div className="stat-box">
            <div className="muted small">{label}</div>
            <div className="stat-value">{value}</div>
        </div>
    );
}

function OrderCard({ order }) {
    const [open, setOpen] = useState(false);
    const statusToBadge = {
        open: "badge badge--open",
        paid: "badge badge--paid",
        canceled: "badge badge--canceled",
        void: "badge badge--void",
    };
    const badgeClass = statusToBadge[order.status] || "badge";
    const statusLabel =
        order.status && typeof order.status === "string"
            ? order.status.charAt(0).toUpperCase() + order.status.slice(1)
            : "Open";

    return (
        <div className="order-card">
            <div className="order-header" onClick={() => setOpen((v) => !v)}>
                <div>
                    <strong>#{order.id}</strong> • {order.table_name ?? `table ${order.table_id}`} •{" "}
                    <span className="muted">{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div className="row gap-10">
                    <span className={badgeClass}>{statusLabel}</span>
                    <strong>{fmtMKD(Number(order.subtotal || 0) + Number(order.tip || 0))}</strong>
                </div>
            </div>

            {open && (
                <div className="pt-8">
                    <div className="muted mb-6">
                        Subtotal: <strong>{fmtMKD(order.subtotal)}</strong> • Tip:{" "}
                        <strong>{fmtMKD(order.tip || 0)}</strong>
                    </div>
                    <div className="grid gap-6">
                        {(order.items || []).map((it, idx) => (
                            <div key={idx} className="item-row">
                                <div className="fw-700">{it.name}</div>
                                <div>x{it.quantity}</div>
                                <div>{fmtMKD(it.price)}</div>
                                <div className="muted">
                                    {it.note ? `“${it.note}”` : <span className="dim">—</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Dashboard({ user: _user }) {
    // Filters
    const [fromDate, setFromDate] = useState(DEFAULT_FROM_STR());
    const [toDate, setToDate] = useState(DEFAULT_TO_STR());
    const [fromTime, setFromTime] = useState("00:00");
    const [toTime, setToTime] = useState("23:59");
    const [status, setStatus] = useState("");
    const [tableId, setTableId] = useState("");
    const [q, setQ] = useState("");
    const [limit, setLimit] = useState(100);

    // Data
    const [orders, setOrders] = useState([]);
    const restaurantName = _user?.restaurant_name || "";
    const restaurantId = _user?.restaurant_id || null;
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [restaurantIsActive, setRestaurantIsActive] = useState(true);
    const [statusLoading, setStatusLoading] = useState(false);
    const [statusError, setStatusError] = useState("");
    const [activePanel, setActivePanel] = useState("filters");
    const [logoUrl, setLogoUrl] = useState("");
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoError, setLogoError] = useState("");
    const [logoSuccess, setLogoSuccess] = useState("");
    const logoInputRef = useRef(null);

    const fetchOrders = async () => {
        setBusy(true);
        setErr("");
        try {
            const fromISO = `${fromDate}T${fromTime}:00`;
            const toISO = `${toDate}T${toTime}:59`;
            const rows = await apiFetchOrdersAdmin({
                from: fromISO,
                to: toISO,
                status,
                tableId,
                q,
                limit,
            });
            setOrders(Array.isArray(rows) ? rows : []);
        } catch (e2) {
            setErr(e2?.message || "Fetch error");
        } finally {
            setBusy(false);
        }
    };

    const stats = useMemo(() => computeStats(orders), [orders]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!logoFile) {
            setLogoPreview("");
            return;
        }
        let objectUrl = "";
        try {
            objectUrl = URL.createObjectURL(logoFile);
            setLogoPreview(objectUrl);
        } catch (previewErr) {
            setLogoError("Could not preview selected image");
            setLogoPreview("");
            return;
        }
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [logoFile]);

    useEffect(() => {
        let cancelled = false;
        if (!restaurantId) {
            setRestaurantIsActive(true);
            setLogoUrl("");
            setLogoError("");
            setLogoSuccess("");
            return;
        }
        setStatusLoading(true);
        setStatusError("");
        apiFetchRestaurantStatus(restaurantId)
            .then((restaurant) => {
                if (cancelled) return;
                if (restaurant && typeof restaurant.is_active === "boolean") {
                    setRestaurantIsActive(Boolean(restaurant.is_active));
                } else {
                    setRestaurantIsActive(true);
                }
                setLogoUrl(restaurant?.logo_url || "");
                setLogoError("");
                setLogoSuccess("");
            })
            .catch((error) => {
                if (cancelled) return;
                setStatusError(error?.message || "Failed to load restaurant status");
            })
            .finally(() => {
                if (!cancelled) setStatusLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [restaurantId]);

    const handleToggleRestaurantStatus = async () => {
        if (statusLoading) return;
        try {
            setStatusLoading(true);
            setStatusError("");
            const updated = await apiUpdateRestaurantStatus(!restaurantIsActive);
            if (updated && typeof updated.is_active === "boolean") {
                setRestaurantIsActive(Boolean(updated.is_active));
            }
            if (updated && Object.prototype.hasOwnProperty.call(updated, "logo_url")) {
                setLogoUrl(updated.logo_url || "");
            }
        } catch (error) {
            const message =
                error?.response?.data?.error ||
                error?.message ||
                "Failed to update restaurant status";
            setStatusError(message);
        } finally {
            setStatusLoading(false);
        }
    };

    const handleLogoFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setLogoFile(file || null);
        setLogoError("");
        setLogoSuccess("");
    };

    const fileToDataUrl = (file) =>
        new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Unable to read file"));
            reader.readAsDataURL(file);
        });

    const handleUploadLogo = async () => {
        if (logoBusy) return;
        setLogoError("");
        setLogoSuccess("");
        if (!logoFile) {
            setLogoError("Select an image before uploading");
            return;
        }
        try {
            setLogoBusy(true);
            const dataUrl = await fileToDataUrl(logoFile);
            if (!dataUrl) throw new Error("Unable to read selected image");
            const updated = await apiUpdateRestaurantLogo(dataUrl);
            setLogoUrl(updated?.logo_url || "");
            setLogoSuccess("Logo updated successfully.");
            setLogoFile(null);
            if (logoInputRef.current) {
                logoInputRef.current.value = "";
            }
        } catch (error) {
            const message =
                error?.response?.data?.error ||
                error?.message ||
                "Failed to update logo";
            setLogoError(message);
        } finally {
            setLogoBusy(false);
        }
    };

    const handleClearLogoSelection = () => {
        if (logoBusy) return;
        setLogoFile(null);
        setLogoError("");
        setLogoSuccess("");
        if (logoInputRef.current) {
            logoInputRef.current.value = "";
        }
    };

    const handleRemoveLogo = async () => {
        if (logoBusy) return;
        setLogoError("");
        setLogoSuccess("");
        try {
            setLogoBusy(true);
            const updated = await apiRemoveRestaurantLogo();
            setLogoUrl(updated?.logo_url || "");
            setLogoSuccess("Logo removed.");
            setLogoFile(null);
            if (logoInputRef.current) {
                logoInputRef.current.value = "";
            }
        } catch (error) {
            const message =
                error?.response?.data?.error ||
                error?.message ||
                "Failed to remove logo";
            setLogoError(message);
        } finally {
            setLogoBusy(false);
        }
    };

    const displayLogoSrc = logoPreview || logoUrl || "";

    return (
        <div>
            <section className="card">
                <div className="row space-between align-center">
                    <div>
                        <h3 className="mt-0 mb-8">Restaurant availability</h3>
                        <span
                            className={restaurantIsActive ? "badge badge--active" : "badge badge--inactive"}
                            style={{ display: "inline-block", marginTop: 4 }}
                        >
                            {restaurantIsActive ? "Active" : "Inactive"}
                        </span>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={handleToggleRestaurantStatus}
                        disabled={statusLoading}
                    >
                        {statusLoading
                            ? "Saving…"
                            : restaurantIsActive
                                ? "Set to inactive"
                                : "Set to active"}
                    </button>
                </div>
                <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
                    Control whether guests can access and order from your menu.
                </p>
                {statusError ? (
                    <div className="error-text" style={{ marginTop: 8 }}>
                        {statusError}
                    </div>
                ) : null}
            </section>

            <section className="card mt-16">
                <h3 className="mt-0">Restaurant logo</h3>
                <p className="muted small" style={{ marginBottom: 12 }}>
                    Upload a logo to personalize your menu and ordering experience.
                </p>
                <div className="logo-section">
                    <div className="logo-preview-box">
                        {displayLogoSrc ? (
                            <img src={displayLogoSrc} alt="Restaurant logo preview" className="logo-preview-img" />
                        ) : (
                            <div className="muted small">No logo</div>
                        )}
                    </div>
                    <div className="grid gap-8">
                        <label className="form-label">
                            Logo image
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="input"
                                onChange={handleLogoFileChange}
                                disabled={logoBusy}
                            />
                        </label>
                        {logoFile ? (
                            <div className="muted small">Selected file: {logoFile.name}</div>
                        ) : null}
                        <div className="logo-actions">
                            <button type="button" className="btn btn-primary" onClick={handleUploadLogo} disabled={logoBusy}>
                                {logoBusy ? "Saving…" : "Upload logo"}
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={handleClearLogoSelection}
                                disabled={logoBusy || !logoFile}
                            >
                                Clear selection
                            </button>
                            {logoUrl ? (
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleRemoveLogo}
                                    disabled={logoBusy}
                                >
                                    Remove current logo
                                </button>
                            ) : null}
                        </div>
                        {logoError ? <div className="error-text">{logoError}</div> : null}
                        {logoSuccess ? <div className="success-text">{logoSuccess}</div> : null}
                    </div>
                </div>
            </section>

            <div className="row gap-8" style={{ margin: "16px 0" }}>
                {[
                    { id: "filters", label: "Filters" },
                    { id: "stats", label: "Quick stats" },
                    { id: "employees", label: "Employee Management" },
                ].map((btn) => (
                    <button
                        key={btn.id}
                        type="button"
                        className={`btn ${activePanel === btn.id ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setActivePanel(btn.id)}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            {activePanel === "filters" && (
                <section className="card">
                    <h3 className="mt-0">
                        Filters
                        {restaurantName ? ` · ${restaurantName}` : ""}
                    </h3>
                    <div className="filters-grid">
                        <label className="form-label">
                            From date
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="input"
                            />
                        </label>
                        <label className="form-label">
                            From time
                            <input
                                type="time"
                                value={fromTime}
                                onChange={(e) => setFromTime(e.target.value)}
                                className="input"
                            />
                        </label>
                        <label className="form-label">
                            To date
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="input"
                            />
                        </label>
                        <label className="form-label">
                            To time
                            <input
                                type="time"
                                value={toTime}
                                onChange={(e) => setToTime(e.target.value)}
                                className="input"
                            />
                        </label>

                        <label className="form-label">
                            Status
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                                <option value="">(any)</option>
                                <option value="open">open</option>
                                <option value="paid">paid</option>
                                <option value="canceled">canceled</option>
                                <option value="void">void</option>
                            </select>
                        </label>

                        <label className="form-label">
                            Table ID
                            <input
                                type="number"
                                min="1"
                                placeholder="e.g. 1"
                                value={tableId}
                                onChange={(e) => setTableId(e.target.value)}
                                className="input"
                            />
                        </label>

                        <label className="form-label">
                            Search
                            <input
                                placeholder="order id, table/name, item name…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="input"
                            />
                        </label>

                        <label className="form-label">
                            Limit
                            <input
                                type="number"
                                min="1"
                                max="1000"
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value) || 100)}
                                className="input"
                            />
                        </label>

                        <div className="self-end">
                            <button onClick={fetchOrders} disabled={busy} className="btn btn-primary">
                                {busy ? "Loading…" : "Apply filters"}
                            </button>
                        </div>
                    </div>
                    {err ? <div className="error-text">{err}</div> : null}
                </section>
            )}

            {activePanel === "stats" && (
                <section className="card">
                    <h3 className="mt-0">Quick stats</h3>
                    <div className="stats-row">
                        <Stat label="Orders" value={stats.totalOrders} />
                        <Stat label="Items" value={stats.totalItems} />
                        <Stat label="Revenue" value={fmtMKD(stats.revenue)} />
                    </div>
                    {stats.monthRows.length ? (
                        <div className="mt-12">
                            <h4 className="mb-8">By month</h4>
                            <div className="grid gap-8">
                                {stats.monthRows.map((m) => (
                                    <div key={m.month} className="month-row">
                                        <div>{m.month}</div>
                                        <div>{m.orders} orders</div>
                                        <div>{fmtMKD(m.revenue)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>
            )}

            {/* Data table */}
            <section className="card mt-16">
                <h3 className="mt-0">Orders</h3>
                {!orders.length ? (
                    <div className="muted">No results.</div>
                ) : (
                    <div className="grid gap-10">
                        {orders.map((o) => (
                            <OrderCard key={o.id} order={o} />
                        ))}
                    </div>
                )}
            </section>

            {activePanel === "employees" && (
                <EmployeeManager currentUser={_user} />
            )}
        </div>
    );
}
