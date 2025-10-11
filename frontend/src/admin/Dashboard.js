import { useEffect, useMemo, useState } from "react";
import {
    apiLogin,
    apiMe,
    apiLogout,
    apiFetchOrdersAdmin,
    DEFAULT_FROM_STR,
    DEFAULT_TO_STR,
    computeStats,
    fmtMKD,
} from "./dashboardApi";
import "./dashboard.css";

function Login({ onSuccess }) {
    const [username, setUsername] = useState("rockcafe");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
            const res = await apiLogin(username, password);
            if (res?.success) onSuccess(res);
            else setErr(res?.error || "Login failed");
        } catch (e2) {
            setErr(e2?.message || "Login error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="center-box">
            <div className="card">
                <h2 className="mt-0">RockCafe Admin</h2>
                <form onSubmit={handleSubmit} className="grid-gap-10">
                    <label className="form-label">
                        Username
                        <input
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </label>
                    <label className="form-label">
                        Password
                        <input
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    {err ? <div className="error-text">{err}</div> : null}
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}

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
    const badgeClass =
        order.status === "completed"
            ? "badge badge--completed"
            : order.status === "canceled"
                ? "badge badge--canceled"
                : "badge badge--pending";

    return (
        <div className="order-card">
            <div className="order-header" onClick={() => setOpen((v) => !v)}>
                <div>
                    <strong>#{order.id}</strong> • {order.table_name ?? `table ${order.table_id}`} •{" "}
                    <span className="muted">{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div className="row gap-10">
                    <span className={badgeClass}>{order.status}</span>
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

export default function Dashboard() {
    const [user, setUser] = useState(null); // { id, role, username }
    const [loadingUser, setLoadingUser] = useState(true);

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
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const me = await apiMe();
                if (mounted) setUser(me);
            } catch {
                // not logged in
            } finally {
                if (mounted) setLoadingUser(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const handleLogout = async () => {
        await apiLogout();
        setUser(null);
        setOrders([]);
    };

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

    if (loadingUser) return <div className="p-16">Loading…</div>;
    if (!user || user.role !== "admin") {
        return <Login onSuccess={() => window.location.reload()} />;
    }

    return (
        <div className="admin-container">
            <header className="admin-header mb-16">
                <h2 className="mt-0">RockCafe · Admin Dashboard</h2>
                <div className="row gap-8">
                    <span className="muted">
                        Signed in as <strong>{user.username}</strong> ({user.role})
                    </span>
                    <button onClick={handleLogout} className="btn btn-ghost">Logout</button>
                </div>
            </header>

            {/* Filters */}
            <section className="card">
                <h3 className="mt-0">Filters</h3>
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
                            <option value="pending">pending</option>
                            <option value="completed">completed</option>
                            <option value="canceled">canceled</option>
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

            {/* Stats */}
            <section className="card mt-16">
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
        </div>
    );
}
